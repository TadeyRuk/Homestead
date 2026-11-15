// Homestead launch campus art, on the 1280 x 720 art grid (6 art pixels per world unit), in 3/4 view.
// Everything is a flat 2D sprite, but drawn as a solid: buildings show a roof and a tall front wall and rise
// above their footprint (you walk behind them), one sun from the top left lights every top and left edge,
// and every building, tree, pole and tank casts a long shadow to the bottom right, baked into the ground.
// The ground is a big floor fill, so it is drawn in 2 x 2 chunks; everything standing on it is 1 x 1 with a
// dark outline, depth-sorted by where it meets the ground. Built once, the first time the campus is shown.
// Collision and positions stay in js/world.js (HS.CAMPUS_SOLID, HS.PAD, HS.KIOSK); the moving life (crew,
// vehicles, birds, clouds, steam) is js/campus-life.js.
(() => {
  const HS = window.HS, L = HS.liftoff, U = HS.U;
  const { R, hex, mix, sprite, make, fbm2, bayer, noise } = L;
  const OUT = HS.ART_OUT;
  const css = (c) => `rgb(${c.map(v => Math.max(0, Math.min(255, v)) | 0).join(',')})`;
  // a tone of a colour: k < 1 darkens, k > 1 mixes toward white
  const tone = (c, k) => css(k <= 1 ? hex(c).map(v => v * k) : mix(hex(c), [255, 255, 255], k - 1));
  // the sun: a shadow moves this far (world units) per unit of height
  const SUN = [.78, .36];

  // ---------- the layout
  const ROADS = [[332, 33, 380, 62], [380, 62, 380, 380], [40, 210, 630, 210], [180, 118, 380, 118], [380, 270, 560, 296], [222, 210, 222, 270], [120, 210, 120, 380], [470, 210, 470, 148]];
  // worn dirt paths people actually walk: [x0, y0, x1, y1]
  const PATHS = [[470, 150, 455, 58], [274, 346, 274, 398], [60, 112, 60, 205], [154, 322, 120, 322]];
  const MANHOLES = [[150, 210], [300, 211], [520, 209], [380, 100], [380, 330], [120, 300]];
  const GRAVEL = [[484, 284, 126, 90], [420, 232, 62, 40], [66, 300, 88, 46], [10, 288, 54, 54]];
  const CARPARK = [392, 22, 88, 34];
  const MOWN = [[176, 124, 120, 70], [232, 222, 140, 50], [400, 66, 128, 64], [130, 286, 60, 60]];
  const BEDS = [[172, 109, 82, 3.4]];
  // buildings: footprint X, Y, w, h (world units, = collision), F = wall height, Rz = how far the roof rises
  // above the footprint (both world units)
  const BLD = [
    { k: 'tracking', X: 168, Y: 66, w: 88, h: 42, F: 15, Rz: 9 },
    { k: 'assembly', X: 300, Y: 100, w: 72, h: 90, F: 30, Rz: 14 },
    { k: 'hangar', X: 48, Y: 150, w: 124, h: 51, F: 21, Rz: 10 },
    { k: 'quarters', X: 196, Y: 280, w: 156, h: 63, F: 13, Rz: 7 }
  ];
  const hexIn = (u, v, cx, cy, r, sy) => { const dx = Math.abs(u - cx), dy = Math.abs(v - cy) / sy; return dy <= r * .866 && dx * .866 + dy * .5 <= r * .866; };
  // index access, not destructuring: these run millions of times while the ground is generated
  const inRect = (u, v, r) => u >= r[0] && u < r[0] + r[2] && v >= r[1] && v < r[1] + r[3];
  const hyp = (a, b) => Math.sqrt(a * a + b * b);   // Math.hypot is several times slower, and the ground calls this millions of times
  const segDist = (u, v, p) => { const x0 = p[0], y0 = p[1], dx = p[2] - x0, dy = p[3] - y0, t = Math.max(0, Math.min(1, ((u - x0) * dx + (v - y0) * dy) / (dx * dx + dy * dy))); return hyp(u - x0 - t * dx, v - y0 - t * dy); };
  const PADPATH = [380, 140, 506, 110];

  // ---------- the ground: 3 px per world unit, shown at 2x
  const K = 3;
  // a generator: it yields after every few rows so the work can be spread over frames (HS.campusPrewarm)
  function* buildGround(shadows) {
    const W = 640 * K, H = 400 * K;
    const [c, x] = make(W, H), d = x.createImageData(W, H), a = d.data;
    const grass = ['#2a5440', '#31624a', '#3a7054', '#447e5c', '#508c66', '#5e9a70'].map(hex);
    const asph = ['#3a3f47', '#41464e', '#474c54', '#4e535b'].map(hex), curb = hex('#a4aab4'), curbSh = hex('#5c626c'), dash = hex('#e8d070');
    const conc = ['#7c828c', '#868c96', '#9298a2', '#a2a8b2'].map(hex), seam = hex('#6a707a');
    const walk = ['#9298a0', '#9ca2aa', '#a8aeb6'].map(hex), walkEdge = hex('#6e747e');
    const dirt = ['#5a4a36', '#6a5840', '#7a684c', '#8a7858'].map(hex);
    const grav = ['#55524c', '#615e56', '#6c6960', '#7e7a70', '#45433e'].map(hex);
    const soil = hex('#3e2c1e'), white = hex('#e6eaf0');
    const set = (i, col) => { a[i] = col[0]; a[i + 1] = col[1]; a[i + 2] = col[2]; a[i + 3] = 255; };
    const segs = ROADS.map(([x0, y0, x1, y1]) => ({ x0, y0, dx: x1 - x0, dy: y1 - y0, l2: (x1 - x0) ** 2 + (y1 - y0) ** 2, len: hyp(x1 - x0, y1 - y0), u0: Math.min(x0, x1) - 6, u1: Math.max(x0, x1) + 6, v0: Math.min(y0, y1) - 6, v1: Math.max(y0, y1) + 6 }));
    const hash = (X, y) => { let h = (X * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    // colours parsed once, not per pixel
    const HX = {'#1e2026': hex('#1e2026'), '#2a2c32': hex('#2a2c32'), '#2a2e34': hex('#2a2e34'), '#2a2e36': hex('#2a2e36'), '#3a3c44': hex('#3a3c44'), '#3a3e46': hex('#3a3e46'), '#3e2c1e': hex('#3e2c1e'), '#3e9a52': hex('#3e9a52'), '#4a3424': hex('#4a3424'), '#4aa060': hex('#4aa060'), '#5a5e66': hex('#5a5e66'), '#5a5e68': hex('#5a5e68'), '#5c626c': hex('#5c626c'), '#5c626e': hex('#5c626e'), '#6a5a48': hex('#6a5a48'), '#6a707a': hex('#6a707a'), '#6e747e': hex('#6e747e'), '#a4aab4': hex('#a4aab4'), '#b4bac4': hex('#b4bac4'), '#d8dce4': hex('#d8dce4'), '#e6eaf0': hex('#e6eaf0'), '#e8c547': hex('#e8c547'), '#e8d070': hex('#e8d070'), '#f2c040': hex('#f2c040'), '#ff86c8': hex('#ff86c8'), '#ffd27a': hex('#ffd27a')};
    const BEDCOL = ['#ff86c8', '#ffd27a', '#ffffff', '#c890ff'].map(hex);
    const nRow = new Float32Array(640);
    for (let y = 0; y < H; y++) {
      for (let X = 0; X < W; X++) {
        const u = X / K, v = y / K, i = (y * W + X) * 4, bb = bayer(X, y);
        // grass: big soft patches, fine blades, dithered between greens; mown stripes near the buildings
        const ci = (X / K) | 0; if (y % K === 0 && X % K === 0) nRow[ci] = fbm2(X / 60, y / 60, 32, 3);
        const n = nRow[ci], f = fbm2(X / 5, y / 5, 384, 1);
        let gi = Math.floor(n * 6.2 - 1.2 + (f - .5) * 1.3 + bb);
        let mown = false; for (let k = 0; k < MOWN.length; k++) if (inRect(u, v, MOWN[k])) { mown = true; break; }
        if (mown) gi = Math.floor(n * 2.6 + 1.6 + (f - .5) * .5 + bb * .6) + (Math.floor((u + v * .25) / 7) % 2);
        let col = grass[Math.max(0, Math.min(5, gi))];
        // gravel beds: the fuel farm and the two yards, a low kerb round each (lit top, shadowed outer face)
        for (const g of GRAVEL) {
          if (u < g[0] - 1 || u >= g[0] + g[2] + 1 || v < g[1] - 1 || v >= g[1] + g[3] + 1.4) continue;
          const h = hash(X, y);
          col = grav[h < .08 ? 4 : h > .93 ? 3 : Math.min(2, Math.floor(f * 2.2 + bb * .9))];
          const inner = inRect(u, v, g);
          if (g === GRAVEL[0] && inner) {
            // the fuel farm stands on a concrete pad: slabs, expansion joints, stains, a drain grate per slab row
            const su = Math.floor((u - g[0]) / 9), sv = Math.floor((v - g[1]) / 9), lu = (u - g[0]) % 9, lv = (v - g[1]) % 9;
            col = conc[Math.min(3, Math.floor(hash(su, sv) * 1.6 + f * 1.4 + bb * .7))];
            if (fbm2(X / 16, y / 16, 77, 2) > .7) col = mix(col, [40, 36, 30], .3);
            if (lu < .34 || lv < .34) col = seam;
            if (su % 4 === 1 && lv > 3.6 && lv < 5.4 && lu > 3 && lu < 6) col = (X + y) % 2 ? HX['#2a2e34'] : HX['#5a5e66'];
          }
          if (!inner) col = (v >= g[1] + g[3] + .6) ? curbSh : curb;
          else if (u < g[0] + .7 || v < g[1] + .7) col = mix(col, [0, 0, 0], .25);   // the kerb's shadow inside
        }
        // dirt paths: worn into the lawn, soft at the edges
        for (const p of PATHS) { if (u < Math.min(p[0], p[2]) - 3 || u > Math.max(p[0], p[2]) + 3 || v < Math.min(p[1], p[3]) - 3 || v > Math.max(p[1], p[3]) + 3) continue; const dd = segDist(u, v, p); if (dd < 1.9 + (f - .5) * .8 && bb < 1.4 - dd * .55) col = dirt[Math.min(3, Math.floor(f * 3 + bb * .8 + (dd < .8 ? 1 : 0)))]; }
        // flowerbeds: dark soil and blooms
        for (const b of BEDS) if (inRect(u, v, b)) { col = v > b[1] + b[3] - .5 ? HX['#6a5a48'] : soil; const cl = Math.floor((u - b[0]) / 3), lu = (u - b[0]) % 3, h = hash(cl, 7); if (v < b[1] + b[3] - .5 && hyp(lu - 1.5, v - b[1] - 1.5) < 1.3) col = bb > .5 ? HX['#3e9a52'] : BEDCOL[Math.floor(h * 4)]; }
        // the runway along the top
        if (u >= 16 && u < 332 && v >= 22 && v < 44) {
          col = conc[Math.min(2, Math.floor(f * 2 + bb))];
          if (((u - 16) % 24) < .34 || v < 22.7) col = seam;
          if (v > 43.2) col = curbSh;
          if (v > 32.4 && v < 33.7 && (u - 26) % 16 < 7 && u > 26) col = white;
          if ((v > 23.6 && v < 24.3) || (v > 41.7 && v < 42.4)) col = HX['#d8dce4'];
          if (u < 30 && (Math.floor(v - 22) % 3) < 1.6 && v > 25 && v < 41) col = white;   // threshold bars
          if (fbm2(X / 14, y / 14, 137, 2) > .72) col = mix(col, [20, 20, 24], .35);   // tyre rubber
        }
        // the car park: asphalt, white bays, a kerb
        if (u >= CARPARK[0] - .8 && u < CARPARK[0] + CARPARK[2] + .8 && v >= CARPARK[1] - .8 && v < CARPARK[1] + CARPARK[3] + 1.2) {
          col = asph[Math.min(3, Math.floor(f * 2.6 + bb * .8))];
          const [cx0, cy0, cw, ch] = CARPARK, lu = u - cx0, lv = v - cy0;
          if (!inRect(u, v, CARPARK)) col = v > cy0 + ch ? curbSh : curb;
          else if (((lu % 11) < .5 && (lv < 13 || lv > 21)) || (Math.abs(lv - 13) < .3 && lu > 0) || (Math.abs(lv - 21) < .3 && lu > 0)) col = white;
          else if (fbm2(X / 9, y / 9, 211, 2) > .7) col = mix(col, [10, 10, 14], .3);
        }
        // the pad apron and the service apron under the slot bays
        if (hexIn(u, v, 545, 92, 46, .75)) {
          col = conc[Math.min(2, Math.floor(f * 2 + bb))];
          if ((Math.floor(u / 8) + Math.floor(v / 8)) % 2 && f > .45) col = conc[0];
          if (hexIn(u, v, 545, 92, 40, .75) && !hexIn(u, v, 545, 92, 38.6, .75)) col = ((Math.atan2(v - 92, u - 545) * 6 / Math.PI + 12) % 1) < .5 ? HX['#f2c040'] : HX['#2a2e36'];
          if (hexIn(u, v, 545, 92, 26, .75)) col = mix(HX['#5a5e66'], HX['#2a2c32'], Math.max(0, 1 - hyp(u - 545, (v - 96) * 1.4) / 26) * .9 + (f - .5) * .2);
          if (!hexIn(u, v, 545, 92, 45.2, .75) && v > 92) col = curbSh;
        }
        if (u >= 500 && u < 590 && v >= 144 && v < 170) { col = conc[1 + (bb > .5 ? 1 : 0)]; if (v < 144.7) col = HX['#b4bac4']; if (v > 168.6) col = HX['#5c626e']; if (Math.abs(((u - 509) % 18)) < .4 && v > 146 && v < 168) col = HX['#e8c547']; }
        if (u > 540 && u < 550 && v >= 102 && v < 144) { col = mix(HX['#3a3c44'], HX['#1e2026'], (u - 540) / 10); if (Math.floor(v * 3) % 4 === 0) col = HX['#5a5e68']; if (u < 540.7) col = HX['#a4aab4']; if (u > 549.3) col = curbSh; }
        // the path from the roundabout to the pad
        if (u > 375 && u < 511 && v > 104 && v < 146) { const dd = segDist(u, v, PADPATH); if (dd < 3.9) col = dd > 3.3 ? (v > 140 - (u - 380) * .238 ? curbSh : curb) : conc[1 + (f > .55 ? 1 : 0)]; }
        // pavements beside the main roads: raised, so the lit kerb is on top and the outer face is shaded
        const swE = v >= 214.5 && v < 219.6 && u > 42 && u < 628 && Math.abs(u - 120) > 6 && Math.abs(u - 222) > 6 && Math.abs(u - 380) > 46;
        const swS = u >= 384.5 && u < 389.6 && ((v > 64 && v < 186) || (v > 234 && v < 378)) && !(v > 262 && v < 278) && !(v > 134 && v < 144);
        if (swE || swS) {
          col = walk[Math.min(2, Math.floor(f * 2 + bb * .7))];
          if ((swE && (u % 5) < .34) || (swS && (v % 5) < .34)) col = walkEdge;
          if ((swE && v >= 219.1) || (swS && u >= 389.1)) col = curbSh;
          if ((swE && v < 215) || (swS && u < 385)) col = curb;
        }
        // roads: asphalt, a pale kerb, a yellow dashed centre line, stains, crossings
        // nearest road: only segments whose box is near this pixel, compared squared, one square root at the end
        let best2 = 9801, along = 0, sl = 0, bpx = 0, bpy = 0;
        for (let k = 0; k < segs.length; k++) {
          const s = segs[k]; if (u < s.u0 || u > s.u1 || v < s.v0 || v > s.v1) continue;
          const t = Math.max(0, Math.min(1, ((u - s.x0) * s.dx + (v - s.y0) * s.dy) / s.l2)), px = u - s.x0 - t * s.dx, py = v - s.y0 - t * s.dy, d2 = px * px + py * py;
          if (d2 < best2) { best2 = d2; along = t * s.len; sl = s.len; bpx = px; bpy = py; }
        }
        const best = Math.sqrt(best2), bnx = bpx / (best || 1), bny = bpy / (best || 1);
        const ring = ((u - 380) / 40) ** 2 + ((v - 210) / 22) ** 2, inner = ((u - 380) / 24) ** 2 + ((v - 210) / 13) ** 2;
        if (best < 4.5 || (ring < 1 && inner >= 1)) {
          col = asph[Math.min(3, Math.floor(f * 2.6 + bb * .8))];
          if (fbm2(X / 10, y / 10, 97, 2) > .74) col = mix(col, [12, 12, 16], .3);          // oil and rubber
          if (fbm2(X / 30, y / 30, 51, 2) < .25) col = mix(col, [120, 124, 130], .08);       // patch repairs
          const edge = (best >= 4.0 && best < 4.5 && ring >= .9) || (ring < 1 && ring > .93) || (inner >= 1 && inner < 1.08);
          if (edge) col = (bnx * .5 + bny * .86 > .2 && ring >= .9) || (ring < 1 && ring > .93 && v > 210) ? curbSh : curb;
          else if (best < .4 && sl > 60 && (along % 10) < 5 && ring > 1.1) col = dash;
          // zebra crossings: one on the main road below the assembly building, one on the north-south road
          if (!edge && ((u > 293 && u < 309 && Math.abs(v - 210) < 3.8 && Math.floor((u - 293) / 2) % 2 === 0) || (v > 242 && v < 256 && Math.abs(u - 380) < 3.8 && Math.floor((v - 242) / 2) % 2 === 0))) col = white;
        } else if (best < 5.3 && bnx * .5 + bny * .86 > .25 && ring > 1.15) col = mix(col, [0, 0, 0], .3);   // the kerb's own shadow
        for (let k = 0; k < MANHOLES.length; k++) { const mx = MANHOLES[k][0], my = MANHOLES[k][1]; if (Math.abs(u - mx) > 2 || Math.abs(v - my) > 2) continue; const dd = hyp(u - mx, (v - my) * 1.25); if (dd < 1.7) col = dd > 1.3 ? HX['#2a2e34'] : ((X + y) % 3 ? HX['#5a5e66'] : HX['#3a3e46']); }
        if (inner < 1) { col = grass[3 + (f > .6 ? 1 : 0)]; if (inner < .42) { col = HX['#4a3424']; if (inner > .36) col = HX['#b4bac4']; else if (X % 4 < 2 && y % 4 < 2) col = ((X >> 2) + (y >> 2)) % 3 === 0 ? HX['#ff86c8'] : ((X >> 2) + (y >> 2)) % 3 === 1 ? HX['#ffd27a'] : HX['#4aa060']; } }
        set(i, col);
      }
      yield;
    }
    x.putImageData(d, 0, 0);
    yield;
    // grass tufts and wildflowers on the lawns, so they are never bare
    const r = noise(9), lawn = (X, Y) => { const i = (Y * W + X) * 4; return a[i + 1] > a[i] + 25 && a[i + 1] > a[i + 2] + 2 && a[i] < 100; };
    for (let n = 0; n < 12000; n++) {
      const X = (r() * (W - 4)) | 0, Y = (r() * (H - 4) + 2) | 0;
      if (!lawn(X, Y)) continue;
      const k = r();
      if (k < .82) { x.fillStyle = r() < .5 ? '#6aa878' : '#244a36'; x.fillRect(X, Y, 1, 1); x.fillRect(X + 1, Y - 1, 1, 1); x.fillRect(X + 2, Y, 1, 1); }
      else { x.fillStyle = ['#ffd27a', '#ffffff', '#ff96e1', '#a8c8ff'][(r() * 4) | 0]; x.fillRect(X, Y, 1, 1); }
    }
    // pipes between the fuel tanks: lit on top, a shadow under, a flange every few units
    for (const [a0, b0, a1, b1] of [[490, 306, 548, 328], [548, 328, 604, 294], [520, 368, 548, 328], [600, 346, 548, 328]]) {
      const n = Math.round(hyp(a1 - a0, b1 - b0) * K);
      for (let k = 0; k <= n; k++) {
        const X = Math.round((a0 + (a1 - a0) * k / n) * K), Y = Math.round((b0 + (b1 - b0) * k / n) * K);
        x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(X + 2, Y + 3, 2, 2);
        x.fillStyle = '#8a909a'; x.fillRect(X, Y, 2, 3); x.fillStyle = '#c8ccd4'; x.fillRect(X, Y, 2, 1);
        if (k % 18 === 0) { x.fillStyle = '#5a6070'; x.fillRect(X - 1, Y - 1, 4, 5); x.fillStyle = '#aab0ba'; x.fillRect(X - 1, Y - 1, 4, 1); }
      }
    }
    yield;
    bakeShadows(x, W, H, shadows);
    return c;
  }

  // ---------- baked shadows: one sun, so every shape is swept along SUN by its height
  // shapes: { box: [X, Y, w, h], z } a solid block; { blob: [cx, cy, rx, ry], z } a canopy or tank held up at
  // height z; { pole: [X, Y, wd], z } a thin pole
  function bakeShadows(x, W, H, shapes) {
    const [mc, m] = make(W, H), [sc, s] = make(W, H);
    const poly = (g, pts) => { g.beginPath(); pts.forEach(([u, v], i) => i ? g.lineTo(u * K, v * K) : g.moveTo(u * K, v * K)); g.closePath(); g.fill(); };
    const shape = (g, sh, grow) => {
      const dx = sh.z * SUN[0], dy = sh.z * SUN[1];
      if (sh.box) { const [X, Y, w, h] = sh.box, e = grow; poly(g, [[X - e, Y - e], [X + w + e, Y - e], [X + w + dx + e, Y + dy - e], [X + w + dx + e, Y + h + dy + e], [X + dx - e, Y + h + dy + e], [X - e, Y + h + e]]); }
      if (sh.blob) { const [cx, cy, rx, ry] = sh.blob; g.beginPath(); g.ellipse((cx + dx) * K, (cy + dy) * K, (rx + grow) * K, (ry + grow) * K, 0, 0, 7); g.fill(); }
      if (sh.pole) { const [X, Y, wd] = sh.pole, e = wd / 2 + grow; poly(g, [[X - e, Y], [X + e, Y], [X + dx + e, Y + dy], [X + dx - e, Y + dy]]); if (sh.cap) { g.beginPath(); g.ellipse((X + dx) * K, (Y + dy) * K, (sh.cap + grow) * K, (sh.cap * .6 + grow) * K, 0, 0, 7); g.fill(); } }
    };
    // the hard core of each shadow, and a soft penumbra round it; both cool and blue, not black
    // the penumbra is filled with a 50% checker, so its edge is dithered with no pixel read-back
    const [pc, px] = make(2, 2); px.fillStyle = '#000'; px.fillRect(0, 0, 1, 1); px.fillRect(1, 1, 1, 1);
    m.fillStyle = '#000'; s.fillStyle = s.createPattern(pc, 'repeat');
    for (const sh of shapes) { shape(m, sh, 0); shape(s, sh, sh.box ? 1.4 : .9); }
    // contact darkening right where a block meets the ground
    for (const sh of shapes) if (sh.box) { const [X, Y, w, h] = sh.box; s.fillRect((X - 1.2) * K, (Y + h - 1) * K, (w + 2.4) * K, 2.4 * K); }
    const tint = (c, col) => { const g = c.getContext('2d'); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, W, H); };
    tint(sc, '#06121c'); tint(mc, '#06121c');
    x.globalAlpha = .3; x.drawImage(sc, 0, 0); x.globalAlpha = .4; x.drawImage(mc, 0, 0); x.globalAlpha = 1;
  }

  // ---------- the 3/4 building kit (art pixels, 1 x 1)
  // a flat roof with a parapet: the rim's top and left catch the sun, the rim's inner face shows on the far side,
  // and the rim throws a shadow onto the roof
  function flatRoof(x, W, D, base, rim = 6) {
    R(x, 0, 0, W, D, base);
    for (let k = 0; k < 220; k++) { const X = (k * 197) % W, Y = (k * 113) % D; R(x, X, Y, 2, 1, tone(base, k % 2 ? 1.06 : .94)); }
    const top = tone(base, 1.18), face = tone(base, .86);
    R(x, 0, 0, W, rim, top); R(x, 0, 0, rim, D, top); R(x, W - rim, 0, rim, D, tone(base, .98)); R(x, 0, D - rim, W, rim, top);
    R(x, 0, 0, W, 1, tone(base, 1.4)); R(x, 0, 0, 1, D, tone(base, 1.35)); R(x, 0, D - rim, W, 1, tone(base, 1.4));
    R(x, rim, rim, W - rim * 2, 4, face);                                    // the far rim's inner face
    x.fillStyle = 'rgba(4,10,18,.22)'; x.fillRect(rim, rim + 4, W - rim * 2, 6); x.fillRect(rim, rim + 4, 6, D - rim * 2 - 4);
    R(x, W - rim - 1, rim, 1, D - rim * 2, tone(base, .8));
  }
  // the front wall: brighter near the top, a cornice catching the sun, the eave's shadow under it, a dark plinth
  function wall(x, W, FH, base) {
    for (let y = 0; y < FH; y++) R(x, 0, y, W, 1, tone(base, 1.04 - (y / FH) * .2));
    R(x, 0, 0, W, 3, tone(base, 1.32)); R(x, 0, 3, W, 1, tone(base, .7));
    x.fillStyle = 'rgba(4,10,18,.3)'; x.fillRect(0, 4, W, 5);
    R(x, 0, FH - 7, W, 7, tone(base, .6)); R(x, 0, FH - 7, W, 1, tone(base, .82));
    x.fillStyle = 'rgba(4,10,18,.25)'; x.fillRect(0, FH - 12, W, 5);
    R(x, 0, 0, 2, FH, tone(base, 1.2)); R(x, W - 3, 0, 3, FH, tone(base, .66));
  }
  // a window set into the wall: lintel and left jamb shade the glass, a lit sill with its own shadow below
  function win(x, X, Y, w, h, lit, warm = true) {
    R(x, X - 2, Y - 2, w + 4, h + 4, '#2a3040');
    const g0 = lit ? (warm ? '#ffd27a' : '#78ffdc') : '#26364e', g1 = lit ? (warm ? '#fff0c0' : '#c8fff0') : '#3a5a7a';
    R(x, X, Y, w, h, g0);
    for (let k = 0; k < w + h; k += 1) { const a = X + k - Math.round(h * .6), b = Y + h - 1 - Math.round(k * .6); if (a >= X + 2 && a < X + w && b >= Y && b < Y + h && (k % 9) < 3) R(x, a, b, 1, 1, g1); }
    if (lit) R(x, X + 2, Y + 2, w - 4, 2, g1);
    x.fillStyle = 'rgba(4,10,18,.42)'; x.fillRect(X, Y, w, 3); x.fillRect(X, Y + 3, 2, h - 3);
    if (w > 10) R(x, X + (w >> 1), Y, 1, h, '#2a3040');
    R(x, X - 3, Y + h + 2, w + 6, 2, '#c8ccd4'); R(x, X - 3, Y + h + 2, w + 6, 1, '#e8ecf2');
    x.fillStyle = 'rgba(4,10,18,.3)'; x.fillRect(X - 2, Y + h + 4, w + 6, 2);
  }
  // a box standing on a roof (or the ground): its shadow to the bottom right, a lit top, a front face
  function box3(x, X, Y, w, d, h, col) {
    x.fillStyle = 'rgba(4,10,18,.28)'; x.fillRect(X + w, Y - h + 3, Math.round(h * SUN[0] * 1.2) + 1, d + 1); x.fillRect(X + 3, Y + d - h + h, w, Math.round(h * SUN[1] * 1.2) + 1);
    R(x, X - 1, Y - h - 1, w + 2, d + h + 2, OUT);
    R(x, X, Y - h, w, d, tone(col, 1.16)); R(x, X, Y - h, w, 1, tone(col, 1.4)); R(x, X, Y - h, 1, d, tone(col, 1.32));
    R(x, X, Y - h + d, w, h, tone(col, .82)); R(x, X, Y - h + d, w, 1, tone(col, 1.05)); R(x, X + w - 2, Y - h + d, 2, h, tone(col, .62));
    return [X, Y - h, Y - h + d];   // left, top of the top face, top of the front face
  }
  // a rooftop air handler: a box with a fan grille on top
  function hvac(x, X, Y, w = 40, d = 28, h = 16) {
    const [, ty] = box3(x, X, Y, w, d, h, '#8a93a3');
    const cx = X + (w >> 1), cy = ty + (d >> 1), r = Math.min(w, d) / 2 - 4;
    for (let yy = -r; yy <= r; yy++) { const hw = Math.round(Math.sqrt(Math.max(0, r * r - yy * yy))); R(x, cx - hw, cy + yy, hw * 2, 1, '#2a3040'); }
    for (let k = -r + 2; k < r; k += 3) R(x, cx - r + 2, cy + k, r * 2 - 4, 1, '#4a5262');
    R(x, cx - 1, cy - 1, 3, 3, '#9aa2b2');
    for (let k = 4; k < w - 4; k += 4) R(x, X + k, ty + d + 3, 2, h - 6, '#5a6272');
  }
  // a skylight bubble: a lit dome with a dark lower side
  function dome(x, cx, cy, r) {
    x.fillStyle = 'rgba(4,10,18,.25)'; x.beginPath(); x.ellipse(cx + r * .5, cy + r * .45, r, r * .7, 0, 0, 7); x.fill();
    for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
      const d2 = (xx * xx + yy * yy * 1.6) / (r * r); if (d2 > 1) continue;
      const l = -xx / r * .5 - yy / r * .6 + Math.sqrt(1 - d2) * .5;
      R(x, cx + xx, cy + yy, 1, 1, d2 > .82 ? '#5a6474' : l > .7 ? '#ffffff' : l > .35 ? '#c8daf0' : l > 0 ? '#8aa4c8' : '#5a7090');
    }
  }
  // a row of tilted solar panels: the cells face the sun, a lit top edge, the frame's thickness and shadow below
  function solar(x, X, Y, w, rows) {
    for (let r = 0; r < rows; r++) {
      const y = Y + r * 34;
      x.fillStyle = 'rgba(4,10,18,.3)'; x.fillRect(X + 4, y + 24, w, 7);
      R(x, X - 1, y - 1, w + 2, 27, OUT);
      R(x, X, y, w, 22, '#1d2a5a');
      for (let k = 0; k < w; k += 12) R(x, X + k, y, 1, 22, '#2f4a9a');
      R(x, X, y + 11, w, 1, '#2f4a9a'); R(x, X, y, w, 2, '#8ab4e8');
      for (let k = 0; k < w; k += 20) R(x, X + k + 3, y + 3, 4, 2, 'rgba(200,225,255,.35)');
      R(x, X, y + 22, w, 3, '#4a5262'); R(x, X, y + 22, w, 1, '#7a8292');
    }
  }
  // a building sprite: roof (with its rise) over the footprint, then the front wall below
  function building(b, roof, face) {
    const W = b.w * U, D = (b.h + b.Rz - b.F) * U, FH = b.F * U;
    return sprite(W, D + FH, (x) => { roof(x, W, D); x.save(); x.translate(0, D); face(x, W, FH); x.restore(); }, OUT);
  }
  const hazard = (x, X, Y, w, h) => { R(x, X, Y, w, h, '#2a2e36'); for (let k = -h; k < w; k += 10) for (let yy = 0; yy < h; yy++) { const a = X + k + yy; if (a >= X && a + 4 < X + w) R(x, a, Y + yy, 5, 1, '#f2c040'); } };
  const stripe = (x, Y, W, h, col) => { R(x, 0, Y, W, h, col); R(x, 0, Y, W, 1, tone(col, 1.35)); R(x, 0, Y + h - 1, W, 1, tone(col, .6)); };

  const SPR = {};
  function* buildSprites() {
    const B = Object.fromEntries(BLD.map(b => [b.k, b]));
    // ----- the assembly building: the tallest thing on campus; a giant door, an orange band, an emblem
    SPR.assembly = building(B.assembly, (x, W, D) => {
      flatRoof(x, W, D, '#5e6678', 8);
      for (let X = 72; X < W - 20; X += 72) { R(x, X, 14, 1, D - 22, '#525a6a'); R(x, X + 1, 14, 1, D - 22, '#6e7688'); }
      // a long skylight strip, recessed: dark far side, lit near edge
      for (const Y of [60, 250]) { R(x, 30, Y, W - 60, 24, '#1a2438'); for (let k = 30; k < W - 30; k += 16) R(x, k, Y, 1, 24, '#2a3a58'); R(x, 30, Y, W - 60, 4, 'rgba(4,10,18,.5)'); R(x, 30, Y + 22, W - 60, 2, '#aab4c4'); for (let k = 40; k < W - 40; k += 48) R(x, k, Y + 6, 10, 12, 'rgba(160,200,255,.3)'); }
      // a painted emblem: a ring with a rocket, readable from the air
      const ex = W / 2, ey = 170;
      for (let yy = -46; yy <= 46; yy++) for (let xx = -46; xx <= 46; xx++) { const d = Math.hypot(xx, yy); if (d < 46 && d > 38) R(x, ex + xx, ey + yy, 1, 1, '#e8ecf2'); else if (d <= 38) R(x, ex + xx, ey + yy, 1, 1, '#24324e'); }
      R(x, ex - 6, ey - 24, 12, 40, '#e8ecf2'); for (let k = 0; k < 10; k++) R(x, ex - 6 + k * .6, ey - 34 + k, 12 - k * 1.2, 1, '#e8ecf2'); R(x, ex - 14, ey + 8, 8, 10, '#f08c32'); R(x, ex + 6, ey + 8, 8, 10, '#f08c32'); R(x, ex - 3, ey + 16, 6, 8, '#ffd27a');
      for (const [X, Y] of [[40, 120], [320, 110], [40, 330], [330, 320]]) hvac(x, X, Y + 30, 52, 32, 18);
      box3(x, 200, 360, 30, 20, 14, '#7a8292');
      R(x, 2, 2, 4, 4, '#ff5a50'); R(x, W - 6, 2, 4, 4, '#ff5a50');
    }, (x, W, FH) => {
      wall(x, W, FH, '#48505f');
      for (let X = 24; X < W; X += 24) { R(x, X, 9, 2, FH - 22, '#3c4352'); R(x, X + 2, 9, 1, FH - 22, '#5a6272'); }
      stripe(x, 14, W, 10, '#f08c32');
      // the great door: a hazard frame, tall slats, open a crack at the bottom with light spilling out
      const dX = 22 * U + 10, dw = 26 * U, dY = 30;
      hazard(x, dX - 10, dY - 8, dw + 20, FH - dY + 2);
      R(x, dX, dY, dw, FH - dY - 7, '#5e6676');
      for (let Y = dY + 6; Y < FH - 7; Y += 8) { R(x, dX, Y, dw, 1, '#4a5262'); R(x, dX, Y + 1, dw, 1, '#7a8292'); }
      R(x, dX, dY, dw, 4, 'rgba(4,10,18,.4)'); R(x, dX, dY, 3, FH - dY - 7, 'rgba(4,10,18,.3)');
      R(x, dX + 4, FH - 18, dw - 8, 11, '#141820'); R(x, dX + 4, FH - 18, dw - 8, 2, '#fff0c0'); for (let k = 10; k < dw - 10; k += 22) R(x, dX + k, FH - 14, 8, 4, '#ffd27a');
      // personnel doors with little canopies, and windows on both wings
      for (const X of [30, W - 74]) { R(x, X, FH - 46, 44, 6, '#c8ccd4'); R(x, X, FH - 46, 44, 1, '#ffffff'); x.fillStyle = 'rgba(4,10,18,.4)'; x.fillRect(X + 2, FH - 40, 42, 5); R(x, X + 12, FH - 38, 20, 31, '#2a3040'); R(x, X + 14, FH - 36, 16, 12, '#78ffdc'); R(x, X + 26, FH - 20, 3, 3, '#c8ccd4'); }
      for (let i = 0; i < 3; i++) { win(x, 20 + i * 30, 44, 18, 22, i !== 1); win(x, W - 108 + i * 30, 44, 18, 22, i !== 2); }
      for (let i = 0; i < 2; i++) { win(x, 26 + i * 50, 94, 26, 18, i === 0, false); win(x, W - 82 + i * 40, 94, 26, 18, true, false); }
      R(x, W - 16, 30, 4, FH - 37, '#5a6272'); R(x, W - 16, 30, 1, FH - 37, '#8a93a3');
    });
    // ----- the tracking station: a glass front, a penthouse control room and solar on the roof
    yield;
    SPR.tracking = building(B.tracking, (x, W, D) => {
      flatRoof(x, W, D, '#646c7c', 6);
      solar(x, 300, 26, 200, 3);
      // the penthouse: a box with its own windows
      const [px, , fy] = box3(x, 30, 96, 160, 56, 40, '#7a8292');
      for (let i = 0; i < 6; i++) win(x, px + 10 + i * 25, fy + 12, 16, 18, i % 2 === 0, false);
      hvac(x, 214, 150, 40, 26, 14);
      for (const X of [220, 236]) { R(x, X, 30, 2, 80, '#9aa2b2'); R(x, X - 8, 30, 18, 2, '#9aa2b2'); R(x, X, 28, 2, 2, '#ff5a50'); x.fillStyle = 'rgba(4,10,18,.3)'; x.fillRect(X + 2, 110, 30, 2); }
    }, (x, W, FH) => {
      wall(x, W, FH, '#4a5160');
      // a glass curtain wall: mullions, reflections, lit desks inside
      R(x, 10, 12, W - 20, FH - 26, '#1d2c48');
      for (let X = 10; X < W - 10; X += 32) { R(x, X, 12, 3, FH - 26, '#8a93a3'); R(x, X, 12, 1, FH - 26, '#c8ccd4'); }
      R(x, 10, 12 + ((FH - 26) >> 1), W - 20, 3, '#8a93a3');
      for (let k = 0; k < W; k += 64) for (let y = 0; y < FH - 26; y++) { const X = 10 + k + y * .6; if (X < W - 12) R(x, X, 12 + y, 6, 1, 'rgba(160,200,255,.18)'); }
      for (let X = 16; X < W - 30; X += 32) if ((X >> 5) % 3 !== 1) { R(x, X + 6, FH - 34, 18, 8, '#ffd27a'); R(x, X + 8, FH - 32, 6, 4, '#78ffdc'); }
      x.fillStyle = 'rgba(4,10,18,.35)'; x.fillRect(10, 12, W - 20, 4);
      // the entrance canopy
      const eX = (W >> 1) - 40; R(x, eX - 4, FH - 40, 88, 7, '#d8dce4'); R(x, eX - 4, FH - 40, 88, 1, '#ffffff'); x.fillStyle = 'rgba(4,10,18,.4)'; x.fillRect(eX - 2, FH - 33, 86, 6);
      R(x, eX + 18, FH - 31, 44, 24, '#141c2c'); R(x, eX + 39, FH - 31, 2, 24, '#8a93a3');
    });
    // ----- the hangar: a barrel-vault roof and huge sliding doors, one open on a stage being built
    yield;
    SPR.hangar = building(B.hangar, (x, W, D) => {
      for (let y = 0; y < D; y++) { const k = Math.cos((y / D - .3) * Math.PI * .9); R(x, 0, y, W, 1, css(mix(hex('#3e4656'), hex('#b4bcca'), Math.max(0, k) ** 1.4))); }
      for (let X = 0; X < W; X += 8) { R(x, X, 0, 1, D, 'rgba(10,14,24,.32)'); R(x, X + 1, 0, 1, D, 'rgba(255,255,255,.06)'); }
      for (let X = 92; X < W - 40; X += 124) { R(x, X, 4, 6, D - 8, '#3a4252'); R(x, X, 4, 2, D - 8, '#8a93a3'); }
      for (const X of [150, 400, 650]) for (let y = 30; y < D - 40; y += 70) { R(x, X, y, 40, 26, '#2a3a58'); R(x, X, y, 40, 3, '#aab4c4'); R(x, X, y + 23, 40, 3, 'rgba(4,10,18,.4)'); }
      R(x, 0, 0, W, 3, '#d8dce4'); R(x, 0, D - 6, W, 6, '#3a4252'); R(x, 0, D - 6, W, 1, '#8a93a3');
    }, (x, W, FH) => {
      wall(x, W, FH, '#4c5464');
      const pw = 172, open = 1;
      for (let i = 0; i < 4; i++) {
        const X = 14 + i * (pw + 8);
        if (i === open) {
          // the open bay: a dark interior, lamps in the roof, a booster stage on its cradle
          R(x, X, 14, pw, FH - 21, '#0e1320');
          for (let k = 20; k < pw; k += 40) { R(x, X + k, 18, 14, 3, '#fff0c0'); x.fillStyle = 'rgba(255,230,170,.08)'; x.beginPath(); x.moveTo(X + k, 21); x.lineTo(X + k + 14, 21); x.lineTo(X + k + 34, FH - 7); x.lineTo(X + k - 20, FH - 7); x.fill(); }
          R(x, X + 20, FH - 50, 130, 26, '#c8ccd4'); R(x, X + 20, FH - 50, 130, 4, '#ffffff'); R(x, X + 20, FH - 28, 130, 4, '#8a92a2'); R(x, X + 150, FH - 48, 14, 22, '#4a5262'); R(x, X + 60, FH - 50, 6, 26, '#f08c32');
          R(x, X + 30, FH - 24, 10, 17, '#5a6272'); R(x, X + 130, FH - 24, 10, 17, '#5a6272');
          x.fillStyle = 'rgba(4,10,18,.5)'; x.fillRect(X, 14, pw, 8);
        } else {
          R(x, X, 14, pw, FH - 21, '#6a7282');
          for (let k = 0; k < pw; k += 12) { R(x, X + k, 14, 1, FH - 21, '#55606e'); R(x, X + k + 1, 14, 1, FH - 21, '#7e8696'); }
          R(x, X, 14, pw, 3, '#9aa2b2'); R(x, X + pw - 3, 14, 3, FH - 21, '#4a5262');
          R(x, X + (pw >> 1) - 30, 60, 60, 6, '#f08c32');
        }
      }
      for (let X = 14; X < W - 14; X += 16) R(x, X, FH - 9, 8, 2, '#f2c040');
      R(x, W - 30, 22, 14, 10, '#ffd27a'); x.fillStyle = 'rgba(255,220,140,.12)'; x.fillRect(W - 40, 32, 34, 30);
    });
    // ----- crew quarters: a courtyard you can look down into, solar and skylight domes on the roof
    yield;
    SPR.quarters = building(B.quarters, (x, W, D) => {
      flatRoof(x, W, D, '#8c8578', 6);
      for (let X = 60; X < W; X += 60) R(x, X, 10, 1, D - 16, '#7c766a');
      solar(x, 22, 22, 170, 2); solar(x, W - 200, 22, 170, 2); solar(x, 22, D - 120, 170, 2); solar(x, W - 200, D - 120, 170, 2);
      for (const [X, Y] of [[230, 40], [690, 40], [230, D - 40], [690, D - 40]]) dome(x, X, Y, 13);
      // the courtyard: lower than the roof, so the far wing's inner wall shows
      const cx = 250, cy = 70, cw = 436, ch = D - 140, wh = 46;
      R(x, cx - 4, cy - 4, cw + 8, ch + 8, '#6a6458');
      R(x, cx, cy, cw, wh, '#7a7468');
      for (let y = 0; y < wh; y++) R(x, cx, cy + y, cw, 1, tone('#7a7468', 1 - y / wh * .2));
      for (let i = 0; i < 10; i++) win(x, cx + 14 + i * 42, cy + 12, 22, 20, i % 3 !== 1);
      const gy = cy + wh;
      R(x, cx, gy, cw, ch - wh, '#2c5c49'); for (let k = 0; k < 500; k++) R(x, cx + (k * 97) % cw, gy + (k * 61) % (ch - wh), 2, 2, k % 3 ? '#346853' : '#25503f');
      R(x, cx, gy + 40, cw, 16, '#a8a090'); R(x, cx + 210, gy, 16, ch - wh, '#a8a090'); R(x, cx, gy + 55, cw, 1, '#8a8478');
      x.fillStyle = 'rgba(4,10,18,.35)'; x.fillRect(cx, gy, cw, 14); x.fillRect(cx, gy, 10, ch - wh);
      // a small tree, a bench and a table in the courtyard
      const tr = treeCanvas('tree'); x.drawImage(tr, cx + 80, gy + 2); x.drawImage(tr, cx + 320, gy + 8);
      const bn = SPR.bench || benchCanvas(); x.drawImage(bn, cx + 150, gy + 60);
    }, (x, W, FH) => {
      wall(x, W, FH, '#6e6858');
      for (let i = 0; i < 22; i++) { if (Math.abs(16 + i * 42 - W / 2) < 50) continue; win(x, 16 + i * 42, 16, 24, 22, (i * 7) % 5 !== 1); }
      const dX = W / 2 - 34;
      R(x, dX - 8, 6, 84, 7, '#d8dce4'); R(x, dX - 8, 6, 84, 1, '#ffffff'); x.fillStyle = 'rgba(4,10,18,.4)'; x.fillRect(dX - 6, 13, 82, 6);
      R(x, dX, 14, 68, FH - 21, '#2a3040'); R(x, dX + 4, 18, 28, FH - 29, '#3a5a7a'); R(x, dX + 36, 18, 28, FH - 29, '#3a5a7a'); R(x, dX + 6, 20, 6, FH - 34, 'rgba(200,230,255,.35)'); R(x, dX + 33, 18, 2, FH - 29, '#8a93a3');
      R(x, dX + 12, 22, 44, 6, '#78ffdc');
    });

    yield;
    // ---------- props
    // the parts kiosk: a capsule machine full of parts in the four slot colours
    SPR.kiosk = sprite(110, 150, (x) => {
      R(x, 6, 70, 98, 80, '#c43a92'); R(x, 6, 70, 98, 4, '#ff96e1'); R(x, 6, 70, 4, 80, '#e866b4'); R(x, 90, 70, 14, 80, '#8a2468');
      R(x, 20, 86, 50, 24, '#1a1424'); R(x, 22, 88, 46, 20, '#3a1a4a'); for (let k = 0; k < 4; k++) R(x, 26 + k * 10, 92 + (k % 2) * 4, 6, 6, ['#f08c32', '#5a96f5', '#e6ebf0', '#e6b946'][k]);
      R(x, 74, 92, 14, 14, '#2a1a2a'); R(x, 76, 94, 10, 10, '#d8dce4'); R(x, 80, 95, 2, 8, '#2a1a2a');
      R(x, 30, 120, 40, 18, '#2a1a2a'); R(x, 32, 122, 36, 14, '#140c14'); R(x, 76, 120, 10, 4, '#ffd27a');
      R(x, 6, 142, 98, 8, '#6a1a50');
      for (let y = 0; y < 70; y++) { const hw = Math.round(48 * Math.sqrt(Math.max(0, 1 - ((70 - y) / 72) ** 2))); R(x, 55 - hw, y, hw * 2, 1, 'rgba(170,220,255,.35)'); }
      const caps = [[30, 50], [44, 56], [58, 52], [72, 58], [36, 38], [52, 40], [66, 42], [80, 46], [24, 60], [44, 28], [60, 26]];
      caps.forEach(([X, Y], i) => { const c = ['#f08c32', '#5a96f5', '#e6ebf0', '#e6b946'][i % 4]; R(x, X - 5, Y - 5, 10, 10, OUT); R(x, X - 4, Y - 4, 8, 8, c); R(x, X - 4, Y, 8, 4, tone(c, .7)); R(x, X - 3, Y - 3, 2, 2, '#ffffff'); });
      for (let y = 4; y < 60; y++) R(x, 22 + y * .25, y, 2, 1, 'rgba(255,255,255,.45)');
      R(x, 4, 66, 102, 6, '#8a2468'); R(x, 4, 66, 102, 2, '#ff96e1');
    }, OUT);
    // fuel tanks: spheres on legs with a band, a ladder and a vent on top
    SPR.tank = sprite(66, 80, (x) => {
      for (const X of [10, 30, 50]) { R(x, X, 50, 5, 30, '#6a7282'); R(x, X, 50, 2, 30, '#8a93a3'); }
      R(x, 8, 64, 50, 2, '#5a6272');
      for (let y = 0; y < 56; y++) { const k = (y - 28) / 28, hw = Math.round(32 * Math.sqrt(Math.max(0, 1 - k * k))); for (let X = -hw; X < hw; X++) { const l = (-(X / 32) * .55 - k * .65 + Math.sqrt(Math.max(0, 1 - (X / 32) ** 2 - k * k)) * .55); R(x, 33 + X, y + 6, 1, 1, l > .55 ? '#ffffff' : l > .25 ? '#e8ecf2' : l > -.1 ? '#c8ccd4' : l > -.4 ? '#9aa2b2' : '#7a8292'); } }
      R(x, 2, 32, 62, 4, '#f08c32'); R(x, 2, 32, 30, 1, '#ffb070'); R(x, 2, 35, 62, 1, '#a85a1a');
      R(x, 52, 10, 3, 52, '#4a5262'); for (let y = 12; y < 60; y += 5) R(x, 50, y, 7, 1, '#4a5262');
      R(x, 30, 0, 6, 8, '#6a7282'); R(x, 30, 0, 6, 2, '#c8ccd4');
    }, OUT);
    // trees: round broadleaf, a tiered pine, the pink flowering kind, a bush
    SPR.tree = treeCanvas('tree'); SPR.pine = treeCanvas('pine'); SPR.bloom = treeCanvas('bloom'); SPR.bush = treeCanvas('bush');
    // crates in the yards: wood with straps, grey metal cases; dull on purpose, so real parts stand out
    SPR.crate = sprite(34, 34, (x) => { R(x, 0, 10, 34, 24, '#8a6440'); R(x, 0, 0, 34, 10, '#b48a5a'); R(x, 0, 0, 34, 2, '#d0a878'); R(x, 0, 10, 34, 2, '#6a4a2c'); R(x, 6, 0, 3, 34, '#5a3e24'); R(x, 25, 0, 3, 34, '#5a3e24'); R(x, 30, 10, 4, 24, '#6a4a2c'); R(x, 0, 30, 34, 4, '#5a3e24'); }, OUT);
    SPR.case = sprite(34, 28, (x) => { R(x, 0, 8, 34, 20, '#5a6272'); R(x, 0, 0, 34, 8, '#7a8292'); R(x, 0, 0, 34, 1, '#9aa2b2'); R(x, 14, 12, 6, 4, '#c8ccd4'); R(x, 0, 8, 34, 1, '#3a4252'); R(x, 30, 8, 4, 20, '#4a5262'); }, OUT);
    SPR.lamp = sprite(22, 76, (x) => { R(x, 9, 12, 3, 62, '#4a5262'); R(x, 9, 12, 1, 62, '#8a93a3'); R(x, 2, 6, 18, 7, '#3a4252'); R(x, 2, 6, 18, 1, '#6a7282'); R(x, 4, 11, 14, 3, '#fff4d0'); R(x, 6, 70, 10, 6, '#3a4252'); R(x, 6, 70, 10, 1, '#6a7282'); }, OUT);
    // the tracking dish, in four turns
    SPR.dish = [0, 1, 2, 3].map((f) => sprite(70, 96, (x) => {
      R(x, 33, 50, 5, 46, '#7a8292'); R(x, 33, 50, 2, 46, '#9aa2b2'); R(x, 22, 88, 26, 8, '#4a5262'); R(x, 22, 88, 26, 1, '#7a8292');
      const w = [30, 22, 12, 22][f], flip = f === 3 ? -1 : 1;
      for (let y = 0; y < 50; y++) { const k = (y - 25) / 25, hw = Math.round(w * Math.sqrt(Math.max(0, 1 - k * k))); R(x, 35 - hw, y, hw * 2, 1, f === 2 ? '#aab2c0' : y < 20 ? '#f2f4f8' : '#d8dce4'); if (hw > 2) R(x, 35 + flip * (hw - 3), y, 3, 1, '#8a92a2'); }
      R(x, 34, 22, 3, 6, '#5a6272');
    }, OUT));
    // the water tower: four braced legs, a tank with a conical cap, a walkway
    yield;
    SPR.watertower = sprite(96, 186, (x) => {
      const leg = (x0, x1, col, hi) => { for (let y = 0; y < 106; y++) { const X = Math.round(x0 + (x1 - x0) * y / 105); R(x, X, 80 + y, 4, 1, col); R(x, X, 80 + y, 1, 1, hi); } };
      leg(30, 22, '#5a6272', '#7a8292'); leg(66, 74, '#4a5262', '#5a6272');
      for (let k = 0; k < 3; k++) { const y0 = 96 + k * 30; for (let s = 0; s < 30; s++) { R(x, 26 + s * 1.5, y0 + s, 2, 2, '#6a7282'); R(x, 70 - s * 1.5, y0 + s, 2, 2, '#5a6272'); } }
      leg(36, 14, '#8a93a3', '#c8ccd4'); leg(60, 82, '#6a7282', '#8a93a3');
      R(x, 20, 76, 56, 6, '#4a5262'); R(x, 14, 72, 68, 4, '#8a93a3'); R(x, 14, 72, 68, 1, '#c8ccd4');
      for (let X = 14; X < 82; X += 8) R(x, X, 64, 2, 9, '#6a7282'); R(x, 14, 64, 68, 2, '#8a93a3');
      for (let X = 0; X < 64; X++) { const k = X / 63, l = k < .12 ? 3 : k < .45 ? 2 : k < .8 ? 1 : 0; R(x, 16 + X, 26, 1, 40, ['#7a8aa0', '#a8b8cc', '#d8e2ee', '#ffffff'][l]); }
      R(x, 16, 44, 64, 6, '#f08c32'); R(x, 16, 44, 20, 1, '#ffb070'); R(x, 60, 44, 20, 6, '#b8641e');
      for (let y = 0; y < 26; y++) { const hw = Math.round(34 * y / 25); for (let X = -hw; X < hw; X++) R(x, 48 + X, y, 1, 1, X < -hw * .4 ? '#ffffff' : X < hw * .3 ? '#c8d0dc' : '#8a98aa'); }
      R(x, 46, 0, 4, 3, '#4a5262');
      for (let y = 30; y < 74; y += 4) R(x, 40, y, 8, 1, '#4a5262'); R(x, 40, 28, 1, 46, '#4a5262'); R(x, 47, 28, 1, 46, '#4a5262');
    }, OUT);
    // a shipping container, corrugated; stacked ones are drawn twice
    SPR.container = ['#a8442e', '#2e5a9a', '#3e7a4e', '#c8902e'].map((c) => sprite(132, 70, (x) => {
      R(x, 0, 0, 132, 26, tone(c, 1.15)); for (let X = 4; X < 128; X += 6) R(x, X, 2, 2, 22, tone(c, 1.28)); R(x, 0, 0, 132, 1, tone(c, 1.5)); R(x, 0, 0, 1, 26, tone(c, 1.4));
      R(x, 0, 26, 132, 44, c); for (let X = 2; X < 130; X += 6) { R(x, X, 28, 2, 40, tone(c, .78)); R(x, X + 2, 28, 1, 40, tone(c, 1.12)); }
      R(x, 0, 26, 132, 2, tone(c, .6)); R(x, 0, 66, 132, 4, tone(c, .55)); R(x, 0, 26, 4, 44, tone(c, .85)); R(x, 128, 26, 4, 44, tone(c, .55));
      R(x, 50, 38, 34, 12, '#e8ecf2'); for (let k = 0; k < 5; k++) R(x, 53 + k * 6, 41, 4, 6, '#2a3040');
    }, OUT));
    // street furniture
    SPR.bench = benchCanvas();
    SPR.bin = sprite(12, 18, (x) => { R(x, 0, 3, 12, 15, '#3e7a4e'); R(x, 0, 3, 3, 15, '#5aa06a'); R(x, 9, 3, 3, 15, '#2a5a38'); R(x, 0, 0, 12, 4, '#2a3040'); R(x, 0, 0, 12, 1, '#5a6272'); }, OUT);
    SPR.table = sprite(54, 34, (x) => { R(x, 0, 6, 54, 6, '#7a5a3a'); R(x, 0, 6, 54, 1, '#a8845a'); R(x, 4, 12, 46, 14, '#9a7248'); R(x, 4, 12, 46, 2, '#c8a070'); for (let X = 4; X < 50; X += 9) R(x, X, 12, 1, 14, '#7a5a3a'); R(x, 0, 28, 54, 5, '#7a5a3a'); R(x, 0, 28, 54, 1, '#a8845a'); R(x, 8, 26, 3, 8, '#3a2a1a'); R(x, 43, 26, 3, 8, '#3a2a1a'); }, OUT);
    SPR.drum = ['#2e5a9a', '#a8442e', '#c8a03a'].map((c) => sprite(14, 20, (x) => { for (let X = 0; X < 14; X++) R(x, X, 4, 1, 16, tone(c, X < 3 ? 1.25 : X < 9 ? 1 : .68)); R(x, 0, 0, 14, 5, tone(c, 1.35)); R(x, 4, 1, 4, 2, '#2a3040'); R(x, 0, 9, 14, 1, tone(c, .55)); R(x, 0, 15, 14, 1, tone(c, .55)); }, OUT));
    SPR.cone = sprite(12, 16, (x) => { for (let y = 0; y < 13; y++) { const hw = 1 + Math.round(y * .38); R(x, 6 - hw, y, hw * 2, 1, y > 4 && y < 8 ? '#ffffff' : '#ff7a2a'); R(x, 6 - hw, y, 1, 1, y > 4 && y < 8 ? '#ffffff' : '#ffb070'); } R(x, 0, 13, 12, 3, '#d8501a'); }, OUT);
    SPR.pallet = sprite(40, 30, (x) => { R(x, 0, 22, 40, 8, '#8a6440'); R(x, 0, 22, 40, 1, '#b48a5a'); for (let X = 2; X < 38; X += 12) R(x, X, 26, 6, 4, '#3a2a1a'); R(x, 3, 4, 34, 18, '#c8b48a'); R(x, 3, 4, 34, 2, '#e8d8b0'); R(x, 3, 12, 34, 1, '#a8946a'); R(x, 19, 4, 2, 18, '#a8946a'); R(x, 34, 4, 3, 18, '#a8946a'); }, OUT);
    SPR.hydrant = sprite(12, 18, (x) => { R(x, 2, 4, 8, 14, '#c83a32'); R(x, 2, 4, 2, 14, '#ff6a5a'); R(x, 0, 8, 12, 3, '#a82a22'); R(x, 3, 0, 6, 5, '#c83a32'); R(x, 4, 0, 2, 2, '#ff9a8a'); R(x, 1, 16, 10, 2, '#5a6272'); }, OUT);
    SPR.hedge = sprite(66, 30, (x) => {
      for (let y = 0; y < 16; y++) for (let X = 0; X < 66; X++) { const h = ((X * 73 + y * 151) % 11) / 11; R(x, X, y, 1, 1, h > .82 ? '#6ac86a' : h > .4 ? '#3e9a52' : '#2e8044'); }
      R(x, 0, 0, 66, 1, '#8ad88a'); R(x, 0, 0, 1, 16, '#6ac86a');
      for (let y = 16; y < 30; y++) for (let X = 0; X < 66; X++) { const h = ((X * 37 + y * 91) % 9) / 9; R(x, X, y, 1, 1, h > .75 ? '#2a7040' : '#1e5a34'); }
      R(x, 0, 16, 66, 1, '#3e9a52'); R(x, 62, 0, 4, 30, 'rgba(4,10,18,.25)');
    }, OUT);
    SPR.sign = sprite(36, 54, (x) => { R(x, 16, 20, 4, 34, '#6a7282'); R(x, 16, 20, 1, 34, '#9aa2b2'); R(x, 0, 0, 36, 22, '#2a5a9a'); R(x, 2, 2, 32, 18, '#3a7ad8'); R(x, 0, 0, 36, 1, '#8ab4e8'); for (let k = 0; k < 4; k++) R(x, 8 + k * 2, 6 + k, 14, 2, '#e8ecf2'); R(x, 22, 6, 6, 10, '#e8ecf2'); }, OUT);
    SPR.mastBase = sprite(30, 24, (x) => { R(x, 0, 8, 30, 16, '#8a93a3'); R(x, 0, 8, 30, 2, '#c8ccd4'); R(x, 26, 8, 4, 16, '#5a6272'); R(x, 4, 12, 10, 6, '#2a3040'); R(x, 6, 13, 2, 2, '#6edc82'); R(x, 2, 0, 26, 6, '#1d2a5a'); R(x, 2, 0, 26, 1, '#8ab4e8'); }, OUT);
  }
  // broadleaf, pine, bloom and bush, lit from the top left; lobes drawn back to front so the near ones overlap
  function treeCanvas(kind) {
    const GREEN = ['#8ad88a', '#5ab868', '#3e9a52', '#2a7040', '#1a4a2e'], PINK = ['#ffe0f2', '#ffb2dc', '#ff86c8', '#d850a0', '#8a2a68'];
    const lobe = (x, cx, cy, r, pal, dark = 0) => {
      for (let y = -r; y <= r; y++) for (let X = -r; X <= r; X++) {
        const d2 = (X * X + y * y) / (r * r); if (d2 > 1) continue;
        const leaf = (((cx + X) * 73 + (cy + y) * 151) % 13) / 13;
        const l = -X / r * .45 - y / r * .55 + Math.sqrt(1 - d2) * .5 + (leaf - .5) * .45 - dark;
        R(x, cx + X, cy + y, 1, 1, pal[l > .95 ? 0 : l > .62 ? 1 : l > .28 ? 2 : l > -.1 ? 3 : 4]);
      }
    };
    if (kind === 'tree') return sprite(64, 84, (x) => {
      R(x, 28, 50, 8, 34, '#5a3a24'); R(x, 28, 50, 3, 34, '#8a5a34'); R(x, 34, 50, 2, 34, '#3a2414'); R(x, 22, 80, 20, 4, '#3a2414');
      for (const [cx, cy, r, dk] of [[32, 18, 15, 0], [18, 28, 13, .05], [46, 28, 13, .12], [26, 40, 14, .15], [40, 42, 14, .22], [32, 32, 12, 0]]) lobe(x, cx, cy, r, GREEN, dk);
    }, OUT);
    if (kind === 'bloom') return sprite(60, 70, (x) => {
      R(x, 27, 44, 6, 26, '#5a3a24'); R(x, 27, 44, 2, 26, '#8a5a34'); R(x, 20, 66, 20, 4, '#3a2414');
      for (const [cx, cy, r, dk] of [[30, 16, 13, 0], [17, 26, 12, .05], [43, 26, 12, .12], [24, 36, 12, .15], [37, 37, 12, .22]]) lobe(x, cx, cy, r, PINK, dk);
      for (let k = 0; k < 40; k++) R(x, 8 + (k * 37) % 44, 6 + (k * 23) % 40, 1, 1, k % 3 ? '#ffffff' : '#fff0a0');
    }, OUT);
    if (kind === 'pine') return sprite(46, 90, (x) => {
      R(x, 21, 72, 5, 18, '#5a3a24'); R(x, 21, 72, 2, 18, '#8a5a34');
      for (let t = 0; t < 5; t++) {
        const y0 = t * 14, hgt = 22, wb = 8 + t * 4;
        for (let y = 0; y < hgt; y++) { const hw = Math.round(2 + (wb - 2) * y / hgt); for (let X = -hw; X <= hw; X++) { const k = X / (hw || 1), l = -k * .7 + (y < 4 && t > 0 ? -.6 : 0) - y / hgt * .3 + ((X * 7 + y * 13) % 5) * .05; R(x, 23 + X, y0 + y, 1, 1, GREEN[l > .45 ? 1 : l > 0 ? 2 : l > -.45 ? 3 : 4]); } }
      }
    }, OUT);
    return sprite(32, 22, (x) => { for (const [cx, cy, r, dk] of [[16, 9, 8, 0], [8, 13, 7, .1], [24, 13, 7, .18], [16, 15, 6, .25]]) lobe(x, cx, cy, r, GREEN, dk); }, OUT);
  }
  function benchCanvas() {
    return sprite(40, 26, (x) => { R(x, 0, 0, 40, 4, '#7a5a3a'); R(x, 0, 0, 40, 1, '#a8845a'); R(x, 0, 6, 40, 4, '#7a5a3a'); R(x, 0, 6, 40, 1, '#a8845a'); R(x, 2, 10, 36, 8, '#9a7248'); R(x, 2, 10, 36, 2, '#c8a070'); R(x, 2, 18, 36, 2, '#6a4a2c'); R(x, 4, 18, 3, 8, '#3a4252'); R(x, 33, 18, 3, 8, '#3a4252'); R(x, 4, 0, 2, 12, '#3a4252'); R(x, 34, 0, 2, 12, '#3a4252'); }, OUT);
  }

  // ---------- where the props stand: { s, X, Y } (Y is where it meets the ground); shadow shapes go with them
  let PROPS = null, SHADOWS = null;
  const CONTAINERS = [[16, 300, 0, 2], [16, 312, 1, 1], [40, 326, 3, 1], [490, 238, 2, 2]];   // left x, base y, colour, stack height
  const PARKED = [[400, 32, '#e8ecf2'], [422, 32, '#3a7ad8'], [455, 32, '#e8ecf2']];
  function placeProps() {
    const r = HS.R(5), P = [], S = [];
    const roadAt = (X, Y) => ROADS.some(rd => segDist(X, Y, rd) < 9) || (((X - 380) / 46) ** 2 + ((Y - 210) / 27) ** 2 < 1) || inRect(X, Y, [CARPARK[0] - 3, CARPARK[1] - 3, CARPARK[2] + 6, CARPARK[3] + 8]);
    const solid = (X, Y) => HS.CAMPUS_SOLID.some(([a, b, w, h]) => X > a - 6 && X < a + w + 6 && Y > b - 4 && Y < b + h + 16) || PATHS.some(p => segDist(X, Y, p) < 4) || GRAVEL.some(g => inRect(X, Y, [g[0] - 4, g[1] - 4, g[2] + 8, g[3] + 10]));
    const spawnNear = (X, Y) => HS.CAMPUS_SPAWNS.some(([a, b]) => Math.hypot(a - X, b - Y) < 9);
    // trees: clustered along the edges and between buildings
    const zones = [[256, 300, 46, 60], [10, 50, 50, 140], [96, 160, 56, 140], [400, 520, 66, 80], [600, 636, 20, 130], [176, 200, 130, 200], [400, 470, 300, 390], [250, 296, 222, 270], [10, 60, 220, 290], [590, 636, 230, 275], [150, 210, 352, 395], [480, 520, 176, 200], [4, 110, 350, 396], [330, 376, 350, 396]];
    for (let i = 0; i < 130; i++) {
      const z = zones[(r() * zones.length) | 0], X = z[0] + r() * (z[1] - z[0]), Y = z[2] + r() * (z[3] - z[2]), k = r();
      if (roadAt(X, Y) || solid(X, Y) || spawnNear(X, Y) || P.some(p => Math.hypot(p.X - X, (p.Y - Y) * 1.6) < 9)) continue;
      const s = k < .25 ? 'bloom' : k < .55 ? 'tree' : k < .78 ? 'pine' : 'bush';
      P.push({ s, X, Y });
      const z2 = { tree: [13, 6, 9], bloom: [11, 5, 8], pine: [8, 0, 13], bush: [5, 1, 1] }[s];
      if (s === 'pine') S.push({ pole: [X, Y, 7], z: 14 }); else S.push({ blob: [X + 1, Y - 1, z2[0] * .45, z2[0] * .3], z: z2[2] }), S.push({ pole: [X, Y, 1.4], z: z2[2] * .6 });
    }
    for (const [X, Y, w, h] of [[420, 232, 62, 40], [66, 300, 88, 46]]) for (let i = 0; i < 9; i++) { const s = r() < .6 ? 'crate' : 'case', cx = X + 6 + r() * (w - 14), cy = Y + 8 + r() * (h - 12); if (Math.abs(cx - 120) < 7) continue; P.push({ s, X: cx, Y: cy }); S.push({ box: [cx - 2.8, cy - 2, 5.6, 2], z: 4 }); }
    for (const [X, Y] of [[490, 300], [548, 322], [604, 288], [520, 362], [600, 340]]) { P.push({ s: 'tank', X, Y: Y + 8 }); S.push({ blob: [X + 1, Y + 3, 5.4, 3], z: 9 }); for (const lx of [-3.5, 0, 3.5]) S.push({ pole: [X + lx + 1, Y + 8, .6], z: 5 }); }
    for (const X of [70, 170, 270, 450, 540, 610]) { P.push({ s: 'lamp', X, Y: 203 }); S.push({ pole: [X, 203, .7], z: 12, cap: 1.4 }); }
    for (const Y of [90, 160, 250, 330]) { P.push({ s: 'lamp', X: 373, Y }); S.push({ pole: [373, Y, .7], z: 12, cap: 1.4 }); }
    P.push({ s: 'kiosk', X: 410, Y: 186 }); S.push({ box: [401, 178, 18, 8], z: 12 });
    P.push({ s: 'rocket', X: 545, Y: 104 }); S.push({ pole: [542, 104, 8], z: 32 }); S.push({ pole: [531, 104, 6], z: 48 });
    // the water tower, the weather mast, the windsock, flags in front of the quarters
    P.push({ s: 'watertower', X: 72, Y: 102 }); S.push({ blob: [72, 82, 6, 4], z: 18 }); for (const lx of [-5, 5]) S.push({ pole: [72 + lx, 102, .8], z: 18 });
    P.push({ s: 'mast', X: 112, Y: 60 }); S.push({ pole: [112, 60, .8], z: 20 });
    P.push({ s: 'windsock', X: 346, Y: 18 }); S.push({ pole: [346, 18, .6], z: 12 });
    for (const [i, X] of [[0, 232], [1, 242], [2, 252]]) { P.push({ s: 'flag', X, Y: 354, i }); S.push({ pole: [X, 354, .6], z: 17 }); }
    // shipping containers, some stacked two high
    for (const [X, Y, c, n] of CONTAINERS) { P.push({ s: 'container', X, Y, c, n }); S.push({ box: [X, Y - 5, 22, 5], z: 7 * n }); }
    // the car park
    for (const [X, Y, c] of PARKED) { P.push({ s: 'parked', X, Y, c }); S.push({ box: [X - 3, Y - 8, 6, 8], z: 4 }); }
    // street furniture: benches, bins, a picnic spot, hydrants, cones and drums, pallets, hedges, signs
    for (const [X, Y] of [[160, 222], [450, 222], [300, 360]]) { P.push({ s: 'bench', X, Y }); P.push({ s: 'bin', X: X + 5, Y }); }
    for (const [X, Y] of [[300, 238], [322, 248]]) { P.push({ s: 'table', X, Y }); S.push({ box: [X - 4, Y - 3, 8, 3], z: 2 }); }
    for (const [X, Y] of [[200, 203], [460, 203], [392, 300]]) P.push({ s: 'hydrant', X, Y });
    for (const [X, Y] of [[86, 203], [106, 203], [508, 224], [514, 224]]) P.push({ s: 'cone', X, Y });
    for (const [X, Y, c] of [[30, 205, 0], [34, 206, 1], [30, 209, 2], [486, 280, 0], [490, 281, 0], [594, 378, 1]]) P.push({ s: 'drum', X, Y, c });
    for (const [X, Y] of [[160, 208], [44, 342], [490, 268]]) { P.push({ s: 'pallet', X, Y }); S.push({ box: [X - 3.3, Y - 2, 6.6, 2], z: 3 }); }
    for (const X of [202, 214, 226, 238, 250, 290, 302, 314, 326, 338]) { P.push({ s: 'hedge', X, Y: 350 }); }
    S.push({ box: [197, 345, 66, 4], z: 3 }); S.push({ box: [285, 345, 66, 4], z: 3 });
    for (const [X, Y] of [[392, 196], [128, 226], [600, 222]]) { P.push({ s: 'sign', X, Y }); S.push({ pole: [X, Y, .6], z: 9 }); }
    // the buildings themselves
    for (const b of BLD) S.push({ box: [b.X, b.Y, b.w, b.h], z: b.F + (b.k === 'hangar' ? 4 : 0) });
    PROPS = P; SHADOWS = S;
  }
  // the fences round the parts yards (posts with a top rail; on the ground, under everything)
  function fences(x, cam) {
    for (const [X, Y, w, h] of [[420, 232, 62, 40], [66, 300, 88, 46]]) {
      const [a, b] = HS.wa(cam, X, Y), W = w * U, H = h * U;
      if (a > HS.AX1 || b > HS.AY1 || a + W < HS.AX0 || b + H < HS.AY0) continue;
      x.fillStyle = 'rgba(4,10,18,.25)'; x.fillRect(a + 4, b + 2, W, 2); x.fillRect(a + 4, b + H + 2, W, 2);
      for (let k = 0; k <= W; k += 4) { R(x, a + k, b - 8, 1, 9, 'rgba(160,166,176,.5)'); R(x, a + k, b + H - 8, 1, 9, 'rgba(160,166,176,.5)'); }
      R(x, a, b - 9, W, 2, '#a0a6b0'); R(x, a, b - 9, W, 1, '#d8dce4'); R(x, a, b + H - 9, W, 2, '#a0a6b0'); R(x, a, b + H - 9, W, 1, '#d8dce4');
      for (let k = 0; k <= H; k += 4) { R(x, a, b + k - 8, 2, 2, '#a0a6b0'); R(x, a + W, b + k - 8, 2, 2, '#8a909a'); }
      for (let k = 0; k <= W; k += 36) { R(x, a + k, b - 12, 3, 13, '#6a7282'); R(x, a + k, b + H - 12, 3, 13, '#6a7282'); R(x, a + k, b - 12, 1, 13, '#9aa2b2'); }
    }
  }

  let ground = null;
  const GHOST = make(1280, 720);   // resized to the stage when drawn
  // the campus is built by one generator: the sprites, the props, then the ground row by row
  let prep = null;
  function* prepAll() { yield* buildSprites(); placeProps(); yield; return yield* buildGround(SHADOWS); }
  const step = () => { prep ??= prepAll(); const r = prep.next(); if (r.done) ground = r.value; return r.done; };
  HS.campusReady = () => { while (!ground) step(); };
  // build a slice of the campus with a time budget; the main loop calls this while other scenes are showing,
  // so walking onto the campus does not stall
  HS.campusPrewarm = (ms) => { const end = performance.now() + ms; while (!ground && performance.now() < end) step(); return !!ground; };
  HS.CAMPUS_BLD = BLD;
  HS.CAMPUS_ROADS = ROADS;

  // draw the campus into the art layer. dyn: extra depth-sorted drawers [{ y, draw(x), who? }] (player, parts,
  // crew, vehicles). An entry with who: { X, Y } is the player: if a building hides it, a faint silhouette shows.
  HS.drawCampus = (x, cam, t, dyn, count) => {
    HS.campusReady();
    x.imageSmoothingEnabled = false;
    // the ground under the whole stage (it is stored at 3 px per unit, shown at 2x)
    x.drawImage(ground, (cam.ox + HS.AX0) / 2, (cam.oy + HS.AY0) / 2, HS.AW / 2, HS.AH / 2, HS.AX0, HS.AY0, HS.AW, HS.AH);
    fences(x, cam);
    const list = dyn.slice();
    if (HS.campusLife) for (const e of HS.campusLife.entries(cam, t, dyn)) list.push(e);
    for (const b of BLD) {
      const s = SPR[b.k], [a, top] = HS.wa(cam, b.X, b.Y - b.Rz);
      if (a > HS.AX1 || top > HS.AY1 || a + s.width < HS.AX0 || top + s.height < HS.AY0) continue;
      list.push({ y: b.Y + b.h, tall: [a - 1, top - 1, s.width, s.height], draw: (x) => { x.drawImage(s, a - 1, top - 1); if (b.k === 'tracking') drawDish(x, cam, t, b); } });
    }
    for (const p of PROPS) {
      const [a, b] = HS.wa(cam, p.X, p.Y);
      if (a < HS.AX0 - 200 || a > HS.AX1 + 200 || b < HS.AY0 - 40 || b > HS.AY1 + 380) continue;
      const e = { y: p.Y, draw: (x) => drawProp(x, p, a, b, t, count) };
      if (p.s === 'watertower' || p.s === 'container') e.tall = [a - 48, b - 190, 140, 190];
      list.push(e);
    }
    list.sort((p, q) => p.y - q.y);
    for (const d of list) d.draw(x);
    // anything a tall thing now covers (the player, a part) shows through as a pale silhouette. It is drawn
    // on its own canvas and tinted there, because the sprite helpers set and reset globalAlpha themselves.
    for (let i = 0; i < list.length; i++) {
      const d = list[i]; if (!d.ghost) continue;
      const [gx0, gy0, gx1, gy1] = d.ghost;
      for (let j = i + 1; j < list.length; j++) {
        const o = list[j].tall;
        if (!(o && gx1 > o[0] && gx0 < o[0] + o[2] && gy1 > o[1] && gy0 < o[1] + o[3])) continue;
        const [gc, gx] = GHOST;
        if (gc.width !== HS.AW || gc.height !== HS.AH) { gc.width = HS.AW; gc.height = HS.AH; }
        gx.setTransform(1, 0, 0, 1, HS.AOX, HS.AOY); gx.imageSmoothingEnabled = false;
        gx.globalCompositeOperation = 'source-over'; gx.clearRect(HS.AX0, HS.AY0, HS.AW, HS.AH); d.draw(gx);
        gx.globalCompositeOperation = 'source-in'; gx.globalAlpha = 1; gx.fillStyle = '#bfe6ff'; gx.fillRect(HS.AX0, HS.AY0, HS.AW, HS.AH);
        x.globalAlpha = .55; x.drawImage(gc, HS.AX0, HS.AY0); x.globalAlpha = 1;
        break;
      }
    }
    // the kiosk's marquee blinks
    const [ka, kb] = HS.wa(cam, 410, 186); if (Math.floor(t * 3) % 2) R(x, ka - 50, kb - 84, 98, 2, '#ffffff');
    if (HS.campusLife) HS.campusLife.over(x, cam, t);
  };
  // the tracking dish stands on the roof, so it is drawn with its building
  function drawDish(x, cam, t, b) {
    const s = SPR.dish[Math.floor(t * .7) % 4], [a, top] = HS.wa(cam, 237, b.Y - b.Rz + 12);
    x.fillStyle = 'rgba(4,10,18,.3)'; x.fillRect(a - 8, top - 6, 46, 10);
    x.drawImage(s, a - 36, top - s.height + 2);
    if (Math.floor(t * 1.2) % 2) { R(x, a - 1, top - s.height + 23, 3, 6, '#ff5a50'); }
  }
  function drawProp(x, p, a, b, t, count) {
    const calm = L.calm && L.calm();
    switch (p.s) {
      case 'rocket':
        L.gantry(x, a - 90, b, 300, t, 220, 28);
        L.padRocket(x, a, b - 4, count != null ? 4 + (Math.floor(t * 20) % 3) * 2 : 0, t, count != null ? (Math.sin(t * 8) > 0 ? '#6edc82' : '#1a5a2a') : '#ff5a50');
        if (count != null) for (let i = 0; i < 6; i++) { const k = (t * 1.4 + i / 6) % 1, X = a + Math.sin(i * 2.1 + t) * (20 + k * 60), Y = b + 6 - k * 30; x.globalAlpha = .6 * (1 - k); HS.shadow(x, X, Y, 20 + k * 40, 10 + k * 16, 1); x.globalAlpha = 1; }
        return;
      case 'kiosk': { const s = SPR.kiosk; x.drawImage(s, a - 56, b - s.height + 2); return; }
      case 'watertower': { const s = SPR.watertower; x.drawImage(s, a - 49, b - s.height + 2); if (calm || Math.floor(t * 1.1) % 2) { R(x, a - 2, b - s.height + 1, 4, 3, '#ff5a50'); x.fillStyle = 'rgba(255,90,80,.25)'; x.fillRect(a - 5, b - s.height - 2, 10, 9); } return; }
      case 'container': {
        const s = SPR.container[p.c];
        for (let k = 0; k < p.n; k++) x.drawImage(SPR.container[(p.c + k * 3) % 4], a - 1 + k * 4, b - s.height + 2 - k * 44);
        return;
      }
      case 'parked': { const s = HS.vanSprite ? HS.vanSprite('down', p.c) : null; if (s) x.drawImage(s, a - (s.width >> 1), b - s.height + 2); return; }
      case 'mast': {
        x.drawImage(SPR.mastBase, a - 15, b - 24);
        R(x, a - 2, b - 130, 4, 108, '#8a93a3'); R(x, a - 2, b - 130, 1, 108, '#c8ccd4'); for (let y = b - 126; y < b - 24; y += 8) R(x, a - 4, y, 8, 1, '#6a7282');
        const f = calm ? 0 : Math.floor(t * 10) % 4, cups = [[-10, 0], [0, -3], [10, 0], [0, 3]];
        R(x, a - 1, b - 140, 2, 10, '#5a6272');
        for (let k = 0; k < 3; k++) { const [dx, dy] = cups[(f + k) % 4]; R(x, a, b - 140, dx, 1, '#4a5262'); R(x, a + dx - 2, b - 141 + dy, 4, 3, '#e8ecf2'); }
        const vane = Math.sin(t * .4) * 3; R(x, a - 12 + vane, b - 116, 24, 2, '#4a5262'); R(x, a + 10 + vane, b - 119, 4, 7, '#f08c32');
        return;
      }
      case 'windsock': {
        R(x, a - 1, b - 72, 3, 72, '#8a93a3'); R(x, a - 1, b - 72, 1, 72, '#c8ccd4');
        for (let k = 0; k < 6; k++) { const wv = calm ? 0 : Math.sin(t * 5 - k * .8) * (k * .7), sag = k * 1.2; R(x, a + 2 + k * 6, b - 70 + sag + wv, 6, 10 - k, OUT); R(x, a + 2 + k * 6, b - 69 + sag + wv, 6, 8 - k, k % 2 ? '#e8ecf2' : '#ff7a2a'); R(x, a + 2 + k * 6, b - 69 + sag + wv, 6, 1, k % 2 ? '#ffffff' : '#ffb070'); }
        return;
      }
      case 'flag': {
        R(x, a - 1, b - 102, 3, 102, '#a8b0bc'); R(x, a - 1, b - 102, 1, 102, '#e8ecf2'); R(x, a - 2, b - 105, 5, 4, '#e6b946');
        const cols = [['#24324e', '#f08c32'], ['#2e7a4e', '#e8ecf2'], ['#e8ecf2', '#2a5a9a']][p.i];
        for (let k = 0; k < 30; k++) {
          const wv = calm ? 0 : Math.round(Math.sin(t * 4.5 - k * .3 + p.i) * (k / 30) * 3), sh = calm ? 0 : Math.cos(t * 4.5 - k * .3 + p.i);
          const base = k > 18 && k < 24 ? cols[1] : cols[0];
          R(x, a + 2 + k, b - 100 + wv, 1, 20, sh > .5 ? tone(base, 1.18) : sh < -.5 ? tone(base, .72) : base);
          if (k > 4 && k < 14) R(x, a + 2 + k, b - 94 + wv, 1, 8, cols[1]);
        }
        return;
      }
      case 'drum': { const s = SPR.drum[p.c]; HS.shadow(x, a + 4, b, 18, 5, .3); x.drawImage(s, a - 7, b - s.height + 2); return; }
    }
    const s = SPR[p.s];
    if (!s) return;
    if (['bench', 'bin', 'hydrant', 'cone', 'sign', 'hedge', 'table', 'pallet', 'crate', 'case'].includes(p.s)) HS.shadow(x, a + 4, b, s.width * .8, Math.max(4, s.height * .16), .28);
    x.drawImage(s, a - (s.width >> 1), b - s.height + 2);
  }
  // the four slot bays beside the pad: a mounted part sits on its cradle, an empty bay blinks
  HS.drawBays = (x, cam, slots, t) => {
    HS.SLOTS.forEach((slot, i) => {
      const [a, b] = HS.wa(cam, 518 + i * 18, 158), col = HS.CAT[slot], id = slots[slot];
      R(x, a - 40, b - 40, 80, 80, OUT); R(x, a - 39, b - 39, 78, 78, '#141e26'); R(x, a - 39, b - 39, 78, 3, '#2a3a4a');
      x.fillStyle = 'rgba(4,10,18,.5)'; x.fillRect(a - 39, b - 36, 6, 66);
      R(x, a - 39, b + 30, 78, 9, col); R(x, a - 39, b + 30, 78, 2, 'rgba(255,255,255,.4)'); R(x, a - 39, b + 38, 78, 2, 'rgba(0,0,0,.4)');
      if (id) { R(x, a - 22, b + 14, 44, 8, '#3a4252'); R(x, a - 22, b + 14, 44, 1, '#6a7282'); x.drawImage(HS.partIcon(id), a - 17, b - 22); R(x, a - 36, b - 36, 6, 6, '#78ffdc'); }
      else if (Math.floor(t * 2 + i) % 2) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { R(x, a + dx * 30 - (dx > 0 ? 12 : 0), b + dy * 30 - (dy > 0 ? 2 : 0), 12, 2, '#ffb43c'); R(x, a + dx * 30 - (dx > 0 ? 2 : 0), b + dy * 30 - (dy > 0 ? 12 : 0), 2, 12, '#ffb43c'); }
    });
  };
  // the TAB map: the whole campus at a glance
  let mapC = null;
  HS.campusMap = () => {
    if (mapC) return mapC;
    HS.campusReady();
    const [c, x] = make(960, 600); x.imageSmoothingEnabled = true;
    x.drawImage(ground, 0, 0, 960, 600);
    const items = PROPS.map(p => ({ y: p.Y, p })).concat(BLD.map(b => ({ y: b.Y + b.h, b }))).sort((a, b) => a.y - b.y);
    for (const it of items) {
      if (it.b) { const s = SPR[it.b.k]; x.drawImage(s, it.b.X * 1.5, (it.b.Y - it.b.Rz) * 1.5, s.width / 4, s.height / 4); continue; }
      const p = it.p, s = p.s === 'container' ? SPR.container[p.c] : p.s === 'drum' ? SPR.drum[p.c] : p.s === 'parked' ? (HS.vanSprite && HS.vanSprite('down', p.c)) : SPR[p.s];
      if (s && p.s !== 'rocket') x.drawImage(s, p.X * 1.5 - s.width / 8, p.Y * 1.5 - s.height / 4, s.width / 4, s.height / 4);
    }
    mapC = c; return c;
  };
})();
