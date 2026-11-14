import type { Input } from "./input";
import { enterPhase, nextPhase } from "./phases";
import type { GameState, Phase } from "./state";
import { isUp } from "./timer";

/** pixels per second */
export const PLAYER_SPEED = 180;

/** a seat's game rule; runs on the host only, every tick of its phase */
export type Rule = (state: GameState, inputs: Record<string, Input>, now: number, dt: number) => void;

const rules: Partial<Record<Phase, Rule[]>> = {};

// seats call this at startup from their own folder, so nobody has to edit step.ts
export function registerRule(phase: Phase, rule: Rule): void {
  (rules[phase] ??= []).push(rule);
}

// runs only on the host each tick; seat rules run here, so every tab sees one result
export function step(state: GameState, inputs: Record<string, Input>, now: number, dt: number): void {
  // players walk only on a map; in flight WASD belongs to the stations, and the lobby waits for Start
  if (state.phase === "campus" || state.phase === "surface") movePlayers(state, inputs, dt);
  const phase = state.phase;
  for (const rule of rules[phase] ?? []) {
    rule(state, inputs, now, dt);
    // a rule that ends the phase (liftoff, extraction) means the rest of that phase's rules no longer apply
    if (state.phase !== phase) return;
  }
  if (isUp(state, now)) enterPhase(state, nextPhase(state.phase), now);
}

function movePlayers(state: GameState, inputs: Record<string, Input>, dt: number): void {
  for (const p of state.players) {
    const input = inputs[p.id];
    if (!input || p.down) continue;
    p.x += input.dx * PLAYER_SPEED * dt;
    p.y += input.dy * PLAYER_SPEED * dt;
  }
}
