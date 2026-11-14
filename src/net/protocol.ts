import type { Input } from "../core/input";
import type { GameState } from "../core/state";

export type FromClient = { t: "hello"; name: string } | { t: "input"; input: Input } | { t: "ping" };

export type FromHost =
  | { t: "welcome"; playerId: string }
  | { t: "snapshot"; state: GameState }
  | { t: "end"; reason: string };

const NAME_MAX = 16;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isAxis = (v: unknown) => v === -1 || v === 0 || v === 1;
const isBool = (v: unknown) => typeof v === "boolean";

function parseInput(v: unknown): Input | null {
  if (!isObj(v)) return null;
  const { dx, dy, interact, panel, switch: sw } = v;
  if (!isAxis(dx) || !isAxis(dy) || !isBool(interact) || !isBool(panel) || !isBool(sw)) return null;
  // rebuild rather than pass through, so extra fields from a joiner never reach the host's state
  return { dx: dx as number, dy: dy as number, interact: interact as boolean, panel: panel as boolean, switch: sw as boolean };
}

/** a joiner's message, or null; everything a joiner sends is untrusted */
export function parseFromClient(raw: unknown): FromClient | null {
  if (!isObj(raw)) return null;
  if (raw.t === "hello") {
    if (typeof raw.name !== "string") return null;
    const name = raw.name.trim().slice(0, NAME_MAX);
    return name ? { t: "hello", name } : null;
  }
  if (raw.t === "ping") return { t: "ping" };
  if (raw.t === "input") {
    const input = parseInput(raw.input);
    return input ? { t: "input", input } : null;
  }
  return null;
}

// the host is the authority, so only the shape is checked here
export function parseFromHost(raw: unknown): FromHost | null {
  if (!isObj(raw)) return null;
  if (raw.t === "welcome" && typeof raw.playerId === "string") return { t: "welcome", playerId: raw.playerId };
  if (raw.t === "end" && typeof raw.reason === "string") return { t: "end", reason: raw.reason };
  if (raw.t === "snapshot" && isObj(raw.state) && typeof raw.state.phase === "string" && Array.isArray(raw.state.players)) {
    return { t: "snapshot", state: raw.state as unknown as GameState };
  }
  return null;
}
