import { buildable } from "../core/catalog";
import { mapFor, type Point } from "../core/map";
import { placePart } from "../core/parts";
import { rng } from "../core/rng";
import type { GameState, Slot } from "../core/state";

// its own stream, so the campus layout doesn't shift when another seat draws from the seed
const SPAWN_STREAM = 0x73706177;
const SLOTS: Slot[] = ["propulsion", "power", "comms", "payload"];

/** seeds the campus: one part per slot first (as many slots as there are points), then the rest fill the remaining points */
export function spawnParts(state: GameState, points: readonly Point[] = mapFor("campus").spawnPoints): void {
  const r = rng(state.seed ^ SPAWN_STREAM);
  const shuffle = <T>(xs: T[]) => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = r.int(i + 1);
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
    return xs;
  };
  const pool = shuffle(buildable().map((p) => p));
  // one per slot first, so a short map never leaves a slot with nothing to find
  const firsts = SLOTS.flatMap((slot) => pool.filter((p) => p.slot === slot).slice(0, 1));
  const order = [...firsts, ...pool.filter((p) => !firsts.includes(p))];
  shuffle([...points]).forEach((at, i) => placePart(state, order[i % order.length].id, at, "s"));
}
