import type { GameState } from "./state";

/** seconds left in the current phase, on the host clock */
export function timeLeft(state: GameState, now: number): number {
  if (state.phaseEndsAt === null) return Infinity;
  return Math.max(0, (state.phaseEndsAt - now) / 1000);
}

export function isUp(state: GameState, now: number): boolean {
  return state.phaseEndsAt !== null && now >= state.phaseEndsAt;
}
