import type { Input } from "../core/input";
import { dealRoles, startRun, takeRole, type MissionChoice } from "../core/lobby";
import type { GameState, Player, Role } from "../core/state";
import { step } from "../core/step";
import { parseFromClient, parseFromHost, type FromHost } from "./protocol";

/** one open data channel; PeerJS in the browser, an in-memory pair in tests */
export interface Conn {
  send(msg: unknown): void;
  onData(cb: (raw: unknown) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}

const MAX_CREW = 4;
// about 30 a second; ticks come every ~16 ms, so 30 lands on every other tick (66 gave every fifth, 80 ms)
const SNAPSHOT_MS = 30;
// a closed tab may never fire close, so silence counts as leaving; covers normal background-tab
// throttling, though Chrome's heavier throttling after minutes hidden can still trip it
export const DROP_MS = 10_000;
export const PING_MS = 1_000;
type Clock = () => number;
const realClock: Clock = () => performance.now();
export const HOST_ID = "host";

function newPlayer(id: string, name: string, index: number): Player {
  // placeholder spawn in a row until seat 2's maps give real spawn points
  return { id, name, roles: [], station: null, x: 420 + index * 40, y: 270, carrying: null, oxygen: 1, power: 1, down: false };
}

export function createHost(state: GameState, hostName: string, onEnd: (reason: string) => void, clock: Clock = realClock) {
  state.players.push(newPlayer(HOST_ID, hostName, 0));
  dealRoles(state); // solo holds all four until someone joins
  let mission: MissionChoice = "random";
  const crew = new Map<string, Conn>();
  const inputs: Record<string, Input> = {};
  const heard: Record<string, number> = {};
  let nextId = 2;
  let lastSnapshot = -Infinity;
  let hostNow = clock(); // the latest tick time; snapshots carry it
  let ended = false;

  const send = (conn: Conn, msg: FromHost) => conn.send(msg);
  const broadcast = (msg: FromHost) => crew.forEach((c) => send(c, msg));

  function end(reason: string) {
    if (ended) return;
    ended = true;
    broadcast({ t: "end", reason });
    crew.forEach((c) => c.close());
    crew.clear();
    onEnd(reason);
  }

  function refuse(conn: Conn, reason: string) {
    send(conn, { t: "end", reason });
    conn.close();
  }

  function addConnection(conn: Conn) {
    let id: string | null = null;
    conn.onData((raw) => {
      const msg = parseFromClient(raw);
      if (!msg || ended) return;
      if (id !== null) heard[id] = clock();
      if (msg.t === "hello" && id === null) {
        if (state.phase !== "lobby") return refuse(conn, "Run already started");
        if (state.players.length >= MAX_CREW) return refuse(conn, "Crew is full");
        id = `p${nextId++}`;
        state.players.push(newPlayer(id, msg.name, state.players.length));
        dealRoles(state);
        crew.set(id, conn);
        heard[id] = clock();
        send(conn, { t: "welcome", playerId: id });
        broadcast({ t: "snapshot", state, hostNow });
      } else if (msg.t === "role" && id !== null) {
        if (state.phase !== "lobby") return;
        takeRole(state, id, msg.role);
        broadcast({ t: "snapshot", state, hostNow });
      } else if (msg.t === "input" && id !== null) {
        // or-in presses so one sent just before a newer input still reaches the next tick
        const prev = inputs[id];
        inputs[id] = prev
          ? { ...msg.input, interact: msg.input.interact || prev.interact, panel: msg.input.panel || prev.panel, switch: msg.input.switch || prev.switch }
          : msg.input;
      }
    });
    conn.onClose(() => {
      if (id !== null) left(id);
    });
  }

  function left(id: string) {
    if (!crew.has(id)) return;
    crew.delete(id);
    const name = state.players.find((p) => p.id === id)?.name ?? "A crew member";
    end(`${name} left`);
  }

  function tick(now: number, dt: number, hostInput: Input) {
    if (ended) return;
    hostNow = now;
    for (const id of crew.keys()) {
      if (clock() - heard[id] > DROP_MS) return left(id);
    }
    const before = state.phase;
    step(state, { ...inputs, [HOST_ID]: hostInput }, now, dt);
    // the report wrapping round to the lobby is the end of the run
    if (before === "report" && state.phase === "lobby") return end("Run complete");
    // presses count once; held directions stay until the joiner sends a new input
    for (const input of Object.values(inputs)) {
      input.interact = input.panel = input.switch = false;
    }
    if (now - lastSnapshot >= SNAPSHOT_MS) {
      lastSnapshot = now;
      broadcast({ t: "snapshot", state, hostNow: now });
    }
  }

  return {
    addConnection,
    tick,
    end,
    inputs: () => inputs,
    takeRole: (role: Role) => {
      if (state.phase !== "lobby") return;
      takeRole(state, HOST_ID, role);
      broadcast({ t: "snapshot", state, hostNow });
    },
    setMission: (choice: MissionChoice) => {
      mission = choice;
    },
    start: (now: number) => {
      startRun(state, mission, now);
      broadcast({ t: "snapshot", state, hostNow: now });
    },
  };
}

export function createClient(
  conn: Conn,
  name: string,
  onEnd: (reason: string) => void,
  clock: Clock = realClock,
  onSnapshot?: (state: GameState, hostNow: number) => void,
) {
  let playerId: string | null = null;
  let latest: GameState | null = null;
  let offset = 0; // host clock minus this tab's clock
  let ended = false;
  let heard = clock();

  const finish = (reason: string) => {
    if (ended) return;
    ended = true;
    onEnd(reason);
  };

  conn.onData((raw) => {
    const msg = parseFromHost(raw);
    if (!msg) {
      // the host is trusted, so an unreadable message most likely means two different builds
      console.error("unreadable message from host", raw);
      return;
    }
    heard = clock();
    if (msg.t === "welcome") playerId = msg.playerId;
    else if (msg.t === "snapshot") {
      latest = msg.state;
      offset = msg.hostNow - clock();
      onSnapshot?.(msg.state, msg.hostNow);
    }
    else {
      finish(msg.reason);
      conn.close();
    }
  });
  conn.onClose(() => finish("Host left"));
  conn.send({ t: "hello", name });

  return {
    playerId: () => playerId,
    /** now on the host's clock, for timeLeft and isUp on this tab */
    hostNow: () => clock() + offset,
    state: () => latest,
    sendInput: (input: Input) => {
      if (!ended) conn.send({ t: "input", input });
    },
    pickRole: (role: Role) => {
      if (!ended) conn.send({ t: "role", role });
    },
    ping: () => {
      if (!ended) conn.send({ t: "ping" });
    },
    /** call every frame; the host sends snapshots constantly, so a long gap means it is gone */
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
