import { describe, expect, it } from "vitest";
import { PHASE_SECONDS } from "../core/phases";
import { createState, type GameState, type MissionId } from "../core/state";
import { step } from "../core/step";
import {
  behindRock,
  caughtBy,
  drawHazard,
  FLARE_ACTIVE_S,
  FLARE_WARNING_S,
  hazardAt,
  hazardBanner,
  type Hazard,
} from "./hazards";
import { LANDER, ROCKS, SURFACE } from "./surface";
import { player, recordingCtx, STILL } from "./testing";
import "../register";

const START = 50_000_000;
const SURFACE_MS = PHASE_SECONDS.surface * 1000;
let run = 0;

function surface(mission: MissionId, seed = 48213): GameState {
  const s = createState(seed, mission);
  s.phase = "surface";
  s.runStartedAt = START + ++run;
  s.phaseEndsAt = START + SURFACE_MS;
  return s;
}

/** every whole second of the surface, with the hazard at that moment */
function timeline(s: GameState): { t: number; hazard: Hazard | null }[] {
  return Array.from({ length: PHASE_SECONDS.surface }, (_, i) => {
    const t = START + i * 1000;
    return { t, hazard: hazardAt(s, t) };
  });
}

const firstTime = (s: GameState, test: (h: Hazard) => boolean) => timeline(s).find((x) => x.hazard && test(x.hazard))!;

describe("hazard schedule", () => {
  it("Mars gets a dust storm and the Moon a solar flare, each once and after a calm start", () => {
    const mars = timeline(surface("mars")).map((x) => x.hazard);
    const moon = timeline(surface("moon")).map((x) => x.hazard);
    expect(mars.slice(0, 20).every((h) => h === null)).toBe(true);
    expect(moon.slice(0, 20).every((h) => h === null)).toBe(true);
    expect(mars.some((h) => h?.kind === "storm")).toBe(true);
    expect(mars.some((h) => h?.kind === "flare")).toBe(false);
    expect(moon.some((h) => h?.kind === "flare")).toBe(true);
    expect(moon.some((h) => h?.kind === "storm")).toBe(false);
  });

  it("is the same for the same seed and different for different seeds", () => {
    const starts = (seed: number) => timeline(surface("mars", seed)).findIndex((x) => x.hazard);
    expect(starts(7)).toBe(starts(7));
    const all = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(starts));
    expect(all.size).toBeGreaterThan(1);
  });

  it("is calm outside the surface", () => {
    const s = surface("mars");
    const t = firstTime(s, () => true).t;
    s.phase = "campus";
    expect(hazardAt(s, t)).toBeNull();
  });

  it("moves the storm wall all the way across the map and then ends", () => {
    const s = surface("mars");
    const storms = timeline(s).filter((x) => x.hazard?.kind === "storm").map((x) => x.hazard as Extract<Hazard, { kind: "storm" }>);
    const lefts = storms.map((h) => h.left);
    const moving = storms[0].dir === 1 ? lefts.every((l, i) => i === 0 || l > lefts[i - 1]) : lefts.every((l, i) => i === 0 || l < lefts[i - 1]);
    expect(moving).toBe(true);
    const covered = (x: number) => storms.some((h) => x >= h.left && x <= h.right);
    expect(covered(50)).toBe(true);
    expect(covered(SURFACE.width - 50)).toBe(true);
    expect(timeline(s).at(-1)!.hazard).toBeNull();
  });

  it("warns before a flare, then burns for its full length, then stops", () => {
    const s = surface("moon");
    const warn = timeline(s).filter((x) => x.hazard?.kind === "flare" && x.hazard.stage === "warning");
    const active = timeline(s).filter((x) => x.hazard?.kind === "flare" && x.hazard.stage === "active");
    expect(warn.length).toBeGreaterThanOrEqual(FLARE_WARNING_S - 1);
    expect(active.length).toBeGreaterThanOrEqual(FLARE_ACTIVE_S - 1);
    expect(warn.at(-1)!.t).toBeLessThan(active[0].t);
  });
});

describe("who gets hurt", () => {
  const storm: Hazard = { kind: "storm", left: 1000, right: 1700, dir: 1 };
  const flare: Hazard = { kind: "flare", stage: "active", secondsToGo: 5 };
  const warning: Hazard = { kind: "flare", stage: "warning", secondsToGo: 5 };
  const openGround = { x: 2600, y: 1500 };

  it("the storm catches players inside the wall only", () => {
    expect(caughtBy(storm, player("a", 1200, 300))).toBe(true);
    expect(caughtBy(storm, player("b", 2500, 300))).toBe(false);
  });

  it("an active flare catches players on open ground, not behind a rock", () => {
    expect(behindRock(openGround)).toBe(false);
    expect(caughtBy(flare, player("a", openGround.x, openGround.y))).toBe(true);
    const rock = ROCKS[0];
    expect(caughtBy(flare, player("b", rock.x - 20, rock.y + rock.h / 2))).toBe(false);
  });

  it("a flare warning hurts nobody", () => {
    expect(caughtBy(warning, player("a", openGround.x, openGround.y))).toBe(false);
  });

  it("the lander is always safe, and a downed player isn't caught again", () => {
    expect(caughtBy(flare, player("a", LANDER.x, LANDER.y))).toBe(false);
    expect(caughtBy({ ...storm, left: LANDER.x - 10, right: LANDER.x + 10 }, player("b", LANDER.x, LANDER.y))).toBe(false);
    expect(caughtBy(storm, player("c", 1200, 300, { down: true }))).toBe(false);
  });
});

