// Homestead launch campus art, on the 1280 x 720 art grid (6 art pixels per world unit). The ground is a
// big floor fill, so it is drawn in 2 x 2 chunks; every building, tree, tank and crate is a 1 x 1 sprite with
// a dark outline, depth-sorted with the player so you can walk behind things. Built once, the first time
// the campus is shown. Collision and positions stay in js/world.js (HS.CAMPUS_SOLID, HS.PAD, HS.KIOSK).
(() => {
  const HS = window.HS, L = HS.liftoff, U = HS.U;
  const { R, hex, mix, sprite, make, fbm2, bayer, noise } = L;
  const OUT = HS.ART_OUT;
  const css = (c) => `rgb(${c.map(v => v | 0).join(',')})`;

  // ---------- the ground: 3 px per world unit, shown at 2x
  const ROADS = [[332, 33, 380, 62], [380, 62, 380, 380], [40, 210, 630, 210], [180, 118, 380, 118], [380, 270, 560, 296], [222, 210, 222, 270], [120, 210, 120, 380], [470, 210, 470, 148]];
  const hexIn = (u, v, cx, cy, r, sy) => { const dx = Math.abs(u - cx), dy = Math.abs(v - cy) / sy; return dy <= r * .866 && dx * .866 + dy * .5 <= r * .866; };
  function buildGround() {
    const K = 3, W = 640 * K, H = 400 * K;
    const [c, x] = make(W, H), d = x.createImageData(W, H), a = d.data;
    const grass = ['#1e4236', '#25503f', '#2c5c49', '#346853', '#3e7660'].map(hex);
    const asph = ['#3e434b', '#454a52', '#4b5058'].map(hex), curb = hex('#8c929e'), dash = hex('#e8d070');
    const conc = ['#7c828c', '#868c96', '#9298a2'].map(hex), seam = hex('#6a707a');
    const set = (i, col) => { a[i] = col[0]; a[i + 1] = col[1]; a[i + 2] = col[2]; a[i + 3] = 255; };
    const segs = ROADS.map(([x0, y0, x1, y1]) => ({ x0, y0, dx: x1 - x0, dy: y1 - y0, l2: (x1 - x0) ** 2 + (y1 - y0) ** 2, len: Math.hypot(x1 - x0, y1 - y0) }));
    for (let y = 0; y < H; y++) {
      for (let X = 0; X < W; X++) {
        const u = X / K, v = y / K, i = (y * W + X) * 4, bb = bayer(X, y);
        // grass: big soft patches, fine blades, dithered between five greens
        const n = fbm2(X / 60, y / 60, 32, 3), f = fbm2(X / 5, y / 5, 384, 1);
        let col = grass[Math.max(0, Math.min(4, Math.floor(n * 6.2 - 1.2 + (f - .5) * 1.3 + bb)))];
        // the runway along the top
        if (u >= 16 && u < 332 && v >= 22 && v < 44) {
          col = conc[Math.min(2, Math.floor(f * 2 + bb))];
          if (((u - 16) % 24) < .34 || v < 22.7 || v > 43.3) col = seam;
          if (v > 32.4 && v < 33.7 && (u - 26) % 16 < 7 && u > 26) col = hex('#e6eaf0');
          if ((v > 23.6 && v < 24.3) || (v > 41.7 && v < 42.4)) col = hex('#d8dce4');
        }
        // the pad apron and the service apron under the slot bays
        const onPad = hexIn(u, v, 545, 92, 46, .75);
        if (onPad) {
          col = conc[Math.min(2, Math.floor(f * 2 + bb))];
          if ((Math.floor(u / 8) + Math.floor(v / 8)) % 2 && f > .45) col = conc[0];
          if (hexIn(u, v, 545, 92, 40, .75) && !hexIn(u, v, 545, 92, 38.6, .75)) col = ((Math.atan2(v - 92, u - 545) * 6 / Math.PI + 12) % 1) < .5 ? hex('#f2c040') : hex('#2a2e36');
          if (hexIn(u, v, 545, 92, 26, .75)) col = mix(hex('#5a5e66'), hex('#3a3c42'), Math.max(0, 1 - Math.hypot(u - 545, (v - 96) * 1.4) / 26) * .8 + (f - .5) * .2);
        }
        if (u >= 500 && u < 590 && v >= 144 && v < 170) { col = conc[1 + (bb > .5 ? 1 : 0)]; if (v < 144.7) col = hex('#b4bac4'); if (v > 168.6) col = hex('#5c626e'); if (Math.abs(((u - 509) % 18)) < .4 && v > 146 && v < 168) col = hex('#e8c547'); }
        if (u > 540 && u < 550 && v >= 102 && v < 144) { col = mix(hex('#3a3c44'), hex('#1e2026'), (u - 540) / 10); if (Math.floor(v * 3) % 4 === 0) col = hex('#5a5e68'); if (u < 540.7 || u > 549.3) col = hex('#8c929e'); }
        // the path from the roundabout to the pad
        { const px0 = 380, py0 = 140, dx = 126, dy = -30, l2 = dx * dx + dy * dy, t = Math.max(0, Math.min(1, ((u - px0) * dx + (v - py0) * dy) / l2)), dd = Math.hypot(u - px0 - t * dx, v - py0 - t * dy);
          if (dd < 3.5) col = dd > 3.1 ? hex('#b4bac4') : conc[1 + (f > .55 ? 1 : 0)]; }
        // roads: asphalt, a pale curb, a yellow dashed centre line
        let best = 99, along = 0, sl = 0;
        for (const s of segs) { const t = Math.max(0, Math.min(1, ((u - s.x0) * s.dx + (v - s.y0) * s.dy) / s.l2)), dd = Math.hypot(u - s.x0 - t * s.dx, v - s.y0 - t * s.dy); if (dd < best) { best = dd; along = t * s.len; sl = s.len; } }
        const ring = ((u - 380) / 40) ** 2 + ((v - 210) / 22) ** 2, inner = ((u - 380) / 24) ** 2 + ((v - 210) / 13) ** 2;
        if (best < 4.5 || (ring < 1 && inner >= 1)) {
          col = asph[Math.min(2, Math.floor(f * 2.4 + bb * .8))];
          if ((best >= 4.0 && best < 4.5 && ring >= .9) || (ring < 1 && ring > .93) || (inner >= 1 && inner < 1.08)) col = curb;
          else if (best < .4 && sl > 60 && (along % 10) < 5 && ring > 1.1) col = dash;
        }
        if (inner < 1) { col = grass[3 + (f > .6 ? 1 : 0)]; if (inner < .42) { col = hex('#4a3424'); if (inner > .36) col = hex('#b4bac4'); else if (X % 4 < 2 && y % 4 < 2) col = ((X >> 2) + (y >> 2)) % 3 === 0 ? hex('#ff86c8') : ((X >> 2) + (y >> 2)) % 3 === 1 ? hex('#ffd27a') : hex('#4aa060'); } }
        set(i, col);
      }
    }
    x.putImageData(d, 0, 0);
    // grass tufts and wildflowers on the lawns, so they are never bare
    const r = noise(9), lawn = (X, Y) => { const i = (Y * W + X) * 4; return a[i + 1] > a[i] + 25 && a[i + 1] > a[i + 2] + 2 && a[i] < 80; };
    for (let n = 0; n < 9000; n++) {
      const X = (r() * (W - 4)) | 0, Y = (r() * (H - 4) + 2) | 0;
      if (!lawn(X, Y)) continue;
      const k = r();
      if (k < .8) { x.fillStyle = r() < .5 ? '#4e8a62' : '#173a2c'; x.fillRect(X, Y, 1, 1); x.fillRect(X + 1, Y - 1, 1, 1); x.fillRect(X + 2, Y, 1, 1); }
      else { x.fillStyle = ['#ffd27a', '#ffffff', '#ff96e1', '#a8c8ff'][(r() * 4) | 0]; x.fillRect(X, Y, 1, 1); }
    }
    // pipes between the fuel tanks, and the lift-off pad's blast marks
    x.fillStyle = '#9aa0aa';
    for (const [a0, b0, a1, b1] of [[490, 306, 548, 328], [548, 328, 604, 294], [520, 368, 548, 328], [600, 346, 548, 328]]) { const n = 80; for (let k = 0; k <= n; k++) x.fillRect(Math.round((a0 + (a1 - a0) * k / n) * K), Math.round((b0 + (b1 - b0) * k / n) * K), 2, 2); }
    return c;
  }

  // ---------- sprites, 1 x 1 at 6 px per unit
  const shadeC = (c, k) => css(hex(c).map(v => Math.max(0, Math.min(255, v * k))));
  function slab(x, w, h, base, hiK = 1.18, loK = .78) { R(x, 0, 0, w, h, base); R(x, 0, 0, w, 3, shadeC(base, hiK)); R(x, 0, 0, 3, h, shadeC(base, hiK * .97)); R(x, w - 3, 0, 3, h, shadeC(base, loK)); R(x, 0, h - 3, w, 3, shadeC(base, loK)); }
  // a building: roof over its footprint, then its front wall below
  function building(wu, hu, fu, roof, face) {
    const w = wu * U, h = hu * U, f = fu * U;
    return sprite(w, h + f, (x) => {
      x.save(); x.translate(0, h); face(x, w, f); x.restore();
      roof(x, w, h);
    }, OUT);
  }
  const winRow = (x, X0, Y, n, step, w, hh, t) => { for (let i = 0; i < n; i++) { const on = (i * 7) % 5 !== 1; R(x, X0 + i * step, Y, w, hh, OUT); R(x, X0 + i * step + 1, Y + 1, w - 2, hh - 2, on ? (i % 3 ? '#ffd27a' : '#78ffdc') : '#2a3442'); if (on) R(x, X0 + i * step + 1, Y + 1, w - 2, 2, i % 3 ? '#fff0c0' : '#c8fff0'); } };
  const ribs = (x, w, f, base, step) => { R(x, 0, 0, w, f, base); for (let X = 0; X < w; X += step) { R(x, X, 0, 1, f, shadeC(base, .8)); R(x, X + 1, 0, 1, f, shadeC(base, 1.15)); } R(x, 0, f - 6, w, 6, shadeC(base, .65)); R(x, 0, 0, w, 2, shadeC(base, 1.3)); };

  const SPR = {};
  function buildSprites() {
    // assembly building: skylights, roof units, a giant door with hazard paint
    SPR.assembly = building(72, 76, 14, (x, w, h) => {
      slab(x, w, h, '#5a6274');
      for (let X = 36; X < w; X += 36) R(x, X, 4, 1, h - 8, '#4e5666');
      for (let Y = 72; Y < h; Y += 72) R(x, 4, Y, w - 8, 1, '#4e5666');
      for (let i = 0; i < 6; i++) { const X = (6 + i * 11) * U, Y = 36; R(x, X - 2, Y - 2, 46, 88, '#8a93a3'); R(x, X, Y, 42, 84, '#24324e'); for (let k = 0; k < 30; k++) R(x, X + 6 + k, Y + 4 + k * 2, 3, 3, '#4a6a98'); R(x, X, Y, 42, 2, '#8ab4e8'); }
      for (const [X, Y] of [[48, 220], [180, 220], [312, 220], [96, 330], [264, 330]]) { R(x, X, Y, 48, 38, '#8a93a3'); R(x, X, Y, 48, 3, '#b4bcca'); R(x, X + 44, Y, 4, 38, '#6a7282'); R(x, X + 10, Y + 9, 22, 22, '#4a5262'); for (let k = 0; k < 4; k++) R(x, X + 12 + k * 5, Y + 11, 2, 18, '#2a3040'); }
      for (let X = 6; X < w - 6; X += 12) R(x, X, h - 9, 6, 4, (X / 12) % 2 ? '#f2c040' : '#2a2e36');
    }, (x, w, f) => {
      ribs(x, w, f, '#3e4554', 12); R(x, 0, 2, w, 5, '#f08c32'); R(x, 0, 7, w, 1, '#a85a1a');
      const dX = 26 * U, dw = 20 * U; R(x, dX - 6, 0, dw + 12, f, '#2a2e36');
      for (let Y = 0; Y < f; Y += 6) for (let X = dX - 6; X < dX + dw + 6; X += 12) R(x, X + ((Y / 6) % 2 ? 6 : 0), Y, 6, 6, '#f2c040');
      R(x, dX, 4, dw, f - 4, '#5a6272'); for (let Y = 8; Y < f; Y += 7) R(x, dX, Y, dw, 1, '#4a5262'); R(x, dX, 4, dw, 2, '#7a8292');
      winRow(x, 18, 30, 4, 22, 14, 12); winRow(x, w - 104, 30, 4, 22, 14, 12);
    });
    // tracking station: lit mission-control windows; its dish is a prop of its own
    SPR.tracking = building(88, 32, 10, (x, w, h) => {
      slab(x, w, h, '#626a7a');
      R(x, 36, 30, 180, 90, '#6e7688'); R(x, 36, 30, 180, 3, '#8a93a3'); R(x, 213, 30, 3, 90, '#525a6a');
      for (let i = 0; i < 6; i++) R(x, 50 + i * 26, 50, 16, 50, i % 2 ? '#525a6a' : '#5a6274');
      R(x, 300, 40, 140, 80, '#1d2a5a'); for (let k = 0; k < 140; k += 20) R(x, 300 + k, 40, 1, 80, '#2f4a9a'); R(x, 300, 80, 140, 1, '#2f4a9a'); R(x, 300, 40, 140, 2, '#8ab4e8');
    }, (x, w, f) => { ribs(x, w, f, '#454c5a', 18); winRow(x, 30, 16, 13, 38, 24, 22); });
    // hangar: a barrel-vault roof with corrugations, big sliding doors, one open a little
    SPR.hangar = building(124, 42, 9, (x, w, h) => {
      for (let y = 0; y < h; y++) { const k = Math.cos((y / h - .35) * Math.PI) ; R(x, 0, y, w, 1, css(mix(hex('#4a5262'), hex('#9aa4b4'), Math.max(0, k)))); }
      for (let X = 0; X < w; X += 8) R(x, X, 0, 2, h, 'rgba(20,24,32,.28)');
      R(x, 0, 0, w, 3, '#b4bcca'); R(x, 0, h - 4, w, 4, '#3a4252');
      for (const X of [120, 360, 600]) { R(x, X, 40, 30, 22, '#6a7282'); R(x, X + 4, 44, 22, 14, '#2a3040'); }
    }, (x, w, f) => {
      ribs(x, w, f, '#4a5262', 10);
      const pw = 180;
      for (let i = 0; i < 4; i++) { const X = 12 + i * pw + (i === 1 ? 50 : 0); R(x, X, 8, pw - 8, f - 8, '#6a7282'); R(x, X, 8, pw - 8, 2, '#8a93a3'); for (let k = 30; k < pw - 8; k += 30) R(x, X + k, 8, 1, f - 8, '#5a6272'); }
      R(x, 12 + pw, 8, 50, f - 8, '#141820'); R(x, 12 + pw + 8, 26, 30, 10, '#3a4252'); R(x, 12 + pw + 8, 26, 30, 2, '#f08c32');
      for (let X = 12; X < w - 12; X += 16) R(x, X, f - 4, 8, 4, '#f2c040');
    });
    // crew quarters: a habitat roof with solar panels and skylight domes, warm windows; the courtyard is open
    SPR.quarters = building(156, 54, 9, (x, w, h) => {
      slab(x, w, h, '#8a8478'); for (let X = 0; X < w; X += 60) R(x, X, 0, 1, h, '#7a7468');
      for (const [X, Y] of [[20, 16], [20, 200], [720, 16], [720, 200]]) { R(x, X, Y, 190, 100, '#1d2a5a'); for (let k = 0; k < 190; k += 19) R(x, X + k, Y, 1, 100, '#2f4a9a'); R(x, X, Y + 50, 190, 1, '#2f4a9a'); R(x, X, Y, 190, 2, '#8ab4e8'); }
      for (const [X, Y] of [[250, 30], [600, 30], [250, 270], [600, 270]]) { R(x, X, Y, 26, 20, '#c8d8f0'); R(x, X + 2, Y + 2, 10, 6, '#ffffff'); R(x, X + 20, Y, 6, 20, '#8aa0c0'); }
      // the courtyard: grass, a cross path, a tree and a bench (cut out of the roof)
      const cx = 240, cy = 72, cw = 456, ch = 180;
      R(x, cx - 3, cy - 3, cw + 6, ch + 6, '#5a5448');
      R(x, cx, cy, cw, ch, '#2c5c49'); for (let k = 0; k < 400; k++) R(x, cx + (k * 97) % cw, cy + (k * 61) % ch, 2, 2, k % 3 ? '#346853' : '#25503f');
      R(x, cx, cy + 80, cw, 20, '#a8a090'); R(x, cx + 218, cy, 20, ch, '#a8a090');
      R(x, cx + 80, cy + 30, 50, 10, '#7a5a3a'); R(x, cx + 80, cy + 40, 4, 6, '#3a2a1a'); R(x, cx + 126, cy + 40, 4, 6, '#3a2a1a');
    }, (x, w, f) => { ribs(x, w, f, '#6a6458', 14); winRow(x, 16, 14, 22, 42, 26, 22); R(x, w / 2 - 20, 6, 40, f - 6, '#2a3040'); R(x, w / 2 - 18, 8, 36, 4, '#78ffdc'); });

    // the parts kiosk: a capsule machine full of parts in the four slot colours
    SPR.kiosk = sprite(110, 150, (x) => {
      R(x, 6, 70, 98, 80, '#c43a92'); R(x, 6, 70, 98, 4, '#ff96e1'); R(x, 6, 70, 4, 80, '#e866b4'); R(x, 90, 70, 14, 80, '#8a2468');
      R(x, 20, 86, 50, 24, '#1a1424'); R(x, 22, 88, 46, 20, '#3a1a4a'); for (let k = 0; k < 4; k++) R(x, 26 + k * 10, 92 + (k % 2) * 4, 6, 6, ['#f08c32', '#5a96f5', '#e6ebf0', '#e6b946'][k]);
      R(x, 74, 92, 14, 14, '#2a1a2a'); R(x, 76, 94, 10, 10, '#d8dce4'); R(x, 80, 95, 2, 8, '#2a1a2a');
      R(x, 30, 120, 40, 18, '#2a1a2a'); R(x, 32, 122, 36, 14, '#140c14'); R(x, 76, 120, 10, 4, '#ffd27a');
      // the glass dome with capsules inside
      for (let y = 0; y < 70; y++) { const hw = Math.round(48 * Math.sqrt(Math.max(0, 1 - ((70 - y) / 72) ** 2))); R(x, 55 - hw, y, hw * 2, 1, 'rgba(170,220,255,.35)'); }
      const caps = [[30, 50], [44, 56], [58, 52], [72, 58], [36, 38], [52, 40], [66, 42], [80, 46], [24, 60], [44, 28], [60, 26]];
      caps.forEach(([X, Y], i) => { const c = ['#f08c32', '#5a96f5', '#e6ebf0', '#e6b946'][i % 4]; R(x, X - 5, Y - 5, 10, 10, OUT); R(x, X - 4, Y - 4, 8, 8, c); R(x, X - 4, Y, 8, 4, '#ffffff'); R(x, X - 3, Y - 3, 2, 2, '#ffffff'); });
      for (let y = 4; y < 60; y++) R(x, 22 + y * .25, y, 2, 1, 'rgba(255,255,255,.45)');
      R(x, 4, 66, 102, 6, '#8a2468'); R(x, 4, 66, 102, 2, '#ff96e1');
    }, OUT);

    // fuel tanks: spheres on legs with a band and a ladder
    SPR.tank = sprite(66, 74, (x) => {
      for (const X of [10, 30, 50]) { R(x, X, 44, 5, 30, '#6a7282'); R(x, X, 44, 2, 30, '#8a93a3'); }
      for (let y = 0; y < 56; y++) { const k = (y - 28) / 28, hw = Math.round(32 * Math.sqrt(Math.max(0, 1 - k * k))); for (let X = -hw; X < hw; X++) { const l = (-(X / 32) * .55 - k * .65 + Math.sqrt(Math.max(0, 1 - (X / 32) ** 2 - k * k)) * .55); R(x, 33 + X, y, 1, 1, l > .55 ? '#ffffff' : l > .25 ? '#e8ecf2' : l > -.1 ? '#c8ccd4' : l > -.4 ? '#9aa2b2' : '#7a8292'); } }
      R(x, 2, 26, 62, 4, '#f08c32'); R(x, 2, 26, 30, 1, '#ffb070'); R(x, 52, 4, 3, 50, '#4a5262');
    }, OUT);
    // trees and shrubs: three greens and the pink flowering kind the campus is known for
    const canopy = (x, cx, cy, r, cols) => { for (let y = -r; y <= r; y++) { const hw = Math.round(r * Math.sqrt(Math.max(0, 1 - (y / (r + .5)) ** 2))); for (let X = -hw; X <= hw; X++) { const l = -(X / r) * .5 - (y / r) * .7 + ((X * 7 + y * 13) % 5) * .06; R(x, cx + X, cy + y, 1, 1, cols[l > .45 ? 0 : l > .05 ? 1 : l > -.4 ? 2 : 3]); } } };
    const GREEN = ['#6ac86a', '#3e9a52', '#2a7040', '#1a4a2e'], PINK = ['#ffc2e8', '#ff86c8', '#d850a0', '#8a2a68'];
    SPR.tree = sprite(44, 54, (x) => { R(x, 19, 34, 6, 20, '#5a3a24'); R(x, 19, 34, 2, 20, '#7a5234'); canopy(x, 22, 20, 19, GREEN); canopy(x, 14, 12, 6, GREEN); }, OUT);
    SPR.pine = sprite(34, 58, (x) => { R(x, 15, 46, 5, 12, '#5a3a24'); for (let y = 0; y < 48; y++) { const hw = Math.round(2 + (y % 14) * .9 + y * .22); for (let X = -hw; X <= hw; X++) R(x, 17 + X, y, 1, 1, X < -hw * .3 ? '#3e9a52' : X < hw * .4 ? '#2a7040' : '#1a4a2e'); } }, OUT);
    SPR.bloom = sprite(34, 28, (x) => { canopy(x, 17, 15, 11, GREEN); canopy(x, 9, 18, 7, GREEN); canopy(x, 25, 18, 7, GREEN); for (const [X, Y] of [[11, 8], [19, 6], [24, 12], [8, 15], [15, 13], [21, 18], [12, 21], [28, 19], [17, 23], [5, 20]]) { R(x, X - 1, Y, 3, 1, PINK[1]); R(x, X, Y - 1, 1, 3, PINK[1]); R(x, X, Y, 1, 1, '#fff0a0'); R(x, X + 1, Y + 1, 1, 1, PINK[3]); } }, OUT);
    SPR.bush = sprite(28, 18, (x) => { canopy(x, 14, 10, 8, GREEN); canopy(x, 7, 12, 5, GREEN); canopy(x, 21, 12, 5, GREEN); }, OUT);
    // crates in the parts yards: wood with straps, and grey metal cases; dull on purpose, so real parts stand out
    SPR.crate = sprite(34, 32, (x) => { R(x, 0, 8, 34, 24, '#8a6440'); R(x, 0, 0, 34, 8, '#b48a5a'); R(x, 0, 0, 34, 2, '#d0a878'); R(x, 0, 8, 34, 2, '#6a4a2c'); R(x, 6, 0, 3, 32, '#5a3e24'); R(x, 25, 0, 3, 32, '#5a3e24'); R(x, 30, 8, 4, 24, '#6a4a2c'); }, OUT);
    SPR.case = sprite(34, 26, (x) => { R(x, 0, 6, 34, 20, '#5a6272'); R(x, 0, 0, 34, 6, '#7a8292'); R(x, 0, 0, 34, 1, '#9aa2b2'); R(x, 14, 10, 6, 4, '#c8ccd4'); R(x, 0, 6, 34, 1, '#3a4252'); R(x, 30, 6, 4, 20, '#4a5262'); }, OUT);
    SPR.lamp = sprite(14, 70, (x) => { R(x, 6, 10, 3, 60, '#4a5262'); R(x, 6, 10, 1, 60, '#7a8292'); R(x, 0, 4, 14, 7, '#3a4252'); R(x, 2, 9, 10, 3, '#fff4d0'); R(x, 2, 66, 11, 4, '#3a4252'); }, OUT);
    // the tracking dish, in four turns
    SPR.dish = [0, 1, 2, 3].map((f) => sprite(70, 96, (x) => {
      R(x, 33, 50, 5, 46, '#7a8292'); R(x, 33, 50, 2, 46, '#9aa2b2'); R(x, 22, 88, 26, 8, '#4a5262');
      const w = [30, 22, 12, 22][f], flip = f === 3 ? -1 : 1;
      for (let y = 0; y < 50; y++) { const k = (y - 25) / 25, hw = Math.round(w * Math.sqrt(Math.max(0, 1 - k * k))); R(x, 35 - hw, y, hw * 2, 1, f === 2 ? '#aab2c0' : y < 20 ? '#f2f4f8' : '#d8dce4'); if (hw > 2) R(x, 35 + flip * (hw - 3), y, 3, 1, '#8a92a2'); }
      R(x, 34, 22, 3, 6, '#ff5a50');
    }, OUT));
  }

  // where the props stand: [sprite, world x of the left edge, world y of the base, base offset]
  let PROPS = null;
  function placeProps() {
    const r = HS.R(5), P = [];
    // trees in the same zones the old map used for its shrubs
    const zones = [[256, 300, 44, 90], [20, 110, 60, 140], [400, 470, 20, 70], [600, 636, 20, 130], [176, 200, 130, 200], [380, 470, 310, 390], [250, 296, 200, 270], [10, 60, 220, 290], [590, 636, 230, 270], [150, 210, 350, 395], [460, 520, 176, 200]];
    const roadAt = (X, Y) => ROADS.some(([x0, y0, x1, y1]) => { const dx = x1 - x0, dy = y1 - y0, t = Math.max(0, Math.min(1, ((X - x0) * dx + (Y - y0) * dy) / (dx * dx + dy * dy))); return Math.hypot(X - x0 - t * dx, Y - y0 - t * dy) < 9; });
    const solid = (X, Y) => HS.CAMPUS_SOLID.some(([a, b, w, h]) => X > a - 6 && X < a + w + 6 && Y > b - 4 && Y < b + h + 16);
    for (let i = 0; i < 90; i++) {
      const z = zones[(r() * zones.length) | 0], X = z[0] + r() * (z[1] - z[0]), Y = z[2] + r() * (z[3] - z[2]), k = r();
      if (roadAt(X, Y) || solid(X, Y)) continue;
      const s = k < .3 ? 'bloom' : k < .55 ? 'tree' : k < .75 ? 'pine' : 'bush';
      P.push({ s, X, Y });
    }
    for (const [X, Y, w, h] of [[420, 232, 62, 40], [66, 300, 88, 46]]) for (let i = 0; i < 9; i++) P.push({ s: r() < .6 ? 'crate' : 'case', X: X + 6 + r() * (w - 14), Y: Y + 8 + r() * (h - 12) });
    for (const [X, Y] of [[490, 300], [548, 322], [604, 288], [520, 362], [600, 340]]) P.push({ s: 'tank', X, Y: Y + 8 });
    for (const X of [70, 170, 270, 450, 540, 610]) P.push({ s: 'lamp', X, Y: 203 });
    for (const Y of [90, 160, 250, 330]) P.push({ s: 'lamp', X: 373, Y });
    P.push({ s: 'kiosk', X: 410, Y: 186 });
    P.push({ s: 'dish', X: 237, Y: 66 });
    P.push({ s: 'rocket', X: 545, Y: 104 });
    PROPS = P;
  }
  // the fences round the parts yards (on the ground, under everything)
  function fences(x, cam) {
    for (const [X, Y, w, h] of [[420, 232, 62, 40], [66, 300, 88, 46]]) {
      const [a, b] = HS.wa(cam, X, Y), W = w * U, H = h * U;
      if (a > 1280 || b > 720 || a + W < 0 || b + H < 0) continue;
      for (let k = 0; k <= W; k += 4) { R(x, a + k, b, 2, 2, '#a0a6b0'); R(x, a + k, b + H, 2, 2, '#a0a6b0'); }
      for (let k = 0; k <= H; k += 4) { R(x, a, b + k, 2, 2, '#a0a6b0'); R(x, a + W, b + k, 2, 2, '#a0a6b0'); }
      for (let k = 0; k <= W; k += 36) { R(x, a + k, b - 10, 3, 12, '#6a7282'); R(x, a + k, b + H - 10, 3, 12, '#6a7282'); }
    }
  }

  let ground = null;
  HS.campusReady = () => { if (!ground) { ground = buildGround(); buildSprites(); placeProps(); } };
  const BLD = [['assembly', 300, 100], ['tracking', 168, 66], ['hangar', 48, 150], ['quarters', 196, 280]];

  // draw the campus into the art layer. dyn: extra depth-sorted drawers [{ y, draw(x) }] (player, parts, smoke)
  HS.drawCampus = (x, cam, t, dyn, count) => {
    HS.campusReady();
    x.imageSmoothingEnabled = false;
    x.drawImage(ground, cam.ox / 2, cam.oy / 2, 640, 360, 0, 0, 1280, 720);
    fences(x, cam);
    for (const [k, X, Y] of BLD) { const s = SPR[k], [a, b] = HS.wa(cam, X, Y); if (a < 1280 && b < 720 && a + s.width > 0 && b + s.height > 0) { x.globalAlpha = .3; x.fillStyle = '#000'; x.fillRect(a + 8, b + 8, s.width - 2, s.height - 2); x.globalAlpha = 1; x.drawImage(s, a - 1, b - 1); } }
    const list = dyn.slice();
    for (const p of PROPS) {
      const [a, b] = HS.wa(cam, p.X, p.Y);
      if (a < -200 || a > 1480 || b < -40 || b > 1100) continue;
      list.push({ y: p.Y, draw: (x) => drawProp(x, p, a, b, t, count) });
    }
    list.sort((p, q) => p.y - q.y);
    for (const d of list) d.draw(x);
    // the kiosk's marquee blinks
    const [ka, kb] = HS.wa(cam, 410, 186); if (Math.floor(t * 3) % 2) R(x, ka - 50, kb - 84, 98, 2, '#ffffff');
  };
  function drawProp(x, p, a, b, t, count) {
    if (p.s === 'rocket') {
      // the gantry, the rocket and venting; the countdown adds smoke at the base
      L.gantry(x, a - 90, b, 300, t, 220, 28);
      L.padRocket(x, a, b - 4, count != null ? 4 + (Math.floor(t * 20) % 3) * 2 : 0, t, count != null ? (Math.sin(t * 8) > 0 ? '#6edc82' : '#1a5a2a') : '#ff5a50');
      if (count != null) for (let i = 0; i < 6; i++) { const k = (t * 1.4 + i / 6) % 1, X = a + Math.sin(i * 2.1 + t) * (20 + k * 60), Y = b + 6 - k * 30; x.globalAlpha = .6 * (1 - k); HS.shadow(x, X, Y, 20 + k * 40, 10 + k * 16, 1); x.globalAlpha = 1; }
      return;
    }
    if (p.s === 'dish') { const s = SPR.dish[Math.floor(t * .7) % 4]; x.drawImage(s, a - 36, b - s.height); return; }
    if (p.s === 'kiosk') { const s = SPR.kiosk; HS.shadow(x, a + 6, b - 2, 120, 16, .3); x.drawImage(s, a - 56, b - s.height + 2); return; }
    const s = SPR[p.s];
    HS.shadow(x, a + 4, b, s.width * .9, Math.max(5, s.height * .18), .3);
    x.drawImage(s, a - (s.width >> 1), b - s.height + 2);
  }
  // the four slot bays beside the pad: a mounted part sits on its cradle, an empty bay blinks
  HS.drawBays = (x, cam, slots, t) => {
    HS.SLOTS.forEach((slot, i) => {
      const [a, b] = HS.wa(cam, 518 + i * 18, 158), col = HS.CAT[slot], id = slots[slot];
      R(x, a - 40, b - 40, 80, 80, OUT); R(x, a - 39, b - 39, 78, 78, '#141e26'); R(x, a - 39, b - 39, 78, 3, '#2a3a4a');
      R(x, a - 39, b + 30, 78, 9, col); R(x, a - 39, b + 30, 78, 2, 'rgba(255,255,255,.4)');
      if (id) { R(x, a - 22, b + 14, 44, 8, '#3a4252'); x.drawImage(HS.partIcon(id), a - 17, b - 22); R(x, a - 36, b - 36, 6, 6, '#78ffdc'); }
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
    for (const [k, X, Y] of BLD) { const s = SPR[k]; x.drawImage(s, X * 1.5, Y * 1.5, s.width / 4, s.height / 4); }
    for (const p of PROPS) { const s = p.s === 'rocket' ? null : p.s === 'dish' ? SPR.dish[0] : SPR[p.s]; if (s) x.drawImage(s, p.X * 1.5 - s.width / 8, p.Y * 1.5 - s.height / 4, s.width / 4, s.height / 4); }
    mapC = c; return c;
  };
})();
