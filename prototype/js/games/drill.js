// Homestead surface game (S2-20): the ice drill, on the S2-19 frame (js/surface-games.js).
// Bore down to the ice holding the drill pressure inside a band with W/S. Too high jams the bit, too low stalls
// it; staying out of the band for more than half a second fails the attempt. The power part's torque sets the
// band's width (HS.PARTS[...].drill): a small solar array gives a narrow band, the RTG a wide one.
// Ported from the TypeScript version (src/missions/icedrill.ts): same numbers.
(() => {
  const HS = window.HS, g = HS.g;
  const { T, C, clamp } = HS;
  const PUSH = .7;          // pressure per second from holding W or S
  const DIG = 1 / 7;        // depth per second inside the band: about seven seconds of good drilling
  const GRACE = .5;         // seconds out of the band before the bit jams or stalls
  const CENTRE = .55, LAYERS = 6, WOBBLE = .12;
  const FALLBACK = .12;     // an empty power slot drills like the salvage cell
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // the push from the rock at the bit right now: + toward a jam, - toward a stall
  const rockPush = (d) => (d.layers[Math.min(LAYERS - 1, Math.floor(d.depth * LAYERS))] || 0) + Math.sin(d.t * 2.3) * WOBBLE;

  // soil colours from the surface art (js/report.js, js/surface-art.js)
  const SOIL = { mars: ['#c46a44', '#9a4a30', '#6e341f'], moon: ['#a0a4ae', '#7a7e8a', '#565a66'] };

  HS.surfaceGames.drill = {
    name: 'Ice drill',
    slot: 'power',
    label: (mid) => mid === 'mars' ? 'Drill for subsurface ice' : 'Drill for crater ice',
    brief: (mid) => mid === 'mars' ? 'drill for ice' : 'drill for polar ice',
    tip: 'RTG best',
    keys: '[W] lean on it  [S] ease off',
    fact: (mid) => mid === 'mars'
      ? 'Phoenix found water ice just under the Martian soil in 2008; its data is archived in NASA\'s Planetary Data System (pds.nasa.gov).'
      : 'LCROSS found water ice in a permanently shadowed crater near the Moon\'s south pole in 2009.',
    failNote: (d) => d.over === 'jam' ? 'The bit jammed: too much pressure. Try again.' : 'The bit stalled: too little pressure. Try again.',

    start(ctx) {
      // alternating pushes, so the driller has to keep correcting both ways
      const r = ctx.r, first = r() < .5 ? 1 : -1;
      const layers = Array.from({ length: LAYERS }, (_, i) => (i % 2 === 0 ? first : -first) * (.18 + r() * .2));
      return { pressure: CENTRE, depth: 0, centre: CENTRE, band: (ctx.P && ctx.P.drill) || FALLBACK, strain: 0, layers, t: 0, over: null };
    },

    update(d, dt) {
      d.t += dt;
      const lean = (HS.key('KeyW', 'ArrowUp') ? 1 : 0) - (HS.key('KeyS', 'ArrowDown') ? 1 : 0);
      d.pressure = clamp(d.pressure + (rockPush(d) + lean * PUSH) * dt, 0, 1);
      const off = d.pressure - d.centre;
      if (Math.abs(off) <= d.band / 2) {
        d.strain = Math.max(0, d.strain - dt * 2);
        d.depth = Math.min(1, d.depth + DIG * dt);
        if (Math.floor(d.t * 5) !== Math.floor((d.t - dt) * 5)) HS.sfx.weld();
        return d.depth >= 1 ? 'done' : 'playing';
      }
      d.strain += dt;
      if (d.strain >= GRACE) { d.over = off > 0 ? 'jam' : 'stall'; return 'failed'; }
      return 'playing';
    },

    draw(d, b, info) {
      const half = d.band / 2, off = d.pressure - d.centre, outside = Math.abs(off) > half;
      // the gauge on the left: jam zone up top, the green band, stall zone below
      const gx = b.x + 18, gy = b.y + 22, gw = 16, gh = b.h - 40, yOf = (v) => gy + gh * (1 - v);
      g.fillStyle = HS.rgba(C.red, .28); g.fillRect(gx, gy, gw, gh);
      g.fillStyle = HS.rgba(C.green, .6); g.fillRect(gx, yOf(d.centre + half), gw, yOf(d.centre - half) - yOf(d.centre + half));
      g.strokeStyle = C.muted; g.lineWidth = 1; g.strokeRect(gx + .5, gy + .5, gw - 1, gh - 1);
      T('PRESSURE', gx + gw / 2, gy - 12, 6.5, C.muted, { a: 'center', w: 600 });
      T('JAM', gx + gw / 2, gy - 3, 6.5, C.red, { a: 'center', w: 600 });
      T('STALL', gx + gw / 2, gy + gh + 9, 6.5, C.red, { a: 'center', w: 600 });
      const ny = Math.round(yOf(d.pressure));
      g.fillStyle = outside ? C.red : C.white; g.fillRect(gx - 4, ny - 1, gw + 8, 2);
      g.beginPath(); g.moveTo(gx - 6, ny - 4); g.lineTo(gx - 1, ny); g.lineTo(gx - 6, ny + 4); g.fill();
      // strain: how close the bit is to giving up
      if (d.strain > 0) HS.bar(gx - 2, gy + gh + 13, gw + 4, 3, d.strain / GRACE, C.red);

      // the cross-section on the right: soil layers down to the ice, the drill string and its bit
      const sx = b.x + 58, sw = b.w - 66, sy = b.y + 22, sh = b.h - 28, soil = SOIL[info.mission] || SOIL.mars;
      const iceH = Math.round(sh * .16), soilH = sh - iceH;
      g.fillStyle = soil[0]; g.fillRect(sx, sy, sw, 3);
      for (let i = 0; i < LAYERS; i++) { g.fillStyle = soil[1 + (i % 2)]; g.fillRect(sx, sy + 3 + (soilH - 3) * i / LAYERS, sw, (soilH - 3) / LAYERS + 1); }
      g.fillStyle = '#e8ecf2'; g.fillRect(sx, sy + soilH, sw, iceH);
      g.fillStyle = HS.rgba(C.cyan, .35); g.fillRect(sx, sy + soilH, sw, 2);
      T(info.mission === 'mars' ? 'WATER ICE' : 'POLAR ICE', sx + sw / 2, sy + soilH + iceH / 2 + .5, 7, C.ink, { a: 'center', b: 'middle', w: 700 });
      const bx = Math.round(sx + sw / 2), bitY = Math.round(sy + 3 + (soilH - 3) * d.depth);
      const shake = calm ? 0 : outside ? Math.round(Math.sin(d.t * 60) * 1.5) : Math.round(Math.sin(d.t * 30) * .6);
      g.fillStyle = '#b4bcca'; g.fillRect(bx - 9, sy - 7, 18, 7);
      g.fillStyle = '#e8ecf2'; g.fillRect(bx - 1 + shake, sy, 3, bitY - sy);
      g.fillStyle = outside ? C.red : C.amber;
      g.beginPath(); g.moveTo(bx - 4 + shake, bitY); g.lineTo(bx + 5 + shake, bitY); g.lineTo(bx + .5 + shake, bitY + 6); g.closePath(); g.fill();
      T(`depth ${Math.floor(d.depth * 100)}%`, sx + 4, sy + 12, 7.5, C.white, { w: 600 });
      if (outside) T(off > 0 ? 'Jamming! ease off [S]' : 'Stalling! lean on it [W]', sx + 4, sy + 23, 7.5, C.red, { w: 600 });
      T(`band ${Math.round(d.band * 100)}%`, b.x + b.w - 4, b.y + 10, 7, C.muted, { a: 'right' });
    }
  };
})();
