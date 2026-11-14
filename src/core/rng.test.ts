import { describe, expect, it } from "vitest";
import { rng } from "./rng";

describe("rng", () => {
  it("gives the same sequence for the same seed", () => {
    const a = rng(42);
    const b = rng(42);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it("gives a different sequence for a different seed", () => {
    expect(rng(1).next()).not.toEqual(rng(2).next());
  });

  it("int(n) stays in 0..n-1 and pick returns a member", () => {
    const r = rng(7);
    for (let i = 0; i < 200; i++) {
      const v = r.int(4);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(4);
      expect(Number.isInteger(v)).toBe(true);
    }
    expect(["a", "b", "c"]).toContain(r.pick(["a", "b", "c"]));
  });

  it("refuses int(n) for n that is not a positive whole number", () => {
    const r = rng(1);
    expect(() => r.int(0)).toThrow();
    expect(() => r.int(2.5)).toThrow();
  });
});
