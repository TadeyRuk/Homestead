import { describe, expect, it } from "vitest";
import type { Input } from "../core/input";
import { enterPhase } from "../core/phases";
import { createState, type Player, type Role } from "../core/state";
import { step } from "../core/step";
import { nextStation, registerStation, stationFor } from "./stations";
import "./shell.register";

const still: Input = { dx: 0, dy: 0, interact: false, panel: false, switch: false };
const crew = (id: string, roles: Role[]): Player => ({
  id, name: id, roles, station: null, x: 0, y: 0, carrying: null, oxygen: 1, power: 1, down: false,
});

describe("station registry", () => {
  it("has a stub for every role until a seat registers the real one", () => {
    for (const role of ["pilot", "engineer", "comms", "science"] as const) expect(stationFor(role)).toBeDefined();
  });

  it("returns the station a seat registered", () => {
    const engineer = { draw: () => {} };
    registerStation("engineer", engineer);
    expect(stationFor("engineer")).toBe(engineer);
  });
});

describe("nextStation", () => {
  it("cycles through the player's own roles in order", () => {
    expect(nextStation(["pilot", "comms"], "pilot")).toBe("comms");
    expect(nextStation(["pilot", "comms"], "comms")).toBe("pilot");
  });

  it("starts at the first role, and gives null to a player with none", () => {
    expect(nextStation(["science"], null)).toBe("science");
    expect(nextStation([], null)).toBeNull();
  });
});

describe("flight shell rule", () => {
  function inFlight(...players: Player[]) {
    const s = createState(1, "mars");
    s.players.push(...players);
    enterPhase(s, "flight", 0);
    return s;
  }

  it("puts each player at their first station when flight starts", () => {
    const s = inFlight(crew("a", ["pilot", "engineer"]), crew("b", ["comms"]));
    step(s, {}, 100, 0.016);
    expect(s.players.map((p) => p.station)).toEqual(["pilot", "comms"]);
  });

  it("moves a player to their next station when they press Tab", () => {
    const s = inFlight(crew("a", ["pilot", "engineer", "comms", "science"]));
    step(s, {}, 100, 0.016);
    step(s, { a: { ...still, switch: true } }, 116, 0.016);
    expect(s.players[0].station).toBe("engineer");
  });

  it("keeps a single-role player on their one station", () => {
    const s = inFlight(crew("b", ["comms"]));
    step(s, {}, 100, 0.016);
    step(s, { b: { ...still, switch: true } }, 116, 0.016);
    expect(s.players[0].station).toBe("comms");
  });

  it("ends the flight when the transit time runs out", () => {
    const s = inFlight(crew("a", ["pilot"]));
    step(s, {}, 180_000, 0.016);
    expect(s.phase).toBe("surface");
  });
});
