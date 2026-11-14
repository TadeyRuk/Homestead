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
  /** the flight station this player is looking at; one of their roles, or null outside flight */
  station: Role | null;
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

/** a part lying on the map; picking it up moves `part` into the player's `carrying` and removes it here */
export interface LoosePart {
  /** unique per piece, so two of the same part can lie on the map */
  id: string;
  /** the part id from src/data/parts.json */
  part: string;
  x: number;
  y: number;
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
  /** which objective, for `objective_done` */
  objective?: string;
}

/** one player's timed job on the surface: scanning a site, drilling the sample, deploying, photographing */
export interface SurfaceTask {
  kind: "scan" | "drill" | "deploy" | "photo";
  /** the site id, or the spot's name */
  target: string;
  /** 0..1 */
  progress: number;
}

/** the crew's progress on Mission Control's list (seat 2, S2-14); reset as the surface starts */
export interface SurfaceProgress {
  /** ids of the sites scanned so far */
  scanned: string[];
  /** data units each player carries, by player id; data only counts once uplinked at the lander */
  held: Record<string, number>;
  /** data units each player has sent in their current uplink at the lander, by player id */
  uplinking: Record<string, number>;
  /** what each player is doing right now, by player id; absent when nothing */
  tasks: Record<string, SurfaceTask>;
  sampleDrilled: boolean;
  deployed: boolean;
  /** index into the surface map's bonus spots, picked by the seed */
  bonusSpot: number;
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
  /** host-clock ms when the rocket lifts off; null while no countdown is running */
  launchAt: number | null;
  players: Player[];
  /** loose parts on the current map; cleared on every phase change */
  parts: LoosePart[];
  /** counter behind loose-part ids; use placePart in src/core/parts.ts, not this */
  partSeq: number;
  ship: Ship;
  data: { collected: number; uplinked: number; target: number };
  objectives: Record<string, boolean>;
  /** surface objective progress: scans, data in hand, tasks (seat 2) */
  surface: SurfaceProgress;
  /**
   * flight minigame state, one plain-data entry per minigame (for example `bus`, `weld`, `core`, `converter`);
   * written by host rules, so every tab gets it in snapshots
   */
  flight: Record<string, unknown>;
  /** each flight station's current problem in a few words, for the crew strip; absent when fine */
  trouble: Partial<Record<Role, string>>;
  log: GameEvent[];
}

// credits and data target stay 0 until startRun fills them from missionInfo
export function createState(seed: number, mission: MissionId): GameState {
  return {
    seed,
    mission,
    phase: "lobby",
    phaseEndsAt: null, // the lobby waits for Start, not a timer
    runStartedAt: 0,
    credits: 0,
    launchAt: null,
    players: [],
    parts: [],
    partSeq: 0,
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
    surface: { scanned: [], held: {}, uplinking: {}, tasks: {}, sampleDrilled: false, deployed: false, bonusSpot: 0 },
    flight: {},
    trouble: {},
    log: [],
  };
}
