import { ROLES } from "../../core/lobby";
import { clamp, shade } from "../kit";
import { ROLE_COLOUR } from "../tokens";
import { type Ctx, type RGB, R, fbm, hex, make, mix, sprite } from "./gfx";
import { bayer } from "./math";

/** the sprites the title's liftoff film draws at full resolution, each with a 1 px outline */

const OUT = "#0a0f1c";
const WHITE = "#e8ecf2";
const WHITE_SHADE = "#b4bcca";
const WHITE_HI = "#ffffff";
const CREW = "#78ffdc";
const AMBER = "#ffb43c";
const RED = "#ff5a50";

/** astronaut, 24 x 32. frames: 0 idle, 1 breathe, 2 wave, 3 and 4 walk */
function astronaut(c: string, dark: string, frame: number): HTMLCanvasElement {
  return sprite(24, 32, (x) => {
    const b = frame === 1 ? 1 : 0;
    const walk = frame === 3 ? 1 : frame === 4 ? -1 : 0;
    R(x, 4, 13 + b, 16, 9, "#7c8494");
    R(x, 4, 13 + b, 16, 1, "#9aa2b2");
    const leg = (lx: number, bx: number, lift: number) => {
      R(x, lx, 23, 5, 6 - lift, WHITE);
      R(x, lx + 4, 23, 1, 6 - lift, WHITE_SHADE);
      R(x, lx, 26 - lift, 5, 1, WHITE_SHADE);
      R(x, bx, 29 - lift, 6, 3, "#4a5262");
      R(x, bx, 29 - lift, 6, 1, "#6a7282");
    };
    leg(6 - walk, 5 - walk, walk > 0 ? 1 : 0);
    leg(13 + walk, 13 + walk, walk < 0 ? 1 : 0);
    R(x, 5, 13 + b, 14, 10 - b, WHITE);
    R(x, 16, 13 + b, 3, 10 - b, WHITE_SHADE);
    R(x, 5, 13 + b, 14, 1, WHITE_HI);
    R(x, 5, 21, 14, 2, "#3a4252");
    R(x, 9, 15 + b, 6, 4, c);
    R(x, 9, 18 + b, 6, 1, dark);
    R(x, 10, 16 + b, 1, 1, CREW);
    R(x, 12, 16 + b, 1, 1, frame === 1 ? RED : "#7a2420");
    R(x, 13, 16 + b, 1, 1, AMBER);
    R(x, 2, 14 + b + walk, 3, 8, WHITE);
    R(x, 2, 14 + b + walk, 1, 8, WHITE_SHADE);
    R(x, 2, 21 + b + walk, 3, 2, c);
    if (frame === 2) {
      R(x, 19, 4, 3, 11, WHITE);
      R(x, 21, 4, 1, 11, WHITE_SHADE);
      R(x, 19, 2, 3, 3, c);
    } else {
      R(x, 19, 14 + b - walk, 3, 8, WHITE);
      R(x, 21, 14 + b - walk, 1, 8, WHITE_SHADE);
      R(x, 19, 21 + b - walk, 3, 2, c);
    }
    // helmet, visor with a gold sheen and a reflection
    R(x, 8, b, 8, 1, WHITE);
    R(x, 7, 1 + b, 10, 1, WHITE);
    R(x, 6, 2 + b, 12, 8, WHITE);
    R(x, 7, 10 + b, 10, 1, WHITE);
    R(x, 8, 11 + b, 8, 1, WHITE);
    R(x, 15, 2 + b, 3, 8, WHITE_SHADE);
    R(x, 8, b, 3, 1, WHITE_HI);
    R(x, 7, 1 + b, 2, 1, WHITE_HI);
    R(x, 6, 4 + b, 1, 3, c);
    R(x, 8, 3 + b, 8, 6, "#3a2a14");
    R(x, 9, 4 + b, 6, 4, "#8a5f1c");
    R(x, 9, 4 + b, 6, 1, "#d8a040");
    R(x, 9, 4 + b, 2, 2, "#ffe0a0");
    R(x, 8, 12 + b, 8, 1, c);
  });
}

