import { registerMap, type CampusLayout, type Point, type SurfaceLayout } from "../core/map";
import type { Phase } from "../core/state";
import type { Rect } from "./geom";

export type Ground = "campus" | "surface";

/** walkable ground drawn in its own colour: roads, aprons, the runway, a crater floor */
export interface Floor extends Rect {
  kind: string;
}

/** what a wall is, so the art can draw a tree as a tree; collision treats every kind the same */
export type WallKind = "edge" | "building" | "booth" | "rocket" | "crate" | "dish" | "tree" | "rock" | "rim" | "ridge";

export interface Wall extends Rect {
  kind?: WallKind;
}

export interface Label extends Point {
  text: string;
}

/** what every seat 2 map has, campus or surface */
export interface GroundBase {
  width: number;
  height: number;
  /** solid: buildings, rocks and the map's edge; players slide along them */
  walls: Wall[];
  /** where the crew stands when the phase starts, one per player */
  starts: Point[];
  floors: Floor[];
  /** round walkable hollows drawn in the floor colour, like a crater */
  pits?: (Point & { r: number })[];
  labels: Label[];
}

/** seat 2's campus; other seats see only the CampusLayout part through mapFor("campus") */
export type CampusMap = GroundBase & CampusLayout;
/** seat 2's surface; other seats see only the SurfaceLayout part through mapFor("surface") */
export type SurfaceGround = GroundBase & SurfaceLayout;
/** either map, for code shared by both phases */
export type GroundMap = GroundBase & Partial<CampusLayout> & Partial<SurfaceLayout>;
type Grounds = { campus: CampusMap; surface: SurfaceGround };

const EDGE = 16;

/** four walls round a map, so nobody walks off it */
export function edgeWalls(width: number, height: number, thick = EDGE): Wall[] {
  return [
    { kind: "edge", x: 0, y: 0, w: width, h: thick },
    { kind: "edge", x: 0, y: height - thick, w: width, h: thick },
    { kind: "edge", x: 0, y: 0, w: thick, h: height },
    { kind: "edge", x: width - thick, y: 0, w: thick, h: height },
  ];
}

// a one-screen room with a pillar; keeps the core placeholder's points so spawns and launch
// still line up until the real campus and surface replace it
export const TEST_ROOM: CampusMap & SurfaceGround = {
  width: 960,
  height: 540,
  walls: [...edgeWalls(960, 540), { x: 600, y: 140, w: 70, h: 70 }],
  floors: [],
  labels: [{ text: "Test room", x: 40, y: 50 }],
  starts: [
    { x: 440, y: 340 },
    { x: 480, y: 340 },
    { x: 520, y: 340 },
    { x: 560, y: 340 },
  ],
  spawnPoints: [
    { x: 120, y: 120 }, { x: 840, y: 120 }, { x: 120, y: 420 }, { x: 840, y: 420 },
    { x: 300, y: 80 }, { x: 660, y: 80 }, { x: 300, y: 460 }, { x: 660, y: 460 },
    { x: 60, y: 270 }, { x: 900, y: 270 }, { x: 480, y: 60 }, { x: 480, y: 480 },
  ],
  pad: { x: 480, y: 270 },
  kiosk: { x: 780, y: 270 },
  lander: { x: 480, y: 270 },
  sites: [],
};

const grounds: Grounds = { campus: TEST_ROOM, surface: TEST_ROOM };

/** registers a map for seat 2's rules and scenes, and its layout for every other seat (mapFor) */
export function registerGround<K extends Ground>(which: K, map: Grounds[K]): void {
  grounds[which] = map;
  registerMap(which, map);
}

/** swaps the map seat 2's own rules and scenes use, without telling other seats; for tests */
export function useGround<K extends Ground>(which: K, map: Grounds[K]): void {
  grounds[which] = map;
}

export function groundFor<K extends Ground>(which: K): Grounds[K] {
  return grounds[which];
}

/** the map a phase plays on, or null for phases with no ground (brief, flight, report) */
export function groundOf(phase: Phase): GroundMap | null {
  return phase === "campus" || phase === "surface" ? grounds[phase] : null;
}
