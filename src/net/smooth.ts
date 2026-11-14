// joiner-side smoothing; the host's state stays the truth, this only changes what a joiner draws

type Point = { x: number; y: number };

// the host trails a moving player by roughly one round trip; beyond this it really disagrees (a wall, a respawn)
const SNAP_PX = 64;
// share of the remaining gap closed per second once the player stops
const EASE_PER_S = 10;

/** this tab's own player, moved straight from its keys instead of waiting for the host */
export function createPrediction(speed: number) {
  let pos: Point | null = null;
  return {
    step(input: { dx: number; dy: number }, dt: number) {
      if (!pos) return;
      pos.x += input.dx * speed * dt;
      pos.y += input.dy * speed * dt;
    },
    /** fold in the host's position for this player from the latest snapshot */
    reconcile(host: Point, moving: boolean, dt: number) {
      if (!pos) {
        pos = { x: host.x, y: host.y }; // only the position: callers pass a whole Player
        return;
      }
      const ex = host.x - pos.x;
      const ey = host.y - pos.y;
      if (Math.hypot(ex, ey) > SNAP_PX) {
        pos = { x: host.x, y: host.y }; // only the position: callers pass a whole Player
      } else if (!moving) {
        const k = Math.min(1, dt * EASE_PER_S);
        pos.x += ex * k;
        pos.y += ey * k;
      }
    },
    position: (): Point => ({ ...(pos ?? { x: 0, y: 0 }) }),
  };
}

type Positioned = { id: string; x: number; y: number };
const KEEP_MS = 1_000;

/** other players, drawn a little in the past so there are always two snapshots to slide between */
export function createInterpolator() {
  const frames: { t: number; at: Map<string, Point> }[] = [];
  return {
    push(hostNow: number, players: readonly Positioned[]) {
      frames.push({ t: hostNow, at: new Map(players.map((p) => [p.id, { x: p.x, y: p.y }])) });
      while (frames.length > 2 && frames[0].t < hostNow - KEEP_MS) frames.shift();
    },
    at(renderT: number): Map<string, Point> {
      const out = new Map<string, Point>();
      const newest = frames[frames.length - 1];
      if (!newest) return out;
      let i = frames.length - 1;
      while (i > 0 && frames[i - 1].t > renderT) i--;
      const b = frames[i];
      const a = i > 0 ? frames[i - 1] : b;
      const span = b.t - a.t;
      const k = span > 0 ? Math.min(1, Math.max(0, (renderT - a.t) / span)) : 1;
      for (const [id, pb] of b.at) {
        const pa = a.at.get(id) ?? pb;
        out.set(id, { x: pa.x + (pb.x - pa.x) * k, y: pa.y + (pb.y - pa.y) * k });
      }
      return out;
    },
  };
}
