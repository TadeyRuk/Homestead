import { liftOf, massOf } from "../core/catalog";
import type { DeepReadonly } from "../core/scene";
import type { GameEvent, GameState, Slot } from "../core/state";
import { MISSIONS, partData, partName } from "../data/data";
import { LOST_FUEL } from "../flight/flight.register";
import { scanStats, uplinkRate } from "../missions/stats";

/**
 * Seat 3's report logic (S3-08). Reads the event log and the final state, finds the biggest loss,
 * walks it back to the part and the choice behind it in plain words, and ends on the real mission
 * that made the same trade. Pure: the same run always gives the same report.
 */

export type Outcome = "SUCCESS" | "PARTIAL SUCCESS" | "MISSION FAILED";

export interface ScoreRow {
  label: string;
  detail: string;
  points: number;
}

export interface Report {
  outcome: Outcome;
  /** the first line: what happened, in numbers */
  headline: string;
  /** the chain, walked back from the loss to the choice */
  chain: string[];
  /** a short line or two about what else went wrong or right */
  also: string[];
  /** the part the chain ends on, if any */
  blame: string | null;
  /** "what real missions do": the real hardware and its fact */
  real: { name: string; fact: string } | null;
  rows: ScoreRow[];
  score: number;
}

type State = DeepReadonly<GameState>;
type Event = DeepReadonly<GameEvent>;

const SLOTS: Slot[] = ["propulsion", "power", "comms", "payload"];
const SLOT_WORD: Record<Slot, string> = { propulsion: "engine", power: "power", comms: "comms", payload: "payload" };

const count = (log: readonly Event[], kind: GameEvent["kind"]) => log.filter((e) => e.kind === kind).length;
const first = (log: readonly Event[], kind: GameEvent["kind"]) => log.find((e) => e.kind === kind);
const round = (v: number) => Math.round(v);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** seconds left on the build clock when the countdown that launched the rocket started; 0 if the timer ran out */
export function buildTimeLeft(log: readonly Event[]): number {
  let left = 0;
  for (const e of log) {
    if (e.phase !== "campus") continue;
    if (e.kind === "launch_started") left = e.value ?? 0;
    if (e.kind === "launch_cancelled") left = 0;
    if (e.kind === "salvage_filled") left = 0;
  }
  return Math.max(0, left);
}

function crewStanding(state: State): { standing: number; crew: number } {
  const crew = state.players.length;
  const summary = state.log.find((e) => e.kind === "extraction" && e.player === undefined);
  const standing = summary ? (summary.value ?? 0) : state.players.filter((p) => !p.down).length;
  return { standing, crew };
}

function heldAtEnd(state: State): number {
  return Object.values(state.surface.held).reduce((a, b) => a + (b ?? 0), 0);
}

function realOf(id: string | null | undefined): Report["real"] {
  const p = partData(id);
  if (!p) return null;
  return { name: p.real === "scrap" ? "Mission planning" : p.real, fact: p.fact };
}

/** the score: data against target first, then the crew, credits, build time, and the ship on arrival */
export function scoreRows(state: State): ScoreRow[] {
  const target = state.data.target || 1;
  const up = state.data.uplinked;
  const reachedSurface = state.arrival !== null;
  const { standing, crew } = crewStanding(state);
  const build = buildTimeLeft(state.log);
  const extra = Math.max(0, up - target);
  const done = ["scan", "sample", "deploy"].filter((k) => state.objectives[k]).length;
  return [
    { label: "Data uplinked", detail: `${Math.floor(up)} / ${state.data.target}`, points: round(600 * Math.min(1, up / target) + Math.min(100, extra * 2)) },
    { label: "Objectives", detail: `${done} / 3${state.objectives.bonus ? " + bonus" : ""}`, points: done * 30 + (state.objectives.bonus ? 40 : 0) },
    { label: "Crew standing", detail: reachedSurface ? `${standing} / ${crew}` : "-", points: reachedSurface && crew > 0 ? round((150 * standing) / crew) : 0 },
    { label: "Credits unspent", detail: `${state.credits}`, points: state.credits * 2 },
    { label: "Build time left", detail: `${Math.floor(build)} s`, points: round(build / 2) },
    { label: "Fuel on arrival", detail: state.arrival ? `${round(state.arrival.fuel * 100)}%` : "-", points: state.arrival ? round(state.arrival.fuel * 50) : 0 },
    { label: "Hull on arrival", detail: state.arrival ? `${round(state.arrival.hull * 100)}%` : "-", points: state.arrival ? round(state.arrival.hull * 50) : 0 },
  ];
}

function outcomeOf(state: State): Outcome {
  const log = state.log;
  if (first(log, "launch_failed") || first(log, "ship_lost")) return "MISSION FAILED";
  const { standing } = crewStanding(state);
  if (state.arrival !== null && standing === 0 && state.players.length > 0) return "MISSION FAILED";
  if (state.data.uplinked >= state.data.target && state.data.target > 0) return "SUCCESS";
  return state.data.uplinked > 0 || Object.values(state.objectives).some(Boolean) ? "PARTIAL SUCCESS" : "MISSION FAILED";
}

