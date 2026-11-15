import { DROP_MS, HOST_ID, type Conn } from "./session";

// A host/join room that knows nothing about the game it carries: the prototype (plain JS) runs its
// own simulation on the host and hands the room an opaque snapshot to send. Joiners send raw keys
// and the pointer, which the host feeds into the prototype as that player's input.

export interface RawInput {
  down: string[];
  hit: string[];
  mx: number;
  my: number;
  mdown: boolean;
  click: boolean;
}
export interface Member {
  id: string;
  name: string;
  suit: string;
}
export type Profile = Omit<Member, "id">;

const MAX_CREW = 4;
// past this many bytes queued for a joiner, snapshots to it are skipped until it drains: an old snapshot
// waiting behind other old ones is only delay
const MAX_BACKLOG = 32 * 1024;
const MAX_KEYS = 24;
type Clock = () => number;
const realClock: Clock = () => performance.now();

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const codes = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length <= MAX_KEYS && v.every((c) => typeof c === "string" && c.length <= 24);
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function parseInput(v: unknown): RawInput | null {
  if (!isObj(v) || !codes(v.down) || !codes(v.hit) || !num(v.mx) || !num(v.my)) return null;
  if (typeof v.mdown !== "boolean" || typeof v.click !== "boolean") return null;
  return { down: v.down, hit: v.hit, mx: v.mx, my: v.my, mdown: v.mdown, click: v.click };
}

