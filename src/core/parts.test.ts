import { describe, expect, it } from "vitest";
import { enterPhase } from "./phases";
import { placePart } from "./parts";
import { createState } from "./state";

describe("placePart", () => {
  it("puts a piece on the map with an id no other piece this run has had", () => {
    const s = createState(1, "mars");
    const a = placePart(s, "rtg", { x: 5, y: 6 }, "k");
    const b = placePart(s, "rtg", { x: 5, y: 6 }, "k");
    expect(s.parts).toEqual([a, b]);
    expect(a.id).not.toBe(b.id);
    s.parts = [];
    expect(placePart(s, "camera", { x: 0, y: 0 }, "s").id).not.toBe(b.id);
  });

  it("clears pieces when a map changes, so campus parts don't lie on the surface", () => {
    const s = createState(1, "mars");
    placePart(s, "rtg", { x: 5, y: 6 }, "k");
    enterPhase(s, "surface", 0);
    expect(s.parts).toEqual([]);
    placePart(s, "rtg", { x: 5, y: 6 }, "d");
    enterPhase(s, "report", 0);
    expect(s.parts).toEqual([]);
  });
});
