// S2-20: the ice drill, a surface minigame on the S2-19 frame. Bore down to the ice holding the
// drill pressure inside a band with W/S. Too high jams the bit, too low stalls it; staying out of
// the band for more than a moment fails the attempt. The power part's torque sets the band's width.
import type { Input } from "../core/input";
import type { MissionId } from "../core/state";
import { rng } from "../core/rng";
import { partData } from "../data/data";
import { C, MONO } from "../ui/tokens";
import type { Box, GameDrawInfo, GameResult, SurfaceGame } from "./games";

export const ICE_DRILL = "ice-drill";

/** one attempt, plain data so joiners get it in snapshots */
export interface Drill {
  /** 0 (no weight on the bit) to 1 (full) */
  pressure: number;
  /** 0 at the surface to 1 at the ice */
  depth: number;
  /** middle of the safe band */
  centre: number;
  /** full width of the safe band, from the power part's torque */
  band: number;
  /** seconds out of the band in a row; at GRACE_S the attempt fails */
  strain: number;
  /** how hard each rock layer pushes the pressure, per second; + toward a jam, - toward a stall */
  layers: number[];
  /** seconds since the attempt started, for the wobble */
  t: number;
  /** how the last attempt ended, for the draw: "jam" or "stall"; null while drilling */
  over: "jam" | "stall" | null;
}

/** pressure per second from holding W or S */
export const PUSH = 0.7;
/** depth per second while inside the band: about seven seconds of good drilling */
export const DIG_RATE = 1 / 7;
/** seconds out of the band before the bit jams or stalls */
export const GRACE_S = 0.5;
const CENTRE = 0.55;
const LAYERS = 6;
const WOBBLE = 0.12;
const STREAM = 0x1ce0d2;
/** an unknown or missing power part drills like the salvage battery */
const FALLBACK_TORQUE = 0.12;

/** the safe band's width for a power part */
export function drillBand(part: string | null): number {
  return partData(part)?.torque ?? partData("salvage-battery")?.torque ?? FALLBACK_TORQUE;
}

export function startDrill(seed: number, part: string | null, tries: number): Drill {
  const r = rng((seed ^ STREAM ^ Math.imul(tries + 1, 0x9e3779b1)) >>> 0);
  // alternating pushes, so the driller has to keep correcting both ways
  const first = r.next() < 0.5 ? 1 : -1;
  const layers = Array.from({ length: LAYERS }, (_, i) => (i % 2 === 0 ? first : -first) * (0.18 + r.next() * 0.2));
  return { pressure: CENTRE, depth: 0, centre: CENTRE, band: drillBand(part), strain: 0, layers, t: 0, over: null };
}

/** the push from the rock at the bit right now */
export function rockPush(d: Pick<Drill, "depth" | "layers" | "t">): number {
  const layer = d.layers[Math.min(d.layers.length - 1, Math.floor(d.depth * d.layers.length))] ?? 0;
  return layer + Math.sin(d.t * 2.3) * WOBBLE;
}

export function stepDrill(d: Drill, input: Input, dt: number): GameResult {
  d.t += dt;
  // W (up, dy -1) leans on the drill, S eases off
  d.pressure = Math.max(0, Math.min(1, d.pressure + (rockPush(d) - input.dy * PUSH) * dt));
  const half = d.band / 2;
  const off = d.pressure - d.centre;
  if (Math.abs(off) <= half) {
    d.strain = Math.max(0, d.strain - dt * 2);
    d.depth = Math.min(1, d.depth + DIG_RATE * dt);
    if (d.depth >= 1) return "done";
  } else {
    d.strain += dt;
    if (d.strain >= GRACE_S) {
      d.over = off > 0 ? "jam" : "stall";
      return "failed";
    }
  }
  return "playing";
}

const SOIL: Record<MissionId, { top: string; layers: [string, string]; ice: string }> = {
  mars: { top: "#9a4a2a", layers: ["#7a3820", "#6b2f1b"], ice: "#cfe8ff" },
  moon: { top: "#5b5d63", layers: ["#45474d", "#3a3c41"], ice: "#d8ecff" },
};

