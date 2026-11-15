import type { Input } from "../core/input";
import { PHASE_SECONDS } from "../core/phases";
import type { DeepReadonly, Scene } from "../core/scene";
import type { GameState } from "../core/state";
import { timeLeft } from "../core/timer";
import { MISSIONS } from "../data/data";
import { briefObjectives } from "../missions/objectives";
import { alpha, begin, box, easeInOut, hint, seg, starfield, text, textWidth, typed, wrap } from "./kit";
import { sfx } from "./sfx";
import { C, ROLE_COLOUR } from "./tokens";

const ROLE_SHORT = { pilot: "Pilot", engineer: "Engineer", comms: "Comms", science: "Science" } as const;

/** when the brief opened, in seconds since the phase began */
function elapsed(state: DeepReadonly<GameState>, now: number): number {
  return PHASE_SECONDS.brief - timeLeft(state, now);
}

// host side: who has pressed E to say they've read the card; reset as each brief starts
const ready = new Set<string>();

export function resetReady(): void {
  ready.clear();
}

/**
 * Host rule: when the whole crew has pressed E, the campus opens early. A solo player skips the
 * card with one press; a crew waits for everyone, or for the timer.
 */
export function briefRule(state: GameState, inputs: Record<string, Input>, now: number): void {
  // a moment's grace: presses in the first second don't count, so a key held from the lobby can't skip the card
  if (elapsed(state, now) <= 1) return;
  for (const p of state.players) if (inputs[p.id]?.interact) ready.add(p.id);
  const all = state.players.length > 0 && state.players.every((p) => ready.has(p.id));
  if (all && state.phaseEndsAt !== null) state.phaseEndsAt = Math.min(state.phaseEndsAt, now);
}

let typedChars = 0;

