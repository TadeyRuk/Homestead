import { describe, expect, it } from "vitest";
import type { Input } from "../core/input";
import { createState } from "../core/state";
import { enterPhase } from "../core/phases";
import { createClient, createHost, type Conn } from "./session";

const still: Input = { dx: 0, dy: 0, interact: false, panel: false, switch: false };

// two ends of one in-memory connection
function pair(): [Conn, Conn] {
  const make = () => {
    const data: ((raw: unknown) => void)[] = [];
    const close: (() => void)[] = [];
    let open = true;
    return { data, close, get open() { return open; }, shut() { open = false; close.forEach((f) => f()); } };
  };
  const a = make();
  const b = make();
  const conn = (me: ReturnType<typeof make>, other: ReturnType<typeof make>): Conn => ({
    send: (msg) => { if (me.open && other.open) other.data.forEach((f) => f(structuredClone(msg))); },
    onData: (cb) => { me.data.push(cb); },
    onClose: (cb) => { me.close.push(cb); },
    close: () => { if (me.open) { me.shut(); other.shut(); } },
  });
  return [conn(a, b), conn(b, a)];
}

function setup() {
  const state = createState(1, "mars");
  const ended: string[] = [];
  const clock = { now: 0 };
  const host = createHost(state, "Host", (r) => ended.push(`host: ${r}`), () => clock.now);
  const join = (name: string) => {
    const [hostSide, clientSide] = pair();
    host.addConnection(hostSide);
    const client = createClient(clientSide, name, (r) => ended.push(`${name}: ${r}`), () => clock.now);
    return { client, hostSide, clientSide };
  };
  return { state, host, join, ended, clock };
}