let crew: HTMLCanvasElement[][] | null = null;
/** [role][frame], in the lobby's role order */
export function astronauts(): HTMLCanvasElement[][] {
  crew ??= ROLES.map((role) => [0, 1, 2, 3, 4].map((f) => astronaut(ROLE_COLOUR[role], shade(ROLE_COLOUR[role], 0.62), f)));
  return crew;
}

let rover: HTMLCanvasElement[] | null = null;
export function roverFrames(): HTMLCanvasElement[] {
  rover ??= [0, 1].map((f) =>
    sprite(46, 22, (x) => {
      R(x, 6, 6, 34, 8, "#d8dce4");
      R(x, 6, 6, 34, 1, "#ffffff");
      R(x, 6, 12, 34, 2, "#9aa2b2");
      R(x, 6, 9, 34, 1, "#f08c32");
      R(x, 2, 2, 14, 8, "#c8ccd4");
      R(x, 2, 2, 14, 1, "#ffffff");
      R(x, 3, 4, 8, 4, "#2a5a7a");
      R(x, 3, 4, 3, 1, "#8ad8ff");
      R(x, 34, 0, 1, 6, "#7a8292");
      R(x, 32, 0, 5, 2, "#4a5262");
      for (const wx of [4, 18, 32]) {
        R(x, wx, 14, 8, 8, "#2a2e38");
        R(x, wx + 1, 15, 6, 6, "#4a505c");
        R(x, f ? wx + 3 : wx + 4, f ? 17 : 18, 1, 1, "#9aa2b2");
        R(x, f ? wx + 4 : wx + 3, f ? 18 : 17, 1, 1, "#6a7282");
      }
    }),
  );
  return rover;
}

let phobos: HTMLCanvasElement | null = null;
export function phobosSprite(): HTMLCanvasElement {
  phobos ??= sprite(11, 7, (x) => {
    R(x, 1, 1, 9, 5, "#6a5a52");
    R(x, 0, 2, 11, 3, "#6a5a52");
    R(x, 1, 1, 5, 2, "#9a887c");
    R(x, 7, 4, 3, 2, "#3e342e");
    R(x, 4, 3, 1, 1, "#4a3e38");
  });
  return phobos;
}

/** Earth as a dithered, lit sphere; the Moon's sky shows it, and so does the hull camera */
export function earthSphere(r: number): HTMLCanvasElement {
  const [c, x] = make(r * 2 + 2, r * 2 + 2);
  const d = x.createImageData(c.width, c.height);
  const a = d.data;
  const L = [-0.55, -0.6, 0.58];
  for (let y = 0; y < c.height; y++) {
    for (let X = 0; X < c.width; X++) {
      const nx = (X - r - 1) / r;
      const ny = (y - r - 1) / r;
      const rr = nx * nx + ny * ny;
      if (rr > 1) continue;
      const nz = Math.sqrt(1 - rr);
      let lum = clamp(nx * L[0] + ny * L[1] + nz * L[2]);
      const lon = Math.atan2(nx, nz);
      const lat = Math.asin(ny);
      const sx = Math.cos(lat) * Math.sin(lon);
      const sy = Math.sin(lat);
      const sz = Math.cos(lat) * Math.cos(lon);
      const n = fbm(sx * 2.2 + 11, sy * 2.2, sz * 2.2, 5);
      const land = n > 0.53;
      let col: RGB = land ? mix(hex("#2e6a2a"), hex("#b89a5a"), clamp((n - 0.55) * 4)) : mix(hex("#0c2a6a"), hex("#1f5ab0"), clamp(nz));
      if (Math.abs(sy) > 0.9 + (fbm(sx * 6, sy * 6, sz * 6, 3) - 0.5) * 0.12) col = mix(hex("#dce8f4"), hex("#ffffff"), clamp(n));
      const cl = fbm(sx * 3, sy * 6, sz * 3 + 20, 4);
      if (cl > 0.56) col = mix(col, hex("#f4f8ff"), clamp((cl - 0.56) * 5));
      if (lum < 0.12 && land && fbm(sx * 30, sy * 30, sz * 30, 1) > 0.72) {
        col = hex("#ffd27a");
        lum = 1.1;
      }
      const q = lum * 4;
      const base = Math.floor(q);
      const band = clamp((base + (q - base > bayer(X, y) ? 1 : 0)) / 4, 0.06, 1.1);
      const o = (y * c.width + X) * 4;
      a[o] = col[0] * band;
      a[o + 1] = col[1] * band;
      a[o + 2] = col[2] * band;
      a[o + 3] = 255;
    }
  }
  x.putImageData(d, 0, 0);
  return c;
}

