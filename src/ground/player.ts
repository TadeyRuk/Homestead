import type { Input } from "../core/input";
import type { Point } from "../core/map";
import type { GameState, Phase } from "../core/state";
import { PLAYER_SPEED } from "../core/step";
import { inSurfaceGame } from "../missions/games";
import { moveWithWalls } from "./geom";
import { groundOf, type GroundMap } from "./world";

/** puts the crew on the map's start points, one each, wrapping if there are more players than points */
export function placeCrew(state: GameState, map: GroundMap): void {
  state.players.forEach((p, i) => {
    const at = map.starts[i % map.starts.length];
    p.x = at.x;
    p.y = at.y;
  });
}

/**
 * Core has already moved every player by their keys this tick (step.ts), with no walls.
 * Undo that move and redo it against the walls. Reversing the move needs no memory of
 * last tick, so it stays right through phase changes and new runs.
 */
export function collide(state: GameState, inputs: Record<string, Input>, dt: number, map: GroundMap): void {
  for (const p of state.players) {
    const input = inputs[p.id];
    if (!input || p.down || (input.dx === 0 && input.dy === 0)) continue;
    const from = { x: p.x - input.dx * PLAYER_SPEED * dt, y: p.y - input.dy * PLAYER_SPEED * dt };
    // a player in a minigame overlay is frozen: their keys belong to the minigame (S2-19)
    const to = inSurfaceGame(state, p.id) ? from : moveWithWalls(from, p, map.walls, map);
    p.x = to.x;
    p.y = to.y;
  }
}

// host only: which phase of which run already had its crew placed
const placed = new Set<string>();

/** true on the first tick of a ground phase in a run, after placing the crew */
export function enterGround(state: GameState): boolean {
  const map = groundOf(state.phase);
  if (!map) return false;
  const key = `${state.runStartedAt}:${state.phase}`;
  if (placed.has(key)) return false;
  placed.add(key);
  placeCrew(state, map);
  // campus parts stay on Earth (enterPhase already empties the map); the crew lands empty-handed
  if (state.phase === "surface") for (const p of state.players) p.carrying = null;
  return true;
}

/** the host's per-tick ground rule: place the crew on entry, then keep everyone out of walls */
export function groundRule(state: GameState, inputs: Record<string, Input>, _now: number, dt: number): void {
  const map = groundOf(state.phase);
  if (!map) return;
  // on the entry tick everyone was just placed, so there is no move to correct
  if (!enterGround(state)) collide(state, inputs, dt, map);
}

/**
 * The same walls for anyone predicting a move away from the host (src/net/smooth.ts),
 * so a joiner's own player stops at walls instead of sinking in and snapping back.
 */
export function walkOnGround(phase: Phase, from: Point, to: Point): Point {
  const map = groundOf(phase);
  return map ? moveWithWalls(from, to, map.walls, map) : to;
}
