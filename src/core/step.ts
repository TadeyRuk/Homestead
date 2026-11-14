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
  // the crew gathers in the lobby; nobody walks until the run starts
  if (state.phase !== "lobby") movePlayers(state, inputs, dt);
  for (const rule of rules[state.phase] ?? []) rule(state, inputs, now, dt);
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
