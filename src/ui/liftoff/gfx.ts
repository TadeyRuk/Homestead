import { clamp, noise } from "../kit";
import { bayer } from "./math";

/** small drawing helpers shared by the title's liftoff film */

export type Ctx = CanvasRenderingContext2D;
export type RGB = number[];

export const lerpN = (a: number, b: number, t: number): number => a + (b - a) * t;
export const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const rgb = (a: ArrayLike<number>): string => `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})`;
export const mix = (a: RGB, b: RGB, t: number): RGB => [lerpN(a[0], b[0], t), lerpN(a[1], b[1], t), lerpN(a[2], b[2], t)];

export function make(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d") as Ctx;
  x.imageSmoothingEnabled = false;
  return [c, x];
}

/** a filled rectangle snapped to whole art pixels */
export const R = (x: Ctx, X: number, Y: number, w: number, h: number, col: string): void => {
  x.fillStyle = col;
  x.fillRect(X | 0, Y | 0, w | 0, h | 0);
};

/** a sprite drawn at 1x, then given a 1 px dark outline all round (ART-RULES.md rule 5) */
export function sprite(w: number, h: number, draw: (x: Ctx) => void, outline = "#0a0f1c"): HTMLCanvasElement {
  const [c, x] = make(w + 2, h + 2);
  x.save();
  x.translate(1, 1);
  draw(x);
  x.restore();
  const d = x.getImageData(0, 0, c.width, c.height);
  const a = d.data;
  const cw = c.width;
  const solid = (i: number) => a[i * 4 + 3] > 0;
  const add: number[] = [];
  for (let y = 0; y < c.height; y++) {
    for (let X = 0; X < cw; X++) {
      const i = y * cw + X;
      if (solid(i)) continue;
      if ((X > 0 && solid(i - 1)) || (X < cw - 1 && solid(i + 1)) || (y > 0 && solid(i - cw)) || (y < c.height - 1 && solid(i + cw))) add.push(i);
    }
  }
  const o = hex(outline);
  for (const i of add) {
    a[i * 4] = o[0];
    a[i * 4 + 1] = o[1];
    a[i * 4 + 2] = o[2];
    a[i * 4 + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  return c;
}

/** work too big for one frame runs a few milliseconds at a time */
export class Prep<T> {
  done = false;
  value: T | null = null;
  private it: Generator<void> | null = null;
  constructor(private readonly fn: (self: Prep<T>) => Generator<void>) {}
  /** run until the clock reaches `until` (performance.now() ms); true when finished */
  step(until: number): boolean {
    if (this.done) return true;
    this.it ??= this.fn(this);
    while (performance.now() < until) {
      if (this.it.next().done) {
        this.done = true;
        return true;
      }
    }
    return false;
  }
  /** finish now, blocking; for the rare frame that cannot wait */
  now(): T {
    if (!this.done) this.step(Infinity);
    return this.value as T;
  }
}

// ---------- noise: 3D value noise for hulls and planets, periodic 2D for tiling ground

const PERM = (() => {
  const r = noise(42);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = (r() * (i + 1)) | 0;
    [p[i], p[j]] = [p[j], p[i]];
  }
  return Uint8Array.from(p.concat(p));
})();
const fade = (t: number) => t * t * (3 - 2 * t);

export function vnoise(x: number, y: number, z: number): number {
  const X = Math.floor(x);
  const Y = Math.floor(y);
  const Z = Math.floor(z);
  const fx = fade(x - X);
  const fy = fade(y - Y);
  const fz = fade(z - Z);
  const h = (i: number, j: number, k: number) => PERM[PERM[PERM[(X + i) & 255] + ((Y + j) & 255)] + ((Z + k) & 255)] / 255;
  const a = lerpN(lerpN(h(0, 0, 0), h(1, 0, 0), fx), lerpN(h(0, 1, 0), h(1, 1, 0), fx), fy);
  const b = lerpN(lerpN(h(0, 0, 1), h(1, 0, 1), fx), lerpN(h(0, 1, 1), h(1, 1, 1), fx), fy);
  return lerpN(a, b, fz);
}
export function fbm(x: number, y: number, z: number, o = 4): number {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < o; i++) {
    v += a * vnoise(x * f, y * f, z * f);
    f *= 2;
    a *= 0.5;
  }
  return v;
}
function vn2(x: number, y: number, per: number): number {
  const X = Math.floor(x);
  const Y = Math.floor(y);
  const fx = fade(x - X);
  const fy = fade(y - Y);
  const x0 = ((X % per) + per) % per;
  const y0 = ((Y % per) + per) % per;
  const x1 = (x0 + 1) % per;
  const y1 = (y0 + 1) % per;
  const a = PERM[PERM[x0] + y0];
  const b = PERM[PERM[x1] + y0];
  const c = PERM[PERM[x0] + y1];
  const d = PERM[PERM[x1] + y1];
  return lerpN(lerpN(a, b, fx), lerpN(c, d, fx), fy) / 255;
}
/** tiling fractal noise: per is the tile period of the first octave */
export function fbm2(x: number, y: number, per: number, o: number): number {
  let v = 0;
  let a = 0.5;
  let f = 1;
  let n = 0;
  for (let i = 0; i < o; i++) {
    v += a * vn2(x * f, y * f, per * f);
    n += a;
    f *= 2;
    a *= 0.5;
  }
  return v / n;
}

