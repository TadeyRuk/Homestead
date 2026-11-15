import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Input } from "../core/input";
import { enterPhase } from "../core/phases";
import { createState, type GameState } from "../core/state";
import { step } from "../core/step";
import "../data/data.register";
import "../ground/ground.register";
import { groundScene } from "../ground/scene";
import { SURFACE } from "../ground/surface";
import { player, recordingCtx, STILL } from "../ground/testing";
import { gameLines } from "../report/analyze";
import "./missions.register";
import { surfaceGame } from "./games";
import { objectivePool, registerObjectivePool, type PoolEntry } from "./stats";
import { drawDrill, drillBand, ICE_DRILL, startDrill, stepDrill, type Drill } from "./icedrill";

const DT = 1 / 30;
const W: Input = { ...STILL, dy: -1 };
const S: Input = { ...STILL, dy: 1 };

/** a hand that pushes back only once the needle is `slack` off the band's middle */
const hand = (slack: number) => (d: Drill): Input => {
  const off = d.pressure - d.centre;
  return off > slack ? S : off < -slack ? W : STILL;
};

/** plays one attempt to the end; the result and how long it took */
function play(part: string, seed: number, pilot: (d: Drill) => Input, tries = 0) {
  const d = startDrill(seed, part, tries);
  for (let t = 0; t < 30; t += DT) {
    const r = stepDrill(d, pilot(d), DT);
    if (r !== "playing") return { result: r, seconds: t, drill: d };
  }
  return { result: "playing" as const, seconds: 30, drill: d };
}
const SEEDS = Array.from({ length: 12 }, (_, i) => 1000 + i * 7919);

describe("the ice drill (S2-20)", () => {
  it("gets its band from the power part's torque: narrow for a small solar array, wide for an RTG", () => {
    expect(drillBand("small-solar")).toBeLessThan(drillBand("large-solar"));
    expect(drillBand("large-solar")).toBeLessThan(drillBand("rtg"));
    expect(drillBand("salvage-battery")).toBeLessThanOrEqual(drillBand("small-solar"));
    expect(drillBand(null)).toBe(drillBand("salvage-battery"));
  });

  it("is harder with a small solar array: a slow hand gets through with an RTG and fails with the array", () => {
    const slow = hand(0.1);
    for (const seed of SEEDS) {
      expect(play("rtg", seed, slow).result, `rtg seed ${seed}`).toBe("done");
      expect(play("small-solar", seed, slow).result, `solar seed ${seed}`).toBe("failed");
    }
  });

  it("can still be beaten on a small solar array by a quick hand", () => {
    for (const seed of SEEDS) expect(play("small-solar", seed, hand(0.02)).result).toBe("done");
  });

  it("fails sooner hands-off with a small solar array than with an RTG", () => {
    for (const seed of SEEDS) {
      const solar = play("small-solar", seed, () => STILL);
      const rtg = play("rtg", seed, () => STILL);
      expect(solar.result).toBe("failed");
      expect(solar.seconds).toBeLessThan(rtg.seconds);
    }
  });

  it("jams when leaned on too hard and stalls when let off", () => {
    expect(play("rtg", 5, () => W).drill.over).toBe("jam");
    expect(play("rtg", 5, () => S).drill.over).toBe("stall");
  });

  it("forgives a moment outside the band", () => {
    const d = startDrill(3, "rtg", 0);
    d.pressure = 0.99;
    expect(stepDrill(d, S, 0.2)).toBe("playing");
  });

  it("is the same rock for the same seed and attempt, and new rock on a retry", () => {
    expect(startDrill(9, "rtg", 0)).toEqual(startDrill(9, "rtg", 0));
    expect(startDrill(9, "rtg", 1).layers).not.toEqual(startDrill(9, "rtg", 0).layers);
    expect(startDrill(10, "rtg", 0).layers).not.toEqual(startDrill(9, "rtg", 0).layers);
  });

  it("draws the gauge and the bore without touching the state", () => {
    const d = startDrill(1, "rtg", 0);
    d.pressure = 0.95;
    const frozen = JSON.stringify(d);
    const rec = recordingCtx();
    drawDrill(rec.ctx, d, { x: 0, y: 0, w: 500, h: 220 }, { mission: "mars", part: "rtg", tries: 0, sinceFail: Infinity });
    expect(rec.texts()).toEqual(expect.arrayContaining(["JAM", "STALL", "WATER ICE", "Depth 0%", "Jamming! ease off (S)"]));
    expect(JSON.stringify(d)).toBe(frozen);
  });
});

