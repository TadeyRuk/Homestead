import type { EventKind } from "../../core/events";
import type { Input } from "../../core/input";
import type { GameEvent, Ship } from "../../core/state";

/** the core's safe band; under it the ship loses power (S5-07), over it the instrument takes damage */
export const SAFE_LOW = 0.3;
export const SAFE_HIGH = 0.7;
/** core temperature a fully open coolant valve takes away each second */
export const COOLING_PER_SECOND = 0.05;
/** how far the valve moves each second a key is held; shut to open in a little over a second */
export const VALVE_PER_SECOND = 0.8;
/** instrument health lost each second the core runs over the band */
export const DAMAGE_PER_SECOND = 0.05;

/** what heats the core; S5-06 builds this from the payload and power parts in parts.json */
export interface HeatSource {
  /** the part blamed in the log, usually the payload */
  part: string;
  /** core temperature added each second */
  heat: number;
}

/** plain data, so it can ride in GameState snapshots */
export interface Core extends HeatSource {
  /** 0 shut .. 1 fully open */
  valve: number;
  /** already over the band, so core_overheated logs once per climb */
  hot: boolean;
  /** already under the band, so core_too_cold logs once per drop */
  cold: boolean;
}

export type Emit = (kind: EventKind, fields: Pick<GameEvent, "part" | "value">) => void;

export function createCore(source: HeatSource): Core {
  return { part: source.part, heat: source.heat, valve: 0, hot: false, cold: false };
}

/** one tick of the core; input is the science officer's, or still when nobody is at the station */
export function stepCore(
  core: Core,
  ship: Pick<Ship, "coreTemp" | "instrumentHealth">,
  input: Input,
  dt: number,
  emit: Emit,
): void {
  // up opens the valve, down closes it; it stays where it is when let go
  core.valve = clamp(core.valve - input.dy * VALVE_PER_SECOND * dt);
  ship.coreTemp = clamp(ship.coreTemp + (core.heat - core.valve * COOLING_PER_SECOND) * dt);

  const hot = ship.coreTemp > SAFE_HIGH;
  const cold = ship.coreTemp < SAFE_LOW;
  if (hot) ship.instrumentHealth = clamp(ship.instrumentHealth - DAMAGE_PER_SECOND * dt);
  if (hot && !core.hot) emit("core_overheated", { part: core.part, value: ship.coreTemp });
  if (cold && !core.cold) emit("core_too_cold", { part: core.part, value: ship.coreTemp });
  core.hot = hot;
  core.cold = cold;
}

function clamp(v: number): number {
  return Math.min(1, Math.max(0, v));
}
