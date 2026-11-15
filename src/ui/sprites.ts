import { px } from "./kit";

type Ctx = CanvasRenderingContext2D;

/** the rocket from the walkthrough, standing on (x, y); k scales it, flame is the exhaust length */
export function rocket(ctx: Ctx, x: number, y: number, k = 1, flame = 0): void {
  const w = 9 * k;
  const h = 36 * k;
  if (flame > 0) {
    ctx.fillStyle = "#ff9a3c";
    ctx.beginPath();
    ctx.moveTo(x - w * 0.45, y);
    ctx.lineTo(x + w * 0.45, y);
    ctx.lineTo(x, y + flame);
    ctx.fill();
    ctx.fillStyle = "#fff0c8";
    ctx.beginPath();
    ctx.moveTo(x - w * 0.22, y);
    ctx.lineTo(x + w * 0.22, y);
    ctx.lineTo(x, y + flame * 0.6);
    ctx.fill();
  }
  px(ctx, x - w / 2, y - h, w, h, "#e2e5ec");
  px(ctx, x + w / 6, y - h, w / 3, h, "#b6bac4");
  ctx.fillStyle = "#e2e5ec";
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h);
  ctx.lineTo(x + w / 2, y - h);
  ctx.lineTo(x, y - h - 12 * k);
  ctx.fill();
  px(ctx, x - w / 2, y - h * 0.66, w, 1, "#40404c");
  px(ctx, x - w / 2, y - h * 0.22, w, 1, "#40404c");
  px(ctx, x + w / 2, y - h * 0.82, 3 * k, 4 * k, "#78ffdc");
  ctx.fillStyle = "#e8783c";
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - 8 * k);
  ctx.lineTo(x - w / 2 - 6 * k, y + 1);
  ctx.lineTo(x - w / 2, y);
  ctx.fill();
  ctx.fillStyle = "#c86432";
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y - 8 * k);
  ctx.lineTo(x + w / 2 + 6 * k, y + 1);
  ctx.lineTo(x + w / 2, y);
  ctx.fill();
}

/** a planet's limb along the bottom of the screen: Mars rust or Moon grey */
export function planetLimb(ctx: Ctx, mission: "moon" | "mars", cx: number, cy: number, r: number): void {
  const base = mission === "mars" ? ["#7a3a24", "#9a4a2a", "#b85e36"] : ["#4a4c52", "#6a6c72", "#8a8d94"];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = base[i];
    ctx.beginPath();
    ctx.arc(cx, cy + i * 3, r - i * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = mission === "mars" ? "rgba(255,170,120,.35)" : "rgba(220,230,255,.3)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
}
