import type { DeepReadonly } from "../core/scene";
import type { GameState } from "../core/state";
import type { Bus } from "./engineer/bus";

/** the engineer has asked to cut the engine and the pilot hasn't answered yet (S4-08) */
export function engineOffPending(state: DeepReadonly<GameState> | GameState): boolean {
  return !!(state.flight.bus as Bus | undefined)?.engineOffAsked;
}
