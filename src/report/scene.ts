import { PHASE_SECONDS } from "../core/phases";
import type { DeepReadonly, Scene } from "../core/scene";
import type { GameState, Slot } from "../core/state";
import { timeLeft } from "../core/timer";
import { MISSIONS, partData, partName } from "../data/data";
import { alpha, begin, box, easeInOut, seg, starfield, text, textWidth, typed, wrap } from "../ui/kit";
import { sfx } from "../ui/sfx";
import { C, SLOT_COLOUR, SLOT_NAME } from "../ui/tokens";
import { analyze, type Outcome, type Report } from "./analyze";

const OUTCOME_COLOUR: Record<Outcome, string> = { SUCCESS: C.green, "PARTIAL SUCCESS": C.amber, "MISSION FAILED": C.red };
const SLOTS: Slot[] = ["propulsion", "power", "comms", "payload"];

// one analysis per run: the log is complete by the time the report phase starts
let cached: { key: string; report: Report } | null = null;
// sounds that should play once per report
let played = { stamp: false, rows: -1, typing: 0 };

function reportFor(state: DeepReadonly<GameState>): Report {
  const key = `${state.seed}:${state.runStartedAt}:${state.log.length}`;
  if (!cached || cached.key !== key) cached = { key, report: analyze(state) };
  return cached.report;
}

interface Line {
  s: string;
  size: number;
  colour: string;
  weight?: number;
  at: number;
  y: number;
  x: number;
}

