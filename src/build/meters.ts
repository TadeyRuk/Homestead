import { findPart } from "../core/catalog";
import type { DeepReadonly } from "../core/scene";
import type { GameState, Slot } from "../core/state";
import { scanStats, uplinkRate } from "../missions/stats";

/**
 * Seat 3's meter math (S3-10): the six meters from the mounted parts, from proposal section 03.
 * Pure and derived from the slots, so every tab computes the same numbers from its snapshot and
 * GameState needs no extra field.
 */

export type Tone = "ok" | "warn" | "bad" | "info";

export interface Meter {
  /** 0..1 for the bar */
  fill: number;
  /** the number beside it */
  text: string;
  tone: Tone;
}

export interface Meters {
  mass: Meter & { mass: number; lift: number };
  power: Meter & { supply: number; draw: number };
  budget: Meter;
  data: Meter & { perScan: number; seconds: number };
  comms: Meter & { rate: number };
  time: Meter;
}

type Slots = Readonly<Record<Slot, string | null>>;

const SLOTS: Slot[] = ["propulsion", "power", "comms", "payload"];

/** the slots with one part swapped in, for the "if mounted" preview while carrying */
export function withPart(slots: Slots, part: string | null): Slots {
  const info = part ? findPart(part) : undefined;
  if (!info) return slots;
  return { ...slots, [info.slot]: info.id };
}

export function computeMeters(
  slots: Slots,
  opts: { credits: number; startCredits: number; secondsLeft: number; buildSeconds: number },
): Meters {
  const parts = SLOTS.map((s) => (slots[s] ? findPart(slots[s]!) : undefined));
  const mass = parts.reduce((a, p) => a + (p?.mass ?? 0), 0);
  const engine = slots.propulsion ? findPart(slots.propulsion) : undefined;
  const lift = engine?.lift ?? 0;
  const supply = parts.reduce((a, p) => a + Math.max(0, p?.power ?? 0), 0);
  const draw = parts.reduce((a, p) => a + Math.max(0, -(p?.power ?? 0)), 0);
  const scan = slots.payload ? scanStats(slots.payload) : null;
  const rate = slots.comms ? uplinkRate(slots.comms) : 0;
  const ratio = lift > 0 ? mass / lift : mass > 0 ? Infinity : 0;
  const load = supply > 0 ? draw / supply : draw > 0 ? Infinity : 0;

  return {
    mass: {
      mass,
      lift,
      fill: lift > 0 ? Math.min(1, ratio) : mass > 0 ? 1 : 0,
      text: lift > 0 ? `${mass} / ${lift} kg` : `${mass} kg, no engine`,
      tone: ratio > 1 ? "bad" : ratio > 0.85 ? "warn" : "ok",
    },
    power: {
      supply,
      draw,
      fill: Math.min(1, load),
      text: supply > 0 ? `${draw} / ${supply} W` : draw > 0 ? `${draw} W, no supply` : "-",
      tone: load > 1 ? "bad" : load > 0.85 ? "warn" : "ok",
    },
    budget: {
      fill: opts.startCredits > 0 ? opts.credits / opts.startCredits : 0,
      text: `${opts.credits} credits`,
      tone: "info",
    },
    data: {
      perScan: scan?.data ?? 0,
      seconds: scan?.seconds ?? 0,
      fill: scan ? Math.min(1, scan.data / 13) : 0,
      text: scan ? `${scan.data} units / ${scan.seconds} s scan` : "no payload",
      tone: scan ? "info" : "warn",
    },
    comms: {
      rate,
      fill: Math.min(1, rate / 6),
      text: rate > 0 ? `${rate} units/s uplink` : "no antenna",
      tone: rate > 0 ? "info" : "warn",
    },
    time: {
      fill: opts.buildSeconds > 0 ? Math.max(0, opts.secondsLeft) / opts.buildSeconds : 0,
      text: `${Math.max(0, Math.ceil(opts.secondsLeft))} s to build`,
      tone: opts.secondsLeft < 30 ? "warn" : "ok",
    },
  };
}

/** the meters for a state on the campus, optionally with a carried part previewed in its slot */
export function metersFor(state: DeepReadonly<GameState>, secondsLeft: number, buildSeconds: number, startCredits: number, carrying: string | null = null): Meters {
  return computeMeters(withPart(state.ship.slots, carrying), {
    credits: state.credits,
    startCredits,
    secondsLeft,
    buildSeconds,
  });
}