describe("hazards with every seat's rules loaded", () => {
  /** a surface run past seat 2's crew-placement tick, at `t`, with players then put where the test wants */
  function placed(mission: MissionId, t: number, spots: Record<string, { x: number; y: number }>): GameState {
    const s = surface(mission);
    s.players = Object.keys(spots).map((id) => player(id));
    step(s, Object.fromEntries(s.players.map((p) => [p.id, STILL])), t - 1_000, 1 / 60);
    for (const p of s.players) Object.assign(p, spots[p.id], { oxygen: 1, power: 1 });
    s.log = [];
    return s;
  }

  function run(s: GameState, from: number, seconds: number) {
    const inputs = Object.fromEntries(s.players.map((p) => [p.id, STILL]));
    for (let i = 1; i <= seconds * 10; i++) step(s, inputs, from + i * 100, 0.1);
  }

  it("a player caught in the storm drains faster than one outside it, and hazard_hit is logged once", () => {
    const probe = surface("mars");
    const { t, hazard } = firstTime(probe, (h) => h.kind === "storm" && h.right - h.left > 600 && h.left > 100 && h.right < SURFACE.width - 100);
    const h = hazard as Extract<Hazard, { kind: "storm" }>;
    const inside = { x: (h.left + h.right) / 2, y: 300 };
    const outside = { x: h.dir === 1 ? h.left - 900 : h.right + 900, y: 300 };
    const s = placed("mars", t, { in: inside, out: outside });
    s.players.find((p) => p.id === "out")!.x = Math.max(60, Math.min(SURFACE.width - 60, outside.x));
    run(s, t, 1);
    const [inP, outP] = ["in", "out"].map((id) => s.players.find((p) => p.id === id)!);
    expect(inP.oxygen).toBeLessThan(outP.oxygen);
    const hits = s.log.filter((e) => e.kind === "hazard_hit");
    expect(hits.map((e) => e.player)).toEqual(["in"]);
  });

  it("an active flare drains a player in the open faster than one behind a rock", () => {
    const probe = surface("moon");
    const { t } = firstTime(probe, (h) => h.kind === "flare" && h.stage === "active" && h.secondsToGo > 5);
    const rock = ROCKS[0];
    const s = placed("moon", t, { open: { x: 2600, y: 1500 }, cover: { x: rock.x - 20, y: rock.y + rock.h / 2 } });
    run(s, t, 2);
    const [open, cover] = ["open", "cover"].map((id) => s.players.find((p) => p.id === id)!);
    expect(open.oxygen).toBeLessThan(cover.oxygen);
    expect(s.log.filter((e) => e.kind === "hazard_hit").map((e) => e.player)).toEqual(["open"]);
  });

  it("before the hazard, everyone drains at the base rate and nothing is logged", () => {
    const s = placed("moon", START + 5_000, { a: { x: 2600, y: 1500 }, b: { x: 600, y: 1500 } });
    run(s, START + 5_000, 2);
    const [a, b] = s.players;
    expect(a.oxygen).toBeCloseTo(b.oxygen, 6);
    expect(s.log.filter((e) => e.kind === "hazard_hit")).toEqual([]);
  });
});

describe("telling players", () => {
  it("has a banner for the flare warning, the flare and the storm, and none when calm", () => {
    expect(hazardBanner(null)).toBeNull();
    expect(hazardBanner({ kind: "flare", stage: "warning", secondsToGo: 6.2 })).toContain("Solar flare in 7 s");
    expect(hazardBanner({ kind: "flare", stage: "active", secondsToGo: 3 })).toContain("3 s left");
    expect(hazardBanner({ kind: "storm", left: 0, right: 700, dir: 1 })).toContain("Dust storm");
  });

  it("draws the storm wall across the full map height and nothing when calm", () => {
    const calm = recordingCtx();
    drawHazard(calm.ctx, null);
    expect(calm.calls.filter((c) => c.name === "fillRect")).toEqual([]);
    const rec = recordingCtx();
    drawHazard(rec.ctx, { kind: "storm", left: 900, right: 1600, dir: 1 });
    expect(rec.first("fillRect")).toEqual([900, 0, 700, SURFACE.height]);
  });
});
