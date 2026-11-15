import { findPart } from "../../core/catalog";
import type { Ship } from "../../core/state";
import type { HeatSource } from "./core";

/**
 * What heats the energy core (S5-06): the payload and the power part each add their catalog heat.
 * payloadOn is false while the payload is off the bus (shed or breaker tripped), which stops its heat (S5-07).
 */
export function heatFor(slots: Readonly<Ship["slots"]>, payloadOn = true): HeatSource {
  const payload = slots.payload ? findPart(slots.payload) : undefined;
  const power = slots.power ? findPart(slots.power) : undefined;
  const fromPayload = payloadOn ? (payload?.heat ?? 0) : 0;
  const fromPower = power?.heat ?? 0;
  // the report names the part that ran the core hot, so blame whichever adds more, and never a part
  // that adds nothing
  const part = fromPower > fromPayload ? slots.power : (slots.payload ?? (fromPower > 0 ? slots.power : null));
  return { part: part ?? "core", heat: fromPayload + fromPower };
}
