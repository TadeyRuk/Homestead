import { DROP_MS, HOST_ID, type Conn } from "./session";

/**
 * A host/join room that knows nothing about the game it carries: the prototype (plain JS) runs its
 * own simulation on the host and hands the room an opaque snapshot to send. Joiners send raw keys
 * and the pointer, which the host feeds into the prototype as that player's input.
 */
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

function parseProfile(v: Record<string, unknown>): Profile | null {
  if (typeof v.name !== "string" || typeof v.suit !== "string" || !/^#[0-9a-f]{6}$/i.test(v.suit)) return null;
  return { name: v.name.trim().slice(0, 14) || "Crew", suit: v.suit };
}

export function createRoomHost(me: Profile, onEnd: (reason: string) => void, clock: Clock = realClock) {
  const members: Member[] = [{ id: HOST_ID, ...me }];
  const crew = new Map<string, Conn>();
  const inputs: Record<string, RawInput> = {};
  const heard: Record<string, number> = {};
  const pending = new Map<Conn, number>();
  const dropped = new WeakSet<Conn>();
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

  function left(id: string) {
    const conn = crew.get(id);
    if (!conn) return;
    crew.delete(id);
    const reason = `${members.find((m) => m.id === id)?.name ?? "A crew member"} left`;
    // a joiner that went quiet may still be listening; tell it before closing its side
    refuse(conn, reason);
    end(reason);
  }

  function addConnection(conn: Conn) {
    let id: string | null = null;
    pending.set(conn, clock());
    conn.onData((raw) => {
      if (!isObj(raw) || ended || dropped.has(conn)) return;
      if (id !== null) heard[id] = clock();
      if (raw.t === "hello" && id === null) {
        const profile = parseProfile(raw);
        if (!profile) return;
        pending.delete(conn);
        if (locked) return refuse(conn, "Run already started");
        if (members.length >= MAX_CREW) return refuse(conn, "Crew is full");
        id = `p${nextId++}`;
        members.push({ id, ...profile });
        crew.set(id, conn);
        heard[id] = clock();
        conn.send({ t: "welcome", id, hostNow });
        roster();
      } else if (raw.t === "input" && id !== null) {
        const input = parseInput(raw.input);
        if (!input) return;
        // or-in presses so one sent just before a newer input still reaches the next tick
        const prev = inputs[id];
        inputs[id] = prev ? { ...input, hit: [...new Set([...prev.hit, ...input.hit])], click: input.click || prev.click } : input;
      }
    });
    conn.onClose(() => {
      pending.delete(conn);
      if (id !== null) left(id);
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
    send: (snapshot: unknown, now: number) => {
      hostNow = now;
      if (!ended) broadcast({ t: "snap", data: snapshot, hostNow: now });
    },
    /** call every tick: drops joiners that went quiet and connections that never said hello */
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

  const finish = (reason: string) => {
    if (ended) return;
    ended = true;
    onEnd(reason);
  };

  conn.onData((raw) => {
    if (!isObj(raw)) return;
    heard = clock();
    if (raw.t === "welcome" && typeof raw.id === "string") id = raw.id;
    else if (raw.t === "crew" && Array.isArray(raw.members)) members = raw.members as Member[];
    else if (raw.t === "snap" && num(raw.hostNow)) {
      offset = raw.hostNow - clock();
      onSnapshot?.(raw.data, raw.hostNow);
    } else if (raw.t === "end") {
      finish(typeof raw.reason === "string" ? raw.reason : "Host left");
      conn.close();
    }
  });
  conn.onClose(() => finish("Host left"));
  conn.send({ t: "hello", ...me });

  return {
    id: () => id,
    members: () => members,
    hostNow: () => clock() + offset,
    sendInput: (input: RawInput) => {
      if (!ended) conn.send({ t: "input", input });
    },
    ping: () => {
      if (!ended) conn.send({ t: "ping" });
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
