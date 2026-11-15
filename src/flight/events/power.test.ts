import { describe, expect, it } from "vitest";
import "../../register";
import { enterPhase } from "../../core/phases";
import { createState } from "../../core/state";
import { step } from "../../core/step";
import { createBus, type Bus } from "../engineer/bus";
import { busSupply } from "./power";

function flight(power: string, flare: boolean) {
  const s = createState(1, "mars");
  s.ship.slots.power = power;
  enterPhase(s, "flight", 0);
  s.flight.events = flare ? [{ kind: "flare", at: 0, until: 60_000, strength: 1 }] : [];
  return s;
}

describe("solar flares and the power supply (S4-07)", () => {
  it("cuts a solar array's output during a flare", () => {
    expect(busSupply(flight("small-solar", true), 1_000)).toBeLessThan(busSupply(flight("small-solar", false), 1_000));
  });

  it("leaves an RTG at full power, flare or not", () => {
    expect(busSupply(flight("rtg", true), 1_000)).toBe(busSupply(flight("rtg", false), 1_000));
    expect(busSupply(flight("rtg", true), 1_000)).toBe(450);
  });

  it("gives no power with nothing mounted", () => {
    expect(busSupply(flight("", false), 1_000)).toBe(0);
  });

  it("drives the engineer's bus supply every flight tick", () => {
    const s = flight("large-solar", true);
    s.flight.bus = createBus(1, { id: "large-solar", watts: 600 }, []);
    step(s, {}, 1_000, 0.016);
    expect((s.flight.bus as Bus).supply).toBeLessThan(600);
  });

  it("scales with flare strength, uses the strongest of overlapping flares, and recovers when it ends", () => {
    const s = flight("small-solar", false);
    s.flight.events = [{ kind: "flare", at: 0, until: 10_000, strength: 0.5 }];
    expect(busSupply(s, 1_000)).toBe(Math.round(300 * (1 - 0.6 * 0.5)));
    s.flight.events = [
      { kind: "flare", at: 0, until: 10_000, strength: 0.4 },
      { kind: "flare", at: 0, until: 10_000, strength: 0.9 },
    ];
    expect(busSupply(s, 1_000)).toBe(Math.round(300 * (1 - 0.6 * 0.9)));
    expect(busSupply(s, 10_000)).toBe(300);
  });

  it("follows the part the bus is fed by, not whatever sits in the power slot", () => {
    const s = flight("rtg", true);
    s.flight.bus = createBus(1, { id: "small-solar", watts: 300 }, []);
    step(s, {}, 1_000, 0.016);
    expect((s.flight.bus as Bus).supply).toBeLessThan(300);
    expect(busSupply(s, 1_000, "small-solar")).toBe((s.flight.bus as Bus).supply);
  });
});
