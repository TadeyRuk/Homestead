import type { DeepReadonly } from "../../core/scene";
import { overloaded, type Bus } from "./bus";
import type { Welder } from "./weld";

/** the engineer's worst problem in a few words for seat 3's crew strip (S5-10), or null when steady */
export function engineerTrouble(bus: DeepReadonly<Bus>, weld: DeepReadonly<Welder>): string | null {
  if (bus.tripped > 0) return "Breaker tripped";
  if (weld.jobs.length > 0) return "Hull breach";
  if (overloaded(bus)) return "Bus overload";
  if (bus.engineOffAsked) return "Asking pilot";
  return null;
}
