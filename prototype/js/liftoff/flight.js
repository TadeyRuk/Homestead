// Homestead title film (liftoff), flight: ported to plain JS from src/ui/liftoff/flight.ts
// (Homestead main @ 6c3d22c, seat 3 UI). Only the TypeScript types were removed; every other line is
// the original. Classic script: reads its imports from, and adds its exports to, window.HS.liftoff.
(() => {
  const L = window.HS.liftoff;
  const { clamp, noise, earthSphere, phobosSprite, R, make, ART_H, ART_W, EVENTS, RH, SKY_BODY, T, VP, bodyToCam, bump, flightState, lensProj, projBody, projWorldDir, projWorldPt, skyAt, sstep, w2b } = L;

  /**
   * Part two of the film: a camera bolted to the rocket's hull, looking aft. The booster and upper
   * stage are the pre-traced images from hull.ts; the world is world.ts; this file lays the effects
   * on top (plume, ice, vapour, the Sun and its flare) and the camera's own readouts.
   */

  const AMBER = "#ffb43c";
  const RED = "#ff5a50";

  const FSTARS = (() => {
    const r = noise(23);
    const out = [];
    for (let i = 0; i < 1600; i++) {
      const z = r() * 2 - 1;
      const a = r() * Math.PI * 2;
      const s = Math.sqrt(1 - z * z);
      out.push([s * Math.cos(a), z, s * Math.sin(a), 0.25 + Math.pow(r(), 3) * 0.75, r()]);
    }
    return out;
  })();

  const VIGNETTE = (() => {
    let c = null;
    return () => {
      if (c) return c;
      const [cv, x] = make(ART_W, ART_H);
      const gr = x.createRadialGradient(640, 360, 300, 640, 360, 820);
      gr.addColorStop(0, "rgba(0,0,0,0)");
      gr.addColorStop(1, "rgba(0,0,0,.62)");
      x.fillStyle = gr;
      x.fillRect(0, 0, ART_W, ART_H);
      c = cv;
      return c;
    };
  })();
  const HUDBAND = (() => {
    let c = null;
    return () => {
      if (c) return c;
      const [cv, x] = make(ART_W, 200);
      const gr = x.createLinearGradient(0, 0, 0, 200);
      gr.addColorStop(0, "rgba(0,0,0,.55)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = gr;
      x.fillRect(0, 0, ART_W, 200);
      c = cv;
      return c;
    };
  })();

  const piece = (g, p, a = 1) => {
    if (a <= 0) return;
    g.globalAlpha = a;
    g.drawImage(p.c, p.x, p.y);
    g.globalAlpha = 1;
  };

  /** the film's second half; keeps the ice and dust that live between frames */
  class Flight {
    ice = [];
    dust = (() => {
      const r = noise(4);
      return Array.from({ length: 80 }, () => ({ a: r() * Math.PI * 2, v: 0.4 + r() * 1.2, s: 10 + r() * 22 }));
    })();
    full = true;
    earthXs = null;

    /** call when the film restarts or the destination changes */
    reset() {
      this.ice.length = 0;
      this.full = true;
    }

    draw(env, t, dt, hull, tex, world) {
      const { g, fx, calm } = env;
      const st = flightState(t, env.dest);
      const moon = st.moon;
      const sep = t >= T.sepAt;
      world.render(st, tex, sep ? hull.maskB : hull.maskA, this.full);
      this.full = false;

      // the camera shakes at liftoff, in the thick air, and when the booster lets go
      let A = 0;
      if (!calm) {
        A += 3.4 * Math.exp(-(t - 16.8) * 0.8);
        if (!moon) A += 2.4 * bump(t, 21.4, 24.8);
        if (t > T.sepAt) A += 5 * Math.exp(-(t - T.sepAt) * 4);
        if (t > 29.6 && t < 35) A += 3 * Math.exp(-(t - 29.6) * 3) + 0.6;
      }
      g.save();
      g.translate(Math.round((Math.random() - 0.5) * 2 * A), Math.round((Math.random() - 0.5) * 2 * A));
      g.drawImage(world.canvas, 0, 0, ART_W, ART_H);

      // stars fixed to the sky, hidden by bright air
      for (const s of FSTARS) {
        const c = bodyToCam(w2b(st, s));
        if (c[2] < 0.05) continue;
        const pr = lensProj(c[0], c[1], c[2]);
        if (!pr) continue;
        const X = pr[0] | 0;
        const Y = pr[1] | 0;
        if (X < 0 || Y < 0 || X >= ART_W || Y >= ART_H) continue;
        const sk = skyAt(st, s);
        if (sk < 0 || sk > 0.26) continue;
        const v = (180 + 75 * s[4]) | 0;
        g.fillStyle = `rgba(${v},${v},255,${(1 - sk / 0.26) * s[3]})`;
        g.fillRect(X, Y, 1, 1);
      }
      // Phobos (Mars) or Earth (Moon) hanging in the sky
      {
        const dir = SKY_BODY[env.dest];
        const pr = projWorldDir(st, dir);
        const sk = skyAt(st, dir);
        if (pr && pr[0] > 0 && pr[1] > 0 && pr[0] < ART_W && pr[1] < ART_H && sk >= 0 && sk < 0.6) {
          this.earthXs ??= earthSphere(14);
          const im = moon ? this.earthXs : phobosSprite();
          g.drawImage(im, Math.round(pr[0] - im.width / 2), Math.round(pr[1] - im.height / 2));
        }
      }
      // the Sun, once it clears the horizon
      let sunPx = null;
      if (st.sunVis > 0) {
        const pr = projWorldDir(st, st.D.sun);
        if (pr && pr[0] > -200 && pr[0] < ART_W + 200 && pr[1] > -200 && pr[1] < ART_H + 200) {
          sunPx = pr;
          g.globalCompositeOperation = "lighter";
          const v = st.sunVis;
          const gr = g.createRadialGradient(pr[0], pr[1], 0, pr[0], pr[1], 230);
          gr.addColorStop(0, `rgba(255,250,235,${0.9 * v})`);
          gr.addColorStop(0.08, `rgba(220,235,255,${0.45 * v})`);
          gr.addColorStop(1, "rgba(120,160,255,0)");
          g.fillStyle = gr;
          g.fillRect(pr[0] - 230, pr[1] - 230, 460, 460);
          g.strokeStyle = `rgba(255,255,255,${0.35 * v})`;
          g.lineWidth = 1;
          for (let k = 0; k < 4; k++) {
            const a = (k * Math.PI) / 4 + 0.2;
            const l = 70 + 50 * (k % 2);
            g.beginPath();
            g.moveTo(pr[0] - Math.cos(a) * l, pr[1] - Math.sin(a) * l);
            g.lineTo(pr[0] + Math.cos(a) * l, pr[1] + Math.sin(a) * l);
            g.stroke();
          }
          g.globalCompositeOperation = "source-over";
          g.fillStyle = `rgba(255,255,255,${v})`;
          g.beginPath();
          g.arc(pr[0], pr[1], 4, 0, Math.PI * 2);
          g.fill();
        }
      }
      // dust thrown off the pad, seen from above
      if (st.h < 3) {
        const k = t - 15;
        for (const d of this.dust) {
          const rr = 0.012 + d.v * k * 0.011;
          const pr = projWorldPt(st, [Math.cos(d.a) * rr, st.D.Rp + 0.004 + d.v * k * 0.0016, Math.sin(d.a) * rr]);
          if (!pr) continue;
          const sz = Math.max(1.5, d.s * pr[2] * 0.001 * (1 + k * 0.4));
          g.globalAlpha = clamp(0.14 * (1 - st.h / 3) * (1 - k / 22));
          g.fillStyle = moon ? "#b0b0b8" : "#c0987a";
          g.beginPath();
          g.arc(pr[0], pr[1], Math.min(sz, 90), 0, Math.PI * 2);
          g.fill();
        }
        g.globalAlpha = 1;
      }
      const dayK = st.sunVis * 0.85 + (moon ? 0.15 : 0);
      const uP = t < 29.6 ? 0 : t < 35 ? Math.min(1, (t - 29.6) / 0.4) : Math.max(0, 1 - (t - 35) / 0.4);
      if (!sep) {
        this.plume(g, st, -28.6, 1.4, st.boost, t, false);
        piece(g, hull.bN);
        piece(g, hull.bD, dayK);
        if (st.boost > 0) {
          g.globalCompositeOperation = "lighter";
          piece(g, hull.bG, st.boost * (0.75 - dayK * 0.4));
          g.globalCompositeOperation = "source-over";
        }
        piece(g, hull.fr, 1 - sstep(17, 26, t));
      } else {
        // the spent booster tumbles away down the camera's view
        const k = t - T.sepAt;
        const sc = 14 / (14 + 2.2 * k * k + 1.5 * k);
        g.save();
        g.imageSmoothingEnabled = true;
        g.translate(VP[0] - k * 10, VP[1] + k * 4);
        g.rotate(k * 0.05);
        g.scale(sc, sc);
        g.translate(-VP[0], -VP[1]);
        g.globalAlpha = clamp(1.4 - k * 0.12);
        g.drawImage(hull.bN.c, hull.bN.x, hull.bN.y);
        g.globalAlpha = clamp(1.4 - k * 0.12) * dayK;
        g.drawImage(hull.bD.c, hull.bD.x, hull.bD.y);
        g.restore();
        g.globalAlpha = 1;
        g.imageSmoothingEnabled = false;
        this.plume(g, st, -6.9, 1.25, uP, t, true);
        piece(g, hull.nN);
        piece(g, hull.nD, dayK);
        const heat = uP > 0 ? sstep(29.6, 32.5, t) : t > 35 ? Math.max(0, 1 - (t - 35) / 3) : 0;
        g.globalCompositeOperation = "lighter";
        piece(g, hull.nH, heat * 0.95);
        g.globalCompositeOperation = "source-over";
      }
      piece(g, hull.uN);
      piece(g, hull.uD, dayK);
      this.flakes(env, st, hull, t, dt, sep);
      fx.step(g, dt);
      g.restore();

      // lens flare ghosts when the Sun is in frame
      if (sunPx && sunPx[0] > 0 && sunPx[0] < ART_W && sunPx[1] > 0 && sunPx[1] < ART_H) {
        const cx = 640 - sunPx[0];
        const cy = 360 - sunPx[1];
        const v = st.sunVis;
        g.globalCompositeOperation = "lighter";
        for (const [k, r, c, a] of [[0.5, 16, "255,180,90", 0.12], [0.9, 34, "120,200,255", 0.08], [1.3, 9, "255,255,255", 0.16], [1.7, 60, "170,130,255", 0.05], [2.05, 22, "120,255,200", 0.07]]) {
          const X = sunPx[0] + cx * k;
          const Y = sunPx[1] + cy * k;
          const gr = g.createRadialGradient(X, Y, 0, X, Y, r);
          gr.addColorStop(0, `rgba(${c},${a * v})`);
          gr.addColorStop(0.8, `rgba(${c},${a * v * 0.6})`);
          gr.addColorStop(1, `rgba(${c},0)`);
          g.fillStyle = gr;
          g.beginPath();
          g.arc(X, Y, r, 0, Math.PI * 2);
          g.fill();
        }
        const sg = g.createLinearGradient(sunPx[0] - 420, 0, sunPx[0] + 420, 0);
        sg.addColorStop(0, "rgba(140,190,255,0)");
        sg.addColorStop(0.5, `rgba(170,210,255,${0.35 * v})`);
        sg.addColorStop(1, "rgba(140,190,255,0)");
        g.fillStyle = sg;
        g.fillRect(sunPx[0] - 420, sunPx[1] - 1, 840, 2);
        g.globalCompositeOperation = "source-over";
      }
      g.drawImage(VIGNETTE(), 0, 0);
      this.readouts(env, t, st);
      // a white flash covers the cut from the pad, and a fade to black closes the loop
      if (t < T.cut + 0.35) {
        g.globalAlpha = clamp(1 - (t - T.cut) / 0.35);
        R(g, 0, 0, ART_W, ART_H, "#ffffff");
        g.globalAlpha = 1;
      }
      if (t > T.fadeOut) {
        g.globalAlpha = clamp((t - T.fadeOut) / 1.4);
        R(g, 0, 0, ART_W, ART_H, "#000000");
        g.globalAlpha = 1;
      }
    }

    /** the exhaust: soft glow discs along the plume, a hot core, and shock diamonds low down */
    plume(g, st, s0, re, power, t, vac) {
      if (power <= 0) return;
      const hk = sstep(1, 40, st.h);
      const tanA = vac ? 0.9 : 0.05 + (0.75 - 0.05) * hk;
      g.globalCompositeOperation = "lighter";
      const N = 34;
      const step = vac ? 3 : 2.6;
      for (let k = N - 1; k >= 0; k--) {
        const Ls = k * step;
        const pr = projBody([0, s0 - Ls, 0]);
        if (!pr) continue;
        const rad = (re + Ls * tanA) * pr[2] + 2;
        const a = power * (vac ? 0.07 : 0.2 + (0.07 - 0.2) * hk) * (1 - k / N) * (0.85 + 0.15 * Math.sin(t * 50 + k));
        const gr = g.createRadialGradient(pr[0], pr[1], 0, pr[0], pr[1], rad);
        const col = vac ? [190, 210, 255] : k < 4 ? [255, 240, 200] : [255, 150, 70];
        gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a})`);
        gr.addColorStop(0.5, `rgba(${col[0]},${(col[1] * 0.7) | 0},${(col[2] * 0.5) | 0},${a * 0.5})`);
        gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr;
        g.beginPath();
        g.arc(pr[0], pr[1], rad, 0, Math.PI * 2);
        g.fill();
      }
      const pe = projBody([0, s0, 0]);
      if (pe) {
        const rc = re * pe[2];
        const gr = g.createRadialGradient(pe[0], pe[1], 0, pe[0], pe[1], rc * 2.2);
        gr.addColorStop(0, `rgba(255,255,240,${0.9 * power})`);
        gr.addColorStop(0.4, `rgba(255,220,160,${0.5 * power})`);
        gr.addColorStop(1, "rgba(255,120,40,0)");
        g.fillStyle = gr;
        g.beginPath();
        g.arc(pe[0], pe[1], rc * 2.2, 0, Math.PI * 2);
        g.fill();
        if (!vac && st.h < 14) {
          for (let j = 1; j < 7; j++) {
            const pd = projBody([0, s0 - j * 3.1, 0]);
            if (!pd) continue;
            const rr = Math.max(1.5, 0.7 * pd[2]);
            g.fillStyle = `rgba(255,250,230,${0.5 * power * (1 - j / 7) * (1 - st.h / 14)})`;
            g.beginPath();
            g.ellipse(pd[0], pd[1], rr, rr * 0.7, 0, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
      g.globalCompositeOperation = "source-over";
    }

    /** ice shedding off the booster, vapour streaks at max-Q, and the puff at stage separation */
    flakes(env, st, hull, t, dt, sep) {
      const { g, fx, calm } = env;
      const moon = st.moon;
      if (!calm) {
        if (t < 24 && !sep && hull.pts.length) {
          for (let n = 0; n < 3; n++) {
            if (Math.random() < 0.6 * (1 - sstep(18, 24, t)) + 0.1) {
              const q = ((Math.random() * hull.pts.length) / 2 | 0) * 2;
              this.ice.push({ x: hull.pts[q], y: hull.pts[q + 1], v: 40 + Math.random() * 60, s: 2 + Math.random() * 2, c: Math.random() < 0.5 ? "#eef6ff" : "#bcd6f0", a: 1 });
            }
          }
        }
        if (!moon && t > 21.4 && t < 24.8 && !sep) {
          for (let n = 0; n < 6; n++) {
            const q = ((Math.random() * hull.edge.length) / 2 | 0) * 2;
            this.ice.push({ x: hull.edge[q] + Math.random() * 14, y: hull.edge[q + 1], v: 260 + Math.random() * 260, s: 1 + Math.random() * 2, c: "#ffffff", a: 0.3, streak: 10 + Math.random() * 26 });
          }
        }
        if (t > T.sepAt && t < T.sepAt + 0.25) {
          for (let k = 0; k < 4; k++) {
            const a = Math.random() * Math.PI * 2;
            const pr = projBody([Math.cos(a) * RH * 1.02, -3.3, Math.sin(a) * RH * 1.02]);
            if (pr && pr[0] > 0 && pr[0] < ART_W && pr[1] > 0 && pr[1] < ART_H) {
              fx.add(pr[0], pr[1], 60 + Math.random() * 160, (Math.random() - 0.5) * 120, 0.9, "#f4f8ff", 3, 0, 28, { round: true, alpha: 0.32 });
            }
          }
        }
      }
      for (let i = this.ice.length - 1; i >= 0; i--) {
        const p = this.ice[i];
        const dx = VP[0] - p.x;
        const dy = VP[1] - p.y;
        const l = Math.hypot(dx, dy);
        if (l < 10) {
          this.ice.splice(i, 1);
          continue;
        }
        p.v *= 1 + 2.5 * dt;
        const m = Math.min(l, p.v * dt);
        p.x += (dx / l) * m;
        p.y += (dy / l) * m;
        const s = Math.max(1, Math.round(p.s * Math.min(1, l / 300)));
        g.globalAlpha = p.a;
        if (p.streak) {
          const len = p.streak * Math.min(1, l / 200);
          g.strokeStyle = p.c;
          g.lineWidth = s;
          g.beginPath();
          g.moveTo(p.x, p.y);
          g.lineTo(p.x + (dx / l) * len, p.y + (dy / l) * len);
          g.stroke();
        } else R(g, p.x, p.y, s, s, p.c);
      }
      g.globalAlpha = 1;
    }

    /** the camera's own readouts: REC, T+, altitude, speed, the event caption, corner marks */
    readouts(env, t, st) {
      const { g, tx } = env;
      const say = (s, x, y, size, col, o = {}) => {
        tx.alpha = g.globalAlpha;
        tx.add(s, x, y, size, col, { shadow: "rgba(0,0,0,.65)", sd: 1, ...o });
      };
      g.drawImage(HUDBAND(), 0, 0);
      const ft = Math.max(0, t - T.cut + 0.8);
      if (Math.floor(t * 1.6) % 2 === 0) {
        g.fillStyle = RED;
        g.beginPath();
        g.arc(38, 37, 6, 0, Math.PI * 2);
        g.fill();
      }
      say("REC", 52, 42, 15, "#ffffff");
      say("CAM 3 · AFT HULL", 94, 42, 12, "rgba(255,255,255,.78)", { weight: 500 });
      const mm = Math.floor(ft / 60);
      const ss = (ft - mm * 60).toFixed(1).padStart(4, "0");
      say(`T+ 0${mm}:${ss}`, 30, 78, 20, "#ffffff", { pixel: true });
      say(`ALT  ${st.h < 1 ? (st.h * 1000).toFixed(0) + " m" : st.h.toFixed(st.h < 10 ? 2 : 1) + " km"}`, 30, 102, 14, "rgba(255,255,255,.9)");
      say(`VEL  ${st.v < 1 ? (st.v * 1000).toFixed(0) + " m/s" : st.v.toFixed(2) + " km/s"}`, 30, 122, 14, "rgba(255,255,255,.9)");
      for (const e of EVENTS[env.dest]) {
        if (t < e.from || t > e.to) continue;
        g.globalAlpha = Math.min(clamp((t - e.from) * 4), clamp((e.to - t) * 4));
        R(g, 30, 140, 3, 38, AMBER);
        say(e.head, 42, 158, 18, AMBER, { pixel: true, weight: 700 });
        say(e.sub, 42, 176, 12, "#ffffff", { weight: 500 });
        g.globalAlpha = 1;
      }
      say("4K · 60", 1250, 42, 12, "rgba(255,255,255,.78)", { align: "right", weight: 500 });
      for (let k = 0; k < 4; k++) R(g, 1166 + k * 6, 32, 4, 10, k < 3 ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.3)");
      g.strokeStyle = "rgba(255,255,255,.5)";
      g.lineWidth = 2;
      for (const [x, y, sx, sy] of [[16, 16, 1, 1], [1264, 704, -1, -1]]) {
        g.beginPath();
        g.moveTo(x, y + sy * 24);
        g.lineTo(x, y);
        g.lineTo(x + sx * 24, y);
        g.stroke();
      }
      say("HOMESTEAD", 1250, 696, 22, "rgba(255,255,255,.9)", { pixel: true, align: "right", weight: 700 });
      say(st.moon ? "LUNAR SURVEY · ASCENT" : "MARS SURVEY · ASCENT", 1250, 712, 10, "rgba(255,255,255,.7)", { align: "right", weight: 500, shadow: undefined });
    }
  }

  Object.assign(L, { Flight });
})();
