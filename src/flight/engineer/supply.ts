import { findPart } from "../../core/catalog";
import type { Ship, Slot } from "../../core/state";
import { createBus, type Bus, type LoadPart } from "./bus";

const LOAD_SLOTS: readonly Slot[] = ["propulsion", "comms", "payload"];

/** the power bus for the parts mounted on the campus (S5-06); every watt comes from the part catalog */
export function busFor(seed: number, slots: Readonly<Ship["slots"]>): Bus {
  const power = slots.power ? findPart(slots.power) : undefined;
  const loads: LoadPart[] = [];
  for (const slot of LOAD_SLOTS) {
    const id = slots[slot];
    const part = id ? findPart(id) : undefined;
    // power is signed, so a part that draws has a negative rating and puts -power on the bus
    if (part && part.power < 0) loads.push({ id: part.id, slot, watts: -part.power });
  }
  return createBus(seed, { id: power?.id ?? "none", watts: Math.max(0, power?.power ?? 0) }, loads);
}
