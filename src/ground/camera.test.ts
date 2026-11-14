import { describe, expect, it } from "vitest";
import { ARROW_MARGIN, edgeArrow, follow } from "./camera";

const map = { width: 3072, height: 1728 };
const W = 960;
const H = 540;

describe("follow", () => {
  it("centres on the player in open ground", () => {
    expect(follow({ x: 1500, y: 900 }, map, W, H)).toEqual({ x: 1020, y: 630, w: W, h: H });
  });

  it("stops at each edge and corner instead of showing past the map", () => {
    expect(follow({ x: 10, y: 10 }, map, W, H)).toMatchObject({ x: 0, y: 0 });
    expect(follow({ x: 3070, y: 1720 }, map, W, H)).toMatchObject({ x: 3072 - W, y: 1728 - H });
    expect(follow({ x: 3070, y: 900 }, map, W, H)).toMatchObject({ x: 3072 - W, y: 630 });
    expect(follow({ x: 1500, y: 5 }, map, W, H)).toMatchObject({ x: 1020, y: 0 });
  });

  it("centres a map smaller than the screen", () => {
    expect(follow({ x: 0, y: 0 }, { width: 800, height: 400 }, W, H)).toMatchObject({ x: -80, y: -70 });
  });

  it("shows about a tenth of a campus-sized map", () => {
    expect((W * H) / (map.width * map.height)).toBeCloseTo(0.098, 2);
  });
});

describe("edgeArrow", () => {
  const cam = follow({ x: 1500, y: 900 }, map, W, H); // screen covers x 1020..1980, y 630..1170
  const me = { x: 1500, y: 900 };

  it("is hidden while the target is on screen", () => {
    expect(edgeArrow(cam, { x: 1700, y: 1000 }, me)).toBeNull();
  });

  it("points right from the right edge for a target to the east", () => {
    const a = edgeArrow(cam, { x: 2800, y: 900 }, me)!;
    expect(a.x).toBeCloseTo(W - ARROW_MARGIN);
    expect(a.y).toBeCloseTo(H / 2);
    expect(a.angle).toBeCloseTo(0);
    expect(a.distance).toBeCloseTo(1300);
  });

  it("points up from the top edge for a target to the north", () => {
    const a = edgeArrow(cam, { x: 1500, y: 100 }, me)!;
    expect(a.y).toBeCloseTo(ARROW_MARGIN);
    expect(a.x).toBeCloseTo(W / 2);
    expect(a.angle).toBeCloseTo(-Math.PI / 2);
  });

  it("sits on the left or bottom edge for targets that way", () => {
    expect(edgeArrow(cam, { x: 100, y: 900 }, me)!.x).toBeCloseTo(ARROW_MARGIN);
    expect(edgeArrow(cam, { x: 1500, y: 1700 }, me)!.y).toBeCloseTo(H - ARROW_MARGIN);
  });

  it("stays on screen for a far diagonal target", () => {
    const a = edgeArrow(cam, { x: 3000, y: 1700 }, me)!;
    expect(a.x).toBeGreaterThanOrEqual(ARROW_MARGIN - 1e-9);
    expect(a.x).toBeLessThanOrEqual(W - ARROW_MARGIN + 1e-9);
    expect(a.y).toBeGreaterThanOrEqual(ARROW_MARGIN - 1e-9);
    expect(a.y).toBeLessThanOrEqual(H - ARROW_MARGIN + 1e-9);
    expect(a.angle).toBeGreaterThan(0);
    expect(a.angle).toBeLessThan(Math.PI / 2);
  });

  it("measures distance from the player, not from the screen's centre", () => {
    const a = edgeArrow(cam, { x: 2800, y: 900 }, { x: 1300, y: 900 })!;
    expect(a.distance).toBeCloseTo(1500);
  });
});