/** the salvage line: which slots ran out the clock, and whether credits could have filled one */
function salvageLine(state: State, slot?: Slot): string | null {
  const salvaged = slot ? state.ship.salvaged.filter((s) => s === slot) : state.ship.salvaged;
  if (salvaged.length === 0) return null;
  const which = salvaged.length === 1 ? `The ${SLOT_WORD[salvaged[0]]} slot was` : `The ${salvaged.map((s) => SLOT_WORD[s]).join(", ")} slots were`;
  const credits = state.credits > 0 ? `, with ${state.credits} credits unspent` : "";
  return `${which} still empty when the build timer ran out${credits}, so salvage went in.`;
}

function launchFailed(state: State, e: Event): Pick<Report, "headline" | "chain" | "blame"> {
  const mass = massOf(state.ship.slots);
  const lift = liftOf(state.ship.slots);
  const engine = state.ship.slots.propulsion;
  if (!engine || lift === 0) {
    return { headline: "The rocket never left the pad: it had no engine.", chain: ["Nothing was mounted in the propulsion slot."], blame: null };
  }
  const heaviest = SLOTS.map((s) => state.ship.slots[s])
    .filter((id): id is string => !!id && id !== engine)
    .sort((a, b) => (partData(b)?.mass ?? 0) - (partData(a)?.mass ?? 0))[0];
  const chain = [
    `It weighed ${mass} kg, ${round(e.value ?? mass - lift)} kg more than the ${partName(engine).toLowerCase()} can lift (${lift} kg).`,
  ];
  if (heaviest) chain.push(`The heaviest part on board was the ${partName(heaviest).toLowerCase()} at ${partData(heaviest)?.mass} kg.`);
  const sal = salvageLine(state);
  if (sal) chain.push(sal);
  chain.push("The pad warned about the weight, and the countdown went ahead anyway.");
  return { headline: "The rocket lifted off overweight and fell back. It never reached space.", chain, blame: engine };
}

function shipLost(state: State, e: Event): Pick<Report, "headline" | "chain" | "blame"> {
  const log = state.log;
  const engine = state.ship.slots.propulsion;
  const mass = massOf(state.ship.slots);
  const lift = liftOf(state.ship.slots) || 1;
  const pct = round((mass / lift) * 100);
  if (e.value === LOST_FUEL) {
    const chain = [`The ${partName(engine).toLowerCase()} burned through its fuel ${round(e.t)} s into the run.`];
    if (pct > 70) chain.push(`The ship weighed ${pct}% of what that engine can lift, and a heavy ship burns more on every turn and burn.`);
    const low = first(log, "fuel_low");
    if (low) chain.push(`Fuel ran low at ${round(low.t)} s into the run, and the burns kept going.`);
    const sal = salvageLine(state, "propulsion");
    if (sal) chain.push(sal);
    return { headline: "The ship ran out of fuel before it arrived. Nobody reached the surface.", chain, blame: engine };
  }
  const hits = log.filter((x) => x.kind === "debris_hit");
  const big = hits.filter((x) => partData(x.part)?.target && (partData(x.part)?.target ?? 1) > 1);
  const chain = [`The hull gave out after ${plural(hits.length, "debris hit")}.`];
  let blame: string | null = engine;
  if (big.length > 0) {
    chain.push(`The ${partName(big[0].part).toLowerCase()} made the ship a wider target, so more of the debris field struck it.`);
    blame = big[0].part ?? null;
  } else if (engine) {
    const steer = partData(engine)?.steer;
    const how = steer === "pulse" ? "steers only in fixed pulses" : steer === "slow" ? "is slow to answer the stick" : "steers well, but the field was dense";
    chain.push(`The ${partName(engine).toLowerCase()} ${how}${pct > 70 ? `, and at ${pct}% of its lift the ship turned slowly` : ""}.`);
  }
  if (!first(log, "breach_sealed") && count(log, "hull_breach") > 0) chain.push(`${plural(count(log, "hull_breach"), "breach", "breaches")} opened and none were welded shut.`);
  return { headline: "The hull failed in flight. Nobody reached the surface.", chain, blame };
}

function crewLost(state: State): Pick<Report, "headline" | "chain" | "blame"> {
  const log = state.log;
  const power = state.ship.slots.power;
  const p = partData(power);
  const chain = [`Every suit ran out of oxygen or power before the extraction ship arrived.`];
  const hazard = count(log, "hazard_hit");
  if (hazard > 0) chain.push(`${state.mission === "mars" ? "The dust storm" : "The solar flare"} caught the crew in the open ${plural(hazard, "time")}.`);
  if (p?.solar && state.mission === "mars") chain.push(`The ${partName(power).toLowerCase()} gets only 43% of Earth's sunlight at Mars, so suits recharged slowly at the lander.`);
  else if (p && p.power < 400) chain.push(`The ${partName(power).toLowerCase()} recharged suits slowly at the lander.`);
  return { headline: "The whole crew went down on the surface.", chain, blame: power };
}