/** a habitat dome: three shades, panel seams and a band of lit windows */
export function dome(g: Ctx, cx: number, by: number, rw: number, rh: number, moon: boolean, t: number, seed: number, hash: (n: number) => number): void {
  const base = moon ? "#a8a8b0" : "#cfd4de";
  const hi = moon ? "#cacad2" : "#f2f4f8";
  const sh = moon ? "#6e6e78" : "#8e96a8";
  for (let r = 0; r <= rh + 1; r++) {
    const hw = Math.round((rw + 1) * Math.sqrt(Math.max(0, 1 - Math.pow(r / (rh + 1), 2))));
    R(g, cx - hw, by - r, hw * 2, 1, OUT);
  }
  for (let r = 0; r <= rh; r++) {
    const hw = Math.round(rw * Math.sqrt(Math.max(0, 1 - Math.pow(r / rh, 2))));
    const y = by - r;
    R(g, cx - hw, y, hw * 2, 1, base);
    if (r > rh * 0.3) R(g, cx - hw, y, Math.round(hw * 0.5), 1, hi);
    R(g, cx + Math.round(hw * 0.45), y, hw - Math.round(hw * 0.45), 1, sh);
    if (r % 8 === 5) R(g, cx - hw + 1, y, hw * 2 - 2, 1, sh);
  }
  const wy = by - Math.round(rh * 0.3);
  const hw = Math.round(rw * 0.92);
  for (let X = cx - hw + 6, k = 0; X < cx + hw - 8; X += 9, k++) {
    const on = hash(seed + k + Math.floor(t * 0.15 + hash(seed + k) * 9)) > 0.18;
    R(g, X, wy - 2, 4, 3, on ? "#ffd27a" : "#4a3a28");
    if (on) R(g, X, wy - 2, 4, 1, "#fff0c0");
  }
}

/** the gantry lattice, with 1 px struts; the crew arm sits `arm` px below the top and reaches `armLen` */
export function gantry(g: Ctx, x: number, y: number, h: number, t: number, arm = 30, armLen = 40): void {
  R(g, x, y - h, 14, h, "#2a3140");
  R(g, x + 24, y - h, 14, h, "#2a3140");
  g.strokeStyle = "#566078";
  g.lineWidth = 1;
  for (let k = 0; k < h; k += 24) {
    g.beginPath();
    g.moveTo(x + 0.5, y - k);
    g.lineTo(x + 37.5, y - k - 24);
    g.moveTo(x + 37.5, y - k);
    g.lineTo(x + 0.5, y - k - 24);
    g.stroke();
    R(g, x, y - k - 1, 38, 2, "#3a4458");
  }
  R(g, x + 2, y - h, 2, h, "#6a7690");
  R(g, x + 26, y - h, 2, h, "#6a7690");
  if (armLen > 0) {
    R(g, x + 38, y - h + arm, armLen, 5, "#3a4458");
    R(g, x + 38, y - h + arm, armLen, 1, "#7a86a0");
    R(g, x + 38, y - h + arm - 6, armLen, 1, "#566078");
  }
  const on = Math.sin(t * 4) > 0;
  R(g, x + 16, y - h - 6, 6, 6, on ? RED : "#5a1814");
  if (on) {
    g.globalAlpha = 0.25;
    R(g, x + 10, y - h - 12, 18, 18, RED);
    g.globalAlpha = 1;
  }
  if (armLen > 0) R(g, x + 36 + armLen, y - h + arm - 4, 3, 3, on ? "#5a1814" : RED);
}

