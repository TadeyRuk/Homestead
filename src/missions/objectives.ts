import { logEvent } from "../core/events";
import type { Input } from "../core/input";
import { nearest, type Point } from "../core/map";
import { placePart } from "../core/parts";
import { rng } from "../core/rng";
import type { GameState, Player, SurfaceTask } from "../core/state";
import { atLander } from "../ground/suit";
import { SURFACE } from "../ground/surface";
import { gameEligible, gameSpot, surfaceGame } from "./games";
import { partData } from "../data/data";
import {
  DRAWN_OBJECTIVES,
  missionList,
  objectivePool,
  RICH_FACTOR,
  scanStats,
  TASK_SECONDS,
  uplinkRate,
  type PoolEntry,
} from "./stats";

/** the fixed objective ids in state.objectives, in Mission Control's order; minigames add their kinds */
export const OBJECTIVES = ["scan", "sample", "deploy", "uplink", "bonus"] as const;
/** a fixed objective, or a surface minigame's kind (S2-19) */
export type ObjectiveId = (typeof OBJECTIVES)[number] | (string & {});

const NO_KEYS: Input = { dx: 0, dy: 0, interact: false, panel: false, switch: false };

/** how close to a site or spot a player must stand to work it, and stay while the job runs */
export const TASK_REACH = 36;

const BONUS_STREAM = 0x0b0b05;
const POOL_STREAM = 0x9001ed;

/** the objectives that need no minigame */
const FIXED = new Set<string>(["scan", "sample", "deploy"]);

const idOf = (e: PoolEntry) => (typeof e === "string" ? e : e.id);
const solarOnly = (e: PoolEntry) => typeof e !== "string" && !!e.solarOnly;

/**
 * Can this pool entry go on the list: a fixed objective, or a minigame that has been merged
 * (registered, with a map spot). With `slots` it also has to suit the build: solar-only entries
 * need a solar array, and the minigame's own `eligible` has to agree. Without slots (the brief,
 * before the build exists) the build is not checked.
 */
function drawable(e: PoolEntry, slots: GameState["ship"]["slots"] | null): boolean {
  const id = idOf(e);
  if (!FIXED.has(id) && !(surfaceGame(id) && gameSpot(id, "mars") && gameSpot(id, "moon"))) return false;
  if (!slots) return true;
  if (solarOnly(e) && !partData(slots.power)?.solar) return false;
  return FIXED.has(id) || gameEligible(id, slots);
}

/**
 * The run's objectives on top of the uplink and the bonus (S2-18): the mission's pool shuffled by
 * the seed, minus anything not merged or not suited to the build, first DRAWN_OBJECTIVES of it,
 * shown in the pool's order. Pass `slots: null` for the brief, before anything is built.
 */
