import { ROLES } from "../core/lobby";
import type { Role } from "../core/state";
import { calm } from "./kit";
import { Liftoff } from "./liftoff/scene";
import { ART_W, type Dest } from "./liftoff/math";
import { gameCanvas, onFrame, overlay } from "./overlay";
import { MONO, PIXEL } from "./tokens";

/**
 * The title behind seat 1's lobby form (S3-03): a 40-second film that loops while the form is on
 * screen. The homestead at dusk, the crew boarding, ignition, then a camera on the rocket's hull
 * riding it to orbit (src/ui/liftoff). It reads the form: the name you type floats over the first
 * astronaut, the role you take puts them in front, and a Moon mission flies the Moon's ascent.
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

  const replay = document.createElement("button");
  replay.type = "button";
  replay.className = "hs-replay";
  replay.textContent = "↻ Replay";
  replay.setAttribute("aria-label", "Replay the title film");
  root.append(replay);

  let film: Liftoff | null = null;
  let last = performance.now();

  replay.addEventListener("click", () => film?.replay());
  if (import.meta.env.DEV) {
    // dev server only: jump the film to a time, so a test script can look at any moment
    (window as unknown as { __hsTitle?: unknown }).__hsTitle = {
      seek: (t: number) => {
        film ??= new Liftoff(calm());
        film.replay();
        film.time = t;
      },
      get time() {
        return film?.time ?? 0;
      },
    };
  }

  onFrame((frame) => {
    const lobby = document.querySelector<HTMLElement>("#ui");
    // the lobby form shows before a run and while a host waits for the crew
    const show = !!lobby && !lobby.hidden && (!frame || frame.state.phase === "lobby");
    canvas.hidden = !show;
    replay.hidden = !show;
    document.body.classList.toggle("hs-in-lobby", show);
    if (!show) {
      last = performance.now();
      return;
    }

    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    film ??= new Liftoff(calm());

    // match the backing store to the displayed size, so text stays sharp
    const shown = gameCanvas()?.getBoundingClientRect();
    if (shown) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(shown.width * dpr);
      const h = Math.round(shown.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }

    // what the form says
    const role = lobby.querySelector<HTMLElement>('.lobby-roles button[aria-pressed="true"]')?.dataset.role as Role | undefined;
    const mission = lobby.querySelector<HTMLSelectElement>("#lobby-mission")?.value;
    const dest: Dest = mission === "moon" ? "moon" : "mars";
    film.setDest(dest);
    film.env.lead = { name: (lobby.querySelector<HTMLInputElement>("#lobby-name")?.value ?? "").trim(), role: role ? ROLES.indexOf(role) : -1 };

    film.prepare(4);
    const t = film.tick(dt);
    film.draw(t, dt);

    // the art is on a 1280 x 720 grid; show it as sharp pixels, then put the text on top at full resolution
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const scale = canvas.width / ART_W;
    ctx.imageSmoothingEnabled = scale < 1;
    ctx.drawImage(film.art, 0, 0, canvas.width, canvas.height);
    film.tx.flush(ctx, scale, PIXEL, MONO);
  });
}
