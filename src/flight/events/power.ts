import type { DeepReadonly } from "../../core/scene";
import type { GameState } from "../../core/state";
import { partData } from "../../data/data";
import { activeEvents } from "./director";

/** share of a solar array's output a full-strength flare knocks out; an RTG doesn't care (S4-07) */
const FLARE_CUT = 0.6;

/** watts the mounted power part supplies right now: full, or less for a solar array during a flare */
export function busSupply(state: DeepReadonly<GameState> | GameState, now: number): number {
  const power = partData(state.ship.slots.power);
  if (!power || power.power <= 0) return 0;
  if (!power.solar) return power.power;
  const flare = activeEvents(state as GameState, now)
    .filter((e) => e.kind === "flare")
    .reduce((worst, e) => Math.max(worst, e.strength), 0);
  return Math.round(power.power * (1 - FLARE_CUT * flare));
}
