// S2-19: the frame every surface minigame plugs into. A minigame registers once from its own
// folder; seat 2's surface rule opens it at its map spot, steps it on the host, logs failures
// and completes its objective. The minigame never touches GameState itself.
import type { Input } from "../core/input";
import type { Point } from "../core/map";
import type { DeepReadonly } from "../core/scene";
import type { MissionId, Slot } from "../core/state";
import { SURFACE } from "../ground/surface";

/** what `update` says after each tick: keep going, the attempt failed, or the task is done */
export type GameResult = "playing" | "failed" | "done";

/** what a fresh attempt is built from; all of it is plain data on every tab */
export interface GameStart {
  /** the run's seed; mix in `tries` for a different layout per retry, through src/core/rng.ts */
  seed: number;
  mission: MissionId;
  /** the part in the minigame's slot, which sets the difficulty (null if the slot is empty) */
  part: string | null;
  /** failed attempts before this one */
  tries: number;
}

/** what `draw` gets besides the minigame's own state */
export interface GameDrawInfo {
  mission: MissionId;
  part: string | null;
  tries: number;
  /** seconds since the last failure, or Infinity; the frame already flashes it, this is for extra effects */
  sinceFail: number;
}

/** the overlay's inner area, in screen pixels */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SurfaceGame<G = unknown> {
  /** short name: the map marker, the overlay title and the report, for example "Ice drill" */
  name: string;
  /** the line on Mission Control's list, for example "Drill for subsurface ice" */
  label(mission: MissionId): string;
  /** the ship slot whose part sets the difficulty; that part is logged on `task_failed` */
  slot: Slot;
  /** the keys, shown under the overlay, for example "W/S: hold the pressure in the green band" */
  keys: string;
  /** may this build get the task at all; panel cleaning returns false for anything not solar */
  eligible?(part: string | null): boolean;
  /** a real-missions line for the overlay and the report */
  fact?(mission: MissionId): string;
  /** a fresh attempt; return plain data only (no classes or functions), since joiners get it in snapshots */
  start(at: GameStart): G;
  /**
   * Host only, each tick while the overlay is open: step `game` in place from this player's keys
   * (dx/dy from WASD or arrows, `interact` for E) and say how it went.
   */
  update(game: G, input: Input, dt: number): GameResult;
  /** every tab: draw read-only `game` inside `box`; the frame draws the panel, title, keys and fail flash */
  draw(ctx: CanvasRenderingContext2D, game: DeepReadonly<G>, box: Box, info: GameDrawInfo): void;
}

const games = new Map<string, SurfaceGame>();

/**
 * Plugs a minigame into the surface. `kind` is also its objective id and must have a spot in
 * `SURFACE.gameSpots` (ask seat 2 for one); call it from your folder's `.register.ts` file.
 */
export function registerSurfaceGame<G>(kind: string, game: SurfaceGame<G>): void {
  if (games.has(kind)) console.warn(`registerSurfaceGame: "${kind}" was already registered; replacing it`);
  if (!SURFACE.gameSpots[kind]) console.warn(`registerSurfaceGame: "${kind}" has no spot in SURFACE.gameSpots, so it can't be opened`);
  games.set(kind, game as SurfaceGame);
}

/** removes a minigame; for tests */
export function unregisterSurfaceGame(kind: string): void {
  games.delete(kind);
}

export function surfaceGame(kind: string): SurfaceGame | undefined {
  return games.get(kind);
}

/** every registered minigame that can be played: it has a spot on the map */
export function surfaceGameKinds(): string[] {
  return [...games.keys()].filter((kind) => !!SURFACE.gameSpots[kind]);
}

/** true when this build may get the task */
export function gameEligible(kind: string, slots: Readonly<Record<Slot, string | null>>): boolean {
  const g = games.get(kind);
  if (!g) return false;
  return g.eligible ? g.eligible(slots[g.slot]) : true;
}

export function gameSpot(kind: string, mission: MissionId): Point | null {
  return SURFACE.gameSpots[kind]?.[mission] ?? null;
}

/** true while this player has a minigame open: they are frozen, and their keys belong to it */
export function inSurfaceGame(state: DeepReadonly<{ phase: string; surface: { games?: Record<string, unknown> } }>, playerId: string): boolean {
  return state.phase === "surface" && !!state.surface.games?.[playerId];
}
