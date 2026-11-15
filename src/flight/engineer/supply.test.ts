import { describe, expect, it } from "vitest";
import "../../data/data.register";
import type { Ship } from "../../core/state";
import { BASE_WATTS, draw, powered } from "./bus";
import { busFor } from "./supply";

type Slots = Ship["slots"];
const build = (slots: Partial<Slots>): Slots => ({ propulsion: null, power: null, comms: null, payload: null, ...slots });
const heavy = { propulsion: "chemical-engine", comms: "high-gain", payload: "radar" };

describe("bus from the mounted parts", () => {
  it("takes its supply from the power part", () => {
    expect(busFor(1, build({ power: "small-solar" })).supply).toBe(300);
    expect(busFor(1, build({ power: "rtg" })).supply).toBe(450);
    expect(busFor(1, build({ power: "rtg" })).source).toBe("rtg");
  });

  it("puts every mounted part that draws power on the bus, at its catalog draw", () => {
    const bus = busFor(1, build({ power: "rtg", ...heavy }));
    expect(bus.loads.map((l) => [l.id, l.slot, l.watts])).toEqual([
      ["chemical-engine", "propulsion", 30],
      ["high-gain", "comms", 80],
      ["radar", "payload", 200],
    ]);
  });

  it("leaves an empty slot off the bus", () => {
    const bus = busFor(1, build({ power: "rtg", payload: "camera" }));
    expect(bus.loads.map((l) => l.id)).toEqual(["camera"]);
    expect(powered(bus, "propulsion")).toBe(false);
  });

  it("gives a ship with no power part no supply", () => {
    const bus = busFor(1, build({ comms: "low-gain" }));
    expect(bus.supply).toBe(0);
    expect(bus.source).toBe("none");
  });

  it("skips a part id the catalog doesn't know instead of throwing", () => {
    expect(() => busFor(1, build({ power: "rtg", payload: "mystery" }))).not.toThrow();
    expect(busFor(1, build({ power: "rtg", payload: "mystery" })).loads).toEqual([]);
  });

  it("changes the bus margin when a part is swapped on the campus", () => {
    const margin = (power: string, payload: string) => {
      const bus = busFor(1, build({ power, propulsion: "chemical-engine", payload }));
      return bus.supply - (BASE_WATTS + bus.loads.reduce((w, l) => w + l.watts, 0));
    };
    expect(margin("small-solar", "camera")).toBeGreaterThan(margin("small-solar", "radar"));
    expect(margin("rtg", "radar")).toBeGreaterThan(margin("small-solar", "radar"));
  });

  it("seeds the bus from the run, so every tab sees the same demand", () => {
    const a = busFor(42, build({ power: "rtg", ...heavy }));
    const b = busFor(42, build({ power: "rtg", ...heavy }));
    expect(draw(a)).toBe(draw(b));
  });
});
