import { describe, expect, it } from "vitest";
import "../register";
import { enterPhase } from "../core/phases";
import { createState, type Player, type Role } from "../core/state";
import { step } from "../core/step";
import { createBus, type Bus } from "./engineer/bus";
import { engineOffPending } from "./handshake";

const still = { dx: 0, dy: 0, interact: false, panel: false, switch: false };
const crew = (id: string, roles: Role[]): Player => ({
  id, name: id, roles, station: null, x: 0, y: 0, carrying: null, oxygen: 1, power: 1, down: false,
});

function flightWithRequest() {
  const s = createState(1, "mars");
  s.players.push(crew("pilot", ["pilot"]), crew("eng", ["engineer"]));
  s.ship.slots.comms = "low-gain";
  enterPhase(s, "flight", 0);
  const bus = createBus(1, { id: "rtg", watts: 450 }, [{ id: "chemical-engine", slot: "propulsion", watts: 30 }]);
  bus.engineOffAsked = true;
  s.flight.bus = bus;
  return s;
}
const engineOn = (s: ReturnType<typeof flightWithRequest>) => (s.flight.bus as Bus).loads[0].on;

describe("engine-off handshake", () => {
  it("cuts the engine when the pilot presses E", () => {
    const s = flightWithRequest();
    step(s, { pilot: { ...still, interact: true } }, 100, 0.016);
    expect(engineOn(s)).toBe(false);
    expect(engineOffPending(s)).toBe(false);
  });

  it("keeps the engine running when the pilot presses Q", () => {
    const s = flightWithRequest();
    step(s, { pilot: { ...still, panel: true } }, 100, 0.016);
    expect(engineOn(s)).toBe(true);
    expect(engineOffPending(s)).toBe(false);
  });

  it("waits for the pilot, and ignores the engineer pressing E", () => {
    const s = flightWithRequest();
    step(s, { eng: { ...still, interact: true } }, 100, 0.016);
    expect(engineOffPending(s)).toBe(true);
    expect(engineOn(s)).toBe(true);
  });

  it("does nothing before the bus exists", () => {
    const s = createState(1, "mars");
    s.players.push(crew("pilot", ["pilot"]));
    enterPhase(s, "flight", 0);
    expect(() => step(s, { pilot: { ...still, interact: true } }, 100, 0.016)).not.toThrow();
    expect(engineOffPending(s)).toBe(false);
  });

  it("lets a solo player answer after Tabbing from the Engineer station to Pilot", () => {
    const s = createState(1, "mars");
    s.players.push(crew("solo", ["pilot", "engineer", "comms", "science"]));
    enterPhase(s, "flight", 0);
    const bus = createBus(1, { id: "rtg", watts: 450 }, [{ id: "chemical-engine", slot: "propulsion", watts: 30 }]);
    bus.engineOffAsked = true;
    s.flight.bus = bus;
    s.players[0].station = "engineer";
    step(s, { solo: { ...still, interact: true } }, 100, 0.016); // E at the Engineer station is not an answer
    expect(engineOffPending(s)).toBe(true);
    s.players[0].station = "pilot";
    step(s, { solo: { ...still, interact: true } }, 200, 0.016);
    expect(engineOffPending(s)).toBe(false);
    expect(engineOn(s)).toBe(false);
  });
});
