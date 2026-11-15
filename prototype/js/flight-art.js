// Homestead flight art: the four ship stations on the 1280 x 720 art grid (src/ui/ART-RULES.md).
// The flight scene keeps its gameplay in the old 160 x 90 q-space (one q pixel is 8 art pixels) and its HUD in
// 640-space (one unit is 2 art pixels); this file only draws. Light comes from the top left, sprites carry a
// 1 px dark outline, and everything heavy is built the first time it is needed and then cached.
(() => {
  const HS = window.HS, L = HS.liftoff;
  const { R, hex, mix, sprite, make, noise, fbm, fbm2, bayer, clamp } = L;
  const OUT = HS.ART_OUT, TAU = Math.PI * 2;
  const FA = HS.flightArt = {};
  let calmV = null;
  const calm = () => (calmV ??= !!L.calm());

  // ---------- helpers
  // a canvas filled pixel by pixel: fn(set, w, h), set(X, Y, [r, g, b], alpha)
  function paint(w, h, fn) {
    const [c, x] = make(w, h), d = x.createImageData(w, h), a = d.data;
    fn((X, Y, col, al = 255) => { const o = (Y * w + X) * 4; a[o] = col[0]; a[o + 1] = col[1]; a[o + 2] = col[2]; a[o + 3] = al; }, w, h);
    x.putImageData(d, 0, 0);
    return c;
  }
  // give a pixel canvas the 1 px outline (it grows by 1 on every side)
  const outlined = (c) => sprite(c.width, c.height, (x) => x.drawImage(c, 0, 0), OUT);
  // a cylinder lit from the left: [deep, shade, base, highlight] spread across n columns (the pad rocket's bands)
  const CYL = [[.03, 2], [.19, 3], [.66, 2], [.86, 1], [1, 0]];
  function bands(x, X0, Y, n, pal, h = 1) {
    let a = 0;
    for (const [b, k] of CYL) { const e = Math.round(b * n); if (e > a) { R(x, X0 + a, Y, e - a, h, pal[k]); a = e; } }
  }
  // the same lit from the top, for horizontal pipes and caps
  function rowsLit(x, X0, Y0, w, n, pal) {
    let a = 0;
    for (const [b, k] of CYL) { const e = Math.round(b * n); if (e > a) { R(x, X0, Y0 + a, w, e - a, pal[k]); a = e; } }
  }
  const rivet = (x, X, Y) => { R(x, X, Y, 3, 3, '#4a5462'); R(x, X, Y, 2, 1, '#7a8492'); R(x, X, Y + 1, 1, 1, '#7a8492'); R(x, X + 2, Y + 1, 1, 2, '#151a21'); R(x, X + 1, Y + 2, 1, 1, '#151a21'); };
  const disc = (x, cx, cy, r, col) => { for (let y = -r; y <= r; y++) { const hw = Math.round(Math.sqrt(Math.max(0, r * r - y * y))); R(x, cx - hw, cy + y, hw * 2 + 1, 1, col); } };
  const line = (x, x0, y0, x1, y1, col, w = 1) => { const n = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) R(x, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), w, w, col); };
  // a soft additive glow
  const glows = new Map();
  function glowC(r, rgb) {
    const k = r + '|' + rgb; let c = glows.get(k);
    if (!c) {
      const [cv, x] = make(r * 2, r * 2), gr = x.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(.35, `rgba(${rgb},.35)`); gr.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = gr; x.fillRect(0, 0, r * 2, r * 2); c = cv; glows.set(k, c);
    }
    return c;
  }
  function glow(x, cx, cy, r, rgb, a) {
    if (a <= 0) return;
    x.globalCompositeOperation = 'lighter'; x.globalAlpha = Math.min(1, a);
    x.drawImage(glowC(r, rgb), Math.round(cx - r), Math.round(cy - r));
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  }

  const css = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  // ---------- palettes (shades of the title film's colours)
  const HULL = ['#8a92a2', '#aab2c0', '#dfe3ea', '#ffffff'];
  const DARK = ['#2a2e36', '#3e444f', '#5a606c', '#8a909c'];
  const STEEL = ['#3a4252', '#4a5262', '#6a7282', '#9aa2b2'];
  const GUN = ['#22282f', '#2e353f', '#434b57', '#646d7b'];
  const ORANGE = ['#8a4a14', '#b8641e', '#f08c32', '#ffb070'];
  const COPPER = ['#6a3a16', '#8a4e22', '#c07a3a', '#e8a868'];
  const COPPER_D = ['#4a2810', '#6a3a16', '#9a5e2c', '#c08850'];
  const GRAPH = ['#16181e', '#24272f', '#3c4049', '#5e646f'];
  const RUSTP = ['#4a2a18', '#6a4028', '#8a5a3a', '#b07a4a'];
  const RED = ['#5a1414', '#9a2a2a', '#dc4646', '#ff8a7a'];
  const PIPE_ON = ['#1a3470', '#2a56b0', '#4688e6', '#8ab8ff'];
  const PIPE_OFF = ['#1e232b', '#2b313b', '#3a4250', '#566170'];

  // =====================================================================
  // PILOT: deep space, Earth, the destination and debris (drawn in first person by js/cockpit-art.js), and the
  // ship, which the build screen's blueprint shows
  // =====================================================================

  // the sky: a dithered gradient, the Milky Way and the Sun's glow from the top left, in 2 x 2 chunks
  let BG = null;
  function background() {
    if (BG) return BG;
    const top = [4, 6, 15], bot = [11, 16, 38], band = [[22, 26, 58], [36, 36, 78], [58, 52, 100]];
    const half = paint(640, 360, (set) => {
      for (let y = 0; y < 360; y++) for (let X = 0; X < 640; X++) {
        const b = bayer(X, y), k = y / 360;
        let c = mix(top, bot, Math.floor(k * 6 + b) / 6);
        const u = X / 640, v = y / 360, dl = v - (1.02 - u * .82);
        const n = fbm2(X / 70, y / 70, 16, 4), dust = fbm2(X / 26 + 7, y / 26, 32, 3);
        const gal = Math.exp(-(dl * dl) / .02) * clamp((n - .3) * 2.4) * (1 - clamp((dust - .54) * 4) * .85);
        const lv = Math.floor(gal * 3.2 + b - .2);
        if (lv > 0) c = band[Math.min(2, lv - 1)];
        const sun = Math.max(0, 1 - Math.hypot(X + 40, y + 60) / 330) ** 2;
        const sl = Math.floor(sun * 3 + b * .99);
        if (sl > 0) c = mix(c, [70, 62, 52], sl * .2);
        set(X, y, c);
      }
    });
    const [c, x] = make(1280, 720); x.drawImage(half, 0, 0, 1280, 720); BG = c;
    return c;
  }

  // the top of a radius-576 Earth: only the cap that ever shows is rendered, like the film's earthSphere
  let EARTH = null;
  function earthCap() {
    if (EARTH) return EARTH;
    const r = 576, rows = 100, halo = 16, hw = Math.ceil(Math.sqrt(r * r - (r - rows) ** 2)) + halo, W = hw * 2, H = rows + halo;
    const Lv = [-0.55, -0.6, 0.58], tilt = 1.15, ct = Math.cos(tilt), st = Math.sin(tilt);
    const c = paint(W, H, (set) => {
      const cx = W / 2, cy = halo + r;
      for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) {
        const nx = (X + .5 - cx) / r, ny = (y + .5 - cy) / r, rr = nx * nx + ny * ny;
        if (rr > 1) {
          // the atmosphere, a dithered blue haze over the limb, brighter on the sunward side
          const dd = (Math.sqrt(rr) - 1) * r;
          if (dd < halo) { const lit = clamp(.45 - nx * 1.1), a = (1 - dd / halo) ** 2.2 * (.2 + .8 * lit); if (a > bayer(X, y) * .95 + .03) set(X, y, a > .45 ? [140, 210, 255] : a > .2 ? [70, 140, 230] : [36, 72, 150]); }
          continue;
        }
        const nz = Math.sqrt(1 - rr);
        let lum = clamp(nx * Lv[0] + ny * Lv[1] + nz * Lv[2]);
        // the globe is tipped towards us so the limb shows land and sea, not the pole
        const sx = nx, sy = ny * ct + nz * st, sz = -ny * st + nz * ct;
        const n = fbm(sx * 2.2 + 11, sy * 2.2, sz * 2.2, 5), land = n > 0.53;
        let col = land ? mix(hex('#2e6a2a'), hex('#b89a5a'), clamp((n - 0.55) * 4)) : mix(hex('#0c2a6a'), hex('#1f5ab0'), clamp(sz));
        const cl = fbm(sx * 3, sy * 6, sz * 3 + 20, 4);
        if (cl > 0.56) col = mix(col, hex('#f4f8ff'), clamp((cl - 0.56) * 5));
        col = mix(col, [120, 190, 255], clamp((1 - nz) * 2.4 - 1.2) * .7);   // blue haze along the limb
        const q = lum * 4, base = Math.floor(q), band = clamp((base + (q - base > bayer(X, y) ? 1 : 0)) / 4, 0.08, 1.1);
        set(X, y, [col[0] * band, col[1] * band, col[2] * band]);
      }
    });
    EARTH = { c, halo };
    return EARTH;
  }

  // the destination: a surface map made once, then lit and dithered for each size it grows through
  const TW = 256, TH = 128, texs = {};
  function planetTex(dest) {
    if (texs[dest]) return texs[dest];
    const mars = dest === 'mars', tex = new Uint8ClampedArray(TW * TH * 3), r = noise(mars ? 17 : 91);
    const craters = Array.from({ length: mars ? 26 : 70 }, () => { const lo = r() * TAU, la = Math.asin(r() * 2 - 1), rad = .03 + Math.pow(r(), 2.5) * (mars ? .12 : .16); return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo), rad]; });
    for (let v = 0; v < TH; v++) for (let u = 0; u < TW; u++) {
      const lo = u / TW * TAU, la = (v / TH - .5) * Math.PI, sx = Math.cos(la) * Math.sin(lo), sy = Math.sin(la), sz = Math.cos(la) * Math.cos(lo);
      let col;
      if (mars) {
        const n = fbm(sx * 1.8 + 3, sy * 1.8, sz * 1.8, 5);
        col = mix([186, 98, 58], [228, 152, 98], clamp((n - .42) * 3));
        if (n < .45) col = mix(col, [98, 52, 36], clamp((.45 - n) * 7));
        if (Math.abs(sy) > .86 + (fbm(sx * 5, sy * 5, sz * 5, 3) - .5) * .12) col = [238, 230, 224];
      } else {
        const n = fbm(sx * 2 + 5, sy * 2, sz * 2, 5);
        col = mix([150, 150, 156], [200, 200, 204], clamp((n - .4) * 3));
        if (n < .44) col = mix(col, [84, 84, 92], clamp((.44 - n) * 9));
      }
      for (const [cx, cy, cz, cr] of craters) {
        const d = Math.acos(clamp(sx * cx + sy * cy + sz * cz, -1, 1)) / cr;
        if (d < .8) col = mix(col, [col[0] * .72, col[1] * .72, col[2] * .74], .8);
        else if (d < 1.15) col = mix(col, [255, 248, 236], .32);
      }
      const o = (v * TW + u) * 3; tex[o] = col[0]; tex[o + 1] = col[1]; tex[o + 2] = col[2];
    }
    return (texs[dest] = tex);
  }
  const planets = new Map();
  function planetSprite(dest, r) {
    const k = dest + r; let c = planets.get(k);
    if (c) return c;
    const tex = planetTex(dest), mars = dest === 'mars', Lv = [-0.6, -0.55, 0.58], tilt = .35, ct = Math.cos(tilt), st = Math.sin(tilt), pad = mars ? 3 : 1, S = r * 2 + pad * 2;
    c = paint(S, S, (set) => {
      for (let y = 0; y < S; y++) for (let X = 0; X < S; X++) {
        const nx = (X + .5 - S / 2) / r, ny = (y + .5 - S / 2) / r, rr = nx * nx + ny * ny;
        if (rr > 1) {
          // Mars keeps a thin pink haze on its lit limb
          if (mars) { const dd = (Math.sqrt(rr) - 1) * r, lit = clamp(.3 - nx - ny); if (dd < 3 && lit * (1 - dd / 3) > bayer(X, y) * .8 + .1) set(X, y, [232, 160, 140]); }
          continue;
        }
        const nz = Math.sqrt(1 - rr), lum = clamp(nx * Lv[0] + ny * Lv[1] + nz * Lv[2]);
        const sy = ny * ct + nz * st, sz = -ny * st + nz * ct, lo = Math.atan2(nx, sz) + 2.1, la = Math.asin(clamp(sy, -1, 1));
        const u = (((lo / TAU) % 1 + 1) % 1 * TW) | 0, v = Math.min(TH - 1, ((la / Math.PI + .5) * TH) | 0), o = (v * TW + u) * 3;
        let col = [tex[o], tex[o + 1], tex[o + 2]];
        if (mars) col = mix(col, [240, 180, 150], clamp((1 - nz) * 2 - 1.2) * .5 * lum);
        const q = lum * 4, base = Math.floor(q), band = clamp((base + (q - base > bayer(X, y) ? 1 : 0)) / 4, 0.05, 1.1);
        set(X, y, [col[0] * band, col[1] * band, col[2] * band]);
      }
    });
    planets.set(k, c);
    return c;
  }

  // ---------- debris: cratered rocks, three shades and more, lit from the top left, in 12 tumble frames
  const ROCK = ['#24201e', '#3a3532', '#565049', '#776e64', '#9a8f80', '#c2b6a2'].map(hex);
  const rockBase = new Map(), rockFrames = new Map();
  function rockShape(b, v) {
    const k = b * 4 + v; let s = rockBase.get(k);
    if (s) return s;
    const r = noise(1000 + k * 17), R0 = b * 4;   // b is the q radius x 2, so R0 is the radius in art pixels
    const harm = [[2, .09 + r() * .07], [3, .05 + r() * .05], [4, .03 + r() * .03], [6, .015 + r() * .02]].map(([n, a]) => [n, a, r() * TAU]);
    const craters = Array.from({ length: 2 + ((r() * 3) | 0) + (b > 9 ? 1 : 0) }, () => { const a = r() * TAU, d = Math.sqrt(r()) * .6; return [Math.cos(a) * d, Math.sin(a) * d, .13 + r() * .16]; });
    const N = Math.ceil(R0 * 1.25) * 2 + 2, bump = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let X = 0; X < N; X++) bump[y * N + X] = fbm2(X / 8 + v * 5 + b, y / 8, 64, 3) - .5;
    s = { R0, harm, craters, N, bump }; rockBase.set(k, s);
    return s;
  }
  // r draws the same rock at another radius (art pixels), for debris seen far off; it is drawn at that size, not
  // scaled, so its pixels stay square
  function rockFrame(b, v, f, r = b * 4) {
    const key = ((b * 4 + v) * 16 + f) * 256 + r; let c = rockFrames.get(key);
    if (c) return c;
    const { R0, harm, craters, N, bump } = rockShape(b, v), rot = f / 12 * TAU, cr = Math.cos(rot), sr = Math.sin(rot), h = N / 2, k = R0 / r;
    const M = Math.ceil(r * 1.25) * 2 + 2, hm = M / 2;
    c = outlined(paint(M, M, (set) => {
      for (let y = 0; y < M; y++) for (let X = 0; X < M; X++) {
        const dx = X + .5 - hm, dy = y + .5 - hm, lx = dx * cr + dy * sr, ly = -dx * sr + dy * cr, a = Math.atan2(ly, lx);
        let rad = 1; for (const [n, A, p] of harm) rad += A * Math.cos(n * a + p);
        rad *= r;
        const dist = Math.hypot(dx, dy);
        if (dist > rad) continue;
        const nx = dx / rad, ny = dy / rad, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        let lum = -.62 * nx - .62 * ny + .5 * nz + bump[Math.min(N - 1, Math.max(0, Math.round(ly * k + h))) * N + Math.min(N - 1, Math.max(0, Math.round(lx * k + h)))] * .75;
        for (const [ccx, ccy, crr] of craters) {
          const qx = lx / r - ccx, qy = ly / r - ccy, q = Math.hypot(qx, qy) / crr;
          if (q > 1.3) continue;
          const wx = qx * cr - qy * sr, wy = qx * sr + qy * cr, dl = -(wx + wy) * .707 / (Math.hypot(wx, wy) || 1);
          if (q < 1) lum += dl * .6 * q - .15; else lum -= dl * .35 * (1.3 - q) / .3;
        }
        if (dist > rad - 1.5) lum -= .18;
        set(X, y, ROCK[clamp(Math.floor(lum * 3 + 2.6 + bayer(X, y) - .5), 0, 5)]);
      }
    }));
    rockFrames.set(key, c);
    return c;
  }
  // build the rock frames a few milliseconds at a time before the first debris arrives
  let rockQueue = null;
  function warmRocks(ms) {
    if (!rockQueue) { rockQueue = []; for (let b = 6; b <= 12; b++) for (let v = 0; v < 2; v++) for (let f = 0; f < 12; f++) rockQueue.push([b, v, f]); }
    const end = performance.now() + ms;
    while (rockQueue.length && performance.now() < end) rockFrame(...rockQueue.shift());
  }

  // ---------- the ship: the title film's white and orange rocket, nose up, with the parts the player mounted
  const SW = 156, SH = 130, CX = 78, BL = CX - 18, BR = CX + 18;
  function solarPanel(x, X0, Y0, w, h, rusty, left) {
    R(x, X0, Y0, w, h, rusty ? '#6a4028' : '#4a5262');
    for (let Y = 1; Y < h - 1; Y++) for (let X = 1; X < w - 1; X++) {
      const grid = (X - 1) % 5 === 4 || (Y - 1) % 5 === 4, sheen = ((X + Y + (left ? 0 : 7)) % 19) < 3;
      R(x, X0 + X, Y0 + Y, 1, 1, grid ? '#2f4a9a' : sheen ? '#3a5ab8' : Y < 3 ? '#26387e' : '#1d2a5a');
    }
    R(x, X0, Y0, w, 1, rusty ? '#b07a4a' : '#8ab4e8'); R(x, X0, Y0, 1, h, rusty ? '#8a5a3a' : '#6a8ad0'); R(x, X0, Y0 + h - 1, w, 1, rusty ? '#4a2a18' : '#2a3040');
    if (rusty) { line(x, X0 + 2, Y0 + h - 3, X0 + w - 3, Y0 + 2, '#c8c4b0', 2); line(x, X0 + 6, Y0 + 3, X0 + 9, Y0 + 9, '#0a0f1c'); }
  }
  function powerPart(x, id, info) {
    if (id === 'rtg') {
      // a finned generator on a boom, its fin tips warm
      R(x, BR, 58, 9, 3, '#5a6272'); R(x, BR, 58, 9, 1, '#9aa2b2');
      const X0 = BR + 9;
      for (let y = 49; y < 84; y += 4) { R(x, X0 - 6, y, 20, 2, '#4a5262'); R(x, X0 - 6, y, 20, 1, '#7a8292'); R(x, X0 - 6, y, 1, 2, '#9aa2b2'); R(x, X0 + 12, y, 2, 2, '#ff7a3c'); R(x, X0 + 13, y, 1, 1, '#ffc080'); }
      for (let y = 46; y < 87; y++) bands(x, X0, y, 8, ['#2a3040', '#3a4252', '#4a5262', '#6a7282']);
      R(x, X0 - 1, 45, 10, 2, '#7a8292'); R(x, X0 - 1, 86, 10, 2, '#3a4252');
      R(x, X0 + 1, 60, 6, 6, '#e8c547'); R(x, X0 + 3, 61, 2, 2, '#1a1a1a'); R(x, X0 + 2, 63, 1, 2, '#1a1a1a'); R(x, X0 + 5, 63, 1, 2, '#1a1a1a');
      R(x, X0, 80, 8, 2, '#5a96f5');
      info.rtg = [X0 + 13, 66];
      return;
    }
    const p = HS.PARTS[id];
    if (!p || !p.solar) return;
    // solar wings either side; the large array is two hinged panels a side
    const big = id === 'solar_l', rusty = id === 'sal_power', h = big ? 18 : 16, y0 = big ? 63 : 64;
    R(x, BL - 3, 70, 3, 3, '#5a6272'); R(x, BR, 70, 3, 3, '#5a6272'); R(x, BL - 3, 70, 3, 1, '#9aa2b2'); R(x, BR, 70, 3, 1, '#9aa2b2');
    for (const [o, w] of big ? [[3, 18], [23, 18]] : [[3, 20]]) { solarPanel(x, BL - o - w, y0, w, h, rusty, true); solarPanel(x, BR + o, y0, w, h, rusty, false); }
    if (big) { R(x, BL - 23, 70, 2, 3, '#8a92a2'); R(x, BR + 21, 70, 2, 3, '#8a92a2'); }
    const span = big ? 41 : 23;
    info.lights = [[BL - span, y0 + (h >> 1) - 1, 'red'], [BR + span - 2, y0 + (h >> 1) - 1, 'green']];
  }
  function commsPart(x, id) {
    if (id === 'dish') {
      // a dish on a boom, its face turned up and out, a feed horn on struts
      R(x, BL - 8, 45, 8, 3, '#5a6272'); R(x, BL - 8, 45, 8, 1, '#9aa2b2');
      const ex = BL - 13, ey = 46;
      for (let y = -13; y <= 13; y++) { const k = y / 13.5, w = Math.sqrt(1 - k * k), a = Math.round(4 * w), b = Math.round(6 * w); R(x, ex - a, ey + y, a + b + 1, 1, y < -4 ? '#9aa2b2' : y < 5 ? '#7a8292' : '#5a6272'); }
      for (let y = -12; y <= 12; y++) { const k = y / 12.5, hw = Math.round(4 * Math.sqrt(1 - k * k)); for (let X = -hw; X <= hw; X++) { const l = -X * .12 - y * .07; R(x, ex - 2 + X, ey + y, 1, 1, l > .5 ? '#ffffff' : l > -.15 ? '#e8ecf2' : l > -.55 ? '#c8ccd4' : '#aab2c0'); } }
      R(x, ex - 3, ey - 6, 2, 12, '#d0d6de');
      line(x, ex - 3, ey - 11, ex - 15, ey - 1, '#9aa2b2'); line(x, ex - 3, ey + 11, ex - 15, ey + 1, '#6a7282');
      R(x, ex - 18, ey - 2, 4, 4, '#c8ccd4'); R(x, ex - 18, ey - 2, 4, 1, '#ffffff'); R(x, ex - 20, ey - 1, 2, 2, '#ff5a50');
    } else if (id === 'lga') {
      // a short mast with a gold helix and a white horn
      R(x, BL - 7, 49, 7, 3, '#5a6272'); R(x, BL - 7, 49, 7, 1, '#9aa2b2');
      R(x, BL - 8, 20, 2, 31, '#8a92a2'); R(x, BL - 8, 20, 1, 31, '#c8ccd4');
      for (let y = 24; y < 47; y += 3) { R(x, BL - 11, y, 8, 1, '#c8a46e'); R(x, BL - 11, y, 2, 1, '#f0d29a'); R(x, BL - 5, y + 1, 2, 1, '#8a6a3a'); }
      for (let y = 11; y < 20; y++) { const hw = 1 + Math.round((y - 11) * .55); R(x, BL - 7 - hw, y, hw * 2, 1, '#e8ecf2'); R(x, BL - 7 + hw - 1, y, 1, 1, '#aab2c0'); R(x, BL - 7 - hw, y, 1, 1, '#ffffff'); }
      R(x, BL - 8, 9, 2, 2, '#ff5a50');
    } else if (id === 'laser') {
      // a white telescope on a gimbal, its red lens pointing up and out
      R(x, BL - 7, 50, 7, 3, '#5a6272'); R(x, BL - 7, 50, 7, 1, '#9aa2b2');
      R(x, BL - 12, 45, 6, 10, '#4a5262'); R(x, BL - 12, 45, 6, 1, '#8a92a2'); R(x, BL - 12, 45, 1, 10, '#6a7282');
      for (let i = 0; i < 16; i++) { const cx = Math.round(BL - 10 - i * .7), cy = 47 - i; disc(x, cx + 1, cy + 1, 3, '#9aa2b2'); }
      for (let i = 0; i < 16; i++) { const cx = Math.round(BL - 10 - i * .7), cy = 47 - i; disc(x, cx, cy, 3, i < 3 ? '#8a92a2' : '#e8ecf2'); R(x, cx - 2, cy - 1, 1, 1, '#ffffff'); }
      R(x, BL - 16, 38, 7, 2, '#c8ccd4');
      disc(x, BL - 21, 31, 4, '#4a1414'); disc(x, BL - 21, 31, 3, '#ff5a50'); R(x, BL - 23, 29, 2, 1, '#ffd0c8');
    } else if (id === 'sal_comms') {
      // a bent wire antenna taped to a rusty box
      R(x, BL - 8, 47, 8, 7, '#8a5a3a'); R(x, BL - 8, 47, 8, 1, '#b07a4a'); R(x, BL - 9, 50, 7, 2, '#c8c4b0');
      const pts = [[BL - 5, 47], [BL - 10, 40], [BL - 6, 33], [BL - 12, 26], [BL - 9, 19]];
      for (let i = 1; i < pts.length; i++) { line(x, pts[i - 1][0] + 1, pts[i - 1][1], pts[i][0] + 1, pts[i][1], '#6a7282'); line(x, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], '#c8ccd4'); }
      R(x, BL - 10, 17, 2, 2, '#ff5a50');
    }
  }
  function payloadPart(x, id) {
    const X0 = CX + 17;
    if (!id) return;
    R(x, CX + 12, 35, 6, 2, '#5a6272');
    if (id === 'camera') {
      for (let y = 31; y < 39; y++) bands(x, X0, y, 10, STEEL);
      R(x, X0, 38, 10, 1, '#e6b946'); R(x, X0 + 2, 29, 4, 2, '#4a5262');
      disc(x, X0 + 12, 34, 3, '#4a5262'); disc(x, X0 + 12, 34, 2, '#2f5fc8'); R(x, X0 + 11, 33, 1, 1, '#a8c8ff');
    } else if (id === 'spectro') {
      for (let y = 30; y < 39; y++) bands(x, X0, y, 11, HULL);
      R(x, X0 + 2, 32, 7, 4, '#1a2030');
      ['#ff5a50', '#ffb43c', '#ffd23c', '#6edc82', '#46d2e6', '#4a7ad8', '#a078ff'].forEach((c, i) => R(x, X0 + 2 + i, 33, 1, 2, c));
      R(x, X0 + 3, 26, 5, 4, '#e8ecf2'); R(x, X0 + 7, 27, 2, 2, '#2f5fc8'); R(x, X0, 38, 11, 1, '#e6b946');
    } else if (id === 'radar') {
      for (let y = 32; y < 40; y++) bands(x, X0, y, 7, STEEL);
      R(x, X0, 39, 7, 1, '#e6b946');
      line(x, X0 + 7, 34, X0 + 35, 15, '#6a7282'); line(x, X0 + 6, 33, X0 + 34, 14, '#c8ccd4'); R(x, X0 + 34, 13, 2, 2, '#ff5a50');
      line(x, X0 + 7, 37, X0 + 27, 43, '#c8ccd4'); R(x, X0 + 27, 42, 2, 2, '#ff5a50');
    } else {
      R(x, X0, 31, 10, 9, '#8a5a3a'); R(x, X0, 31, 10, 1, '#b07a4a'); R(x, X0 + 7, 31, 3, 9, '#6a4028');
      disc(x, X0 + 4, 35, 2, '#3a5a88'); R(x, X0 + 3, 34, 1, 1, '#c8d8f0'); R(x, X0 + 6, 30, 3, 6, '#c8c4b0');
    }
  }
  function fins(x) {
    for (let y = 78; y < 117; y++) {
      const o = Math.min(14, Math.round((y - 78) * 14 / 30)), i = y < 106 ? 0 : Math.round((y - 106) * 1.25);
      if (o <= i) continue;
      R(x, BL - o, y, o - i, 1, '#c84a2a'); R(x, BL - o, y, 1, 1, '#ec7a50');
      R(x, BR + i, y, o - i, 1, '#8a2e18'); R(x, BR + o - 1, y, 1, 1, '#5e1e10');
      if (!i) { R(x, BL - 1, y, 1, 1, '#9a3a1e'); R(x, BR, y, 1, 1, '#6a2412'); }
    }
  }
  function engine(x, id, info) {
    // no engine mounted yet (only the build screen's blueprint asks for this)
    if (!id) { Object.assign(info, { kind: 'none', exitY: 112, exitHW: 10 }); return; }
    if (id === 'ion') {
      // no bell: a wide gridded thruster face that glows blue
      for (let y = 112; y < 121; y++) bands(x, CX - 15, y, 30, STEEL);
      R(x, CX - 15, 112, 30, 1, '#9aa2b2'); R(x, CX - 15, 116, 30, 1, '#f08c32');
      R(x, CX - 14, 121, 28, 3, '#1a3a5a');
      for (let X = CX - 13; X < CX + 13; X += 2) R(x, X, 122, 1, 1, '#3ab4e6');
      R(x, CX - 12, 123, 24, 1, '#9ae8ff');
      Object.assign(info, { kind: 'ion', exitY: 124, exitHW: 13 });
    } else if (id === 'solid') {
      // a segmented booster casing on a squat graphite nozzle
      for (const sy of [70, 97]) { R(x, BL, sy, 36, 2, '#8a92a2'); R(x, BL, sy + 2, 36, 1, '#ffffff'); }
      for (let y = 112; y < 124; y++) { const hw = y < 115 ? 8 : Math.round(8 + (y - 115) * .62); bands(x, CX - hw, y, hw * 2, GRAPH); }
      R(x, CX - 14, 123, 28, 1, '#0e1014');
      Object.assign(info, { kind: 'solid', exitY: 124, exitHW: 13 });
    } else if (id === 'sal_prop') {
      // a rusty, dented, taped bell
      for (let y = 112; y < 126; y++) { const hw = Math.round(6 + (y - 112) * .5) + (y > 119 && y < 123 ? 1 : 0); bands(x, CX - hw + (y > 118 ? 1 : 0), y, hw * 2, RUSTP); }
      R(x, CX - 9, 116, 18, 2, '#c8c4b0'); R(x, CX - 9, 116, 18, 1, '#e8e4d0');
      Object.assign(info, { kind: 'sal', exitY: 126, exitHW: 12 });
    } else {
      // a turbopump over a long copper bell with cooling rings
      for (let y = 112; y < 115; y++) bands(x, CX - 6, y, 12, DARK);
      R(x, CX - 9, 112, 3, 3, '#d86a2a'); R(x, CX + 6, 112, 3, 3, '#4a7ad8');
      for (let y = 115; y < 129; y++) { const hw = Math.round(6 + (y - 115) * .56); bands(x, CX - hw, y, hw * 2, (y - 115) % 4 === 3 ? COPPER_D : COPPER); }
      R(x, CX - 13, 128, 26, 1, '#4a2810');
      Object.assign(info, { kind: 'chem', exitY: 129, exitHW: 13 });
    }
  }
  function buildShip(ids) {
    const info = { kind: 'chem', exitY: 129, exitHW: 13, lights: [], rtg: null };
    const c = sprite(SW, SH, (x) => {
      powerPart(x, ids.power, info); commsPart(x, ids.comms); payloadPart(x, ids.payload);
      fins(x);
      // nose cone, white on the lit side, grey on the far side
      for (let y = 6; y < 38; y++) { const hw = Math.max(1, Math.round(18 * Math.pow((y - 5) / 32, .8))); bands(x, CX - hw, y, hw * 2, HULL); }
      R(x, CX - 1, 0, 2, 7, '#c8ccd4'); R(x, CX - 1, 0, 1, 7, '#eef1f5');
      // joint ring and the four slot colours, as on the pad
      R(x, BL, 38, 36, 2, '#5a6272');
      ['#f08c32', '#5a96f5', '#e6ebf0', '#e6b946'].forEach((col, i) => R(x, BL + i * 9, 40, 9, 3, col));
      R(x, BL + 31, 40, 5, 3, 'rgba(10,15,28,.3)'); R(x, BL, 40, 36, 1, 'rgba(255,255,255,.3)');
      // the hull: bands, seams, rivets
      for (let y = 43; y < 104; y++) bands(x, BL, y, 36, HULL);
      for (const sy of [60, 81]) { R(x, BL, sy, 36, 1, '#5a6272'); R(x, BL, sy + 1, 36, 1, '#f4f6fa'); R(x, BL + 30, sy + 1, 6, 1, '#aab2c0'); }
      for (let y = 46; y < 102; y += 7) { R(x, BL + 2, y, 1, 1, '#aab2c0'); R(x, BR - 3, y, 1, 1, '#6a7282'); }
      // the cockpit window, like the pad rocket's
      R(x, CX - 12, 46, 9, 13, '#1a2030'); R(x, CX - 11, 47, 7, 6, '#2f5fc8'); R(x, CX - 11, 47, 2, 2, '#a8c8ff'); R(x, CX - 6, 51, 2, 2, '#1e3a8a'); R(x, CX - 11, 55, 7, 1, '#2a3446');
      // the crew hatch on the shaded side
      R(x, CX + 3, 64, 11, 1, '#8a92a2'); R(x, CX + 3, 64, 1, 14, '#8a92a2'); R(x, CX + 4, 77, 10, 1, '#ffffff'); R(x, CX + 13, 65, 1, 13, '#c8ccd4'); R(x, CX + 7, 70, 4, 2, '#5a6272');
      for (let y = 88; y < 94; y++) bands(x, BL, y, 36, ORANGE);
      // attitude thrusters either side
      for (const X of [BL - 3, BR]) { R(x, X, 55, 3, 6, '#5a606c'); R(x, X, 55, 3, 1, '#8a909c'); R(x, X, 60, 3, 1, '#2a2e36'); }
      // the aft skirt, then the engine
      for (let y = 104; y < 112; y++) { const hw = Math.round(18 - (y - 104) * .75); bands(x, CX - hw, y, hw * 2, DARK); }
      R(x, BL, 104, 36, 1, '#3e444f');
      engine(x, ids.prop, info);
    }, OUT);
    return Object.assign(info, { c });
  }

  // the margins round a station (js/art.js): the static backdrop mirrored out, so no debris or readouts are
  // copied. The pilot's cockpit (js/cockpit-art.js) is built for the whole stage, so it needs none.
  FA.bleed = (x, kind) => {
    if (kind === 'pilot' || (!HS.AOX && !HS.AOY)) return;
    HS.bleedFrom(cabin(kind));
  };

  // the same ship for the build screen's blueprint, cached per part set; ids may be '' for an empty slot
  const shipCache = new Map();
  FA.ship = (ids) => {
    ids = HS.lookSlots(ids);   // new parts borrow an existing part's art (S4-12)
    const k = [ids.prop, ids.power, ids.comms, ids.payload].join('|');
    let s = shipCache.get(k);
    if (!s) { s = buildShip(ids); shipCache.set(k, s); }
    return s;
  };
  FA.SHIP_GEOM = { SW, SH, CX, BL, BR };

  // the pieces js/cockpit-art.js draws the pilot's view with
  FA.kit = { paint, outlined, disc, line, glow, rivet, background, earthCap, planetSprite, rockFrame, warmRocks };

  // =====================================================================
  // CABIN: the wall, the monitors and each station's machines
  // =====================================================================
  const MON = { eng: [[32, 64, 592, 640], [656, 64, 608, 640]], sci: [[32, 64, 592, 640], [656, 64, 608, 640]], comms: [[32, 64, 1216, 640]] };
  const TINT = { eng: '240,210,70', comms: '70,210,230', sci: '225,85,185' };
  function wall(x, kind) {
    R(x, 0, 0, 1280, 720, '#2a323e');
    for (let Y = -40; Y < 720; Y += 240) for (let X = 0; X < 1280; X += 160) {
      R(x, X, Y, 160, 240, '#2c3440'); R(x, X + 1, Y + 1, 158, 2, '#3c4654'); R(x, X + 1, Y + 1, 2, 238, '#38424e');
      R(x, X + 1, Y + 237, 158, 2, '#1f252d'); R(x, X + 157, Y + 1, 2, 238, '#232a33'); R(x, X, Y, 160, 1, '#14181e'); R(x, X, Y, 1, 240, '#14181e');
      for (let k = 10; k < 156; k += 24) { rivet(x, X + k, Y + 6); rivet(x, X + k, Y + 230); }
      for (let k = 34; k < 220; k += 40) { rivet(x, X + 6, Y + k); rivet(x, X + 151, Y + k); }
    }
    const r = noise(5);
    for (let i = 0; i < 5000; i++) R(x, (r() * 1280) | 0, (r() * 720) | 0, 1, 1, r() < .5 ? '#323a47' : '#262d38');
    // the ceiling rail and its cable runs
    R(x, 0, 0, 1280, 5, '#161b22'); R(x, 0, 5, 1280, 8, '#4a5462'); R(x, 0, 5, 1280, 1, '#6e7888'); R(x, 0, 12, 1280, 1, '#232a33');
    for (let X = 12; X < 1280; X += 40) R(x, X, 8, 2, 2, '#2a323e');
    [['#b8602a', '#e8904a', '#6a3414'], ['#2a5aa8', '#4a86d8', '#163870'], ['#2a2e36', '#4a5060', '#121418']].forEach(([b, hi, lo], i) => {
      for (let X = 0; X < 1280; X++) { const y = 18 + i * 9 + Math.round(6 * Math.sin(Math.PI * (X % 160) / 160)); R(x, X, y, 1, 1, hi); R(x, X, y + 1, 1, 2, b); R(x, X, y + 3, 1, 1, lo); }
    });
    for (let X = 0; X < 1280; X += 160) { R(x, X - 4, 13, 8, 38, '#6a7282'); R(x, X - 4, 13, 2, 38, '#8a94a4'); R(x, X + 2, 13, 2, 38, '#3a4252'); R(x, X - 1, 44, 2, 2, '#2a323e'); }
    // conduit pipes down both sides
    for (const X of [8, 1262]) { for (let y = 52; y < 712; y++) bands(x, X, y, 10, GUN); for (let y = 90; y < 712; y += 120) { R(x, X - 2, y, 14, 5, '#5a6272'); R(x, X - 2, y, 14, 1, '#8a94a4'); R(x, X - 2, y + 4, 14, 1, '#262c36'); } }
    // the floor edge, hazard striped
    for (let y = 712; y < 720; y++) for (let X = 0; X < 1280; X += 2) R(x, X, y, 2, 1, ((X + y) >> 3) & 1 ? '#1a1c22' : '#e6b432');
    R(x, 0, 711, 1280, 1, '#0a0d12'); R(x, 0, 712, 1280, 1, 'rgba(255,240,180,.35)');
    // the pillar between two monitors, with status lights
    if (kind !== 'comms') {
      R(x, 630, 52, 20, 668, '#232a33'); R(x, 631, 52, 2, 668, '#4a5462'); R(x, 647, 52, 2, 668, '#151a20');
      for (let y = 80; y < 700; y += 40) { R(x, 638, y, 4, 3, (y / 40) % 3 ? '#1e5a32' : '#6edc82'); R(x, 638, y, 4, 1, 'rgba(255,255,255,.25)'); }
    }
  }
  function monitor(x, X, Y, w, h, tint) {
    // light spilling onto the wall
    for (let i = 1; i <= 10; i++) { x.globalAlpha = .045 * (1 - i / 11); x.strokeStyle = `rgb(${tint})`; x.lineWidth = 1; x.strokeRect(X - 8 - i + .5, Y - 8 - i + .5, w + 16 + 2 * i - 1, h + 16 + 2 * i - 1); }
    x.globalAlpha = 1;
    const bx = X - 8, by = Y - 8, bw = w + 16, bh = h + 16;
    R(x, bx - 1, by - 1, bw + 2, bh + 2, OUT);
    R(x, bx, by, bw, bh, '#46505e'); R(x, bx, by, bw, 2, '#6c7888'); R(x, bx, by, 2, bh, '#606c7c');
    R(x, bx, by + bh - 2, bw, 2, '#2a323e'); R(x, bx + bw - 2, by, 2, bh, '#323a46');
    R(x, X - 2, Y - 2, w + 4, 2, '#1a2029'); R(x, X - 2, Y - 2, 2, h + 4, '#1a2029'); R(x, X - 2, Y + h, w + 4, 2, '#5a6676'); R(x, X + w, Y - 2, 2, h + 4, '#56606e');
    for (const [sx, sy] of [[bx + 2, by + 2], [bx + bw - 5, by + 2], [bx + 2, by + bh - 5], [bx + bw - 5, by + bh - 5]]) { R(x, sx, sy, 3, 3, '#8a94a2'); R(x, sx + 1, sy, 1, 3, '#2a323e'); }
    R(x, bx + bw - 24, by + bh - 6, 4, 2, '#6edc82'); R(x, bx + bw - 32, by + bh - 6, 4, 2, '#3a4a3a');
    for (let k = 0; k < 5; k++) R(x, bx + 40 + k * 6, by + bh - 6, 4, 1, '#2a323e');
    R(x, X, Y, w, h, '#0a121a');
    for (let i = 0; i < 14; i++) { x.globalAlpha = .05 * (1 - i / 14); x.strokeStyle = `rgb(${tint})`; x.strokeRect(X + i + .5, Y + i + .5, w - 2 * i - 1, h - 2 * i - 1); }
    x.globalAlpha = 1;
  }
  // scanlines, a glare line and a faint reflection over the glass, drawn after the station's contents
  const overlays = {};
  function overlay(kind) {
    if (overlays[kind]) return overlays[kind];
    const [c, x] = make(1280, 720);
    for (const [X, Y, w, h] of MON[kind]) {
      for (let y = Y + 1; y < Y + h; y += 3) R(x, X, y, w, 1, 'rgba(0,0,0,.16)');
      R(x, X, Y, w, 1, 'rgba(255,255,255,.07)');
      x.fillStyle = 'rgba(255,255,255,.022)'; x.beginPath(); x.moveTo(X + 30, Y); x.lineTo(X + 150, Y); x.lineTo(X, Y + 220); x.lineTo(X, Y + 70); x.fill();
      const gr = x.createRadialGradient(X + w / 2, Y + h / 2, Math.min(w, h) * .45, X + w / 2, Y + h / 2, Math.max(w, h) * .75);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.28)'); x.fillStyle = gr; x.fillRect(X, Y, w, h);
    }
    return (overlays[kind] = c);
  }
  const cabins = {};
  function cabin(kind) {
    if (cabins[kind]) return cabins[kind];
    const [c, x] = make(1280, 720);
    wall(x, kind);
    for (const [X, Y, w, h] of MON[kind]) monitor(x, X, Y, w, h, TINT[kind]);
    ({ eng: engStatic, comms: commsStatic, sci: sciStatic })[kind](x);
    return (cabins[kind] = c);
  }

  // =====================================================================
  // ENGINEER: riveted hull metal, the breach crack and the weld bead
  // =====================================================================
  const PX = 688, PY = 176, PW = 544, PH = 496, PCOL = [0, 182, 364, 544], PROW = [0, 166, 332, 496];
  function engStatic(x) {
    const r = noise(12), nW = PW / 4 + 2, nH = PH / 4 + 2, wear = new Float32Array(nW * nH);
    for (let y = 0; y < nH; y++) for (let X = 0; X < nW; X++) wear[y * nW + X] = fbm2(X / 11, y / 11, 16, 3);
    const rowN = Array.from({ length: PH }, () => r() - .5);
    const plate = paint(PW, PH, (set) => {
      for (let y = 0; y < PH; y++) {
        const j = y < 166 ? 0 : y < 332 ? 1 : 2, v = y - PROW[j], ph = PROW[j + 1] - PROW[j];
        for (let X = 0; X < PW; X++) {
          const i = X < 182 ? 0 : X < 364 ? 1 : 2, u = X - PCOL[i], pw = PCOL[i + 1] - PCOL[i];
          let k = 128 + rowN[(y + i * 37) % PH] * 7 + (((X * 7 + y * 13) % 11) - 5) * .5;
          const n = wear[(y >> 2) * nW + (X >> 2)];
          if (n > .58 && bayer(X, y) < (n - .58) * 5) k -= 15;
          if (u < 2 || v < 2) k += 30; else if (u >= pw - 2 || v >= ph - 2) k -= 34;
          if (u === 0 || v === 0) k = 46;
          set(X, y, [k * .92, k, k * 1.11]);
        }
      }
    });
    R(x, PX - 4, PY - 4, PW + 8, PH + 8, '#2a3040'); R(x, PX - 4, PY - 4, PW + 8, 1, '#4a5462'); R(x, PX - 1, PY - 1, PW + 2, PH + 2, OUT);
    x.drawImage(plate, PX, PY);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const X0 = PX + PCOL[i], Y0 = PY + PROW[j], w = PCOL[i + 1] - PCOL[i], h = PROW[j + 1] - PROW[j];
      for (let X = X0 + 8; X < X0 + w - 6; X += 14) { rivet(x, X, Y0 + 5); rivet(x, X, Y0 + h - 8); }
      for (let Y = Y0 + 19; Y < Y0 + h - 12; Y += 14) { rivet(x, X0 + 5, Y); rivet(x, X0 + w - 8, Y); }
    }
    // an access hatch, a round inspection port, a vent and hazard paint, all away from the middle
    const hx = PX + 30, hy = PY + 360, hw = 110, hh = 100;
    R(x, hx, hy, hw, 1, '#3a4252'); R(x, hx, hy, 1, hh, '#3a4252'); R(x, hx + 1, hy + hh, hw, 1, '#c8d0dc'); R(x, hx + hw, hy + 1, 1, hh, '#c8d0dc');
    R(x, hx + 40, hy + 44, 30, 6, '#4a5462'); R(x, hx + 40, hy + 44, 30, 1, '#9aa4b2'); R(x, hx + 40, hy + 49, 30, 1, '#2a3040');
    const ox = PX + 452, oy = PY + 410;
    disc(x, ox + 1, oy + 1, 28, '#c8d0dc'); disc(x, ox, oy, 28, '#4a5462'); disc(x, ox, oy, 25, '#6a7482'); disc(x, ox - 1, oy - 1, 22, '#7e8896');
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; rivet(x, Math.round(ox + Math.cos(a) * 25) - 1, Math.round(oy + Math.sin(a) * 25) - 1); }
    for (let k = 0; k < 6; k++) { R(x, PX + 420, PY + 40 + k * 10, 90, 4, '#2a3040'); R(x, PX + 420, PY + 44 + k * 10, 90, 1, '#a8b2c0'); }
    for (let y = 0; y < 44; y++) for (let X = 0; X < 44 - y; X++) R(x, PX + 14 + X, PY + 14 + y, 1, 1, ((X + y) >> 3) & 1 ? '#1a1c22' : '#d8a830');
    // scratches
    for (let k = 0; k < 40; k++) { const X = PX + 10 + ((r() * (PW - 20)) | 0), Y = PY + 10 + ((r() * (PH - 20)) | 0), l = 4 + ((r() * 10) | 0); line(x, X, Y, X + l, Y + ((r() * 4) | 0) - 2, 'rgba(210,220,232,.35)'); }
  }
  // the crack: jagged, dark, with bent lips lit from the top left; built once per breach
  let crack = null;
  function buildCrack(b) {
    const r = noise(Math.round(b.pts[1][0] * 7 + b.pts[1][1] * 13));
    const pts = b.pts.map(([X, Y]) => [X * 2 - PX, Y * 2 - PY]), jit = Array.from({ length: 80 }, () => r() - .5);
    const jn = (s) => { const i = Math.floor(s), f = s - i; return jit[i % 80] * (1 - f) + jit[(i + 1) % 80] * f; };
    const path = []; let s0 = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], l = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / l, ny = (bx - ax) / l;
      for (let k = 0; k < l; k += 2) { const s = s0 + k, j = jn(s / 12) * 7 + jn(s / 4 + 40) * 2.4; path.push({ x: ax + (bx - ax) * k / l + nx * j, y: ay + (by - ay) * k / l + ny * j, s, tw: -1 }); }
      s0 += l;
    }
    const total = s0, mask = new Uint8Array(PW * PH), scorch = new Float32Array(PW * PH);
    const stamp = (cx, cy, rad, v) => { for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let X = Math.floor(cx - rad); X <= cx + rad; X++) { if (X < 0 || y < 0 || X >= PW || y >= PH) continue; if ((X + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= rad * rad) mask[y * PW + X] = Math.max(mask[y * PW + X], v); } };
    for (const p of path) {
      const w = 1.2 + 3.4 * Math.pow(Math.sin(Math.PI * clamp(p.s / total, .02, .98)), .5) + (r() - .5) * 1.2;
      stamp(p.x, p.y, w, 2);
      const sr = w + 9;
      for (let y = Math.floor(p.y - sr); y <= p.y + sr; y++) for (let X = Math.floor(p.x - sr); X <= p.x + sr; X++) { if (X < 0 || y < 0 || X >= PW || y >= PH) continue; const d = Math.hypot(X - p.x, y - p.y); if (d < sr) scorch[y * PW + X] = Math.max(scorch[y * PW + X], 1 - d / sr); }
    }
    // hairline branches
    for (let k = 0; k < 5; k++) {
      const p = path[(r() * path.length) | 0], q = path[Math.min(path.length - 1, path.indexOf(p) + 2)];
      let a = Math.atan2(q.y - p.y, q.x - p.x) + (r() < .5 ? -1 : 1) * (.6 + r() * .6), X = p.x, Y = p.y;
      for (let n = 0, len = 10 + r() * 20; n < len; n++) { a += (r() - .5) * .5; X += Math.cos(a); Y += Math.sin(a); stamp(X, Y, n < len * .5 ? .9 : .6, 1); }
    }
    const M = (X, Y) => (X < 0 || Y < 0 || X >= PW || Y >= PH ? 0 : mask[Y * PW + X]);
    const c = paint(PW, PH, (set) => {
      for (let y = 0; y < PH; y++) for (let X = 0; X < PW; X++) {
        const m = mask[y * PW + X];
        if (m) { set(X, y, !M(X + 1, y + 1) || !M(X, y + 1) ? [52, 62, 78] : m === 2 ? [5, 7, 12] : [18, 22, 30]); continue; }
        if (M(X + 1, y + 1) || M(X + 1, y) || M(X, y + 1)) { set(X, y, [64, 72, 86]); continue; }   // the top-left lip bends away from the light
        if (M(X - 1, y - 1) || M(X - 1, y) || M(X, y - 1)) { set(X, y, [212, 220, 232]); continue; }   // the far lip catches it
        const sc = scorch[y * PW + X];
        if (sc > 0 && bayer(X, y) < sc * .8) set(X, y, [40, 46, 58], 110);
      }
    });
    return { b, c, x: c.getContext('2d'), path, total, wi: 0, baked: 0, vap: [] };
  }
  const BEAD = ['#9aa2b0', '#d8dee6', '#5a6272'];
  function beadAt(x, X, Y, i, heat) {
    if (heat <= 0) { R(x, X - 4, Y - 3, 9, 7, BEAD[2]); R(x, X - 4, Y - 3, 8, 6, BEAD[0]); if (i % 3 === 0) { R(x, X - 3, Y - 3, 4, 1, BEAD[1]); R(x, X - 4, Y - 2, 1, 2, BEAD[1]); } return; }
    const col = heat > .85 ? '#fffbe8' : heat > .62 ? '#ffe08a' : heat > .38 ? '#ffb04a' : heat > .16 ? '#e8682a' : '#9a4a2e';
    R(x, X - 4, Y - 3, 9, 7, heat > .38 ? '#c8502a' : '#5a3a30'); R(x, X - 4, Y - 3, 8, 6, col);
    if (i % 3 === 0) R(x, X - 3, Y - 3, 4, 1, heat > .5 ? '#ffffff' : '#ffd0a0');
  }
  FA.eng = (x, F) => {
    x.drawImage(cabin('eng'), 0, 0);
    const b = F.breach, cm = calm();
    if (b) {
      if (!crack || crack.b !== b) crack = buildCrack(b);
      const cr = crack, wd = b.prog * cr.total * 2;   // breach lengths are 640-space; the path is in art pixels
      while (cr.wi < cr.path.length && cr.path[cr.wi].s <= wd) cr.path[cr.wi++].tw = b.t;
      // cooled bead is stamped into the crack canvas once, so per-frame work stays small
      while (cr.baked < cr.wi && b.t - cr.path[cr.baked].tw > 1.6) { const p = cr.path[cr.baked]; beadAt(cr.x, Math.round(p.x), Math.round(p.y), cr.baked, 0); cr.baked++; }
      x.drawImage(cr.c, PX, PY);
      let head = null;
      for (let i = cr.baked; i < cr.wi; i++) { const p = cr.path[i], heat = clamp(1 - (b.t - p.tw) / 1.6); beadAt(x, PX + Math.round(p.x), PY + Math.round(p.y), i, heat); head = [p, heat]; }
      if (head && head[1] > .3) glow(x, PX + head[0].x, PY + head[0].y, 26, '255,170,80', head[1] * .7);
      // cabin air streams into the open crack, dragging frost along
      if (!cm && cr.wi < cr.path.length) {
        if (cr.vap.length < 26 && Math.random() < .7) { const p = cr.path[cr.wi + ((Math.random() * (cr.path.length - cr.wi)) | 0)], a = Math.random() * TAU, d = 16 + Math.random() * 20; cr.vap.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, tx: p.x, ty: p.y, k: 0 }); }
        for (let i = cr.vap.length - 1; i >= 0; i--) {
          const v = cr.vap[i]; v.k += .045;
          if (v.k >= 1) { cr.vap.splice(i, 1); continue; }
          x.globalAlpha = Math.sin(v.k * Math.PI) * .8;
          R(x, PX + Math.round(v.x + (v.tx - v.x) * v.k * v.k), PY + Math.round(v.y + (v.ty - v.y) * v.k * v.k), 2, 2, '#e8f4ff');
        }
        x.globalAlpha = 1;
      }
    }
    x.drawImage(overlay('eng'), 0, 0);
  };

  // =====================================================================
  // COMMS: the hull camera on the dish, Earth, the beam
  // =====================================================================
  const DX = 768, DY = 624, EX = 288, EY = 224;
  const TWINK = (() => { const r = noise(78); return Array.from({ length: 70 }, () => ({ x: 40 + ((r() * 1200) | 0), y: 72 + ((r() * 590) | 0), big: r() < .2 })); })();
  function commsStatic(x) {
    const X0 = 32, Y0 = 64, W = 1216, H = 640;
    const sky = paint(W / 2, H / 2, (set, w, h) => {
      for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) {
        const b = bayer(X, y), k = y / h;
        let c = mix([5, 8, 16], [10, 16, 32], Math.floor(k * 5 + b) / 5);
        const n = fbm2(X / 60, y / 60, 16, 4), dl = (y / h) - (.9 - (X / w) * .7), gal = Math.exp(-dl * dl / .03) * clamp((n - .35) * 2.2);
        if (gal * 2.6 + b - .3 > 1) c = gal > .55 ? [30, 34, 62] : [18, 24, 46];
        set(X, y, c);
      }
    });
    x.drawImage(sky, X0, Y0, W, H);
    const r = noise(77);
    for (let i = 0; i < 360; i++) { const v = 60 + r() * 120 | 0; R(x, X0 + ((r() * W) | 0), Y0 + ((r() * (H - 40)) | 0), 1, 1, `rgb(${v},${v},${Math.min(255, v + 25)})`); }
    // Earth, lit from the top left, with its thin blue air
    const e = L.earthSphere(40);
    for (let y = -45; y <= 45; y++) for (let X = -45; X <= 45; X++) { const d = Math.hypot(X, y) - 40.5; if (d > 0 && d < 4 && (1 - d / 4) * clamp(.5 - (X + y) / 80) > bayer(X, y) * .7) R(x, EX + X, EY + y, 1, 1, d < 1.5 ? '#8ad0ff' : '#3a78c8'); }
    x.drawImage(e, EX - 41, EY - 41);
    // our own hull along the bottom of the picture, white with the orange band, curving away at the edges
    for (let X = X0; X < X0 + W; X++) {
      const top = 674 + Math.round(((X - 640) / 610) ** 2 * 12);
      for (let y = top; y < Y0 + H; y++) { const d = y - top; R(x, X, y, 1, 1, d === 0 ? '#ffffff' : d < 12 ? '#dfe3ea' : d < 15 ? '#f08c32' : '#aab2c0'); }
      if ((X - 40) % 128 === 0) { R(x, X, top + 1, 1, Y0 + H - top, '#8a92a2'); R(x, X + 1, top + 1, 1, Y0 + H - top, '#ffffff'); }
      if ((X - 48) % 16 === 0) R(x, X, top + 4, 1, 1, '#8a92a2');
    }
    // the dish mount: a flanged base, a mast and a ball joint
    R(x, 734, 670, 68, 8, '#3a4252'); R(x, 734, 670, 68, 1, '#8a92a2'); R(x, 733, 669, 70, 1, OUT); for (let X = 740; X < 800; X += 12) R(x, X, 673, 3, 2, '#9aa2b2');
    for (let y = 628; y < 670; y++) bands(x, 761, y, 14, STEEL);
    R(x, 760, 640, 16, 3, '#2a3040'); R(x, 760, 655, 16, 3, '#2a3040');
    disc(x, DX + 1, DY + 1, 10, OUT); disc(x, DX, DY, 9, '#4a5262'); disc(x, DX - 2, DY - 2, 5, '#7a8292'); R(x, DX - 4, DY - 5, 2, 2, '#c8ccd4');
  }
  // the dish, side on, built from 1 x 1 pixels for each 2 degree turn so the light stays top left
  const dishes = new Map();
  function dishFrame(act) {
    const idx = Math.round(act / (TAU / 180)); let c = dishes.get(idx);
    if (c) return c;
    const a = idx * TAU / 180, ca = Math.cos(a), sa = Math.sin(a), S = 128, h = S / 2;
    const lumOf = (nu, nv) => { const wx = nu * ca - nv * sa, wy = nu * sa + nv * ca; return -(wx + wy) * .707; };
    c = outlined(paint(S, S, (set) => {
      for (let y = 0; y < S; y++) for (let X = 0; X < S; X++) {
        const dx = X + .5 - h, dy = y + .5 - h, u = dx * ca + dy * sa, v = -dx * sa + dy * ca, av = Math.abs(v);
        let col = null;
        // feed horn and its tip
        if (u >= 44 && u <= 56 && av <= 2 + (u - 44) * .28) col = u > 53.5 ? '#ff7a3c' : lumOf(0, -Math.sign(v) || 1) > 0 ? '#e8ecf2' : '#9aa2b2';
        // the boom and three struts to the rim
        else if (u > 4 && u < 46 && av < 1.2) col = '#8a92a2';
        else {
          for (const sg of [-1, 1]) {
            const ax = 27, ay = sg * 46, bx = 47, by = sg * 2, px = u - ax, py = v - ay, ex = bx - ax, ey = by - ay, k = clamp((px * ex + py * ey) / (ex * ex + ey * ey));
            if (Math.hypot(px - ex * k, py - ey * k) < 1.1) col = lumOf(0, -sg) > 0 ? '#c8ccd4' : '#7a8292';
          }
        }
        if (!col && av <= 50) {
          const ub = 2 + 20 * (v / 50) ** 2, uf = ub + 6;
          if (u >= ub && u <= uf) {
            const sl = -40 * v / 2500, nl = Math.hypot(1, sl), nu = 1 / nl, nv = sl / nl;
            if (u > uf - 2.2) { const l = lumOf(nu, nv); col = l > .55 ? '#ffffff' : l > .1 ? '#e8ecf2' : l > -.35 ? '#c8ccd4' : '#9aa2b2'; }
            else { const l = lumOf(-nu, -nv) - ((Math.round(av) % 12) < 1 ? .35 : 0); col = l > .4 ? '#aab2c0' : l > -.1 ? '#8a92a2' : l > -.5 ? '#6a7282' : '#4a5262'; }
          }
        }
        // the hub that sits on the joint
        if (!col && u >= -6 && u < 3 && av <= 7) col = lumOf(-1, 0) + (v < 0 ? .3 : -.3) > 0 ? '#8a92a2' : '#5a6272';
        if (col) set(X, y, hex(col));
      }
    }));
    dishes.set(idx, c);
    return c;
  }
  // the beam dots: sand where the beam must be, the beam's own colour where it is
  const dots = new Map();
  function dot(col) {
    let c = dots.get(col);
    if (!c) { const base = hex(col), hi = css(mix(base, [255, 255, 255], .55)), lo = css(base.map((v) => v * .6)); c = sprite(4, 4, (x) => { R(x, 0, 0, 4, 4, col); R(x, 0, 0, 2, 1, hi); R(x, 0, 1, 1, 1, hi); R(x, 3, 1, 1, 3, lo); R(x, 1, 3, 3, 1, lo); }, OUT); dots.set(col, c); }
    return c;
  }
  let PIN = null;
  FA.comms = (x, F, o) => {
    const t = F.t, cm = calm();
    x.drawImage(cabin('comms'), 0, 0);
    TWINK.forEach((s, i) => { if (cm || (i + Math.floor(t * 2)) % 9) { R(x, s.x, s.y, 1, 1, s.big ? '#a8b4c8' : '#5a6478'); if (s.big) { R(x, s.x - 1, s.y, 3, 1, '#5a6478'); R(x, s.x, s.y - 1, 1, 3, '#5a6478'); R(x, s.x, s.y, 1, 1, '#e8f0ff'); } } });
    const sand = dot('#c8a46e'), own = dot(o.bc);
    for (const sg of [-1, 1]) { const a = o.tgt + sg * o.half; for (let k = 8; k < 66; k += 5) x.drawImage(sand, Math.round(DX + Math.cos(a) * k * 8) - 3, Math.round(DY + Math.sin(a) * k * 8) - 3); }
    for (const sg of [-1, 1]) { const a = o.act + sg * o.half; for (let k = 6; k < 72; k += 3) x.drawImage(own, Math.round(DX + Math.cos(a) * k * 8) - 3, Math.round(DY + Math.sin(a) * k * 8) - 3); }
    if (o.on && o.link > 60) {
      // a data packet riding the beam out to Earth
      const k = (t * 40) % 66, X = DX + Math.cos(o.act) * k * 8, Y = DY + Math.sin(o.act) * k * 8;
      glow(x, X, Y, 16, o.link >= 95 ? '120,255,220' : '255,210,120', .7);
      for (let j = 1; j < 4; j++) { x.globalAlpha = .5 - j * .12; R(x, Math.round(X - Math.cos(o.act) * j * 7) - 2, Math.round(Y - Math.sin(o.act) * j * 7) - 2, 4, 4, '#ffffff'); }
      x.globalAlpha = 1;
      R(x, Math.round(X) - 4, Math.round(Y) - 4, 8, 8, OUT); R(x, Math.round(X) - 3, Math.round(Y) - 3, 6, 6, '#ffffff'); R(x, Math.round(X) + 1, Math.round(Y) + 1, 2, 2, '#c8d8e8');
    }
    const d = dishFrame(o.act);
    x.drawImage(d, DX - (d.width >> 1), DY - (d.height >> 1));
    PIN ??= sprite(6, 6, (p) => { disc(p, 2, 2, 2, '#c8ccd4'); R(p, 1, 1, 1, 1, '#ffffff'); R(p, 3, 3, 1, 1, '#5a6272'); }, OUT);
    x.drawImage(PIN, DX - 4, DY - 4);
    x.drawImage(overlay('comms'), 0, 0);
  };

  // =====================================================================
  // SCIENCE: the reactor column, pump, valve and gauge; the oxygen converter
  // =====================================================================
  const CORE = { x: 160, y: 224, w: 96, h: 368 };
  function sciStatic(x) {
    // the reactor column: a conduit to the ceiling, heavy caps with bolts, a glass tube, fins either side
    for (let y = 64; y < 190; y++) bands(x, 196, y, 24, GUN);
    for (let y = 80; y < 190; y += 36) { R(x, 192, y, 32, 5, '#5a6272'); R(x, 192, y, 32, 1, '#8a94a4'); }
    const cap = (y0, flip) => {
      for (let y = 0; y < 8; y++) bands(x, 112, y0 + (flip ? 32 : 0) + y, 192, DARK);
      for (let y = 0; y < 32; y++) bands(x, 120, y0 + (flip ? 0 : 8) + y, 176, STEEL);
      const by = y0 + (flip ? 14 : 22);
      for (let X = 128; X < 290; X += 16) { R(x, X, by, 5, 5, '#2a3040'); R(x, X, by, 4, 4, '#9aa2b2'); R(x, X + 1, by + 1, 2, 2, '#6a7282'); }
    };
    cap(184, false); cap(584, true);
    R(x, 112, 184, 192, 1, '#aab2c0');
    for (const [X0, X1] of [[104, 150], [266, 312]]) {
      R(x, X0 + (X0 < 200 ? 40 : 0), 224, 6, 360, '#3a4252');
      for (let y = 232; y < 584; y += 12) { R(x, X0, y, X1 - X0, 5, '#6a7282'); R(x, X0, y, X1 - X0, 1, '#9aa2b2'); R(x, X0, y + 4, X1 - X0, 1, '#2a3040'); R(x, X0, y, 1, 5, '#8a94a4'); }
    }
    R(x, 152, 224, 112, 360, '#10141c');
    for (const X of [148, 262]) for (let y = 224; y < 584; y++) bands(x, X, y, 6, STEEL);
    // the gauge: a bezel round three glass bands with ticks
    R(x, 485, 103, 70, 562, OUT); R(x, 486, 104, 68, 560, '#46505e'); R(x, 486, 104, 68, 2, '#6c7888'); R(x, 486, 104, 2, 560, '#606c7c'); R(x, 486, 662, 68, 2, '#2a323e'); R(x, 552, 104, 2, 560, '#323a46');
    R(x, 494, 110, 52, 548, '#0a0f16');
    for (let y = 112; y < 656; y++) {
      const hot = y < 248, safe = y < 464, base = hot ? (((y >> 2) + 0) % 4 < 2 ? '#6a2222' : '#541a1a') : safe ? '#1e5032' : '#1e325a';
      R(x, 496, y, 48, 1, base);
      if (!hot && safe && y > 300 && y < 412) R(x, 506, y, 28, 1, '#246040');
    }
    for (let i = 0; i <= 20; i++) { const y = Math.round(656 - i * 27.2); R(x, 536, y, i % 2 ? 4 : 8, 1, 'rgba(255,255,255,.55)'); }
    R(x, 496, 248, 48, 1, '#ff8a80'); R(x, 496, 464, 48, 1, '#8ab4ff');
    R(x, 498, 112, 2, 544, 'rgba(255,255,255,.18)'); R(x, 540, 112, 4, 544, 'rgba(0,0,0,.25)');
    // the valve body on the riser
    R(x, 389, 383, 38, 34, OUT); for (let y = 384; y < 416; y++) bands(x, 390, y, 36, STEEL);
    // the oxygen converter: hopper, machine body, status window, tank, tray
    for (let y = 176; y < 240; y++) {
      const l = 944 + (y - 176), r = 1263 - (y - 176), w = r - l;
      R(x, l - 1, y, 1, 1, OUT); R(x, r, y, 1, 1, OUT);
      bands(x, l, y, w, ['#2e353f', '#3e4654', '#5a6272', '#8a94a4']);
    }
    for (let X = 944; X < 1263; X += 2) R(x, X, 176, 2, 6, ((X - 944) >> 3) & 1 ? '#1a1c22' : '#e6b432');
    R(x, 943, 175, 321, 1, OUT); R(x, 944, 182, 319, 1, '#aab2c0');
    R(x, 1039, 182, 130, 20, OUT); R(x, 1040, 182, 128, 19, '#0c1016'); R(x, 1040, 182, 128, 3, '#04060a');
    for (let X = 1052; X < 1166; X += 12) R(x, X, 185, 2, 16, '#2a3040');
    R(x, 991, 240, 226, 369, OUT);
    for (let y = 240; y < 608; y++) bands(x, 992, y, 224, ['#30373f', '#434b57', '#5c6573', '#7e8896']);
    for (const sy of [262, 400]) { R(x, 992, sy, 224, 1, '#2a3040'); R(x, 992, sy + 1, 224, 1, '#8a94a4'); }
    for (let Y = 250; Y < 600; Y += 22) { rivet(x, 997, Y); rivet(x, 1207, Y); }
    // status window
    R(x, 1007, 271, 194, 82, OUT); R(x, 1008, 272, 192, 80, '#0a1218'); R(x, 1008, 272, 192, 2, '#04080c'); R(x, 1008, 351, 192, 1, '#6a7482');
    for (const X of [1040, 1162]) { R(x, X, 280, 6, 64, '#8a94a4'); R(x, X, 280, 2, 64, '#c8d0dc'); R(x, X + 5, 280, 1, 64, '#4a5462'); }
    // tank: glass over a dark back, caps and ticks
    R(x, 1015, 407, 178, 194, OUT); for (let y = 408; y < 416; y++) bands(x, 1016, y, 176, STEEL); for (let y = 592; y < 600; y++) bands(x, 1016, y, 176, STEEL);
    R(x, 1024, 416, 160, 176, '#0b141c');
    for (let i = 0; i <= 8; i++) R(x, 1172, 592 - i * 22, i % 2 ? 6 : 10, 1, 'rgba(200,220,240,.45)');
    // the outlet to the cabin and the vents
    R(x, 1216, 300, 46, 14, OUT); for (let X = 0; X < 44; X++) rowsLit(x, 1217 + X, 301, 1, 12, STEEL);
    for (let k = 0; k < 5; k++) { R(x, 1000, 560 + k * 8, 20, 3, '#1e242c'); R(x, 1000, 563 + k * 8, 20, 1, '#8a94a4'); }
    // the tray: a metal shelf with six slots
    R(x, 679, 599, 290, 74, OUT); for (let y = 600; y < 672; y++) R(x, 680, y, 288, 1, y < 602 ? '#7a8494' : y > 668 ? '#262c36' : '#3c4350');
    for (let i = 0; i < 6; i++) { const X = 686 + i * 42; R(x, X, 606, 40, 58, '#262b36'); R(x, X, 606, 40, 2, '#161a22'); R(x, X, 606, 2, 58, '#1c2029'); R(x, X, 663, 40, 1, '#5a6272'); }
    for (let X = 690; X < 966; X += 24) { disc(x, X, 668, 3, '#1a1e26'); R(x, X - 1, 666, 2, 1, '#8a94a4'); }
  }
  // the plasma column: a white core in rings that rise, cold (blue), in band (amber) and hot (red)
  const PLASMA = [['#0e2a44', '#1e5a8a', '#5ab4e6', '#d8f4ff'], ['#8a4a18', '#d8822a', '#ffc87a', '#fff6dc'], ['#9a1e10', '#e8402a', '#ff8048', '#ffe0c8']].map((p) => p.map(hex));
  const plasmas = new Map();
  function plasma(idx, f) {
    const key = idx * 8 + f; let c = plasmas.get(key);
    if (c) return c;
    const pal = idx === 0 ? PLASMA[0] : PLASMA[1].map((col, i) => mix(col, PLASMA[2][i], (idx - 1) / 5)), r = noise(idx * 11 + f);
    c = paint(CORE.w, CORE.h, (set, w, h) => {
      for (let y = 0; y < h; y++) {
        const ph = ((y + f * 12) % 46) / 46, ring = ph < .16 ? 1 : 0, wob = Math.sin(y * .09 + f * 1.6) * 2;
        for (let X = 0; X < w; X++) {
          const d = Math.abs(X + .5 - w / 2 - wob) / (w / 2);
          if (d > .92 && bayer(X, y) > (1 - d) * 9) continue;
          let z = d < .14 ? 3 : d < .32 ? 2 : d < .6 ? 1 : 0;
          if (d < .8) z = Math.min(3, z + ring);
          if (r() < .004) z = 3;
          set(X, y, pal[z]);
        }
      }
    });
    plasmas.set(key, c);
    return c;
  }
  // the pump's impeller, four frames; the valve's hand wheel, twelve frames over a third of a turn
  const impellers = [];
  function impeller(f) {
    return impellers[f] ??= outlined(paint(34, 34, (set) => {
      for (let y = 0; y < 34; y++) for (let X = 0; X < 34; X++) {
        const dx = X + .5 - 17, dy = y + .5 - 17, d = Math.hypot(dx, dy);
        if (d > 17) continue;
        let col = d > 14 ? (dx + dy < 0 ? '#9aa2b2' : '#3a4252') : d > 12.5 ? '#2a3040' : '#121820';
        if (d <= 12.5) { const a = Math.atan2(dy, dx) - f * TAU / 12, s = ((a % (TAU / 3)) + TAU / 3) % (TAU / 3); if (s < .5 && d > 3) col = s < .18 ? '#e8ecf2' : '#9aa2b2'; if (d <= 3.5) col = '#c8ccd4'; }
        set(X, y, hex(col));
      }
    }));
  }
  const wheels = [];
  function wheel(f) {
    return wheels[f] ??= outlined(paint(78, 78, (set) => {
      const a0 = f / 12 * TAU / 3;
      for (let y = 0; y < 78; y++) for (let X = 0; X < 78; X++) {
        const dx = X + .5 - 39, dy = y + .5 - 39, d = Math.hypot(dx, dy), nx = dx / (d || 1), ny = dy / (d || 1);
        let col = null;
        if (d >= 31 && d <= 38.5) { const l = (d > 34.7 ? -1 : 1) * (nx + ny) * .7; col = RED[l > .45 ? 3 : l > -.2 ? 2 : l > -.6 ? 1 : 0]; }
        else if (d < 31) {
          for (let k = 0; k < 3; k++) {
            const a = a0 + k * TAU / 3, ux = Math.cos(a), uy = Math.sin(a), along = dx * ux + dy * uy, across = -dx * uy + dy * ux;
            if (along > 0 && Math.abs(across) < 2.6) col = RED[across * (ux - uy) < 0 ? 2 : 1];
          }
          if (d < 8.5) col = d < 3.5 ? '#c8ccd4' : RED[(nx + ny < 0) ? 2 : 1];
        }
        const ka = a0 + .55, kx = 39 + Math.cos(ka) * 34.7, ky = 39 + Math.sin(ka) * 34.7;
        if (Math.hypot(X + .5 - kx, y + .5 - ky) < 3.6) col = Math.hypot(X - kx + 1.5, y - ky + 1.5) < 1.6 ? '#ffd0c8' : '#ff8a7a';
        if (col) set(X, y, hex(col));
      }
    }));
  }
  // the coolant loop: pipes blue when the pump runs, grey when it is off; two builds
  const pipeC = {};
  function pipes(on) {
    if (pipeC[on]) return pipeC[on];
    const pal = on ? PIPE_ON : PIPE_OFF, X0 = 296, Y0 = 256;
    const [c, x] = make(150, 316);
    const h = (X, Y, w) => { R(x, X - X0, Y - Y0 - 1, w, 18, OUT); rowsLit(x, X - X0, Y - Y0, w, 16, pal); };
    const v = (X, Y, hh) => { R(x, X - X0 - 1, Y - Y0, 18, hh, OUT); for (let y = 0; y < hh; y++) bands(x, X - X0, Y - Y0 + y, 16, pal); };
    h(312, 272, 104); h(312, 528, 104); v(400, 272, 272);
    for (const Y of [272, 528]) { for (let y = 0; y < 16; y++) bands(x, 400 - X0, Y - Y0 + y, 16, pal); }
    for (const [X, Y] of [[312, 268], [312, 524], [392, 268], [392, 524]]) { R(x, X - X0, Y - Y0, 6, 24, OUT); for (let y = 1; y < 23; y++) bands(x, X - X0 + 1, Y - Y0 + y, 4, STEEL); }
    for (const Y of [330, 470]) { R(x, 396 - X0, Y - Y0, 24, 6, OUT); rowsLit(x, 397 - X0, Y - Y0 + 1, 22, 4, STEEL); }
    // the pump housing on the return line
    const px = 356 - X0, py = 536 - Y0;
    for (let y = -20; y <= 20; y++) { const hw = Math.round(Math.sqrt(400 - y * y)); R(x, px - hw - 1, py + y, hw * 2 + 3, 1, OUT); }
    for (let y = -19; y <= 19; y++) { const hw = Math.round(Math.sqrt(361 - y * y)); bands(x, px - hw, py + y, hw * 2 + 1, STEEL); }
    R(x, px + 12, py - 26, 10, 8, OUT); R(x, px + 13, py - 25, 8, 6, '#3a4252');
    return (pipeC[on] = c);
  }
  let PTR = null;
  const pointer = () => (PTR ??= sprite(82, 9, (x) => {
    for (let k = 0; k < 5; k++) { R(x, k, 4 - k, 1, k * 2 + 1, '#ffffff'); R(x, 81 - k, 4 - k, 1, k * 2 + 1, '#ffffff'); }
    R(x, 5, 3, 72, 3, '#ffffff'); R(x, 5, 3, 72, 1, '#ffffff'); R(x, 5, 5, 72, 1, '#c8d0dc');
  }, OUT));
  const LIQ = { ok: ['#1e5a8a', '#2e7ab0', '#6ec8f0', '#b4e8ff'], low: ['#7a2e22', '#b0503a', '#f08a6e', '#ffc4b0'] };
  FA.sci = (x, F, o) => {
    const t = F.t, cm = calm(), tp = F.temp, hot = clamp((tp - 40) / 50);
    x.drawImage(cabin('sci'), 0, 0);
    // the reactor
    const idx = tp < 35 ? 0 : 1 + Math.round(hot * 5), fr = Math.floor(t * (cm ? 3 : 10)) % 4;
    x.drawImage(plasma(idx, fr), CORE.x, CORE.y);
    R(x, 156, 224, 2, 360, 'rgba(255,255,255,.3)'); R(x, 160, 224, 1, 360, 'rgba(255,255,255,.14)'); R(x, 252, 224, 10, 360, 'rgba(0,0,0,.22)');
    glow(x, 208, 404, 170, idx === 0 ? '90,170,255' : hot > .7 ? '255,80,50' : '255,170,80', .12 + hot * .22);
    if (tp > 75) {
      for (let i = 0; i < (cm ? 4 : 9); i++) { const k = ((cm ? 0 : t * .9) + i * .137) % 1; x.globalAlpha = 1 - k; R(x, 132 + ((i * 53 + (cm ? 0 : t * 40)) % 152 | 0), Math.round(180 - k * 90), 3, 3, k < .4 ? '#ffd0a0' : '#ff6a3c'); }
      x.globalAlpha = 1;
      const on = cm || Math.floor(t * 4) % 2;
      R(x, 286, 190, 8, 6, on ? '#ff5a50' : '#5a1814'); if (on) glow(x, 290, 193, 14, '255,90,80', .7);
    }
    // the coolant loop, the pump, the moving coolant and the valve
    const pumpOn = o.pumpOn;
    x.drawImage(pipes(pumpOn), 296, 256);
    const imp = impeller(pumpOn ? Math.floor(t * (cm ? 4 : 6 + F.valve * 26)) % 4 : 0);
    x.drawImage(imp, 356 - (imp.width >> 1), 536 - (imp.height >> 1));
    R(x, 365, 512, 6, 4, pumpOn ? '#6edc82' : '#ff5a50'); if (pumpOn) glow(x, 368, 514, 8, '110,220,130', .5);
    if (pumpOn && F.valve > .03) {
      const k = (t * (10 + F.valve * 40)) % 34, Y = 272 + Math.round(k * 8);
      glow(x, 408, Y + 4, 14, '140,200,255', .6);
      R(x, 402, Y, 12, 10, OUT); R(x, 403, Y + 1, 10, 8, '#bfe0ff'); R(x, 404, Y + 2, 4, 2, '#ffffff');
      for (let j = 0; j < 3; j++) { const hx = 312 + ((t * (40 + F.valve * 160) + j * 35) % 88); R(x, Math.round(hx), 278, 6, 2, '#bfe0ff'); R(x, Math.round(400 - (hx - 312)), 534, 6, 2, '#bfe0ff'); }
    }
    const w = wheel(Math.floor((((t * F.valve * 6) % (TAU / 3)) + TAU / 3) % (TAU / 3) / (TAU / 3) * 12) % 12);
    x.drawImage(w, 408 - (w.width >> 1), 400 - (w.height >> 1));
    // the gauge's pointer
    x.drawImage(pointer(), 479, Math.round((82 - tp / 100 * 68) * 8) - 1);
    // the converter: intake (red and jammed), electrolysis bubbles, the oxygen tank
    const jam = F.jam > 0, lev = clamp(o.o2 / 100);
    if (jam) {
      const on = cm || Math.floor(t * 6) % 2;
      R(x, 1040, 182, 128, 19, on ? '#7a1a1a' : '#4a1010'); glow(x, 1104, 192, 60, '255,70,60', on ? .45 : .2);
      const wr = tumble('wrench', 1); x.drawImage(wr, 1104 - (wr.width >> 1), 168 - (wr.height >> 1));
    } else glow(x, 1104, 192, 40, '90,190,255', .14);
    const live = !jam && F.loads[3].on && F.blackout <= 0;
    for (let i = 0; i < 14; i++) { const k = ((live && !cm ? t * .7 : 0) + i * .071) % 1, X = 1058 + ((i * 37) % 96); R(x, X, Math.round(340 - k * 60), 2, 2, i % 3 ? '#8ad8ff' : '#e8f8ff'); }
    for (let i = 0; i < 4; i++) R(x, 1180 - i * 10, 342, 6, 4, live ? (i <= Math.floor(t * 2) % 4 ? '#6edc82' : '#1e5a32') : jam ? '#ff5a50' : '#3a4250');
    const pal = lev < .35 ? LIQ.low : LIQ.ok, lh = Math.round(176 * lev), top = 592 - lh;
    if (lh > 0) {
      for (let y = top; y < 592; y++) bands(x, 1024, y, 160, y - top < 2 ? [pal[2], pal[3], pal[3], '#ffffff'] : pal);
      for (let i = 0; i < 5; i++) { const k = ((cm ? .3 : t * .45) + i * .21) % 1, Y = Math.round(590 - k * (lh - 6)); if (Y > top + 3) { R(x, 1040 + i * 28, Y, 4, 4, pal[3]); R(x, 1040 + i * 28, Y, 2, 1, '#ffffff'); } }
    }
    R(x, 1030, 416, 3, 176, 'rgba(255,255,255,.2)'); R(x, 1036, 416, 1, 176, 'rgba(255,255,255,.1)');
    x.drawImage(overlay('sci'), 0, 0);
  };

  // ---------- the tray's items, 32 x 32 sprites with their own silhouettes, and their tumble frames
  const ITEM_ART = {
    ice(x) { // a translucent cube with a highlight and trapped bubbles
      for (let y = 0; y < 12; y++) { const hw = Math.round((y < 6 ? y : 11 - y) * 2.1); R(x, 16 - hw, 3 + y, hw * 2, 1, '#eaf8ff'); }
      for (let y = 0; y < 14; y++) { const o = Math.round(Math.min(y, 6) * 0); R(x, 4 + o, 9 + y, 12, 1, '#a8d8f8'); R(x, 16, 9 + y, 12, 1, '#6aa8d8'); }
      for (let X = 0; X < 12; X++) { const dy = Math.round(X * .5); R(x, 4 + X, 23 + dy, 1, 6 - dy, '#a8d8f8'); R(x, 27 - X, 23 + dy, 1, 6 - dy, '#6aa8d8'); }
      for (let X = 0; X < 12; X++) { const dy = Math.round(X * .5); R(x, 4 + X, 9 + dy, 1, 1, '#ffffff'); R(x, 27 - X, 9 + dy, 1, 1, '#c8ecff'); }
      R(x, 16, 15, 1, 16, '#ffffff'); R(x, 4, 9, 1, 14, '#ffffff');
      R(x, 7, 14, 2, 6, '#ffffff'); R(x, 8, 21, 1, 2, '#ffffff');
      R(x, 21, 17, 2, 2, '#bfe6ff'); R(x, 24, 22, 1, 1, '#bfe6ff'); R(x, 10, 25, 2, 1, '#d8f2ff'); R(x, 19, 24, 3, 1, '#4a88c0');
      R(x, 14, 5, 6, 1, '#ffffff'); R(x, 12, 6, 3, 1, '#ffffff');
    },
    co2(x) { // a pressure canister: valve wheel, neck, rounded shoulders, a yellow band
      R(x, 11, 0, 10, 2, '#5a5e66'); R(x, 11, 0, 10, 1, '#9aa0aa'); R(x, 15, 2, 2, 2, '#3a3e46');
      for (let y = 4; y < 7; y++) bands(x, 13, y, 6, ['#3a3e46', '#4a4e56', '#6a6e76', '#9aa0aa']);
      const PAL = ['#4a4e56', '#6a6e76', '#8c9096', '#d0d4da'];
      for (let y = 7; y < 31; y++) { const hw = y < 9 ? 3 + (y - 7) * 2 : y > 28 ? 7 - (y - 28) : 7; bands(x, 16 - hw, y, hw * 2, PAL); }
      for (let y = 16; y < 20; y++) bands(x, 9, y, 14, ['#8a6a1c', '#b8902a', '#e6b946', '#ffe08a']);
      R(x, 12, 22, 5, 4, '#e8ecf2'); R(x, 13, 23, 3, 1, '#ff5a50'); R(x, 13, 24, 2, 1, '#2a2e36');
    },
    food(x) { // a crumpled, torn food pouch with scraps spilling out
      const pts = [[5, 8], [10, 6], [14, 9], [19, 5], [24, 8], [27, 7], [27, 26], [22, 29], [9, 30], [4, 27]];
      x.fillStyle = '#a8703c'; x.beginPath(); pts.forEach(([X, Y], i) => (i ? x.lineTo(X, Y) : x.moveTo(X, Y))); x.closePath(); x.fill();
      const [cv] = [x.canvas];
      R(x, 5, 9, 4, 18, '#c89058'); R(x, 20, 9, 7, 19, '#825a3c'); R(x, 9, 26, 13, 3, '#6a4428');
      line(x, 9, 12, 14, 20, '#5c3e28'); line(x, 15, 11, 18, 24, '#5c3e28'); line(x, 22, 12, 21, 20, '#c89058'); line(x, 7, 22, 12, 27, '#5c3e28');
      R(x, 10, 15, 8, 6, '#e8d8b8'); R(x, 11, 16, 6, 1, '#c8b898');
      R(x, 10, 3, 3, 4, '#9ab040'); R(x, 15, 4, 3, 3, '#e8c050'); R(x, 20, 2, 2, 4, '#c86a3a'); R(x, 11, 3, 1, 1, '#c8e070');
      void cv;
    },
    wrench(x) { // an open-end wrench: jaws top right, a ring at the bottom left
      for (let i = 0; i < 20; i++) { const X = 7 + i, Y = 24 - i; R(x, X - 2, Y - 1, 4, 4, '#8a92a2'); R(x, X - 2, Y - 2, 3, 3, '#c8ccd4'); R(x, X - 2, Y - 2, 1, 1, '#ffffff'); }
      disc(x, 24, 7, 6, '#8a92a2'); disc(x, 23, 6, 6, '#c8ccd4'); R(x, 19, 2, 3, 1, '#ffffff'); R(x, 18, 3, 1, 3, '#ffffff');
      x.clearRect(24, 0, 8, 7); x.save(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.moveTo(22, 0); x.lineTo(32, 0); x.lineTo(32, 11); x.lineTo(27, 6); x.closePath(); x.fill(); x.restore();
      disc(x, 7, 25, 5, '#8a92a2'); disc(x, 6, 24, 5, '#c8ccd4'); R(x, 3, 21, 2, 1, '#ffffff');
      x.clearRect(5, 23, 3, 3); R(x, 5, 23, 3, 3, '#383e4c');
    }
  };
  const itemRaw = {}, itemSpr = {};
  const rawItem = (type) => (itemRaw[type] ??= (() => { const [c, x] = make(32, 32); ITEM_ART[type](x); return c; })());
  const itemSprite = (type) => (itemSpr[type] ??= outlined(rawItem(type)));
  // eight tumble frames: the raw art turned with nearest-neighbour sampling, made solid, then outlined
  const tumbles = {};
  function tumble(type, f) {
    const k = type + f;
    if (tumbles[k]) return tumbles[k];
    const [c, x] = make(44, 44);
    x.imageSmoothingEnabled = false; x.translate(22, 22); x.rotate(f * TAU / 8); x.drawImage(rawItem(type), -16, -16);
    const d = x.getImageData(0, 0, 44, 44), a = d.data;
    for (let i = 3; i < a.length; i += 4) a[i] = a[i] > 110 ? 255 : 0;
    x.setTransform(1, 0, 0, 1, 0, 0); x.putImageData(d, 0, 0);
    return (tumbles[k] = outlined(c));
  }
  // drawn on the HUD canvas (640-space) at whole art pixels: x, y is the item's 640-space top-left
  const snap = (v) => Math.round(v * 2) / 2;
  FA.item = (g, type, X, Y) => { const s = itemSprite(type); g.imageSmoothingEnabled = false; g.drawImage(s, snap(X), snap(Y), s.width / 2, s.height / 2); };
  FA.thrown = (g, type, X, Y, ang) => {
    const s = tumble(type, ((Math.floor(ang / (TAU / 8)) % 8) + 8) % 8);
    g.imageSmoothingEnabled = false; g.drawImage(s, snap(X - s.width / 4), snap(Y - s.height / 4), s.width / 2, s.height / 2);
  };
  // weld sparks and oxygen puffs (640-space particles), a 2 x 2 art-pixel head and a fading tail
  FA.sparks = (g, list) => {
    for (const p of list) {
      const a = clamp(p.life * 3), X = snap(p.x), Y = snap(p.y);
      g.globalAlpha = a; g.fillStyle = p.col; g.fillRect(X, Y, 1, 1);
      g.globalAlpha = a * .45; g.fillRect(snap(p.x - p.vx * .012), snap(p.y - p.vy * .012), .5, .5);
    }
    g.globalAlpha = 1;
  };
})();
