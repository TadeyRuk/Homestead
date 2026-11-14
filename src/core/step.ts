import type { Input } from "./input";
import { enterPhase, nextPhase } from "./phases";
import type { GameState } from "./state";
import { isUp } from "./timer";

/** pixels per second */
export const PLAYER_SPEED = 180;

// runs only on the host; the single place the run's state changes, so each seat's rules hook in here
export function step(state: GameState, inputs: Record<string, Input>, now: number, dt: number): void {
  // the crew gathers in the lobby; nobody walks until the run starts
  if (state.phase !== "lobby") movePlayers(state, inputs, dt);
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
