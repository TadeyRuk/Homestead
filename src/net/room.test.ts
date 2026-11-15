import { describe, expect, it } from "vitest";
import { createRoomClient, createRoomHost, type RawInput } from "./room";
import type { Conn } from "./session";

// two ends of one in-memory connection
function pair(): [Conn, Conn] {
  const make = () => ({ data: [] as ((raw: unknown) => void)[], close: [] as (() => void)[], open: true });
  const a = make();
  const b = make();
  const shut = (s: ReturnType<typeof make>) => { if (!s.open) return; s.open = false; s.close.forEach((f) => f()); };
  const conn = (me: ReturnType<typeof make>, other: ReturnType<typeof make>): Conn => ({
    send: (msg) => { if (me.open && other.open) other.data.forEach((f) => f(structuredClone(msg))); },
    onData: (cb) => { me.data.push(cb); },
    onClose: (cb) => { me.close.push(cb); },
    close: () => { shut(me); shut(other); },
  });
  return [conn(a, b), conn(b, a)];
}

const key = (over: Partial<RawInput> = {}): RawInput => ({ down: [], hit: [], mx: 0, my: 0, mdown: false, click: false, ...over });

function setup() {
  const ended: string[] = [];
  const clock = { now: 0 };
  const host = createRoomHost({ name: "Ana", suit: "#f08c32" }, (r) => ended.push(`host: ${r}`), () => clock.now);
  const snaps: Record<string, unknown[]> = {};
  const join = (name: string, conn?: [Conn, Conn]) => {
    const [hostSide, clientSide] = conn ?? pair();
    host.addConnection(hostSide);
    snaps[name] = [];
    const client = createRoomClient(clientSide, { name, suit: "#46d2e6" }, (r) => ended.push(`${name}: ${r}`), () => clock.now, (s) => snaps[name].push(s));
    return { client, hostSide, clientSide };
  };
  return { host, join, ended, clock, snaps };
}

describe("room", () => {
  it("seats a joiner and tells everyone who is in the crew", () => {
    const { host, join } = setup();
    const { client } = join("Ben");
    expect(client.id()).toBe("p2");
    expect(host.members().map((m) => m.name)).toEqual(["Ana", "Ben"]);
    expect(client.members().map((m) => m.id)).toEqual(["host", "p2"]);
  });

  it("refuses a fifth crew member and anyone after the run starts", () => {
    const { host, join, ended } = setup();
    join("B"); join("C"); join("D");
    join("E");
    expect(ended).toContain("E: Crew is full");
    host.lock();
    join("F");
    expect(ended).toContain("F: Run already started");
    expect(host.members()).toHaveLength(4);
  });

  it("delivers snapshots with the host's clock", () => {
    const { host, join, snaps, clock } = setup();
    const { client } = join("Ben");
    clock.now = 300;
    host.send({ scene: "build" }, 500);
    expect(snaps.Ben).toEqual([{ scene: "build" }]);
    clock.now = 400;
    expect(client.hostNow()).toBe(600);
  });

  it("keeps a press until the host has used it, and keeps held keys", () => {
    const { host, join } = setup();
    const { client } = join("Ben");
    client.sendInput(key({ hit: ["KeyE"], down: ["KeyE"] }));
    client.sendInput(key({ down: ["KeyD"], mx: 40 }));
    expect(host.inputs().p2).toEqual(key({ hit: ["KeyE"], down: ["KeyD"], mx: 40 }));
    host.clearPresses();
    expect(host.inputs().p2).toEqual(key({ down: ["KeyD"], mx: 40 }));
  });

  it("ignores malformed input", () => {
    const { host, join } = setup();
    const { clientSide } = join("Ben");
    clientSide.send({ t: "input", input: { down: "KeyE" } });
    clientSide.send({ t: "input", input: key({ down: Array(99).fill("KeyA") }) });
    expect(host.inputs().p2).toBeUndefined();
  });

  it("ends for everyone when a joiner goes quiet", () => {
    const { host, join, ended, clock } = setup();
    join("Ben");
    clock.now = 10_001;
    host.check();
    expect(ended).toEqual(["Ben: Ben left", "host: Ben left"]);
  });

  it("ends when a joiner closes the connection", () => {
    const { join, ended } = setup();
    const { clientSide } = join("Ben");
    clientSide.close();
    expect(ended).toContain("host: Ben left");
  });

  it("sends the joiner back when the host goes quiet", () => {
    const { join, ended, clock } = setup();
    const { client } = join("Ben");
    clock.now = 10_001;
    client.check();
    expect(ended[0]).toBe("Ben: Host left");
  });

  it("drops a connection that never says hello", () => {
    const { host, ended, clock } = setup();
    const [hostSide, clientSide] = pair();
    let reason = "";
    clientSide.onData((raw) => { reason = (raw as { reason: string }).reason; });
    host.addConnection(hostSide);
    clock.now = 10_001;
    host.check();
    expect(reason).toBe("Took too long to join");
    expect(ended).toEqual([]);
  });

  it("a ping keeps a quiet joiner in", () => {
    const { host, join, ended, clock } = setup();
    const { client } = join("Ben");
    clock.now = 9_000;
    client.ping();
    clock.now = 15_000;
    host.check();
    expect(ended).toEqual([]);
  });
});
