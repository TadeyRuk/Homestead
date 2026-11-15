import { ROLE_COLOUR } from "../tokens";
import { ROLES } from "../../core/lobby";
import { clamp } from "../kit";
import { astronauts, dome, earthSphere, gantry, padRocket, phobosSprite, roverFrames } from "./art";
import { type Ctx, type Env, type RGB, R, fbm2, hex, make, mix } from "./gfx";
import { CREW_T, ART_H, ART_W, type Dest, bayer, crewState, ease, hash, sstep } from "./math";
import { noise } from "../kit";

/**
 * Part one of the film: the homestead at dusk. Five layers slide at different speeds as the camera
 * drifts (far sky, mesas, dunes, the near ground, the base), the crew walks out and boards, and the
 * countdown runs. The far layers are 2 x 2 chunks; everything you could walk up to is 1 x 1.
 */

const OUT = "#0a0f1c";
const AMBER = "#ffb43c";
const RED = "#ff5a50";
const GREEN = "#6edc82";

interface Layers {
  sky: HTMLCanvasElement;
  mesas: HTMLCanvasElement;
  dunes: HTMLCanvasElement;
  ground: HTMLCanvasElement;
  beams: HTMLCanvasElement;
}
const cache: Partial<Record<Dest, Layers>> = {};