const NAME_MAX = 14;
function parseProfile(v: Record<string, unknown>): Profile | null {
  if (typeof v.name !== "string" || typeof v.suit !== "string" || !/^#[0-9a-f]{6}$/i.test(v.suit)) return null;
  return { name: Array.from(v.name.trim()).slice(0, NAME_MAX).join("") || "Crew", suit: v.suit };
}

function parseMembers(v: unknown): Member[] | null {
  if (!Array.isArray(v) || v.length > MAX_CREW) return null;
  const out: Member[] = [];
  for (const m of v) {
    const profile = isObj(m) && typeof m.id === "string" ? parseProfile(m) : null;
    if (!profile || !isObj(m)) return null;
    out.push({ id: String(m.id), ...profile });
  }
  return out;
}

export function createRoomHost(me: Profile, onEnd: (reason: string) => void, clock: Clock = realClock) {
  const members: Member[] = [{ id: HOST_ID, ...(parseProfile({ ...me }) ?? { name: "Crew", suit: "#f08c32" }) }];
  const crew = new Map<string, Conn>();
  const inputs: Record<string, RawInput> = {};
  const heard: Record<string, number> = {};
  const pending = new Map<Conn, number>();
  const dropped = new WeakSet<Conn>();
  const stale = new Set<string>();
  let nextId = 2;
  let locked = false;
  let ended = false;
  let hostNow = clock();

  const broadcast = (msg: unknown) => crew.forEach((c) => c.send(msg));
  const roster = () => broadcast({ t: "crew", members });

  function end(reason: string) {
    if (ended) return;
    ended = true;
    broadcast({ t: "end", reason });
    crew.forEach((c) => c.close());
    crew.clear();
    pending.forEach((_, c) => c.close());
    pending.clear();
    onEnd(reason);
  }

  const refuse = (conn: Conn, reason: string) => {
    conn.send({ t: "end", reason });
    conn.close();
  };

  function left(id: string, closed = false) {
    const conn = crew.get(id);
    if (!conn) return;
    crew.delete(id);
    delete inputs[id];
    stale.delete(id);
    const reason = `${members.find((m) => m.id === id)?.name ?? "A crew member"} left`;
    // a joiner that went quiet may still be listening; tell it before closing its side
    if (!closed) refuse(conn, reason);
    // before the run starts, leaving the lobby only frees the seat; once it starts, the run needs everyone
    if (!locked) {
      members.splice(members.findIndex((m) => m.id === id), 1);
      roster();
    } else end(reason);
  }

  function addConnection(conn: Conn) {
    let id: string | null = null;
    pending.set(conn, clock());
    conn.onData((raw) => {
      if (!isObj(raw) || ended || dropped.has(conn)) return;
      if (id !== null) heard[id] = clock();
      if (raw.t === "hello" && id === null) {
        const profile = parseProfile(raw);
        pending.delete(conn);
        if (!profile) {
          console.warn("refused a hello with a bad profile", raw);
          return refuse(conn, "Bad crew profile");
        }
        if (locked) return refuse(conn, "Run already started");
        if (members.length >= MAX_CREW) return refuse(conn, "Crew is full");
        id = `p${nextId++}`;
        members.push({ id, ...profile });
        crew.set(id, conn);
        stale.add(id);   // its first snapshot must be a full one
        heard[id] = clock();
        conn.send({ t: "welcome", id, hostNow });
        roster();
      } else if (raw.t === "ping" && id !== null && num(raw.at)) {
        conn.send({ t: "pong", at: raw.at });
      } else if (raw.t === "input" && id !== null) {
        const input = parseInput(raw.input);
        if (!input) return;
        // or-in presses so one sent just before a newer input still reaches the next tick
        const prev = inputs[id];
        inputs[id] = prev ? { ...input, hit: [...new Set([...prev.hit, ...input.hit])].slice(-MAX_KEYS), click: input.click || prev.click } : input;
      }
    });
    conn.onClose(() => {
      pending.delete(conn);
      if (id !== null) left(id, true);
    });
  }

  return {
    addConnection,
    members: () => members,
    inputs: () => inputs,
    /** presses count once; held keys stay until the joiner sends a new input */
    clearPresses: () => {
      for (const i of Object.values(inputs)) {
        i.hit = [];
        i.click = false;
      }
    },
    /** stop taking joiners: the run has started */
    lock: () => {
      locked = true;
    },
    /**
     * snapshot may be a delta; full() gives the whole state, sent instead to a joiner that is new or that
     * missed snapshots while its link was backed up
     */
    send: (snapshot: unknown, now: number, full?: () => unknown) => {
      hostNow = now;
      if (ended) return;
      let whole: unknown;
      for (const [id, conn] of crew) {
        if (conn.backlog && conn.backlog() > MAX_BACKLOG) { stale.add(id); continue; }
        if (full && stale.has(id)) {
          whole ??= full();
          conn.send({ t: "snap", data: whole, hostNow: now });
        } else conn.send({ t: "snap", data: snapshot, hostNow: now });
        stale.delete(id);
      }
    },
    /** call every tick: a joiner that goes quiet leaves (ending a started run); a connection that never said hello is refused */
    check: () => {
      if (ended) return;
      for (const id of crew.keys()) if (clock() - heard[id] > DROP_MS) return left(id);
      for (const [conn, opened] of pending) {
        if (clock() - opened > DROP_MS) {
          pending.delete(conn);
          dropped.add(conn);
          refuse(conn, "Took too long to join");
        }
      }
    },
    end,
  };
}

export function createRoomClient(
  conn: Conn,
  me: Profile,
  onEnd: (reason: string) => void,
  clock: Clock = realClock,
  onSnapshot?: (data: unknown, hostNow: number) => void,
) {
  let id: string | null = null;
  let members: Member[] = [];
  let offset = 0;
  let ended = false;
  let heard = clock();
  let rtt: number | null = null;

  const finish = (reason: string) => {
    if (ended) return;
    ended = true;
    onEnd(reason);
  };

  conn.onData((raw) => {
    if (!isObj(raw)) return;
    heard = clock();
    if (raw.t === "welcome" && typeof raw.id === "string" && id === null) {
      id = raw.id;
      if (num(raw.hostNow)) offset = raw.hostNow - clock();
    } else if (raw.t === "pong" && num(raw.at)) rtt = clock() - raw.at;
    else if (raw.t === "crew") members = parseMembers(raw.members) ?? members;
    else if (raw.t === "snap" && num(raw.hostNow)) {
      offset = raw.hostNow - clock();
      try {
        onSnapshot?.(raw.data, raw.hostNow);
      } catch (e) {
        // the host is still talking, so the silence check would never fire: end here instead of freezing
        console.error("could not apply a snapshot", e);
        finish("Lost sync with the host");
        conn.close();
      }
    } else if (raw.t === "end") {
      finish(typeof raw.reason === "string" ? raw.reason.slice(0, 80) : "Host left");
      conn.close();
    }
  });
  conn.onClose(() => finish("Host left"));
  conn.send({ t: "hello", ...me });

  return {
    id: () => id,
    /** the last measured round trip to the host in ms, or null before the first pong */
    rtt: () => rtt,
    route: () => (conn.route ? conn.route() : Promise.resolve("unknown")),
    members: () => members,
    hostNow: () => clock() + offset,
    sendInput: (input: RawInput) => {
      if (!ended) conn.send({ t: "input", input });
    },
    ping: () => {
      if (!ended) conn.send({ t: "ping", at: clock() });
    },
    check: () => {
      if (!ended && clock() - heard > DROP_MS) {
        finish("Host left");
        conn.close();
      }
    },
    leave: () => {
      ended = true;
      conn.close();
    },
  };
}
