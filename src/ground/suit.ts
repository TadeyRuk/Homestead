import { partInfo, salvageFor } from "../core/catalog";
import { logEvent } from "../core/events";
import type { Input } from "../core/input";
import type { Point } from "../core/map";
import { placePart } from "../core/parts";
import type { GameState, MissionId, Player } from "../core/state";
import { groundFor } from "./world";

/** seconds a full suit's oxygen lasts out in the open with no hazard */
export const OXYGEN_SECONDS = 110;
/** seconds a full suit's power lasts out in the open with no hazard */
export const POWER_SECONDS = 95;
/** how close to the lander counts as "at the lander": recharge here, and uplink (S2-14) */
export const LANDER_REACH = 80;

/**
 * Watts of supply that refill a whole suit in one second. Small solar (300 W) refills in 20 s,
 * the RTG (450 W) in about 13 s, the large array (600 W) in 10 s, salvage (150 W) in 40 s.
 */
const WATTS_PER_FULL_SUIT_PER_S = 6000;

/**
 * Sunlight a solar array gets, against Earth's. Mars gets about 43% (NASA Mars facts); the Moon
 * is at Earth's distance from the Sun. An RTG ignores this.
 */
export const SUNLIGHT: Record<MissionId, number> = { moon: 1, mars: 0.43 };

// until the parts data says which parts are solar, go by the catalog's ids (small-solar, large-solar)
const isSolar = (part: string) => part.includes("solar");

/** fraction of a suit refilled per second at the lander, from the mounted power part */
export function rechargeRate(state: Pick<GameState, "mission" | "ship">): number {
  const part = state.ship.slots.power ?? salvageFor("power");
  const watts = Math.max(0, partInfo(part).power);
  const sun = isSolar(part) ? SUNLIGHT[state.mission] : 1;
  return (watts * sun) / WATTS_PER_FULL_SUIT_PER_S;
}

/** a multiplier on one player's drain this tick: seat 6's hazards return more than 1 inside a storm or flare */
export type DrainModifier = (state: GameState, p: Player) => number;
const modifiers: DrainModifier[] = [];

/** seat 6 (S6-10) registers its hazards here; with none registered, drain is the base rate */
export function registerDrainModifier(modifier: DrainModifier): void {
  modifiers.push(modifier);
}

export function drainFactor(state: GameState, p: Player): number {
  return modifiers.reduce((k, m) => k * Math.max(0, m(state, p)), 1);
}

export function atLander(p: Point): boolean {
  const lander = groundFor("surface").lander;
  return Math.hypot(p.x - lander.x, p.y - lander.y) <= LANDER_REACH;
}

/**
 * Out of oxygen or power: down until extraction, dropping whatever was carried where they fell.
 * Logs `player_down` with the player and the dropped part.
 */
export function goDown(state: GameState, p: Player, now: number): void {
  p.down = true;
  const dropped = p.carrying;
  if (dropped) placePart(state, dropped, p, "d");
  p.carrying = null;
  logEvent(state, "player_down", now, { player: p.id, ...(dropped ? { part: dropped } : {}) });
}

/** host rule for the surface: suits drain out in the open and refill at the lander */
export function suitRule(state: GameState, _inputs: Record<string, Input>, now: number, dt: number): void {
  if (state.phase !== "surface") return;
  const refill = rechargeRate(state) * dt;
  for (const p of state.players) {
    if (p.down) continue;
    if (atLander(p)) {
      p.oxygen = Math.min(1, p.oxygen + refill);
      p.power = Math.min(1, p.power + refill);
      continue;
    }
    const k = drainFactor(state, p);
    p.oxygen = Math.max(0, p.oxygen - (dt / OXYGEN_SECONDS) * k);
    p.power = Math.max(0, p.power - (dt / POWER_SECONDS) * k);
    if (p.oxygen === 0 || p.power === 0) goDown(state, p, now);
  }
}

/** every suit starts the surface full */
export function fillSuits(state: GameState): void {
  for (const p of state.players) {
    p.oxygen = 1;
    p.power = 1;
  }
}
