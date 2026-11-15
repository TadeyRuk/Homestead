import { describe, expect, it } from "vitest";
import "../../data/data.register";
import { registerParts } from "../../core/catalog";
import { PARTS } from "../../data/data";
import type { Input } from "../../core/input";
import { enterPhase } from "../../core/phases";
import { createState, type Player, type Role } from "../../core/state";
import { applySandbox, parseSandbox, sandboxRule } from "./sandbox";

const crew = (id: string, roles: Role[]): Player => ({
  id, name: id, roles, station: null, x: 0, y: 0, carrying: null, oxygen: 1, power: 1, down: false,
});
const ALL: Role[] = ["pilot", "engineer", "comms", "science"];
const still: Input = { dx: 0, dy: 0, interact: false, panel: false, switch: false };

function briefing() {
  const s = createState(3, "mars");
  s.players.push(crew("solo", ALL));
  enterPhase(s, "brief", 0);
  return s;
}

describe("station sandbox URL", () => {
  it("reads the station and puts each part in its own slot", () => {
    expect(parseSandbox("?station=engineer&parts=ion-drive,rtg,low-gain,radar")).toEqual({
      station: "engineer",
      slots: { propulsion: "ion-drive", power: "rtg", comms: "low-gain", payload: "radar" },
    });
  });

  it("takes the shorthand from the issue, matching a part by the start of its name", () => {
    expect(parseSandbox("?station=engineer&parts=ion,rtg,lowgain,radar")?.slots).toEqual({
      propulsion: "ion-drive", power: "rtg", comms: "low-gain", payload: "radar",
    });
  });

  it("ignores a part it can't pin down: unknown, or a prefix of several", () => {
    // "s" could be the solid motor, the small array or the spectrometer
    expect(parseSandbox("?station=science&parts=s,warp-drive,camera")?.slots).toEqual({ payload: "camera" });
  });

  it("works for every station", () => {
    for (const role of ALL) expect(parseSandbox(`?station=${role}`)?.station).toBe(role);
  });

  it("does nothing without a station, or with one that isn't a role", () => {
    expect(parseSandbox("")).toBeNull();
    expect(parseSandbox("?parts=rtg")).toBeNull();
    expect(parseSandbox("?station=captain&parts=rtg")).toBeNull();
  });

  it("drops a run straight into flight with the chosen parts, at the chosen station", () => {
    const s = briefing();
    applySandbox(s, { station: "science", slots: { power: "rtg", payload: "radar" } }, 500);
    expect(s.phase).toBe("flight");
    expect(s.ship.slots.power).toBe("rtg");
    expect(s.ship.slots.payload).toBe("radar");
    expect(s.players[0].station).toBe("science");
  });

  it("fills the slots it wasn't given with salvage, the way a launch at the timeout would", () => {
    const s = briefing();
    applySandbox(s, { station: "engineer", slots: { power: "rtg" } }, 500);
    expect(s.ship.slots.propulsion).toBe("salvage-motor");
    expect(s.ship.slots.comms).toBe("salvage-antenna");
    expect(s.ship.slots.payload).toBe("salvage-camera");
  });

  it("leaves a player who doesn't hold the station at their own first one", () => {
    const s = createState(3, "mars");
    s.players.push(crew("p", ["pilot"]));
    enterPhase(s, "brief", 0);
    applySandbox(s, { station: "engineer", slots: {} }, 500);
    expect(s.players[0].station).toBe("pilot");
  });

  it("jumps from the brief on the first tick as a rule", () => {
    const s = briefing();
    sandboxRule("?station=comms&parts=laser")(s, { solo: still }, 100, 0.016);
    expect(s.phase).toBe("flight");
    expect(s.ship.slots.comms).toBe("laser");
  });

  it("reads the URL when the brief starts, so parts registered after startup still count", () => {
    const rule = sandboxRule("?station=science&parts=cryo-cam");
    registerParts([...PARTS, { id: "cryo-cam", slot: "payload", mass: 20, power: -30, heat: 0.005 }]);
    const s = briefing();
    rule(s, { solo: still }, 100, 0.016);
    expect(s.ship.slots.payload).toBe("cryo-cam");
    registerParts([...PARTS]);
  });

  it("leaves a run without a sandbox station alone", () => {
    const s = briefing();
    sandboxRule("?parts=rtg")(s, { solo: still }, 100, 0.016);
    expect(s.phase).toBe("brief");
  });
});
