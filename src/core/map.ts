export type Point = { x: number; y: number };

// seat 2 owns the real layouts and registers them from src/ground/; every field is required, so a
// forgotten pad is a compile error rather than a launch that silently never fires
export interface CampusLayout {
  width: number;
  height: number;
  /** where seeded parts appear (S1-09) */
  spawnPoints: Point[];
  /** where parts are mounted and the launch countdown starts (S2-10, S1-10) */
  pad: Point;
  kiosk: Point;
}

export interface SurfaceLayout {
  width: number;
  height: number;
  /** where suits recharge and data uploads */
  lander: Point;
  sites: (Point & { id: string; rich: boolean })[];
}

type Layouts = { campus: CampusLayout; surface: SurfaceLayout };

// placeholders sized to the canvas, so spawns and launch work before seat 2's maps land
const maps: Layouts = {
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
    lander: { x: 480, y: 270 },
    sites: [],
  },
};

const claimed = new Set<keyof Layouts>();

export function registerMap<K extends keyof Layouts>(which: K, layout: Layouts[K]): void {
  if (claimed.has(which)) console.warn(`registerMap: "${which}" was already registered; replacing it`);
  claimed.add(which);
  maps[which] = layout;
}

export function mapFor<K extends keyof Layouts>(which: K): Layouts[K] {
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
