import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Input } from "../core/input";
import { enterPhase } from "../core/phases";
import { createState, type GameState } from "../core/state";
import { step } from "../core/step";
import "../ground/ground.register";
import { ePrompt } from "../ground/prompt";
import { groundScene } from "../ground/scene";
import { SURFACE } from "../ground/surface";
import { player, recordingCtx, STILL } from "../ground/testing";
import { gameLines } from "../report/analyze";
import { inSurfaceGame, registerSurfaceGame, unregisterSurfaceGame, type GameResult } from "./games";
import { objectiveLines } from "./objectives";
import { objectivePool, registerObjectivePool, type PoolEntry } from "./stats";

// a stand-in minigame: hold W for a second to finish, E fails the attempt
interface Stub {
  held: number;
}
const KIND = "stub-game";
const SPOT = { x: 1700, y: 600 };
let built = 0;
const pools = { mars: [] as readonly PoolEntry[], moon: [] as readonly PoolEntry[] };

beforeAll(() => {
  // the stub is always drawn: it is in every pool with only the fixed objectives
  for (const m of ["mars", "moon"] as const) {
    pools[m] = objectivePool(m);
    registerObjectivePool(m, ["scan", KIND, "sample"]);
  }
  SURFACE.gameSpots[KIND] = { mars: SPOT, moon: SPOT };
  registerSurfaceGame<Stub>(KIND, {
    name: "Stub game",
    label: (m) => `Play the stub on ${m}`,
    slot: "power",
    keys: "W: hold",
    eligible: (part) => part !== "small-solar",
    fact: () => "Stubs are real.",
    start: () => {
      built += 1;
      return { held: 0 };
    },
    update(g, input, dt): GameResult {
      if (input.interact) return "failed";
      if (input.dy < 0) g.held += dt;
      return g.held >= 1 ? "done" : "playing";
    },
    draw(ctx, g, box) {
      ctx.fillText(`stub ${g.held.toFixed(1)}`, box.x, box.y);
    },
  });
});
afterAll(() => {
  for (const m of ["mars", "moon"] as const) registerObjectivePool(m, [...pools[m]]);
  unregisterSurfaceGame(KIND);
  delete SURFACE.gameSpots[KIND];
});

const E: Input = { ...STILL, interact: true };
const W: Input = { ...STILL, dy: -1 };
const TAB: Input = { ...STILL, switch: true };
let clock = 90_000_000;

function landed(power = "rtg"): GameState {
  const s = createState(11, "mars");
  s.players.push(player("a"), player("b"));
  s.ship.slots = { propulsion: "chemical-engine", power, comms: "high-gain", payload: "camera" };
  s.data.target = 40;
  clock += 1_000_000;
  enterPhase(s, "brief", clock);
  enterPhase(s, "surface", clock);
  step(s, {}, clock, 0.016);
  return s;
}
const me = (s: GameState, id = "a") => s.players.find((p) => p.id === id)!;
const tick = (s: GameState, inputs: Record<string, Input>, dt = 0.1) => step(s, inputs, (clock += dt * 1000), dt);
function openAt(s: GameState, id = "a") {
  Object.assign(me(s, id), SPOT);
  tick(s, { [id]: E });
}

