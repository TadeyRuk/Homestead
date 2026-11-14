import { describe, expect, it } from "vitest";
import { partInfo } from "../core/catalog";
import { mapFor } from "../core/map";
import { createState } from "../core/state";
import { spawnParts } from "./spawns";

const pts = (n: number) => Array.from({ length: n }, (_, i) => ({ x: i * 10, y: 0 }));
const run = (seed: number) => createState(seed, "mars");

describe("spawnParts", () => {
  it("puts one of every part on twelve spawn points", () => {
    const s = run(5);
    spawnParts(s, pts(12));
    expect(s.parts).toHaveLength(12);
    expect(new Set(s.parts.map((p) => p.part)).size).toBe(12);
  });

  it("gives the same seed the same campus and a new seed a different one", () => {
    const a = run(5), b = run(5), c = run(6);
    for (const s of [a, b, c]) spawnParts(s, pts(12));
    expect(a.parts).toEqual(b.parts);
    expect(c.parts.map((p) => p.part)).not.toEqual(a.parts.map((p) => p.part));
  });

  it("still offers every slot when there are fewer spawn points than parts", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = run(seed);
      spawnParts(s, pts(5));
      expect(s.parts).toHaveLength(5);
      const slots = new Set(s.parts.map((p) => partInfo(p.part).slot));
      expect([...slots].sort()).toEqual(["comms", "payload", "power", "propulsion"]);
    }
  });

  it("uses the campus map's spawn points by default", () => {
    const s = run(9);
    spawnParts(s);
    const points = mapFor("campus").spawnPoints.map((p) => `${p.x},${p.y}`);
    for (const p of s.parts) expect(points).toContain(`${p.x},${p.y}`);
  });
});
