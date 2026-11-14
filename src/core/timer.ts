import type { GameState } from "./state";

/** seconds left in the current phase, on the host clock */
export function timeLeft(state: GameState, now: number): number {
  return Math.max(0, (state.phaseEndsAt - now) / 1000);
}

export function isUp(state: GameState, now: number): boolean {
  return now >= state.phaseEndsAt;
}
