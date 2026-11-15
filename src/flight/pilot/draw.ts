import type { DeepReadonly, View } from "../../core/scene";
import type { GameState } from "../../core/state";
import { timeLeft } from "../../core/timer";
import { partName } from "../../data/data";
import { alpha, bar, begin, box, calm, clamp, hint, noise, px, starfield, tag, text, textWidth } from "../../ui/kit";
import { sfx } from "../../ui/sfx";
import { rocket } from "../../ui/sprites";
import { C, ROLE_COLOUR } from "../../ui/tokens";
import { debrisWarnings } from "../comms/link";
import { stationLabel } from "../stations";
import { createPilot, engineOf, FUEL_LOW, heaviness, type Pilot, SHIP_Y, shipHalf, SPEED_HIGH, SPEED_LOW } from "./pilot";

// the play field, on the 640 x 360 grid
const FX = 24;
const FW = 392;
const FY = 30;
const FH = 316;
const laneX = (x: number) => FX + FW / 2 + (x * FW) / 2;
const viewY = (y: number) => FY + y * FH;

// local, per tab: sparks, shake and the last hit count seen, so effects play on every screen
const sparks: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = [];
let seenHits = -1;
let shake = 0;
let flash = 0;
let last = 0;
let warned = false;

function rockShape(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, id: number, t: number): void {
  const rnd = noise(id + 7);
  const n = 7;
  const spin = t * (0.6 + rnd()) * (id % 2 ? 1 : -1);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = spin + (i / n) * Math.PI * 2;
    const k = r * (0.75 + rnd() * 0.35);
    ctx.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k);
  }
  ctx.closePath();
  ctx.fillStyle = "#6a6470";
  ctx.fill();
  ctx.strokeStyle = "#9a94a0";
  ctx.lineWidth = 1;
  ctx.stroke();
  px(ctx, x - r * 0.3, y - r * 0.3, Math.max(1, r * 0.3), Math.max(1, r * 0.3), "#4a4450");
}

