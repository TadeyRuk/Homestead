import { C, MONO, PIXEL } from "./tokens";

/**
 * Canvas drawing for seat 3's screens. Everything is laid out on a 640 x 360 grid and scaled to the
 * canvas, so the same layout works whatever size seat 1 makes the canvas.
 */
export const W = 640;
export const H = 360;

type Ctx = CanvasRenderingContext2D;

export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
/** 0..1 progress of t through the window a..b */
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
/** the first characters of s, as if typed at cps characters a second */
export const typed = (s: string, t: number, cps = 40) => s.slice(0, Math.max(0, Math.floor(t * cps)));
export const mmss = (s: number) => {
  const v = Math.max(0, Math.ceil(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
};

/** a small seeded generator for decoration only (stars, sparks); game randomness stays in core/rng */
export function noise(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** scales the context to the 640 x 360 grid; pair with ctx.restore() */
export function begin(ctx: Ctx): number {
  const u = ctx.canvas.width / W;
  ctx.save();
  ctx.setTransform(u, 0, 0, u, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return u;
}

export interface TextOptions {
  weight?: number;
  font?: "mono" | "pixel";
  align?: CanvasTextAlign;
  base?: CanvasTextBaseline;
}

export function text(ctx: Ctx, s: string, x: number, y: number, size: number, colour: string, o: TextOptions = {}): void {
  ctx.font = `${o.weight ?? 500} ${size}px ${o.font === "pixel" ? PIXEL : MONO}`;
  ctx.fillStyle = colour;
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = o.base ?? "alphabetic";
  ctx.fillText(s, x, y);
}

export function textWidth(ctx: Ctx, s: string, size: number, o: TextOptions = {}): number {
  ctx.font = `${o.weight ?? 500} ${size}px ${o.font === "pixel" ? PIXEL : MONO}`;
  return ctx.measureText(s).width;
}

/** breaks s into lines no wider than maxW */
export function wrap(ctx: Ctx, s: string, maxW: number, size: number, o: TextOptions = {}): string[] {
  ctx.font = `${o.weight ?? 500} ${size}px ${o.font === "pixel" ? PIXEL : MONO}`;
  const out: string[] = [];
  let line = "";
  for (const word of s.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

function rounded(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/** a dark panel with an optional coloured edge */
export function box(ctx: Ctx, x: number, y: number, w: number, h: number, edge?: string, r = 5, fill: string = C.panel): void {
  rounded(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

/** a meter bar: f is 0..1 */
export function bar(ctx: Ctx, x: number, y: number, w: number, h: number, f: number, colour: string, back: string = C.line): void {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w * clamp(f), h);
}

/** a centred label in a small outlined box */
export function tag(ctx: Ctx, s: string, x: number, y: number, colour: string, size = 8): void {
  const w = textWidth(ctx, s, size, { weight: 600 });
  const cx = clamp(x, w / 2 + 8, W - w / 2 - 8);
  box(ctx, cx - w / 2 - 5, y - size + 1, w + 10, size + 7, colour, 3);
  text(ctx, s, cx, y + 1.5, size, colour, { weight: 600, align: "center", base: "middle" });
}

/** a filled rectangle snapped to whole device pixels, for pixel art at any canvas scale */
export function px(ctx: Ctx, x: number, y: number, w: number, h: number, colour: string): void {
  const m = ctx.getTransform();
  const u = m.a || 1;
  const x0 = Math.round(x * u) / u;
  const y0 = Math.round(y * u) / u;
  ctx.fillStyle = colour;
  ctx.fillRect(x0, y0, Math.max(1 / u, Math.round((x + w) * u) / u - x0), Math.max(1 / u, Math.round((y + h) * u) / u - y0));
}

/** colour h darkened or lightened by factor f */
export function shade(h: string, f: number): string {
  const n = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgb(${n.map((v) => clamp(Math.round(v * f), 0, 255)).join(",")})`;
}

export function alpha(h: string, a: number): string {
  const n = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${n.join(",")},${a})`;
}

const STARS = (() => {
  const r = noise(17);
  return Array.from({ length: 200 }, () => ({ x: r() * W, y: r() * H, s: r() < 0.1 ? 2 : 1, v: 2 + r() * 10, b: 90 + r() * 150 }));
})();

/** the moving starfield behind the brief, the report and the pilot's view; speed scales the drift */
export function starfield(ctx: Ctx, t: number, speed = 1): void {
  ctx.fillStyle = C.space;
  ctx.fillRect(0, 0, W, H);
  for (const s of STARS) {
    const y = (s.y + t * s.v * speed) % H;
    const tw = 0.75 + 0.25 * Math.sin(t * 2 + s.x);
    const b = Math.round(s.b * tw);
    px(ctx, s.x, y, s.s, s.s, `rgb(${b},${b},${Math.min(255, b + 30)})`);
  }
}

/** the footer hint line along the bottom edge */
export function hint(ctx: Ctx, s: string): void {
  const w = textWidth(ctx, s, 7);
  ctx.fillStyle = "rgba(8,14,26,.75)";
  ctx.fillRect(0, H - 13, w + 18, 13);
  text(ctx, s, 9, H - 6, 7, "#aab6c2", { base: "middle" });
}

/** true when the player has asked for less motion; screens skip shakes and soften flashes */
export const calm = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
