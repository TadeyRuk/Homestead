import { missionInfo } from "./missions";
import { enterPhase } from "./phases";
import { rng } from "./rng";
import { createState, type GameState, type MissionId, type Role } from "./state";

export const ROLES: readonly Role[] = ["pilot", "engineer", "comms", "science"];
export type MissionChoice = MissionId | "random";

const byRoleOrder = (a: Role, b: Role) => ROLES.indexOf(a) - ROLES.indexOf(b);

/** deals the four roles round the crew in join order: solo gets all four, two players get two each */
export function dealRoles(state: GameState): void {
  const n = state.players.length;
  for (const p of state.players) p.roles = [];
  if (n === 0) return;
  ROLES.forEach((role, i) => state.players[i % n].roles.push(role));
}

// a newcomer takes roles from whoever holds the most, so picks made before they joined mostly survive
export function joinCrew(state: GameState, playerId: string): void {
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return;
  const share = Math.floor(ROLES.length / state.players.length);
  while (me.roles.length < share) {
    const richest = state.players.reduce((a, b) => (b.roles.length > a.roles.length ? b : a));
    if (richest === me || richest.roles.length <= 1) break;
    me.roles.push(richest.roles.pop()!); // the last in role order, so Pilot is the last to move
  }
  me.roles.sort(byRoleOrder);
}

// a one-for-one swap, so every role stays held exactly once and nobody is left without one
export function takeRole(state: GameState, playerId: string, role: Role): void {
  const me = state.players.find((p) => p.id === playerId);
  const holder = state.players.find((p) => p.roles.includes(role));
  if (!me || !holder || holder === me) return;
  const given = me.roles.find((r) => r !== role);
  if (!given && holder.roles.length < 2) return;
  holder.roles = holder.roles.filter((r) => r !== role);
  if (given) {
    me.roles = me.roles.filter((r) => r !== given);
    holder.roles.push(given);
  }
  me.roles.push(role);
  holder.roles.sort(byRoleOrder);
  me.roles.sort(byRoleOrder);
}

/** the one way a run starts: picks the mission, wipes the last run, keeps the crew and their roles */
export function startRun(state: GameState, choice: MissionChoice, now: number): void {
  const mission = choice === "random" ? rng(state.seed).pick(["moon", "mars"] as const) : choice;
  const fresh = createState(state.seed, mission);
  state.mission = mission;
  state.credits = missionInfo(mission).credits;
  state.ship = fresh.ship;
  state.data = { ...fresh.data, target: missionInfo(mission).dataTarget };
  state.objectives = fresh.objectives;
  state.surface = fresh.surface;
  state.flight = fresh.flight;
  state.launchAt = fresh.launchAt;
  state.trouble = fresh.trouble;
  state.parts = fresh.parts;
  state.partSeq = fresh.partSeq;
  for (const p of state.players) {
    Object.assign(p, { station: null, carrying: null, oxygen: 1, power: 1, down: false });
  }
  enterPhase(state, "brief", now); // also clears the log and starts the run clock
}
