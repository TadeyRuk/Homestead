import { describe, expect, it } from "vitest";
import { PHASE_SECONDS, enterPhase } from "../core/phases";
import { createState } from "../core/state";
import { step } from "../core/step";
import { shipDescent, SHIP_DESCENT_S } from "./extraction";
import "./ground.register";
import { groundScene } from "./scene";
import { player, recordingCtx } from "./testing";

const SURFACE_MS = PHASE_SECONDS.surface * 1000;
let clock = 2_000_000;

/** a surface phase that started at `start`, past its first tick, with a crew of two */
function surface() {
  const s = createState(1, "mars");
  s.players.push(player("a"), player("b"));
  clock += SURFACE_MS * 2;
  const start = clock;
  enterPhase(s, "brief", start);
  enterPhase(s, "surface", start);
  step(s, {}, start, 0.016);
  return { s, start, end: start + SURFACE_MS };
}
const extractions = (s: ReturnType<typeof surface>["s"]) => s.log.filter((e) => e.kind === "extraction");

describe("extraction", () => {
  it("logs nothing while the surface timer runs", () => {
    const { s, end } = surface();
    step(s, {}, end - 1, 0.016);
    expect(extractions(s)).toEqual([]);
    expect(s.phase).toBe("surface");
  });

  it("ends the run on time and switches to the report, list finished or not", () => {
    const { s, end } = surface();
    s.objectives = { scans: false, sample: false };
    step(s, {}, end, 0.016);
    expect(s.phase).toBe("report");
    expect(extractions(s)).not.toEqual([]);
  });

  it("logs who is standing and what is still carried, in the surface phase", () => {
    const { s, end } = surface();
    s.players[0].carrying = "sample";
    s.players[1].down = true;
    step(s, {}, end, 0.016);
    expect(extractions(s)).toEqual([
      { t: SURFACE_MS / 1000, phase: "surface", kind: "extraction", value: 1 },
      { t: SURFACE_MS / 1000, phase: "surface", kind: "extraction", player: "a", value: 1, part: "sample" },
      { t: SURFACE_MS / 1000, phase: "surface", kind: "extraction", player: "b", value: 0 },
    ]);
  });

  it("logs once, even if the report ticks on", () => {
    const { s, end } = surface();
    step(s, {}, end, 0.016);
    step(s, {}, end + 100, 0.016);
    expect(extractions(s)).toHaveLength(3);
  });

  it("ends the surface at once when the whole crew is down", () => {
    const { s, start } = surface();
    for (const p of s.players) p.down = true;
    step(s, {}, start + 30_000, 0.016);
    expect(s.phase).toBe("report");
    expect(extractions(s)[0]).toMatchObject({ value: 0, t: 30 });
  });

  it("keeps going while anyone is still standing", () => {
    const { s, start } = surface();
    s.players[0].down = true;
    step(s, {}, start + 30_000, 0.016);
    expect(s.phase).toBe("surface");
  });
});

describe("extraction ship", () => {
  it("stays out of sight until the last seconds, then lands as the timer ends", () => {
    const end = 100_000;
    const at = (secondsLeft: number) => shipDescent({ phaseEndsAt: end }, end - secondsLeft * 1000);
    expect(at(SHIP_DESCENT_S + 5)).toBe(0);
    expect(at(SHIP_DESCENT_S / 2)).toBeCloseTo(0.5);
    expect(at(0)).toBe(1);
    expect(shipDescent({ phaseEndsAt: null }, 0)).toBe(0);
  });

  it("is drawn over the lander in the last seconds", () => {
    const { s, end } = surface();
    const r = recordingCtx();
    groundScene("surface").draw(r.ctx, s, { playerId: "a", now: end - 3000 });
    expect(r.texts()).toContain("Extraction");
    const early = recordingCtx();
    groundScene("surface").draw(early.ctx, s, { playerId: "a", now: end - 60_000 });
    expect(early.texts()).not.toContain("Extraction");
  });
});
