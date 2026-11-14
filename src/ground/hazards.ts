import { logEvent } from "../core/events";
import type { Input } from "../core/input";
import type { Point } from "../core/map";
import { PHASE_SECONDS } from "../core/phases";
import { rng } from "../core/rng";
import type { GameState, Player } from "../core/state";
import { timeLeft } from "../core/timer";
import type { Rect } from "./geom";
import { atLander } from "./suit";
import { ROCKS, SURFACE } from "./surface";

/** how much faster a suit drains while caught in a storm or an active flare */
export const HAZARD_DRAIN = 4;

/** Mars: the storm wall's width and speed; it crosses the whole map in about 40 s */
export const STORM_WIDTH = 700;
export const STORM_SPEED = 95;

/** Moon: seconds of warning before a flare, then seconds of radiation on open ground */
export const FLARE_WARNING_S = 8;
export const FLARE_ACTIVE_S = 15;
/** how close to a boulder counts as sheltering behind it during a flare */
export const COVER_REACH = 40;

/** hazards start between these many seconds left in the surface, so there is time to see them coming */
const EARLIEST_LEFT = 150;
const LATEST_LEFT = 100;

// a separate stream, so hazards never share numbers with spawns, the kiosk or the flight minigames
const HAZARD_STREAM = 0x68617a64;

/** what is happening on the surface right now; derived from the run, so every tab agrees without new state */
export type Hazard =
  /** a wall of dust moving across the map; inside [left, right] counts as in the storm */
  | { kind: "storm"; left: number; right: number; dir: 1 | -1 }
  /** a solar flare: a warning first, then radiation on open ground */
  | { kind: "flare"; stage: "warning" | "active"; secondsToGo: number };

interface Plan {
  /** seconds left in the surface when the hazard starts */
  startLeft: number;
  dir: 1 | -1;
}

function plan(state: Pick<GameState, "seed">): Plan {
  const r = rng(state.seed ^ HAZARD_STREAM);
  const startLeft = LATEST_LEFT + r.next() * (EARLIEST_LEFT - LATEST_LEFT);
  return { startLeft, dir: r.next() < 0.5 ? 1 : -1 };
}

/** seconds since the hazard started, or null before it starts and outside the surface */
function elapsed(state: Pick<GameState, "seed" | "phase" | "phaseEndsAt">, now: number): { s: number; plan: Plan } | null {
  if (state.phase !== "surface" || state.phaseEndsAt === null) return null;
  const p = plan(state);
  const left = Math.min(timeLeft(state, now), PHASE_SECONDS.surface);
  const s = p.startLeft - left;
  return s >= 0 ? { s, plan: p } : null;
}

/** the hazard at `now`, or null when the surface is calm */
export function hazardAt(state: Pick<GameState, "seed" | "mission" | "phase" | "phaseEndsAt">, now: number): Hazard | null {
  const at = elapsed(state, now);
  if (!at) return null;
  if (state.mission === "mars") {
    const travelled = at.s * STORM_SPEED;
    if (travelled > SURFACE.width + STORM_WIDTH) return null;
    // the front enters from one edge and the trailing edge leaves by the other
    const front = at.plan.dir === 1 ? travelled : SURFACE.width - travelled;
    const left = at.plan.dir === 1 ? front - STORM_WIDTH : front;
    return { kind: "storm", left, right: left + STORM_WIDTH, dir: at.plan.dir };
  }
  if (at.s < FLARE_WARNING_S) return { kind: "flare", stage: "warning", secondsToGo: FLARE_WARNING_S - at.s };
  if (at.s < FLARE_WARNING_S + FLARE_ACTIVE_S) {
    return { kind: "flare", stage: "active", secondsToGo: FLARE_WARNING_S + FLARE_ACTIVE_S - at.s };
  }
  return null;
}

function distanceToRect(p: Point, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

export function behindRock(p: Point, rocks: readonly Rect[] = ROCKS): boolean {
  return rocks.some((r) => distanceToRect(p, r) <= COVER_REACH);
}

/** is this player hurt by the hazard? The lander is always safe; a flare also spares anyone by a rock */
export function caughtBy(hazard: Hazard | null, p: Player): boolean {
  if (!hazard || p.down || atLander(p)) return false;
  if (hazard.kind === "storm") return p.x >= hazard.left && p.x <= hazard.right;
  return hazard.stage === "active" && !behindRock(p);
}

// host only: the latest tick's hazard, for the drain modifier, which is not given the time
let latest: { run: number; hazard: Hazard | null } | null = null;
// host only: who was caught last tick, so hazard_hit is logged once per time caught, not every tick
const caught = new Set<string>();

/**
 * Host rule for the surface: works out the hazard and logs `hazard_hit` when a player gets caught.
 * Seat 2's suit rule runs earlier in the tick, so the drain follows the hazard one tick (about 16 ms) behind.
 */
export function hazardRule(state: GameState, _inputs: Record<string, Input>, now: number): void {
  if (latest?.run !== state.runStartedAt) caught.clear();
  const hazard = hazardAt(state, now);
  latest = { run: state.runStartedAt, hazard };
  for (const p of state.players) {
    const key = `${state.runStartedAt}:${p.id}`;
    if (!caughtBy(hazard, p)) {
      caught.delete(key);
      continue;
    }
    if (caught.has(key)) continue;
    caught.add(key);
    logEvent(state, "hazard_hit", now, { player: p.id, value: HAZARD_DRAIN });
  }
}

/** for seat 2's suit drain (registerDrainModifier): faster drain while caught */
export function hazardDrain(state: GameState, p: Player): number {
  if (state.phase !== "surface" || latest?.run !== state.runStartedAt) return 1;
  return caughtBy(latest.hazard, p) ? HAZARD_DRAIN : 1;
}

/** a short line for the HUD while a hazard is coming or happening, or null when calm */
export function hazardBanner(hazard: Hazard | null): string | null {
  if (!hazard) return null;
  if (hazard.kind === "storm") return "Dust storm crossing the map. Get to the lander.";
  const s = Math.ceil(hazard.secondsToGo);
  return hazard.stage === "warning"
    ? `Solar flare in ${s} s. Get to the lander or behind a rock.`
    : `Solar flare: ${s} s left. Stay at the lander or behind a rock.`;
}

/**
 * Draws the hazard in world coordinates, so call it inside the camera transform, after the players.
 * The storm is a thick dust wall that hides what is inside it; an active flare tints the open ground.
 */
export function drawHazard(ctx: CanvasRenderingContext2D, hazard: Hazard | null): void {
  if (!hazard) return;
  ctx.save();
  if (hazard.kind === "storm") {
    ctx.fillStyle = "rgba(198, 132, 88, 0.82)";
    ctx.fillRect(hazard.left, 0, hazard.right - hazard.left, SURFACE.height);
  } else if (hazard.stage === "active") {
    ctx.fillStyle = "rgba(255, 240, 160, 0.18)";
    ctx.fillRect(0, 0, SURFACE.width, SURFACE.height);
  }
  ctx.restore();
}
