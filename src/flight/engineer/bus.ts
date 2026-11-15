import type { EventKind } from "../../core/events";
import type { Input } from "../../core/input";
import { rng } from "../../core/rng";
import type { DeepReadonly } from "../../core/scene";
import type { GameEvent, Slot } from "../../core/state";

/** cabin fans, lights and life support; always on, so even a light build has something on the bus */
export const BASE_WATTS = 60;
/** each load's draw moves this far either side of its rating, once a second */
export const SWING = 0.25;
/** seconds over supply before the breaker trips, matching the proposal's "four seconds from tripping" */
export const TRIP_SECONDS = 4;
/** seconds a tripped breaker leaves the bus dead */
export const RESET_SECONDS = 3;

// a separate stream for bus demand, so it never shares numbers with spawns or the kiosk
const BUS_STREAM = 0x62757321;

/** a part the bus feeds; watts come from parts.json (S5-06), never from station code */
export interface LoadPart {
  id: string;
  slot: Slot;
  watts: number;
}

export interface Load extends LoadPart {
  on: boolean;
}

/** plain data, so it can ride in GameState snapshots */
export interface Bus {
  seed: number;
  /** the power part feeding the bus */
  source: string;
  /** watts the power part supplies; seat 1's flare rule (S4-07) may lower it every tick */
  supply: number;
  /** 0..1 share of supply the bus can use; a cold energy core cuts it (S5-07), independent of flares */
  supplyScale: number;
  loads: Load[];
  /** 0..1; fills while the draw is over supply, trips the breaker at 1 */
  strain: number;
  /** seconds until a tripped breaker resets; 0 while it is closed */
  tripped: number;
  /** the load the engineer has selected */
  cursor: number;
  /** the engineer asked to shed the engine and the pilot hasn't answered (S4-08) */
  engineOffAsked: boolean;
  /** last held dy, so holding a key moves the cursor once */
  heldDy: number;
  /** seconds the bus has run; picks each second's demand */
  t: number;
}

export type Emit = (kind: EventKind, fields: Pick<GameEvent, "part" | "value">) => void;

export function createBus(seed: number, power: { id: string; watts: number }, parts: readonly LoadPart[]): Bus {
  return {
    seed,
    source: power.id,
    supply: power.watts,
    supplyScale: 1,
    loads: parts.map((p) => ({ ...p, on: true })),
    strain: 0,
    tripped: 0,
    cursor: 0,
    engineOffAsked: false,
    heldDy: 0,
    t: 0,
  };
}

/** watts on the bus right now; 0 while the breaker is open */
export function draw(bus: DeepReadonly<Bus>): number {
  if (bus.tripped > 0) return 0;
  const second = Math.floor(bus.t);
  let watts = BASE_WATTS;
  bus.loads.forEach((load, i) => {
    if (!load.on) return;
    // seeded by second and load, so every tab and every replay of a seed sees the same demand
    const r = rng((bus.seed ^ BUS_STREAM) + second * 31 + i).next();
    watts += load.watts * (1 + SWING * (2 * r - 1));
  });
  return watts;
}

/** whether the part in this slot has power; other seats read this (engine thrust, dish link, payload) */
export function powered(bus: DeepReadonly<Bus>, slot: Slot): boolean {
  return bus.tripped === 0 && bus.loads.some((l) => l.slot === slot && l.on);
}

/** watts the bus can actually use right now */
export function effectiveSupply(bus: DeepReadonly<Bus>): number {
  return bus.supply * bus.supplyScale;
}

/** the draw is over supply right now; strain can still be easing off after it drops back */
export function overloaded(bus: DeepReadonly<Bus>): boolean {
  return draw(bus) > effectiveSupply(bus);
}

export function secondsToTrip(bus: DeepReadonly<Bus>): number {
  return (1 - bus.strain) * TRIP_SECONDS;
}

/** the pilot's answer to an engine-off request; seat 4's handshake (S4-08) calls this */
export function answerEngineOff(bus: Bus, agree: boolean, emit: Emit): void {
  if (!bus.engineOffAsked) return;
  bus.engineOffAsked = false;
  const engine = bus.loads.find((l) => l.slot === "propulsion");
  if (agree && engine?.on) shed(engine, emit);
}

/**
 * One tick of the bus; input is the engineer's, or still when nobody is at the station.
 * pace is stationPace: 1 while someone is at the station, less while nobody watches, so strain builds slower.
 */
export function stepBus(bus: Bus, input: Input, dt: number, emit: Emit, pace = 1): void {
  steer(bus, input, emit);
  bus.t += dt;
  if (bus.tripped > 0) {
    bus.tripped = Math.max(0, bus.tripped - dt);
    return;
  }
  bus.strain = Math.min(1, Math.max(0, bus.strain + (overloaded(bus) ? dt * pace : -dt) / TRIP_SECONDS));
  if (bus.strain >= 1) {
    emit("breaker_tripped", { part: bus.source, value: Math.round(draw(bus)) });
    bus.strain = 0;
    bus.tripped = RESET_SECONDS;
  }
}

function steer(bus: Bus, input: Input, emit: Emit): void {
  if (input.dy !== 0 && input.dy !== bus.heldDy) {
    // max last, so a bus with no loads keeps the cursor at 0 rather than -1
    bus.cursor = Math.max(0, Math.min(bus.loads.length - 1, bus.cursor + input.dy));
  }
  bus.heldDy = input.dy;
  const load = bus.loads[bus.cursor];
  if (!input.interact || !load) return;
  if (!load.on) load.on = true;
  // the pilot has to agree before the engine goes dark (S4-08); once asked, the question stands until the
  // pilot answers with E or Q, so a solo player can Tab over and answer it
  else if (load.slot === "propulsion") bus.engineOffAsked = true;
  else shed(load, emit);
}

function shed(load: Load, emit: Emit): void {
  load.on = false;
  emit("load_shed", { part: load.id, value: load.watts });
}
