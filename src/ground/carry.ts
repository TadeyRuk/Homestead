import { logEvent } from "../core/events";
import type { Input } from "../core/input";
import { nearest } from "../core/map";
import { placePart } from "../core/parts";
import type { GameState, LoosePart, Player } from "../core/state";
import { groundFor } from "./world";

/** how close a part has to be to pick it up, centre to centre */
export const PICK_REACH = 32;
/** inside this distance of the pad, E belongs to mounting (S2-10) and the launch countdown (S1-10) */
export const PAD_REACH = 48;
/**
 * Inside this distance of the kiosk, E belongs to buying (seat 6). Bought parts land on the kiosk
 * point itself, so this must not be wider than PICK_REACH: anyone close enough to buy is close
 * enough to pick up what they bought, and never buys again by mistake (#93).
 */
export const KIOSK_REACH = PICK_REACH;

/** puts a part down where the player stands */
export function dropAt(state: GameState, p: Player, part: string): LoosePart {
  return placePart(state, part, p, "d");
}

/** at the pad, E mounts a carried part (S2-10) or starts the countdown (S1-10), never carrying */
export function atPad(state: GameState, p: Player): boolean {
  return state.phase === "campus" && !!nearest([groundFor("campus").pad], p, PAD_REACH);
}

export function atKiosk(state: GameState, p: Player): boolean {
  return state.phase === "campus" && !!nearest([groundFor("campus").kiosk], p, KIOSK_REACH);
}

/** says whether an E press belongs to something else, such as a scan or a deploy on the surface */
export type PressClaim = (state: GameState, p: Player) => boolean;
const claims: PressClaim[] = [];

/** other rules take E presses from carrying here; a claimed press never picks up or drops */
export function registerPressClaim(claim: PressClaim): void {
  claims.push(claim);
}

/**
 * Does this E press belong to carrying? Bought parts land on the kiosk, so at the kiosk a part
 * in reach is picked up first, and only a press with nothing lying there is left to buying.
 * Seat 6's buy rule should skip a press when this returns true.
 */
export function isCarryPress(state: GameState, p: Player): boolean {
  if (p.down || atPad(state, p)) return false;
  if (claims.some((claim) => claim(state, p))) return false;
  if (atKiosk(state, p)) return !!nearest(state.parts, p, PICK_REACH);
  return true;
}

/**
 * One E press: pick up the nearest part in reach, dropping whatever was carried beside you,
 * or with nothing in reach, put down what you carry.
 */
export function interact(state: GameState, p: Player, now: number): void {
  const piece = nearest(state.parts, p, PICK_REACH);
  if (piece) {
    state.parts.splice(state.parts.indexOf(piece), 1);
    if (p.carrying) {
      dropAt(state, p, p.carrying);
      logEvent(state, "part_dropped", now, { part: p.carrying, player: p.id });
    }
    p.carrying = piece.part;
    logEvent(state, "part_picked", now, { part: piece.part, player: p.id });
  } else if (p.carrying) {
    dropAt(state, p, p.carrying);
    logEvent(state, "part_dropped", now, { part: p.carrying, player: p.id });
    p.carrying = null;
  }
}

/** the host's carrying rule, for the campus and the surface */
export function carryRule(state: GameState, inputs: Record<string, Input>, now: number): void {
  for (const p of state.players) {
    if (!inputs[p.id]?.interact || !isCarryPress(state, p)) continue;
    interact(state, p, now);
  }
}
