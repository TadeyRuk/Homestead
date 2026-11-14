import { describe, expect, it } from "vitest";
import { createState } from "./state";
import { isUp, timeLeft } from "./timer";

describe("phase timer", () => {
  it("counts seconds left until phaseEndsAt", () => {
    const s = createState(1, "moon");
    s.phaseEndsAt = 30_000;
    expect(timeLeft(s, 18_000)).toBe(12);
    expect(isUp(s, 18_000)).toBe(false);
  });

  it("has no deadline while phaseEndsAt is null", () => {
    const s = createState(1, "moon");
    s.phaseEndsAt = null;
    expect(timeLeft(s, 10_000)).toBe(Infinity);
    expect(isUp(s, 10_000)).toBe(false);
  });

  it("survives a JSON round trip, which is how snapshots travel", () => {
    const s = JSON.parse(JSON.stringify(createState(1, "moon")));
    expect(isUp(s, 10_000)).toBe(false);
  });

  it("never goes below zero and is up at or after the end", () => {
    const s = createState(1, "moon");
    s.phaseEndsAt = 30_000;
    expect(timeLeft(s, 45_000)).toBe(0);
    expect(isUp(s, 30_000)).toBe(true);
  });
});