export function drawDrill(ctx: CanvasRenderingContext2D, d: Readonly<Drill>, box: Box, info: GameDrawInfo): void {
  const half = d.band / 2;
  const off = d.pressure - d.centre;
  const outside = Math.abs(off) > half;

  // the gauge on the left: red jam zone up top, green band, red stall zone below
  const gx = box.x + 30;
  const gy = box.y + 34;
  const gw = 34;
  const gh = box.h - 52;
  const yOf = (v: number) => gy + gh * (1 - v);
  ctx.fillStyle = "rgba(255, 90, 80, 0.28)";
  ctx.fillRect(gx, gy, gw, gh);
  ctx.fillStyle = "rgba(110, 220, 130, 0.55)";
  ctx.fillRect(gx, yOf(d.centre + half), gw, yOf(d.centre - half) - yOf(d.centre + half));
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.strokeRect(gx, gy, gw, gh);
  ctx.font = `600 9px ${MONO}`;
  ctx.textAlign = "center";
  ctx.fillStyle = C.red;
  ctx.fillText("JAM", gx + gw / 2, gy - 6);
  ctx.fillText("STALL", gx + gw / 2, gy + gh + 12);
  // the needle
  const ny = yOf(d.pressure);
  ctx.fillStyle = outside ? C.red : C.white;
  ctx.fillRect(gx - 8, ny - 2, gw + 16, 4);
  ctx.beginPath();
  ctx.moveTo(gx - 8, ny - 7);
  ctx.lineTo(gx - 1, ny);
  ctx.lineTo(gx - 8, ny + 7);
  ctx.fill();
  ctx.fillStyle = C.muted;
  ctx.fillText("PRESSURE", gx + gw / 2, gy - 17);

  // the cross-section on the right: soil layers down to the ice, the drill string and its bit
  const sx = box.x + 120;
  const sw = box.w - 140;
  const sy = box.y + 18;
  const sh = box.h - 26;
  const soil = SOIL[info.mission];
  const iceH = sh * 0.16;
  const soilH = sh - iceH;
  ctx.fillStyle = soil.top;
  ctx.fillRect(sx, sy, sw, 6);
  for (let i = 0; i < d.layers.length; i++) {
    ctx.fillStyle = soil.layers[i % 2];
    ctx.fillRect(sx, sy + 6 + ((soilH - 6) * i) / d.layers.length, sw, (soilH - 6) / d.layers.length + 1);
  }
  ctx.fillStyle = soil.ice;
  ctx.fillRect(sx, sy + soilH, sw, iceH);
  ctx.fillStyle = "#0b0e14";
  ctx.font = `700 10px ${MONO}`;
  ctx.fillText(info.mission === "mars" ? "WATER ICE" : "POLAR ICE", sx + sw / 2, sy + soilH + iceH / 2 + 4);

  const bx = sx + sw / 2;
  const bitY = sy + 6 + (soilH - 6) * d.depth;
  // the rig on the surface, then the string; the bit shakes harder the further out of the band
  const shake = outside ? Math.sin(d.t * 60) * 2.5 : Math.sin(d.t * 30) * 0.8;
  ctx.fillStyle = "#b6bac4";
  ctx.fillRect(bx - 16, sy - 12, 32, 12);
  ctx.fillStyle = "#d8dce3";
  ctx.fillRect(bx - 3 + shake, sy, 6, bitY - sy);
  ctx.fillStyle = outside ? C.red : C.amber;
  ctx.beginPath();
  ctx.moveTo(bx - 8 + shake, bitY);
  ctx.lineTo(bx + 8 + shake, bitY);
  ctx.lineTo(bx + shake, bitY + 12);
  ctx.closePath();
  ctx.fill();

  ctx.textAlign = "left";
  ctx.font = `600 11px ${MONO}`;
  ctx.fillStyle = C.white;
  ctx.fillText(`Depth ${Math.floor(d.depth * 100)}%`, sx + 6, sy + 22);
  if (outside) {
    ctx.fillStyle = C.red;
    ctx.fillText(off > 0 ? "Jamming! ease off (S)" : "Stalling! lean on it (W)", sx + 6, sy + 38);
  }
  ctx.textAlign = "left";
}

export const iceDrill: SurfaceGame<Drill> = {
  name: "Ice drill",
  label: (mission) => (mission === "mars" ? "Drill for subsurface water ice" : "Drill for polar ice in the shadowed crater"),
  slot: "power",
  keys: "W/S: keep the pressure in the green band",
  tip: "easiest with an RTG",
  fact: (mission) =>
    mission === "mars"
      ? "Phoenix found water ice just under the Martian soil in 2008; its data is archived in NASA's Planetary Data System (pds.nasa.gov)."
      : "LCROSS found water ice in a permanently shadowed crater near the Moon's south pole in 2009.",
  start: ({ seed, part, tries }) => startDrill(seed, part, tries),
  update: stepDrill,
  draw: (ctx, d, box, info) => drawDrill(ctx, d as Readonly<Drill>, box, info),
};