describe("the surface minigame frame (S2-19)", () => {
  it("puts a registered minigame on the list, with a line from its label", () => {
    const s = landed();
    expect(s.objectives[KIND]).toBe(false);
    expect(objectiveLines(s).find((l) => l.id === KIND)).toMatchObject({ label: "Play the stub on mars", done: false, need: 1 });
  });

  it("leaves it off the list for a build it isn't eligible for", () => {
    expect(landed("small-solar").objectives).not.toHaveProperty(KIND);
  });

  it("prompts at its spot, and E there opens the overlay without the press reaching the game", () => {
    const s = landed();
    Object.assign(me(s), SPOT);
    expect(ePrompt(s, me(s))).toBe("[E] start the stub game");
    tick(s, { a: E });
    expect(s.surface.games.a).toMatchObject({ kind: KIND, part: "rtg", tries: 0, failedAt: null, game: { held: 0 } });
    expect(s.log.filter((e) => e.kind === "task_failed")).toEqual([]);
    expect(ePrompt(s, me(s))).toBeNull();
  });

  it("never also picks up a part lying on the spot", () => {
    const s = landed();
    s.parts.push({ id: "x", part: "camera", x: SPOT.x, y: SPOT.y });
    openAt(s);
    expect(me(s).carrying).toBeNull();
    expect(s.parts.map((x) => x.id)).toContain("x");
  });

  it("freezes the player while it is open, while everyone else keeps walking", () => {
    const s = landed();
    openAt(s);
    Object.assign(me(s, "b"), { x: 1500, y: 600 });
    tick(s, { a: { ...W, dx: 1 }, b: { ...STILL, dx: 1 } });
    expect(me(s)).toMatchObject(SPOT);
    expect(me(s, "b").x).toBeGreaterThan(1500);
  });

  it("keeps the suit draining and the surface clock running while it is open", () => {
    const s = landed();
    openAt(s);
    const oxygen = me(s).oxygen;
    const ends = s.phaseEndsAt;
    for (let i = 0; i < 5; i++) tick(s, { a: STILL });
    expect(me(s).oxygen).toBeLessThan(oxygen);
    expect(s.phaseEndsAt).toBe(ends);
    expect(s.surface.games.a).toBeDefined();
  });

  it("on a fail logs task_failed with the part that set the difficulty, and starts a fresh attempt at once", () => {
    const s = landed();
    openAt(s);
    tick(s, { a: W });
    tick(s, { a: E });
    expect(s.log.filter((e) => e.kind === "task_failed")).toEqual([
      expect.objectContaining({ player: "a", part: "rtg", objective: KIND, phase: "surface" }),
    ]);
    expect(s.surface.games.a).toMatchObject({ tries: 1, game: { held: 0 } });
    expect(s.surface.games.a.failedAt).not.toBeNull();
    expect(s.objectives[KIND]).toBe(false);
  });

  it("on success completes the objective and closes the overlay", () => {
    const s = landed();
    openAt(s);
    for (let i = 0; i < 11; i++) tick(s, { a: W });
    expect(s.objectives[KIND]).toBe(true);
    expect(s.surface.games.a).toBeUndefined();
    expect(s.log.filter((e) => e.kind === "objective_done")).toEqual([expect.objectContaining({ objective: KIND, player: "a" })]);
    // done is done: the spot no longer opens
    tick(s, { a: E });
    expect(s.surface.games.a).toBeUndefined();
    expect(gameLines(s)).toEqual(["Stubs are real."]);
  });

  it("lets Tab leave without failing, and closes when the player goes down", () => {
    const s = landed();
    openAt(s);
    tick(s, { a: TAB });
    expect(s.surface.games.a).toBeUndefined();
    expect(s.log.filter((e) => e.kind === "task_failed")).toEqual([]);
    tick(s, { a: E });
    expect(s.surface.games.a).toBeDefined();
    me(s).oxygen = 0;
    tick(s, { a: STILL }); // the suit rule puts them down at the end of this tick
    expect(me(s).down).toBe(true);
    tick(s, { a: STILL });
    expect(s.surface.games.a).toBeUndefined();
  });

  it("keeps a task to one player at a time", () => {
    const s = landed();
    openAt(s, "a");
    Object.assign(me(s, "b"), { x: SPOT.x + 10, y: SPOT.y });
    tick(s, { b: E });
    expect(s.surface.games.b).toBeUndefined();
  });

  it("works for a joiner: the snapshot carries the open game, and only that player's screen shows the overlay", () => {
    const s = landed();
    openAt(s, "b");
    tick(s, { b: W });
    const snap = JSON.parse(JSON.stringify(s)) as GameState;
    expect(snap.surface.games.b).toEqual(s.surface.games.b);
    expect(inSurfaceGame(snap, "b")).toBe(true);
    expect(inSurfaceGame(snap, "a")).toBe(false);

    const scene = groundScene("surface");
    const joiner = recordingCtx();
    scene.draw(joiner.ctx, snap, { playerId: "b", now: clock });
    expect(joiner.texts()).toContain("STUB GAME");
    expect(joiner.texts()).toContain("stub 0.1");
    const host = recordingCtx();
    scene.draw(host.ctx, snap, { playerId: "a", now: clock });
    expect(host.texts()).not.toContain("STUB GAME");

    // and the failure flash shows on the joiner's screen right after a fail
    tick(s, { b: E });
    const after = JSON.parse(JSON.stringify(s)) as GameState;
    const flash = recordingCtx();
    scene.draw(flash.ctx, after, { playerId: "b", now: clock });
    expect(flash.texts()).toContain("FAILED · try again");
  });

  it("gives the report a line for failures with the part", () => {
    const s = landed();
    openAt(s);
    tick(s, { a: E });
    tick(s, { a: E });
    expect(gameLines(s)).toEqual(["The stub game failed 2 times with the radioisotope generator."]);
    expect(built).toBeGreaterThan(0);
  });
});
