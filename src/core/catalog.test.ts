import { describe, expect, it } from "vitest";
import { buildable, liftOf, massOf, partInfo, salvageFor } from "./catalog";

describe("part catalog", () => {
  it("has the proposal's twelve parts, three per slot, until seat 3 registers real data", () => {
    const parts = buildable();
    expect(parts).toHaveLength(12);
    for (const slot of ["propulsion", "power", "comms", "payload"] as const) {
      expect(parts.filter((p) => p.slot === slot)).toHaveLength(3);
    }
  });

  it("gives engines their lift and every part its mass, from the proposal's table", () => {
    expect(partInfo("solid-motor")).toMatchObject({ slot: "propulsion", mass: 180, lift: 600 });
    expect(partInfo("radar")).toMatchObject({ slot: "payload", mass: 160 });
  });

  it("totals the mounted mass and finds the engine's lift", () => {
    const slots = { propulsion: "chemical-engine", power: "rtg", comms: null, payload: "camera" } as const;
    expect(massOf(slots)).toBe(300 + 110 + 30);
    expect(liftOf(slots)).toBe(900);
    expect(liftOf({ ...slots, propulsion: null })).toBe(0);
  });

  it("has a weak salvage part for every slot, which never spawns on the campus", () => {
    for (const slot of ["propulsion", "power", "comms", "payload"] as const) {
      const s = partInfo(salvageFor(slot));
      expect(s.slot).toBe(slot);
      expect(s.salvage).toBe(true);
    }
    expect(buildable().some((p) => p.salvage)).toBe(false);
  });

  it("refuses a part list that would break launch, at registration rather than at the timeout", async () => {
    const { registerParts } = await import("./catalog");
    const good = buildable();
    expect(() => registerParts(good)).toThrow(/salvage/);
    expect(() => registerParts([{ id: "e", slot: "propulsion", mass: 1, power: 0 }])).toThrow();
  });

  it("gives payload and power parts a heat rate for the energy core", () => {
    expect(partInfo("radar").heat).toBeGreaterThan(partInfo("camera").heat!);
    expect(partInfo("rtg").heat).toBeGreaterThan(0);
  });
});
