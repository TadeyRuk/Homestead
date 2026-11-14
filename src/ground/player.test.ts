import { describe, expect, it } from "vitest";
import { enterPhase } from "../core/phases";
import { createState } from "../core/state";
import { PLAYER_SPEED, step } from "../core/step";
import { PLAYER_HALF } from "./geom";
import "./ground.register";
import { placeCrew, walkOnGround } from "./player";
import { isOpen, player, reachable, STILL } from "./testing";
import { groundFor, TEST_ROOM, useGround } from "./world";

// these tests walk the one-screen test room, whatever the live maps are
useGround("campus", TEST_ROOM);
useGround("surface", TEST_ROOM);

let clock = 1_000;

/** a run that has just entered `phase`, with its crew already placed by the first tick */
function runIn(phase: "campus" | "surface", n = 1) {
  const s = createState(1, "mars");
  for (let i = 0; i < n; i++) s.players.push(player(`p${i}`));
  clock += 10_000;
  enterPhase(s, "brief", clock); // a new run clock, as startRun gives
  enterPhase(s, phase, clock);
  step(s, {}, clock, 0.016);
  return s;
}

const right = { ...STILL, dx: 1 };

describe("crew placement", () => {
  it("puts each player on their own start point when the phase begins", () => {
    const s = runIn("campus", 3);
    const starts = groundFor("campus").starts;
    expect(s.players.map((p) => ({ x: p.x, y: p.y }))).toEqual(starts.slice(0, 3));
  });

  it("places the crew once, not every tick", () => {
    const s = runIn("campus");
    step(s, { p0: right }, clock + 100, 0.5);
    expect(s.players[0].x).toBeCloseTo(groundFor("campus").starts[0].x + PLAYER_SPEED * 0.5);
  });

  it("places the crew again on the surface and in the next run", () => {
    const s = runIn("campus");
    s.players[0].x = 100;
    enterPhase(s, "surface", clock + 1);
    step(s, {}, clock + 1, 0.016);
    expect(s.players[0].x).toBe(groundFor("surface").starts[0].x);
  });

  it("wraps round the start points when there are more players than points", () => {
    const s = createState(1, "mars");
    for (let i = 0; i < 6; i++) s.players.push(player(`p${i}`));
    placeCrew(s, TEST_ROOM);
    expect(s.players[4]).toMatchObject(TEST_ROOM.starts[0]);
  });
});

describe("walking on the ground", () => {
  it("walks a player across open ground at core's speed", () => {
    const s = runIn("campus");
    const x = s.players[0].x;
    step(s, { p0: right }, clock + 16, 0.1);
    expect(s.players[0].x).toBeCloseTo(x + PLAYER_SPEED * 0.1);
  });

  it("stops a player at a wall and keeps them out of it", () => {
    const s = runIn("campus");
    Object.assign(s.players[0], { x: 560, y: 175 }); // left of the room's pillar at x 600
    for (let i = 0; i < 20; i++) step(s, { p0: right }, clock + i, 0.1);
    expect(s.players[0].x).toBe(600 - PLAYER_HALF);
    expect(isOpen(TEST_ROOM, s.players[0])).toBe(true);
  });

  it("keeps a player inside the map on a long background-tab tick", () => {
    const s = runIn("campus");
    Object.assign(s.players[0], { x: 900, y: 100 });
    step(s, { p0: right }, clock + 1, 1);
    expect(s.players[0].x).toBe(960 - 16 - PLAYER_HALF);
  });

  it("leaves a downed player where they fell", () => {
    const s = runIn("surface");
    s.players[0].down = true;
    const x = s.players[0].x;
    step(s, { p0: right }, clock + 1, 0.5);
    expect(s.players[0].x).toBe(x);
  });

  it("gives other seats the same walls for predicted moves", () => {
    expect(walkOnGround("campus", { x: 560, y: 175 }, { x: 640, y: 175 })).toEqual({ x: 600 - PLAYER_HALF, y: 175 });
    expect(walkOnGround("flight", { x: 0, y: 0 }, { x: 5, y: 5 })).toEqual({ x: 5, y: 5 });
  });
});

describe("test room", () => {
  it("has every point on open ground the crew can walk to", () => {
    const points = [...TEST_ROOM.spawnPoints, ...TEST_ROOM.starts, TEST_ROOM.pad!, TEST_ROOM.kiosk!];
    for (const p of points) expect(isOpen(TEST_ROOM, p), `${p.x},${p.y}`).toBe(true);
    expect(reachable(TEST_ROOM, TEST_ROOM.starts[0], points).every(Boolean)).toBe(true);
  });
});
