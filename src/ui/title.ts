import { begin, noise, seg, starfield, text } from "./kit";
import { gameCanvas, onFrame, overlay } from "./overlay";
import { planetLimb, rocket } from "./sprites";

/**
 * The title backdrop behind seat 1's lobby form (S3-03): the starfield, a rocket climbing past
 * Mars, and the name. It shows whenever the lobby form is on screen and no run is drawing.
 */
export function startTitle(): void {
  const root = overlay();
  if (!root) return;
  const canvas = document.createElement("canvas");
  canvas.className = "hs-title";
  canvas.setAttribute("aria-hidden", "true");
  root.append(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const sparks: { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string }[] = [];
  const r = noise(5);
  let t = 0;
  let last = performance.now();

  onFrame((frame) => {
    const lobby = document.querySelector<HTMLElement>("#ui");
    // the lobby form shows before a run and while a host waits for the crew
    const show = !!lobby && !lobby.hidden && (!frame || frame.state.phase === "lobby");
    canvas.hidden = !show;
    document.body.classList.toggle("hs-in-lobby", show);
    if (!show) return;

    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    t += dt;

    // match the backing store to the displayed size, so text stays sharp
    const game = gameCanvas();
    const shown = game?.getBoundingClientRect();
    if (shown) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(shown.width * dpr);
      const h = Math.round(shown.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }

    begin(ctx);
    starfield(ctx, t, 1.2);
    planetLimb(ctx, "mars", 470, 560, 260);

    const rx = 382 + Math.sin(t * 0.7) * 10;
    const ry = 300 - ((t * 14) % 420) + 120;
    if (r() < 0.9) {
      sparks.push({ x: rx + (r() - 0.5) * 4, y: ry + 4, vx: (r() - 0.5) * 8, vy: 30 + r() * 30, life: 0.7, max: 0.7, c: r() < 0.5 ? "#ff9a3c" : "#fff0c8" });
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life -= dt;
      if (s.life <= 0 || sparks.length > 200) {
        sparks.splice(i, 1);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      ctx.globalAlpha = Math.min(1, (s.life / s.max) * 1.6);
      ctx.fillStyle = s.c;
      ctx.fillRect(s.x, s.y, 2, 2);
    }
    ctx.globalAlpha = 1;
    rocket(ctx, rx, ry, 1.2, 8 + Math.sin(t * 30) * 3);

    ctx.globalAlpha = seg(t, 0.1, 1);
    text(ctx, "HOMESTEAD", 34, 92, 58, "#ffffff", { weight: 700, font: "pixel", base: "middle" });
    ctx.globalAlpha = seg(t, 0.6, 1.6);
    text(ctx, "Finish the mission Mission Control gives you,", 38, 134, 12, "#f1d9cf", { font: "pixel", base: "middle" });
    text(ctx, "so the crew can go home.", 38, 150, 12, "#f1d9cf", { font: "pixel", base: "middle" });
    ctx.globalAlpha = seg(t, 1, 2) * 0.8;
    text(ctx, "NASA Space Apps 2026 · Space Mission Design Game", 38, 344, 7, "#96a5b4");
    ctx.globalAlpha = 1;
    ctx.restore();
  });
}
