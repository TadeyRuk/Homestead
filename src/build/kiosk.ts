import { logEvent } from "../core/events";
import { rng } from "../core/rng";
import type { GameState } from "../core/state";

/** credits per roll, from the proposal's build rules */
export const KIOSK_PRICE = 20;

// a separate stream per purchase, so a roll never depends on how many other rolls happened this tick
const KIOSK_STREAM = 0x6b696f73;

/**
 * Charges one roll and returns the part id it rolled, or null when the crew can't pay.
 * Placing the part at the kiosk is the caller's job, through the loose-parts state seat 1 adds with spawns.
 */
export function buyFromKiosk(
  state: GameState,
  partIds: readonly string[],
  now: number,
  playerId?: string,
): string | null {
  if (state.credits < KIOSK_PRICE || partIds.length === 0) return null;
  const bought = state.log.filter((e) => e.kind === "kiosk_bought").length;
  const part = rng((state.seed ^ KIOSK_STREAM) + bought).pick(partIds);
  state.credits -= KIOSK_PRICE;
  logEvent(state, "kiosk_bought", now, { part, player: playerId, value: KIOSK_PRICE });
  return part;
}
