import { buildable } from "../core/catalog";
import { logEvent } from "../core/events";
import type { Input } from "../core/input";
import { mapFor } from "../core/map";
import { placePart } from "../core/parts";
import { rng } from "../core/rng";
import type { GameState, LoosePart } from "../core/state";
import { atKiosk, isCarryPress } from "../ground/carry";

/** credits per roll, from the proposal's build rules */
export const KIOSK_PRICE = 20;

// a separate stream per purchase, so a roll never depends on how many other rolls happened this tick
const KIOSK_STREAM = 0x6b696f73;

/**
 * Charges one roll and drops the part it rolled at the kiosk, returning that piece.
 * Null when it is not the campus phase or the crew can't pay; nothing is charged then.
 */
export function buyFromKiosk(
  state: GameState,
  partIds: readonly string[],
  now: number,
  playerId?: string,
): LoosePart | null {
  // an empty list means the parts data never reached the caller; a crew that can't pay is a different case
  if (partIds.length === 0) throw new Error("buyFromKiosk needs at least one part id");
  const kiosk = mapFor("campus").kiosk;
  if (state.phase !== "campus" || state.credits < KIOSK_PRICE) return null;
  const bought = state.log.filter((e) => e.kind === "kiosk_bought").length;
  const part = rng((state.seed ^ KIOSK_STREAM) + bought).pick(partIds);
  state.credits -= KIOSK_PRICE;
  logEvent(state, "kiosk_bought", now, { part, player: playerId, value: KIOSK_PRICE });
  return placePart(state, part, kiosk, "k");
}

/**
 * Host rule for the campus: E at the kiosk with nothing lying there buys one part.
 * A press that buys is spent, so the carry rule later this tick doesn't grab the part it just bought.
 */
export function kioskRule(state: GameState, inputs: Record<string, Input>, now: number): void {
  for (const p of state.players) {
    const input = inputs[p.id];
    if (!input?.interact || p.down || !atKiosk(state, p) || isCarryPress(state, p)) continue;
    const ids = buildable().map((info) => info.id);
    if (buyFromKiosk(state, ids, now, p.id)) inputs[p.id] = { ...input, interact: false };
  }
}