/** the rocket on the pad: 48 wide, 168 tall, with the four slot colours on its upper stage */
export function padRocket(g: Ctx, x: number, y: number, flame: number, t: number, hatch: string): void {
  const w = 48;
  const h = 168;
  if (flame > 0) {
    for (let i = 0; i < 40; i++) {
      const k = i / 40;
      const fw = (1 - k) * 22 + 4;
      const col = k < 0.3 ? "#fff6d8" : k < 0.6 ? "#ffd27a" : "#ff7a2a";
      R(g, x - fw / 2 + Math.sin(t * 40 + i) * 2, y + 6 + ((i * flame) / 40) * 3, fw, 3, col);
    }
  }
  R(g, x - 14, y - 6, 28, 8, "#5a606c");
  R(g, x - 12, y + 2, 24, 4, "#3e444f");
  R(g, x - 10, y - 6, 4, 8, "#8a909c");
  g.fillStyle = "#c84a2a";
  g.beginPath();
  g.moveTo(x - 24, y - 4);
  g.lineTo(x - 36, y + 6);
  g.lineTo(x - 24, y - 40);
  g.fill();
  g.fillStyle = "#8a2e18";
  g.beginPath();
  g.moveTo(x + 24, y - 4);
  g.lineTo(x + 36, y + 6);
  g.lineTo(x + 24, y - 40);
  g.fill();
  const top = y - 6 - h;
  R(g, x - 24, top, w, y - 6 - top, "#dfe3ea");
  R(g, x - 24, top, 8, y - 6 - top, "#ffffff");
  R(g, x + 10, top, 14, y - 6 - top, "#aab2c0");
  R(g, x + 18, top, 6, y - 6 - top, "#8a92a2");
  for (let k = 1; k < 5; k++) {
    const sy = y - 6 - k * 34;
    if (sy > top) {
      R(g, x - 24, sy, w, 2, "#5a6272");
      R(g, x - 24, sy + 2, w, 1, "#f4f6fa");
    }
  }
  for (let k = 0; k < 12; k++) {
    const sy = y - 14 - k * 12;
    if (sy > top + 2) {
      R(g, x - 21, sy, 1, 1, "#8a92a2");
      R(g, x + 20, sy, 1, 1, "#6a7282");
    }
  }
  R(g, x - 14, y - 96, 10, 18, "#1a2030");
  R(g, x - 12, y - 94, 6, 6, "#2f5fc8");
  R(g, x - 12, y - 94, 2, 2, "#a8c8ff");
  R(g, x - 19, y - 97, 3, 3, OUT);
  R(g, x - 18, y - 96, 2, 2, hatch);
  R(g, x - 24, y - 72, w, 6, "#f08c32");
  ["#f08c32", "#5a96f5", "#e6ebf0", "#e6b946"].forEach((c, i) => R(g, x - 24 + i * 12, y - 124, 12, 3, c));
  g.fillStyle = "#e8ecf2";
  g.beginPath();
  g.moveTo(x - 24, top);
  g.lineTo(x + 24, top);
  g.lineTo(x, top - 46);
  g.fill();
  g.fillStyle = "#aab2c0";
  g.beginPath();
  g.moveTo(x + 4, top);
  g.lineTo(x + 24, top);
  g.lineTo(x, top - 46);
  g.fill();
  R(g, x - 2, top - 52, 3, 8, "#c8ccd4");
  R(g, x - 1, top - 54, 2, 2, RED);
}
