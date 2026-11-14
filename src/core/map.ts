export type Point = { x: number; y: number };

/** where things are on a map; seat 2 owns the real layouts and registers them from src/ground/ */
export interface MapLayout {
  width: number;
  height: number;
  /** campus: where seeded parts appear (S1-09) */
  spawnPoints: Point[];
  /** campus: where parts are mounted and the launch countdown starts (S2-10, S1-10) */
  pad?: Point;
  kiosk?: Point;
  /** surface: where suits recharge and data uploads */
  lander?: Point;
  sites?: (Point & { id: string; rich: boolean })[];
}

// placeholders sized to the canvas, so spawns and launch work before seat 2's maps land
const maps: Record<"campus" | "surface", MapLayout> = {
  campus: {
    width: 960,
    height: 540,
    spawnPoints: [
      { x: 120, y: 120 }, { x: 840, y: 120 }, { x: 120, y: 420 }, { x: 840, y: 420 },
      { x: 300, y: 80 }, { x: 660, y: 80 }, { x: 300, y: 460 }, { x: 660, y: 460 },
      { x: 60, y: 270 }, { x: 900, y: 270 }, { x: 480, y: 60 }, { x: 480, y: 480 },
    ],
    pad: { x: 480, y: 270 },
    kiosk: { x: 780, y: 270 },
  },
  surface: {
    width: 960,
    height: 540,
    spawnPoints: [],
    lander: { x: 480, y: 270 },
    sites: [],
  },
};

export function registerMap(which: "campus" | "surface", layout: MapLayout): void {
  maps[which] = layout;
}

export function mapFor(which: "campus" | "surface"): MapLayout {
  return maps[which];
}

/** the closest point within `reach` pixels, for "is the player at the pad / near a part" checks */
export function nearest<T extends Point>(points: readonly T[], from: Point, reach: number): T | null {
  let best: T | null = null;
  let bestD = reach;
  for (const p of points) {
    const d = Math.hypot(p.x - from.x, p.y - from.y);
    if (d <= bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}
