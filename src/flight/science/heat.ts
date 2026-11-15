import { findPart } from "../../core/catalog";
import type { Ship } from "../../core/state";
import type { HeatSource } from "./core";

/** what heats the energy core (S5-06): the payload and the power part each add their catalog heat */
export function heatFor(slots: Readonly<Ship["slots"]>): HeatSource {
  const payload = slots.payload ? findPart(slots.payload) : undefined;
  const power = slots.power ? findPart(slots.power) : undefined;
  const fromPayload = payload?.heat ?? 0;
  const fromPower = power?.heat ?? 0;
  // the report names the part that ran the core hot, so blame whichever adds more
  const part = fromPower > fromPayload ? slots.power : (slots.payload ?? slots.power);
  return { part: part ?? "core", heat: fromPayload + fromPower };
}
