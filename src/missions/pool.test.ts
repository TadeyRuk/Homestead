import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enterPhase } from "../core/phases";
import { createState, type GameState, type MissionId } from "../core/state";
import { step } from "../core/step";
import "../data/data.register";
import { MISSIONS } from "../data/data";
import "../ground/ground.register";
import { groundScene } from "../ground/scene";
import { player, recordingCtx } from "../ground/testing";
import { scoreRows } from "../report/analyze";
import "./missions.register";
import { registerSurfaceGame, unregisterSurfaceGame } from "./games";
import { ICE_DRILL } from "./icedrill";
import { briefObjectives, drawObjectives, objectiveLines } from "./objectives";
import { DRAWN_OBJECTIVES, objectivePool } from "./stats";

const SEEDS = Array.from({ length: 400 }, (_, i) => (i * 2654435761) >>> 0);
const RTG = { propulsion: "chemical-engine", power: "rtg", comms: "high-gain", payload: "camera" } as const;
const SOLAR = { ...RTG, power: "small-solar" } as const;
let clock = 30_000_000;

function landed(seed: number, mission: MissionId = "mars", slots: GameState["ship"]["slots"] = { ...RTG }): GameState {
  const s = createState(seed, mission);
  s.players.push(player("a"));
  s.ship.slots = { ...slots };
  s.data.target = 40;
  clock += 1_000_000;
  enterPhase(s, "brief", clock);
  enterPhase(s, "surface", clock);
  step(s, {}, clock, 0.016);
  return s;
}

describe("the seeded objective pool (S2-18)", () => {
  it("reads each mission's pool from missions.json: scan, sample, deploy and the minigames", () => {
    for (const m of ["mars", "moon"] as const) {
      expect(objectivePool(m)).toBe(MISSIONS[m].pool);
      const ids = objectivePool(m).map((e) => (typeof e === "string" ? e : e.id));
      expect(ids).toEqual(expect.arrayContaining(["scan", "sample", "deploy", ICE_DRILL, "relay-align", "panel-clean"]));
    }
  });

  it("gives two different seeds different surface lists", () => {
    const lists = new Set(SEEDS.slice(0, 40).map((seed) => drawObjectives(seed, "mars", { ...RTG }).join(",")));
    expect(lists.size).toBeGreaterThan(1);
    const a = landed(SEEDS[0]);
    const b = landed(SEEDS.find((seed) => drawObjectives(seed, "mars", { ...RTG }).join() !== drawObjectives(SEEDS[0], "mars", { ...RTG }).join())!);
    expect(Object.keys(a.objectives)).not.toEqual(Object.keys(b.objectives));
  });

  it("gives the same seed the same list every time", () => {
    for (const seed of SEEDS.slice(0, 20)) expect(drawObjectives(seed, "moon", { ...RTG })).toEqual(drawObjectives(seed, "moon", { ...RTG }));
  });

  it("always has the uplink and the bonus, on top of three drawn objectives", () => {
    for (const seed of SEEDS.slice(0, 40)) {
      for (const mission of ["mars", "moon"] as const) {
        const ids = Object.keys(landed(seed, mission).objectives);
        expect(ids.slice(-2)).toEqual(["uplink", "bonus"]);
        expect(ids).toHaveLength(DRAWN_OBJECTIVES + 2);
      }
    }
  });

  it("never draws a task that isn't merged", () => {
    // relay align (S4-11) and panel cleaning (S5-11) are in the pool but not registered on this branch
    for (const seed of SEEDS) {
      for (const slots of [RTG, SOLAR]) {
        const drawn = drawObjectives(seed, "mars", { ...slots });
        expect(drawn).not.toContain("relay-align");
        expect(drawn).not.toContain("panel-clean");
      }
    }
    // and the ice drill, which is merged, does come up
    expect(SEEDS.some((seed) => drawObjectives(seed, "mars", { ...RTG }).includes(ICE_DRILL))).toBe(true);
  });

  it("shows only the drawn objectives in the mission panel and the report", () => {
    const seed = SEEDS.find((x) => !drawObjectives(x, "mars", { ...RTG }).includes("deploy"))!;
    const s = landed(seed);
    expect(objectiveLines(s).map((l) => l.id)).toEqual(Object.keys(s.objectives));
    expect(scoreRows(s).find((r) => r.label === "Objectives")?.detail).toBe("0 / 3");
    // no deploy on the list: no instrument at the lander, no marker on the ridge
    expect(s.parts.map((p) => p.part)).not.toContain("weather-station");
    const rec = recordingCtx();
    groundScene("surface").draw(rec.ctx, s, { playerId: "a", now: clock });
    expect(rec.texts()).not.toContain("Weather station");
  });

  it("puts the same draw in the brief, before the build, with the uplink target", () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const lines = briefObjectives(seed, "mars", 40);
      expect(lines).toHaveLength(DRAWN_OBJECTIVES + 1);
      expect(lines[lines.length - 1]).toBe("Uplink 40 data units");
      if (drawObjectives(seed, "mars", null).includes(ICE_DRILL)) {
        expect(lines).toContain("Drill for subsurface water ice (easiest with an RTG)");
      }
    }
  });
});

describe("solar-only tasks in the pool", () => {
  beforeAll(() => {
    // a stand-in for seat 5's panel cleaning, which says nothing about solar itself: the pool's flag does it
    registerSurfaceGame("panel-clean", {
      name: "Panel cleaning",
      label: () => "Clean the lander's solar panels",
      slot: "power",
      keys: "WASD",
      start: () => ({}),
      update: () => "playing",
      draw: () => {},
    });
  });
  afterAll(() => unregisterSurfaceGame("panel-clean"));

  it("draws panel cleaning for some solar builds and never for an RTG build", () => {
    expect(SEEDS.some((seed) => drawObjectives(seed, "mars", { ...SOLAR }).includes("panel-clean"))).toBe(true);
    for (const seed of SEEDS) expect(drawObjectives(seed, "mars", { ...RTG })).not.toContain("panel-clean");
    for (const seed of SEEDS.slice(0, 40)) expect(Object.keys(landed(seed, "moon", { ...RTG }).objectives)).not.toContain("panel-clean");
  });

  it("still draws three for an RTG build when panel cleaning would have been one of them", () => {
    const seed = SEEDS.find((x) => drawObjectives(x, "mars", { ...SOLAR }).includes("panel-clean"))!;
    expect(drawObjectives(seed, "mars", { ...RTG })).toHaveLength(DRAWN_OBJECTIVES);
  });

  it("tells the brief it needs a solar build", () => {
    const seed = SEEDS.find((x) => drawObjectives(x, "mars", null).includes("panel-clean"))!;
    expect(briefObjectives(seed, "mars", 40)).toContain("Clean the lander's solar panels, solar builds only");
  });
});
