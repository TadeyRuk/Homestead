import { describe, expect, it } from "vitest";
import type { Input } from "../core/input";
import { mapFor } from "../core/map";
import { enterPhase } from "../core/phases";
import { createState, type Player } from "../core/state";
import { COUNTDOWN_MS, launchRule } from "./launch";

const still: Input = { dx: 0, dy: 0, interact: false, panel: false, switch: false };
const press: Input = { ...still, interact: true };
const pad = mapFor("campus").pad;
const at = (id: string, x: number, y: number, carrying: string | null = null): Player => ({
  id, name: id, roles: ["pilot"], station: null, x, y, carrying, oxygen: 1, power: 1, down: false,
});

function campus(...players: Player[]) {
  const s = createState(1, "mars");
  s.players.push(...players);
  enterPhase(s, "campus", 0);
  s.log = [];
  return s;
}
const kinds = (s: ReturnType<typeof campus>) => s.log.map((e) => e.kind);
const goodBuild = { propulsion: "chemical-engine", power: "rtg", comms: "low-gain", payload: "camera" };

describe("launch countdown", () => {
  it("starts when an empty-handed player presses E at the pad", () => {
    const s = campus(at("a", pad.x, pad.y));
    launchRule(s, { a: press }, 10_000);
    expect(s.launchAt).toBe(10_000 + COUNTDOWN_MS);
    expect(kinds(s)).toEqual(["launch_started"]);
  });

  it("is cancelled by anyone pressing E at the pad again", () => {
    const s = campus(at("a", pad.x, pad.y), at("b", pad.x + 10, pad.y));
    launchRule(s, { a: press }, 10_000);
    launchRule(s, { b: press }, 11_000);
    expect(s.launchAt).toBeNull();
    expect(kinds(s)).toEqual(["launch_started", "launch_cancelled"]);
  });

  it("ignores E away from the pad, and E while carrying a part (that mounts it)", () => {
    const s = campus(at("far", pad.x + 300, pad.y), at("busy", pad.x, pad.y, "rtg"));
    launchRule(s, { far: press, busy: press }, 10_000);
    expect(s.launchAt).toBeNull();
  });
});

describe("lift-off", () => {
  it("flies when the countdown ends and the engine can lift the rocket", () => {
    const s = campus(at("a", pad.x, pad.y));
    Object.assign(s.ship.slots, goodBuild);
    launchRule(s, { a: press }, 10_000);
    launchRule(s, {}, 10_000 + COUNTDOWN_MS);
    expect(s.phase).toBe("flight");
    expect(s.launchAt).toBeNull();
  });

  it("lifts off anyway when too heavy, logs the failure and ends at the report", () => {
    const s = campus(at("a", pad.x, pad.y));
    // 250 + 150 + 70 + 160 = 630 kg against 550; the proposal's campus parts can never go over on their own
    Object.assign(s.ship.slots, { propulsion: "salvage-motor", power: "large-solar", comms: "high-gain", payload: "radar" });
    launchRule(s, { a: press }, 10_000);
    launchRule(s, {}, 10_000 + COUNTDOWN_MS);
    expect(kinds(s)).toContain("launch_failed");
    expect(s.log.find((e) => e.kind === "launch_failed")?.part).toBe("salvage-motor");
    expect(s.phase).toBe("report");
  });

  it("fails with no engine at all", () => {
    const s = campus(at("a", pad.x, pad.y));
    launchRule(s, { a: press }, 10_000);
    launchRule(s, {}, 10_000 + COUNTDOWN_MS);
    expect(s.phase).toBe("report");
  });
});

describe("build timer running out", () => {
  it("fills empty slots with salvage, logs each, and launches", () => {
    const s = campus(at("a", 0, 0));
    s.ship.slots.propulsion = "chemical-engine";
    launchRule(s, {}, 180_000);
    expect(s.ship.slots).toEqual({ propulsion: "chemical-engine", power: "salvage-battery", comms: "salvage-antenna", payload: "salvage-camera" });
    expect(s.ship.salvaged).toEqual(["power", "comms", "payload"]);
    expect(kinds(s).filter((k) => k === "salvage_filled")).toHaveLength(3);
    expect(s.phase).toBe("flight");
  });
});
