import type { DeepReadonly, View } from "../core/scene";
import { sceneFor } from "../core/scene";
import type { GameState, Phase } from "../core/state";
import { PHASE_ORDER } from "../core/phases";

/**
 * Seat 3's HTML layer over the canvas (S3-02): one root sized to the canvas, with panels, meters
 * and buttons that need no new CSS. The HUD draws from the GameState each scene was handed.
 */

export type Frame = { state: DeepReadonly<GameState>; view: View };
type Listener = (frame: Frame | null) => void;

let root: HTMLElement | null = null;
let latest: Frame | null = null;
let seenAt = 0;
const listeners: Listener[] = [];

/** the overlay root, created on first use; null outside a browser (tests) */
export function overlay(): HTMLElement | null {
  if (root || typeof document === "undefined") return root;
  root = document.createElement("div");
  root.className = "hs-overlay";
  root.setAttribute("aria-live", "off");
  document.body.append(root);
  return root;
}

/** run fn every animation frame with the state the scene just drew, or null when no run is drawing */
export function onFrame(fn: Listener): void {
  listeners.push(fn);
}

/**
 * Records the state each phase's scene is handed. Scenes are wrapped after every *.register.ts file
 * has loaded (the first animation frame), so this works whichever seat registered the scene.
 */
function watchScenes(): void {
  for (const phase of PHASE_ORDER as readonly Phase[]) {
    const scene = sceneFor(phase);
    const draw = scene.draw.bind(scene);
    scene.draw = (ctx, state, view) => {
      draw(ctx, state, view);
      latest = { state, view };
      seenAt = performance.now();
    };
  }
}

/** the canvas seat 1 draws on */
export function gameCanvas(): HTMLCanvasElement | null {
  return typeof document === "undefined" ? null : document.querySelector<HTMLCanvasElement>("#game");
}

function fit(): void {
  const canvas = gameCanvas();
  const el = overlay();
  if (!canvas || !el) return;
  const r = canvas.getBoundingClientRect();
  el.style.left = `${r.left}px`;
  el.style.top = `${r.top}px`;
  el.style.width = `${r.width}px`;
  el.style.height = `${r.height}px`;
  // one grid unit of the 640 x 360 layout, in CSS pixels
  el.style.setProperty("--u", `${r.width / 640}px`);
}

function tick(): void {
  requestAnimationFrame(tick);
  fit();
  // the lobby draws no scene; a frame older than a moment means no run is on screen
  const frame = latest && performance.now() - seenAt < 250 ? latest : null;
  for (const fn of listeners) {
    try {
      fn(frame);
    } catch (e) {
      console.error("overlay listener failed", e);
    }
  }
}

export function startOverlay(): void {
  if (typeof window === "undefined" || typeof requestAnimationFrame === "undefined") return;
  overlay();
  requestAnimationFrame(() => {
    watchScenes();
    tick();
  });
}

/** a small DOM builder: el("div", "hs-panel", [children]) */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

/** a labelled meter bar; set(f, text, tone) updates it in place */
export function meter(label: string) {
  const fill = el("span", "hs-meter-fill");
  const value = el("span", "hs-meter-value");
  const node = el("div", "hs-meter", [el("span", "hs-meter-label", [label]), value, el("span", "hs-meter-track", [fill])]);
  return {
    node,
    set(f: number, text: string, tone: "ok" | "warn" | "bad" | "info" = "ok") {
      fill.style.width = `${Math.max(0, Math.min(1, f)) * 100}%`;
      if (value.textContent !== text) value.textContent = text;
      node.dataset.tone = tone;
    },
  };
}