function buildLayers(dest: Dest): Layers {
  const moon = dest === "moon";
  const r = noise(moon ? 5 : 3);
  // the sky at 2 x 2 chunks; on Mars the glow round the set Sun is blue
  const [sky, sx] = make(660, 360);
  {
    const d = sx.createImageData(660, 360);
    const a = d.data;
    const stops: [number, RGB][] = (moon
      ? [[0, "#010206"], [0.6, "#03050b"], [1, "#070912"]]
      : [[0, "#060918"], [0.3, "#121834"], [0.5, "#272948"], [0.6, "#4a405a"], [0.68, "#7a5c64"], [0.75, "#9c7468"], [1, "#a87c6a"]]
    ).map(([s, h]) => [s as number, hex(h as string)]);
    for (let y = 0; y < 360; y++) {
      const ty = y / 360;
      let i = 0;
      while (i < stops.length - 2 && ty > stops[i + 1][0]) i++;
      const base = mix(stops[i][1], stops[i + 1][1], clamp((ty - stops[i][0]) / (stops[i + 1][0] - stops[i][0])));
      for (let X = 0; X < 660; X++) {
        let col = base;
        if (!moon) {
          const dx = (X - 140) / 190;
          const dy = (y - 232) / 70;
          const gl = Math.exp(-(dx * dx + dy * dy));
          const core = Math.exp(-(((X - 140) / 34) ** 2 + ((y - 236) / 12) ** 2));
          col = mix(col, [104, 156, 214], gl * 0.78);
          col = mix(col, [214, 236, 252], core * 0.85);
        }
        const bb = bayer(X, y);
        const o = (y * 660 + X) * 4;
        a[o] = Math.floor(col[0] / 5 + bb) * 5;
        a[o + 1] = Math.floor(col[1] / 5 + bb) * 5;
        a[o + 2] = Math.floor(col[2] / 5 + bb) * 5;
        a[o + 3] = 255;
      }
    }
    sx.putImageData(d, 0, 0);
  }
  // far mesas (Mars) or crater rims (Moon)
  const [mesas, mx] = make(760, 130);
  {
    const top = new Float32Array(760);
    let X = 0;
    let hcur = 40;
    while (X < 760) {
      const flat = 20 + r() * 70;
      const ht = moon ? 18 + r() * 30 : 24 + r() * 60;
      const ramp = moon ? 18 + r() * 20 : 3 + r() * 6;
      for (let k = 0; k < ramp && X < 760; k++, X++) top[X] = hcur + (ht - hcur) * (moon ? ease(k / ramp) : k / ramp);
      for (let k = 0; k < flat && X < 760; k++, X++) top[X] = ht + (moon ? Math.sin(k * 0.2) * 2 : r() < 0.2 ? 1 : 0);
      hcur = ht;
    }
    for (let x0 = 0; x0 < 760; x0++) {
      const t0 = Math.round(130 - top[x0]);
      const lit = x0 > 0 && top[x0] > top[x0 - 1] + 0.3;
      const shade = x0 > 0 && top[x0] < top[x0 - 1] - 0.3;
      for (let y = t0; y < 130; y++) {
        let col = moon ? "#46464e" : "#282036";
        if ((y - t0) % 7 < 2 && !moon) col = "#30263e";
        if (lit) col = moon ? "#a8a8b0" : "#4e4c6c";
        if (shade) col = moon ? "#24242a" : "#1e182a";
        if (y === t0) col = moon ? "#bebec6" : "#5c5476";
        R(mx, x0, y, 1, 1, col);
      }
    }
  }
  // dunes (Mars) or regolith swells (Moon)
  const [dunes, dx] = make(720, 52);
  for (let X = 0; X < 720; X++) {
    const tp = Math.round(22 + 9 * Math.sin(X / 37) + 5 * Math.sin(X / 13 + 1) + fbm2(X / 40, 0, 32, 2) * 8);
    const slope = (Math.cos(X / 37) * 9) / 37 + (Math.cos(X / 13 + 1) * 5) / 13;
    for (let y = tp; y < 52; y++) {
      let col = moon ? "#585860" : "#3a2830";
      if (slope > 0.1 && y < tp + 6) col = moon ? "#8c8c94" : "#563c3e";
      if (slope < -0.1 && y < tp + 8) col = moon ? "#38383e" : "#2c1e24";
      if (y === tp) col = moon ? "#a0a0a8" : "#684c4a";
      R(dx, X, y, 1, 1, col);
    }
  }
  // the near ground with rocks, at full 1 x 1 detail
  const GW = 1420;
  const GH = 250;
  const [ground, gx] = make(GW, GH);
  {
    const top = moon ? hex("#5c5c64") : hex("#3c2a30");
    const bot = moon ? hex("#8a8a92") : hex("#5c3c34");
    const at = (y: number) => mix(top, bot, Math.pow(y / GH, 0.8));
    for (let y = 0; y < GH; y++) R(gx, 0, y, GW, 1, `rgb(${at(y).map((v) => v | 0).join(",")})`);
    for (let i = 0; i < 12000; i++) {
      const X = (r() * GW) | 0;
      const Y = (r() * GH) | 0;
      const k = r() < 0.5 ? 1.12 : 0.88;
      R(gx, X, Y, 1, 1, `rgb(${at(Y).map((v) => (v * k) | 0).join(",")})`);
    }
    // the trodden path from the airlock to the gantry, and the rover's tracks
    for (let X = 410; X < 640; X++) for (let Y = 98; Y < 104; Y++) if (r() < 0.55) R(gx, X, Y, 1, 1, `rgb(${mix(top, bot, 0.42).map((v) => (v * 1.12) | 0).join(",")})`);
    for (const off of [0, 9]) {
      for (let X = 700; X < GW; X++) {
        const Y = 192 + off + Math.round(Math.sin(X / 90) * 4);
        R(gx, X, Y, 1, 1, `rgb(${mix(top, bot, 0.8).map((v) => (v * 0.78) | 0).join(",")})`);
      }
    }
    // rocks: three shades, an outline, and a shadow away from the light
    const zones = [[20, 20, 560, 105], [560, 70, 860, 120], [740, 110, 960, 196], [380, 92, 660, 112]];
    const free = (X: number, Y: number) => !zones.some(([a, b, c2, d]) => X > a && X < c2 && Y > b && Y < d);
    const shades = moon ? [hex("#c4c4ca"), hex("#94949c"), hex("#64646c")] : [hex("#8e5c48"), hex("#6a4036"), hex("#462a26")];
    const css = (c: RGB) => `rgb(${c.join(",")})`;
    for (let n = 0; n < 110; n++) {
      const Y = 20 + Math.pow(r(), 0.6) * (GH - 30);
      const X = r() * GW;
      if (!free(X, Y)) continue;
      const s = Math.max(3, Math.round((2 + r() * 6) * (0.4 + (Y / GH) * 1.3)));
      const hgt = Math.max(2, Math.round(s * (0.45 + r() * 0.25)));
      if (moon) {
        gx.fillStyle = "rgba(10,10,14,.75)";
        gx.fillRect(X + s, Y - 1, s * 3, 2);
      } else {
        gx.fillStyle = "rgba(0,0,0,.22)";
        gx.fillRect(X + 2, Y, s * 1.4, 1);
      }
      for (let pass = 0; pass < 2; pass++) {
        for (let yy = 0; yy <= hgt; yy++) {
          const hw = Math.round(s * Math.sqrt(1 - Math.pow((hgt - yy) / (hgt + 0.01), 2)) * 0.5) + (pass ? 0 : 1);
          const ry = Math.round(Y - hgt + yy);
          if (pass === 0) {
            R(gx, X - hw, ry - 1, hw * 2, 2, "#140c10");
            continue;
          }
          R(gx, X - hw, ry, hw * 2, 1, css(shades[1]));
          R(gx, X - hw, ry, Math.max(1, Math.round(hw * 0.7)), 1, css(yy < hgt * 0.6 ? shades[0] : shades[1]));
          R(gx, X + Math.round(hw * 0.4), ry, Math.max(0, hw - Math.round(hw * 0.4)), 1, css(shades[2]));
        }
      }
    }
  }
  // floodlight beams, dithered
  const [beams, bx] = make(ART_W, ART_H);
  {
    const beam = (lx: number, ly: number, ex: number, ey0: number, ey1: number) => {
      for (let y = Math.min(ly, ey0); y < ey1; y += 2) {
        for (let X = Math.min(lx, ex); X < Math.max(lx, ex); X += 2) {
          const k = (X - lx) / (ex - lx);
          if (k < 0 || k > 1) continue;
          const y0 = ly + (ey0 - ly) * k;
          const y1 = ly + 2 + (ey1 - ly - 2) * k;
          if (y < y0 || y > y1) continue;
          if ((1 - k * 0.7) * 0.3 > bayer(X >> 1, y >> 1)) {
            bx.fillStyle = "rgba(255,236,190,0.1)";
            bx.fillRect(X, y, 2, 2);
          }
        }
      }
    };
    beam(556, 448, 684, 352, 560);
    beam(846, 448, 716, 352, 560);
  }
  return { sky, mesas, dunes, ground, beams };
}

