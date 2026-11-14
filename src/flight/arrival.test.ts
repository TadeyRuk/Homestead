import { describe, expect, it } from "vitest";
import "../register";
import { enterPhase } from "../core/phases";
import { createState } from "../core/state";
import { step } from "../core/step";
import { LOST_FUEL, LOST_HULL } from "./flight.register";

describe("arrival", () => {
  it("records fuel and hull as the ship lands and logs the landing", () => {
    const s = createState(1, "mars");
    enterPhase(s, "flight", 0);
    s.ship.fuel = 0.4;
    s.ship.hull = 0.7;
    step(s, {}, 180_000, 0.016);
    expect(s.phase).toBe("surface");
    expect(s.arrival).toEqual({ fuel: 0.4, hull: 0.7 });
    expect(s.log.map((e) => e.kind)).toContain("landed");
  });

  it("ends the run before arrival when the hull or fuel runs out", () => {
    for (const lost of [{ hull: 0 }, { fuel: 0 }]) {
      const s = createState(1, "mars");
      enterPhase(s, "flight", 0);
      Object.assign(s.ship, lost);
      step(s, {}, 5_000, 0.016);
      expect(s.phase).toBe("report");
      expect(s.arrival).toBeNull();
      expect(s.log.map((e) => e.kind)).toContain("ship_lost");
      expect(s.log.find((e) => e.kind === "ship_lost")?.value).toBe("hull" in lost ? LOST_HULL : LOST_FUEL);
    }
  });

  it("plans the flight's events as flight starts", () => {
    const s = createState(1, "mars");
    enterPhase(s, "flight", 0);
    expect(Array.isArray(s.flight.events)).toBe(true);
    expect((s.flight.events as unknown[]).length).toBeGreaterThan(0);
  });
});
