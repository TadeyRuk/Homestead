import { describe, expect, it } from "vitest";
import "../../register";
import type { Input } from "../../core/input";
import { enterPhase } from "../../core/phases";
import { createState, type Player, type Role } from "../../core/state";
import { step } from "../../core/step";
import { openBreach, type Welder } from "../engineer/weld";
import { LOST_OXYGEN, LOW_OXYGEN, type Converter } from "./converter";
import type { Core } from "./core";

const still: Input = { dx: 0, dy: 0, interact: false, panel: false, switch: false };
const crew = (id: string, roles: Role[]): Player => ({
  id, name: id, roles, station: null, x: 0, y: 0, carrying: null, oxygen: 1, power: 1, down: false,
});

function flight(payload: string, ...players: Player[]) {
  const s = createState(7, "mars");
  s.players.push(...players);
  s.ship.slots = { propulsion: "chemical-engine", power: "small-solar", comms: "low-gain", payload };
  enterPhase(s, "flight", 0);
  return s;
}
const converterOf = (s: ReturnType<typeof flight>) => s.flight.converter as Converter;
const coreOf = (s: ReturnType<typeof flight>) => s.flight.core as Core;

describe("science station in flight", () => {
  it("heats the core by the mounted payload as flight starts, with a full tray", () => {
    const s = flight("radar", crew("sci", ["science"]));
    expect(coreOf(s)).toMatchObject({ part: "radar", heat: 0.06 });
    expect(converterOf(s).tray.length).toBeGreaterThan(0);
  });

  it("splits the science officer's keys: A/D and E for the converter, W/S for the valve", () => {
    const s = flight("camera", crew("sci", ["science"]));
    step(s, { sci: { ...still, dx: 1, dy: -1 } }, 100, 0.5);
    expect(converterOf(s).cursor).toBe(1);
    expect(coreOf(s).valve).toBeGreaterThan(0);
  });

  it("ignores a solo player's keys while they look at another station", () => {
    const s = flight("camera", crew("solo", ["pilot", "engineer", "comms", "science"]));
    step(s, { solo: { ...still, dx: 1, dy: -1 } }, 100, 0.5);
    expect(converterOf(s).cursor).toBe(0);
    expect(coreOf(s).valve).toBe(0);
  });

  it("drains cabin oxygen and heats the core in flight", () => {
    const s = flight("radar", crew("sci", ["science"]));
    const air = s.ship.cabinOxygen;
    const temp = s.ship.coreTemp;
    step(s, {}, 1_000, 1);
    expect(s.ship.cabinOxygen).toBeLessThan(air);
    expect(s.ship.coreTemp).toBeGreaterThan(temp);
  });

  it("runs an unwatched station more gently than a watched one", () => {
    const watched = flight("radar", crew("sci", ["science"]));
    const solo = flight("radar", crew("solo", ["pilot", "engineer", "comms", "science"]));
    step(watched, {}, 1_000, 1);
    step(solo, {}, 1_000, 1);
    expect(solo.ship.coreTemp).toBeLessThan(watched.ship.coreTemp);
  });

  it("writes the science officer's trouble for the crew strip, and clears it when fixed", () => {
    const s = flight("camera", crew("sci", ["science"]));
    s.ship.coreTemp = 0.95;
    step(s, {}, 100, 0.016);
    expect(s.trouble.science).toBe("Core hot");
    s.ship.coreTemp = 0.5;
    step(s, {}, 200, 0.016);
    expect(s.trouble.science).toBeUndefined();
  });

  it("names the breach behind a leak when the cabin drops low", () => {
    const s = flight("camera", crew("sci", ["science"]), crew("eng", ["engineer"]));
    openBreach(s.flight.weld as Welder, 0.2, "large-solar");
    s.ship.cabinOxygen = LOW_OXYGEN + 0.001;
    step(s, {}, 100, 1);
    expect(s.log).toContainEqual(expect.objectContaining({ kind: "oxygen_low", part: "large-solar" }));
  });

  it("loses the crew and ends the run when the cabin runs out of air", () => {
    const s = flight("camera", crew("sci", ["science"]));
    s.ship.cabinOxygen = 0.001;
    step(s, {}, 100, 1);
    expect(s.phase).toBe("report");
    expect(s.log).toContainEqual(expect.objectContaining({ kind: "oxygen_low", value: 0, phase: "flight" }));
    expect(s.log).toContainEqual(expect.objectContaining({ kind: "ship_lost", value: LOST_OXYGEN }));
  });

  it("names the breach that bled the cabin dry", () => {
    const s = flight("camera", crew("sci", ["science"]), crew("eng", ["engineer"]));
    openBreach(s.flight.weld as Welder, 0.2, "large-solar");
    s.ship.cabinOxygen = 0.001;
    step(s, {}, 100, 1);
    expect(s.log).toContainEqual(expect.objectContaining({ kind: "ship_lost", value: LOST_OXYGEN, part: "large-solar" }));
  });

  it("keeps flying while there is air left", () => {
    const s = flight("camera", crew("sci", ["science"]));
    s.ship.cabinOxygen = 0.2;
    step(s, {}, 100, 1);
    expect(s.phase).toBe("flight");
    expect(s.log.some((e) => e.kind === "ship_lost")).toBe(false);
  });

  it("ends the run once even if the hull gives out on the same tick", () => {
    const s = flight("camera", crew("sci", ["science"]));
    s.ship.cabinOxygen = 0.001;
    s.ship.hull = 0;
    step(s, {}, 100, 1);
    expect(s.log.filter((e) => e.kind === "ship_lost")).toHaveLength(1);
  });
});
