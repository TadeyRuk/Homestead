type Deadline = { readonly phaseEndsAt: number | null };

/** seconds left in the current phase, on the host clock */
export function timeLeft(state: Deadline, now: number): number {
  if (state.phaseEndsAt === null) return Infinity;
  return Math.max(0, (state.phaseEndsAt - now) / 1000);
}

export function isUp(state: Deadline, now: number): boolean {
  return state.phaseEndsAt !== null && now >= state.phaseEndsAt;
}
