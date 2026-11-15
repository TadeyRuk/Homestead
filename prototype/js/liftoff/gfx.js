// Homestead title film (liftoff), gfx: ported to plain JS from src/ui/liftoff/gfx.ts
// (Homestead main @ 6c3d22c, seat 3 UI). Only the TypeScript types were removed; every other line is
// the original. Classic script: reads its imports from, and adds its exports to, window.HS.liftoff.
(() => {
  const L = window.HS.liftoff;
  const { clamp, noise, bayer } = L;

  const lerpN = (a, b, t) => a + (b - a) * t;
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const rgb = (a) => `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})`;
  const mix = (a, b, t) => [lerpN(a[0], b[0], t), lerpN(a[1], b[1], t), lerpN(a[2], b[2], t)];

  function make(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    x.imageSmoothingEnabled = false;
    return [c, x];
  }

  /** a filled rectangle snapped to whole art pixels */
  const R = (x, X, Y, w, h, col) => {
    x.fillStyle = col;
    x.fillRect(X | 0, Y | 0, w | 0, h | 0);
  };

  /** a sprite drawn at 1x, then given a 1 px dark outline all round (ART-RULES.md rule 5) */
  function sprite(w, h, draw, outline = "#0a0f1c") {
    const [c, x] = make(w + 2, h + 2);
    x.save();
    x.translate(1, 1);
    draw(x);
    x.restore();
    const d = x.getImageData(0, 0, c.width, c.height);
    const a = d.data;
    const cw = c.width;
    const solid = (i) => a[i * 4 + 3] > 0;
    const add = [];
    for (let y = 0; y < c.height; y++) {
      for (let X = 0; X < cw; X++) {
        const i = y * cw + X;
        if (solid(i)) continue;
        if ((X > 0 && solid(i - 1)) || (X < cw - 1 && solid(i + 1)) || (y > 0 && solid(i - cw)) || (y < c.height - 1 && solid(i + cw))) add.push(i);
      }
    }
    const o = hex(outline);
    for (const i of add) {
      a[i * 4] = o[0];
      a[i * 4 + 1] = o[1];
      a[i * 4 + 2] = o[2];
      a[i * 4 + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    return c;
  }

  /** work too big for one frame runs a few milliseconds at a time */
  class Prep {
    done = false;
    value = null;
    it = null;
    constructor(fn) { this.fn = fn; }
    /** run until the clock reaches `until` (performance.now() ms); true when finished */
    step(until) {
      if (this.done) return true;
      this.it ??= this.fn(this);
      while (performance.now() < until) {
        if (this.it.next().done) {
          this.done = true;
          return true;
        }
      }
      return false;
    }
    /** finish now, blocking; for the rare frame that cannot wait */
    now() {
      if (!this.done) this.step(Infinity);
      return this.value;
    }
  }

  // ---------- noise: 3D value noise for hulls and planets, periodic 2D for tiling ground

  const PERM = (() => {
    const r = noise(42);
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = (r() * (i + 1)) | 0;
      [p[i], p[j]] = [p[j], p[i]];
    }
    return Uint8Array.from(p.concat(p));
  })();
  const fade = (t) => t * t * (3 - 2 * t);

  function vnoise(x, y, z) {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const Z = Math.floor(z);
    const fx = fade(x - X);
    const fy = fade(y - Y);
    const fz = fade(z - Z);
    const h = (i, j, k) => PERM[PERM[PERM[(X + i) & 255] + ((Y + j) & 255)] + ((Z + k) & 255)] / 255;
    const a = lerpN(lerpN(h(0, 0, 0), h(1, 0, 0), fx), lerpN(h(0, 1, 0), h(1, 1, 0), fx), fy);
    const b = lerpN(lerpN(h(0, 0, 1), h(1, 0, 1), fx), lerpN(h(0, 1, 1), h(1, 1, 1), fx), fy);
    return lerpN(a, b, fz);
  }
  function fbm(x, y, z, o = 4) {
    let v = 0;
    let a = 0.5;
    let f = 1;
    for (let i = 0; i < o; i++) {
      v += a * vnoise(x * f, y * f, z * f);
      f *= 2;
      a *= 0.5;
    }
    return v;
  }
  function vn2(x, y, per) {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const fx = fade(x - X);
    const fy = fade(y - Y);
    const x0 = ((X % per) + per) % per;
    const y0 = ((Y % per) + per) % per;
    const x1 = (x0 + 1) % per;
    const y1 = (y0 + 1) % per;
    const a = PERM[PERM[x0] + y0];
    const b = PERM[PERM[x1] + y0];
    const c = PERM[PERM[x0] + y1];
    const d = PERM[PERM[x1] + y1];
    return lerpN(lerpN(a, b, fx), lerpN(c, d, fx), fy) / 255;
  }
  /** tiling fractal noise: per is the tile period of the first octave */
  function fbm2(x, y, per, o) {
    let v = 0;
    let a = 0.5;
    let f = 1;
    let n = 0;
    for (let i = 0; i < o; i++) {
      v += a * vn2(x * f, y * f, per * f);
      n += a;
      f *= 2;
      a *= 0.5;
    }
    return v / n;
  }

  // ---------- particles

  class Particles {
    list = [];
    clear() {
      this.list.length = 0;
    }
    add(x, y, vx, vy, life, col, size = 2, grav = 0, grow = 0, o = {}) {
      if (this.list.length < 1400) this.list.push({ x, y, vx, vy, life, max: life, col, size, grav, grow, alpha: o.alpha ?? 1, round: !!o.round });
    }
    step(g, dt) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.list.splice(i, 1);
          continue;
        }
        p.vy += p.grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += p.grow * dt;
        g.globalAlpha = clamp((p.life / p.max) * 1.5) * p.alpha;
        if (p.round) {
          g.fillStyle = p.col;
          g.beginPath();
          g.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
          g.fill();
        } else R(g, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size, p.col);
      }
      g.globalAlpha = 1;
    }
  }

  // ---------- text is real text, drawn on the display canvas at screen resolution (ART-RULES.md rule 6)

  /** scenes queue their text while they draw art; the title flushes it over the scaled art */
  class TextQueue {
    cmds = [];
    /** the scene's current alpha, copied from the art context when text is queued */
    alpha = 1;
    add(s, x, y, size, col, o = {}) {
      this.cmds.push({ s, x, y, size, col, o, alpha: this.alpha });
    }
    clear() {
      this.cmds.length = 0;
    }
    flush(ctx, scale, pixelFont, monoFont) {
      ctx.save();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      for (const c of this.cmds) {
        ctx.globalAlpha = c.alpha;
        ctx.font = `${c.o.weight ?? 600} ${c.size}px ${c.o.pixel ? pixelFont : monoFont}`;
        ctx.textAlign = c.o.align ?? "left";
        ctx.textBaseline = c.o.base ?? "alphabetic";
        if (c.o.shadow) {
          ctx.fillStyle = c.o.shadow;
          ctx.fillText(c.s, c.x + (c.o.sd ?? 4), c.y + (c.o.sd ?? 4));
        }
        ctx.fillStyle = c.col;
        ctx.fillText(c.s, c.x, c.y);
      }
      ctx.restore();
      this.cmds.length = 0;
    }
  }

  Object.assign(L, { lerpN, hex, rgb, mix, make, R, sprite, Prep, vnoise, fbm, fbm2, Particles, TextQueue });
})();
