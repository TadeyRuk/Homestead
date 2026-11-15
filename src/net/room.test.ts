import { describe, expect, it } from "vitest";
import { createRoomClient, createRoomHost, type RawInput } from "./room";
import { DROP_MS, type Conn } from "./session";

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

  it("ends a started run for everyone when a joiner goes quiet", () => {
    const { host, join, ended, clock } = setup();
    join("Ben");
    host.lock();
    clock.now = DROP_MS + 1;
    host.check();
    expect(ended).toEqual(["Ben: Ben left", "host: Ben left"]);
  });

  it("ends a started run when a joiner closes the connection", () => {
    const { host, join, ended } = setup();
    const { clientSide } = join("Ben");
    host.lock();
    clientSide.close();
    expect(ended).toContain("host: Ben left");
  });

  it("sends the joiner back when the host goes quiet", () => {
    const { join, ended, clock } = setup();
    const { client } = join("Ben");
    clock.now = DROP_MS + 1;
    client.check();
    expect(ended[0]).toBe("Ben: Host left");
  });

  it("drops a connection that never says hello", () => {
    const { host, ended, clock } = setup();
    const [hostSide, clientSide] = pair();
    let reason = "";
    clientSide.onData((raw) => { reason = (raw as { reason: string }).reason; });
    host.addConnection(hostSide);
    clock.now = DROP_MS + 1;
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

  it("tells the rest of the crew when one joiner drops", () => {
    const { host, join, ended, clock } = setup();
    join("Ben");
    clock.now = 5_000;
    const { client: cy } = join("Cy");
    host.lock();
    clock.now = DROP_MS + 1;
    cy.ping();
    host.check();
    expect(ended).toContain("Cy: Ben left");
    expect(ended).toContain("host: Ben left");
  });

  it("passes the host's own reason when it ends the game", () => {
    const { host, join, ended } = setup();
    join("Ben");
    host.end("The host hit an error");
    expect(ended).toContain("Ben: The host hit an error");
  });

  it("keeps a click until the host has used it", () => {
    const { host, join } = setup();
    const { client } = join("Ben");
    client.sendInput(key({ click: true }));
    client.sendInput(key());
    expect(host.inputs().p2.click).toBe(true);
    host.clearPresses();
    expect(host.inputs().p2.click).toBe(false);
  });

  it("caps merged presses", () => {
    const { host, join } = setup();
    const { client } = join("Ben");
    for (let i = 0; i < 5; i++) client.sendInput(key({ hit: Array.from({ length: 20 }, (_, k) => `K${i}-${k}`) }));
    expect(host.inputs().p2.hit.length).toBeLessThanOrEqual(24);
  });

  it("keeps the last good input when a bad one arrives", () => {
    const { host, join } = setup();
    const { client, clientSide } = join("Ben");
    client.sendInput(key({ down: ["KeyD"] }));
    clientSide.send({ t: "input", input: { down: 3 } });
    expect(host.inputs().p2.down).toEqual(["KeyD"]);
  });

  it("does not seat a connection refused for taking too long", () => {
    const { host, clock } = setup();
    const [hostSide, clientSide] = pair();
    const late: ((raw: unknown) => void)[] = [];
    host.addConnection({ ...hostSide, onData: (cb) => { late.push(cb); hostSide.onData(cb); } });
    clock.now = DROP_MS + 1;
    host.check();
    late.forEach((cb) => cb({ t: "hello", name: "Late", suit: "#ffffff" }));
    expect(host.members()).toHaveLength(1);
    void clientSide;
  });

  it("refuses a bad profile with a reason and tidies names", () => {
    const { host, join, ended } = setup();
    const [hostSide, clientSide] = pair();
    let reason = "";
    clientSide.onData((raw) => { reason = (raw as { reason: string }).reason; });
    host.addConnection(hostSide);
    clientSide.send({ t: "hello", name: "X", suit: "orange" });
    expect(reason).toBe("Bad crew profile");
    join("   ");
    join("A name far too long for the lobby");
    expect(host.members().slice(1).map((m) => m.name)).toEqual(["Crew", "A name far too"]);
    expect(ended).toEqual([]);
  });

  it("lets a joiner leave the lobby without ending the room", () => {
    const { host, join, ended } = setup();
    const { client: ben } = join("Ben");
    const { client: cy } = join("Cy");
    ben.leave();
    expect(ended).toEqual([]);
    expect(host.members().map((m) => m.name)).toEqual(["Ana", "Cy"]);
    expect(cy.members().map((m) => m.name)).toEqual(["Ana", "Cy"]);
  });

  it("ends with a reason when the snapshot handler throws", () => {
    const ended: string[] = [];
    const host = createRoomHost({ name: "Ana", suit: "#f08c32" }, () => {});
    const [hostSide, clientSide] = pair();
    host.addConnection(hostSide);
    createRoomClient(clientSide, { name: "Ben", suit: "#46d2e6" }, (r) => ended.push(r), undefined, () => { throw new Error("bad scene"); });
    host.send({ scene: "nowhere" }, 1);
    expect(ended).toEqual(["Lost sync with the host"]);
  });

  it("ignores a second welcome and a malformed roster", () => {
    const { join } = setup();
    const { client, hostSide } = join("Ben");
    hostSide.send({ t: "welcome", id: "host" });
    hostSide.send({ t: "crew", members: [{ id: 1, name: 2 }] });
    expect(client.id()).toBe("p2");
    expect(client.members().map((m) => m.id)).toEqual(["host", "p2"]);
  });
});
