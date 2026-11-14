import { rng } from "../../core/rng";
import type { GameState } from "../../core/state";

export type FlightEventKind = "debris" | "flare" | "spike";

/** one seeded flight event; stations read the running ones through activeEvents */
export interface FlightEvent {
  kind: FlightEventKind;
  /** host-clock ms */
  at: number;
  until: number;
  /** 0..1 */
  strength: number;
}

// its own stream, so other seats drawing from the seed don't reshuffle the flight
const DIRECTOR_STREAM = 0x65766e74;
// Mars is the long, eventful flight in the proposal; the Moon trip is short and quiet
const BASE_COUNT = { moon: 4, mars: 8 } as const;
// a solo player covers four stations, so events come less often (S4-10)
const SOLO_SHARE = 0.6;
const KINDS: FlightEventKind[] = ["debris", "debris", "flare", "spike"];
const DURATION_MS = { debris: 6_000, flare: 10_000, spike: 5_000 } as const;
// a quiet start and end, so the crew can settle in and the landing isn't buried
const MARGIN_S = 10;

export function planEvents(state: GameState, start: number, seconds: number): FlightEvent[] {
  const r = rng(state.seed ^ DIRECTOR_STREAM);
  const solo = state.players.length <= 1;
  const count = Math.max(1, Math.round(BASE_COUNT[state.mission] * (solo ? SOLO_SHARE : 1)));
  const span = Math.max(0, seconds - 2 * MARGIN_S) * 1000;
  const slot = span / count;
  const events: FlightEvent[] = [];
  for (let i = 0; i < count; i++) {
    const kind = r.pick(KINDS);
    const at = start + MARGIN_S * 1000 + Math.floor(slot * i + r.next() * slot * 0.5);
    const until = Math.min(at + DURATION_MS[kind], start + seconds * 1000);
    events.push({ kind, at, until, strength: 0.4 + r.next() * 0.6 });
  }
  return events;
}

/** the events running at `now`, from the plan stored in state.flight.events */
export function activeEvents(state: { flight: Record<string, unknown> }, now: number): FlightEvent[] {
  const plan = (state.flight.events as FlightEvent[] | undefined) ?? [];
  return plan.filter((e) => e.at <= now && now < e.until);
}
