import { describe, expect, it } from "vitest";
import { createBus, RESET_SECONDS } from "./bus";
import { engineerTrouble } from "./trouble";
import { createWelder, openBreach } from "./weld";

const bus = (supply = 1_000) =>
  createBus(1, { id: "small-solar", watts: supply }, [
    { id: "chemical-engine", slot: "propulsion", watts: 30 },
    { id: "radar", slot: "payload", watts: 200 },
  ]);

describe("engineer trouble for the crew strip", () => {
  it("is steady when the bus is under supply and the hull holds", () => {
    expect(engineerTrouble(bus(), createWelder(1))).toBeNull();
  });

  it("names a tripped breaker first", () => {
    const b = bus(100);
    b.tripped = RESET_SECONDS;
    const w = createWelder(1);
    openBreach(w, 0.2);
    expect(engineerTrouble(b, w)).toBe("Breaker tripped");
  });

  it("names an open breach next", () => {
    const w = createWelder(1);
    openBreach(w, 0.2);
    expect(engineerTrouble(bus(100), w)).toBe("Hull breach");
  });

  it("warns while the bus is over supply", () => {
    expect(engineerTrouble(bus(100), createWelder(1))).toBe("Bus overload");
  });

  it("says when the engineer is waiting on the pilot", () => {
    const b = bus();
    b.engineOffAsked = true;
    expect(engineerTrouble(b, createWelder(1))).toBe("Asking pilot");
  });
});
