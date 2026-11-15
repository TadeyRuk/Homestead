import type { DeepReadonly } from "../../core/scene";
import type { Ship } from "../../core/state";
import { LOW_OXYGEN, type Converter } from "./converter";
import { SAFE_HIGH, SAFE_LOW } from "./core";

/** the science officer's worst problem in a few words for seat 3's crew strip (S5-10), or null when steady */
export function scienceTrouble(
  converter: DeepReadonly<Converter>,
  ship: DeepReadonly<Pick<Ship, "cabinOxygen" | "coreTemp">>,
): string | null {
  // the crew dies of low air, so it outranks a hot instrument
  if (ship.cabinOxygen < LOW_OXYGEN) return "Oxygen low";
  if (converter.jammed > 0) return "Intake jammed";
  if (ship.coreTemp > SAFE_HIGH) return "Core hot";
  if (ship.coreTemp < SAFE_LOW) return "Core cold";
  return null;
}
