import { describe, expect, it } from "vitest";
import { createState } from "./state";

describe("createState", () => {
  it("starts a run in the lobby with an empty crew, log and rocket", () => {
    const s = createState(123, "mars");
    expect(s.seed).toBe(123);
    expect(s.mission).toBe("mars");
    expect(s.phase).toBe("lobby");
    expect(s.players).toEqual([]);
    expect(s.log).toEqual([]);
    expect(s.ship.slots).toEqual({ propulsion: null, power: null, comms: null, payload: null });
    expect(s.ship.salvaged).toEqual([]);
  });

  it("starts the ship whole and fully supplied", () => {
    const { ship } = createState(1, "moon");
    expect(ship.fuel).toBe(1);
    expect(ship.hull).toBe(1);
    expect(ship.cabinOxygen).toBe(1);
    expect(ship.instrumentHealth).toBe(1);
    expect(ship.linkLocked).toBe(false);
  });

  it("gives each run its own objects", () => {
    const a = createState(1, "moon");
    const b = createState(1, "moon");
    a.ship.slots.power = "rtg";
    expect(b.ship.slots.power).toBeNull();
  });
});
