import { describe, expect, it } from "vitest";
import "../../register";
import type { Input } from "../../core/input";
import { enterPhase } from "../../core/phases";
import { createState, type Player, type Role } from "../../core/state";
import { step } from "../../core/step";
import type { Bus } from "./bus";
import { openBreach, type Welder } from "./weld";

const still: Input = { dx: 0, dy: 0, interact: false, panel: false, switch: false };
const crew = (id: string, roles: Role[]): Player => ({
  id, name: id, roles, station: null, x: 0, y: 0, carrying: null, oxygen: 1, power: 1, down: false,
});

function flight(...players: Player[]) {
  const s = createState(7, "mars");
  s.players.push(...players);
  s.ship.slots = { propulsion: "chemical-engine", power: "small-solar", comms: "low-gain", payload: "camera" };
  enterPhase(s, "flight", 0);
  return s;
}
const busOf = (s: ReturnType<typeof flight>) => s.flight.bus as Bus;
const weldOf = (s: ReturnType<typeof flight>) => s.flight.weld as Welder;

describe("engineer station in flight", () => {
  it("builds the bus from the mounted parts and an empty welder as flight starts", () => {
    const s = flight(crew("eng", ["engineer"]));
    expect(busOf(s).source).toBe("small-solar");
    expect(busOf(s).loads.map((l) => l.id)).toEqual(["chemical-engine", "low-gain", "camera"]);
    expect(weldOf(s).jobs).toEqual([]);
  });

  it("drives the bus with the keys of the player at the engineer station", () => {
    const s = flight(crew("eng", ["engineer"]));
    step(s, { eng: { ...still, dy: 1 } }, 100, 0.016);
    expect(busOf(s).cursor).toBe(1);
  });

  it("ignores a solo player's keys while they look at another station", () => {
    const s = flight(crew("solo", ["pilot", "engineer", "comms", "science"]));
    expect(s.players[0].station).toBe("pilot");
    step(s, { solo: { ...still, dy: 1 } }, 100, 0.016);
    expect(busOf(s).cursor).toBe(0);
  });

  it("hands the keys to the weld while a breach is open", () => {
    const s = flight(crew("eng", ["engineer"]));
    openBreach(weldOf(s), 0.2, "debris");
    const torch = weldOf(s).torch.y;
    step(s, { eng: { ...still, dy: 1 } }, 100, 0.1);
    expect(weldOf(s).torch.y).toBeGreaterThan(torch);
    expect(busOf(s).cursor).toBe(0);
  });

  it("logs the bus's events into the run's log", () => {
    const s = flight(crew("eng", ["engineer"]));
    busOf(s).cursor = 2;
    step(s, { eng: { ...still, interact: true } }, 100, 0.016);
    expect(s.log).toContainEqual(expect.objectContaining({ kind: "load_shed", part: "camera", phase: "flight" }));
  });

  it("starts each flight with a fresh bus for the parts mounted that run", () => {
    const s = flight(crew("eng", ["engineer"]));
    busOf(s).strain = 0.9;
    s.flight = {};
    s.ship.slots.power = "rtg";
    enterPhase(s, "flight", 1_000);
    expect(busOf(s).source).toBe("rtg");
    expect(busOf(s).strain).toBe(0);
  });
});