export function drawPilot(ctx: CanvasRenderingContext2D, state: DeepReadonly<GameState>, view: View): void {
  const p = (state.flight.pilot as DeepReadonly<Pilot> | undefined) ?? createPilot();
  const now = view.now / 1000;
  const dt = last ? Math.min(0.1, Math.max(0, now - last)) : 0;
  last = now;

  // a new hit since the last frame: sparks, shake, a red flash and a thud
  if (seenHits >= 0 && p.hits > seenHits) {
    const sx = laneX(p.x);
    const sy = viewY(SHIP_Y) - 14;
    const r = noise(p.hits * 31);
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2;
      const v = 30 + r() * 90;
      sparks.push({ x: sx, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + r() * 0.5, c: ["#ffd27a", "#ff6a3c", "#fff0c8"][i % 3] });
    }
    if (!calm()) shake = 5;
    flash = calm() ? 0.12 : 0.3;
    sfx.hit();
  }
  seenHits = p.hits;

  begin(ctx);
  const sh = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  shake = Math.max(0, shake - dt * 18);
  ctx.translate(sh, sh * 0.5);
  starfield(ctx, now, 1 + p.speed * 4);

  // the field: a frame, centre line and the debris
  box(ctx, FX, FY, FW, FH, "#22324a", 4, "rgba(6,11,22,0.35)");
  ctx.save();
  ctx.beginPath();
  ctx.rect(FX, FY, FW, FH);
  ctx.clip();
  for (let i = 0; i < 12; i++) {
    const y = FY + ((i * 30 + now * 60 * p.speed) % FH);
    px(ctx, FX + FW / 2, y, 1, 10, "rgba(120,255,220,0.08)");
  }
  for (const rock of p.rocks) {
    const rr = (rock.r * FW) / 2;
    rockShape(ctx, laneX(rock.x), viewY(rock.y), rr, rock.id, now);
  }

  // the ship from outside: wider panels mean a wider target
  const sx = laneX(p.x);
  const sy = viewY(SHIP_Y);
  const half = (shipHalf(state) * FW) / 2;
  const panel = Math.max(0, half - 7);
  if (panel > 0) {
    const solar = state.ship.slots.power?.includes("solar");
    const colour = solar ? "#3a5ab4" : "#8a8e9a";
    px(ctx, sx - 4 - panel, sy - 26, panel, 9, colour);
    px(ctx, sx + 4, sy - 26, panel, 9, colour);
    for (let i = 1; i < panel; i += 4) {
      px(ctx, sx - 4 - panel + i, sy - 26, 1, 9, alpha("#ebf0f5", 0.25));
      px(ctx, sx + 4 + i, sy - 26, 1, 9, alpha("#ebf0f5", 0.25));
    }
  }
  const flame = p.thrust > 0 ? 14 + Math.sin(now * 40) * 4 : 5 + Math.sin(now * 30) * 1.5;
  rocket(ctx, sx, sy, 0.9, flame);
  if (p.thrust < 0) {
    px(ctx, sx - 7, sy - 34, 2, 4, "#fff0c8");
    px(ctx, sx + 5, sy - 34, 2, 4, "#fff0c8");
  }

  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.life -= dt;
    if (s.life <= 0) {
      sparks.splice(i, 1);
      continue;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    ctx.globalAlpha = clamp(s.life * 2);
    px(ctx, s.x, s.y, 2, 2, s.c);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // early warning: only while the comms link holds (seat 1's S4-05)
  const warnings = debrisWarnings(state as GameState, view.now);
  if (warnings.length > 0) {
    const secs = Math.max(0, Math.ceil((warnings[0].at - view.now) / 1000));
    if (Math.floor(now * 4) % 2 === 0) tag(ctx, `DEBRIS AHEAD IN ${secs} s  ·  LINK WARNING`, FX + FW / 2, FY + 18, C.amber, 8);
    if (!warned) sfx.warn();
    warned = true;
  } else warned = false;
  const inField = state.trouble.pilot === "Debris field";
  if (inField) tag(ctx, "DEBRIS FIELD  ·  STEER CLEAR", FX + FW / 2, FY + 18, C.red, 8);
  else if (!state.ship.linkLocked && warnings.length === 0) text(ctx, "No comms link: no early debris warning", FX + 8, FY + FH - 8, 7, C.dim);

  // the right column: speed, fuel, hull, engine
  const RX = 430;
  const RW = 190;
  box(ctx, RX, FY, RW, FH, "#22324a", 4);
  text(ctx, "TRANSFER SPEED", RX + 10, FY + 16, 7.5, C.muted, { weight: 600 });
  const sp = p.speed;
  const bandOk = sp >= SPEED_LOW && sp <= SPEED_HIGH;
  // a horizontal gauge from 0.5 to 1.5 with the target band shaded
  const gx = RX + 10;
  const gw = RW - 20;
  const gy = FY + 24;
  const gpos = (v: number) => gx + ((v - 0.5) / 1) * gw;
  box(ctx, gx, gy, gw, 14, undefined, 2, C.line);
  ctx.fillStyle = alpha(C.green, 0.22);
  ctx.fillRect(gpos(SPEED_LOW), gy, gpos(SPEED_HIGH) - gpos(SPEED_LOW), 14);
  px(ctx, gpos(1), gy - 2, 1, 18, C.green);
  px(ctx, gpos(sp) - 1.5, gy - 3, 3, 20, bandOk ? C.white : C.amber);
  text(ctx, `${Math.round(sp * 100)}% of target`, gx, gy + 28, 9, bandOk ? C.white : C.amber, { weight: 600 });
  text(ctx, bandOk ? "on the transfer" : sp < SPEED_LOW ? "slow: corrections burn fuel" : "fast: hits do more damage", gx, gy + 40, 7, bandOk ? C.green : C.amber);

  const fy = FY + 88;
  text(ctx, "FUEL", gx, fy, 7.5, C.muted, { weight: 600 });
  text(ctx, `${Math.round(state.ship.fuel * 100)}%`, gx + gw, fy, 8, state.ship.fuel < FUEL_LOW ? C.red : C.white, { align: "right", weight: 600 });
  bar(ctx, gx, fy + 5, gw, 7, state.ship.fuel, state.ship.fuel < FUEL_LOW ? C.red : C.amber);

  const hy = fy + 30;
  text(ctx, "HULL", gx, hy, 7.5, C.muted, { weight: 600 });
  text(ctx, `${Math.round(state.ship.hull * 100)}%`, gx + gw, hy, 8, state.ship.hull < 0.35 ? C.red : C.white, { align: "right", weight: 600 });
  bar(ctx, gx, hy + 5, gw, 7, state.ship.hull, state.ship.hull < 0.35 ? C.red : C.green);
  const names = ["PORT", "CORE", "STARBOARD"];
  const cw = (gw - 8) / 3;
  p.sections.forEach((v, i) => {
    const colour = v > 0.6 ? C.green : v > 0.3 ? C.amber : C.red;
    const x = gx + i * (cw + 4);
    box(ctx, x, hy + 17, cw, 22, colour, 3, alpha(colour, 0.1));
    text(ctx, names[i], x + cw / 2, hy + 26, 6, C.muted, { align: "center", weight: 600 });
    text(ctx, `${Math.round(v * 100)}%`, x + cw / 2, hy + 35, 7.5, colour, { align: "center", weight: 600 });
  });

  const ey = hy + 62;
  const engine = engineOf(state);
  const heavy = heaviness(state);
  text(ctx, "ENGINE", gx, ey, 7.5, C.muted, { weight: 600 });
  text(ctx, partName(engine.id), gx, ey + 13, 8.5, C.white, { weight: 600 });
  const steer = engine.steer === "pulse" ? "steers in fixed pulses" : engine.steer === "slow" ? "slow to answer the stick" : "smooth and responsive";
  text(ctx, steer, gx, ey + 25, 7, C.muted);
  text(ctx, heavy > 1.01 ? `heavy: turns ${Math.round((1 - 1 / heavy) * 100)}% slower, burns more` : "light enough to handle well", gx, ey + 37, 7, heavy > 1.01 ? C.amber : C.green);

  const ly = ey + 56;
  text(ctx, "ARRIVAL", gx, ly, 7.5, C.muted, { weight: 600 });
  const left = timeLeft(state, view.now);
  text(ctx, Number.isFinite(left) ? `landing in ${Math.ceil(left)} s` : "-", gx, ly + 13, 8.5, C.white, { weight: 600 });
  text(ctx, state.ship.linkLocked ? "link holds: early debris warning" : "link lost: no warning", gx, ly + 25, 7, state.ship.linkLocked ? C.crew : C.dim);

  // the station header, in place of the shell's plain label
  const me = state.players.find((x) => x.id === view.playerId);
  const label = stationLabel("pilot").toUpperCase();
  const lw = textWidth(ctx, label, 8.5, { weight: 600 }) + 16;
  box(ctx, FX, 6, lw, 17, ROLE_COLOUR.pilot, 4);
  text(ctx, label, FX + 8, 15, 8.5, ROLE_COLOUR.pilot, { weight: 600, base: "middle" });
  if (me && me.roles.length > 1) text(ctx, "[TAB] next station", FX + lw + 8, 15, 7.5, C.muted, { base: "middle" });

  if (flash > 0) {
    ctx.fillStyle = `rgba(255,60,60,${flash})`;
    ctx.fillRect(-10, -10, 660, 380);
    flash = Math.max(0, flash - dt * 1.2);
  }
  hint(ctx, "A/D steer   W thrust   S brake   ·   keep speed in the band, dodge debris");
  ctx.restore();
}
