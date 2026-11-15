import { logEvent } from "../core/events";
import type { Input } from "../core/input";
import { nearest, type Point } from "../core/map";
import { placePart } from "../core/parts";
import { rng } from "../core/rng";
import type { GameState, Player, SurfaceTask } from "../core/state";
import { atLander } from "../ground/suit";
import { SURFACE } from "../ground/surface";
import { missionList, RICH_FACTOR, scanStats, TASK_SECONDS, uplinkRate } from "./stats";

/** the objective ids in state.objectives, in Mission Control's order */
export const OBJECTIVES = ["scan", "sample", "deploy", "uplink", "bonus"] as const;
export type ObjectiveId = (typeof OBJECTIVES)[number];

/** how close to a site or spot a player must stand to work it, and stay while the job runs */
export const TASK_REACH = 36;

const BONUS_STREAM = 0x0b0b05;

/** a fresh list as the surface starts: every flag false, the instrument waiting at the lander */
export function startSurface(state: GameState): void {
  state.surface = {
    scanned: [],
    held: {},
    uplinking: {},
    tasks: {},
    sampleDrilled: false,
    deployed: false,
    bonusSpot: rng(state.seed ^ BONUS_STREAM).int(SURFACE.bonusSpots.length),
  };
  state.objectives = Object.fromEntries(OBJECTIVES.map((id) => [id, false]));
  const lander = SURFACE.lander;
  placePart(state, missionList(state.mission).instrument, { x: lander.x + 60, y: lander.y - 48 }, "o"); // clear of the lander art, inside its ring
}

export function bonusSpot(state: { readonly surface: { readonly bonusSpot: number } }): Point {
  return SURFACE.bonusSpots[state.surface.bonusSpot] ?? SURFACE.bonusSpots[0];
}

function complete(state: GameState, id: ObjectiveId, now: number, player?: string): void {
  if (state.objectives[id]) return;
  state.objectives[id] = true;
  logEvent(state, "objective_done", now, { objective: id, ...(player ? { player } : {}) });
}

const richScanned = (state: GameState) =>
  SURFACE.sites.filter((s) => s.rich && state.surface.scanned.includes(s.id)).length;

/** the job a player standing here could start with E, or null */
export function jobHere(state: GameState, p: Player): SurfaceTask | null {
  if (state.phase !== "surface" || p.down) return null;
  const list = missionList(state.mission);
  const site = nearest(SURFACE.sites, p, TASK_REACH);
  if (site && !state.surface.scanned.includes(site.id)) return { kind: "scan", target: site.id, progress: 0 };
  if (!state.surface.sampleDrilled && !p.carrying && nearest([SURFACE.sampleSites[state.mission]], p, TASK_REACH)) {
    return { kind: "drill", target: list.sample, progress: 0 };
  }
  if (!state.surface.deployed && p.carrying === list.instrument && nearest([SURFACE.deploySpot], p, TASK_REACH)) {
    return { kind: "deploy", target: list.instrument, progress: 0 };
  }
  if (!state.objectives.bonus && nearest([bonusSpot(state)], p, TASK_REACH)) {
    return { kind: "photo", target: "bonus", progress: 0 };
  }
  return null;
}

/** where a running job has to be stood at */
function taskSpot(state: GameState, task: SurfaceTask): Point {
  if (task.kind === "scan") return SURFACE.sites.find((s) => s.id === task.target) ?? SURFACE.lander;
  if (task.kind === "drill") return SURFACE.sampleSites[state.mission];
  if (task.kind === "deploy") return SURFACE.deploySpot;
  return bonusSpot(state);
}

function taskSeconds(state: GameState, task: SurfaceTask): number {
  return task.kind === "scan" ? scanStats(state.ship.slots.payload).seconds : TASK_SECONDS[task.kind];
}

/**
 * E presses that belong to the list, not to carrying: starting a job, or any press while one runs.
 * Registered with carrying's registerPressClaim, so one press never does both.
 */
export function claimsPress(state: GameState, p: Player): boolean {
  return state.phase === "surface" && (!!state.surface.tasks[p.id] || jobHere(state, p) !== null);
}

function finish(state: GameState, p: Player, task: SurfaceTask, now: number): void {
  const list = missionList(state.mission);
  if (task.kind === "scan") {
    const site = SURFACE.sites.find((s) => s.id === task.target);
    if (!site || state.surface.scanned.includes(site.id)) return;
    const payload = state.ship.slots.payload;
    const data = Math.round(scanStats(payload).data * (site.rich ? RICH_FACTOR : 1) * state.ship.instrumentHealth);
    state.surface.scanned.push(site.id);
    state.surface.held[p.id] = (state.surface.held[p.id] ?? 0) + data;
    state.data.collected += data;
    logEvent(state, "site_scanned", now, { player: p.id, value: data, ...(payload ? { part: payload } : {}) });
    if (richScanned(state) >= list.scans) complete(state, "scan", now, p.id);
  } else if (task.kind === "drill") {
    state.surface.sampleDrilled = true;
    p.carrying = list.sample;
  } else if (task.kind === "deploy") {
    state.surface.deployed = true;
    p.carrying = null;
    complete(state, "deploy", now, p.id);
  } else {
    complete(state, "bonus", now, p.id);
  }
}

