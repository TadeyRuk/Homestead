import { describe, expect, it } from "vitest";
import { mapFor } from "../core/map";
import { createState } from "../core/state";
import { buyFromKiosk, KIOSK_PRICE } from "./kiosk";

const PARTS = ["solid-motor", "chemical-engine", "ion-drive", "small-solar", "rtg", "camera"];

function crew(credits: number, seed = 48213) {
  const s = createState(seed, "mars");
  s.credits = credits;
  s.phase = "campus";
  s.runStartedAt = 1_000;
  return s;
}

describe("buyFromKiosk", () => {
  it("charges the price and drops one of the offered parts at the kiosk", () => {
    const s = crew(40);
    const piece = buyFromKiosk(s, PARTS, 6_000, "p1")!;
    expect(PARTS).toContain(piece.part);
    expect(s.credits).toBe(40 - KIOSK_PRICE);
    expect(s.parts).toEqual([piece]);
    expect({ x: piece.x, y: piece.y }).toEqual(mapFor("campus").kiosk);
  });

  it("gives two purchases two distinct pieces", () => {
    const s = crew(100);
    const a = buyFromKiosk(s, PARTS, 2_000)!;
    const b = buyFromKiosk(s, PARTS, 2_000)!;
    expect(a.id).not.toBe(b.id);
    expect(s.parts).toHaveLength(2);
  });

  it("sells nothing outside the campus and charges nothing", () => {
    const s = crew(40);
    s.phase = "flight";
    expect(buyFromKiosk(s, PARTS, 6_000)).toBeNull();
    expect(s.credits).toBe(40);
  });

  it("logs kiosk_bought with the part, the buyer, the price and the run time", () => {
    const s = crew(40);
    const piece = buyFromKiosk(s, PARTS, 6_000, "p1")!;
    expect(s.log).toEqual([{ t: 5, phase: "campus", kind: "kiosk_bought", part: piece.part, player: "p1", value: KIOSK_PRICE }]);
  });

  it("refuses when the crew can't pay, and changes nothing", () => {
    const s = crew(KIOSK_PRICE - 1);
    expect(buyFromKiosk(s, PARTS, 6_000)).toBeNull();
    expect(s.credits).toBe(KIOSK_PRICE - 1);
    expect(s.log).toEqual([]);
  });

  it("throws on an empty part list, which is a wiring bug, not a crew that can't pay", () => {
    const s = crew(40);
    expect(() => buyFromKiosk(s, [], 6_000)).toThrow();
    expect(s.credits).toBe(40);
  });

  it("rolls the same parts in the same order for the same seed", () => {
    const a = crew(100);
    const b = crew(100);
    const rollsA = [1, 2, 3].map((i) => buyFromKiosk(a, PARTS, 1_000 + i)?.part);
    const rollsB = [1, 2, 3].map((i) => buyFromKiosk(b, PARTS, 9_000 + i)?.part);
    expect(rollsA).toEqual(rollsB);
  });

  it("gives different seeds different rolls", () => {
    const rolls = (seed: number) => {
      const s = crew(200, seed);
      return Array.from({ length: 10 }, () => buyFromKiosk(s, PARTS, 2_000)?.part);
    };
    expect(rolls(1)).not.toEqual(rolls(2));
  });

  it("can stop at exactly zero credits", () => {
    const s = crew(KIOSK_PRICE * 2);
    expect(buyFromKiosk(s, PARTS, 2_000)).not.toBeNull();
    expect(buyFromKiosk(s, PARTS, 2_000)).not.toBeNull();
    expect(buyFromKiosk(s, PARTS, 2_000)).toBeNull();
    expect(s.credits).toBe(0);
  });
});
