import { buildable, salvageFor } from "../../core/catalog";
import { enterPhase } from "../../core/phases";
import type { Rule } from "../../core/step";
import type { GameState, Role, Slot } from "../../core/state";

/** what the debug URL asked for: one station to open on, and the parts to fly with */
export interface Sandbox {
  station: Role;
  slots: Partial<Record<Slot, string>>;
}

const ROLES: readonly Role[] = ["pilot", "engineer", "comms", "science"];
const SLOTS: readonly Slot[] = ["propulsion", "power", "comms", "payload"];

// "Low-Gain" and "lowgain" both become "lowgain", so ids can be typed loosely
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Reads `?station=engineer&parts=ion,rtg,lowgain,radar` (S5-09). Every value is checked against the
 * roles and the part catalog, so nothing from the URL reaches the game unless it names a real thing.
 * A part matches its exact id or the one id it starts; anything else is skipped.
 */
export function parseSandbox(search: string): Sandbox | null {
  const q = new URLSearchParams(search);
  const station = ROLES.find((r) => r === q.get("station"));
  if (!station) return null;
  const slots: Sandbox["slots"] = {};
  const parts = buildable();
  for (const want of (q.get("parts") ?? "").split(",").map(squash).filter(Boolean)) {
    const exact = parts.filter((p) => squash(p.id) === want);
    const match = exact.length > 0 ? exact : parts.filter((p) => squash(p.id).startsWith(want));
    if (match.length === 1) slots[match[0].slot] = match[0].id;
  }
  return { station, slots };
}

/** skips the brief and the campus: mounts the parts, fills the rest with salvage, and starts flight */
export function applySandbox(state: GameState, sandbox: Sandbox, now: number): void {
  for (const slot of SLOTS) state.ship.slots[slot] = sandbox.slots[slot] ?? salvageFor(slot);
  enterPhase(state, "flight", now);
  for (const p of state.players) if (p.roles.includes(sandbox.station)) p.station = sandbox.station;
}

/** a brief rule that drops the run into flight on its first tick */
export function sandboxRule(sandbox: Sandbox): Rule {
  return (state, _inputs, now) => applySandbox(state, sandbox, now);
}
