import type { DeepReadonly } from "../core/scene";
import type { GameState } from "../core/state";
import type { Bus } from "./engineer/bus";

/** the engineer has asked to cut the engine and the pilot hasn't answered yet (S4-08) */
export function engineOffPending(state: DeepReadonly<GameState> | GameState): boolean {
  return !!(state.flight.bus as Bus | undefined)?.engineOffAsked;
}

/**
 * what a player should see about a waiting engine-off request: "answer" at the Pilot station, "tab"
 * when they hold the Pilot role but are looking at another station, or null when it isn't theirs
 */
export function engineOffPrompt(state: DeepReadonly<GameState> | GameState, playerId: string): "answer" | "tab" | null {
  if (!engineOffPending(state)) return null;
  const p = state.players.find((x) => x.id === playerId);
  if (!p || !p.roles.includes("pilot")) return null;
  return p.station === "pilot" ? "answer" : "tab";
}