describe("host and client", () => {
  it("adds a joiner to the crew and sends them their id and the state", () => {
    const { state, join } = setup();
    const { client } = join("Ada");
    expect(state.players.map((p) => p.name)).toEqual(["Host", "Ada"]);
    expect(client.playerId()).toBe(state.players[1].id);
    expect(client.state()?.players).toHaveLength(2);
  });

  it("moves a joiner's player on the host from the inputs they send", () => {
    const { state, host, join } = setup();
    const { client } = join("Ada");
    enterPhase(state, "campus", 0);
    const ada = () => state.players[1];
    const x0 = ada().x;
    client.sendInput({ ...still, dx: 1 });
    host.tick(1_000, 0.5, still);
    expect(ada().x).toBeGreaterThan(x0);
  });

  it("sends a joiner's one-shot press to step once, not every tick", () => {
    const { state, host, join } = setup();
    const { client } = join("Ada");
    enterPhase(state, "campus", 0);
    client.sendInput({ ...still, interact: true });
    expect(host.inputs()[state.players[1].id].interact).toBe(true);
    host.tick(1_000, 0.016, still);
    expect(host.inputs()[state.players[1].id].interact).toBe(false);
  });

  it("ignores malformed messages from a joiner", () => {
    const { state, host, join } = setup();
    const { clientSide } = join("Ada");
    enterPhase(state, "campus", 0);
    const x0 = state.players[1].x;
    clientSide.send({ t: "input", input: { ...still, dx: 99 } });
    clientSide.send("garbage");
    host.tick(1_000, 0.5, still);
    expect(state.players[1].x).toBe(x0);
  });

  it("broadcasts snapshots about 30 times a second, every other tick", () => {
    const { state, host, join } = setup();
    const { client } = join("Ada");
    enterPhase(state, "campus", 0);
    host.tick(1_000, 0.016, { ...still, dx: 1 });
    const seen = client.state()!.players[0].x;
    host.tick(1_016, 0.016, { ...still, dx: 1 });
    expect(client.state()!.players[0].x).toBe(seen);
    host.tick(1_033, 0.016, { ...still, dx: 1 });
    expect(client.state()!.players[0].x).toBeGreaterThan(seen);
  });

  it("hands each snapshot to the joiner with the host's time, for smoothing", () => {
    const { state, host } = setup();
    const [hostSide, clientSide] = pair();
    host.addConnection(hostSide);
    const got: number[] = [];
    createClient(clientSide, "Ada", () => {}, () => 0, (_s, hostNow) => got.push(hostNow));
    enterPhase(state, "campus", 0);
    host.tick(2_000, 0.016, still);
    expect(got.at(-1)).toBe(2_000);
  });

  it("refuses to add a joiner once the run has started", () => {
    const { state, join, ended } = setup();
    enterPhase(state, "brief", 0);
    join("Late");
    expect(state.players).toHaveLength(1);
    expect(ended).toEqual(["Late: Run already started"]);
  });

  it("refuses a fifth crew member", () => {
    const { state, join, ended } = setup();
    join("B");
    join("C");
    join("D");
    join("E");
    expect(state.players).toHaveLength(4);
    expect(ended).toEqual(["E: Crew is full"]);
  });

  it("ends the run for everyone when a joiner drops", () => {
    const { join, ended } = setup();
    const ada = join("Ada");
    join("Bo");
    ada.clientSide.close();
    expect(ended).toContain("host: Ada left");
    expect(ended).toContain("Bo: Ada left");
  });

  it("ends the run for a joiner when the host drops", () => {
    const { join, ended } = setup();
    const { hostSide } = join("Ada");
    hostSide.close();
    expect(ended).toContain("Ada: Host left");
  });

  it("keeps the lobby open to joiners while the host is ticking", () => {
    const { state, host, join } = setup();
    host.tick(10_000, 0.016, still);
    join("Ada");
    expect(state.players.map((p) => p.name)).toEqual(["Host", "Ada"]);
  });

  it("keeps a press that arrives with a newer input before the host's next tick", () => {
    const { state, join, host } = setup();
    const { client } = join("Ada");
    client.sendInput({ ...still, interact: true });
    client.sendInput({ ...still, dx: 1 });
    expect(host.inputs()[state.players[1].id]).toMatchObject({ dx: 1, interact: true });
  });

  it("gives the host all four roles until roles are split in the lobby", () => {
    const { state } = setup();
    expect(state.players[0].roles).toEqual(["pilot", "engineer", "comms", "science"]);
  });

  it("ends the run when a joiner goes silent, since a closed tab may never fire close", () => {
    const { host, join, ended, clock } = setup();
    join("Ada");
    clock.now = 9_000;
    host.tick(clock.now, 0.016, still);
    expect(ended).toEqual([]);
    clock.now = 10_500;
    host.tick(clock.now, 0.016, still);
    expect(ended).toContain("host: Ada left");
  });

  it("counts a ping as hearing from a joiner", () => {
    const { host, join, ended, clock } = setup();
    const { client } = join("Ada");
    clock.now = 9_000;
    client.ping();
    clock.now = 15_000;
    host.tick(clock.now, 0.016, still);
    expect(ended).toEqual([]);
  });

  it("ends the run for a joiner when snapshots stop arriving", () => {
    const { join, ended, clock } = setup();
    const { client } = join("Ada");
    clock.now = 10_500;
    client.check();
    expect(ended).toContain("Ada: Host left");
  });

  it("ends the run for everyone with 'Run complete' when the report finishes", () => {
    const { state, host, join, ended } = setup();
    join("Ada");
    enterPhase(state, "report", 0);
    host.tick(60_000, 0.016, still);
    expect(ended).toEqual(["Ada: Run complete", "host: Run complete"]);
  });

  it("goes quiet after the run ends, so a late close can't end a newer run", () => {
    const { host, join, ended } = setup();
    const { hostSide } = join("Ada");
    host.end("Run complete");
    hostSide.close();
    expect(ended.filter((e) => e.startsWith("host"))).toEqual(["host: Run complete"]);
  });

  it("tells a joiner the host's clock, so phase timers read right on every tab", () => {
    const { state, host, join, clock } = setup();
    const { client } = join("Ada");
    enterPhase(state, "campus", 0);
    clock.now = 1_000;
    host.tick(50_000, 0.016, still);
    expect(client.hostNow()).toBe(50_000);
    clock.now = 1_500;
    expect(client.hostNow()).toBe(50_500);
  });

  it("stays connected while snapshots keep arriving", () => {
    const { state, host, join, ended, clock } = setup();
    const { client } = join("Ada");
    enterPhase(state, "campus", 0);
    clock.now = 9_000;
    host.tick(9_000, 0.016, still);
    clock.now = 15_000;
    client.check();
    expect(ended).toEqual([]);
  });

  it("ignores a second hello on the same connection", () => {
    const { state, host, ended } = setup();
    const [hostSide, clientSide] = pair();
    host.addConnection(hostSide);
    const welcomes: unknown[] = [];
    clientSide.onData((m) => (m as { t: string }).t === "welcome" && welcomes.push(m));
    clientSide.send({ t: "hello", name: "Ada" });
    clientSide.send({ t: "hello", name: "Ada again" });
    expect(state.players).toHaveLength(2);
    expect(welcomes).toHaveLength(1);
    expect(ended).toEqual([]);
  });

  it("ignores input sent before hello", () => {
    const { host } = setup();
    const [hostSide, clientSide] = pair();
    host.addConnection(hostSide);
    clientSide.send({ t: "input", input: { ...still, dx: 1 } });
    expect(host.inputs()).toEqual({});
  });

  it("gives each joiner roles from whoever holds the most", () => {
    const { state, join } = setup();
    join("Ada");
    expect(state.players.map((p) => p.roles)).toEqual([["pilot", "engineer"], ["comms", "science"]]);
  });

  it("does not let start run twice and wipe a run in progress", () => {
    const { state, host } = setup();
    host.start(0);
    enterPhase(state, "campus", 0);
    state.ship.hull = 0.5;
    host.start(1_000);
    expect(state.phase).toBe("campus");
    expect(state.ship.hull).toBe(0.5);
  });

  it("lets a joiner take a role in the lobby, swapping with its holder", () => {
    const { state, join } = setup();
    const { client } = join("Ada");
    client.pickRole("pilot");
    expect(state.players.map((p) => p.roles)).toEqual([["engineer", "comms"], ["pilot", "science"]]);
    expect(client.state()!.players[1].roles).toEqual(["pilot", "science"]); // Ada gave away comms
  });

  it("ignores role requests once the run has started", () => {
    const { state, host, join } = setup();
    const { client } = join("Ada");
    host.start(0);
    client.pickRole("pilot");
    expect(state.players[1].roles).toEqual(["comms", "science"]);
  });

  it("starts the run on the host's mission pick, and the host can take a role too", () => {
    const { state, host, join } = setup();
    join("Ada");
    host.takeRole("science");
    host.setMission("moon");
    host.start(1_000);
    expect(state.phase).toBe("brief");
    expect(state.mission).toBe("moon");
    expect(state.players[0].roles).toEqual(["engineer", "science"]); // swaps away pilot, its first other role
  });
});
