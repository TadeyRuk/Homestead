import { partInfo } from "../core/catalog";
import { logEvent } from "../core/events";
import type { Input } from "../core/input";
import { nearest, type Point } from "../core/map";
import { placePart } from "../core/parts";
import type { GameState, Player, Slot } from "../core/state";
import { PAD_REACH } from "../ground/carry";
import { groundFor } from "../ground/world";

export const SLOTS: readonly Slot[] = ["propulsion", "power", "comms", "payload"];

/** where each slot's display sits, in a row just south of the pad */
export const SLOT_OFFSETS: Record<Slot, Point> = {
  propulsion: { x: -84, y: 72 },
  power: { x: -28, y: 72 },
  comms: { x: 28, y: 72 },
  payload: { x: 84, y: 72 },
};

export function slotSpot(pad: Point, slot: Slot): Point {
  return { x: pad.x + SLOT_OFFSETS[slot].x, y: pad.y + SLOT_OFFSETS[slot].y };
}

/**
 * Where a part swapped out of `slot` lands: below that slot's display, well outside PAD_REACH,
 * because inside it E mounts or launches and never picks up.
 */
export function dropSpot(pad: Point, slot: Slot): Point {
  const at = slotSpot(pad, slot);
  return { x: at.x, y: at.y + 50 };
}

/** the slot a part mounts in, or null for anything that isn't a rocket part */
export function slotOf(part: string): Slot | null {
  try {
    return partInfo(part).slot;
  } catch {
    return null;
  }
}

/**
 * Mounts the part a player carries into its own slot. A full slot swaps: the old part drops
 * beside the pad at that slot's spot. Logs `part_swapped` (the old part) then `part_mounted`.
 * Returns false and changes nothing for empty hands or a part with no slot.
 */
export function mountCarried(state: GameState, p: Player, now: number): boolean {
  if (!p.carrying) return false;
  const slot = slotOf(p.carrying);
  if (!slot) return false;
  const old = state.ship.slots[slot];
  if (old) {
    placePart(state, old, dropSpot(groundFor("campus").pad, slot), "d");
    logEvent(state, "part_swapped", now, { part: old, player: p.id });
  }
  state.ship.slots[slot] = p.carrying;
  logEvent(state, "part_mounted", now, { part: p.carrying, player: p.id });
  p.carrying = null;
  return true;
}

/**
 * Host rule for the campus: E at the pad while carrying mounts the part. Empty-handed E at the
 * pad is seat 1's launch countdown (src/build/launch.ts), which skips anyone carrying.
 */
export function padRule(state: GameState, inputs: Record<string, Input>, now: number): void {
  if (state.phase !== "campus") return;
  const pad = groundFor("campus").pad;
  for (const p of state.players) {
    if (!inputs[p.id]?.interact || p.down || !p.carrying || !nearest([pad], p, PAD_REACH)) continue;
    mountCarried(state, p, now);
  }
}
