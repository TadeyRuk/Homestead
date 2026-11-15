// Homestead title film (liftoff), scene: ported to plain JS from src/ui/liftoff/scene.ts
// (Homestead main @ 6c3d22c, seat 3 UI). Only the TypeScript types were removed; every other line is
// the original. Classic script: reads its imports from, and adds its exports to, window.HS.liftoff.
(() => {
  const L = window.HS.liftoff;
  const { Particles, Prep, TextQueue, Flight, groundPhase, hullPrep, DEST, T, makeWorldRenderer, worldGen } = L;

  /**
   * The title's film, start to finish: 40 seconds that loop. The homestead at dusk, the crew boarding,
   * ignition, then a camera on the hull rides the rocket to orbit. One canvas, no image files.
   */
  class Liftoff {
    art;
    env;
    tx = new TextQueue();
    flight = new Flight();
    worlds = {};
    world = null;
    phase = 0;

    constructor(calm) {
      this.art = document.createElement("canvas");
      this.art.width = 1280;
      this.art.height = 720;
      const g = this.art.getContext("2d");
      if (!g) throw new Error("no 2d context");
      g.imageSmoothingEnabled = false;
      this.env = { g, tx: this.tx, fx: new Particles(), dest: "mars", calm, lead: { name: "", role: -1 } };
    }

    worldPrep(dest) {
      return (this.worlds[dest] ??= new Prep((self) => worldGen(self, dest, DEST[dest])));
    }

    /** everything that has to be built before the hull camera can run, as work to spread over frames */
    pending() {
      return [hullPrep, this.worldPrep(this.env.dest)].filter((p) => !p.done);
    }

    /** true once the cut to the hull camera can happen without a stall */
    get ready() {
      return this.pending().length === 0;
    }

    /** spend a few milliseconds on the heavy set-up */
    prepare(ms = 4) {
      const until = performance.now() + ms;
      for (const p of this.pending()) if (!p.step(until)) return;
    }

    /** switch Mars and the Moon; the film starts over, so the other world's textures build while the dusk plays */
    setDest(dest) {
      if (dest === this.env.dest) return;
      this.env.dest = dest;
      this.replay();
    }

    /** forget particles and per-run state, for a restart */
    restart() {
      this.flight.reset();
      this.env.fx.clear();
      this.phase = 0;
    }

    /** draw the frame for film time t (0 to 40) onto the art canvas, queueing the text for later */
    draw(t, dt) {
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
      this.flight.draw(this.env, t, dt, hullPrep.now(), this.worldPrep(this.env.dest).now(), this.world);
    }

    /** film time in seconds, 0 to 40 */
    time = 0;

    /**
     * Advance the film. It holds on the final countdown until the hull camera's pictures are built, so
     * the cut never stalls, and starts over (with fresh particles) when the 40 seconds are up.
     */
    tick(dt) {
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
    replay() {
      this.time = 0;
      this.restart();
    }
  }

  Object.assign(L, { Liftoff });
})();
