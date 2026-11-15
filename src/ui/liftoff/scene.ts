import { type Env, Particles, Prep, TextQueue } from "./gfx";
import { Flight } from "./flight";
import { groundPhase } from "./ground";
import { type HullData, hullPrep } from "./hull";
import { DEST, type Dest, T } from "./math";
import { type WorldRenderer, type WorldTex, makeWorldRenderer, worldGen } from "./world";

interface Work {
  done: boolean;
  step(until: number): boolean;
}

/**
 * The title's film, start to finish: 40 seconds that loop. The homestead at dusk, the crew boarding,
 * ignition, then a camera on the hull rides the rocket to orbit. One canvas, no image files.
 */
export class Liftoff {
  readonly art: HTMLCanvasElement;
  readonly env: Env;
  readonly tx = new TextQueue();
  private readonly flight = new Flight();
  private readonly worlds: Partial<Record<Dest, Prep<WorldTex>>> = {};
  private world: WorldRenderer | null = null;
  private phase = 0;

  constructor(calm: boolean) {
    this.art = document.createElement("canvas");
    this.art.width = 1280;
    this.art.height = 720;
    const g = this.art.getContext("2d");
    if (!g) throw new Error("no 2d context");
    g.imageSmoothingEnabled = false;
    this.env = { g, tx: this.tx, fx: new Particles(), dest: "mars", calm, lead: { name: "", role: -1 } };
  }

  private worldPrep(dest: Dest): Prep<WorldTex> {
    return (this.worlds[dest] ??= new Prep<WorldTex>((self) => worldGen(self, dest, DEST[dest])));
  }

  /** everything that has to be built before the hull camera can run, as work to spread over frames */
  private pending(): Work[] {
    return [hullPrep, this.worldPrep(this.env.dest)].filter((p) => !p.done);
  }

  /** true once the cut to the hull camera can happen without a stall */
  get ready(): boolean {
    return this.pending().length === 0;
  }

  /** spend a few milliseconds on the heavy set-up */
  prepare(ms = 4): void {
    const until = performance.now() + ms;
    for (const p of this.pending()) if (!p.step(until)) return;
  }

  /** switch Mars and the Moon; the film starts over, so the other world's textures build while the dusk plays */
  setDest(dest: Dest): void {
    if (dest === this.env.dest) return;
    this.env.dest = dest;
    this.replay();
  }

  /** forget particles and per-run state, for a restart */
  restart(): void {
    this.flight.reset();
    this.env.fx.clear();
    this.phase = 0;
  }

  /** draw the frame for film time t (0 to 40) onto the art canvas, queueing the text for later */
  draw(t: number, dt: number): void {
    const { g } = this.env;
    const ph = t < T.cut ? 0 : 1;
    if (ph !== this.phase) {
      this.env.fx.clear();
      this.flight.reset();
      this.phase = ph;
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    if (ph === 0) {
      groundPhase(this.env, t, dt);
      return;
    }
    this.world ??= makeWorldRenderer();
    this.flight.draw(this.env, t, dt, hullPrep.now() as HullData, this.worldPrep(this.env.dest).now(), this.world);
  }

  /** film time in seconds, 0 to 40 */
  time = 0;

  /**
   * Advance the film. It holds on the final countdown until the hull camera's pictures are built, so
   * the cut never stalls, and starts over (with fresh particles) when the 40 seconds are up.
   */
  tick(dt: number): number {
    if (this.env.calm) return (this.time = 7.5);
    const holding = !this.ready && this.time >= T.cut - 0.3 && this.time < T.cut;
    if (!holding) this.time += dt;
    if (this.time >= T.loop) {
      this.time -= T.loop;
      this.restart();
    }
    return this.time;
  }

  /** start the film from the top */
  replay(): void {
    this.time = 0;
    this.restart();
  }
}