/** the mission card from Mission Control (S3-04) */
export const briefScene: Scene = {
  enter() {
    typedChars = 0;
  },
  draw(ctx, state, view) {
    const t = elapsed(state, view.now);
    const m = MISSIONS[state.mission];
    begin(ctx);
    starfield(ctx, t + 15, 0.3);

    // the card drops in and settles
    const k = easeInOut(seg(t, 0, 0.5));
    ctx.globalAlpha = k;
    ctx.translate(0, (1 - k) * 14);
    box(ctx, 48, 16, 544, 314, C.crew, 6);
    text(ctx, "MISSION CONTROL  /  INCOMING BRIEF", 66, 40, 8.5, C.crew, { weight: 600 });
    if (Math.floor(t * 2) % 2 === 0) {
      ctx.fillStyle = C.red;
      ctx.beginPath();
      ctx.arc(301, 37, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    text(ctx, "LIVE", 306, 40, 7, C.red, { weight: 600 });
    text(ctx, `seed ${state.seed}`, 574, 40, 7.5, C.muted, { align: "right" });
    text(ctx, m.name.toUpperCase(), 66, 70, 24, C.white, { weight: 700, font: "pixel" });

    // the card's rows type in one after another
    const rows: [string, string, string?][] = [
      ["DESTINATION", state.mission === "mars" ? "Mars" : "The Moon"],
      ["TRAVEL", m.travel],
      ["RADIO DELAY", `${m.radioDelay} each way`],
      ["CONDITIONS", m.fact],
      ["DATA NEEDED", `${state.data.target} units, uplinked at the lander`, C.amber],
      ["BUDGET", `${state.credits} credits, spent only at the kiosk`],
      ["SPACECRAFT", "None. Build one from what you find.", C.amber],
    ];
    let chars = 0;
    rows.forEach(([label, value, colour], i) => {
      const at = t - 0.4 - i * 0.35;
      if (at < 0) return;
      const y = 94 + i * 16;
      text(ctx, label, 66, y, 7.5, C.muted, { weight: 600 });
      const shown = typed(value, at, 60);
      chars += shown.length;
      text(ctx, shown, 150, y, 8.5, colour ?? C.white, { weight: colour ? 600 : 500 });
    });

    const objAt = t - 0.4 - rows.length * 0.35;
    if (objAt > 0) {
      text(ctx, "OBJECTIVES", 66, 222, 7.5, C.muted, { weight: 600 });
      let y = 222;
      // this seed's draw from the mission's pool (seat 2, S2-18), so the crew knows what to build for
      const drawn = briefObjectives(state.seed, state.mission, state.data.target || m.dataTarget);
      const lines = [...drawn.map((o) => `› ${o}`), `★ Bonus: ${m.bonus}`];
      lines.forEach((line, i) => {
        const at = objAt - i * 0.3;
        if (at < 0) return;
        for (const part of wrap(ctx, line, 210, 8)) {
          const shown = typed(part, at, 70);
          chars += shown.length;
          text(ctx, shown, 150, y, 8, i === lines.length - 1 ? C.pink : C.white);
          y += 11;
        }
      });
      const hazardAt = objAt - lines.length * 0.3;
      if (hazardAt > 0) {
        ctx.globalAlpha = k * seg(hazardAt, 0, 0.4);
        // pushed down if the drawn objectives wrap onto more lines than usual
        const hy = Math.max(300, y + 8);
        text(ctx, "HAZARD", 66, hy, 7.5, C.red, { weight: 600 });
        wrap(ctx, m.hazard, 210, 8).forEach((line, i) => text(ctx, line, 150, hy + i * 11, 8, C.white));
        ctx.globalAlpha = k;
      }
    }
    if (chars > typedChars) {
      if (chars - typedChars > 1 && Math.floor(chars / 3) !== Math.floor(typedChars / 3)) sfx.type();
      typedChars = chars;
    }

    // the right column: who is flying, and the keys
    ctx.strokeStyle = "#22324a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(382, 84);
    ctx.lineTo(382, 318);
    ctx.stroke();
    ctx.globalAlpha = k * seg(t, 0.8, 1.4);
    text(ctx, state.players.length === 1 ? "SOLO CREW" : `CREW OF ${state.players.length}`, 398, 94, 7.5, C.muted, { weight: 600 });
    let y = 110;
    for (const p of state.players) {
      const me = p.id === view.playerId;
      text(ctx, `${p.name}${me ? "  (you)" : ""}`, 398, y, 8.5, me ? C.crew : C.white, { weight: 600 });
      y += 6;
      let x = 398;
      for (const role of p.roles) {
        const label = ROLE_SHORT[role];
        const w = textWidth(ctx, label, 7, { weight: 600 }) + 10;
        if (x + w > 576) {
          x = 398;
          y += 14;
        }
        box(ctx, x, y, w, 11, ROLE_COLOUR[role], 3, alpha(ROLE_COLOUR[role], 0.12));
        text(ctx, label, x + w / 2, y + 6, 7, ROLE_COLOUR[role], { weight: 600, align: "center", base: "middle" });
        x += w + 4;
      }
      y += 26;
    }

    const keys: [string, string][] = [
      ["MOVE", "WASD or arrow keys"],
      ["E", "pick up, mount, buy, scan"],
      ["E AT PAD", "empty-handed: launch countdown"],
      ["Q", "mission and suit panel"],
      ["TAB", "next flight station"],
      ["M", "sound on or off"],
    ];
    const ky = Math.max(y + 6, 226);
    text(ctx, "CONTROLS", 398, ky, 7.5, C.muted, { weight: 600 });
    keys.forEach(([key, what], i) => {
      text(ctx, key, 398, ky + 14 + i * 12, 7, C.amber, { weight: 600 });
      text(ctx, what, 446, ky + 14 + i * 12, 7, C.white);
    });
    ctx.globalAlpha = 1;
    ctx.setTransform(ctx.getTransform().a, 0, 0, ctx.getTransform().d, 0, 0);

    // the way out: a ready prompt and the clock
    const left = Math.ceil(timeLeft(state, view.now));
    const solo = state.players.length <= 1;
    const prompt = solo ? `[E] go to the launch campus   ·   opens in ${left} s` : `[E] ready   ·   campus opens when everyone is, or in ${left} s`;
    if (t > 2) {
      ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 4);
      const w = textWidth(ctx, prompt, 8, { weight: 600 });
      box(ctx, 320 - w / 2 - 9, 345 - 8, w + 18, 16, C.amber, 4);
      text(ctx, prompt, 320, 345.5, 8, C.amber, { weight: 600, align: "center", base: "middle" });
      ctx.globalAlpha = 1;
    } else {
      hint(ctx, "Mission Control is on the line");
    }
    ctx.restore();
  },
};
