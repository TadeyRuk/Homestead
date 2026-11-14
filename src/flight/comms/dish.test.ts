import { describe, expect, it } from "vitest";
import type { EventKind } from "../../core/events";
import { BEAM, createDish, LEAN_RATE, MAX_ANGLE, stepDish } from "./dish";

const log: { kind: EventKind; part?: string }[] = [];
const emit = (kind: EventKind, f: { part?: string }) => log.push({ kind, ...f });
const turn = (dx: number) => ({ dx });

describe("comms dish", () => {
  it("starts locked on Earth", () => {
    expect(createDish()).toMatchObject({ angle: 0, locked: true });
  });

  it("drifts off target when the pilot turns, more for a high-gain dish than a low-gain antenna", () => {
    const low = createDish(), high = createDish();
    stepDish(low, { pilot: turn(1), comms: turn(0), drift: 0.1, part: "low-gain", pace: 1 }, 1, () => {});
    stepDish(high, { pilot: turn(1), comms: turn(0), drift: 0.5, part: "high-gain", pace: 1 }, 1, () => {});
    expect(Math.abs(high.angle)).toBeGreaterThan(Math.abs(low.angle));
  });

  it("loses the link past the beam and logs it with the antenna, then relocks when leaned back", () => {
    log.length = 0;
    const d = createDish();
    stepDish(d, { pilot: turn(1), comms: turn(0), drift: 0.5, part: "high-gain", pace: 1 }, 1, emit);
    expect(d.locked).toBe(false);
    expect(log).toContainEqual({ kind: "link_lost", part: "high-gain" });
    const back = Math.ceil(Math.abs(d.angle) / (LEAN_RATE * 0.1)) + 1;
    for (let i = 0; i < back && !d.locked; i++) {
      stepDish(d, { pilot: turn(0), comms: turn(-Math.sign(d.angle)), drift: 0.5, part: "high-gain", pace: 1 }, 0.1, emit);
    }
    expect(Math.abs(d.angle)).toBeLessThan(BEAM);
    expect(d.locked).toBe(true);
    expect(log.at(-1)).toEqual({ kind: "link_locked", part: "high-gain" });
  });

  it("drifts more gently while nobody watches the comms station", () => {
    const watched = createDish(), unwatched = createDish();
    stepDish(watched, { pilot: turn(1), comms: turn(0), drift: 0.5, part: "laser", pace: 1 }, 0.2, () => {});
    stepDish(unwatched, { pilot: turn(1), comms: turn(0), drift: 0.5, part: "laser", pace: 0.4 }, 0.2, () => {});
    expect(Math.abs(unwatched.angle)).toBeLessThan(Math.abs(watched.angle));
  });

  it("lets full lean win a laser back during a held pilot turn", () => {
    const d = createDish();
    d.angle = 0.5;
    d.locked = false;
    for (let i = 0; i < 100 && !d.locked; i++) {
      stepDish(d, { pilot: turn(1), comms: turn(-1), drift: 0.9, part: "laser", pace: 1 }, 0.1, () => {});
    }
    expect(d.locked).toBe(true);
  });

  it("caps how far off the dish can get, so a long turn doesn't leave a debt", () => {
    const d = createDish();
    for (let i = 0; i < 200; i++) stepDish(d, { pilot: turn(1), comms: turn(0), drift: 0.9, part: "laser", pace: 1 }, 0.1, () => {});
    expect(Math.abs(d.angle)).toBeLessThanOrEqual(MAX_ANGLE);
  });
});
