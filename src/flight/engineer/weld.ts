import type { EventKind } from "../../core/events";
import type { Input } from "../../core/input";
import { rng } from "../../core/rng";
import type { DeepReadonly } from "../../core/scene";
import type { GameEvent, Ship } from "../../core/state";

/** cabin oxygen lost each second a breach stays open */
export const LEAK_PER_SECOND = 0.01;
/** sealant burned each second the torch is off the line; a full can lasts four seconds of sloppiness */
export const WASTE_PER_SECOND = 0.25;
/** panel widths the torch moves each second a key is held */
export const TORCH_SPEED = 0.5;
/** how close, in panel widths, the torch has to be to count as on the crack */
export const TOLERANCE = 0.05;
const CRACK_POINTS = 6;
// a separate stream for cracks, so they never share numbers with spawns, the kiosk or the bus
const CRACK_STREAM = 0x77656c64;

/** a spot on the weld panel, 0..1 across and down */
export interface Point {
  x: number;
  y: number;
}

export interface WeldJob {
  /** the crack to trace, in order */
  crack: Point[];
  /** the next crack point to reach; everything before it is sealed */
  next: number;
  /** 0..1; a clean weld keeps it high and restores more hull */
  sealant: number;
  /** hull the breach took, given back by a clean weld */
  damage: number;
  /** what caused the breach, carried to breach_sealed for the report */
  part?: string;
}

/** plain data, so it can ride in GameState snapshots */
export interface Welder {
  seed: number;
  torch: Point;
  /** open breaches, oldest first; the engineer works on the first */
  jobs: WeldJob[];
  /** breaches opened so far; picks each crack from the seeded stream */
  opened: number;
}

export type Emit = (kind: EventKind, fields: Pick<GameEvent, "part" | "value">) => void;

export function createWelder(seed: number): Welder {
  return { seed, torch: { x: 0.5, y: 0.9 }, jobs: [], opened: 0 };
}

/** queues a weld for a hull breach; seat 4's pilot calls this when it logs hull_breach */
export function openBreach(w: Welder, damage: number, part?: string): void {
  const r = rng((w.seed ^ CRACK_STREAM) + w.opened);
  w.opened += 1;
  // left to right across the panel, wandering up and down
  const crack = Array.from({ length: CRACK_POINTS }, (_, i) => ({
    x: 0.15 + (0.7 * i) / (CRACK_POINTS - 1),
    y: 0.3 + 0.4 * r.next(),
  }));
  w.jobs.push({ crack, next: 0, sealant: 1, damage, part });
}

/** one tick of the weld; input is the engineer's, or still when nobody is at the station */
export function stepWeld(w: Welder, ship: Pick<Ship, "hull" | "cabinOxygen">, input: Input, dt: number, emit: Emit): void {
  const job = w.jobs[0];
  // small steps, so a long tick from a throttled background host can't carry the torch over a crack point
  const steps = Math.max(1, Math.ceil((TORCH_SPEED * dt) / TOLERANCE));
  for (let i = 0; i < steps; i++) {
    w.torch.x = clamp(w.torch.x + (input.dx * TORCH_SPEED * dt) / steps);
    w.torch.y = clamp(w.torch.y + (input.dy * TORCH_SPEED * dt) / steps);
    if (job) weldAt(job, w.torch, dt / steps);
  }
  if (!job) return;

  ship.cabinOxygen = clamp(ship.cabinOxygen - LEAK_PER_SECOND * dt);
  if (job.next < job.crack.length) return;
  // a clean weld gives back all the breach took, an empty can only half
  const restored = job.damage * (0.5 + 0.5 * job.sealant);
  ship.hull = clamp(ship.hull + restored);
  emit("breach_sealed", { part: job.part, value: restored });
  w.jobs.shift();
}

/**
 * The bus and the weld share W, S and E, so only one of them hears the engineer at a time:
 * an open breach takes the keys, and the bus keeps running on its own meanwhile.
 */
export function routeEngineer(w: DeepReadonly<Welder>, input: Input): { bus: Input; weld: Input } {
  return w.jobs.length > 0 ? { bus: STILL, weld: input } : { bus: input, weld: STILL };
}

const STILL: Input = { dx: 0, dy: 0, interact: false, panel: false, switch: false };

function weldAt(job: WeldJob, torch: Point, dt: number): void {
  if (job.next >= job.crack.length) return;
  if (dist(torch, job.crack[job.next]) <= TOLERANCE) job.next += 1;
  else if (job.next > 0 && toSegment(torch, job.crack[job.next - 1], job.crack[job.next]) > TOLERANCE) {
    // once the weld has started, every moment off the line burns sealant
    job.sealant = clamp(job.sealant - WASTE_PER_SECOND * dt);
  }
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// distance from p to the segment a..b
function toSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function clamp(v: number): number {
  return Math.min(1, Math.max(0, v));
}
