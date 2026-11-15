import { describe, expect, it } from "vitest";
import "../../data/data.register";
import type { Ship } from "../../core/state";
import { heatFor } from "./heat";

type Slots = Ship["slots"];
const build = (slots: Partial<Slots>): Slots => ({ propulsion: null, power: null, comms: null, payload: null, ...slots });

describe("core heat from the mounted parts", () => {
  it("heats the core by the payload's catalog heat", () => {
    expect(heatFor(build({ power: "small-solar", payload: "camera" })).heat).toBeCloseTo(0.01);
    expect(heatFor(build({ power: "small-solar", payload: "radar" })).heat).toBeCloseTo(0.06);
  });

  it("heats a radar sounder core much faster than a camera core", () => {
    const radar = heatFor(build({ power: "small-solar", payload: "radar" })).heat;
    const camera = heatFor(build({ power: "small-solar", payload: "camera" })).heat;
    expect(radar).toBeGreaterThan(3 * camera);
  });

  it("adds an RTG's heat on top of the payload's, so an RTG build runs hotter than a solar one", () => {
    const rtg = heatFor(build({ power: "rtg", payload: "camera" })).heat;
    const solar = heatFor(build({ power: "small-solar", payload: "camera" })).heat;
    expect(rtg).toBeCloseTo(0.03);
    expect(rtg).toBeGreaterThan(solar);
  });

  it("blames the part adding the most heat", () => {
    expect(heatFor(build({ power: "rtg", payload: "radar" })).part).toBe("radar");
    expect(heatFor(build({ power: "rtg", payload: "camera" })).part).toBe("rtg");
  });

  it("names the payload when nothing heats the core", () => {
    expect(heatFor(build({ power: "small-solar", payload: "mystery" }))).toEqual({ part: "mystery", heat: 0 });
  });

  it("leaves a ship with nothing mounted cold and blames the core itself", () => {
    expect(heatFor(build({}))).toEqual({ part: "core", heat: 0 });
  });

  it("never blames a power part that adds no heat", () => {
    expect(heatFor(build({ power: "small-solar" }))).toEqual({ part: "core", heat: 0 });
  });

  it("drops the payload's heat while the payload is off the bus, keeping the RTG's", () => {
    expect(heatFor(build({ power: "rtg", payload: "radar" }), false).heat).toBeCloseTo(0.02);
    expect(heatFor(build({ power: "small-solar", payload: "radar" }), false).heat).toBe(0);
  });
});
