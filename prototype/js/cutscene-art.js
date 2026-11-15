// Homestead cutscene art: what plays between the playable scenes (the mission brief's backdrop, the launch
// and its overweight failure, the landing, the mission report's backdrop), on the 1280 x 720 art grid in the
// title film's style (src/ui/ART-RULES.md): sky, far land and big floor fills in 2 x 2 chunks, everything near
// in 1 x 1, a 1 px dark outline on sprites, three shades per material, light from the top left.
// js/menu.js and js/report.js call HS.cutArt.* to draw into HS.ax, then HS.blitArt(), then their own text.
// Skies, ground, planets and sprites are built the first time they are needed and kept. Smoke, dust, fire
// and debris are worked out from the scene clock, so every frame depends only on its time.
(() => {
  const HS = window.HS, L = HS.liftoff;
  const { R, make, hex, mix, bayer, noise, fbm, fbm2, hash, earthSphere, phobosSprite, padRocket, gantry, clamp } = L;
  const OUT = HS.ART_OUT, CA = HS.cutArt = {};
  const css = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`, css2 = (c) => [c[0] | 0, c[1] | 0, c[2] | 0];
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (k) => HS.ease(k);
  const calm = () => L.calm();

  // ---------- small tools
  // a canvas that is read back more than once (an outline pass, then a lit copy)
  const makeRead = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingEnabled = false; return [c, x]; };
  // paint a canvas pixel by pixel: fn returns [r, g, b] or [r, g, b, a], or null for clear
  function paint(w, h, fn) {
    const [c, x] = make(w, h), d = x.createImageData(w, h), a = d.data;
    for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) {
      const col = fn(X, y); if (!col) continue;
      const o = (y * w + X) * 4; a[o] = col[0]; a[o + 1] = col[1]; a[o + 2] = col[2]; a[o + 3] = col.length > 3 ? col[3] : 255;
    }
    x.putImageData(d, 0, 0); return c;
  }
  // the film's sky dither: steps of 5 per channel, ordered by the Bayer matrix
  const q5 = (col, X, y) => { const bb = bayer(X, y); return [Math.floor(col[0] / 5 + bb) * 5, Math.floor(col[1] / 5 + bb) * 5, Math.floor(col[2] / 5 + bb) * 5]; };
  function gradient(stops) {
    const st = stops.map(([s, h]) => [s, hex(h)]);
    return (ty) => { let i = 0; while (i < st.length - 2 && ty > st[i + 1][0]) i++; return mix(st[i][1], st[i + 1][1], clamp((ty - st[i][0]) / (st[i + 1][0] - st[i][0]))); };
  }
  // snap soft path edges to solid or clear, then give the sprite its 1 px dark outline (rule 5)
  function crisp(c, outline = OUT) {
    const x = c.getContext('2d'), w = c.width, h = c.height, d = x.getImageData(0, 0, w, h), a = d.data;
    for (let i = 3; i < a.length; i += 4) a[i] = a[i] >= 110 ? 255 : 0;
    const o = hex(outline), solid = (i) => a[i * 4 + 3] === 255, add = [];
    for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) {
      const i = y * w + X; if (solid(i)) continue;
      if ((X > 0 && solid(i - 1)) || (X < w - 1 && solid(i + 1)) || (y > 0 && solid(i - w)) || (y < h - 1 && solid(i + w))) add.push(i);
    }
    for (const i of add) { a[i * 4] = o[0]; a[i * 4 + 1] = o[1]; a[i * 4 + 2] = o[2]; a[i * 4 + 3] = 255; }
    x.putImageData(d, 0, 0); return c;
  }
  const line = (x, x0, y0, x1, y1, w, col) => { const n = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) R(x, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), w, w, col); };
  // a pixel ball in four shades, lit from the top left; cols are highlight, base, shadow, deep
  function ball(x, cx, cy, r, cols) {
    for (let y = -r; y <= r; y++) for (let X = -r; X <= r; X++) {
      const d2 = (X * X + y * y) / (r * r + r); if (d2 > 1) continue;
      const lum = clamp((-X * .6 - y * .62) / r * .7 + Math.sqrt(1 - d2) * .5), q = lum * 3, b0 = Math.floor(q);
      R(x, cx + X, cy + y, 1, 1, cols[3 - Math.min(3, b0 + (q - b0 > bayer(X + 64, y + 64) ? 1 : 0))]);
    }
  }
  // a tilted ellipse, for dishes: the concave face, its back, and a lit rim
  function dish(x, cx, cy, rx, ry, rot, face, back, rim) {
    const c = Math.cos(rot), s = Math.sin(rot), m = Math.ceil(Math.max(rx, ry));
    for (let y = -m; y <= m; y++) for (let X = -m; X <= m; X++) {
      const u = X * c + y * s, v = -X * s + y * c, e = (u * u) / (rx * rx) + (v * v) / (ry * ry);
      if (e > 1) continue;
      R(x, cx + X, cy + y, 1, 1, e > .62 && v < 0 ? rim : v < ry * .25 ? face : back);
    }
  }
  // a tongue of fire, 1 x 1 at the base and flickering every frame (rule 7)
  function fire(x, cx, by, w, h, t, seed) {
    const f = Math.floor(t * 18 + seed * 7), hh = Math.max(2, Math.round(h * (.7 + .5 * hash(f + seed))));
    for (let i = 0; i < hh; i++) {
      const k = i / hh, ww = Math.max(1, Math.round(w * (1 - k * .85))), jx = Math.round((hash(f * 3 + i + seed) - .5) * 2 * k);
      R(x, cx - (ww >> 1) + jx, by - i, ww, 1, k < .25 ? '#ff7a2a' : k < .6 ? '#ffb43c' : '#ffe08a');
      if (ww > 2 && k < .5) R(x, cx - (ww >> 2) + jx, by - i, Math.max(1, ww >> 1), 1, '#fff0c0');
    }
  }

  // ---------- smoke, steam, dust and fire puffs
  // three shades each, lit from the top left; dissolved by an ordered dither at levels 0 (solid) to 3
  const PUFF = {
    steam: ['#ffffff', '#dde2ea', '#a6aebe'],
    smoke: ['#b4b4ba', '#88888f', '#5c5c64'],
    dark: ['#6a6468', '#46424a', '#2a272e'],
    warm: ['#fff2d6', '#f2c592', '#c28866'],   // steam lit by the flame below it
    fire0: ['#ffffff', '#fff2b8', '#ffd27a'],
    fire1: ['#ffe08a', '#ffa040', '#e2602a'],
    fire2: ['#ff8a3c', '#c84a26', '#7a2a16'],
    dust: ['#e6b896', '#c48e6a', '#8e5c44'],
    regolith: ['#d2d2d8', '#a2a2aa', '#6e6e76']
  };
  const puffs = new Map();
  function puff(kind, r, lv) {
    const key = kind + '|' + r + '|' + lv;
    let c = puffs.get(key); if (c) return c;
    const P = PUFF[kind].map(hex), n = r * 2 + 1, R2 = (r + .5) * (r + .5), keep = [2, .78, .5, .24][lv];
    c = paint(n, n, (X, y) => {
      const dx = X - r, dy = y - r, d2 = (dx * dx + dy * dy) / R2;
      if (d2 > 1) return null;
      // the edge thins out first as a puff dissolves
      if (bayer(X, y) > keep + (1 - d2) * .22 - .08) return null;
      const lum = (-dx * .62 - dy * .78) / (r + .5) * .8 + Math.sqrt(1 - d2) * .5;
      return lum > .66 ? P[0] : lum > .1 ? P[1] : P[2];
    });
    puffs.set(key, c); return c;
  }
  // small puffs are 1 x 1; big billows are 2 x 2 chunks (rule 2)
  function drawPuff(x, kind, cx, cy, rad, lv) {
    if (lv > 3 || rad < .5) return;
    if (rad >= 11) { const r = Math.round(rad / 2), c = puff(kind, r, lv); x.drawImage(c, (Math.round(cx / 2) - r) * 2, (Math.round(cy / 2) - r) * 2, c.width * 2, c.height * 2); }
    else { const r = Math.max(1, Math.round(rad)), c = puff(kind, r, lv); x.drawImage(c, Math.round(cx) - r, Math.round(cy) - r); }
  }
  const dissolve = (k) => k < .45 ? 0 : k < .68 ? 1 : k < .86 ? 2 : k < 1 ? 3 : 4;

  // a rocket or lander flame: a white core in yellow and orange, flickering every frame, cut off at clipY.
  // pal is four colours, hottest first; mach adds the bright diamonds of a liquid engine
  const FLAME = {
    chem: ['#fff6d8', '#ffd27a', '#ff9a3c', '#e2602a'],
    solid: ['#ffffff', '#fff0b0', '#ffb43c', '#f07a2a'],
    ion: ['#f2fbff', '#a8e4ff', '#4ab4f0', '#2a6ac8'],
    rust: ['#fff0c8', '#ffb43c', '#e2602a', '#8a2e18'],
    lander: ['#ffffff', '#fff0c0', '#ffc070', '#e88a4a'],
    moonLander: ['#ffffff', '#f2f0ff', '#c8c8f0', '#8a90c8']
  };
  function flame(x, cx, top, len, wid, t, pal, clipY = 1e9, mach = false) {
    const f = Math.floor(t * 30);
    len = Math.round(len);
    for (let i = 0; i < len && top + i < clipY; i++) {
      const k = i / len, y = top + i;
      const w = Math.max(1, Math.round(wid * (k < .12 ? .82 + k * 1.5 : 1.14 * (1 - k) + .04) + (hash(f * 7.3 + i * .71) - .5) * 3 * k));
      const jx = Math.round((hash(f * 3.1 + (i >> 2)) - .5) * 2 * k);
      R(x, cx - (w >> 1) + jx, y, w, 1, pal[k > .7 ? 3 : 2]);
      const w2 = Math.round(w * .62); if (w2 > 0 && k < .86) R(x, cx - (w2 >> 1) + jx, y, w2, 1, pal[1]);
      const w3 = Math.round(w * .3); if (w3 > 0 && k < .5) R(x, cx - (w3 >> 1) + jx, y, w3, 1, pal[0]);
    }
    if (mach) for (const k of [.2, .38, .55]) { const y = top + Math.round(len * k); if (y < clipY - 2) { R(x, cx - 2, y, 4, 2, pal[0]); R(x, cx - 1, y - 1, 2, 4, pal[0]); } }
    for (let i = 0; i < 7; i++) {
      const h = hash(f * 11 + i * 3.7); if (h < .45) continue;
      const y = top + len + Math.round(h * 16); if (y >= clipY) continue;
      R(x, cx + Math.round((hash(f + i * 9.1) - .5) * wid), y, 1, 1, pal[h > .8 ? 0 : 1]);
    }
  }
  // a warm glow added on top, the way the film lights the pad at ignition
  function glow(x, cx, cy, rad, rgb, a) {
    if (a <= 0) return;
    x.globalCompositeOperation = 'lighter';
    const gr = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = gr; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    x.globalCompositeOperation = 'source-over';
  }
  function reset(x) { x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.imageSmoothingEnabled = false; }

  // ---------- deep space: a dithered background with a faint band of the galaxy, and 1 x 1 stars
  let space = null; const TWINK = [];
  function spaceArt() {
    if (space) return space;
    const g = gradient([[0, '#03050d'], [.55, '#050817'], [1, '#08091a']]);
    const bg = paint(640, 360, (X, y) => {
      const d = (-X * .351 + (y - 70) * .936) / 46, band = Math.exp(-d * d);
      const n = fbm2(X / 48, y / 48, 14, 4), lane = fbm2(X / 18 + 7, y / 18, 36, 3);
      let col = g(y / 359);
      col = mix(col, [44, 40, 80], clamp(band * (n * 1.5 - .3)) * .6);
      col = mix(col, [74, 62, 98], clamp(band * (n - .55) * 3) * .4);
      if (lane > .56) col = mix(col, [3, 4, 10], clamp((lane - .56) * 6) * band * .8);
      return q5(col, X, y);
    });
    const [c, x] = make(1280, 720); x.drawImage(bg, 0, 0, 1280, 720);
    const r = noise(31);
    for (let i = 0; i < 1300; i++) {
      const X = (r() * 1280) | 0, Y = (r() * 720) | 0, b = Math.pow(r(), 2.6), tint = r(), v = 46 + b * 190;
      R(x, X, Y, 1, 1, css(tint < .14 ? [v, v * .86, v * .72] : tint > .82 ? [v * .82, v * .9, Math.min(255, v + 26)] : [v, v, Math.min(255, v + 14)]));
    }
    for (let i = 0; i < 70; i++) TWINK.push({ x: (r() * 1280) | 0, y: (r() * 720) | 0, p: r() * 6.3, f: .8 + r() * 1.8, big: r() < .25 ? 2 : r() < .5 ? 1 : 0, warm: r() < .2 });
    return (space = c);
  }
  // a bright star: a core and a small cross that breathes
  function star(x, X, Y, k, warm, big) {
    const v = (150 + 105 * k) | 0, col = warm ? `rgb(255,${v},${(v * .8) | 0})` : `rgb(${v},${v},255)`;
    R(x, X, Y, 1, 1, col);
    if (!big) return;
    x.globalAlpha = .25 + .35 * k; R(x, X - 1, Y, 3, 1, col); R(x, X, Y - 1, 1, 3, col);
    if (big > 1) { x.globalAlpha = .1 + .2 * k; R(x, X - 2, Y, 5, 1, col); R(x, X, Y - 2, 1, 5, col); }
    x.globalAlpha = 1;
  }
  function drawSpace(x, t) {
    x.drawImage(spaceArt(), 0, 0);
    const c = calm();
    for (const s of TWINK) star(x, s.x, s.y, c ? .7 : .5 + .5 * Math.sin(t * s.f + s.p), s.warm, s.big);
  }

  // ---------- a planet as a dithered sphere, lit from the top left like the film's Earth.
  // w x h canvas with the centre at (cx, cy) and radius r, so a horizon strip costs only its own pixels
  const LV = [-.55, -.6, .58];
  function sphere(kind, r, w, h, cx, cy) {
    const mars = kind === 'mars', rn = noise(mars ? 41 : 43), craters = [];
    for (let i = 0; i < (mars ? 16 : 80); i++) {
      const z = rn() * 2 - 1, a = rn() * 6.283, s = Math.sqrt(1 - z * z);
      craters.push([s * Math.cos(a), z, s * Math.sin(a), (mars ? .025 : .02) + Math.pow(rn(), 3) * (mars ? .05 : .12)]);
    }
    return paint(w, h, (X, y) => {
      const nx = (X + .5 - cx) / r, ny = (y + .5 - cy) / r, rr = nx * nx + ny * ny;
      if (rr > 1) {
        // Mars keeps a thin haze on its lit limb
        if (!mars) return null;
        const d = (Math.sqrt(rr) - 1) * r, lit = clamp(-(nx * .68 + ny * .74) / Math.sqrt(rr) + .25);
        if (d > 3 || lit <= 0) return null;
        return [236, 176, 136, (1 - d / 3) * lit * 210];
      }
      const nz = Math.sqrt(1 - rr);
      let lum = clamp(nx * LV[0] + ny * LV[1] + nz * LV[2]), col;
      if (mars) {
        const n1 = fbm(nx * 2.1 + 5, ny * 2.1, nz * 2.1, 5), dark = fbm(nx * 1.5 + 21, ny * 1.7, nz * 1.5, 4);
        col = mix(hex('#b0603a'), hex('#de9866'), clamp((n1 - .35) * 2.4));
        if (dark > .54) col = mix(col, hex('#6a3826'), clamp((dark - .54) * 5));
        if (ny < -.86 + (fbm(nx * 6, ny * 6, nz * 6, 3) - .5) * .12) col = hex('#f2ece6');
      } else {
        const n1 = fbm(nx * 1.6 + 3, ny * 1.6, nz * 1.6, 5);
        col = mix(hex('#9a9aa0'), hex('#d4d4d8'), clamp((n1 - .3) * 2));
        if (n1 < .45) col = mix(col, hex('#5c5e68'), clamp((.45 - n1) * 6));   // the dark maria
      }
      for (const [ccx, ccy, ccz, cr] of craters) {
        const dx = nx - ccx, dy = ny - ccy, dz = nz - ccz, dl = Math.sqrt(dx * dx + dy * dy + dz * dz), dd = dl / cr;
        if (dd > 1.15) continue;
        // the wall nearer the light is in shadow, the far wall lit; the rim catches the light on the sunward side
        const s = (dx * LV[0] + dy * LV[1] + dz * LV[2]) / (dl || 1);
        if (dd < .82) lum *= s > .2 ? .45 : s < -.25 ? 1.25 : .94; else lum *= s > 0 ? 1.16 : .84;
        break;
      }
      const q = clamp(lum, 0, 1.2) * 4, b0 = Math.floor(q), band = clamp((b0 + (q - b0 > bayer(X, y) ? 1 : 0)) / 4, .05, 1.25);
      return [col[0] * band, col[1] * band, col[2] * band];
    });
  }
  const globes = {};
  const globe = (kind, r) => (globes[kind + r] ??= sphere(kind, r, r * 2 + 8, r * 2 + 8, r + 4, r + 4));

  // ---------- the brief: deep space and the lit globe of where you are going, in the corner the panel leaves
  const GX = 1236, GY = 590, GR = 250;
  let earthSmall = null;
  CA.brief = (t, id) => {
    const x = HS.ax; reset(x);
    drawSpace(x, t);
    const moon = id === 'moon', c = calm();
    // the planned orbit: a dashed ring that marches, passing behind the planet
    const rot = -.32, cr = Math.cos(rot), sr = Math.sin(rot), sh = c ? 0 : Math.floor(t * 10);
    const ring = (front) => {
      for (let i = 0; i < 360; i++) {
        const a = i / 360 * Math.PI * 2, ex = Math.cos(a) * 330, ey = Math.sin(a) * 66, X = Math.round(GX + ex * cr - ey * sr), Y = Math.round(GY + ex * sr + ey * cr);
        if ((Math.sin(a) > 0) !== front) continue;
        if (!front && (X - GX) ** 2 + (Y - GY) ** 2 < GR * GR) continue;
        if ((i + sh) % 6 < 3) { x.globalAlpha = front ? .55 : .3; R(x, X, Y, 1, 1, '#78ffdc'); }
      }
      x.globalAlpha = 1;
    };
    ring(false);
    const P = globe(id, GR);
    x.drawImage(P, GX - GR - 4, GY - GR - 4);
    ring(true);
    // the ship on that orbit, a blinking light
    const a = c ? 2.4 : 2.2 + t * .18, ex = Math.cos(a) * 330, ey = Math.sin(a) * 66;
    const sx = Math.round(GX + ex * cr - ey * sr), sy = Math.round(GY + ex * sr + ey * cr);
    if (Math.sin(a) > 0 || (sx - GX) ** 2 + (sy - GY) ** 2 > GR * GR) {
      R(x, sx - 1, sy - 1, 3, 3, OUT); R(x, sx, sy, 1, 1, '#e8ecf2');
      if (Math.floor(t * 3) % 2 === 0) { x.globalAlpha = .5; R(x, sx - 1, sy, 3, 1, '#78ffdc'); R(x, sx, sy - 1, 1, 3, '#78ffdc'); x.globalAlpha = 1; }
    }
    if (moon) {
      // Earth hangs where you left it
      earthSmall ??= earthSphere(22);
      x.drawImage(earthSmall, 92, 92);
    } else {
      // Phobos close in, and Earth reduced to a blue star
      x.drawImage(phobosSprite(), 1128, 262);
      star(x, 118, 132, .8 + .2 * Math.sin(t * 1.3), false, 2);
      R(x, 118, 132, 1, 1, '#8ab4ff');
    }
  };

  // ---------- the launch: the campus pad at dusk, seen from the side like the film's pad
  const PX = 640, BASE = 590, MOUNT = BASE + 6;   // the rocket's centre, its base, the top of the launch mount
  let site = null;
  const SKY_STARS = (() => { const r = noise(19); return Array.from({ length: 300 }, () => ({ x: (r() * 1280) | 0, y: (r() * 1160) | 0, b: .3 + r() * .7, p: r() * 6.3, s: r() < .06 })); })();
  function siteArt() {
    if (site) return site;
    // sky: a tall dusk gradient, 1720 art px in 2 x 2 chunks; the camera climbs into its dark top
    const g = gradient([[0, '#010207'], [.29, '#04071a'], [.523, '#0b1230'], [.581, '#121a40'], [.669, '#1e2652'], [.744, '#3a3466'], [.791, '#6a4670'], [.826, '#b45e66'], [.849, '#e8845a'], [.866, '#f6a866'], [1, '#f8b878']]);
    const sky = paint(640, 860, (X, y) => {
      const dx = (X - 110) / 190, dy = (y - 738) / 52;
      return q5(mix(g(y / 859), [255, 214, 160], Math.exp(-(dx * dx + dy * dy)) * .5), X, y);
    });
    // far hills and a tree line in 2 x 2 chunks, rimmed by the sunset on the left; town lights below
    const hills = paint(640, 380, (X, y) => {
      const bump = (X % 7 < 5 && hash(Math.floor(X / 7) + 3) > .35) ? [1, 2, 2, 2, 1][X % 7] : 0;
      const top = Math.round(36 + 8 * Math.sin(X / 53 + 1) + 5 * Math.sin(X / 21) + (fbm2(X / 30, 0, 22, 3) - .5) * 22) - bump;
      if (y < top) return null;
      const lit = clamp(1 - X / 380);
      if (y === top) return css2(mix([54, 44, 78], [168, 104, 96], lit));
      if (y === top + 1 && lit > .3) return css2(mix([40, 36, 64], [110, 74, 84], lit));
      let col = mix([30, 28, 52], [18, 20, 38], clamp((y - top) / 60));
      if (y > top + 20 && hash(X * 7.1 + y * 13.3) > .985) col = [255, 210, 122];
      return q5(col, X, y);
    });
    // the campus buildings near the pad, 1 x 1 with outlines
    const campus = (() => {
      const [c, x] = make(1280, 240), G = 228;
      // the assembly building: ribbed walls, an orange band, a giant hazard-striped door, lit windows
      {
        const X0 = 92, w = 184, top = 40;
        R(x, X0 + 18, top - 8, 26, 8, '#363c54'); R(x, X0 + 18, top - 8, 26, 1, '#5a5a74'); R(x, X0 + 128, top - 6, 18, 6, '#363c54');
        R(x, X0, top, w, G - top, '#2a3046');
        for (let X = X0 + 10; X < X0 + w - 6; X += 12) { R(x, X, top + 20, 1, G - top - 20, '#21263a'); R(x, X + 1, top + 20, 1, G - top - 20, '#353b54'); }
        R(x, X0, top, 4, G - top, '#6a5068'); R(x, X0 + 4, top, 2, G - top, '#443e5a'); R(x, X0 + w - 6, top, 6, G - top, '#1c2030');
        R(x, X0, top, w, 2, '#4e4c68');
        R(x, X0, top + 8, w, 8, '#8a4e2c'); R(x, X0, top + 8, w, 1, '#c06c3c'); R(x, X0, top + 15, w, 1, '#5a321c');
        const dX = X0 + 62, dw = 60, dT = top + 56;
        R(x, dX - 6, dT, dw + 12, G - dT, '#15171d');
        for (let y = dT, k = 0; y < G; y += 6, k++) for (let X = dX - 6 + (k % 2) * 6; X < dX + dw + 6; X += 12) R(x, X, y, 6, Math.min(6, G - y), '#a0782c');
        R(x, dX, dT + 6, dw, G - dT - 6, '#3a4054'); R(x, dX, dT + 6, dw, 2, '#566078');
        for (let y = dT + 12; y < G; y += 7) R(x, dX, y, dw, 1, '#2c3142');
        for (const wy of [top + 30, top + 72, top + 114]) for (let i = 0; i < 3; i++) for (const wx of [X0 + 14 + i * 14, X0 + w - 52 + i * 14]) {
          const on = hash(wy * 3.1 + wx) > .3;
          R(x, wx, wy, 8, 6, OUT); R(x, wx + 1, wy + 1, 6, 4, on ? '#ffd27a' : '#232c44'); if (on) R(x, wx + 1, wy + 1, 6, 1, '#fff0c0');
        }
      }
      // conifers between the buildings
      for (const [tx, th] of [[318, 46], [340, 60], [362, 40], [866, 52], [890, 38], [1252, 56]]) {
        for (let i = 0; i < th; i++) { const k = i / th, hw = Math.round(2 + k * th * .28 * (1 - (i % 9) / 22)); R(x, tx - hw, G - th + i - 6, hw * 2 + 1, 1, '#132420'); R(x, tx - hw, G - th + i - 6, Math.max(1, hw >> 1), 1, '#24402e'); }
        R(x, tx - 1, G - 6, 3, 6, '#2a1e18');
      }
      // the tracking station: lit control-room windows and the big dish, tilted to the sky
      {
        const X0 = 930, w = 150, top = G - 44;
        R(x, X0, top, w, 44, '#2c3246'); R(x, X0, top, w, 3, '#4a4e66'); R(x, X0, top, 3, 44, '#5a4a62'); R(x, X0 + w - 4, top, 4, 44, '#1c2030');
        for (let i = 0; i < 9; i++) { const on = (i * 7) % 5 !== 1, wx = X0 + 8 + i * 15; R(x, wx, top + 12, 10, 9, OUT); R(x, wx + 1, top + 13, 8, 7, on ? (i % 3 ? '#ffd27a' : '#78ffdc') : '#232c44'); if (on) R(x, wx + 1, top + 13, 8, 2, i % 3 ? '#fff0c0' : '#c8fff0'); }
        R(x, X0 + 98, top - 34, 10, 34, '#3a4256'); R(x, X0 + 98, top - 34, 2, 34, '#5a5a74');
        dish(x, X0 + 103, top - 46, 36, 12, -.5, '#8e94a6', '#3e4456', '#c4c8d4');
        line(x, X0 + 103, top - 46, X0 + 92, top - 66, 1, '#7a8092'); R(x, X0 + 91, top - 68, 3, 3, '#ff5a50');
      }
      // the fuel farm: two pressure spheres on legs
      for (const [cx, r] of [[1152, 24], [1206, 19]]) {
        R(x, cx - r + 3, G - r - 2, 2, r + 2, '#1c2030'); R(x, cx + r - 5, G - r - 2, 2, r + 2, '#1c2030'); R(x, cx - 1, G - r, 2, r, '#1c2030');
        ball(x, cx, G - r * 2 + 2, r, ['#a0a2b4', '#6c7084', '#424658', '#2a2e3e']);
      }
      // floodlight towers by the pad (their lamps and beams come later)
      for (const X of [452, 828]) { R(x, X - 1, G - 158, 3, 158, '#2c3446'); R(x, X - 1, G - 158, 1, 158, '#4a5068'); for (let y = G - 150; y < G; y += 10) line(x, X - 3, y, X + 3, y + 8, 1, '#262c3c'); }
      return crisp(c);
    })();
    // the ground: the dusk lawn and the pad's concrete apron in 2 x 2 chunks, with 1 x 1 tufts and lights on top
    const ground = (() => {
      const grass = ['#10241e', '#142b24', '#19332a', '#1e3b30', '#244436'].map(hex), haze = hex('#2a2a44');
      const conc = ['#4a4e58', '#535762', '#5c606a'].map(hex), joint = hex('#3e414a'), edge = hex('#6a6e7a'), scorch = hex('#24242a');
      const grav = ['#3e3c44', '#46444c', '#4e4c54'].map(hex), haz = [hex('#c8a038'), hex('#1e2026')];
      const half = paint(640, 120, (X, y) => {
        const bb = bayer(X, y), n = fbm2(X / 30, y / 12, 32, 3), f = fbm2(X / 3, y / 2, 320, 1);
        let col = grass[Math.max(0, Math.min(4, Math.floor(n * 6 - 1.3 + (f - .5) * 1.4 + bb)))];
        // the crawlerway out to the assembly building's door
        { const x0 = 92, y0 = 4, dx = 70, dy = 28, l2 = dx * dx + dy * dy, k = clamp(((X - x0) * dx + (y - y0) * dy) / l2), dd = Math.hypot(X - x0 - k * dx, y - y0 - k * dy), wd = 3 + k * 5;
          if (dd < wd) col = dd > wd - 1 ? edge : grav[Math.min(2, Math.floor(f * 2.2 + bb * .8))]; }
        // the apron, centred under the rocket
        const ax = (X + .5 - 320) / 172, ay = (y + .5 - 28) / 21, e = ax * ax + ay * ay;
        if (e < 1) {
          col = conc[Math.min(2, Math.floor(f * 2 + bb))];
          if ((X + 3) % 16 === 0 || (y + 1) % 7 === 0) col = joint;
          if (e > .74 && e < .8) col = haz[(Math.floor((Math.atan2(ay, ax) + 4) * 9)) % 2];
          const s2 = (ax * 3.2) ** 2 + (ay * 1.6) ** 2; if (s2 < 1) col = mix(col, scorch, clamp((1 - s2) * 1.6) * .85);
          if (e > .95) col = edge;
        }
        return mix(col, haze, clamp(1 - y / 26) * .5);
      });
      const [c, x] = make(1280, 240); x.drawImage(half, 0, 0, 1280, 240);
      const d = x.getImageData(0, 0, 1280, 240).data, r = noise(9), lawn = (X, Y) => { const i = (Y * 1280 + X) * 4; return d[i + 1] > d[i] + 8 && d[i + 1] > d[i + 2]; };
      for (let n = 0; n < 7000; n++) {
        const X = (r() * 1276) | 0, Y = (r() * 232 + 6) | 0; if (!lawn(X, Y)) continue;
        if (r() < .9) { x.fillStyle = r() < .5 ? '#2c5040' : '#0c1c18'; x.fillRect(X, Y, 1, 1); x.fillRect(X + 1, Y - 1, 1, 1); x.fillRect(X + 2, Y, 1, 1); }
        else { x.fillStyle = ['#c8a860', '#c8c8d0', '#c87aa8'][(r() * 3) | 0]; x.fillRect(X, Y, 1, 1); }
      }
      // blue edge lights along the crawlerway, amber lights round the apron
      for (let k = 0; k < 1; k += .08) for (const s of [-1, 1]) { const X = Math.round((92 + 70 * k) * 2 + s * (3 + k * 5) * 2 * .37), Y = Math.round((4 + 28 * k) * 2 - s * (3 + k * 5) * 2 * .93); R(x, X, Y, 1, 1, '#8ab4ff'); x.globalAlpha = .35; R(x, X - 1, Y, 3, 1, '#5a96f5'); x.globalAlpha = 1; }
      for (let a = 0; a < 6.283; a += .2) { const X = Math.round(640 + Math.cos(a) * 344), Y = Math.round(56 + Math.sin(a) * 42); if (Y > 20) { R(x, X, Y, 2, 1, '#ffb43c'); R(x, X, Y - 1, 2, 1, '#fff0b0'); } }
      return c;
    })();
    // the floodlight beams, dithered (the film's beam)
    const beams = (() => {
      const [c, bx] = make(1280, 720);
      const beam = (lx, ly, ex, ey0, ey1) => {
        for (let y = Math.min(ly, ey0); y < ey1; y += 2) for (let X = Math.min(lx, ex); X < Math.max(lx, ex); X += 2) {
          const k = (X - lx) / (ex - lx); if (k < 0 || k > 1) continue;
          const y0 = ly + (ey0 - ly) * k, y1 = ly + 2 + (ey1 - ly - 2) * k;
          if (y < y0 || y > y1) continue;
          if ((1 - k * .7) * .32 > bayer(X >> 1, y >> 1)) { bx.fillStyle = 'rgba(255,236,190,0.1)'; bx.fillRect(X, y, 2, 2); }
        }
      };
      beam(452, 404, 604, 300, 596); beam(828, 404, 676, 300, 596);
      return c;
    })();
    return (site = { sky, hills, campus, ground, beams });
  }

  // the scenery round the pad, for camera height cam (art px the ground has fallen away by)
  function drawSite(x, t, cam) {
    const S = siteArt();
    x.drawImage(S.sky, 0, Math.round(cam - 1000), 1280, 1720);
    const sk = calm();
    for (const s of SKY_STARS) {
      const Y = s.y - 1000 + Math.round(cam); if (Y < 0 || Y >= 720) continue;
      const a = clamp((1180 - s.y) / 520) * s.b * (sk ? .8 : .65 + .35 * Math.sin(t * 1.7 + s.p)); if (a < .05) continue;
      x.globalAlpha = a; R(x, s.x, Y, s.s ? 2 : 1, s.s ? 2 : 1, '#e8ecff');
    }
    x.globalAlpha = 1;
    x.drawImage(S.hills, 0, Math.round(440 + cam * .5) & ~1, 1280, 760);
    const gy = Math.round(cam);
    if (gy < 720) {
      x.drawImage(S.campus, 0, 330 + gy);
      // red warning lights on the tall things, blinking out of step
      const on = Math.sin(t * 4) > 0;
      R(x, 94, 366 + gy, 3, 3, on ? '#ff5a50' : '#5a1814'); R(x, 271, 366 + gy, 3, 3, on ? '#5a1814' : '#ff5a50');
      x.drawImage(S.ground, 0, 548 + gy);
      x.drawImage(S.beams, 0, gy);
      for (const X of [452, 828]) { R(x, X - 6, 398 + gy, 13, 7, OUT); R(x, X - 5, 399 + gy, 11, 5, '#fff4d0'); R(x, X - 5, 399 + gy, 11, 1, '#ffffff'); }
      gantry(x, PX - 92, MOUNT + 4 + gy, 300, t, 186, 0);
    }
  }
  // the launch mount: a concrete plinth with the flame hole through it
  function drawMount(x, cam, heat) {
    const y = MOUNT + Math.round(cam);
    if (y > 740) return;
    R(x, PX - 61, y - 1, 122, 40, OUT);
    R(x, PX - 60, y, 120, 6, '#7a7e88'); R(x, PX - 60, y, 120, 1, '#9a9ea8'); R(x, PX - 60, y, 3, 6, '#9a9ea8');
    R(x, PX - 56, y + 6, 112, 32, '#4a4e58'); R(x, PX - 56, y + 6, 4, 32, '#5e626c'); R(x, PX + 50, y + 6, 6, 32, '#363942');
    for (const X of [PX - 46, PX + 34]) { R(x, X, y + 12, 12, 2, '#3a3d46'); R(x, X, y + 22, 12, 2, '#3a3d46'); }
    // the hole: dark, or lit from inside by the flame
    R(x, PX - 22, y + 6, 44, 32, heat > 0 ? '#3a1a10' : '#121318'); R(x, PX - 18, y + 6, 36, 32, heat > 0 ? '#6a2a14' : '#0c0d10');
    if (heat > 0) { x.globalAlpha = heat; R(x, PX - 18, y + 22, 36, 16, '#ff9a3c'); R(x, PX - 12, y + 30, 24, 8, '#ffe08a'); x.globalAlpha = 1; }
    R(x, PX - 24, y + 6, 2, 32, '#2a2c34'); R(x, PX + 22, y + 6, 2, 32, '#2a2c34');
  }

  // ---------- the rocket: the film's pad rocket, 48 x 168, wearing the parts you mounted (behind or in front)
  const RW = 150, RH = 254, RCX = 75, RBY = 228;
  const rockets = {};
  const NOZZLE = { chem: 12, solid: 10, ion: 7, sal_prop: 11 };
  function partsBehind(x, s, cx, by) {
    const L0 = cx - 24, R0 = cx + 24;
    const wing = (x0, w, y0, h) => {
      R(x, x0, y0, w, h, '#1d2a5a'); for (let X = 4; X < w; X += 5) R(x, x0 + X, y0 + 1, 1, h - 1, '#2f4a9a');
      R(x, x0, y0 + (h >> 1), w, 1, '#2f4a9a'); R(x, x0, y0, w, 1, '#8ab4e8'); R(x, x0, y0, 1, h, '#5a7ac8'); R(x, x0, y0 + h - 1, w, 1, '#141c44');
    };
    const strut = (x0, w, y0) => { R(x, x0, y0, w, 3, '#8a92a2'); R(x, x0, y0, w, 1, '#c8ccd4'); };
    if (s.power === 'solar_l') { strut(L0 - 6, 6, by - 150); strut(R0, 6, by - 150); wing(L0 - 40, 34, by - 157, 15); wing(R0 + 6, 34, by - 157, 15); }
    if (s.power === 'solar_s') { strut(L0 - 5, 5, by - 150); strut(R0, 5, by - 150); wing(L0 - 19, 14, by - 156, 14); wing(R0 + 5, 14, by - 156, 14); }
    if (s.payload === 'radar') {
      // dipole booms right across the rocket, red tips
      for (const [x0, w] of [[L0 - 44, 44], [R0, 44]]) { R(x, x0, by - 112, w, 2, '#8a92a2'); R(x, x0, by - 112, w, 1, '#c8ccd4'); }
      R(x, L0 - 46, by - 114, 2, 6, '#ff5a50'); R(x, R0 + 44, by - 114, 2, 6, '#ff5a50');
    }
  }
  function partsFront(x, s, cx, by) {
    const L0 = cx - 24, R0 = cx + 24;
    // power: a finned generator or a taped scrap cell on the left shoulder
    if (s.power === 'rtg') {
      const x0 = L0 - 11, y0 = by - 166;
      R(x, x0 + 8, y0 + 8, 4, 3, '#8a92a2');
      R(x, x0, y0, 9, 26, '#4a5262'); R(x, x0, y0, 2, 26, '#7a8292'); R(x, x0 + 8, y0, 1, 26, '#2a3040'); R(x, x0 + 1, y0 - 2, 7, 2, '#8a92a2');
      for (let y = y0 + 3; y < y0 + 25; y += 4) { R(x, x0 - 3, y, 15, 1, '#3a4252'); R(x, x0 - 3, y, 3, 1, '#6a7282'); R(x, x0 - 4, y, 1, 1, '#ff7a3c'); }
      R(x, x0 + 2, y0 + 10, 5, 5, '#e8c547'); R(x, x0 + 4, y0 + 12, 1, 1, '#1a1a1a');
    }
    if (s.power === 'sal_power') {
      const x0 = L0 - 13, y0 = by - 164;
      R(x, x0 + 10, y0 + 6, 3, 3, '#8a92a2'); R(x, x0, y0, 11, 15, '#8a5a3a'); R(x, x0, y0, 11, 2, '#b07a4a'); R(x, x0 + 8, y0, 3, 15, '#6a4028');
      line(x, x0, y0 + 3, x0 + 10, y0 + 13, 1, '#c8c4b0'); line(x, x0, y0 + 13, x0 + 10, y0 + 3, 1, '#c8c4b0'); R(x, x0 + 2, y0 - 2, 3, 2, '#4a5262'); R(x, x0 + 3, y0 - 3, 1, 1, '#ff5a50');
    }
    // comms on the right shoulder, under the fairing
    if (s.comms === 'dish') {
      R(x, R0, by - 168, 7, 2, '#8a92a2'); R(x, R0, by - 168, 7, 1, '#c8ccd4');
      dish(x, R0 + 14, by - 176, 12, 5, .62, '#dfe3ea', '#8a92a2', '#ffffff');
      line(x, R0 + 14, by - 176, R0 + 20, by - 184, 1, '#c8ccd4'); R(x, R0 + 20, by - 186, 2, 2, '#ff5a50');
    }
    if (s.comms === 'lga') {
      R(x, R0, by - 170, 4, 2, '#8a92a2'); R(x, R0 + 3, by - 188, 2, 20, '#8a92a2'); R(x, R0 + 3, by - 188, 1, 20, '#c8ccd4');
      for (let i = 0; i < 6; i++) { R(x, R0 + 4 - 1 - (i >> 1), by - 196 + i, 2 + (i >> 1) * 2 + 1, 1, '#e8ecf2'); R(x, R0 + 4 + (i >> 1), by - 196 + i, 1, 1, '#b4bcca'); }
      for (let y = by - 186; y < by - 170; y += 3) R(x, R0 + 1, y, 6, 1, '#c8a46e');
    }
    if (s.comms === 'laser') {
      R(x, R0, by - 168, 5, 3, '#8a92a2');
      for (let i = 0; i < 12; i++) R(x, R0 + 3 + i, by - 172 - i, 4, 4, i < 3 ? '#8a92a2' : '#e8ecf2');
      for (let i = 0; i < 12; i++) R(x, R0 + 6 + i, by - 170 - i, 1, 1, '#b4bcca');
      R(x, R0 + 15, by - 187, 4, 4, '#4a1414'); R(x, R0 + 16, by - 186, 3, 3, '#ff5a50'); R(x, R0 + 16, by - 186, 1, 1, '#ffd0c8');
    }
    if (s.comms === 'sal_comms') {
      R(x, R0, by - 168, 4, 3, '#8a5a3a'); line(x, R0 + 3, by - 168, R0 + 7, by - 176, 1, '#c8ccd4'); line(x, R0 + 7, by - 176, R0 + 3, by - 183, 1, '#c8ccd4'); line(x, R0 + 3, by - 183, R0 + 8, by - 190, 1, '#c8ccd4');
      R(x, R0 + 8, by - 192, 2, 2, '#ff5a50'); R(x, R0 + 2, by - 172, 4, 2, '#c8c4b0');
    }
    // payload on the left, under the slot stripes
    if (s.payload === 'camera') {
      const x0 = L0 - 13, y0 = by - 116;
      R(x, x0, y0, 13, 11, '#3a4252'); R(x, x0, y0, 13, 2, '#6a7282'); R(x, x0, y0 + 10, 13, 1, '#e6b946');
      R(x, x0 - 3, y0 + 2, 4, 7, '#1a2030'); R(x, x0 - 2, y0 + 3, 2, 5, '#2f5fc8'); R(x, x0 - 2, y0 + 3, 1, 2, '#a8c8ff'); R(x, x0 + 8, y0 - 2, 3, 2, '#ff5a50');
    }
    if (s.payload === 'spectro') {
      const x0 = L0 - 15, y0 = by - 118;
      R(x, x0, y0, 15, 12, '#c8ccd4'); R(x, x0, y0, 15, 1, '#f2f4f8'); R(x, x0, y0, 1, 12, '#f2f4f8'); R(x, x0 + 12, y0, 3, 12, '#8a92a2');
      R(x, x0 + 2, y0 + 3, 10, 5, '#2a3040'); ['#ff5a50', '#ff9a3c', '#ffd23c', '#6edc82', '#46d2e6', '#4a7ad8', '#a078ff'].forEach((c, i) => R(x, x0 + 3 + i, y0 + 4, 1, 3, c));
      R(x, x0 + 3, y0 - 4, 6, 4, '#e8ecf2'); R(x, x0 + 3, y0 - 3, 2, 2, '#2f5fc8'); R(x, x0, y0 + 10, 15, 1, '#e6b946');
    }
    if (s.payload === 'radar') { R(x, L0 - 9, by - 118, 9, 12, '#c8ccd4'); R(x, L0 - 9, by - 118, 9, 1, '#f2f4f8'); R(x, L0 - 3, by - 118, 3, 12, '#8a92a2'); R(x, L0 - 8, by - 108, 7, 1, '#e6b946'); }
    if (s.payload === 'sal_payload') {
      const x0 = L0 - 13, y0 = by - 118;
      R(x, x0, y0, 13, 13, '#8a5a3a'); R(x, x0, y0, 13, 2, '#b07a4a'); R(x, x0 + 10, y0, 3, 13, '#6a4028'); R(x, x0 + 3, y0 + 4, 5, 5, '#3a5a88'); R(x, x0 + 4, y0 + 5, 1, 1, '#c8d8f0'); R(x, x0 + 7, y0 + 1, 3, 9, '#c8c4b0');
    }
    // the engine bell under the rocket says which motor it is
    const p = s.prop, ny = by + 6;
    if (p === 'chem') for (let i = 0; i < 12; i++) { const hw = Math.round(7 + i * .55); R(x, cx - hw, ny + i, hw * 2, 1, '#c07a3a'); R(x, cx - hw, ny + i, 2, 1, '#e8a868'); R(x, cx + hw - 3, ny + i, 3, 1, '#8a4e22'); if (i === 11) R(x, cx - hw, ny + i, hw * 2, 1, '#5a3010'); }
    else if (p === 'ion') { R(x, cx - 15, ny, 30, 7, '#4a5262'); R(x, cx - 13, ny + 1, 26, 5, '#3ab4e6'); for (let X = cx - 12; X < cx + 13; X += 2) R(x, X, ny + 2 + ((X >> 1) & 1) * 2, 1, 1, '#1a5a8a'); R(x, cx - 12, ny + 1, 6, 1, '#9ae8ff'); }
    else if (p === 'sal_prop') { for (let i = 0; i < 11; i++) { const hw = Math.round(6 + i * .55 + (i > 7 ? 1 : 0)); R(x, cx - hw, ny + i, hw * 2, 1, '#6a4028'); R(x, cx - hw, ny + i, 2, 1, '#8a5a3a'); } R(x, cx - 9, ny + 4, 18, 3, '#c8c4b0'); }
    else for (let i = 0; i < 10; i++) { const hw = Math.round(7 + i * .6); R(x, cx - hw, ny + i, hw * 2, 1, '#5a6272'); R(x, cx - hw, ny + i, 2, 1, '#8a92a2'); R(x, cx + hw - 3, ny + i, 3, 1, '#3a4252'); }
  }
  // the rocket's lower body in the colours of its own flame: dithered in from the base
  function litCopy(c, rows) {
    const w = c.width, h = c.height, a = c.getContext('2d').getImageData(0, 0, w, h).data, y0 = h - rows;
    return paint(w, h, (X, y) => {
      const o = (y * w + X) * 4; if (y < y0 || !a[o + 3]) return null;
      const k = (y - y0) / rows; if (k * k * 1.3 < bayer(X, y)) return null;
      return [Math.min(255, a[o] * .62 + 120), Math.min(255, a[o + 1] * .62 + 72), Math.min(255, a[o + 2] * .62 + 30)];
    });
  }
  function rocketArt(slots) {
    const s = HS.lookSlots(slots), key = HS.SLOTS.map(k => s[k] || '-').join(',');
    if (rockets[key]) return rockets[key];
    const [c, x] = makeRead(RW, RH);
    partsBehind(x, s, RCX, RBY);
    padRocket(x, RCX, RBY, 0, 0, '#6edc82');
    partsFront(x, s, RCX, RBY);
    crisp(c);
    return (rockets[key] = { c, lit: litCopy(c, 92), nozzle: NOZZLE[s.prop] || 10, pal: s.prop === 'ion' ? FLAME.ion : s.prop === 'sal_prop' ? FLAME.rust : s.prop === 'solid' ? FLAME.solid : FLAME.chem, mach: s.prop === 'chem', smoky: s.prop === 'solid' ? 1.35 : s.prop === 'ion' ? .55 : 1 });
  }

  // the capsule the escape system throws clear, and the parachute it comes down on
  let capsule = null, chute = null;
  const capsuleArt = () => (capsule ??= (() => {
    const [c, x] = make(30, 40);
    R(x, 14, 1, 2, 12, '#8a92a2'); R(x, 14, 1, 1, 12, '#c8ccd4'); R(x, 12, 0, 6, 4, '#c84a2a'); R(x, 12, 0, 2, 4, '#e8783c'); R(x, 11, 4, 2, 2, '#4a5262'); R(x, 17, 4, 2, 2, '#4a5262');
    for (let y = 13; y < 37; y++) { const hw = Math.round(2 + (y - 13) * .5); R(x, 15 - hw, y, hw * 2, 1, '#e8ecf2'); R(x, 15 - hw, y, 2, 1, '#ffffff'); R(x, 15 + hw - 3, y, 3, 1, '#aab2c0'); }
    R(x, 11, 26, 4, 3, '#1a2030'); R(x, 12, 26, 2, 2, '#2f5fc8'); R(x, 2, 36, 26, 3, '#5a6272'); R(x, 2, 36, 26, 1, '#8a92a2');
    return crisp(c);
  })());
  const chuteArt = () => (chute ??= (() => {
    const [c, x] = make(46, 50);
    for (let y = 0; y < 16; y++) {
      const hw = Math.round(22 * Math.sqrt(1 - ((15 - y) / 16) ** 2));
      for (let X = -hw; X < hw; X++) R(x, 23 + X, y, 1, 1, (Math.floor((X + 24) / 6) % 2) ? '#e8ecf2' : '#f08c32');
      R(x, 23 - hw, y, 2, 1, y < 8 ? '#ffffff' : '#ffd0a0'); R(x, 23 + hw - 3, y, 3, 1, '#b05a20');
    }
    R(x, 1, 15, 44, 2, '#b05a20');
    for (const X of [2, 12, 23, 34, 44]) line(x, X, 17, 23, 36, 1, '#c8ccd4');
    for (let y = 36; y < 48; y++) { const hw = Math.round(2 + (y - 36) * .45); R(x, 23 - hw, y, hw * 2, 1, '#e8ecf2'); R(x, 23 + hw - 2, y, 2, 1, '#aab2c0'); }
    R(x, 18, 47, 11, 2, '#5a6272');
    return crisp(c);
  })());

  // ---------- the launch film: smoke, steam and fire worked out from the clock
  const LP = (() => {
    const r = noise(77), g = [], c = [], v = [];
    // the deflector throws the exhaust out both sides of the mount
    for (let i = 0; i < 180; i++) g.push({ t0: .26 + r() * 2.9, s: r() < .5 ? -1 : 1, v: 150 + r() * 270, up: 6 + r() * 30, r0: 4 + r() * 5, gr: 14 + r() * 22, life: 2 + r() * 1.8, j: r(), y0: r() * 12 });
    // the trail left behind the nozzle
    for (let i = 0; i < 200; i++) c.push({ t0: .62 + i * .018 + r() * .01, dx: (r() - .5) * 2, r0: 4 + r() * 4, gr: 9 + r() * 14, life: 2 + r() * .9, j: r() });
    // cold vapour boiling off the upper stage before ignition
    for (let i = 0; i < 46; i++) v.push({ t0: -1.6 + i * .045 + r() * .04, s: r() < .5 ? -1 : 1, hy: r() < .55 ? 152 : 100, v: 8 + r() * 16, r0: 1.5 + r() * 2, gr: 6 + r() * 6, life: 1.4 + r() * .7, j: r() });
    return { g: g.sort((a, b) => a.t0 - b.t0), c, v };
  })();
  const BOOM = (() => {
    const r = noise(91), fire = [], debris = [], smoke = [], flames = [];
    for (let i = 0; i < 52; i++) { const a = r() * 6.283; fire.push({ c: Math.cos(a), s: Math.sin(a) * .85, v: 40 + r() * 210, r0: 5 + r() * 8, gr: 10 + r() * 24, d: r() * .14, j: r() }); }
    for (let i = 0; i < 34; i++) { const a = -Math.PI / 2 + (r() - .5) * 2.8; debris.push({ vx: Math.cos(a) * (120 + r() * 320), vy: Math.sin(a) * (180 + r() * 340), w: 2 + ((r() * 3) | 0), h: 2 + ((r() * 2) | 0), col: ['#e8ecf2', '#e8ecf2', '#c84a2a', '#5a606c', '#aab2c0'][(r() * 5) | 0], spin: 6 + r() * 16, burn: r() < .6, j: r() }); }
    for (let i = 0; i < 44; i++) smoke.push({ t0: .25 + i * .045 + r() * .03, dx: (r() - .5) * 70, v: 40 + r() * 60, r0: 10 + r() * 8, gr: 16 + r() * 18, j: r() });
    for (let i = 0; i < 9; i++) flames.push({ x: PX - 90 + r() * 180, y: MOUNT + 4 + r() * 30, w: 3 + r() * 4, h: 6 + r() * 10, d: .2 + r() * .5 });
    return { fire, debris, smoke, flames };
  })();

  /**
   * The launch, for scene time t. o = { kUp, fail, boom, fx }: kUp is the scene's own climb curve (0 to 1, or
   * up to .32 when the build is too heavy), boom is true once the failure has blown, and fx is the scene's
   * particle burst in its old 320 x 180 space, centred on the explosion here.
   */
  CA.launch = (t, o) => {
    const x = HS.ax; reset(x);
    const fail = o.fail, f30 = Math.floor(t * 30);
    const upAt = fail ? (s) => ease(seg(s, .6, 3)) * .32 : (s) => ease(seg(s, .6, 4));
    // how far the rocket has risen (art px) and how far the camera has followed it
    const riseOf = (k) => fail ? (k / .32) * 92 : k * 1170, camOf = (k) => fail ? (k / .32) * 22 : k * 1000;
    const k = o.kUp, cam = camOf(k), rk = rocketArt(HS.S && HS.S.slots);
    const baseAt = (s) => BASE - riseOf(upAt(s));            // world y of the rocket's base at time s
    const tStop = fail ? 3 : 99;                              // nothing leaves the rocket once it has blown
    const stall = fail ? seg(t, 2.1, 3) : 0;
    const sway = (s) => fail && s > 2.1 ? Math.round(Math.sin(s * 29) * (s - 2.1) * 2.6) : 0;
    const lit = t > .25 && !o.boom;
    drawSite(x, t, cam);

    // the exhaust out of the deflector; half of it behind the rocket, half in front
    const billows = (front) => {
      for (const p of LP.g) {
        if (p.t0 > t || p.t0 > tStop || (p.j >= .5) !== front) continue;
        if (riseOf(upAt(p.t0)) > 240) continue;
        const a = t - p.t0; if (a > p.life) continue;
        const dist = p.v * (1 - Math.exp(-1.5 * a)) / 1.5;
        const X = PX + p.s * (40 + dist), Y = MOUNT + 18 + p.y0 - p.up * a * (.4 + a * .35) + cam;
        const rad = (p.r0 + p.gr * (1 - Math.exp(-1.1 * a))) * rk.smoky ** .5;
        const kind = lit && a < .3 ? 'warm' : fail && p.t0 > 2.2 ? 'dark' : p.j < .22 ? 'smoke' : 'steam';
        drawPuff(x, kind, X, Y, rad, dissolve(a / p.life));
      }
    };
    billows(false);
    // the trail: puffs left where the nozzle was, spreading and drifting on the wind
    for (const p of LP.c) {
      if (p.t0 > t || p.t0 > tStop) continue;
      if (rk.smoky < 1 && p.j > rk.smoky + .2) continue;
      const a = t - p.t0; if (a > p.life) continue;
      const X = PX + sway(p.t0) + (p.dx * 16 + 12) * a, Y = baseAt(p.t0) + rk.nozzle + 34 + 46 * (1 - Math.exp(-2 * a)) + cam;
      if (Y < -60 || Y > 800) continue;
      const kind = lit && a < .22 ? 'warm' : fail && p.t0 > 2.2 ? 'dark' : p.j < .25 ? 'smoke' : 'steam';
      drawPuff(x, kind, X, Y, (p.r0 + p.gr * Math.pow(a, .7)) * rk.smoky, dissolve(a / p.life));
    }
    drawMount(x, cam, lit ? clamp(1 - riseOf(k) / 160) * (.75 + .25 * hash(f30)) : 0);

    // the rocket, its flame and its flame-lit underside
    const by = Math.round(baseAt(t) + cam), bx = PX + sway(t) + (t > .4 && !fail ? Math.round(Math.sin(t * 61) * .8) : 0);
    if (!o.boom) {
      // vapour off the upper stage until ignition
      for (const p of LP.v) {
        const a = t - p.t0; if (a < 0 || a > p.life || p.t0 > .3) continue;
        drawPuff(x, 'steam', bx + p.s * (25 + p.v * a) + 8 * a, by - p.hy + 14 * a * a, p.r0 + p.gr * a, dissolve(a / p.life));
      }
      if (lit) {
        const ign = seg(t, .25, .6), stut = fail && t > 2.2 ? (hash(f30 * 1.7) < .18 ? 0 : .4 + .6 * hash(f30 * 2.3)) : 1;
        const len = (t < .6 ? 18 + ign * 34 : 52 + k * 70) * (.9 + .2 * hash(f30)) * stut, wid = 20 + (fail ? 0 : k * 10);
        const pal = fail && t > 2.5 ? FLAME.rust : rk.pal, top = by + rk.nozzle;
        if (len > 0) flame(x, bx, top, len, wid, t, pal, riseOf(k) < 60 ? MOUNT + 38 + Math.round(cam) : 1e9, rk.mach && t > .6);
      }
      x.drawImage(rk.c, bx - RCX, by - RBY);
      if (lit) { x.globalAlpha = .7 + .3 * hash(f30 * 1.3); x.drawImage(rk.lit, bx - RCX, by - RBY); x.globalAlpha = 1; }
      // the crew hatch light: green, they are aboard
      R(x, bx - 19, by - 97, 3, 3, OUT); R(x, bx - 18, by - 96, 2, 2, Math.sin(t * 6) > -.6 ? '#6edc82' : '#1a5a2a');
    }
    billows(true);
    // the glow of the flame on the pad, the gantry and the smoke, fading as the rocket climbs away
    if (lit) {
      const near = clamp(1 - riseOf(k) / 420);
      glow(x, bx, by + rk.nozzle + 20, 300, '255,160,80', (.5 * near + .12) * (.85 + .15 * hash(f30 * 3)));
      glow(x, bx, by + rk.nozzle + 6, 70, '255,230,170', .55);
    }

    // ---- the overweight failure: a fireball, debris, the crew's escape and a column of smoke
    if (o.boom) {
      const tb = t - 3, E = [PX + sway(3), Math.round(baseAt(3) - 96 + cam)], top3 = Math.round(baseAt(3) - 226 + cam);
      // the shock: a white flash and a ring
      if (tb < .14) drawPuff(x, 'fire0', E[0], E[1], 40 + tb * 520, dissolve(tb / .14));
      if (tb < .45) {
        const rr = 30 + tb * 620; x.globalAlpha = 1 - tb / .45;
        for (let i = 0; i < 220; i++) { const a = i / 220 * 6.283; R(x, Math.round(E[0] + Math.cos(a) * rr), Math.round(E[1] + Math.sin(a) * rr * .42), 2, 1, '#fff4d8'); }
        x.globalAlpha = 1;
      }
      // the column of smoke rising out of the fire
      for (const p of BOOM.smoke) {
        const a = tb - p.t0; if (a < 0) continue;
        drawPuff(x, p.j < .35 ? 'smoke' : 'dark', E[0] + p.dx * (.3 + a * .4), E[1] - 10 - p.v * a - 14 * a * a, p.r0 + p.gr * Math.pow(a, .8), dissolve((a - .6) / 2.4));
      }
      // the fireball: hot puffs flying out, cooling from white to red to smoke and rising
      const kinds = ['dark', 'fire2', 'fire1', 'fire0'];
      for (let pass = 0; pass < 4; pass++) for (const p of BOOM.fire) {
        const a = tb - p.d; if (a < 0) continue;
        const kk = a < .12 ? 3 : a < .4 ? 2 : a < .85 ? 1 : 0; if (kk !== pass) continue;
        const sp = p.v * (1 - Math.exp(-3 * a)) / 3;
        drawPuff(x, kinds[kk], E[0] + p.c * sp, E[1] + p.s * sp - 30 * a * a, p.r0 + p.gr * (1 - Math.exp(-3.5 * a)) + a * 6, dissolve((a - 1.1) / 1.5));
      }
      // debris on smoking arcs; burning bits keep burning where they land
      const gAt = (X) => MOUNT + 14 + Math.round(Math.abs(X - PX) * .06) + Math.round(cam);
      for (const p of BOOM.debris) {
        const pos = (a) => [E[0] + p.vx * a, E[1] + p.vy * a + 240 * a * a];
        let a = tb, [X, Y] = pos(a); const gy = gAt(X);
        let down = false;
        if (Y > gy) { down = true; let lo = 0, hi = a; for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (pos(m)[1] > gAt(pos(m)[0])) hi = m; else lo = m; } a = lo; [X, Y] = pos(a); }
        for (let i = 1; i < 9; i++) { const b = a - i * .035; if (b < 0) break; const [tx, ty] = pos(b); x.globalAlpha = (1 - i / 9) * .7; R(x, Math.round(tx), Math.round(ty), 1, 1, i < 2 && p.burn ? '#ffb43c' : '#4a464c'); }
        x.globalAlpha = 1;
        const turn = !down && Math.floor(a * p.spin) % 2, w = turn ? p.h : p.w, h = turn ? p.w : p.h;
        R(x, Math.round(X) - 1, Math.round(Y) - 1, w + 2, h + 2, OUT); R(x, Math.round(X), Math.round(Y), w, h, p.col);
        if (p.burn) { if (down) fire(x, Math.round(X) + 1, Math.round(Y) - 1, 3, 6, t, p.j * 9); else R(x, Math.round(X) + w, Math.round(Y) - 1, 1, 1, hash(f30 + p.j * 50) > .4 ? '#ffd27a' : '#ff7a2a'); }
      }
      // the mount burns
      for (const p of BOOM.flames) if (tb > p.d) fire(x, Math.round(p.x), Math.round(p.y + cam), Math.round(p.w), p.h, t, p.x);
      // the scene's own burst of sparks, scaled from its 320 x 180 space to here
      for (const p of o.fx.a) { x.globalAlpha = clamp(p.life / p.max * 1.6); R(x, Math.round(E[0] + (p.x - 160) * 4), Math.round(E[1] + (p.y - 96) * 4), 2, 2, p.col); }
      x.globalAlpha = 1;
      // the escape motor carries the capsule clear; it comes back down under its parachute
      if (tb < 1.3) {
        const cx = Math.round(PX + 150 * tb + 20 * tb * tb), cy = Math.round(top3 - 560 * tb + 150 * tb * tb), C = capsuleArt();
        if (tb < 1) flame(x, cx - 3, cy + 4, 18 + 6 * hash(f30), 5, t, FLAME.solid);
        x.drawImage(C, cx - 16, cy - 2);
      } else {
        const a = tb - 1.3, C = chuteArt();
        x.drawImage(C, Math.round(1090 + Math.sin(a * 2.2) * 5) - 24, Math.round(-56 + a * 100));
      }
      glow(x, E[0], E[1], 380, '255,150,70', clamp(.85 * Math.exp(-tb * 1.4) + .12) * (.85 + .15 * hash(f30 * 5)));
    }
  };

  // ---------- the landing: Mars or the Moon in the film's layers, and the lander coming down
  const worlds = {}, horizons = {};
  let earthLand = null;
  function worldArt(kind) {
    if (worlds[kind]) return worlds[kind];
    const mars = kind === 'mars', r = noise(mars ? 61 : 67);
    // the sky (2 x 2): Mars by day is butterscotch, with the blue glow dust gives round the small Sun
    const g = mars ? gradient([[0, '#2c1e24'], [.3, '#523632'], [.6, '#946248'], [.85, '#c48e68'], [1, '#d8aa82']]) : gradient([[0, '#010206'], [.7, '#03050b'], [1, '#070912']]);
    const sky2 = paint(640, 360, (X, y) => {
      let col = g(y / 359);
      if (mars) { const d = Math.hypot(X - 104, y - 54); col = mix(col, [150, 174, 200], Math.exp(-d / 24) * .75); }
      return q5(col, X, y);
    });
    const [sky, sx] = make(1280, 720); sx.drawImage(sky2, 0, 0, 1280, 720);
    if (mars) {
      // the Sun's disc, 1 x 1
      for (let y = -6; y <= 6; y++) { const hw = Math.round(Math.sqrt(36.5 - y * y)); R(sx, 209 - hw, 109 + y, hw * 2 + 1, 1, y < -2 ? '#ffffff' : '#f2f6fa'); }
    } else {
      const rs = noise(13);
      for (let i = 0; i < 520; i++) { const v = (60 + Math.pow(rs(), 2) * 195) | 0, X = (rs() * 1280) | 0, Y = (rs() * 470) | 0; R(sx, X, Y, 1, 1, `rgb(${v},${v},${Math.min(255, v + 30)})`); }
    }
    // far mesas (Mars) or crater rims (Moon), 2 x 2, with plain below so the descent never shows a gap
    const top = new Float32Array(640);
    { let X = 0, hcur = 30; while (X < 640) {
      const flat = 16 + r() * 60, ht = mars ? 14 + r() * 44 : 10 + r() * 30, ramp = mars ? 3 + r() * 6 : 16 + r() * 22;
      for (let k = 0; k < ramp && X < 640; k++, X++) top[X] = hcur + (ht - hcur) * (mars ? k / ramp : L.ease(k / ramp));
      for (let k = 0; k < flat && X < 640; k++, X++) top[X] = ht + (mars ? (r() < .2 ? 1 : 0) : Math.sin(k * .2) * 2);
      hcur = ht;
    } }
    const MB = 100;
    const mesas = paint(640, 150, (X, y) => {
      const t0 = Math.round(MB - top[X]); if (y < t0) return null;
      const litE = X > 0 && top[X] > top[X - 1] + .3, shE = X > 0 && top[X] < top[X - 1] - .3;
      if (y >= MB) return q5(mars ? mix(hex('#a26e52'), hex('#8e5a40'), clamp((y - MB) / 50)) : mix(hex('#5a5a62'), hex('#4a4a52'), clamp((y - MB) / 50)), X, y);
      let col = mars ? ((y - t0) % 7 < 2 ? '#a06a52' : '#946048') : '#4a4a52';
      if (litE) col = mars ? '#c88e6e' : '#a8a8b0';
      if (shE) col = mars ? '#7a4e3c' : '#26262c';
      if (y === t0) col = mars ? '#d8a07e' : '#c0c0c8';
      const c = hex(col);
      return mars ? css2(mix(c, [210, 160, 122], .28)) : c;
    });
    // dunes or regolith swells, 2 x 2
    const dunes = paint(640, 100, (X, y) => {
      const tp = Math.round(16 + 8 * Math.sin(X / 37) + 4 * Math.sin(X / 13 + 1) + fbm2(X / 40, 0, 16, 2) * 8);
      if (y < tp) return null;
      const slope = Math.cos(X / 37) * 8 / 37 + Math.cos(X / 13 + 1) * 4 / 13;
      let col = mars ? '#a8603c' : '#626269';
      if (slope > .1 && y < tp + 6) col = mars ? '#c47a50' : '#8e8e96';
      if (slope < -.1 && y < tp + 8) col = mars ? '#82462c' : '#46464c';
      if (y === tp) col = mars ? '#d48c5e' : '#a8a8b0';
      if (y > tp + 14) return q5(mix(hex(col), mars ? [160, 92, 58] : [104, 104, 112], .5), X, y);
      return hex(col);
    });
    // the near ground, 1 x 1: regolith, rocks with three shades and an outline, craters on the Moon
    const GW = 1280, GH = 250, LZ = [640, 130];
    const [ground, gx] = make(GW, GH);
    {
      const tc = mars ? hex('#965236') : hex('#68686f'), bc = mars ? hex('#b26a42') : hex('#8a8a92');
      const at = (y) => mix(tc, bc, Math.pow(y / GH, .8));
      for (let y = 0; y < GH; y++) R(gx, 0, y, GW, 1, css(at(y)));
      for (let i = 0; i < 16000; i++) { const X = (r() * GW) | 0, Y = (r() * GH) | 0, k = r() < .5 ? 1.1 : .9; R(gx, X, Y, r() < .2 ? 2 : 1, 1, css(at(Y).map(v => v * k))); }
      const clear = (X, Y, m = 0) => Math.abs(X - LZ[0]) > 190 + m || Math.abs(Y - LZ[1]) > 46 + m;
      if (mars) {
        // wind ripples
        for (let n = 0; n < 60; n++) { const Y = 8 + r() * (GH - 10), X = r() * GW, w = 10 + r() * 30 * (Y / GH + .4); if (!clear(X, Y)) continue; R(gx, X, Y, w, 1, css(at(Y).map(v => v * 1.14))); R(gx, X + 2, Y + 1, w - 4, 1, css(at(Y).map(v => v * .86))); }
      } else {
        // craters, crisp: the wall nearer the light in shadow, the far wall and the rim lit
        for (let n = 0; n < 34; n++) {
          const Y = 10 + Math.pow(r(), .7) * (GH - 20), X = r() * GW, s = (4 + Math.pow(r(), 2) * 34) * (.4 + Y / GH * 1.1), ry = s * (.24 + Y / GH * .16);
          if (!clear(X, Y, s)) continue;
          for (let yy = Math.floor(-ry * 1.4); yy <= Math.ceil(ry * 1.4); yy++) for (let xx = Math.floor(-s * 1.4); xx <= Math.ceil(s * 1.4); xx++) {
            const e = (xx / s) ** 2 + (yy / ry) ** 2, v = -(xx / s) * .6 - (yy / ry) * .8, base = at(Y + yy);
            let col = null;
            if (e < .8) col = v > .1 ? base.map(c => c * .42) : v < -.4 ? base.map(c => c * 1.22) : base.map(c => c * .86);
            else if (e < 1) col = v > -.1 ? base.map(c => c * 1.3) : base.map(c => c * .7);
            else if (e < 1.5 && bayer(xx & 3, yy & 3) > .55 + (e - 1) && hash(xx * 3 + yy * 7 + n) > .5) col = base.map(c => c * 1.12);
            if (col) R(gx, Math.round(X + xx), Math.round(Y + yy), 1, 1, css(col.map(c => Math.min(255, c))));
          }
        }
      }
      const sh = mars ? [hex('#d08a62'), hex('#9e5c3e'), hex('#683a28')] : [hex('#c8c8ce'), hex('#96969e'), hex('#62626a')], ol = mars ? '#2a1610' : '#121216';
      for (let n = 0; n < 120; n++) {
        const Y = 14 + Math.pow(r(), .6) * (GH - 22), X = r() * GW;
        const s = Math.max(3, Math.round((2 + r() * 6) * (.4 + Y / GH * 1.3))), hgt = Math.max(2, Math.round(s * (.45 + r() * .25)));
        if (!clear(X, Y, s)) continue;
        if (mars) { gx.fillStyle = 'rgba(40,14,8,.28)'; gx.fillRect(X + 1, Y, s * 1.5, 2); }
        else { gx.fillStyle = 'rgba(6,6,10,.8)'; gx.fillRect(X, Y - 1, s * 3.2, 2); }
        for (let pass = 0; pass < 2; pass++) for (let yy = 0; yy <= hgt; yy++) {
          const hw = Math.round(s * Math.sqrt(1 - Math.pow((hgt - yy) / (hgt + .01), 2)) * .5) + (pass ? 0 : 1), ry = Math.round(Y - hgt + yy);
          if (pass === 0) { R(gx, X - hw, ry - 1, hw * 2, 2, ol); continue; }
          R(gx, X - hw, ry, hw * 2, 1, css(sh[1]));
          R(gx, X - hw, ry, Math.max(1, Math.round(hw * .7)), 1, css(yy < hgt * .6 ? sh[0] : sh[1]));
          R(gx, X + Math.round(hw * .4), ry, Math.max(0, hw - Math.round(hw * .4)), 1, css(sh[2]));
        }
      }
    }
    return (worlds[kind] = { sky, mesas, dunes, ground, LZ });
  }

  // the lander from the side: a gold-foil descent stage on four splayed legs with round foot pads, blue solar
  // wings, a small white cabin with a hatch, and the descent engine's bell. sq sinks the body (the legs take
  // the touchdown). The foot pads stand on row 90 of the sprite, and the bell's exit is at (65, 75 + sq).
  const landers = [];
  function landerArt(sq) {
    if (landers[sq]) return landers[sq];
    const [c, x] = make(130, 94);
    x.translate(1, 1);
    const o = sq;
    const leg = (ax, ay, fx, fy, cols, pad) => {
      const [hi, base, dk] = cols, mx = Math.round(lerp(ax, fx, .42)), my = Math.round(lerp(ay, fy - 2, .42));
      line(x, ax, ay, mx, my, 3, base); line(x, ax, ay, mx, my, 1, hi);   // the shock absorber
      line(x, mx, my, fx, fy - 3, 2, base); line(x, mx + 1, my, fx + 1, fy - 3, 1, dk);
      const hw = pad >> 1;
      R(x, fx - hw + 2, fy - 3, pad - 4, 1, hi); R(x, fx - hw + 1, fy - 2, pad - 2, 1, base); R(x, fx - hw, fy - 1, pad, 1, base); R(x, fx - hw, fy, pad, 1, dk);
      R(x, fx - hw + 1, fy - 2, 2, 1, hi);
    };
    // the far pair of legs, behind the stage and in its shadow
    leg(52, 58 + o, 34, 86, ['#6a7282', '#4a5262', '#323846'], 8);
    leg(76, 58 + o, 94, 86, ['#6a7282', '#4a5262', '#323846'], 8);
    // the solar wings on their struts
    for (const [x0, sx0] of [[2, 30], [96, 88]]) {
      R(x, sx0, 45 + o, 10, 3, '#8a93a3'); R(x, sx0, 45 + o, 10, 1, '#c8ccd4');
      R(x, x0, 40 + o, 30, 11, '#8a93a3');
      R(x, x0 + 1, 41 + o, 28, 9, '#2846a0');
      for (let X = x0 + 5; X < x0 + 29; X += 5) R(x, X, 41 + o, 1, 9, '#1d2a6a');
      R(x, x0 + 1, 45 + o, 28, 1, '#1d2a6a');
      R(x, x0 + 1, 41 + o, 28, 1, '#5a7ad8'); R(x, x0 + 1, 41 + o, 1, 9, '#4a6ac8');
      for (let i = 0; i < 4; i++) R(x, x0 + 3 + i * 6, 42 + o, 2, 1, '#8ab4e8');
      R(x, x0, 50 + o, 30, 1, '#5a6272');
    }
    // the descent engine's bell
    for (let i = 0; i < 12; i++) { const hw = Math.round(4 + i * .38); R(x, 64 - hw, 62 + o + i, hw * 2, 1, '#3a4252'); R(x, 64 - hw, 62 + o + i, 2, 1, '#6a7282'); R(x, 64 + hw - 2, 62 + o + i, 2, 1, '#262c38'); }
    R(x, 59, 73 + o, 10, 1, '#1a1e28');
    // the gold-foil descent stage: an octagon, crinkled, light from the top left
    const s0 = 38, s1 = 90, t0 = 36 + o, t1 = 62 + o;
    for (let y = t0; y < t1; y++) {
      const ch = Math.max(0, 4 - (y - t0), 4 - (t1 - 1 - y));
      for (let X = s0 + ch; X < s1 - ch; X++) {
        const u = (X - s0) / (s1 - s0), v = (y - t0) / (t1 - t0), n = hash(X * 12.9 + y * 78.2 + 3);
        let col = u < .22 ? '#c8ac68' : u > .78 ? '#8a6e34' : '#b0924c';
        if (v > .85) col = '#8a6e34';
        if (n > .9) col = u < .5 ? '#e0c888' : '#c8ac68';
        else if (n < .08) col = u < .5 ? '#8a6e34' : '#6a5224';
        if (X === 51 || X === 64 || X === 77) col = '#7a5e2c';
        if (X === 50 || X === 63 || X === 76) col = '#d8bc78';
        R(x, X, y, 1, 1, col);
      }
    }
    R(x, s0 + 4, t0, s1 - s0 - 8, 1, '#e0c888');
    R(x, s0 + 2, 48 + o, s1 - s0 - 4, 2, '#9aa2b2'); R(x, s0 + 2, 48 + o, s1 - s0 - 4, 1, '#c8ccd4');
    // the deck and the white cabin, with its hatch and window
    R(x, 36, 33 + o, 56, 3, '#5a6272'); R(x, 36, 33 + o, 56, 1, '#9aa2b2');
    R(x, 52, 12 + o, 24, 1, '#e8ecf2'); R(x, 51, 13 + o, 26, 1, '#e8ecf2'); R(x, 50, 14 + o, 28, 19, '#e8ecf2');
    R(x, 50, 14 + o, 2, 19, '#ffffff'); R(x, 52, 12 + o, 6, 1, '#ffffff'); R(x, 72, 13 + o, 6, 20, '#b4bcca'); R(x, 50, 31 + o, 28, 2, '#8a93a3');
    R(x, 57, 17 + o, 11, 15, '#4a5262'); R(x, 58, 18 + o, 9, 13, '#9aa2b2'); R(x, 58, 18 + o, 2, 13, '#b4bcca');
    R(x, 60, 19 + o, 5, 5, '#1a2a4a'); R(x, 61, 20 + o, 3, 3, '#3a6ac8'); R(x, 61, 20 + o, 1, 1, '#bfe0ff');
    R(x, 65, 26 + o, 1, 3, '#2a3040'); R(x, 58, 30 + o, 9, 1, '#6a7282');
    // RCS thruster quads, the whip antenna and a small dish
    for (const X of [46, 78]) { R(x, X, 24 + o, 4, 6, '#8a93a3'); R(x, X, 24 + o, 4, 1, '#c8ccd4'); R(x, X === 46 ? X - 1 : X + 4, 26 + o, 1, 2, '#3a4252'); }
    R(x, 54, 3 + o, 1, 10, '#8a93a3');
    R(x, 71, 6 + o, 2, 7, '#8a93a3'); dish(x, 72, 5 + o, 6, 2, -.35, '#dfe3ea', '#8a93a3', '#ffffff');
    // the near pair of legs, in front, with a ladder on the left one under the hatch
    leg(42, 58 + o, 14, 89, ['#c8ccd4', '#8a93a3', '#5a6272'], 12);
    leg(86, 58 + o, 114, 89, ['#c8ccd4', '#8a93a3', '#5a6272'], 12);
    line(x, 46, 62 + o, 26, 76, 1, '#6a7282'); line(x, 82, 62 + o, 102, 76, 1, '#6a7282');
    return (landers[sq] = crisp(c));
  }
  CA.landerArt = landerArt;

  // the dust the engine and the touchdown blast out: 1 x 1 and 2 x 1 grains in three shades
  const DUST = (() => {
    const r = noise(57), stream = [], ring = [], cloud = [];
    for (let i = 0; i < 260; i++) stream.push({ t0: 1.9 + r() * 1.2, s: r() < .5 ? -1 : 1, v: 160 + r() * 300, up: 10 + r() * 50, z: (r() - .3) * .5, x0: r() * 26, c: (r() * 3) | 0, life: .7 + r() * 1.1, w: r() < .2 ? 2 : 1 });
    for (let i = 0; i < 460; i++) { const a = r() * 6.283; ring.push({ t0: 3.02 + r() * .1, cx: Math.cos(a), cz: Math.sin(a), v: 90 + Math.pow(r(), .7) * 420, up: 20 + r() * 90, c: (r() * 3) | 0, life: 1.1 + r() * 1.5, w: r() < .25 ? 2 : 1 }); }
    for (let i = 0; i < 30; i++) cloud.push({ t0: 2.7 + r() * .5, s: r() < .5 ? -1 : 1, v: 40 + r() * 120, r0: 6 + r() * 6, gr: 10 + r() * 14, life: 1.6 + r() * 1.2, z: r() * 8 });
    return { stream, ring, cloud };
  })();

  /** the landing, for scene time t (touchdown at 3.1, as the scene's text expects); clock drives idle motion */
  CA.landing = (t, mars, clock = t) => {
    const x = HS.ax, W = worldArt(mars ? 'mars' : 'moon'); reset(x);
    const D = (1 - ease(seg(t, 0, 3))) * 320, quiet = calm();
    x.drawImage(W.sky, 0, 0);
    if (!mars) {
      for (let i = 0; i < 24; i++) { const X = (hash(i * 7.7) * 1280) | 0, Y = (hash(i * 3.3 + 1) * 420) | 0; star(x, X, Y, quiet ? .7 : .5 + .5 * Math.sin(clock * (1 + hash(i)) + i), hash(i * 5) < .2, hash(i * 9) < .3 ? 1 : 0); }
      earthLand ??= earthSphere(30);
      x.drawImage(earthLand, 990, 96);
    }
    x.drawImage(W.mesas, 0, Math.round(250 + D * .35) & ~1, 1280, 300);
    if (mars && !quiet) {
      // a dust devil wandering across the plain
      const dx = 300 + clock * 7 % 900, by = Math.round(440 + D * .35);
      for (let k = 0; k < 40; k++) { const w = 3 + k * .3, ox = Math.sin(k * .21 - clock * 3) * (2 + k * .08); x.globalAlpha = .16 * (1 - k / 40) + .04; R(x, dx + ox - w / 2, by - k * 2, w, 2, '#c49a7c'); }
      x.globalAlpha = 1;
    }
    x.drawImage(W.dunes, 0, Math.round(400 + D * .65) & ~1, 1280, 200);
    const groundY = Math.round(470 + D);
    x.drawImage(W.ground, 0, groundY);
    // the lander: from above the frame down onto its spot, drifting in from the left
    const gy = groundY + W.LZ[1], e = ease(seg(t, 0, 3.1));
    const fy = Math.round(lerp(-60, gy, e)), lx = Math.round(640 - (1 - e) * 60), alt = gy - fy;
    const burning = t < 3.1;
    // its shadow on the ground, to the right of it (light from the top left), sharper as it comes down
    if (alt < 520) HS.shadow(x, lx + Math.round(alt * .22) + 6, gy + 1, Math.round(116 - alt * .08), 7, .42 * (1 - alt / 520));
    // dust streaming out from under the plume, then the touchdown ring
    const dustCol = mars ? ['#e2ae88', '#b87a56', '#84502f'] : ['#d6d6dc', '#a6a6ae', '#72727a'];
    const grain = (X, Y, p, a) => { if (a < 0 || a > p.life) return; x.globalAlpha = a > p.life * .6 ? .55 : 1; R(x, Math.round(X), Math.round(Y), p.w, 1, dustCol[p.c]); };
    for (const p of DUST.stream) {
      const a = t - p.t0; if (a < 0 || a > p.life) continue;
      const fy0 = lerp(-60, gy, ease(seg(p.t0, 0, 3.1))), alt0 = gy - fy0;
      if (alt0 > 170 || p.t0 > 3.1) continue;
      const lx0 = 640 - (1 - ease(seg(p.t0, 0, 3.1))) * 60;
      const f = mars ? (1 - Math.exp(-2.2 * a)) / 2.2 : a, h = mars ? p.up * f * .5 - 10 * a * a : p.up * .4 * a - 70 * a * a;
      if (!mars && h < 0 && a > .1) continue;
      grain(lx0 + p.s * (10 + p.x0 + p.v * f), gy + p.z * p.v * f * .3 - Math.max(0, h), p, a);
    }
    for (const p of DUST.ring) {
      const a = t - p.t0; if (a < 0 || a > p.life) continue;
      const f = mars ? (1 - Math.exp(-1.9 * a)) / 1.9 : a, h = mars ? p.up * f * .55 - 12 * a * a : p.up * a - 80 * a * a;
      if (!mars && h < -2) continue;
      grain(lx + p.cx * (30 + p.v * f), gy + p.cz * (6 + p.v * f * .2) - Math.max(0, h), p, a);
    }
    x.globalAlpha = 1;
    if (mars) for (const p of DUST.cloud) {
      const a = t - p.t0; if (a < 0 || a > p.life) continue;
      const sp = p.v * (1 - Math.exp(-1.4 * a)) / 1.4;
      drawPuff(x, 'dust', lx + p.s * (24 + sp), gy - 4 - p.z - 10 * a, p.r0 + p.gr * Math.pow(a, .7), dissolve(a / p.life));
    }
    // the plume, then the lander; the legs take the touchdown
    const sq = t > 3.1 && t < 3.3 ? 2 : t >= 3.3 && t < 3.45 ? 1 : 0, ly = fy - 90;
    if (burning) {
      const f30 = Math.floor(t * 30), len = (26 + 20 * seg(t, 1.6, 2.8)) * (.85 + .3 * hash(f30));
      flame(x, lx, ly + 74, len, 12, t, mars ? FLAME.lander : FLAME.moonLander, gy + 2);
      // the plume spreads where it hits the ground
      if (ly + 74 + len > gy - 2) { const sp = Math.round(clamp(1 - alt / 120) * 40); R(x, lx - sp, gy - 1, sp * 2, 2, '#ffd27a'); R(x, lx - (sp >> 1), gy - 1, sp, 1, '#fff6d8'); }
      glow(x, lx, gy, 150, mars ? '255,170,100' : '190,200,255', .38 * clamp(1 - alt / 320));
    }
    x.drawImage(landerArt(sq), lx - 65, ly - 1);
    // the light under the stage from the engine, and a beacon on the whip antenna
    if (burning) glow(x, lx, ly + 72, 40, '255,220,160', .35);
    R(x, lx - 12, ly + sq, 4, 4, OUT); R(x, lx - 11, ly + 1 + sq, 2, 2, Math.sin(clock * 5) > 0 ? '#ff5a50' : '#5a1814');
    // attitude thrusters: short white puffs while it steers in
    for (const b of [.9, 1.7, 2.4]) {
      const a = t - b; if (a < 0 || a > .32) continue;
      for (let i = 0; i < 6; i++) { const s = i % 2 ? -1 : 1; x.globalAlpha = 1 - a / .32; R(x, lx + s * (17 + 40 * a + i * 2) + (s < 0 ? -1 : 0), ly + 27 + (i >> 1) - 6 * a, 1, 1, '#e8ecf2'); }
      x.globalAlpha = 1;
    }
  };

  // ---------- the report's backdrop: how the run ended, behind the panel
  CA.report = (t) => {
    const S = HS.S, e = S.ended, mars = S.mission.id === 'mars', x = HS.ax; reset(x);
    if (!e || e.phase === 'surface') CA.landing(99, mars, t);
    else if (e.phase === 'launch') {
      // the empty pad, still burning, smoke rising into the dusk
      drawSite(x, t, 0); drawMount(x, 0, 0);
      for (let i = 0; i < 40; i++) {
        const per = 4.4, a = ((t + i * per / 40) % per), j = hash(i * 3.3);
        drawPuff(x, j < .35 ? 'smoke' : 'dark', PX + (j - .5) * 40 + a * 16, MOUNT - 4 - a * 120, 6 + a * 13, dissolve(a / per));
      }
      for (const p of BOOM.flames) fire(x, Math.round(p.x), Math.round(p.y), Math.round(p.w), p.h, t, p.x);
      glow(x, PX, MOUNT, 220, '255,140,60', .3 + .06 * Math.sin(t * 9));
    } else {
      // lost in flight: the planet you never reached, below, and pieces drifting past
      drawSpace(x, t);
      const k = mars ? 'mars' : 'moon';
      horizons[k] ??= sphere(k, 470, 640, 120, 320, 500);
      x.drawImage(horizons[k], 0, 480, 1280, 240);
      for (let i = 0; i < 9; i++) {
        const X = Math.round((hash(i * 4.1) * 1400 + t * (6 + hash(i) * 10)) % 1400 - 60), Y = Math.round(hash(i * 2.7) * 460 + 40 + Math.sin(t * .4 + i) * 6), w = 3 + ((hash(i * 9) * 5) | 0), h = 2 + ((hash(i * 5) * 3) | 0), turn = Math.floor(t * (.6 + hash(i * 7))) % 2;
        R(x, X - 1, Y - 1, (turn ? h : w) + 2, (turn ? w : h) + 2, OUT); R(x, X, Y, turn ? h : w, turn ? w : h, i % 3 ? '#aab2c0' : '#e8ecf2');
      }
    }
    if (e) {
      // the run ended badly: the whole picture in a dim red cast
      x.globalCompositeOperation = 'multiply'; x.fillStyle = '#b86a64'; x.fillRect(0, 0, 1280, 720);
      x.globalCompositeOperation = 'source-over';
    }
  };
})();
