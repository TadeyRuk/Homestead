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

  it("never goes below zero and is up at or after the end", () => {
    const s = createState(1, "moon");
    s.phaseEndsAt = 30_000;
    expect(timeLeft(s, 45_000)).toBe(0);
    expect(isUp(s, 30_000)).toBe(true);
  });
});
