// helpers for seat 2's map tests; nothing in the game imports this
import type { Input } from "../core/input";
import type { Point } from "../core/map";
import type { Player } from "../core/state";
import { blocked, inBounds, PLAYER_HALF } from "./geom";
import type { GroundMap } from "./world";

export const STILL: Input = { dx: 0, dy: 0, interact: false, panel: false, switch: false };

export const player = (id: string, x = 0, y = 0, extra: Partial<Player> = {}): Player => ({
  id, name: id, roles: [], station: null, x, y, carrying: null, oxygen: 1, power: 1, down: false, ...extra,
});

/** a player-sized box fits here: inside the map and touching no wall */
export function isOpen(map: GroundMap, p: Point, half = PLAYER_HALF): boolean {
  return inBounds(map, p, half) && !blocked(map.walls, p, half);
}

const CELL = 8;

/**
 * Flood-fills the walkable ground from `from` on an 8 px grid and reports which targets a
 * player could walk to. Catches a building that seals off a corner of the map.
 */
export function reachable(map: GroundMap, from: Point, targets: readonly Point[]): boolean[] {
  const cols = Math.floor(map.width / CELL);
  const rows = Math.floor(map.height / CELL);
  const cellOf = (p: Point) => [Math.floor(p.x / CELL), Math.floor(p.y / CELL)] as const;
  const centre = (c: number, r: number) => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 });
  const seen = new Uint8Array(cols * rows);
  const [c0, r0] = cellOf(from);
  const queue: number[] = [r0 * cols + c0];
  seen[queue[0]] = 1;
  while (queue.length) {
    const i = queue.pop()!;
    const c = i % cols;
    const r = (i - c) / cols;
    for (const [nc, nr] of [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]]) {
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const j = nr * cols + nc;
      if (seen[j] || !isOpen(map, centre(nc, nr))) continue;
      seen[j] = 1;
      queue.push(j);
    }
  }
  // a target counts if any cell within half a player of it was reached
  return targets.map((t) => {
    const [c, r] = cellOf(t);
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc >= 0 && nr >= 0 && nc < cols && nr < rows && seen[nr * cols + nc]) return true;
      }
    }
    return false;
  });
}

/** a stand-in 2D context that records every call, so scene tests can see what was drawn */
export function recordingCtx(width = 960, height = 540) {
  const calls: { name: string; args: unknown[] }[] = [];
  const target = { canvas: { width, height } } as Record<string, unknown>;
  const ctx = new Proxy(target, {
    get(t, key) {
      if (key in t) return t[key as string];
      if (key === "measureText") return (text: string) => ({ width: text.length * 7 });
      return (...args: unknown[]) => {
        calls.push({ name: String(key), args });
      };
    },
    set(t, key, value) {
      t[key as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  const texts = () => calls.filter((c) => c.name === "fillText").map((c) => String(c.args[0]));
  const first = (name: string) => calls.find((c) => c.name === name)?.args;
  return { ctx, calls, texts, first };
}