describe("the ice drill on the surface", () => {
  let clock = 70_000_000;
  // the drill on every run here; the seeded draw itself is tested in pool.test.ts
  const pools = { mars: [] as readonly PoolEntry[], moon: [] as readonly PoolEntry[] };
  beforeAll(() => {
    for (const m of ["mars", "moon"] as const) {
      pools[m] = objectivePool(m);
      registerObjectivePool(m, ["scan", ICE_DRILL, "deploy"]);
    }
  });
  afterAll(() => {
    for (const m of ["mars", "moon"] as const) registerObjectivePool(m, [...pools[m]]);
  });
  function landed(power: string, mission: "mars" | "moon" = "mars"): GameState {
    const s = createState(21, mission);
    s.players.push(player("a"));
    s.ship.slots = { propulsion: "chemical-engine", power, comms: "high-gain", payload: "camera" };
    s.data.target = 40;
    clock += 1_000_000;
    enterPhase(s, "brief", clock);
    enterPhase(s, "surface", clock);
    step(s, {}, clock, 0.016);
    return s;
  }
  const tick = (s: GameState, input: Input) => step(s, { a: input }, (clock += DT * 1000), DT);

  it("is registered and on the list for both missions, with its spot", () => {
    expect(surfaceGame(ICE_DRILL)?.slot).toBe("power");
    for (const mission of ["mars", "moon"] as const) expect(landed("rtg", mission).objectives[ICE_DRILL]).toBe(false);
  });

  it("logs task_failed with the power part when it fails, and completes the objective when it reaches the ice", () => {
    const s = landed("small-solar");
    Object.assign(s.players[0], SURFACE.gameSpots[ICE_DRILL].mars);
    tick(s, { ...STILL, interact: true });
    expect(s.surface.games.a?.kind).toBe(ICE_DRILL);
    // hands off: the rock pushes the needle out of the narrow band
    for (let i = 0; i < 300 && !s.log.some((e) => e.kind === "task_failed"); i++) tick(s, STILL);
    expect(s.log.filter((e) => e.kind === "task_failed")).toEqual([
      expect.objectContaining({ part: "small-solar", objective: ICE_DRILL, player: "a" }),
    ]);
    expect(s.surface.games.a.tries).toBe(1);

    // a steady hand gets it down to the ice
    const steady = hand(0.02);
    for (let i = 0; i < 600 && !s.objectives[ICE_DRILL]; i++) tick(s, steady(s.surface.games.a.game as Drill));
    expect(s.objectives[ICE_DRILL]).toBe(true);
    expect(s.surface.games.a).toBeUndefined();
    expect(gameLines(s)).toEqual([
      "The ice drill failed 1 time with the small solar array before it worked.",
      expect.stringContaining("Phoenix found water ice"),
    ]);
  });

  it("shows its marker and, for the driller, the overlay with the fact line", () => {
    const s = landed("rtg");
    const scene = groundScene("surface");
    const before = recordingCtx();
    Object.assign(s.players[0], { x: 600, y: 520 });
    scene.draw(before.ctx, s, { playerId: "a", now: clock });
    expect(before.texts()).toContain("Ice drill");
    Object.assign(s.players[0], SURFACE.gameSpots[ICE_DRILL].mars);
    tick(s, { ...STILL, interact: true });
    const open = recordingCtx();
    scene.draw(open.ctx, s, { playerId: "a", now: clock });
    expect(open.texts()).toEqual(expect.arrayContaining(["ICE DRILL", "Drill for subsurface water ice", "W/S: keep the pressure in the green band"]));
    expect(open.texts().some((t) => t.includes("Phoenix"))).toBe(true);
  });
});