/** the mission report screen (S3-09) */
export const reportScene: Scene = {
  enter() {
    played = { stamp: false, rows: -1, typing: 0 };
  },
  draw(ctx, state, view) {
    const t = PHASE_SECONDS.report - timeLeft(state, view.now);
    const a = reportFor(state);
    const mission = MISSIONS[state.mission];
    const colour = OUTCOME_COLOUR[a.outcome];
    begin(ctx);
    starfield(ctx, t + 90, 0.2);

    const k = easeInOut(seg(t, 0, 0.45));
    ctx.globalAlpha = k;
    // the card sits below the HUD's corner; its contents move down with it
    box(ctx, 18, 26, 604, 316, C.crew, 6);
    ctx.translate(0, 10);
    const head = `MISSION REPORT  /  ${mission.name.toUpperCase()}  /  `;
    text(ctx, head, 36, 34, 8.5, C.crew, { weight: 600 });
    text(ctx, a.outcome, 36 + textWidth(ctx, head, 8.5, { weight: 600 }), 34, 8.5, colour, { weight: 600 });
    text(ctx, `seed ${state.seed}`, 604, 34, 7.5, C.muted, { align: "right" });
    ctx.strokeStyle = "#22324a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(36, 42);
    ctx.lineTo(604, 42);
    ctx.moveTo(384, 52);
    ctx.lineTo(384, 306);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // left column: the headline, the chain back to the choice, then the real mission
    const lines: Line[] = [];
    let y = 62;
    let at = 0.5;
    const add = (s: string, size: number, colour: string, x: number, weight?: number, cps = 90) => {
      for (const part of wrap(ctx, s, 372 - x, size, { weight })) {
        lines.push({ s: part, size, colour, weight, at, y, x });
        at += part.length / cps;
        y += size + 4;
      }
    };
    add(a.headline, 9.5, C.white, 36, 600);
    y += 4;
    const chainTop = y;
    for (const c of a.chain) add(c, 8, "#d5dde6", 46);
    const chainBottom = y;
    if (a.also.length > 0) {
      y += 4;
      for (const c of a.also) add(c, 7.5, C.muted, 46);
    }
    const realY = y + 12;
    const realAt = at + 0.3;
    let typing = 0;
    for (const ln of lines) {
      if (t < ln.at) continue;
      const shown = typed(ln.s, t - ln.at, 90);
      typing += shown.length;
      text(ctx, shown, ln.x, ln.y, ln.size, ln.colour, { weight: ln.weight ?? 500 });
    }
    if (typing > played.typing) {
      if (Math.floor(typing / 4) !== Math.floor(played.typing / 4)) sfx.type();
      played.typing = typing;
    }
    if (t > (lines.find((l) => l.y >= chainTop)?.at ?? 99)) {
      ctx.fillStyle = "#3a4a62";
      ctx.fillRect(38, chainTop - 8, 2, chainBottom - chainTop);
    }
    if (a.real && t > realAt) {
      ctx.globalAlpha = seg(t, realAt, realAt + 0.4);
      box(ctx, 34, realY - 4, 340, Math.min(312 - realY, 22 + wrap(ctx, a.real.fact, 318, 7.5).length * 11), C.amber, 4, alpha(C.amber, 0.06));
      text(ctx, "WHAT REAL MISSIONS DO", 44, realY + 8, 7, C.amber, { weight: 600 });
      text(ctx, a.real.name, 368 - 4, realY + 8, 7, C.white, { weight: 600, align: "right" });
      wrap(ctx, a.real.fact, 318, 7.5).forEach((ln, i) => text(ctx, ln, 44, realY + 21 + i * 11, 7.5, "#e8dcc8"));
      ctx.globalAlpha = 1;
    }

    // right column: the build, the score rows, the score and the stamp
    const rx = 400;
    if (t > 0.3) {
      ctx.globalAlpha = seg(t, 0.3, 0.7);
      text(ctx, "YOUR BUILD", rx, 60, 7.5, C.muted, { weight: 600 });
      SLOTS.forEach((slot, i) => {
        const id = state.ship.slots[slot];
        const salvage = state.ship.salvaged.includes(slot) || !!partData(id)?.salvage;
        const yy = 75 + i * 12.5;
        ctx.fillStyle = SLOT_COLOUR[slot];
        ctx.fillRect(rx, yy - 6, 6, 6);
        text(ctx, id ? partName(id) : "empty", rx + 11, yy, 8, salvage || !id ? C.red : C.white, { weight: salvage ? 600 : 500 });
        text(ctx, SLOT_NAME[slot].toLowerCase(), 604, yy, 6.5, C.muted, { align: "right" });
      });
      if (state.ship.salvaged.length > 0) text(ctx, "red: salvage from a slot left empty", rx, 127, 6.5, C.red);
      ctx.globalAlpha = 1;
    }
    const rowsAt = 1.2;
    a.rows.forEach((r, i) => {
      const kk = t - rowsAt - i * 0.18;
      if (kk < 0) return;
      if (i > played.rows) {
        played.rows = i;
        sfx.tick();
      }
      const yy = 146 + i * 13;
      ctx.globalAlpha = seg(kk, 0, 0.2);
      text(ctx, r.label, rx, yy, 7.5, C.muted);
      text(ctx, r.detail, 560, yy, 7.5, C.white, { align: "right" });
      text(ctx, `+${r.points}`, 604, yy, 7.5, r.points ? C.green : "#6f7d8c", { weight: 600, align: "right" });
      ctx.globalAlpha = 1;
    });
    const scoreAt = rowsAt + a.rows.length * 0.18 + 0.3;
    if (t > scoreAt) {
      const kk = seg(t, scoreAt, scoreAt + 0.9);
      ctx.strokeStyle = "#22324a";
      ctx.beginPath();
      ctx.moveTo(rx, 244);
      ctx.lineTo(604, 244);
      ctx.stroke();
      text(ctx, "SCORE", rx, 258, 8, C.muted, { weight: 600 });
      text(ctx, String(Math.round(a.score * easeInOut(kk))), rx, 296, 38, C.white, { weight: 700, font: "pixel" });
      const st = seg(t, scoreAt + 0.6, scoreAt + 0.9);
      if (st > 0) {
        if (!played.stamp) {
          played.stamp = true;
          sfx.stamp();
          if (a.outcome === "SUCCESS") sfx.jingle();
          else if (a.outcome === "MISSION FAILED") sfx.sad();
        }
        ctx.save();
        ctx.translate(548, 280);
        ctx.rotate(-0.12);
        ctx.globalAlpha = st;
        const sc = 2 - st;
        ctx.scale(sc, sc);
        const w = textWidth(ctx, a.outcome, 9, { weight: 700, font: "pixel" }) + 14;
        ctx.fillStyle = "rgba(8,14,26,.85)";
        ctx.fillRect(-w / 2, -10, w, 20);
        ctx.strokeStyle = colour;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-w / 2, -10, w, 20);
        text(ctx, a.outcome, 0, 1, 9, colour, { weight: 700, align: "center", base: "middle", font: "pixel" });
        ctx.restore();
      }
    }

    // the footer: when the crew goes back to the lobby, and the seed to share
    const left = Math.ceil(timeLeft(state, view.now));
    if (Number.isFinite(left)) {
      text(ctx, `Back to the lobby in ${left} s`, 36, 326, 7.5, C.muted);
      text(ctx, "Same seed, same parts and events: share it to race another crew.", 604, 326, 7, C.dim, { align: "right" });
    }
    ctx.restore();
  },
};
