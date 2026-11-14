import type { EventKind } from "./events";

export type Phase = "lobby" | "brief" | "campus" | "flight" | "surface" | "report";
export type Role = "pilot" | "engineer" | "comms" | "science";
export type Slot = "propulsion" | "power" | "comms" | "payload";
export type MissionId = "moon" | "mars";

export interface Player {
  id: string;
  name: string;
  /** solo holds all four */
  roles: Role[];
  x: number;
  y: number;
  /** part id */
  carrying: string | null;
  /** suit, 0..1, surface phase */
  oxygen: number;
  /** suit, 0..1, surface phase */
  power: number;
  down: boolean;
}

export interface Ship {
  /** part ids */
  slots: Record<Slot, string | null>;
  salvaged: Slot[];
  /** 0..1 */
  fuel: number;
  /** 0..1 */
  hull: number;
  /** 0..1 */
  cabinOxygen: number;
  /** 0..1, safe band set in data */
  coreTemp: number;
  /** 0..1 */
  instrumentHealth: number;
  linkLocked: boolean;
}

export interface GameEvent {
  /** seconds since run start */
  t: number;
  phase: Phase;
  kind: EventKind;
  /** the part that caused it, if any */
  part?: string;
  player?: string;
  value?: number;
}

export interface GameState {
  seed: number;
  mission: MissionId;
  phase: Phase;
  /** ms timestamp on the host clock; null when the phase has no deadline (the lobby) */
  phaseEndsAt: number | null;
  /** ms timestamp on the host clock */
  runStartedAt: number;
  credits: number;
  players: Player[];
  ship: Ship;
  data: { collected: number; uplinked: number; target: number };
  objectives: Record<string, boolean>;
  log: GameEvent[];
}

// credits and data target stay 0 until seat 3's missions.json fills them at the brief
export function createState(seed: number, mission: MissionId): GameState {
  return {
    seed,
    mission,
    phase: "lobby",
    phaseEndsAt: null, // the lobby waits for Start, not a timer
    runStartedAt: 0,
    credits: 0,
    players: [],
    ship: {
      slots: { propulsion: null, power: null, comms: null, payload: null },
      salvaged: [],
      fuel: 1,
      hull: 1,
      cabinOxygen: 1,
      coreTemp: 0.5,
      instrumentHealth: 1,
      linkLocked: false,
    },
    data: { collected: 0, uplinked: 0, target: 0 },
    objectives: {},
    log: [],
  };
}