export function drawObjectives(seed: number, mission: GameState["mission"], slots: GameState["ship"]["slots"] | null): string[] {
  const pool = objectivePool(mission);
  const order = pool.map((_, i) => i);
  const r = rng((seed ^ POOL_STREAM) >>> 0);
  // the whole pool is shuffled first, so merging or cutting a task only adds or frees one place
  for (let i = order.length - 1; i > 0; i--) {
    const j = r.int(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const picked: number[] = [];
  for (const i of order) {
    if (picked.length >= DRAWN_OBJECTIVES) break;
    if (drawable(pool[i], slots) && !picked.some((k) => idOf(pool[k]) === idOf(pool[i]))) picked.push(i);
  }
  return picked.sort((a, b) => a - b).map((i) => idOf(pool[i]));
}

/** the brief's objective lines for this seed: what to look for on the campus, then the uplink */
export function briefObjectives(seed: number, mission: GameState["mission"], target: number): string[] {
  const list = missionList(mission);
  const pool = objectivePool(mission);
  return [
    ...drawObjectives(seed, mission, null).map((id) => {
      if (id === "scan") return `Scan ${list.scans} rich sites`;
      if (id === "sample") return list.sampleLabel;
      if (id === "deploy") return list.instrumentLabel;
      const def = surfaceGame(id);
      const solar = pool.some((e) => idOf(e) === id && solarOnly(e));
      return `${def?.label(mission) ?? id}${def?.tip ? ` (${def.tip})` : ""}${solar ? ", solar builds only" : ""}`;
    }),
    `Uplink ${target} data units`,
  ];
}

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
    games: {},
  };
  // three drawn from the mission's pool by the seed (S2-18), then the uplink and the bonus every run
  const ids = [...drawObjectives(state.seed, state.mission, state.ship.slots), "uplink", "bonus"];
  state.objectives = Object.fromEntries(ids.map((id) => [id, false]));
  const lander = SURFACE.lander;
  // clear of the lander art, inside its ring; only when the deploy is on the list
  if ("deploy" in state.objectives) placePart(state, missionList(state.mission).instrument, { x: lander.x + 60, y: lander.y - 48 }, "o");
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

/** the surface minigame a player standing here could open with E, or null */
export function gameHere(state: GameState, p: Player): string | null {
  if (state.phase !== "surface" || p.down || state.surface.games[p.id]) return null;
  for (const [kind, done] of Object.entries(state.objectives)) {
    if (done || !surfaceGame(kind)) continue;
    // one player at a time on each task
    if (Object.values(state.surface.games).some((run) => run.kind === kind)) continue;
    const spot = gameSpot(kind, state.mission);
    if (spot && nearest([spot], p, TASK_REACH)) return kind;
  }
  return null;
}

/** opens a minigame's overlay for this player with a fresh attempt */
function openGame(state: GameState, p: Player, kind: string): void {
  const def = surfaceGame(kind);
  if (!def) return;
  const part = state.ship.slots[def.slot];
  state.surface.games[p.id] = {
    kind,
    part,
    tries: 0,
    failedAt: null,
    game: def.start({ seed: state.seed, mission: state.mission, part, tries: 0 }),
  };
}

/**
 * One tick of a player's open minigame. Tab leaves without failing; going down closes it.
 * A failure logs `task_failed` with the difficulty part and starts a fresh attempt at once.
 */
function stepGame(state: GameState, p: Player, input: Input, now: number, dt: number): void {
  const run = state.surface.games[p.id];
  const def = surfaceGame(run.kind);
  if (!def || p.down || state.objectives[run.kind] || input.switch) {
    delete state.surface.games[p.id];
    return;
  }
  const result = def.update(run.game, input, dt);
  if (result === "failed") {
    logEvent(state, "task_failed", now, { player: p.id, objective: run.kind, ...(run.part ? { part: run.part } : {}) });
    run.tries += 1;
    run.failedAt = now;
    run.game = def.start({ seed: state.seed, mission: state.mission, part: run.part, tries: run.tries });
  } else if (result === "done") {
    delete state.surface.games[p.id];
    complete(state, run.kind, now, p.id);
  }
}

/** the job a player standing here could start with E, or null */
export function jobHere(state: GameState, p: Player): SurfaceTask | null {
  if (state.phase !== "surface" || p.down) return null;
  const list = missionList(state.mission);
  const site = nearest(SURFACE.sites, p, TASK_REACH);
  if (site && !state.surface.scanned.includes(site.id)) return { kind: "scan", target: site.id, progress: 0 };
  if ("sample" in state.objectives && !state.surface.sampleDrilled && !p.carrying && nearest([SURFACE.sampleSites[state.mission]], p, TASK_REACH)) {
    return { kind: "drill", target: list.sample, progress: 0 };
  }
  if ("deploy" in state.objectives && !state.surface.deployed && p.carrying === list.instrument && nearest([SURFACE.deploySpot], p, TASK_REACH)) {
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
  if (state.phase !== "surface") return false;
  return !!state.surface.tasks[p.id] || !!state.surface.games[p.id] || gameHere(state, p) !== null || jobHere(state, p) !== null;
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
    if (state.surface.games[p.id]) {
      stepGame(state, p, inputs[p.id] ?? NO_KEYS, now, dt);
    } else if (running) {
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
      // the press that opens a minigame is not also its first key
      const game = gameHere(state, p);
      const job = game ? null : jobHere(state, p);
      if (game) openGame(state, p, game);
      else if (job) tasks[p.id] = job;
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

/** this run's objective ids in the order the list shows them */
export function listIds(state: { readonly objectives: Readonly<Record<string, boolean>> }): ObjectiveId[] {
  return Object.keys(state.objectives);
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
  const once = (id: ObjectiveId, label: string): ObjectiveLine => ({ id, label, done: done(id), count: done(id) ? 1 : 0, need: 1 });
  return listIds(state).map((id): ObjectiveLine => {
    if (id === "scan") return { id, label: "Scan rich sites", done: done(id), count: Math.min(rich, list.scans), need: list.scans };
    if (id === "sample") return once(id, list.sampleLabel);
    if (id === "deploy") return once(id, list.instrumentLabel);
    if (id === "uplink") return { id, label: "Uplink science data", done: done(id), count: Math.floor(state.data.uplinked), need: state.data.target };
    if (id === "bonus") return once(id, `Bonus: ${list.bonusLabel.toLowerCase()}`);
    return once(id, surfaceGame(id)?.label(state.mission) ?? id);
  });
}
