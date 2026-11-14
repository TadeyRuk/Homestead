import type { Point } from "./map";
import type { GameState, LoosePart } from "./state";

/** puts a piece on the current map; `source` prefixes the id ("s" spawns, "k" kiosk, "d" drops) */
export function placePart(state: GameState, part: string, at: Point, source: string): LoosePart {
  // a per-run counter, not the list length, so an id is never reused after a pickup
  state.partSeq += 1;
  const piece: LoosePart = { id: `${source}${state.partSeq}`, part, x: at.x, y: at.y };
  state.parts.push(piece);
  return piece;
}
