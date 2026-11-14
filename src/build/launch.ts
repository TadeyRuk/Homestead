import { findPart, salvageFor } from "../core/catalog";
import { logEvent } from "../core/events";
import type { Input } from "../core/input";
import { mapFor, nearest } from "../core/map";
import { enterPhase } from "../core/phases";
import type { GameState, Slot } from "../core/state";
import { isUp, timeLeft } from "../core/timer";

export const COUNTDOWN_MS = 5_000;
/** how close to the pad a player must stand to start or cancel the countdown */
export const PAD_REACH = 48;
const SLOTS: Slot[] = ["propulsion", "power", "comms", "payload"];

// launch is never blocked: an overweight rocket still lifts off, fails, and the report explains why
function liftOff(state: GameState, now: number): void {
  state.launchAt = null;
  const mounted = SLOTS.map((slot) => state.ship.slots[slot]).filter((id): id is string => id !== null);
  // a part the catalog doesn't know (data and mounting out of step) fails the launch rather than the run
  const unknown = mounted.find((id) => !findPart(id));
  const mass = mounted.reduce((sum, id) => sum + (findPart(id)?.mass ?? 0), 0);
  const engine = state.ship.slots.propulsion;
  const lift = (engine && findPart(engine)?.lift) || 0;
  // no engine lifts nothing, so an empty propulsion slot always fails
  if (unknown || lift === 0 || mass > lift) {
    logEvent(state, "launch_failed", now, { part: unknown ?? engine ?? undefined, value: mass - lift });
    enterPhase(state, "report", now);
  } else {
    enterPhase(state, "flight", now);
  }
}

function fillSalvage(state: GameState, now: number): void {
  for (const slot of SLOTS) {
    if (state.ship.slots[slot]) continue;
    const part = salvageFor(slot);
    state.ship.slots[slot] = part;
    state.ship.salvaged.push(slot);
    logEvent(state, "salvage_filled", now, { part });
  }
}

/** host rule for the campus: E at the pad toggles the countdown; liftoff on countdown or timeout */
export function launchRule(state: GameState, inputs: Record<string, Input>, now: number): void {
  const pad = mapFor("campus").pad;
  let toggled = false; // two presses on one tick would start and cancel; take the first
  for (const p of state.players) {
    if (toggled) break;
    // E while carrying a part belongs to mounting (S2-10); empty-handed E at the pad is the countdown
    if (!inputs[p.id]?.interact || p.carrying || p.down || !nearest([pad], p, PAD_REACH)) continue;
    toggled = true;
    if (state.launchAt === null) {
      state.launchAt = now + COUNTDOWN_MS;
      logEvent(state, "launch_started", now, { player: p.id, value: timeLeft(state, now) });
    } else {
      state.launchAt = null;
      logEvent(state, "launch_cancelled", now, { player: p.id });
    }
  }
  // the timeout fills salvage first, even when a countdown ends on the same tick
  if (isUp(state, now)) {
    fillSalvage(state, now);
    return liftOff(state, now);
  }
  if (state.launchAt !== null && now >= state.launchAt) liftOff(state, now);
}
