import type { Point } from "../core/map";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Bounds {
  width: number;
  height: number;
}

/** half a player's box; players are 14 px across, small against a map several screens wide */
export const PLAYER_HALF = 7;

// moves are cut into slices no longer than this, so even a one-second tick from a throttled
// background tab (180 px) can't carry a player through a wall thinner than the player
const SLICE_PX = 6;

/** does a box of half-size `half` centred on (x, y) overlap the rect */
export function overlaps(r: Rect, x: number, y: number, half: number): boolean {
  return x + half > r.x && x - half < r.x + r.w && y + half > r.y && y - half < r.y + r.h;
}

/** is a player-sized box at `p` inside any wall */
export function blocked(walls: readonly Rect[], p: Point, half = PLAYER_HALF): boolean {
  return walls.some((w) => overlaps(w, p.x, p.y, half));
}

export function inBounds(bounds: Bounds, p: Point, half = PLAYER_HALF): boolean {
  return p.x - half >= 0 && p.y - half >= 0 && p.x + half <= bounds.width && p.y + half <= bounds.height;
}

/**
 * Where a player who tried to walk from `from` to `to` ends up. Each axis moves on its own,
 * so walking diagonally into a wall slides along it instead of sticking.
 */
export function moveWithWalls(from: Point, to: Point, walls: readonly Rect[], bounds: Bounds, half = PLAYER_HALF): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const slices = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / SLICE_PX));
  let x = from.x;
  let y = from.y;
  let hit = false;
  for (let i = 0; i < slices; i++) {
    const sx = slide(x, dx / slices, (nx, w) => overlaps(w, nx, y, half), walls, half, "x");
    const sy = slide(y, dy / slices, (ny, w) => overlaps(w, sx, ny, half), walls, half, "y");
    hit ||= sx !== x + dx / slices || sy !== y + dy / slices;
    x = sx;
    y = sy;
  }
  // no wall touched: land exactly on the target, without the float drift of adding up slices
  if (!hit) ({ x, y } = to);
  return {
    x: clamp(x, half, bounds.width - half),
    y: clamp(y, half, bounds.height - half),
  };
}

function slide(
  at: number,
  by: number,
  hits: (next: number, w: Rect) => boolean,
  walls: readonly Rect[],
  half: number,
  axis: "x" | "y",
): number {
  if (by === 0) return at;
  let next = at + by;
  for (const w of walls) {
    // a wall the player is already inside never pushes, so someone stuck can still walk out
    if (hits(at, w) || !hits(next, w)) continue;
    const lo = axis === "x" ? w.x : w.y;
    const size = axis === "x" ? w.w : w.h;
    next = by > 0 ? lo - half : lo + size + half;
  }
  return next;
}

export function clamp(v: number, lo: number, hi: number): number {
  return hi < lo ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v));
}
