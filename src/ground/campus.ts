import type { Point } from "../core/map";
import type { Rect } from "./geom";
import { edgeWalls, type CampusMap } from "./world";

// 3.2 screens each way, so one 960 x 540 screen shows about a tenth of the campus.
// Laid out after the proposal's campus mock (proposal/refs/p1-map.png): runway and training
// centre to the north-west, hangar and its yard to the west, the launch pad in the north-east,
// the kiosk by the roundabout, storage yard and tracking station to the south-east.
const W = 3072;
const H = 1728;

const buildings: Record<string, Rect> = {
  trainingCentre: { x: 760, y: 300, w: 440, h: 180 },
  hangar: { x: 200, y: 620, w: 620, h: 230 },
  vehicleAssembly: { x: 1420, y: 420, w: 340, h: 400 },
  labs: { x: 900, y: 1260, w: 760, h: 260 },
  kioskBooth: { x: 1990, y: 700, w: 90, h: 70 },
  rocket: { x: 2590, y: 200, w: 110, h: 250 },
};

const crates: Rect[] = [
  { x: 2060, y: 1120, w: 40, h: 40 },
  { x: 2140, y: 1150, w: 40, h: 40 },
  { x: 2220, y: 1110, w: 40, h: 40 },
  { x: 2120, y: 1220, w: 40, h: 40 },
];

const dishes: Rect[] = [
  { x: 2300, y: 1380, w: 90, h: 70 },
  { x: 2560, y: 1330, w: 90, h: 70 },
  { x: 2800, y: 1440, w: 90, h: 70 },
  { x: 2440, y: 1560, w: 90, h: 60 },
];

const trees: Rect[] = [
  { x: 1100, y: 700, w: 70, h: 60 },
  { x: 560, y: 1150, w: 70, h: 60 },
  { x: 1750, y: 1500, w: 60, h: 60 },
  { x: 2900, y: 600, w: 60, h: 70 },
  { x: 300, y: 1350, w: 70, h: 60 },
];

export const CAMPUS_PAD: Point = { x: 2645, y: 520 };
export const CAMPUS_KIOSK: Point = { x: 2035, y: 820 };

export const CAMPUS: CampusMap = {
  width: W,
  height: H,
  walls: [...edgeWalls(W, H, 24), ...Object.values(buildings), ...crates, ...dishes, ...trees],
  floors: [
    { kind: "runway", x: 80, y: 110, w: 1560, h: 110 },
    { kind: "yard", x: 180, y: 860, w: 1000, h: 110 },
    { kind: "road", x: 40, y: 980, w: 2990, h: 70 },
    { kind: "road", x: 1860, y: 240, w: 70, h: 1450 },
    { kind: "road", x: 1930, y: 600, w: 700, h: 60 },
    { kind: "road", x: 1800, y: 930, w: 190, h: 170 },
    { kind: "apron", x: 2420, y: 150, w: 460, h: 540 },
    { kind: "yard", x: 2020, y: 1080, w: 300, h: 220 },
    { kind: "yard", x: 2240, y: 1300, w: 760, h: 380 },
  ],
  labels: [
    { text: "Runway", x: 860, y: 172 },
    { text: "Training centre", x: 980, y: 395 },
    { text: "Hangar", x: 510, y: 740 },
    { text: "Hangar yard", x: 680, y: 925 },
    { text: "Vehicle assembly", x: 1590, y: 625 },
    { text: "R&D labs", x: 1280, y: 1395 },
    { text: "Storage yard", x: 2170, y: 1100 },
    { text: "Tracking station", x: 2620, y: 1318 },
  ],
  // four start points just south of the pad, where the crew gathers after the brief
  starts: [
    { x: 2585, y: 580 },
    { x: 2625, y: 600 },
    { x: 2665, y: 600 },
    { x: 2705, y: 580 },
  ],
  // a dozen, spread so no screen holds more than three; seat 1 seeds parts onto these (S1-09)
  spawnPoints: [
    { x: 420, y: 170 }, // runway, west end
    { x: 1400, y: 170 }, // runway, east end
    { x: 500, y: 920 }, // hangar yard
    { x: 1000, y: 1150 }, // south of the main road
    { x: 1300, y: 620 }, // between the training centre and vehicle assembly
    { x: 1700, y: 1150 }, // by the labs
    { x: 2200, y: 880 }, // east of the kiosk
    { x: 2950, y: 820 }, // east fence
    { x: 2420, y: 1470 }, // tracking station, among the dishes
    { x: 2950, y: 1250 }, // tracking station, east
    { x: 600, y: 1550 }, // south-west field
    { x: 1900, y: 1600 }, // south road
  ],
  pad: CAMPUS_PAD,
  kiosk: CAMPUS_KIOSK,
};
