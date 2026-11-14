import type { GameState, Phase } from "./state";

export const PHASE_ORDER: readonly Phase[] = ["lobby", "brief", "campus", "flight", "surface", "report"];

// lengths from the proposal's run outline; flight is "about 3 min" until seat 4 ties it to transit
export const PHASE_SECONDS: Record<Phase, number> = {
  lobby: Infinity,
  brief: 20,
  campus: 180,
  flight: 180,
  surface: 180,
  report: 60,
};

export function nextPhase(phase: Phase): Phase {
  return PHASE_ORDER[(PHASE_ORDER.indexOf(phase) + 1) % PHASE_ORDER.length];
}

export function enterPhase(state: GameState, phase: Phase, now: number): void {
  state.phase = phase;
  const seconds = PHASE_SECONDS[phase];
  // null, not Infinity: snapshots go through JSON, which turns Infinity into null anyway
  state.phaseEndsAt = Number.isFinite(seconds) ? now + seconds * 1000 : null;
  // each map has its own loose parts; campus spawns refill on entry (S1-09)
  if (phase === "campus" || phase === "surface") state.parts = [];
  // seat everyone at their first station as flight starts, so no flight rule ever sees a null station
  for (const p of state.players) p.station = phase === "flight" ? (p.roles[0] ?? null) : null;
  if (phase === "brief") {
    // fresh clock and empty log for the report; resetting the ship and crew is the lobby's job (S1-05)
    state.runStartedAt = now;
    state.log = [];
  }
}
