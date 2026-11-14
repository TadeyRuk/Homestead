import type { Point } from "../core/map";
import { clamp, type Bounds } from "./geom";

/** the part of the map one screen shows, in map pixels */
export interface Camera {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Centres the screen on `target` without showing past the map's edge. A map smaller than
 * the screen sits in the middle of it.
 */
export function follow(target: Point, map: Bounds, w: number, h: number): Camera {
  return {
    x: clamp(target.x - w / 2, 0, map.width - w),
    y: clamp(target.y - h / 2, 0, map.height - h),
    w,
    h,
  };
}

/** an arrow at the screen's edge pointing at something off screen */
export interface EdgeArrow {
  /** screen position of the arrow's tip */
  x: number;
  y: number;
  /** radians, 0 = pointing right */
  angle: number;
  /** map pixels from `from` to the target */
  distance: number;
}

/** inset from the screen edge, so the arrow and its label stay readable */
export const ARROW_MARGIN = 30;

/**
 * Where to draw an arrow toward `target`, or null when the target is on screen.
 * The arrow sits where a line from the screen's centre to the target leaves the screen.
 */
export function edgeArrow(cam: Camera, target: Point, from: Point, margin = ARROW_MARGIN): EdgeArrow | null {
  const sx = target.x - cam.x;
  const sy = target.y - cam.y;
  if (sx >= margin && sx <= cam.w - margin && sy >= margin && sy <= cam.h - margin) return null;
  const cx = cam.w / 2;
  const cy = cam.h / 2;
  const dx = sx - cx;
  const dy = sy - cy;
  const scale = Math.min(
    dx === 0 ? Infinity : (cx - margin) / Math.abs(dx),
    dy === 0 ? Infinity : (cy - margin) / Math.abs(dy),
  );
  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
    angle: Math.atan2(dy, dx),
    distance: Math.hypot(target.x - from.x, target.y - from.y),
  };
}

/** map pixels per metre, for the distance on the arrow; a player is about 1.4 m across */
export const PX_PER_M = 10;