/** sends held data at the lander, at the antenna's rate; one `data_uplinked` per batch */
function uplink(state: GameState, p: Player, now: number, dt: number): void {
  const s = state.surface;
  const held = s.held[p.id] ?? 0;
  const sending = !p.down && held > 0 && atLander(p);
  if (sending) {
    const sent = Math.min(held, uplinkRate(state.ship.slots.comms) * dt);
    s.held[p.id] = held - sent;
    s.uplinking[p.id] = (s.uplinking[p.id] ?? 0) + sent;
    state.data.uplinked += sent;
    if (s.held[p.id] <= 1e-9) s.held[p.id] = 0;
  }
  // a batch ends when the player's data is all sent, or they walk away or go down mid-send
  if (s.uplinking[p.id] !== undefined && (!sending || s.held[p.id] === 0)) logBatch(state, p.id, now);
}

/** logs one player's open uplink batch as `data_uplinked` and closes it */
function logBatch(state: GameState, playerId: string, now: number): void {
  const batch = state.surface.uplinking[playerId];
  if (batch === undefined) return;
  const antenna = state.ship.slots.comms;
  logEvent(state, "data_uplinked", now, {
    player: playerId,
    value: Math.round(batch * 100) / 100,
    ...(antenna ? { part: antenna } : {}),
  });
  delete state.surface.uplinking[playerId];
}

/**
 * Logs every uplink still in progress. Extraction calls this as the surface ends, so data sent
 * in the last seconds is in the log and the logged batches add up to `data.uplinked`.
 */
export function flushUplinks(state: GameState, now: number): void {
  for (const playerId of Object.keys(state.surface.uplinking)) logBatch(state, playerId, now);
}

/** host rule for the surface: jobs at sites and spots, the sample home, data up the antenna */
export function objectivesRule(state: GameState, inputs: Record<string, Input>, now: number, dt: number): void {
  if (state.phase !== "surface") return;
  const list = missionList(state.mission);
  for (const p of state.players) {
    const tasks = state.surface.tasks;
    const running = tasks[p.id];
    if (running) {
      // walking away, going down or (for a deploy) losing the instrument cancels the job
      const away = !nearest([taskSpot(state, running)], p, TASK_REACH);
      const lost = running.kind === "deploy" && p.carrying !== list.instrument;
      if (p.down || away || lost) {
        delete tasks[p.id];
      } else {
        running.progress = Math.min(1, running.progress + dt / taskSeconds(state, running));
        if (running.progress >= 1) {
          delete tasks[p.id];
          finish(state, p, running, now);
        }
      }
    } else if (inputs[p.id]?.interact) {
      const job = jobHere(state, p);
      if (job) tasks[p.id] = job;
    }

    // the sample counts once it reaches the lander
    if (!p.down && p.carrying === list.sample && atLander(p)) {
      p.carrying = null;
      logEvent(state, "sample_collected", now, { player: p.id, part: list.sample, value: 1 });
      complete(state, "sample", now, p.id);
    }
    uplink(state, p, now, dt);
  }
  if (state.data.target > 0 && state.data.uplinked >= state.data.target - 1e-9) complete(state, "uplink", now);
}

/** one line of the list, for seat 3's mission panel (S3-06) */
export interface ObjectiveLine {
  id: ObjectiveId;
  label: string;
  done: boolean;
  /** how far along, against `need` */
  count: number;
  need: number;
}

/** Mission Control's list as the mission panel shows it: "Scan rich sites 2/3", "Uplink data 22/40" */
export function objectiveLines(state: {
  readonly mission: GameState["mission"];
  readonly objectives: Readonly<Record<string, boolean>>;
  readonly surface: { readonly scanned: readonly string[] };
  readonly data: { readonly uplinked: number; readonly target: number };
}): ObjectiveLine[] {
  const list = missionList(state.mission);
  const rich = SURFACE.sites.filter((s) => s.rich && state.surface.scanned.includes(s.id)).length;
  const done = (id: ObjectiveId) => !!state.objectives[id];
  return [
    { id: "scan", label: "Scan rich sites", done: done("scan"), count: Math.min(rich, list.scans), need: list.scans },
    { id: "sample", label: list.sampleLabel, done: done("sample"), count: done("sample") ? 1 : 0, need: 1 },
    { id: "deploy", label: list.instrumentLabel, done: done("deploy"), count: done("deploy") ? 1 : 0, need: 1 },
    {
      id: "uplink",
      label: "Uplink science data",
      done: done("uplink"),
      count: Math.floor(state.data.uplinked),
      need: state.data.target,
    },
    { id: "bonus", label: `Bonus: ${list.bonusLabel.toLowerCase()}`, done: done("bonus"), count: done("bonus") ? 1 : 0, need: 1 },
  ];
}
