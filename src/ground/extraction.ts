import { logEvent } from "../core/events";
import type { GameState } from "../core/state";
import { isUp, timeLeft } from "../core/timer";
import { flushUplinks } from "../missions/objectives";

/** seconds before the surface timer ends that the extraction ship starts coming down */
export const SHIP_DESCENT_S = 10;

/**
 * The surface ends with the extraction ship, on time, whether the list is finished or not.
 * On the tick the timer runs out this logs, before core switches the phase to the report:
 * - one `extraction` with `value` = crew members still standing
 * - one `extraction` per player, with `player`, `value` 1 standing or 0 down, and `part` if
 *   they are still carrying something
 * If the whole crew goes down, the timer is cut to now, so extraction and the report follow at once.
 */
export function extractionRule(state: GameState, _inputs: unknown, now: number): void {
  if (state.phase !== "surface") return;
  const crew = state.players;
  if (crew.length > 0 && crew.every((p) => p.down) && !isUp(state, now)) state.phaseEndsAt = now;
  if (!isUp(state, now)) return;
  // data sent in the last seconds counts in data.uplinked, so it has to be in the log too
  flushUplinks(state, now);
  logEvent(state, "extraction", now, { value: crew.filter((p) => !p.down).length });
  for (const p of crew) {
    logEvent(state, "extraction", now, {
      player: p.id,
      value: p.down ? 0 : 1,
      ...(p.carrying ? { part: p.carrying } : {}),
    });
  }
}

/** 0 while the ship is still out of sight, rising to 1 as it touches down at the lander */
export function shipDescent(state: { readonly phaseEndsAt: number | null }, now: number): number {
  const left = timeLeft(state, now);
  if (!Number.isFinite(left) || left > SHIP_DESCENT_S) return 0;
  return 1 - left / SHIP_DESCENT_S;
}