// ---------- particles

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  col: string;
  size: number;
  grav: number;
  grow: number;
  alpha: number;
  round: boolean;
}
export class Particles {
  private list: Particle[] = [];
  clear(): void {
    this.list.length = 0;
  }
  add(x: number, y: number, vx: number, vy: number, life: number, col: string, size = 2, grav = 0, grow = 0, o: { alpha?: number; round?: boolean } = {}): void {
    if (this.list.length < 1400) this.list.push({ x, y, vx, vy, life, max: life, col, size, grav, grow, alpha: o.alpha ?? 1, round: !!o.round });
  }
  step(g: Ctx, dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += p.grow * dt;
      g.globalAlpha = clamp((p.life / p.max) * 1.5) * p.alpha;
      if (p.round) {
        g.fillStyle = p.col;
        g.beginPath();
        g.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        g.fill();
      } else R(g, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size, p.col);
    }
    g.globalAlpha = 1;
  }
}

// ---------- text is real text, drawn on the display canvas at screen resolution (ART-RULES.md rule 6)

export interface TextStyle {
  pixel?: boolean;
  weight?: number;
  align?: CanvasTextAlign;
  base?: CanvasTextBaseline;
  shadow?: string;
  sd?: number;
}
interface TextCmd {
  s: string;
  x: number;
  y: number;
  size: number;
  col: string;
  o: TextStyle;
  alpha: number;
}
/** scenes queue their text while they draw art; the title flushes it over the scaled art */
export class TextQueue {
  private cmds: TextCmd[] = [];
  /** the scene's current alpha, copied from the art context when text is queued */
  alpha = 1;
  add(s: string, x: number, y: number, size: number, col: string, o: TextStyle = {}): void {
    this.cmds.push({ s, x, y, size, col, o, alpha: this.alpha });
  }
  clear(): void {
    this.cmds.length = 0;
  }
  flush(ctx: Ctx, scale: number, pixelFont: string, monoFont: string): void {
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    for (const c of this.cmds) {
      ctx.globalAlpha = c.alpha;
      ctx.font = `${c.o.weight ?? 600} ${c.size}px ${c.o.pixel ? pixelFont : monoFont}`;
      ctx.textAlign = c.o.align ?? "left";
      ctx.textBaseline = c.o.base ?? "alphabetic";
      if (c.o.shadow) {
        ctx.fillStyle = c.o.shadow;
        ctx.fillText(c.s, c.x + (c.o.sd ?? 4), c.y + (c.o.sd ?? 4));
      }
      ctx.fillStyle = c.col;
      ctx.fillText(c.s, c.x, c.y);
    }
    ctx.restore();
    this.cmds.length = 0;
  }
}

export { bayer };

/** what a scene needs to draw one frame */
export interface Env {
  /** the 1280 x 720 art canvas */
  g: Ctx;
  tx: TextQueue;
  fx: Particles;
  dest: "mars" | "moon";
  /** prefers-reduced-motion: no shake, no drift, and the scene holds on the dusk */
  calm: boolean;
  /** the player in the lobby: shown over the first astronaut to board, who wears their role colour */
  lead: { name: string; role: number };
}
