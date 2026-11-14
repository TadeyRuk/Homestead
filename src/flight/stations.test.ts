import { describe, expect, it } from "vitest";
import type { Input } from "../core/input";
import { enterPhase } from "../core/phases";
import { createState, type Player, type Role } from "../core/state";
import { step } from "../core/step";
import { nextStation, registerStation, stationFor, stationInput, whoIsAt } from "./stations";
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

  it("seats everyone the moment flight starts, before any rule runs", () => {
    const s = createState(1, "mars");
    s.players.push(crew("a", ["pilot", "engineer"]), crew("b", []));
    enterPhase(s, "flight", 0);
    expect(s.players.map((p) => p.station)).toEqual(["pilot", null]);
  });

  it("moves a player off a station that is no longer one of their roles", () => {
    const s = inFlight(crew("a", ["comms"]));
    s.players[0].station = "pilot";
    step(s, { a: { ...still, switch: true } }, 100, 0.016);
    expect(s.players[0].station).toBe("comms");
  });
});

describe("who drives a station", () => {
  function solo() {
    const s = createState(1, "mars");
    s.players.push(crew("a", ["pilot", "engineer", "comms", "science"]), crew("b", ["engineer"]));
    enterPhase(s, "flight", 0);
    return s;
  }

  it("finds the player looking at a station, or nobody", () => {
    const s = solo();
    expect(whoIsAt(s, "pilot")?.id).toBe("a");
    expect(whoIsAt(s, "engineer")?.id).toBe("b");
    expect(whoIsAt(s, "science")).toBeNull();
  });

  it("gives a station only the keys of the player at it, so a solo player doesn't drive all four", () => {
    const s = solo();
    const right = { ...still, dx: 1 };
    expect(stationInput(s, { a: right }, "pilot")).toEqual(right);
    expect(stationInput(s, { a: right }, "science")).toEqual(still);
  });

  it("keeps minigame state in the run state, so joiners get it in snapshots", () => {
    const s = createState(1, "mars");
    expect(s.flight).toEqual({});
    s.flight.bus = { watts: 120 };
    expect(JSON.parse(JSON.stringify(s)).flight).toEqual({ bus: { watts: 120 } });
  });
});
