import { describe, expect, it } from "vitest";
import { buildable, partInfo, salvageFor } from "../core/catalog";
import { createState } from "../core/state";
import { startRun } from "../core/lobby";
import { missionList, scanStats, uplinkRate } from "../missions/stats";
import "./data.register";
import { MISSIONS, PARTS, partData, partName } from "./data";

describe("parts and mission data (S3-01)", () => {
  it("registers the proposal's twelve parts, three per slot, plus one salvage part per slot", () => {
    expect(buildable()).toHaveLength(12);
    for (const slot of ["propulsion", "power", "comms", "payload"] as const) {
      expect(buildable().filter((p) => p.slot === slot)).toHaveLength(3);
      expect(partInfo(salvageFor(slot)).slot).toBe(slot);
    }
  });

  it("keeps the proposal's mass, power and lift for every part", () => {
    expect(partInfo("solid-motor")).toMatchObject({ mass: 180, power: -10, lift: 600 });
    expect(partInfo("chemical-engine")).toMatchObject({ mass: 300, power: -30, lift: 900 });
    expect(partInfo("ion-drive")).toMatchObject({ mass: 120, power: -250, lift: 500 });
    expect(partInfo("large-solar")).toMatchObject({ mass: 150, power: 600 });
    expect(partInfo("laser")).toMatchObject({ mass: 40, power: -120 });
    expect(partInfo("radar")).toMatchObject({ mass: 160, power: -200 });
  });

  it("names the real hardware and a fact for every part, for the report", () => {
    for (const p of PARTS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.real.length).toBeGreaterThan(0);
      expect(p.fact.length).toBeGreaterThan(20);
    }
  });

  it("gives every engine its pilot handling", () => {
    for (const p of PARTS.filter((x) => x.slot === "propulsion")) {
      expect(p.steer).toBeDefined();
      expect(p.turn).toBeGreaterThan(0);
      expect(p.burn).toBeGreaterThan(0);
    }
  });

  it("starts a run with the mission card's credits and data target", () => {
    const s = createState(1, "mars");
    startRun(s, "mars", 0);
    expect(s.credits).toBe(MISSIONS.mars.credits);
    expect(s.data.target).toBe(40);
    startRun(s, "moon", 0);
    expect(s.credits).toBe(MISSIONS.moon.credits);
    expect(MISSIONS.moon.credits).toBeLessThan(MISSIONS.mars.credits);
    expect(s.data.target).toBe(25);
  });

  it("hands the objective lists, scans and uplink rates to seat 2's rules", () => {
    expect(missionList("mars").instrument).toBe("weather-station");
    expect(missionList("moon").sample).toBe("regolith");
    expect(scanStats("radar").data).toBeGreaterThan(scanStats("camera").data);
    expect(uplinkRate("laser")).toBeGreaterThan(uplinkRate("low-gain"));
  });

  it("reads part names for any id, including ones that are not parts", () => {
    expect(partName("rtg")).toBe("Radioisotope generator");
    expect(partName("core-sample")).toBe("core sample");
    expect(partName(null)).toBe("nothing");
    expect(partData("weather-station")).toBeUndefined();
  });
});
