// S2-19: the panel a surface minigame draws into, over the player's own view only.
import type { DeepReadonly } from "../core/scene";
import type { MissionId, SurfaceGameRun } from "../core/state";
import { partName } from "../data/data";
import type { Box, SurfaceGame } from "../missions/games";
import { C, MONO } from "../ui/tokens";

/** how long the red "failed" flash stays up after an attempt fails, in seconds */
export const FAIL_FLASH_S = 1.2;

/** where the panel and the minigame's box sit on a screen this size */
export function overlayLayout(w: number, h: number): { panel: Box; game: Box } {
  const pw = Math.min(w - 32, 560);
  const ph = Math.min(h - 48, 340);
  const panel = { x: Math.round((w - pw) / 2), y: Math.round((h - ph) / 2), w: pw, h: ph };
  // a title row on top, keys and the fact line underneath
  const game = { x: panel.x + 16, y: panel.y + 52, w: pw - 32, h: ph - 52 - 58 };
  return { panel, game };
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

export function drawGameOverlay(
  ctx: CanvasRenderingContext2D,
  run: DeepReadonly<SurfaceGameRun>,
  def: SurfaceGame,
  mission: MissionId,
  now: number,
): void {
  const { width: w, height: h } = ctx.canvas;
  const { panel, game } = overlayLayout(w, h);
  const sinceFail = run.failedAt === null ? Infinity : (now - run.failedAt) / 1000;
  const flashing = sinceFail < FAIL_FLASH_S;

  // dim the world behind, so it reads as paused for this player (it is not: the clock still runs)
  ctx.save();
  ctx.fillStyle = "rgba(4, 8, 16, 0.55)";
  ctx.fillRect(0, 0, w, h);
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(panel.x, panel.y, panel.w, panel.h, 8);
  else ctx.rect(panel.x, panel.y, panel.w, panel.h);
  ctx.fillStyle = C.panel;
  ctx.fill();
  ctx.strokeStyle = flashing ? C.red : C.crew;
  ctx.lineWidth = flashing ? 3 : 2;
  ctx.stroke();

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.font = `700 15px ${MONO}`;
  ctx.fillStyle = C.crew;
  ctx.fillText(def.name.toUpperCase(), panel.x + 16, panel.y + 24);
  ctx.font = `500 11px ${MONO}`;
  ctx.fillStyle = C.muted;
  ctx.fillText(def.label(mission), panel.x + 16, panel.y + 41);
  ctx.textAlign = "right";
  ctx.fillStyle = C.white;
  ctx.fillText(`${partName(run.part)}${run.tries ? ` · attempt ${run.tries + 1}` : ""}`, panel.x + panel.w - 16, panel.y + 24);
  ctx.textAlign = "left";

  ctx.save();
  ctx.beginPath();
  ctx.rect(game.x, game.y, game.w, game.h);
  ctx.clip();
  def.draw(ctx, run.game as never, game, { mission, part: run.part, tries: run.tries, sinceFail });
  ctx.restore();

  const keysY = game.y + game.h + 18;
  ctx.font = `600 11px ${MONO}`;
  ctx.fillStyle = C.amber;
  ctx.fillText(def.keys, panel.x + 16, keysY);
  ctx.textAlign = "right";
  ctx.fillStyle = C.muted;
  ctx.fillText("Tab: leave", panel.x + panel.w - 16, keysY);
  ctx.textAlign = "left";
  const fact = def.fact?.(mission);
  if (fact) {
    ctx.font = `400 10px ${MONO}`;
    ctx.fillStyle = C.dim;
    wrapText(ctx, fact, panel.w - 32)
      .slice(0, 2)
      .forEach((line, i) => ctx.fillText(line, panel.x + 16, keysY + 17 + i * 13));
  }

  if (flashing) {
    ctx.globalAlpha = Math.min(1, (FAIL_FLASH_S - sinceFail) * 3);
    ctx.font = `700 18px ${MONO}`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#0b0e14";
    ctx.fillText("FAILED · try again", game.x + game.w / 2 + 1, game.y + 25);
    ctx.fillStyle = C.red;
    ctx.fillText("FAILED · try again", game.x + game.w / 2, game.y + 24);
  }
  ctx.restore();
}
