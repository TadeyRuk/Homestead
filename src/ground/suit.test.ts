import { describe, expect, it } from "vitest";
import { enterPhase } from "../core/phases";
import { createState, type MissionId } from "../core/state";
import { step } from "../core/step";
import "./ground.register";
import { groundScene } from "./scene";
import {
  atLander,
  LANDER_REACH,
  OXYGEN_SECONDS,
  POWER_SECONDS,
  rechargeRate,
  registerDrainModifier,
  SUNLIGHT,
} from "./suit";
import { SURFACE } from "./surface";
import { player, recordingCtx } from "./testing";

const OUT = { x: 1900, y: 700 }; // a poor site, well away from the lander
const lander = SURFACE.lander;
let clock = 9_000_000;

// seat 6's hazards plug in like this; "storm" players drain four times as fast
const inStorm = new Set<string>();
registerDrainModifier((_state, p) => (inStorm.has(p.id) ? 4 : 1));

function surface(mission: MissionId = "mars", power = "rtg") {
  const s = createState(1, mission);
  s.players.push(player("a"), player("b"));
  s.ship.slots.power = power;
  clock += 1_000_000;
  enterPhase(s, "brief", clock);
  enterPhase(s, "surface", clock);
  step(s, {}, clock, 0.016); // lands the crew round the lander
  return s;
}
/** `seconds` of ticks at dt = 0.5 s */
function wait(s: ReturnType<typeof surface>, seconds: number) {
  for (let t = 0; t < seconds; t += 0.5) step(s, {}, (clock += 500), 0.5);
}

describe("suit drain", () => {
  it("lands the crew at the lander with full suits", () => {
    const s = surface();
    for (const p of s.players) {
      expect(atLander(p)).toBe(true);
      expect([p.oxygen, p.power]).toEqual([1, 1]);
    }
  });

  it("drains oxygen and power slowly out in the open", () => {
    const s = surface();
    Object.assign(s.players[0], OUT);
    wait(s, 10);
    expect(s.players[0].oxygen).toBeCloseTo(1 - 10 / OXYGEN_SECONDS, 5);
    expect(s.players[0].power).toBeCloseTo(1 - 10 / POWER_SECONDS, 5);
  });

  it("drains faster inside a hazard", () => {
    const s = surface();
    Object.assign(s.players[0], OUT);
    Object.assign(s.players[1], { x: OUT.x + 40, y: OUT.y });
    inStorm.add("b");
    wait(s, 5);
    inStorm.delete("b");
    const calm = 1 - s.players[0].oxygen;
    const storm = 1 - s.players[1].oxygen;
    expect(storm / calm).toBeCloseTo(4, 5);
  });

  it("does not drain at the lander", () => {
    const s = surface();
    wait(s, 30);
    expect([s.players[0].oxygen, s.players[0].power]).toEqual([1, 1]);
  });

  it("puts a player who stays out too long down, dropping what they carry, and logs it once", () => {
    const s = surface();
    Object.assign(s.players[0], OUT, { carrying: "sample" });
    wait(s, POWER_SECONDS + 5);
    const p = s.players[0];
    expect(p.down).toBe(true);
    expect(p.power).toBe(0);
    expect(p.carrying).toBeNull();
    expect(s.parts).toMatchObject([{ part: "sample", x: OUT.x, y: OUT.y }]);
    expect(s.log.filter((e) => e.kind === "player_down")).toEqual([
      expect.objectContaining({ kind: "player_down", player: "a", part: "sample", phase: "surface" }),
    ]);
  });

  it("keeps a downed player down, not draining, recharging or moving", () => {
    const s = surface();
    Object.assign(s.players[0], OUT);
    wait(s, POWER_SECONDS + 5);
    const oxygen = s.players[0].oxygen;
    Object.assign(s.players[0], { x: lander.x, y: lander.y });
    wait(s, 10);
    expect(s.players[0].down).toBe(true);
    expect(s.players[0].oxygen).toBe(oxygen);
  });

  it("recharges a player who comes back to the lander", () => {
    const s = surface("moon", "rtg");
    Object.assign(s.players[0], OUT);
    wait(s, 60);
    const low = s.players[0].power;
    Object.assign(s.players[0], { x: lander.x + LANDER_REACH - 10, y: lander.y });
    wait(s, 5);
    expect(s.players[0].power).toBeCloseTo(Math.min(1, low + rechargeRate(s) * 5), 5);
    wait(s, 30);
    expect([s.players[0].oxygen, s.players[0].power]).toEqual([1, 1]);
  });

  it("ends the surface when the whole crew goes down", () => {
    const s = surface();
    for (const p of s.players) Object.assign(p, OUT);
    wait(s, POWER_SECONDS + 5);
    expect(s.phase).toBe("report");
    expect(s.log.some((e) => e.kind === "extraction")).toBe(true);
  });
});

describe("recharge rate", () => {
  const rate = (mission: MissionId, power: string | null) =>
    rechargeRate({ mission, ship: { ...createState(1, mission).ship, slots: { propulsion: null, power, comms: null, payload: null } } });

  it("comes from the power part: large solar beats small solar, salvage is slowest", () => {
    expect(rate("moon", "large-solar")).toBeGreaterThan(rate("moon", "rtg"));
    expect(rate("moon", "rtg")).toBeGreaterThan(rate("moon", "small-solar"));
    expect(rate("moon", "small-solar")).toBeGreaterThan(rate("moon", "salvage-battery"));
  });

  it("weakens solar arrays at Mars, but not the RTG", () => {
    expect(rate("mars", "small-solar")).toBeCloseTo(rate("moon", "small-solar") * SUNLIGHT.mars);
    expect(rate("mars", "rtg")).toBe(rate("moon", "rtg"));
    expect(rate("mars", "rtg")).toBeGreaterThan(rate("mars", "large-solar"));
  });

  it("falls back to the salvage battery with nothing mounted", () => {
    expect(rate("moon", null)).toBe(rate("moon", "salvage-battery"));
  });
});

describe("suit drawing", () => {
  it("shows the suit bars over standing players on the surface", () => {
    const s = surface();
    const r = recordingCtx();
    groundScene("surface").draw(r.ctx, s, { playerId: "a", now: clock });
    // two bars per player, each a dark backing and a fill
    expect(r.calls.filter((c) => c.name === "fillRect").length).toBeGreaterThanOrEqual(8);
  });
});