function dataShort(state: State): Pick<Report, "headline" | "chain" | "blame"> {
  const target = state.data.target;
  const up = Math.floor(state.data.uplinked);
  const held = Math.floor(heldAtEnd(state));
  const comms = state.ship.slots.comms;
  const payload = state.ship.slots.payload;
  const rate = uplinkRate(comms);
  const fastest = uplinkRate("laser");
  const chain: string[] = [];
  let blame: string | null = null;

  const scans = state.log.filter((e) => e.kind === "site_scanned");
  const collected = scans.reduce((a, e) => a + (e.value ?? 0), 0);

  if (collected < target) {
    // too little data was ever collected: the scans and the payload are the story, not the antenna
    const per = scanStats(payload).data;
    if (scans.length === 0) chain.push("No site was scanned, so there was no data to send.");
    else chain.push(`The crew scanned ${plural(scans.length, "site")} for ${round(collected)} units, and the ${partName(payload).toLowerCase()} brings back ${per} units a scan.`);
    const health = state.ship.instrumentHealth;
    if (health < 0.9) chain.push(`The instrument lost ${round((1 - health) * 100)}% of its accuracy when the energy core overheated in flight.`);
    if (held > 0) chain.push(`${plural(held, "unit")} ${held === 1 ? "was" : "were"} still in someone's hands when the extraction ship arrived.`);
    blame = payload;
    const sal = salvageLine(state, state.ship.salvaged.length > 1 ? undefined : "payload");
    if (sal) chain.push(sal);
  } else {
    // enough was collected; it didn't get home
    if (held > 0) chain.push(`${plural(held, "unit")} ${held === 1 ? "was" : "were"} still in someone's hands when the extraction ship arrived.`);
    if (rate < fastest * 0.5) chain.push(`Uploads were slow because the comms slot held ${state.ship.salvaged.includes("comms") ? "a salvage antenna" : `the ${partName(comms).toLowerCase()}`}.`);
    else chain.push(`The ${partName(comms).toLowerCase()} uploads fast, so the data needed more time at the lander.`);
    blame = comms;
    const sal = salvageLine(state, "comms");
    if (sal) chain.push(sal);
  }
  return { headline: `You uplinked ${up} of the ${target} data units Mission Control asked for.`, chain, blame };
}

function success(state: State): Pick<Report, "headline" | "chain" | "blame"> {
  const up = Math.floor(state.data.uplinked);
  const comms = state.ship.slots.comms;
  const chain = [`The ${partName(comms).toLowerCase()} sent the data home at ${uplinkRate(comms)} units a second.`];
  const hits = count(state.log, "debris_hit");
  if (state.arrival && state.arrival.hull < 0.7) chain.push(`The biggest cost was the hull: ${plural(hits, "debris hit")} left it at ${round(state.arrival.hull * 100)}% on arrival.`);
  else if (state.arrival && state.arrival.fuel < 0.4) chain.push(`The biggest cost was fuel: the ship landed with ${round(state.arrival.fuel * 100)}% left.`);
  return { headline: `You uplinked ${up} of the ${state.data.target} data units Mission Control asked for.`, chain, blame: comms };
}

/** the lines that didn't make the main chain but are worth a mention */
function alsoLines(state: State): string[] {
  const log = state.log;
  const out: string[] = [];
  const trips = count(log, "breaker_tripped");
  if (trips > 0) out.push(`The breaker tripped ${plural(trips, "time")} on the ${partName(state.ship.slots.power).toLowerCase()}.`);
  const lost = count(log, "link_lost");
  if (lost > 0) out.push(`The comms link dropped ${plural(lost, "time")}.`);
  const down = count(log, "player_down");
  if (down > 0 && state.arrival) out.push(`${plural(down, "crew member")} went down on the surface.`);
  if (state.objectives.bonus) out.push(`Bonus: ${MISSIONS[state.mission].bonus.toLowerCase()}. Mission Control loved it.`);
  return out.slice(0, 2);
}

export function analyze(state: State): Report {
  const log = state.log;
  const outcome = outcomeOf(state);
  const failedLaunch = first(log, "launch_failed");
  const lost = first(log, "ship_lost");
  const { standing, crew } = crewStanding(state);

  let main: Pick<Report, "headline" | "chain" | "blame">;
  if (failedLaunch) main = launchFailed(state, failedLaunch);
  else if (lost) main = shipLost(state, lost);
  else if (state.arrival && crew > 0 && standing === 0) main = crewLost(state);
  else if (state.data.uplinked < state.data.target) main = dataShort(state);
  else main = success(state);

  const rows = scoreRows(state);
  return {
    outcome,
    ...main,
    also: alsoLines(state),
    real: realOf(main.blame),
    rows,
    score: rows.reduce((a, r) => a + r.points, 0),
  };
}
