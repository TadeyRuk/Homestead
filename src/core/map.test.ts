import { describe, expect, it } from "vitest";
import { mapFor, nearest, registerMap, type MapLayout } from "./map";
import { createState } from "./state";

describe("map layouts", () => {
  it("has a placeholder campus and surface until seat 2 registers the real maps", () => {
    expect(mapFor("campus").spawnPoints.length).toBeGreaterThan(0);
    expect(mapFor("campus").pad).toBeDefined();
    expect(mapFor("surface").lander).toBeDefined();
  });

  it("returns the layout seat 2 registered", () => {
    const campus: MapLayout = { width: 3000, height: 1600, spawnPoints: [{ x: 1, y: 2 }], pad: { x: 0, y: 0 }, kiosk: { x: 5, y: 5 } };
    registerMap("campus", campus);
    expect(mapFor("campus")).toBe(campus);
  });
});

describe("nearest", () => {
  it("finds the closest point within reach, or nothing", () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    expect(nearest(pts, { x: 90, y: 5 }, 32)).toBe(pts[1]);
    expect(nearest(pts, { x: 50, y: 0 }, 32)).toBeNull();
  });
});

describe("loose parts in the run state", () => {
  it("start empty and survive a JSON round trip, like every snapshot", () => {
    const s = createState(1, "mars");
    expect(s.parts).toEqual([]);
    s.parts.push({ id: "lp1", part: "rtg", x: 10, y: 20 });
    expect(JSON.parse(JSON.stringify(s)).parts).toEqual([{ id: "lp1", part: "rtg", x: 10, y: 20 }]);
  });
});
