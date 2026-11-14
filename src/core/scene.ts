import type { GameState, Phase } from "./state";

/** what a scene draws for; each screen follows only its own player */
export interface View {
  playerId: string;
}

// scenes draw state and may animate locally; only the host's step() changes GameState
export interface Scene {
  enter?(state: GameState): void;
  update?(state: GameState, dt: number): void;
  draw(ctx: CanvasRenderingContext2D, state: GameState, view: View): void;
  exit?(): void;
}

const stub = (label: string): Scene => ({
  draw(ctx, state) {
    ctx.fillStyle = "#8a93a6";
    ctx.font = "14px sans-serif";
    ctx.fillText(`${label} (stub)`, 16, 28);
    for (const p of state.players) {
      ctx.fillStyle = "#e8b04b";
      ctx.fillRect(p.x - 8, p.y - 8, 16, 16);
      ctx.fillStyle = "#8a93a6";
      ctx.fillText(p.name, p.x - 8, p.y - 14);
    }
  },
});

const scenes: Record<Phase, Scene> = {
  lobby: { draw: () => {} }, // the lobby is the HTML form; the canvas stays empty behind it
  brief: stub("Brief"),
  campus: stub("Campus"),
  flight: stub("Flight"),
  surface: stub("Surface"),
  report: stub("Report"),
};

export function registerScene(phase: Phase, scene: Scene): void {
  scenes[phase] = scene;
}

export function sceneFor(phase: Phase): Scene {
  return scenes[phase];
}

// the host's step() changes the phase; each tab calls this per frame so its scenes get exit and enter
export function followPhase(drawn: Phase, state: GameState): Phase {
  if (drawn === state.phase) return drawn;
  sceneFor(drawn).exit?.();
  sceneFor(state.phase).enter?.(state);
  return state.phase;
}
