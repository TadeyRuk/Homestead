import type { DeepReadonly } from "../../core/scene";
import type { GameState } from "../../core/state";
import type { FlightEvent } from "../events/director";

/** how far ahead a held link warns the pilot of debris (S4-05) */
export const WARN_MS = 5_000;

/** debris starting within the warning window, visible to the pilot only while the link holds */
export function debrisWarnings(state: DeepReadonly<GameState> | GameState, now: number): FlightEvent[] {
  if (!state.ship.linkLocked) return [];
  const plan = (state.flight.events as FlightEvent[] | undefined) ?? [];
  return plan.filter((e) => e.kind === "debris" && e.at > now && e.at - now <= WARN_MS);
}

/** data send rate multiplier: a steady lock doubles it */
export function linkRate(state: DeepReadonly<GameState> | GameState): number {
  return state.ship.linkLocked ? 2 : 1;
}
