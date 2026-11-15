import type { GameEvent, GameState } from "./state";

// the report (seat 3) reads these; add a kind by PR to this file only
export const EVENT_KINDS = [
  "part_picked", "part_dropped", "part_mounted", "part_swapped", "kiosk_bought",
  "salvage_filled", "launch_started", "launch_cancelled", "launch_failed",
  "debris_hit", "fuel_low", "hull_breach", "breach_sealed",
  "breaker_tripped", "load_shed", "link_lost", "link_locked",
  "core_overheated", "core_too_cold", "oxygen_low", "converter_jammed",
  "site_scanned", "sample_collected", "data_uplinked", "objective_done",
  "hazard_hit", "player_down", "extraction",
  "landed", "ship_lost",
  // a surface minigame attempt failed (S2-19); `part` is the part that set the difficulty, `objective` the task
  "task_failed",
] as const;

export type EventKind = (typeof EVENT_KINDS)[number];

export function logEvent(
  state: GameState,
  kind: EventKind,
  now: number,
  fields: Pick<GameEvent, "part" | "player" | "value" | "objective"> = {},
): void {
  state.log.push({ t: (now - state.runStartedAt) / 1000, phase: state.phase, kind, ...fields });
}
