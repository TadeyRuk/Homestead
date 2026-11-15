import { liftOf, massOf } from "../../core/catalog";
import { logEvent } from "../../core/events";
import type { Input } from "../../core/input";
import { rng } from "../../core/rng";
import type { DeepReadonly } from "../../core/scene";
import type { GameState } from "../../core/state";
import { partData, type PartData } from "../../data/data";
import { openBreach, type Welder } from "../engineer/weld";
import { activeEvents } from "../events/director";
import { stationInput, stationPace } from "../stations";

/** the transfer speed band; 1 is the target */
export const SPEED_LOW = 0.9;
export const SPEED_HIGH = 1.1;
/** speed lost each second to coasting losses, so the pilot has to top it up */
export const SPEED_DECAY = 0.02;
/** speed a full thrust or brake adds or takes each second */
export const ACCEL = 0.22;
/** fuel the automatic course correction burns each second the ship is below the band */
export const CORRECTION_BURN = 0.0025;
/** the fuel warning line */
export const FUEL_LOW = 0.25;
/** debris per second in a full-strength field */
export const DEBRIS_RATE = 2.4;
/** seconds a rock takes from the top of the pilot's view to the ship at transfer speed */
export const ROCK_TRAVEL = 2.4;
/** the ship sits this far down the view, 0 top to 1 bottom */
export const SHIP_Y = 0.9;
/** half the ship's width, in lanes (the lane runs -1..1), before a big array widens it */
export const SHIP_HALF = 0.08;
/** a hit this hard or harder opens a breach for the engineer to weld */
export const BREACH_AT = 0.06;
/** a station nobody watches lets the ship take hits; this softens them for solo crews */
const UNWATCHED_DAMAGE = 0.4;
/** how hard a solid motor's pulse kicks the ship sideways, in lanes */
const PULSE_KICK = 0.32;
const PULSE_GAP = 0.38;
// its own stream, so debris never shares numbers with spawns, the kiosk or the director
const PILOT_STREAM = 0x70696c74;

export interface Rock {
  id: number;
  /** lane position, -1..1 */
  x: number;
  /** 0 at the top of the view, 1 at the bottom */
  y: number;
  /** radius in lanes */
  r: number;
  /** strength of the field it came from, 0..1 */
  s: number;
}

/** plain data in state.flight.pilot, so joiners draw it from snapshots */
export interface Pilot {
  /** lane position, -1..1 */
  x: number;
  /** lanes per second */
  vx: number;
  /** against the transfer target, 1 = on target */
  speed: number;
  rocks: Rock[];
  spawned: number;
  /** debris per second still owed, so spawning is smooth at any tick rate */
  owed: number;
  /** seconds until a solid motor can pulse again */
  pulse: number;
  /** hull by section: port, core, starboard; 0..1 each */
  sections: [number, number, number];
  /** last thrust input, -1 brake .. 1 thrust, for the flame */
  thrust: number;
  hits: number;
  fuelWarned: boolean;
}

export function createPilot(): Pilot {
  return { x: 0, vx: 0, speed: 1, rocks: [], spawned: 0, owed: 0, pulse: 0, sections: [1, 1, 1], thrust: 0, hits: 0, fuelWarned: false };
}

const FALLBACK_ENGINE = "salvage-motor";

/** the mounted engine's handling, with salvage handling for an empty slot */
export function engineOf(state: DeepReadonly<GameState> | GameState): PartData {
  return partData(state.ship.slots.propulsion) ?? partData(FALLBACK_ENGINE)!;
}

/**
 * How much the ship's weight hurts handling: 1 well under the engine's lift, rising past 70% of it,
 * so "near the limit, the ship turns slowly and burns more fuel" (proposal section 03).
 */
export function heaviness(state: DeepReadonly<GameState> | GameState): number {
  const lift = liftOf(state.ship.slots) || 1;
  const ratio = massOf(state.ship.slots) / lift;
  return 1 + Math.max(0, ratio - 0.7) * 2;
}

/** half the ship's width to debris: a large solar array is a bigger target */
export function shipHalf(state: DeepReadonly<GameState> | GameState): number {
  return SHIP_HALF * (partData(state.ship.slots.power)?.target ?? 1);
}

