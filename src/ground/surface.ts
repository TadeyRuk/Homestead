import type { Point } from "../core/map";
import type { MissionId } from "../core/state";
import type { Rect } from "./geom";
import { edgeWalls, type SurfaceGround, type Wall } from "./world";

// As big as the campus. One layout for the Moon and Mars, drawn in different palettes.
// The lander sits in the middle: poor sites close by, rich sites out near the corners,
// a crater to the south-east with a broken rim, and a ridge to the west.
const W = 3072;
const H = 1728;

export const LANDER: Point = { x: 1536, y: 864 };

export interface Circle extends Point {
  r: number;
}

export const CRATER: Circle = { x: 2380, y: 1180, r: 230 };
const RIM_BLOCK = 44;
// degrees left open in the rim, so the crew can walk in: west (toward the lander) and south-east
const RIM_GAPS = [180, 192, 204, 48, 60];

function rim(): Rect[] {
  const blocks: Rect[] = [];
  for (let a = 0; a < 360; a += 12) {
    if (RIM_GAPS.includes(a)) continue;
    const rad = (a * Math.PI) / 180;
    blocks.push({
      x: Math.round(CRATER.x + CRATER.r * Math.cos(rad) - RIM_BLOCK / 2),
      y: Math.round(CRATER.y + CRATER.r * Math.sin(rad) - RIM_BLOCK / 2),
      w: RIM_BLOCK,
      h: RIM_BLOCK,
    });
  }
  return blocks;
}

const RIDGE_FROM: Point = { x: 450, y: 620 };
const RIDGE_TO: Point = { x: 1150, y: 1000 };
/** the ridge's one pass, where the weather station or seismometer goes */
export const DEPLOY_SPOT: Point = { x: 800, y: 810 };

function ridge(): Rect[] {
  const blocks: Rect[] = [];
  const steps = 30;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (t > 0.44 && t < 0.56) continue; // the pass
    const x = RIDGE_FROM.x + (RIDGE_TO.x - RIDGE_FROM.x) * t;
    const y = RIDGE_FROM.y + (RIDGE_TO.y - RIDGE_FROM.y) * t;
    blocks.push({ x: Math.round(x - 20), y: Math.round(y - 20), w: 40, h: 40 });
  }
  return blocks;
}

/** boulders in the open; solid, and cover from a solar flare (seat 6, S6-10) */
export const ROCKS: Rect[] = [
  { x: 700, y: 300, w: 50, h: 40 },
  { x: 1100, y: 450, w: 60, h: 45 },
  { x: 2000, y: 400, w: 55, h: 40 },
  { x: 2400, y: 600, w: 50, h: 50 },
  { x: 2700, y: 800, w: 60, h: 40 },
  { x: 1800, y: 1450, w: 50, h: 45 },
  { x: 1300, y: 1450, w: 60, h: 40 },
  { x: 900, y: 1350, w: 50, h: 50 },
  { x: 500, y: 1100, w: 55, h: 40 },
  { x: 2050, y: 1000, w: 45, h: 45 },
  { x: 1750, y: 250, w: 50, h: 40 },
  { x: 2950, y: 1100, w: 45, h: 50 },
];

export type SurfaceMap = SurfaceGround & {
  /** where the sample is taken: on the crater rim for Mars, on the crater floor for the Moon */
  sampleSites: Record<MissionId, Point>;
  deploySpot: Point;
  /** spots for the bonus objective; the seed picks one (S2-14) */
  bonusSpots: Point[];
  rocks: Rect[];
  crater: Circle;
  /**
   * Where each surface minigame (S2-19) is played, per mission, by its kind. A minigame whose kind
   * has no spot here can never be opened, so seats 4 and 5 agree a kind name with seat 2.
   */
  gameSpots: Record<string, Record<MissionId, Point>>;
};

export const SURFACE: SurfaceMap = {
  width: W,
  height: H,
  walls: [
    ...edgeWalls(W, H, 24),
    ...rim().map((r): Wall => ({ ...r, kind: "rim" })),
    ...ridge().map((r): Wall => ({ ...r, kind: "ridge" })),
    ...ROCKS.map((r): Wall => ({ ...r, kind: "rock" })),
  ],
  floors: [],
  pits: [CRATER],
  labels: [
    { text: "Crater", x: CRATER.x, y: CRATER.y - CRATER.r - 34 },
    { text: "Ridge", x: 560, y: 620 },
  ],
  starts: [
    { x: 1496, y: 924 },
    { x: 1576, y: 924 },
    { x: 1496, y: 804 },
    { x: 1576, y: 804 },
  ],
  lander: LANDER,
  sites: [
    // poor: a short walk from the lander
    { id: "poor-1", x: 1900, y: 700, rich: false },
    { id: "poor-2", x: 1200, y: 1100, rich: false },
    { id: "poor-3", x: 1600, y: 1250, rich: false },
    // rich: out near the corners, a long way from recharge
    { id: "rich-1", x: 260, y: 260, rich: true },
    { id: "rich-2", x: 2850, y: 280, rich: true },
    { id: "rich-3", x: 2900, y: 1500, rich: true },
    { id: "rich-4", x: 300, y: 1480, rich: true },
  ],
  sampleSites: {
    mars: { x: 2155, y: 1132 }, // in the rim's west gap
    moon: { x: CRATER.x, y: CRATER.y }, // the crater floor
  },
  deploySpot: DEPLOY_SPOT,
  bonusSpots: [
    { x: 1000, y: 200 },
    { x: 2600, y: 300 },
    { x: 700, y: 1600 },
  ],
  rocks: ROCKS,
  crater: CRATER,
  gameSpots: {
    // S2-20: Mars has water ice just under the soil on the open plain north of the ridge;
    // the Moon's is in the permanently shadowed side of the crater, away from the regolith on its floor
    "ice-drill": {
      mars: { x: 600, y: 470 },
      moon: { x: CRATER.x - 70, y: CRATER.y - 120 },
    },
    // S4-11: open sky clear of the ridge and rocks, for tracking an orbiter's pass
    "relay-align": {
      mars: { x: 1260, y: 640 },
      moon: { x: 1260, y: 640 },
    },
    // S5-11: the lander's west solar wing
    "panel-clean": {
      mars: { x: LANDER.x - 104, y: LANDER.y + 4 },
      moon: { x: LANDER.x - 104, y: LANDER.y + 4 },
    },
  },
};
