// Homestead surface game (S5-11): solar panel cleaning, on the S2-19 frame (js/surface-games.js).
// Dust has settled on the lander's solar panels. Sweep a brush over them with WASD: each cell it touches comes
// clean, while dust keeps settling on every other cell. The panel makes power in proportion to how clean it is;
// at TARGET % the task is done. A dusty panel cannot keep the battery up, and if it runs flat the attempt fails.
// The power part sets the size of the job: one column per 50 W, so the large array has twice the panel of the
// small one. Only solar builds draw this task (the pool entry in js/data.js is marked solar).
(() => {
  const HS = window.HS, g = HS.g;
  const { T, C, clamp } = HS;
  const ROWS = 4;           // panel rows
  const W_PER_COL = 50;     // watts per panel column: salvage cell 5, small array 6, roll-out 11, large array 12
  const SPEED = 9;          // cells per second the brush moves
  const SETTLE = 2;         // dust points per second every uncovered cell gains
  const TARGET = 85;        // panel output % that finishes the task
  const DRAIN = .12;        // battery lost per second at zero output; none at full output
  const FALLBACK_W = 240;   // no power part: as big as the salvage cell
  // dust colours from the soil in the surface art (js/games/drill.js)
  const DUST = { mars: '#c46a44', moon: '#a0a4ae' };

  // panel output in %: 100 when every cell is clean
  const output = (d) => 100 - d.dust.reduce((a, v) => a + v, 0) / d.dust.length;
  const under = (d) => Math.round(d.y) * d.cols + Math.round(d.x);

  HS.surfaceGames.panels = {
    name: 'Panel cleaning',
    slot: 'power',
    label: () => 'Dust off the solar panels',
    brief: () => 'clean the solar panels',
    keys: '[W] [A] [S] [D] sweep the brush',
    fact: () => 'Wind cleaned the solar panels of Spirit and Opportunity and gave them power back. NASA\'s CubeSat 101 shows the power budget that dust eats.',
    failNote: () => 'The battery ran flat before the panels were clean. Try again.',
    eligible: (m) => !!(m.power && m.power.solar),

    start(ctx) {
      const r = ctx.r, cols = clamp(Math.round(((ctx.P && ctx.P.power) || FALLBACK_W) / W_PER_COL), 4, 12);
      const dust = Array.from({ length: cols * ROWS }, () => 60 + Math.floor(r() * 41));
      return { t: 0, cols, rows: ROWS, dust, x: 0, y: 0, acc: 0, batt: 1 };
    },

    update(d, dt) {
      d.t += dt;
      const a = HS.axis();
      d.x = clamp(d.x + a.x * SPEED * dt, 0, d.cols - 1);
      d.y = clamp(d.y + a.y * SPEED * dt, 0, d.rows - 1);
      // the brush wipes the cell under it
      const at = under(d);
      if (d.dust[at] > 0) { if (d.dust[at] >= 10) HS.sfx.weld(); d.dust[at] = 0; }
      // dust settles in whole points, so the state stays small in snapshots
      d.acc += SETTLE * dt;
      while (d.acc >= 1) { d.acc -= 1; for (let i = 0; i < d.dust.length; i++) if (i !== at) d.dust[i] = Math.min(100, d.dust[i] + 1); }
      const out = output(d);
      d.batt = Math.max(0, d.batt - (1 - out / 100) * DRAIN * dt);
      if (out >= TARGET) return 'done';
      return d.batt <= 0 ? 'failed' : 'playing';
    },

    draw(d, b, info) {
      const out = output(d), low = d.batt < .25, dust = DUST[info.mission] || DUST.mars, cell = HS.CAT.power;
      // power out of the panel against the target, and the battery it is meant to keep up
      T('OUTPUT', b.x + 6, b.y + 10, 6.5, C.muted, { w: 600 });
      HS.bar(b.x + 6, b.y + 15, 90, 5, out / 100, out >= TARGET ? C.green : C.cyan);
      g.fillStyle = C.white; g.fillRect(b.x + 6 + Math.round(90 * TARGET / 100), b.y + 13, 1, 9);
      T(`${Math.floor(out)}%`, b.x + 100, b.y + 20, 7, C.white, { w: 600 });
      T(`BATTERY ${Math.round(d.batt * 100)}%`, b.x + b.w - 6, b.y + 10, 6.5, low ? C.red : C.muted, { a: 'right', w: 600 });
      HS.bar(b.x + b.w - 96, b.y + 15, 90, 5, d.batt, low ? C.red : C.green);

      // the panel: blue cells in a dark frame, each under a layer of dust as thick as its dust number
      const cs = Math.min(18, Math.floor((b.w - 16) / d.cols)), gw = cs * d.cols, gh = cs * d.rows;
      const gx = Math.round(b.x + (b.w - gw) / 2), gy = Math.round(b.y + 30 + (b.h - 46 - gh) / 2);
      g.fillStyle = C.ink; g.fillRect(gx - 2, gy - 2, gw + 3, gh + 3);
      for (let i = 0; i < d.dust.length; i++) {
        const x = gx + (i % d.cols) * cs, y = gy + Math.floor(i / d.cols) * cs;
        g.fillStyle = cell; g.fillRect(x, y, cs - 1, cs - 1);
        g.fillStyle = HS.shade(cell, 1.35); g.fillRect(x, y, cs - 1, 1);
        if (d.dust[i] > 0) { g.fillStyle = HS.rgba(dust, d.dust[i] / 100 * .9); g.fillRect(x, y, cs - 1, cs - 1); }
      }
      // the brush: an outline on the cell it is wiping
      g.strokeStyle = C.white; g.lineWidth = 1;
      g.strokeRect(gx + Math.round(d.x) * cs - .5, gy + Math.round(d.y) * cs - .5, cs, cs);

      T(low ? 'Battery low: sweep the dustiest cells' : 'Dust keeps settling. Keep the brush moving', b.x + b.w / 2, b.y + b.h - 4, 7, low ? C.red : C.muted, { a: 'center', w: 600 });
    }
  };
})();