/** the part to blame for a hit: a big array that made the ship wider, otherwise the engine that steered it */
function hitBlame(state: GameState): string | undefined {
  const power = partData(state.ship.slots.power);
  if (power && (power.target ?? 1) > 1) return power.id;
  return state.ship.slots.propulsion ?? undefined;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** one tick of the pilot's station (S4-02, S4-03); host only */
export function pilotRule(state: GameState, inputs: Record<string, Input>, now: number, dt: number): void {
  const p = ((state.flight.pilot as Pilot | undefined) ??= createPilot());
  const input = stationInput(state, inputs, "pilot");
  const pace = stationPace(state, "pilot");
  const watched = pace >= 1;
  const engine = engineOf(state);
  const heavy = heaviness(state);
  const burn = (engine.burn ?? 0.006) * heavy;
  const turn = (engine.turn ?? 1) / heavy;

  // steering: the engine decides how the ship answers the stick
  if (engine.steer === "pulse") {
    p.pulse = Math.max(0, p.pulse - dt);
    if (input.dx !== 0 && p.pulse === 0) {
      p.vx = (input.dx * PULSE_KICK) / heavy / 0.12; // the kick plays out over about 0.12 s
      p.pulse = PULSE_GAP;
      state.ship.fuel = Math.max(0, state.ship.fuel - burn * 0.25);
    }
    p.vx *= Math.max(0, 1 - dt / 0.12);
  } else {
    const response = engine.steer === "slow" ? 2.5 : 9;
    p.vx += (input.dx * turn - p.vx) * Math.min(1, response * dt);
    if (input.dx !== 0) state.ship.fuel = Math.max(0, state.ship.fuel - burn * 0.3 * dt);
  }
  p.x = clamp(p.x + p.vx * dt, -1, 1);
  if (Math.abs(p.x) === 1) p.vx = 0;

  // speed: W thrusts, S brakes, both burn; coasting slowly bleeds speed
  p.thrust = -input.dy;
  if (input.dy !== 0) {
    p.speed += -input.dy * (ACCEL / heavy) * dt;
    state.ship.fuel = Math.max(0, state.ship.fuel - burn * dt);
  }
  // an unwatched station drifts gently (seat 1's stationPace), so a solo crew can leave it a while
  p.speed = clamp(p.speed - SPEED_DECAY * pace * dt, 0.5, 1.5);
  // below the band, the flight computer burns to stay on the transfer, which costs fuel
  if (p.speed < SPEED_LOW) state.ship.fuel = Math.max(0, state.ship.fuel - CORRECTION_BURN * pace * dt);

  if (state.ship.fuel < FUEL_LOW && !p.fuelWarned) {
    p.fuelWarned = true;
    logEvent(state, "fuel_low", now, { part: engine.id, value: state.ship.fuel });
  }

  // debris: fields come from seat 1's event director; each rock's place comes from the seed
  const fields = activeEvents(state, now).filter((e) => e.kind === "debris");
  for (const f of fields) p.owed += DEBRIS_RATE * (0.5 + f.strength) * dt;
  if (fields.length === 0) p.owed = 0;
  while (p.owed >= 1) {
    p.owed -= 1;
    const r = rng((state.seed ^ PILOT_STREAM) + p.spawned);
    const s = fields[0]?.strength ?? 0.5;
    p.rocks.push({ id: p.spawned, x: r.next() * 2 - 1, y: 0, r: 0.04 + r.next() * 0.06, s });
    p.spawned += 1;
  }

  const half = shipHalf(state);
  const fall = (p.speed / ROCK_TRAVEL) * dt;
  const kept: Rock[] = [];
  for (const rock of p.rocks) {
    const before = rock.y;
    rock.y += fall;
    const crossing = before < SHIP_Y && rock.y >= SHIP_Y - 0.04;
    if (crossing && Math.abs(rock.x - p.x) < rock.r + half) {
      hit(state, p, rock, watched, now);
      continue;
    }
    if (rock.y < 1.1) kept.push(rock);
  }
  p.rocks = kept;

  // the crew strip shows what the pilot is dealing with
  if (fields.length > 0) state.trouble.pilot = "Debris field";
  else if (state.ship.fuel < FUEL_LOW) state.trouble.pilot = "Fuel low";
  else if (p.speed < SPEED_LOW) state.trouble.pilot = "Too slow";
  else if (p.speed > SPEED_HIGH) state.trouble.pilot = "Too fast";
  else delete state.trouble.pilot;
}

function hit(state: GameState, p: Pilot, rock: Rock, watched: boolean, now: number): void {
  // faster ships hit harder; an unwatched station takes softer hits so a solo crew can cope
  const damage = (0.035 + rock.r * 0.6) * (0.6 + rock.s * 0.6) * Math.max(1, p.speed) * (watched ? 1 : UNWATCHED_DAMAGE);
  const section = rock.x < p.x - 0.03 ? 0 : rock.x > p.x + 0.03 ? 2 : 1;
  p.sections[section] = Math.max(0, p.sections[section] - damage * 3);
  state.ship.hull = Math.max(0, state.ship.hull - damage);
  p.hits += 1;
  const part = hitBlame(state);
  logEvent(state, "debris_hit", now, { part, value: damage });
  if (damage >= BREACH_AT) {
    logEvent(state, "hull_breach", now, { part, value: damage });
    // seat 5's weld picks the breach up when its welder is running
    const welder = state.flight.weld as Welder | undefined;
    if (welder && Array.isArray(welder.jobs)) openBreach(welder, damage, part);
  }
}
