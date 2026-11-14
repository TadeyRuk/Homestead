import { describe, expect, it } from "vitest";
import { blocked, clamp, moveWithWalls, overlaps, PLAYER_HALF, type Rect } from "./geom";

const bounds = { width: 1000, height: 1000 };
const wall: Rect = { x: 500, y: 0, w: 40, h: 1000 }; // a tall wall from x 500 to 540

describe("overlaps", () => {
  it("counts touching edges as clear, so a player can stand flush against a wall", () => {
    expect(overlaps(wall, 500 - PLAYER_HALF, 300, PLAYER_HALF)).toBe(false);
    expect(overlaps(wall, 500 - PLAYER_HALF + 0.5, 300, PLAYER_HALF)).toBe(true);
  });
});

describe("moveWithWalls", () => {
  it("moves freely in open ground", () => {
    expect(moveWithWalls({ x: 100, y: 100 }, { x: 150, y: 130 }, [wall], bounds)).toEqual({ x: 150, y: 130 });
  });

  it("stops flush against a wall", () => {
    const at = moveWithWalls({ x: 400, y: 300 }, { x: 520, y: 300 }, [wall], bounds);
    expect(at).toEqual({ x: 500 - PLAYER_HALF, y: 300 });
  });

  it("slides along a wall when walking into it at an angle", () => {
    const at = moveWithWalls({ x: 480, y: 300 }, { x: 520, y: 340 }, [wall], bounds);
    expect(at.x).toBe(500 - PLAYER_HALF);
    expect(at.y).toBeCloseTo(340);
  });

  it("never tunnels through a thin wall, even on a one-second tick", () => {
    const thin: Rect = { x: 500, y: 0, w: 4, h: 1000 };
    const at = moveWithWalls({ x: 420, y: 300 }, { x: 600, y: 300 }, [thin], bounds);
    expect(at.x).toBe(500 - PLAYER_HALF);
  });

  it("stops at the map edge", () => {
    expect(moveWithWalls({ x: 20, y: 20 }, { x: -50, y: -50 }, [], bounds)).toEqual({ x: PLAYER_HALF, y: PLAYER_HALF });
    expect(moveWithWalls({ x: 980, y: 980 }, { x: 1100, y: 1100 }, [], bounds)).toEqual({
      x: 1000 - PLAYER_HALF,
      y: 1000 - PLAYER_HALF,
    });
  });

  it("lets a player who is stuck inside a wall walk out of it", () => {
    const at = moveWithWalls({ x: 505, y: 300 }, { x: 495, y: 300 }, [wall], bounds);
    expect(at.x).toBe(495);
    expect(blocked([wall], { x: 480, y: 300 })).toBe(false);
  });

  it("stops at the first of two walls in a row", () => {
    const near: Rect = { x: 200, y: 0, w: 20, h: 1000 };
    const at = moveWithWalls({ x: 150, y: 300 }, { x: 600, y: 300 }, [wall, near], bounds);
    expect(at.x).toBe(200 - PLAYER_HALF);
  });
});

describe("clamp", () => {
  it("keeps a value in range, and centres it when the range is empty", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(3, 10, 0)).toBe(5);
  });
});