const STAR_LIST = (() => {
  const r = noise(7);
  return Array.from({ length: 260 }, () => ({ x: r() * ART_W, y: r() * ART_H, b: 0.4 + r() * 0.6, s: r() < 0.08 ? 2 : 1, p: r() * 6 }));
})();
function skyStars(g: Ctx, t: number, maxY: number, alpha: number, ox: number): void {
  for (const s of STAR_LIST) {
    if (s.y > maxY) continue;
    const v = (200 * s.b * (0.7 + 0.3 * Math.sin(t * 1.7 + s.p))) | 0;
    g.globalAlpha = alpha * clamp((maxY - s.y) / 80);
    R(g, s.x + ox, s.y, s.s, s.s, `rgb(${v},${v},${Math.min(255, v + 40)})`);
  }
  g.globalAlpha = 1;
}

let earthMoon: HTMLCanvasElement | null = null;

/** t is seconds on the title clock, 0 to 16.8 */
export function groundPhase(env: Env, t: number, dt: number): void {
  const { g, tx, fx, calm } = env;
  const moon = env.dest === "moon";
  const L = (cache[env.dest] ??= buildLayers(env.dest));
  const crew = astronauts();
  const say = (s: string, x: number, y: number, size: number, col: string, o = {}) => {
    tx.alpha = g.globalAlpha;
    tx.add(s, x, y, size, col, o);
  };
  const pan = Math.round(70 * ease(clamp(t / 14)));
  let shx = 0;
  let shy = 0;
  if (!calm && t > 14.9) {
    const a = Math.min(4, (t - 14.9) * 2.8);
    shx = Math.round((Math.random() - 0.5) * a * 2);
    shy = Math.round((Math.random() - 0.5) * a * 2);
  }
  g.save();
  g.translate(shx, shy);
  g.drawImage(L.sky, -Math.round(pan * 0.06) * 2 - 4, 0, 1320, 720);
  skyStars(g, t, moon ? 470 : 300, moon ? 1 : 0.55, -Math.round(pan * 0.06));
  if (moon) {
    earthMoon ??= earthSphere(26);
    g.drawImage(earthMoon, 640 - Math.round(pan * 0.06), 96);
  } else {
    g.drawImage(phobosSprite(), Math.round(196 + t * 4.2 - pan * 0.06), Math.round(132 - t * 0.6));
    R(g, 760 - Math.round(pan * 0.06), 86, 2, 2, "#e8e0d8");
  }
  g.drawImage(L.mesas, -Math.round(pan * 0.25) - 10, 210, 1520, 260);
  // a dust devil on the plain (Mars has them every afternoon)
  if (!moon && !calm) {
    const dx = 150 + t * 6 - pan * 0.4;
    for (let k = 0; k < 46; k++) {
      const y = 452 - k * 2;
      const w = 3 + k * 0.32;
      const ox = Math.sin(k * 0.21 - t * 3) * (2 + k * 0.08);
      g.globalAlpha = 0.16 * (1 - k / 46) + 0.04;
      R(g, dx + ox - w / 2, y, w, 2, "#b08a72");
    }
    g.globalAlpha = 1;
  }
  g.drawImage(L.dunes, -Math.round(pan * 0.5) - 10, 380, 1440, 104);
  g.drawImage(L.ground, -pan, 470);

  // ---- the base, at the ground's depth
  g.save();
  g.translate(-pan, 0);
  const lit = t < 15.2;
  // the greenhouse, with grow lights
  {
    const x0 = 40;
    const by = 534;
    const w = 156;
    const hh = 30;
    R(g, x0 - 1, by - hh - 1, w + 2, hh + 2, OUT);
    for (let y = 0; y < hh; y++) {
      const k = y / hh;
      const c = mix([120, 58, 138], [255, 140, 216], k * 0.8 + 0.1 * Math.sin(t * 1.3));
      R(g, x0, by - hh + y, w, 1, `rgb(${c.map((v) => v | 0).join(",")})`);
    }
    for (let X = x0 + 3; X < x0 + w - 3; X += 5) {
      const ph = 3 + ((X * 7) % 4);
      R(g, X, by - ph - 1, 4, ph, "#2e6a3a");
      R(g, X, by - ph - 1, 2, 1, "#6ac86a");
    }
    for (let X = x0; X < x0 + w; X += 10) R(g, X, by - hh, 1, hh, "#2a3442");
    R(g, x0, by - hh, w, 2, "#3a4a5a");
    R(g, x0, by - hh, w, 1, "#8aa0b4");
    for (let y = 1; y < 10; y++) for (let X = x0; X < x0 + w; X += 2) if ((1 - y / 10) * 0.55 > bayer(X >> 1, y)) R(g, X + (y & 1), by + y, 1, 1, "rgba(255,120,210,.5)");
  }
  // a second dome, with an antenna and a beacon
  dome(g, 492, 528, 30, 22, moon, t, 7, hash);
  R(g, 504, 476, 1, 30, "#7a8292");
  R(g, 502, 476, 5, 1, "#9aa2b2");
  R(g, 503, 473, 3, 3, Math.sin(t * 3) > 0 ? RED : "#5a1814");
  // the main habitat and its airlock tube
  dome(g, 300, 550, 64, 46, moon, t, 1, hash);
  R(g, 362, 524, 54, 27, OUT);
  R(g, 363, 525, 52, 25, moon ? "#a2a2aa" : "#c8ccd6");
  R(g, 363, 525, 52, 3, moon ? "#cacad2" : "#f2f4f8");
  R(g, 363, 544, 52, 6, moon ? "#6e6e78" : "#8e96a8");
  for (let X = 370; X < 410; X += 8) R(g, X, 530, 3, 2, "#ffd27a");
  const doorOpen = t > 1.0 && t < 4.4;
  R(g, 408, 528, 8, 22, doorOpen ? "#1a1208" : "#5a6272");
  if (doorOpen) R(g, 409, 529, 6, 20, "#ffcf6a");
  R(g, 404, 524, 3, 3, doorOpen ? GREEN : Math.sin(t * 2) > 0 ? AMBER : "#5a4010");
  // path lights chase towards the pad
  for (let k = 0; k < 9; k++) {
    const X = 428 + k * 20;
    const on = (((Math.floor(t * 7) - k) % 9) + 9) % 9 < 2;
    R(g, X, 578, 1, 4, "#5a6272");
    R(g, X - 1, 576, 3, 2, on ? "#fff0b0" : "#9a7a40");
  }
  // floodlight towers and their beams
  if (lit) g.drawImage(L.beams, 0, 0);
  for (const X of [552, 848]) {
    R(g, X + 1, 448, 2, 124, "#3a4458");
    R(g, X - 3, 443, 10, 6, OUT);
    R(g, X - 2, 444, 8, 4, lit ? "#fff4d0" : "#5a5040");
  }
  // the pad, the gantry and the rocket
  g.fillStyle = moon ? "#6e6e76" : "#4a4050";
  g.beginPath();
  g.ellipse(700, 574, 118, 16, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = moon ? "#86868e" : "#5a5064";
  g.beginPath();
  g.ellipse(700, 572, 108, 12, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#f2c040";
  g.setLineDash([8, 6]);
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(700, 573, 92, 9, 0, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  const armLen = Math.round(28 * (1 - sstep(11.6, 12.8, t)));
  gantry(g, 610, 572, 270, t, 186, armLen);
  // the lift car
  const car = t < CREW_T.liftA ? 572 : t < CREW_T.liftB ? 572 + (486 - 572) * ease((t - CREW_T.liftA) / (CREW_T.liftB - CREW_T.liftA)) : t < 11.5 ? 486 : 486 + (572 - 486) * clamp((t - 11.5) / 2);
  R(g, 616, car - 36, 1, 36, "#7a86a0");
  R(g, 633, car - 36, 1, 36, "#7a86a0");
  R(g, 616, car - 36, 18, 1, "#7a86a0");
  R(g, 616, car, 18, 2, "#9aa4bc");
  R(g, 623, car - 39, 4, 2, "#ffd27a");
  const lift = t > 16 ? Math.pow(t - 16, 2) * 70 : 0;
  const flame = t > 15 ? (t < 16 ? Math.min(9, (t - 15) * 30) : Math.min(42, 9 + (t - 16) * 60)) : 0;
  padRocket(g, 700, Math.round(566 - lift), flame, t, t > CREW_T.hatch ? (Math.sin(t * 6) > -0.6 ? GREEN : "#1a5a2a") : RED);
  // the crew walks out to board; the lobby player's role leads, and their name floats over them
  const lead = env.lead.role;
  const order = lead >= 0 ? [lead, ...[0, 1, 2, 3].filter((i) => i !== lead)] : [0, 1, 2, 3];
  order.forEach((ri, k) => {
    const c = crewState(t, k);
    if (!c) return;
    const fr = c.walk ? 3 + (Math.floor(t * 8 + k) % 2) : Math.floor(t * 1.5 + k) % 2;
    g.globalAlpha = 0.3;
    R(g, c.x - 9, c.y - 1, 18, 2, "#000");
    g.globalAlpha = 1;
    g.drawImage(crew[ri][fr], Math.round(c.x - 13), Math.round(c.y - 33));
    if (k === 0 && env.lead.name) {
      // text is drawn on the display canvas, so shift it by the pan and shake here
      say("▼ " + env.lead.name, Math.round(c.x) - pan + shx, Math.round(c.y - 38) + shy, 12, ROLE_COLOUR[ROLES[ri]], { align: "center", shadow: "#000", sd: 1 });
    }
  });
  // the relay dish, turning slowly
  {
    const X = 880;
    const Y = 540;
    const w = Math.max(3, Math.round(4 + 12 * Math.abs(Math.cos(t * 0.3))));
    R(g, X - 1, Y - 24, 3, 26, "#4a5262");
    R(g, X - 1, Y - 24, 1, 26, "#7a8292");
    R(g, X - w - 1, Y - 37, w * 2 + 2, 16, OUT);
    R(g, X - w, Y - 36, w * 2, 14, moon ? "#c0c0c8" : "#e8ecf2");
    R(g, X, Y - 36, w, 14, moon ? "#8a8a92" : "#aab2c0");
    R(g, X, Y - 31, 1, 1, Math.sin(t * 5) > 0 ? RED : "#5a1814");
  }
  // the solar field, reflecting the sky
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 5; i++) {
      const X = 756 + i * 34 + j * 6;
      const Y = 598 + j * 18;
      R(g, X - 1, Y - 1, 32, 9, OUT);
      R(g, X, Y, 30, 7, "#1d2a5a");
      for (let q = 6; q < 30; q += 6) R(g, X + q, Y, 1, 7, "#2f4a9a");
      R(g, X, Y + 3, 30, 1, "#2f4a9a");
      R(g, X, Y, 30, 1, moon ? "#7a8296" : "#8ab4e8");
      R(g, X + 6, Y + 7, 1, 4, "#4a5262");
      R(g, X + 22, Y + 7, 1, 4, "#4a5262");
    }
  }
  // the rover crawls home with its beacon on
  {
    const rx = Math.round(1010 - clamp(t / 15) * 250);
    g.drawImage(roverFrames()[Math.floor(rx / 3) % 2], rx, 644);
    R(g, rx + 34, 642, 2, 2, Math.sin(t * 7) > 0 ? AMBER : "#5a4010");
    for (let k = 0; k < 14; k++) for (let y = 0; y < 6; y++) if ((1 - k / 14) * 0.5 > bayer(k, y)) R(g, rx - 2 - k * 2, 652 + y - (k >> 2), 2, 1, "rgba(255,244,200,.35)");
    if (!moon && !calm && Math.random() < 0.3) fx.add(rx + 44 - pan, 664, 10 + Math.random() * 14, -4 - Math.random() * 6, 1.2, "#8a6050", 2);
  }
  // pennants flutter in the thin Martian wind; on the Moon a rod holds the flag out
  for (const X of [532, 912]) {
    R(g, X, 534, 1, 40, "#9aa2b2");
    for (let c = 0; c < 14; c++) {
      const hgt = moon ? 9 : Math.max(1, Math.round(9 * (1 - c / 15)));
      const oy = moon ? 0 : Math.round(Math.sin(t * 5 + c * 0.6) * 1.2);
      R(g, X + 1 + c, 535 + oy + (moon ? 0 : Math.round((9 - hgt) / 2)), 1, hgt, c < 5 ? "#78ffdc" : "#ffb43c");
    }
    if (moon) R(g, X + 1, 534, 14, 1, "#c8ccd4");
  }
  g.restore();

  // venting before launch; dust and fire at ignition
  if (!calm) {
    const rate = t > 11 ? 0.9 : 0.35;
    if (t < 15 && Math.random() < rate) {
      const sd = Math.random() < 0.5 ? -1 : 1;
      fx.add(700 - pan + sd * 25, 420 + Math.random() * 20, sd * (8 + Math.random() * 14) + (moon ? 0 : 10), moon ? -4 : -10 - Math.random() * 10, moon ? 0.7 : 2.2, Math.random() < 0.5 ? "#e8eef4" : "#c4ccd8", 3, 0, moon ? 14 : 4);
    }
    if (!moon && Math.random() < 0.5) fx.add(-10, 480 + Math.random() * 200, 30 + Math.random() * 30, (Math.random() - 0.5) * 6, 9, "#a07a64", 1);
    if (t > 15) {
      for (let k = 0; k < 6; k++) {
        const sd = Math.random() < 0.5 ? -1 : 1;
        fx.add(700 - pan + sd * (10 + Math.random() * 30), 570 + Math.random() * 8, sd * (60 + Math.random() * 160), -Math.random() * 30, 2.4, moon ? (Math.random() < 0.5 ? "#a0a0a8" : "#c8c8d0") : Math.random() < 0.5 ? "#b08a72" : "#d8b090", 4 + ((Math.random() * 5) | 0), 0, 14);
      }
    }
  }
  fx.step(g, dt);
  if (t > 15) {
    const k = clamp((t - 15) * 1.4);
    g.globalCompositeOperation = "lighter";
    const gr = g.createRadialGradient(700 - pan, 570, 0, 700 - pan, 570, 280);
    gr.addColorStop(0, `rgba(255,170,90,${0.55 * k})`);
    gr.addColorStop(1, "rgba(255,120,40,0)");
    g.fillStyle = gr;
    g.fillRect(0, 280, ART_W, 440);
    g.globalCompositeOperation = "source-over";
  }
  // the nearest boulders slide fastest
  for (const [X, Y, s] of [[110, 716, 46], [560, 724, 30]]) {
    const xx = X - Math.round(pan * 1.3);
    g.fillStyle = OUT;
    g.beginPath();
    g.ellipse(xx, Y, s + 1, s * 0.55 + 1, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = moon ? "#7c7c84" : "#4e2e28";
    g.beginPath();
    g.ellipse(xx, Y, s, s * 0.55, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = moon ? "#a8a8b0" : "#6e4436";
    g.beginPath();
    g.ellipse(xx - s * 0.25, Y - s * 0.12, s * 0.6, s * 0.36, 0, Math.PI, 0);
    g.fill();
  }
  g.restore();

  // words: the name, the field note, the countdown
  const tf = 1 - sstep(10.4, 11.2, t);
  if (tf > 0) {
    g.globalAlpha = tf * clamp(t * 1.5);
    say("HOMESTEAD", 52, 132, 88, "#ffffff", { pixel: true, weight: 700, shadow: "#0a0f1c", sd: 6 });
    g.globalAlpha = tf * clamp((t - 0.6) * 1.2);
    say("Finish the mission Mission Control gives you,", 58, 168, 20, "#f1d9cf", { pixel: true, weight: 500, shadow: "#1a1030", sd: 2 });
    say("so the crew can go home.", 58, 194, 20, "#f1d9cf", { pixel: true, weight: 500, shadow: "#1a1030", sd: 2 });
    const note = moon
      ? ["DAY 9 · 17:40 · MARE IMBRIUM HOMESTEAD", "Earth never rises or sets here. It hangs in one spot all month."]
      : ["SOL 412 · 18:52 LMST · JEZERO HOMESTEAD", "Martian sunsets are blue: fine dust sends blue light forward."];
    const n1 = Math.floor(clamp((t - 1.5) * 34, 0, note[0].length));
    const n2 = Math.floor(clamp((t - 3) * 34, 0, note[1].length));
    g.globalAlpha = tf;
    R(g, 40, 650, 2, 44, AMBER);
    say(note[0].slice(0, n1), 52, 666, 13, AMBER, { shadow: "rgba(0,0,0,.7)", sd: 1 });
    say(note[1].slice(0, n2), 52, 688, 13, "#e8ecf2", { weight: 500, shadow: "rgba(0,0,0,.7)", sd: 1 });
    say("NASA Space Apps 2026 · Space Mission Design Game", 1240, 704, 11, "#96a5b4", { align: "right", weight: 500, shadow: "rgba(0,0,0,.7)", sd: 1 });
    g.globalAlpha = 1;
  }
  if (t > 10.8) {
    const k = clamp((t - 10.8) * 3);
    const n = Math.max(0, Math.ceil(16 - t));
    g.globalAlpha = k;
    R(g, 40, 642, 2, 52, AMBER);
    say(t < 16 ? `T–00:0${n}` : "LIFTOFF", 52, 682, 40, t < 16 ? "#ffffff" : AMBER, { pixel: true, weight: 700, shadow: "rgba(0,0,0,.7)", sd: 3 });
    say(t < 13 ? "CREW ABOARD · ARM RETRACTING" : t < 15 ? "ALL STATIONS GO" : t < 16 ? "IGNITION" : "CLEAR OF THE TOWER", 54, 702, 12, AMBER, { shadow: "rgba(0,0,0,.7)", sd: 1 });
    g.globalAlpha = 1;
  }
}
