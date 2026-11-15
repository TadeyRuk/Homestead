// Homestead surface art: Mars and the Moon on the 1280 x 720 art grid (6 art pixels per world unit), drawn the
// way the campus is (js/campus.js): the ground is generated once per mission, its tone fill in 2 x 2 chunks and
// its craters, channel, ripples, pebbles and rocks at 1 x 1; every object is a 1 x 1 sprite with a dark outline,
// lit from the top left and depth-sorted with the player by js/surface.js. Nothing here touches gameplay: every
// position, radius and timer stays in world units in js/surface.js and js/world.js (HS.SURFACE, HS.LANDER).
(() => {
  const HS = window.HS, L = HS.liftoff, U = HS.U;
  const { R, hex, sprite, make, fbm2, bayer, noise } = L;
  const OUT = HS.ART_OUT;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const css = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const tone = (h, k) => css(hex(h).map((v) => clamp(v * k, 0, 255)));
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const WW = 640 * U, WH = 400 * U;                 // the whole map in art pixels, 3840 x 2400
  const LX = -.5, LY = -.62, LZ = .6;                // the one light: top left, high
  // on the stage (the window, margins included; js/art.js)
  const vis = (X, Y, w, h) => X + w > HS.AX0 && X < HS.AX1 && Y + h > HS.AY0 && Y < HS.AY1;
  const calm = () => L.calm();

  // ---------- whole-pixel drawing helpers
  const line = (x, x0, y0, x1, y1, w, col) => { const n = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) R(x, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), w, w, col); };
  const disc = (x, cx, cy, rx, ry, col) => { for (let y = -ry; y <= ry; y++) { const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / (ry + .5)) ** 2))); R(x, cx - hw, cy + y, hw * 2 + 1, 1, col); } };
  // a strut: a w-pixel bar with a lit top-left edge and a shaded bottom-right edge
  const strut = (x, x0, y0, x1, y1, w, c) => { line(x, x0, y0, x1, y1, w, c[1]); line(x, x0, y0, x1, y1, 1, c[0]); line(x, x0 + w - 1, y0 + w - 1, x1 + w - 1, y1 + w - 1, 1, c[2]); };
  // a convex polygon, filled by scanlines so the edge stays crisp
  const poly = (x, pts, col) => {
    let y0 = 1e9, y1 = -1e9; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.floor(y0); y < y1; y++) {
      let a = 1e9, b = -1e9; const yc = y + .5;
      for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; if ((p[1] <= yc && q[1] > yc) || (q[1] <= yc && p[1] > yc)) { const xx = p[0] + (yc - p[1]) / (q[1] - p[1]) * (q[0] - p[0]); a = Math.min(a, xx); b = Math.max(b, xx); } }
      if (b > a) R(x, Math.round(a), y, Math.round(b) - Math.round(a), 1, typeof col === 'function' ? col(y) : col);
    }
  };
  // a lit sphere (tanks, domes): five shades by the light
  const ball = (x, cx, cy, r, cols, ry = r) => {
    for (let y = -ry; y <= ry; y++) for (let X = -r; X <= r; X++) {
      const nx = X / (r + .3), ny = y / (ry + .3), q = nx * nx + ny * ny; if (q > 1) continue;
      const l = -nx * .55 - ny * .65 + Math.sqrt(1 - q) * .55;
      R(x, cx + X, cy + y, 1, 1, cols[l > .78 ? 0 : l > .45 ? 1 : l > .1 ? 2 : l > -.25 ? 3 : 4]);
    }
  };

  // ---------- palettes: the old maps' rust and grey, and the title film's rocks
  const PAL = {
    mars: {
      ramp: ['#3e180f', '#4f2116', '#622a1c', '#733322', '#833c28', '#91462e', '#9e5035', '#aa5b3d', '#b66847', '#c37a56', '#d29069', '#e2aa86'],
      base: 6,
      rock: ['#d9a27c', '#b47452', '#8a5038', '#62342a', '#45231c'], rockOut: '#2a120c',
      dust: ['#ecc49c', '#d4a078', '#b88058', '#94603f']
    },
    moon: {
      ramp: ['#16161b', '#222228', '#2e2e35', '#3b3b42', '#48484f', '#55555c', '#626269', '#6f6f76', '#7c7c83', '#8a8a91', '#99999f', '#aaaab0', '#bdbdc3', '#d2d2d7'],
      base: 8,
      rock: ['#dcdce2', '#aeaeb6', '#83838b', '#5a5a63', '#3c3c44'], rockOut: '#141418',
      dust: ['#dadae0', '#b4b4bc', '#8e8e96', '#6a6a72']
    }
  };
  const GOLD = ['#f4e0a8', '#e2c888', '#c8ac68', '#b0924c', '#8a6e34', '#5e4a22'];
  const WHITE = ['#ffffff', '#e8ecf2', '#c8ccd4', '#b4bcca', '#8a93a3'];
  const STEEL = ['#d8dce4', '#9aa2b2', '#5a6272'];
  const CRY = ['#effffb', '#86f5e4', '#33c6b2', '#127a70'], CRYD = ['#b4c2c0', '#879896', '#5e6e6e', '#3e4a4c'];
  const PANEL = ['#8ab4e8', '#4a6ad0', '#2846a0', '#1d2a5a'];

  // the craters the old maps had, a few more for the Moon, and small ones scattered round them
  const CRATERS = {
    mars: [[500, 100, 40], [190, 300, 22], [90, 200, 14], [420, 330, 16], [600, 60, 12], [250, 60, 10], [604, 262, 9], [352, 26, 8], [150, 380, 9]],
    moon: [[500, 100, 40], [190, 300, 22], [90, 200, 14], [420, 330, 16], [600, 60, 12], [250, 60, 10], [330, 110, 18], [120, 340, 12], [560, 270, 20], [40, 40, 16]]
  };
  // where nothing small should clutter the ground: every spot an object can stand on, and the lander
  function keepouts(id) {
    const D = HS.SURFACE[id], k = [[HS.LANDER.x, HS.LANDER.y, 42]];
    for (const [x, y] of D.rich.concat(D.poor, D.sample, D.deploy)) k.push([x, y, 15]);
    for (const [x, y] of D.rocks) k.push([x + 2, y + 2, 17]);
    for (const [x, y] of D.overlook || []) k.push([x, y, 20]);
    return k;
  }
  const kept = (ko, X, Y) => ko.some(([x, y, r]) => Math.hypot(X - x, Y - y) < r);

  // ---------- rocks: lumpy, faceted, three to five shades, lit from the top left
  function rockInto(x, ox, oy, w, h, pal, seed, o = {}) {
    const r = noise(seed), ph = r() * 6.28, ph2 = r() * 6.28, facets = o.facets || 5 + ((r() * 3) | 0), a1 = .14 + r() * .12;
    const cx = (w - 1) / 2, cy = h * .56, rx = w / 2, ry = h * .56, cr = [r() - .5, r() - .5, r() * 6];
    const inside = (X, y) => { const nx = (X - cx) / rx, ny = (y - cy) / ry, ang = Math.atan2(ny, nx), q = nx * nx + ny * ny * (ny > 0 ? 2.4 : 1); return q <= (1 + a1 * Math.sin(ang * 3 + ph) + .08 * Math.sin(ang * 5 + ph2)) * .96; };
    for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) {
      if (!inside(X, y)) continue;
      const nx = (X - cx) / rx, ny = (y - cy) / ry, ang = Math.atan2(ny, nx), rho = Math.hypot(nx, ny);
      let l;
      if (rho < (o.top || .42) && ny < .15) l = .5 - ny * .3;
      else { const fa = (Math.floor((ang + ph) * facets / 6.283) + .5) * 6.283 / facets - ph; l = -(Math.cos(fa) * .62 + Math.sin(fa) * .78) * .85 + .05; }
      l += (hash(X + seed * 31, y + seed) - .5) * (o.grain || .16);
      let i = l > .5 ? 0 : l > .12 ? 1 : l > -.3 ? 2 : 3;
      if (o.cracks && (Math.abs(nx * .8 + ny * .55 - cr[0] + .12 * Math.sin(ny * 9 + cr[2])) < .022 || Math.abs(nx * -.5 + ny * .9 - cr[1] + .1 * Math.sin(nx * 7)) < .02)) i = Math.min(4, i + 2);
      if (o.strata && (y + Math.round(Math.sin(X / 9 + ph) * 1.5)) % 7 === 0 && rho > .3) i = Math.min(pal.length - 1, i + 1);
      if (o.pits && hash(X * 3 + seed, y * 7) < .025) { i = Math.min(pal.length - 1, i + 1); if (inside(X - 1, y - 1)) R(x, ox + X - 1, oy + y - 1, 1, 1, pal[Math.max(0, i - 2)]); }
      R(x, ox + X, oy + y, 1, 1, pal[i]);
    }
    return inside;
  }
  const rockSprite = (seed, w, h, pal, out, o) => sprite(w, h, (x) => rockInto(x, 0, 0, w, h, pal, seed, o), out);
  // a cast shadow: the sprite's silhouette smeared away from the light, without the sprite itself
  function castShadow(s, len, kx = .62, ky = 1) {
    const [sil, sx] = make(s.width, s.height); sx.drawImage(s, 0, 0); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = '#000'; sx.fillRect(0, 0, s.width, s.height);
    const [c, x] = make(s.width + Math.ceil(len * kx) + 2, s.height + Math.ceil(len * ky) + 2);
    for (let k = 0; k <= len; k++) x.drawImage(sil, Math.round(k * kx), Math.round(k * ky));
    x.globalCompositeOperation = 'destination-out'; x.drawImage(sil, 0, 0);
    return c;
  }

  // ---------- the ground: tone fill at 2 x 2 chunks, then the features at 1 x 1, into one 3840 x 2400 canvas
  function buildGround(id) {
    const moon = id === 'moon', P = PAL[id], N = P.ramp.length, W = WW, H = WH, r = noise(moon ? 71 : 37), ko = keepouts(id);
    const I = new Int8Array(W * H);
    for (let by = 0; by < H / 2; by++) for (let bx = 0; bx < W / 2; bx++) {
      const n = fbm2(bx / 78, by / 78, 32, 3), m = fbm2(bx / 290 + 3, by / 290 + 5, 16, 1), f = hash(bx, by);
      let v = P.base + (n - .5) * (moon ? 5 : 5.5) + (m - .5) * (moon ? 4 : 3.4) + (f - .5) * .9 + bayer(bx, by) - .5;
      if (!moon && m < .36) v -= 1;
      const iv = Math.floor(v), o = by * 2 * W + bx * 2;
      I[o] = I[o + 1] = I[o + W] = I[o + W + 1] = iv;
    }
    // a crater: a bowl with a raised rim, shaded by its slope, with the rim's shadow cast inside
    const crater = (cx, cy, rr) => {
      const CX = cx * U, CY = cy * U, RX = rr * U, RY = rr * U * .62, big = rr >= 14, ray = moon && rr >= 16;
      const ox = moon ? .3 : .2, oy = moon ? .4 : .27, D = moon ? .9 : .6, B = moon ? .5 : .32, S = moon ? 3.4 : 2.7, ext = ray ? 3.4 : 1.6;
      const rays = ray ? Float32Array.from({ length: 512 }, (_, k) => fbm2(k / 512 * 24, cx * .1, 24, 2)) : null, ra = (dx, dy) => rays[((Math.atan2(dy, dx) / 6.283 + .5) * 511) | 0];
      for (let Y = Math.max(0, Math.floor(CY - RY * ext)); Y < Math.min(H, CY + RY * ext); Y++) for (let X = Math.max(0, Math.floor(CX - RX * ext)); X < Math.min(W, CX + RX * ext); X++) {
        const dx = (X - CX) / RX, dy = (Y - CY) / RY, d = Math.hypot(dx, dy), i = Y * W + X;
        if (d > ext) continue;
        if (d > 1.6) {   // bright rays of thrown-out rock round the big lunar craters
          const k = clamp((ra(dx, dy) - .5) * 5, 0, 1) * (1 - (d - 1.6) / (ext - 1.6));
          if (k > bayer(X >> 1, Y >> 1)) I[i] += 1;
          continue;
        }
        const bump = Math.exp(-(((d - 1.05) / .17) ** 2)), dh = (d < 1 ? 2 * D * d : 0) - B * bump * 2 * (d - 1.05) / (.17 * .17) * .17;
        const gx = dh * dx / (d || 1), gy = dh * dy / (d || 1);
        const li = (-gx * LX - gy * LY + LZ) / Math.sqrt(gx * gx + gy * gy + 1);
        let s = Math.round((li / LZ - 1) * S + bayer(X, Y) - .5);
        if (!moon && d < .55 && big) s += bayer(X >> 1, Y >> 1) < .5 ? 1 : 0;   // drifted dust on old Martian crater floors
        if (d < 1 && Math.hypot(dx - ox, dy - oy) > 1 + (moon ? 0 : (bayer(X, Y) - .5) * .1)) { I[i] = moon ? 1 : Math.min(I[i] + s, I[i] - 2); continue; }
        if (ray && d > 1.25 && d <= 1.6 && (ra(dx, dy) - .5) * 5 > bayer(X >> 1, Y >> 1)) s += 1;
        I[i] += s;
      }
    };
    for (const [cx, cy, rr] of CRATERS[id]) crater(cx, cy, rr);
    // small craters everywhere, many more on the Moon
    for (let n = 0, made = 0; n < 900 && made < (moon ? 150 : 30); n++) {
      const cx = r() * 640, cy = r() * 400, rr = moon ? 1.3 + Math.pow(r(), 2.2) * 6 : 1.8 + Math.pow(r(), 2) * 4;
      if (kept(ko, cx, cy) || CRATERS[id].some(([a, b, q]) => Math.hypot(cx - a, cy - b) < q + rr + 2)) continue;
      crater(cx, cy, rr); made++;
    }
    if (!moon) {
      // a dry channel down from the north-west: sandy floor with ripples across it, steep banks, low levees
      const pts = [[-12, 160], [30, 146], [74, 132], [118, 120], [152, 104], [186, 86], [214, 70], [232, 44], [246, 22], [256, -4]].map(([a, b]) => [a * U, b * U]);
      const Wd = 6.5 * U, M = Wd * 1.28 * 1.5, segs = []; let acc = 0;
      for (let k = 0; k < pts.length - 1; k++) { const [x0, y0] = pts[k], [x1, y1] = pts[k + 1], dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy); segs.push({ x0, y0, dx, dy, l, s0: acc, a: Math.min(x0, x1) - M, b: Math.max(x0, x1) + M, c: Math.min(y0, y1) - M, e: Math.max(y0, y1) + M }); acc += l; }
      for (let Y = 0; Y < 170 * U; Y++) for (let X = 0; X < 270 * U; X++) {
        let b2 = 1e12, sx = 0, sy = 0, al = 0;
        for (const s of segs) {
          if (X < s.a || X > s.b || Y < s.c || Y > s.e) continue;
          const t = clamp(((X - s.x0) * s.dx + (Y - s.y0) * s.dy) / (s.l * s.l), 0, 1), ex = X - s.x0 - s.dx * t, ey = Y - s.y0 - s.dy * t, d2 = ex * ex + ey * ey;
          if (d2 < b2) { b2 = d2; sx = ex; sy = ey; al = s.s0 + t * s.l; }
        }
        if (b2 > M * M) continue;
        const best = Math.sqrt(b2), wob = Wd * (1 + .18 * Math.sin(al / 70) + .1 * Math.sin(al / 23));
        if (best > wob * 1.5) continue;
        const dn = best / wob, i = Y * W + X;
        const bump = Math.exp(-(((dn - 1.08) / .14) ** 2)), dh = (dn < 1 ? 3.2 * dn ** 3 : 0) - .3 * bump * 2 * (dn - 1.08) / (.14 * .14) * .14;
        const gx = dh * sx / (best || 1), gy = dh * sy / (best || 1);
        const li = (-gx * LX - gy * LY + LZ) / Math.sqrt(gx * gx + gy * gy + 1);
        let s = Math.round((li / LZ - 1) * 2.6 + bayer(X, Y) - .5);
        if (dn < .62) { s += 1; const ph = al / 11 + Math.sin(dn * 4) * .5, fr = ph - Math.floor(ph); if (fr < .13) s += 1; else if (fr < .27) s -= 1; }
        I[i] = P.base + s + (I[i] - P.base > 1 ? 1 : 0);
      }
      // dune ripple fields: crests catch the light, their lee sides fall in shade
      for (const [cx, cy, rx, ry] of [[420, 300, 64, 40], [150, 230, 56, 36], [565, 140, 46, 36], [300, 352, 70, 30], [52, 280, 34, 48], [372, 60, 58, 28], [470, 205, 30, 26]]) {
        const CX = cx * U, CY = cy * U, RX = rx * U, RY = ry * U;
        for (let Y = Math.max(0, CY - RY | 0); Y < Math.min(H, CY + RY); Y++) for (let X = Math.max(0, CX - RX | 0); X < Math.min(W, CX + RX); X++) {
          const q = 1 - ((X - CX) / RX) ** 2 - ((Y - CY) / RY) ** 2;
          if (q <= 0 || q * 2.4 < bayer(X >> 1, Y >> 1)) continue;
          const ph = (X * .94 + Y * .34) / 10 + Math.sin((Y * .94 - X * .34) / 41) * 1.1 + Math.sin(X / 23 + Y / 31) * .35, fr = ph - Math.floor(ph);
          if (fr < .12) I[Y * W + X] += 1; else if (fr < .3) I[Y * W + X] -= 1;
        }
      }
    }
    // the landing blast: scoured, darker regolith in streaks under the lander, a swept ring round it
    {
      const CX = HS.LANDER.x, CY = HS.LANDER.y;
      for (let Y = (CY - 34) * U; Y < (CY + 34) * U; Y++) for (let X = (CX - 46) * U; X < (CX + 46) * U; X++) {
        const dx = X / U - CX, dy = Y / U - CY, d = Math.hypot(dx, dy * 1.25), a = Math.atan2(dy, dx), i = Y * W + X;
        const st = .55 + .45 * Math.sin(a * 23 + Math.sin(a * 7) * 2.2);
        if (d < 22) { const k = (1 - d / 22) * (moon ? 1.6 : 2.4) * st; I[i] -= Math.floor(k + bayer(X, Y)); }
        else if (d < 34) { const k = (1 - Math.abs(d - 27) / 7) * (moon ? 1.1 : .7); if (k > bayer(X >> 1, Y >> 1)) I[i] += 1; }
      }
    }
    // pebbles: a lit pixel, a body, a shadow pixel
    for (let n = 0; n < (moon ? 5200 : 6400); n++) {
      const X = 2 + ((r() * (W - 6)) | 0), Y = 2 + ((r() * (H - 6)) | 0);
      if (kept(ko, X / U, Y / U)) continue;
      const o = Y * W + X, big = r() < .35;
      I[o] += 2; I[o + 1] -= 1;
      if (big) { I[o + W] -= 1; I[o + W + 1] -= 2; I[o + 2 * W + 2] -= 1; } else I[o + W + 1] -= 1;
    }
    // into colour, through a lookup of the ramp
    const img = new ImageData(W, H), u32 = new Uint32Array(img.data.buffer);
    const lut = P.ramp.map((h) => { const [a, b, c] = hex(h); return ((255 << 24) | (c << 16) | (b << 8) | a) >>> 0; });
    for (let i = 0; i < W * H; i++) { const v = I[i]; u32[i] = lut[v < 0 ? 0 : v >= N ? N - 1 : v]; }
    const [c, x] = make(W, H);
    x.putImageData(img, 0, 0);
    // rocks, each with its shadow; more on the dark sand, a ring of thrown-out blocks round the lunar craters
    const pal = P.rock.slice(0, 4), out = P.rockOut, vars = [];
    for (let k = 0; k < 18; k++) { const s = k < 8 ? 5 + k : k < 14 ? 13 + (k - 8) * 2 : 24 + (k - 14) * 3; const sp = rockSprite(900 + k * 7 + (moon ? 50 : 0), s, Math.max(4, Math.round(s * (.6 + (k % 3) * .08))), pal, out, { grain: .12 }); vars.push({ s: sp, sh: castShadow(sp, Math.max(2, Math.round(sp.height * .5))) }); }
    const put = (X, Y, v) => { x.globalAlpha = moon ? .55 : .3; x.drawImage(v.sh, X - (v.s.width >> 1), Y - v.s.height + 2); x.globalAlpha = 1; x.drawImage(v.s, X - (v.s.width >> 1), Y - v.s.height + 1); };
    for (let n = 0, made = 0; n < 2400 && made < (moon ? 230 : 300); n++) {
      const X = r() * 640, Y = 4 + r() * 394;
      if (kept(ko, X, Y) || Y > 396) continue;
      if (!moon && fbm2(X * 3 / 290 + 3, Y * 3 / 290 + 5, 16, 1) > .5 && r() < .6) continue;
      const k = Math.pow(r(), 2.4), v = vars[Math.min(17, (k * 18) | 0)];
      put(Math.round(X * U), Math.round(Y * U), v); made++;
    }
    for (const [cx, cy, rr] of CRATERS[id]) if (rr >= 14) for (let n = 0; n < rr * 1.4; n++) {
      const a = r() * 6.283, d = 1.12 + r() * (moon ? .7 : .4), X = cx + Math.cos(a) * rr * d, Y = cy + Math.sin(a) * rr * .62 * d;
      if (X < 2 || X > 638 || Y < 4 || Y > 396 || kept(ko, X, Y)) continue;
      put(Math.round(X * U), Math.round(Y * U), vars[(r() * 12) | 0]);
    }
    return c;
  }

  // ---------- the lander: gold-foil descent stage, four splayed legs, blue wings, a white cabin with a hatch
  // 300 x 180; the ground point under the stage is at (150, 160); the antenna's feed tip is at (184, 2)
  const LANDER_AT = [150, 160], ANT_AT = [184, 2];
  function landerSprite() {
    return sprite(300, 180, (x) => {
      const leg = (x0, y0, x1, y1) => {
        const mx = Math.round(x0 + (x1 - x0) * .45), my = Math.round(y0 + (y1 - y0) * .45);
        strut(x, x0 + (x1 > x0 ? -6 : 6), y0 + 14, mx, my, 2, ['#9aa2b2', '#6a7282', '#4a5262']);   // the brace
        strut(x, x0, y0, x1, y1, 3, STEEL);
        strut(x, x0, y0, mx, my, 4, [GOLD[1], GOLD[2], GOLD[4]]);                                   // foil-wrapped upper strut
        disc(x, x1 + 1, y1 + 2, 9, 3, '#5a6272'); disc(x, x1 + 1, y1 + 1, 8, 2, '#c8ccd4'); R(x, x1 - 6, y1, 6, 1, '#f2f4f8');
      };
      // the back legs, behind everything
      leg(108, 110, 66, 138); leg(192, 110, 232, 138);
      // the wings: two panels each side on a boom
      const wing = (x0, dir) => {
        R(x, dir > 0 ? 196 : 92, 81, 12, 4, STEEL[1]); R(x, dir > 0 ? 196 : 92, 81, 12, 1, STEEL[0]);
        for (const px0 of [x0, x0 + 42]) {
          R(x, px0, 94, 40, 2, '#1a2348');
          R(x, px0, 68, 40, 26, PANEL[2]);
          for (let cy = 0; cy < 4; cy++) for (let cx = 0; cx < 6; cx++) { const X = px0 + 2 + cx * 6, Y = 70 + cy * 6; R(x, X, Y, 5, 5, PANEL[2]); R(x, X, Y, 5, 1, PANEL[1]); if ((cx + cy * 2 + (px0 >> 3)) % 7 === 0) R(x, X, Y + 1, 2, 2, PANEL[0]); }
          for (let k = 1; k < 7; k++) R(x, px0 + k * 6 + 1, 69, 1, 24, PANEL[3]);
          for (let k = 1; k < 4; k++) R(x, px0 + 1, 69 + k * 6, 38, 1, PANEL[3]);
          R(x, px0, 68, 40, 1, '#dfe3ea'); R(x, px0, 68, 1, 26, '#c8ccd4'); R(x, px0 + 39, 68, 1, 26, '#6a7282'); R(x, px0, 93, 40, 1, '#6a7282');
        }
        R(x, x0 + 40, 76, 2, 10, '#8a93a3');
      };
      wing(10, -1); wing(208, 1);
      // the descent stage: an octagonal drum of crinkled gold foil
      const oct = Array.from({ length: 8 }, (_, k) => [150 + 52 * Math.cos(k * Math.PI / 4), 86 + 18 * Math.sin(k * Math.PI / 4)]);
      const lowY = (X) => { for (let k = 0; k < 4; k++) { const [ax, ay] = oct[k], [bx, by] = oct[k + 1]; if (X <= ax && X >= bx) return ay + (by - ay) * (X - ax) / (bx - ax); } return 86; };
      for (let X = 98; X < 202; X++) {
        const yt = Math.round(lowY(X + .5)), f = X < 113 ? 1 : X < 150 ? 2 : X < 187 ? 3 : 4;
        for (let y = yt; y < yt + 36; y++) {
          const h = hash(X >> 1, (y + ((X * .35) | 0)) >> 2), k = h < .2 ? -1 : h > .82 ? 1 : 0;
          R(x, X, y, 1, 1, GOLD[clamp(f + k, 0, 5)]);
        }
        R(x, X, yt, 1, 1, GOLD[0]); R(x, X, yt + 33, 1, 3, GOLD[5]);
        if (X === 113 || X === 150 || X === 187) R(x, X, yt, 1, 33, GOLD[f + 1 > 5 ? 5 : f + 1]);
      }
      // the top deck
      poly(x, oct, (y) => GOLD[1]);
      for (let y = 68; y < 104; y++) for (let X = 98; X < 202; X++) if (hash(X >> 1, (y + X) >> 2) < .16 && ((X - 150) / 52) ** 2 + ((y - 86) / 18) ** 2 < .9) R(x, X, y, 1, 1, GOLD[0]);
      // two propellant tanks on the deck, and the thrusters on the corners
      ball(x, 117, 84, 11, WHITE, 9); ball(x, 183, 84, 11, WHITE, 9);
      for (const [X, Y] of [[103, 104], [191, 104]]) { R(x, X, Y, 6, 6, STEEL[1]); R(x, X, Y, 6, 1, STEEL[0]); R(x, X - 2, Y + 2, 2, 2, '#4a5262'); R(x, X + 6, Y + 2, 2, 2, '#4a5262'); R(x, X + 2, Y + 6, 2, 2, '#4a5262'); }
      // the crew cabin: a white drum with a hatch facing you and a docking ring on top
      const cy0 = 52, cy1 = 94;
      for (let X = 124; X < 177; X++) {
        const k = (X - 124) / 52, e = Math.round(8 * Math.sqrt(Math.max(0, 1 - ((X + .5 - 150.5) / 26.5) ** 2)));
        const col = WHITE[k < .14 ? 0 : k < .46 ? 1 : k < .74 ? 2 : k < .9 ? 3 : 4];
        R(x, X, cy0 + e, 1, cy1 - cy0, col); R(x, X, cy0 + e + 18, 1, 1, WHITE[4]); R(x, X, cy1 + e - 2, 1, 2, WHITE[4]);
      }
      disc(x, 150, cy0, 26, 8, '#f2f4f8'); for (let y = -8; y <= 8; y++) { const hw = Math.round(26 * Math.sqrt(Math.max(0, 1 - (y / 8.5) ** 2))); R(x, 150 + Math.round(hw * .35), cy0 + y, Math.max(0, hw - Math.round(hw * .35)), 1, '#d8dce4'); }
      disc(x, 150, cy0 - 1, 12, 4, '#8a93a3'); disc(x, 150, cy0 - 1, 9, 3, '#4a5262'); disc(x, 150, cy0 - 1, 6, 2, '#2a3040'); R(x, 140, cy0 - 4, 8, 1, '#c8ccd4');
      // the hatch, a porthole, and a window each side
      R(x, 139, 64, 23, 30, '#4a5262'); R(x, 141, 66, 19, 27, '#d8dce4'); R(x, 141, 66, 19, 1, '#ffffff'); R(x, 157, 66, 3, 27, '#b4bcca');
      disc(x, 150, 74, 5, 5, '#2a3040'); disc(x, 150, 74, 4, 4, '#2f5fc8'); R(x, 147, 71, 3, 2, '#a8c8ff'); R(x, 151, 76, 1, 1, '#a8c8ff');
      R(x, 155, 82, 2, 6, '#ffb43c'); R(x, 141, 89, 19, 1, '#8a93a3');
      R(x, 127, 68, 8, 6, '#2a3040'); R(x, 128, 69, 6, 4, '#3a6ab0'); R(x, 128, 69, 2, 1, '#bfe0ff');
      R(x, 166, 68, 7, 6, '#2a3040'); R(x, 167, 69, 5, 4, '#24447a');
      // the ladder from the deck to the ground
      for (let y = 106; y < 156; y += 5) R(x, 146, y, 9, 1, '#c8ccd4');
      R(x, 145, 102, 1, 55, '#9aa2b2'); R(x, 154, 102, 1, 55, '#6a7282'); R(x, 141, 156, 18, 3, '#6a7282'); R(x, 141, 156, 18, 1, '#9aa2b2');
      // the front legs
      leg(124, 128, 84, 166); leg(176, 128, 214, 166);
      // the upload antenna: a mast off the cabin roof with a small dish pointing at Earth
      strut(x, 168, 50, 172, 16, 2, ['#e8ecf2', '#9aa2b2', '#6a7282']); R(x, 166, 30, 9, 2, '#8a93a3');
      for (let y = -6; y <= 6; y++) for (let X = -9; X <= 9; X++) {
        const u = X * .87 - y * .5, v = X * .5 + y * .87; if ((u / 9) ** 2 + (v / 4.2) ** 2 > 1) continue;
        R(x, 176 + X, 12 + y, 1, 1, (u / 9) ** 2 + (v / 4.2) ** 2 > .62 ? '#8a93a3' : u < -2 ? '#ffffff' : '#d8dce4');
      }
      line(x, 176, 12, 183, 3, 1, '#c8ccd4'); R(x, 183, 1, 2, 2, '#ffffff');
    }, OUT);
  }

  // ---------- the ship from Earth that takes the crew home: 64 x 118, engine bell bottom at (32, 110)
  function shipSprite() {
    return sprite(64, 118, (x) => {
      const cyl = (y0, y1, x0, x1, cols, band) => { for (let X = x0; X < x1; X++) { const k = (X - x0) / (x1 - x0); R(x, X, y0, 1, y1 - y0, cols[k < .16 ? 0 : k < .5 ? 1 : k < .8 ? 2 : 3]); } };
      strut(x, 16, 86, 2, 112, 2, STEEL); strut(x, 46, 86, 60, 112, 2, STEEL);
      R(x, 0, 112, 7, 3, '#c8ccd4'); R(x, 57, 112, 7, 3, '#c8ccd4');
      for (let y = 98; y < 111; y++) { const hw = 6 + Math.round((y - 98) * .55); R(x, 32 - hw, y, hw * 2, 1, '#4a5262'); R(x, 32 - hw, y, 2, 1, '#8a93a3'); R(x, 32 + hw - 3, y, 3, 1, '#2a3040'); }
      cyl(84, 98, 14, 50, ['#9aa2b2', '#7a8292', '#5a6272', '#3a4252']); for (let X = 17; X < 48; X += 4) R(x, X, 86, 1, 10, '#4a5262');
      cyl(36, 84, 12, 52, WHITE); R(x, 12, 44, 40, 4, '#f08c32'); R(x, 12, 44, 8, 4, '#ffb070'); R(x, 44, 44, 8, 4, '#a85a1a');
      ['#f08c32', '#5a96f5', '#e6ebf0', '#e6b946'].forEach((c, i) => R(x, 12 + i * 10, 74, 10, 3, c));
      for (let y = 4; y < 36; y++) { const hw = 7 + Math.round((y - 4) * .42), x0 = 32 - hw; for (let X = x0; X < x0 + hw * 2; X++) { const k = (X - x0) / (hw * 2); R(x, X, y, 1, 1, WHITE[k < .18 ? 0 : k < .5 ? 1 : k < .8 ? 2 : 3]); } }
      R(x, 20, 18, 7, 6, '#1e2a48'); R(x, 21, 19, 5, 4, '#2f5fc8'); R(x, 21, 19, 2, 1, '#a8c8ff');
      R(x, 30, 16, 6, 8, '#1e2a48'); R(x, 31, 17, 4, 6, '#24447a');
      R(x, 29, 0, 6, 4, '#8a93a3'); R(x, 31, 0, 2, 1, '#ffffff');
      R(x, 6, 58, 6, 14, '#c8ccd4'); R(x, 52, 58, 6, 14, '#8a93a3');
    }, OUT);
  }

  // ---------- science sites: a crystal outcrop that glows (rich), a dull rock cluster (poor), and their scanned look
  function crystal(x, bx, by, h, w, lean, c) {
    for (let i = 0; i < h; i++) {
      const y = by - i, cx = bx + lean * i, ww = i > h - 5 ? Math.max(1, Math.round(w * (h - i) / 5)) : w, x0 = Math.round(cx - ww / 2);
      const a = Math.max(1, Math.round(ww * .34)), b = Math.max(1, Math.round(ww * .3));
      R(x, x0, y, ww, 1, c[2]); R(x, x0, y, a, 1, c[1]); if (ww > 2) R(x, x0 + ww - b, y, b, 1, c[3]);
      if (i % 5 === 2 || i === h - 1) R(x, x0, y, 1, 1, c[0]);
    }
  }
  const RICH_TIPS = [[9, 11], [22, 2], [36, 12], [14, 23], [41, 23]];
  function richSprite(id, done) {
    const P = PAL[id], c = done ? CRYD : CRY, rp = done ? P.rock.slice(1).map((h) => tone(h, .82)) : P.rock;
    return sprite(46, 40, (x) => {
      rockInto(x, 0, 20, 46, 20, rp, 7, { facets: 6 });
      crystal(x, 14, 30, 20, 6, -.25, c); crystal(x, 22, 28, 27, 8, .02, c); crystal(x, 31, 30, 19, 6, .3, c);
      crystal(x, 18, 34, 12, 5, -.4, c); crystal(x, 36, 33, 11, 4, .5, c);
      for (const [X, Y] of [[6, 31], [9, 34], [28, 35], [40, 31], [43, 33], [24, 37]]) { R(x, X, Y, 2, 1, c[1]); R(x, X, Y + 1, 1, 1, c[3]); }
    }, OUT);
  }
  function poorSprite(id, done) {
    const P = PAL[id], rp = done ? P.rock.slice(1).map((h) => tone(h, .82)) : P.rock, vein = done ? ['#6a7472', '#4a5452'] : ['#7aa49c', '#4e7a72'];
    return sprite(40, 24, (x) => {
      rockInto(x, 2, 8, 20, 15, rp, 21, { facets: 5 }); rockInto(x, 18, 4, 18, 19, rp, 33, { facets: 6 }); rockInto(x, 30, 13, 10, 10, rp, 45);
      for (const [X, Y, w] of [[8, 14, 5], [22, 11, 4], [25, 15, 3], [11, 18, 3], [33, 18, 2]]) { R(x, X, Y, w, 1, vein[0]); R(x, X + 1, Y + 1, w - 1, 1, vein[1]); }
    }, OUT);
  }
  // the survey stake left at a scanned site: a white pole and a green pennant (it flutters in Mars's thin wind)
  function stakeSprite(moon, f) {
    return sprite(16, 30, (x) => {
      R(x, 1, 2, 2, 28, '#c8ccd4'); R(x, 1, 2, 1, 28, '#ffffff'); R(x, 0, 0, 4, 2, '#8a93a3');
      if (moon) { R(x, 3, 2, 12, 1, '#c8ccd4'); R(x, 3, 3, 12, 8, '#4ac264'); R(x, 3, 3, 12, 3, '#6edc82'); R(x, 3, 9, 12, 2, '#2e8a44'); return; }
      for (let c = 0; c < 12; c++) { const hh = Math.max(1, Math.round(9 * (1 - c / 13))), oy = Math.round(Math.sin(f * 2.1 + c * .7) * 1.2) + ((9 - hh) >> 1); R(x, 3 + c, 3 + oy, 1, hh, '#4ac264'); R(x, 3 + c, 3 + oy, 1, Math.max(1, hh >> 1), '#6edc82'); R(x, 3 + c, 2 + oy + hh, 1, 1, '#2e8a44'); }
    }, OUT);
  }

  // ---------- the sample rig: a drill derrick (Mars core) or a drive-tube tripod (lunar regolith)
  // drawn in three layers so the moving head sits between the back leg and the front legs; ground point (25, 64)
  function rigParts(moon) {
    const top = moon ? 18 : 4;
    const back = sprite(50, 68, (x) => {
      strut(x, 24, top + 4, 27, moon ? 52 : 50, 2, ['#9aa2b2', '#7a8292', '#5a6272']);
      // spoil from the hole, and the sample case on the right
      for (const [X, Y, w] of [[6, 62, 9], [8, 60, 6], [9, 59, 3]]) { R(x, X, Y, w, 1, moon ? '#a6a6ae' : '#b47452'); R(x, X, Y, 1, 1, moon ? '#dcdce2' : '#d9a27c'); }
      if (moon) { R(x, 36, 52, 11, 12, '#e8ecf2'); R(x, 36, 52, 11, 3, '#ffb43c'); R(x, 36, 52, 3, 12, '#ffffff'); R(x, 44, 55, 3, 9, '#b4bcca'); R(x, 39, 58, 5, 3, '#6a6a72'); }
      else { R(x, 34, 58, 14, 6, '#9aa2b2'); R(x, 34, 58, 14, 2, '#ffb43c'); R(x, 34, 58, 2, 6, '#c8ccd4'); R(x, 37, 61, 9, 1, '#4a5262'); }
    }, OUT);
    const front = sprite(50, 68, (x) => {
      strut(x, 23, top + 4, 4, 64, 2, STEEL); strut(x, 26, top + 4, 44, 64, 2, STEEL);
      R(x, 2, 64, 6, 2, '#6a7282'); R(x, 42, 64, 6, 2, '#6a7282');
      R(x, 18, top, 14, 7, '#4a5262'); R(x, 18, top, 14, 1, '#7a8292'); disc(x, 25, top + 3, 2, 2, '#9aa2b2'); R(x, 25, top + 3, 1, 1, '#2a3040');
    }, OUT);
    const head = sprite(16, 13, (x) => {
      if (moon) { R(x, 1, 0, 14, 10, '#9aa2b2'); R(x, 1, 0, 14, 2, '#d8dce4'); R(x, 1, 0, 2, 10, '#c8ccd4'); R(x, 12, 0, 3, 10, '#6a7282'); R(x, 1, 5, 14, 2, '#ffb43c'); R(x, 4, 10, 8, 3, '#5a6272'); return; }
      R(x, 0, 0, 16, 10, '#ffb43c'); R(x, 0, 0, 16, 2, '#ffd27a'); R(x, 0, 0, 2, 10, '#ffd27a'); R(x, 13, 0, 3, 10, '#c8781e');
      for (let y = 3; y < 9; y += 2) R(x, 3, y, 9, 1, '#a8641a');
      R(x, 4, 10, 8, 3, '#6a7282'); R(x, 4, 10, 8, 1, '#9aa2b2'); R(x, 13, 3, 2, 2, '#2a3040');
    }, OUT);
    return { back, front, head, top };
  }

  // ---------- deploy sites: a weather station on Mars, a seismometer on the Moon; ten stages, then three live frames
  function stationArt(x, k, f) {
    const s = (a, b) => clamp((k - a) / (b - a), 0, 1);
    const kl = s(.12, .3), km = s(.3, .65), ka = s(.65, .85), kt = s(.85, 1);
    // pad markers on the ground
    for (const [X, Y, dx, dy] of [[4, 62, 1, 0], [4, 62, 0, 1], [43, 62, -1, 0], [43, 62, 0, 1], [4, 73, 1, 0], [4, 73, 0, -1], [43, 73, -1, 0], [43, 73, 0, -1]]) R(x, X + Math.min(0, dx * 4), Y + Math.min(0, dy * 4), dx ? 5 : 1, dy ? 5 : 1, '#e8ecf2');
    if (kl > 0) { strut(x, 23, 58, Math.round(23 - 15 * kl), 70, 1, STEEL); strut(x, 24, 58, Math.round(24 + 15 * kl), 70, 1, STEEL); strut(x, 24, 58, Math.round(24 + 3 * kl), Math.round(58 + 6 * kl), 1, STEEL); }
    const mh = Math.round(4 + 48 * km), mt = 58 - mh;
    if (km > 0) { R(x, 23, mt, 2, mh, '#c8ccd4'); R(x, 23, mt, 1, mh, '#ffffff'); for (let y = 58 - 14; y > mt; y -= 14) R(x, 22, y, 4, 1, '#6a7282'); }
    // the electronics box (it carried everything folded on top)
    R(x, 15, 54, 18, 10, '#e8ecf2'); R(x, 15, 54, 18, 2, '#ffffff'); R(x, 29, 54, 4, 10, '#b4bcca'); R(x, 15, 62, 18, 2, '#8a93a3'); R(x, 18, 58, 6, 2, '#4a5262');
    if (km === 0) { R(x, 13, 52, 22, 2, '#9aa2b2'); R(x, 13, 52, 22, 1, '#d8dce4'); R(x, 31, 50, 4, 2, '#f08c32'); }
    if (ka > 0) {
      const tl = Math.round(10 * ka); R(x, 23 - tl, mt + 20, tl, 1, '#9aa2b2'); R(x, 22 - tl, mt + 18, 3, 5, '#ffffff'); R(x, 24 - tl, mt + 18, 1, 5, '#b4bcca');
      const pw = Math.round(13 * ka); R(x, 25, mt + 30, pw, 7, PANEL[2]); R(x, 25, mt + 30, pw, 1, PANEL[0]); for (let X = 28; X < 25 + pw; X += 4) R(x, X, mt + 31, 1, 6, PANEL[3]); R(x, 25, mt + 33, 2, 1, '#9aa2b2');
    }
    if (kt > 0) {
      const vy = mt + 5; R(x, 24, vy, Math.round(11 * kt), 1, '#9aa2b2'); if (kt > .5) { R(x, 33, vy - 3, 3, 5, '#f08c32'); R(x, 33, vy - 3, 1, 5, '#ffb070'); R(x, 22, vy - 1, 2, 3, '#e8ecf2'); }
      R(x, 23, mt - 1, 2, 2, '#4a5262');
      for (let i = 0; i < 3; i++) { const a = f * 1.3 + i * 2.094, ex = Math.round(24 + Math.cos(a) * 8 * kt), ey = Math.round(mt + Math.sin(a) * 3 * kt); line(x, 24, mt, ex, ey, 1, '#9aa2b2'); R(x, ex - 1, ey - 1, 3, 3, '#e8ecf2'); R(x, ex - (Math.sin(a) > 0 ? 0 : 1), ey, 2, 1, '#4a5262'); }
    }
  }
  function seismoArt(x, k, f) {
    const s = (a, b) => clamp((k - a) / (b - a), 0, 1);
    const ko = s(.1, .3), kd = s(.3, .6), kc = s(.6, .8), kmst = s(.8, 1);
    for (const [X, Y] of [[3, 50], [40, 50], [3, 61], [40, 61]]) { R(x, X, Y, 4, 1, '#e8ecf2'); R(x, X + (X > 20 ? 3 : 0), Y + (Y > 55 ? -3 : 0), 1, 4, '#e8ecf2'); }
    // the radio box with its own little panel
    R(x, 34, 46, 12, 9, '#e8ecf2'); R(x, 34, 46, 12, 2, '#ffffff'); R(x, 43, 46, 3, 9, '#b4bcca'); R(x, 35, 43, 9, 3, PANEL[2]); R(x, 35, 43, 9, 1, PANEL[0]);
    if (kmst > 0) { const mh = Math.round(30 * kmst); R(x, 40, 46 - mh, 2, mh, '#c8ccd4'); R(x, 40, 46 - mh, 1, mh, '#ffffff'); R(x, 38, 46 - mh, 6, 1, '#8a93a3'); }
    if (kc > 0) { const n = Math.round(14 * kc); for (let i = 0; i < n; i++) R(x, 20 + i, 57 + Math.round(Math.sin(i / 14 * Math.PI) * 2), 1, 1, '#2a3040'); }
    // the packed crate, then the sensor on three feet, then the gold dome lowered over it
    if (kd < 1) {
      R(x, 9, 47 + Math.round(ko * 6), 22, 10 - Math.round(ko * 6), '#c8ccd4'); R(x, 9, 47 + Math.round(ko * 6), 22, 2, '#e8ecf2'); R(x, 27, 47 + Math.round(ko * 6), 4, 10 - Math.round(ko * 6), '#8a93a3');
      if (ko > .5) { R(x, 15, 47, 10, 8, '#7a8292'); R(x, 15, 47, 10, 2, '#9aa2b2'); R(x, 22, 47, 3, 8, '#5a6272'); R(x, 14, 55, 2, 2, '#4a5262'); R(x, 24, 55, 2, 2, '#4a5262'); }
    }
    if (kd > 0) {
      const dy = Math.round((1 - kd) * -22);
      for (let y = 0; y <= 13; y++) { const hw = Math.round(14 * Math.sqrt(Math.max(0, 1 - ((13 - y) / 13.5) ** 2))); for (let X = -hw; X < hw; X++) { const l = -X / 14 * .6 + (13 - y) / 13 * .5 - .1; R(x, 20 + X, 44 + y + dy, 1, 1, GOLD[l > .45 ? 0 : l > .2 ? 1 : l > -.05 ? 2 : l > -.3 ? 3 : 4]); } }
      for (let X = 6; X < 34; X++) R(x, X, 57 + dy, 1, 2, X < 12 ? '#e8ecf2' : X < 28 ? '#c8ccd4' : '#8a93a3');
      for (let i = 0; i < 4; i++) R(x, 9 + i * 7, 53 + dy - (i === 1 || i === 2 ? 3 : 0), 1, 1, GOLD[0]);
    }
  }

  // ---------- the overlook ridge on the Moon, its flag plain until the Earth photo is taken, and a camera tripod
  function ridgeSprite(done) {
    const P = PAL.moon;
    return sprite(108, 64, (x) => {
      rockInto(x, 0, 22, 108, 42, P.rock, 61, { facets: 7, strata: true, top: .5 });
      line(x, 26, 22, 21, 30, 1, '#4a5262'); line(x, 26, 22, 31, 30, 1, '#4a5262'); line(x, 26, 22, 27, 29, 1, '#4a5262');
      R(x, 22, 17, 10, 6, '#3a4252'); R(x, 22, 17, 10, 1, '#6a7282'); disc(x, 31, 18, 3, 3, '#1e2a48'); R(x, 31, 17, 2, 2, '#4a8ad8');
      R(x, 60, 0, 2, 30, '#c8ccd4'); R(x, 60, 0, 1, 30, '#ffffff'); R(x, 62, 1, 22, 1, '#c8ccd4');
      if (!done) { R(x, 62, 2, 22, 13, '#d8dce4'); R(x, 62, 2, 22, 2, '#ffffff'); R(x, 62, 12, 22, 3, '#b4bcca'); for (let X = 66; X < 84; X += 6) R(x, X, 4, 1, 9, '#c8ccd4'); }
      else { R(x, 62, 2, 22, 13, '#2f5fc8'); R(x, 62, 2, 22, 2, '#5a8ae8'); R(x, 62, 7, 22, 3, '#78ffdc'); R(x, 62, 13, 22, 2, '#1e3a8a'); R(x, 65, 3, 3, 3, '#ffd27a'); R(x, 66, 2, 1, 5, '#ffd27a'); R(x, 64, 4, 5, 1, '#ffd27a'); }
    }, OUT);
  }

  // ---------- small things in hand, and the map icons
  const HELD = {
    core: () => sprite(30, 9, (x) => { R(x, 0, 0, 30, 9, '#c8ccd4'); R(x, 0, 0, 30, 2, '#ffffff'); R(x, 0, 7, 30, 2, '#8a93a3'); for (let X = 6; X < 24; X += 3) R(x, X, 3, 3, 3, X % 2 ? '#a4583a' : '#7e3c28'); R(x, 6, 3, 18, 1, '#c87a56'); R(x, 0, 0, 5, 9, '#ffb43c'); R(x, 0, 0, 5, 2, '#ffd27a'); R(x, 25, 0, 5, 9, '#c8781e'); }, OUT),
    can: () => sprite(18, 17, (x) => { R(x, 1, 3, 16, 14, '#e8ecf2'); R(x, 1, 3, 3, 14, '#ffffff'); R(x, 13, 3, 4, 14, '#b4bcca'); R(x, 0, 0, 18, 4, '#ffb43c'); R(x, 0, 0, 18, 1, '#ffd27a'); R(x, 5, 7, 8, 6, '#3a3a42'); R(x, 6, 8, 6, 4, '#83838b'); R(x, 6, 8, 2, 1, '#c8c8ce'); }, OUT),
    data: () => sprite(22, 15, (x) => { R(x, 7, 0, 8, 3, '#6a7282'); R(x, 9, 1, 4, 2, '#2a3040'); R(x, 0, 3, 22, 12, '#4a5262'); R(x, 0, 3, 22, 2, '#7a8292'); R(x, 0, 3, 2, 12, '#6a7282'); R(x, 19, 3, 3, 12, '#3a4252'); R(x, 3, 8, 16, 3, '#16202e'); R(x, 4, 9, 3, 1, '#78ffdc'); R(x, 9, 9, 3, 1, '#78ffdc'); R(x, 14, 9, 3, 1, '#2a8a78'); }, OUT)
  };
  const ICONS = {
    rich: () => sprite(11, 12, (x) => { R(x, 0, 8, 11, 4, '#8a8a92'); R(x, 0, 8, 11, 1, '#b4b4bc'); for (const [X, h, l] of [[2, 6, 0], [5, 9, 0], [8, 5, 1]]) { R(x, X - l, 9 - h, 2, h, CRY[1]); R(x, X + 1 - l, 9 - h, 1, h, CRY[3]); R(x, X - l, 9 - h, 1, 1, CRY[0]); } }, OUT),
    poor: () => sprite(11, 7, (x) => { R(x, 0, 2, 6, 5, '#8a8a92'); R(x, 0, 2, 6, 1, '#b4b4bc'); R(x, 5, 0, 6, 7, '#6a6a72'); R(x, 5, 0, 6, 1, '#9a9aa2'); R(x, 7, 3, 2, 1, '#7aa49c'); R(x, 2, 4, 2, 1, '#7aa49c'); }, OUT),
    done: () => sprite(8, 12, (x) => { R(x, 0, 0, 1, 12, '#e8ecf2'); R(x, 1, 0, 7, 5, '#4ac264'); R(x, 1, 0, 7, 2, '#6edc82'); }, OUT),
    sample: () => sprite(11, 13, (x) => { line(x, 5, 2, 0, 12, 1, '#c8ccd4'); line(x, 5, 2, 10, 12, 1, '#c8ccd4'); R(x, 5, 2, 1, 11, '#8a93a3'); R(x, 3, 5, 5, 4, '#ffb43c'); R(x, 3, 5, 5, 1, '#ffd27a'); R(x, 3, 0, 5, 2, '#6a7282'); }, OUT),
    deploy: () => sprite(9, 15, (x) => { R(x, 4, 2, 1, 10, '#e8ecf2'); R(x, 1, 2, 7, 1, '#c8ccd4'); R(x, 1, 11, 7, 4, '#e8ecf2'); R(x, 1, 11, 7, 1, '#ffffff'); R(x, 6, 11, 2, 4, '#b4bcca'); R(x, 4, 0, 1, 2, '#78ffdc'); }, OUT),
    devil: () => sprite(11, 14, (x) => { for (let y = 0; y < 14; y++) { const w = 3 + Math.round((13 - y) * .45), o = Math.round(Math.sin(y * .8) * 1.2); R(x, 5 - (w >> 1) + o, 13 - y, w, 1, y % 3 ? '#d4a078' : '#ecc49c'); } }, OUT),
    overlook: () => sprite(13, 13, (x) => { R(x, 0, 9, 13, 4, '#8a8a92'); R(x, 2, 8, 9, 2, '#b4b4bc'); R(x, 6, 0, 1, 9, '#e8ecf2'); R(x, 7, 0, 5, 4, '#2f5fc8'); R(x, 7, 2, 5, 1, '#78ffdc'); }, OUT),
    lander: () => sprite(25, 13, (x) => { R(x, 0, 4, 7, 4, PANEL[2]); R(x, 18, 4, 7, 4, PANEL[2]); R(x, 0, 4, 7, 1, PANEL[1]); R(x, 18, 4, 7, 1, PANEL[1]); R(x, 7, 5, 11, 1, '#9aa2b2'); R(x, 8, 5, 9, 6, GOLD[2]); R(x, 8, 5, 9, 1, GOLD[0]); R(x, 14, 6, 3, 5, GOLD[4]); R(x, 10, 1, 5, 5, '#e8ecf2'); R(x, 10, 1, 5, 1, '#ffffff'); line(x, 9, 10, 6, 12, 1, '#c8ccd4'); line(x, 15, 10, 18, 12, 1, '#c8ccd4'); }, OUT),
    boulder: () => sprite(10, 7, (x) => { R(x, 1, 0, 8, 7, '#83838b'); R(x, 0, 2, 10, 4, '#83838b'); R(x, 1, 0, 5, 3, '#aeaeb6'); R(x, 6, 3, 4, 3, '#5a5a63'); }, OUT)
  };

  // ---------- the cache: built the first time each mission's surface is shown
  const cache = {}, common = {};
  function commonReady() {
    if (common.lander) return common;
    common.lander = landerSprite(); common.ship = shipSprite();
    common.held = {}; for (const k in HELD) common.held[k] = HELD[k]();
    common.icon = {}; for (const k in ICONS) common.icon[k] = ICONS[k]();
    // the landing-zone ring: the exact edge of the recharge area, as a list of art-pixel offsets
    const L0 = HS.LANDER, rx = 34 * Math.sqrt(1.15) * U, ry = 24 * Math.sqrt(1.15) * U, pts = [], seen = new Set();
    for (let k = 0; k < 2400; k++) { const a = k / 2400 * Math.PI * 2, X = Math.round(Math.cos(a) * rx / 2) * 2, Y = Math.round(Math.sin(a) * ry / 2) * 2, key = X + ',' + Y; if (!seen.has(key)) { seen.add(key); pts.push([X, Y, a]); } }
    common.ring = pts; common.ringAt = [L0.x * U, L0.y * U];
    // the shelter circle round a boulder: 13 world units
    const sp = [], ss = new Set();
    for (let k = 0; k < 1200; k++) { const a = k / 1200 * Math.PI * 2, X = Math.round(Math.cos(a) * 13 * U / 2) * 2, Y = Math.round(Math.sin(a) * 13 * U / 2) * 2, key = X + ',' + Y; if (!ss.has(key)) { ss.add(key); sp.push([X, Y, a]); } }
    common.shelter = sp;
    return common;
  }
  function ready(id) {
    commonReady();
    if (cache[id]) return cache[id];
    const moon = id === 'moon', A = { id, moon };
    A.ground = buildGround(id);
    A.rich = richSprite(id, false); A.richDone = richSprite(id, true); A.poor = poorSprite(id, false); A.poorDone = poorSprite(id, true);
    A.stake = [0, 1, 2].map((f) => stakeSprite(moon, f));
    A.rig = rigParts(moon);
    const dep = (k, f) => sprite(48, 76, (x) => { if (moon) { x.translate(0, 13); seismoArt(x, k, f); } else stationArt(x, k, f); }, OUT);
    A.deploy = Array.from({ length: 10 }, (_, i) => dep(i / 10, 0)); A.deployDone = [0, 1, 2].map((f) => dep(1, f));
    A.hole = sprite(10, 5, (x) => { disc(x, 5, 2, 4, 2, moon ? '#83838b' : '#b47452'); disc(x, 5, 2, 3, 1, '#16100e'); R(x, 2, 1, 2, 1, '#000'); }, moon ? '#3c3c44' : '#45231c');
    if (moon) {
      A.ridge = ridgeSprite(false); A.ridgeDone = ridgeSprite(true); A.ridgeShadow = castShadow(A.ridge, 18, .9, .7);
      A.boulders = [[96, 66, 11], [84, 60, 23], [104, 70, 41]].map(([w, h, sd]) => { const s = rockSprite(sd, w, h, PAL.moon.rock, OUT, { facets: 7, cracks: true, pits: true, grain: .2 }); return { s, sh: castShadow(s, 58, .66, 1) }; });
    } else buildStorm(A);
    // the map: the ground shrunk to the map's 880 x 550 art pixels in one smooth pass, then crisp icons on top
    const [mc, mx] = make(880, 550); mx.imageSmoothingEnabled = true; mx.imageSmoothingQuality = 'high'; mx.drawImage(A.ground, 0, 0, 880, 550); mx.imageSmoothingEnabled = false;
    const k = 880 / 640, ic = common.icon;
    if (moon) for (const [X, Y] of HS.SURFACE.moon.rocks) mx.drawImage(ic.boulder, Math.round(X * k) - 6, Math.round((Y + 4) * k) - 8);
    mx.drawImage(ic.lander, Math.round(HS.LANDER.x * k) - 13, Math.round(HS.LANDER.y * k) - 9);
    A.map = mc;
    return (cache[id] = A);
  }

  // ---------- the Martian dust storm: a haze that tiles, and a billowing wall at its leading edge
  function buildStorm(A) {
    const P = PAL.mars.dust.map(hex);
    const [h, hx] = make(256, 256), hd = hx.createImageData(256, 256), ha = hd.data;
    for (let y = 0; y < 256; y++) for (let X = 0; X < 256; X++) {
      const v = fbm2(X / 32, y / 32, 8, 3), o = (y * 256 + X) * 4, k = clamp((v - .3) * 2.2, 0, 1), c = P[k > .7 ? 1 : k > .4 ? 2 : 3];
      ha[o] = c[0]; ha[o + 1] = c[1]; ha[o + 2] = c[2]; ha[o + 3] = 255 * (k * .35 + .42 > bayer(X, y) * .2 + .45 ? .62 : .48);
    }
    hx.putImageData(hd, 0, 0); A.haze = h;
    // the wall: 160 wide (leading edge on the right), 256 tall, tiles top to bottom
    const [w, wx] = make(160, 256), wd = wx.createImageData(160, 256), wa = wd.data;
    for (let y = 0; y < 256; y++) for (let X = 0; X < 160; X++) {
      const edge = 104 + (fbm2(y / 32, 3.5, 8, 3) - .5) * 70 + Math.sin(y / 256 * Math.PI * 6) * 9, q = edge - X, o = (y * 160 + X) * 4;
      const b = fbm2(X / 16, y / 16, 16, 3), lit = fbm2(X / 16, (y - 3) / 16, 16, 3) - b;
      let c = null, a = 0;
      if (q < 0) { if (q > -26 && fbm2(X / 8, y / 8, 32, 2) > .55 + (-q / 26) * .25 && bayer(X, y) > .4) { c = P[0]; a = .45; } }
      else if (q < 3) { c = P[0]; a = 1; }
      else { const k = q < 40 ? 1 : clamp(1 - (q - 40) / 60, 0, 1); c = P[lit > .02 ? 0 : b > .55 ? 1 : b > .42 ? 2 : 3]; a = .62 + .38 * k; if (k < 1 && (1 - k) * .9 > bayer(X, y) + .1) { c = P[2]; a = .62; } }
      if (c) { wa[o] = c[0]; wa[o + 1] = c[1]; wa[o + 2] = c[2]; wa[o + 3] = a * 255; }
    }
    wx.putImageData(wd, 0, 0); A.wall = w;
    const [wf, wfx] = make(160, 256); wfx.translate(160, 0); wfx.scale(-1, 1); wfx.drawImage(w, 0, 0); A.wallL = wf;
  }

  // ---------- footprints: boot prints that the Martian wind fills in; on the Moon they stay
  let steps = [], last = null, side = 1;
  function track(p, t, moon) {
    if (!p.walk) return;
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 2.3) {
      const dx = last ? p.x - last.x : 0, dy = last ? p.y - last.y : 1, l = Math.hypot(dx, dy) || 1; side = -side;
      steps.push({ x: p.x - dy / l * side * 1.1, y: p.y + 4 + dx / l * side * .8, t, h: Math.abs(dx) > Math.abs(dy) });
      last = { x: p.x, y: p.y };
      if (steps.length > (moon ? 400 : 160)) steps.shift();
    }
  }
  function tracks(x, cam, t, moon) {
    for (const s of steps) {
      const age = t - s.t, a = moon ? 1 : 1 - age / 16; if (a <= 0) continue;
      const X = Math.round(s.x * U) - cam.ox, Y = Math.round(s.y * U) - cam.oy; if (!vis(X - 4, Y - 4, 8, 8)) continue;
      const w = s.h ? 5 : 3, hh = s.h ? 3 : 5;
      x.globalAlpha = .34 * a; R(x, X - 2, Y - 2, w, hh, '#000'); x.globalAlpha = .18 * a; R(x, X - 2, Y - 3, w, 1, '#fff'); R(x, X - 3, Y - 2, 1, hh, '#fff');
    }
    x.globalAlpha = 1;
  }

  // ---------- per frame: everything draws only if it is in the 1280 x 720 window
  const SA = HS.surfaceArt = {
    // where the antenna's data leaves the lander, in world units from HS.LANDER
    ANT: { x: (ANT_AT[0] - LANDER_AT[0]) / U, y: (ANT_AT[1] - LANDER_AT[1]) / U },
    ready,
    enter(id) { ready(id); steps = []; last = null; },
    ground(x, cam, id) { x.imageSmoothingEnabled = false; x.drawImage(ready(id).ground, cam.ox + HS.AX0, cam.oy + HS.AY0, HS.AW, HS.AH, HS.AX0, HS.AY0, HS.AW, HS.AH); },
    track, tracks,

    // the landing zone: a dashed cyan ring at the exact edge of the recharge area, brighter while you are inside
    ring(x, cam, t, inside) {
      const c = common, X0 = c.ringAt[0] - cam.ox, Y0 = c.ringAt[1] - cam.oy;
      if (!vis(X0 - 230, Y0 - 160, 460, 320)) return;
      const sh = calm() ? 0 : t * .05;
      x.globalAlpha = inside ? .75 + .25 * Math.sin(t * 5) : .7;
      for (const [X, Y, a] of c.ring) { if (((a + sh) * 70 / Math.PI) % 2 > 1.15) continue; R(x, X0 + X - 1, Y0 + Y, 2, 2, Y > 0 ? '#78ffdc' : '#5ad8bc'); }
      x.globalAlpha = 1;
    },
    // the safe circle round a boulder, shown while a flare is on its way or overhead
    shelterRing(x, cam, X, Y, t) {
      const X0 = Math.round((X + 5) * U) - cam.ox, Y0 = Math.round((Y + 6) * U) - cam.oy;
      if (!vis(X0 - 80, Y0 - 80, 160, 160)) return;
      x.globalAlpha = .65 + .35 * Math.sin(t * 6);
      for (const [dx, dy, a] of common.shelter) if ((a * 36 / Math.PI + (calm() ? 0 : t * 1.5)) % 2 < 1.1) R(x, X0 + dx - 1, Y0 + dy - 1, 2, 2, '#6edc82');
      x.globalAlpha = 1;
    },

    lander(x, cam, t, uplink, inside) {
      const s = common.lander, [ax, ay] = HS.wa(cam, HS.LANDER.x, HS.LANDER.y), X = ax - LANDER_AT[0] - 1, Y = ay - LANDER_AT[1] - 1;
      if (!vis(X, Y - 40, s.width, s.height + 60)) return;
      HS.shadow(x, ax + 14, ay + 6, 236, 40, .26);
      x.drawImage(s, X, Y);
      // the beacon on the mast, the hatch light (green while you are in the ring), and the uplink
      const on = Math.sin(t * 3) > 0;
      R(x, X + 1 + 170, Y + 1 + 26, 3, 3, on ? '#ff5a50' : '#5a1814');
      R(x, X + 1 + 148, Y + 1 + 62, 5, 2, inside ? '#6edc82' : Math.sin(t * 2) > 0 ? '#ffb43c' : '#5a4010');
      if (uplink) {
        const tx = ax + ANT_AT[0] - LANDER_AT[0], ty = ay + ANT_AT[1] - LANDER_AT[1];
        R(x, tx - 1, ty - 1, 3, 3, Math.floor(t * 8) % 2 ? '#ffffff' : '#78ffdc');
        for (let i = 0; i < 3; i++) {
          const k = ((calm() ? .5 : t * .9) + i / 3) % 1, rr = 5 + k * 26; x.globalAlpha = 1 - k;
          for (let a = -2.4; a <= -.2; a += 1.4 / rr) R(x, Math.round(tx + Math.cos(a) * rr), Math.round(ty + Math.sin(a) * rr), 1, 1, '#78ffdc');
        }
        for (let k = 0; k < 7; k++) { const q = ((calm() ? .3 : t * .55) + k / 7) % 1; x.globalAlpha = 1 - q; R(x, Math.round(tx + q * 26 + Math.sin(q * 9 + k) * 3), Math.round(ty - q * 120), 2, 2, '#78ffdc'); }
        x.globalAlpha = 1;
      }
    },

    site(x, cam, s, t, k, moon) {
      const A = cache[moon ? 'moon' : 'mars'], [ax, ay] = HS.wa(cam, s.x, s.y);
      if (!vis(ax - 50, ay - 60, 100, 90)) return;
      const rich = s.kind === 'rich', spr = s.done ? (rich ? A.richDone : A.poorDone) : rich ? A.rich : A.poor;
      HS.shadow(x, ax + 4, ay + 2, spr.width, 8, .3);
      if (rich && !s.done) {
        // the outcrop's glow and a ring that pulses outwards: valuable, scan me
        for (let i = 0; i < 2; i++) {
          const q = ((calm() ? .4 : t * .6) + i * .5) % 1, rx = 20 + q * 26, ry = rx * .38; x.globalAlpha = (1 - q) * .8;
          for (let a = 0; a < 6.283; a += 1.5 / rx) if (((a * 8 / Math.PI) | 0) % 2 === 0) R(x, Math.round(ax + Math.cos(a) * rx), Math.round(ay - 2 + Math.sin(a) * ry), 2, 1, '#78ffe6');
        }
        x.globalCompositeOperation = 'lighter'; x.globalAlpha = .1 + .06 * Math.sin(t * 3);
        for (let r = 0; r < 4; r++) { const w = 30 - r * 6, h = 20 - r * 4; for (let y = -h; y <= h; y++) { const hw = Math.round(w * Math.sqrt(1 - (y / (h + .5)) ** 2)); R(x, ax - hw, ay - 20 + y, hw * 2, 1, '#3ad8c4'); } }
        x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
      }
      if (s.done) { const st = A.stake[moon ? 0 : Math.floor(t * 6) % 3]; x.drawImage(st, ax + 10, ay - st.height + 2); }
      x.drawImage(spr, ax - (spr.width >> 1), ay - spr.height + 3);
      if (rich && !s.done) {
        const [gx, gy] = RICH_TIPS[Math.floor(t * 1.4) % 5], ph = (t * 1.4) % 1, gl = ph < .5 ? 2 : 1;
        const X = ax - 23 + gx, Y = ay - 38 + gy;
        R(x, X - gl, Y, gl * 2 + 1, 1, '#ffffff'); R(x, X, Y - gl, 1, gl * 2 + 1, '#ffffff');
      }
      if (k > 0) { x.globalAlpha = .5 + .5 * Math.sin(t * 20); R(x, ax - 1, ay - 46 - Math.round(k * 4), 3, 3, '#78ffe6'); x.globalAlpha = 1; }
    },

    // k: how far the current hold has got (0 if nobody is working it)
    sample(x, cam, smp, t, k, moon) {
      const A = cache[moon ? 'moon' : 'mars'], g = A.rig, [ax, ay] = HS.wa(cam, smp.x, smp.y), X = ax - 26, Y = ay - 65;
      if (!vis(X, Y, 60, 80)) return;
      HS.shadow(x, ax + 6, ay + 2, 48, 9, .28);
      x.drawImage(g.back, X, Y);
      if (smp.done || k > 0) x.drawImage(A.hole, ax - 6, ay - 3);
      const hy = Math.round(g.top + 7 + (smp.done ? 0 : k * (moon ? 22 : 34)));
      const rodTop = g.top + 6, rodBot = smp.done ? hy + 16 : 64;
      for (let y = rodTop; y < rodBot; y++) { const spin = k > 0 && !calm() ? Math.floor(t * 24) : 0; R(x, X + 25, Y + y, 2, 1, (y + spin) % 4 === 0 ? '#6a7282' : moon ? '#e8ecf2' : '#c8ccd4'); R(x, X + 24, Y + y, 1, 1, OUT); R(x, X + 27, Y + y, 1, 1, OUT); }
      if (moon && !smp.done) for (let y = 40; y < 64; y += 6) R(x, X + 25, Y + y, 2, 1, '#ffb43c');
      x.drawImage(g.head, X + 17, Y + hy + (k > 0 && !calm() ? Math.floor(t * 30) % 2 : 0));
      x.drawImage(g.front, X, Y);
      R(x, X + 25, Y + g.top + 1, 2, 2, smp.done ? '#6edc82' : Math.sin(t * 4) > 0 || k > 0 ? '#ffb43c' : '#5a4010');
    },

    deploy(x, cam, d, k, t, moon) {
      const A = cache[moon ? 'moon' : 'mars'], [ax, ay] = HS.wa(cam, d.x, d.y), X = ax - 25, Y = ay - 71;
      if (!vis(X, Y, 50, 80)) return;
      HS.shadow(x, ax + 4, ay + 1, 40, 8, .25);
      const s = k >= 1 ? A.deployDone[calm() ? 0 : Math.floor(t * 8) % 3] : A.deploy[Math.min(9, Math.floor(k * 10))];
      x.drawImage(s, X, Y);
      // the status light: a slow cyan blink while packed, steady green once it is working
      if (k >= 1) { if (Math.sin(t * 4) > -.3) R(x, moon ? X + 41 : X + 24, moon ? Y + 29 : Y + 4, 2, 2, '#6edc82'); }
      else if (Math.floor(t * 2) % 2 || k > 0) R(x, moon ? X + 12 : X + 20, moon ? Y + 64 : Y + 60, 2, 2, '#78ffdc');
    },

    // the dust devil: a swirling column of dust grains over its own shadow and a skirt of kicked-up dust
    devil(x, cam, d, t) {
      const [cx, cy] = HS.wa(cam, d.x, d.y), P = PAL.mars.dust;
      if (!vis(cx - 60, cy - 150, 120, 170)) return;
      HS.shadow(x, cx + 8, cy + 2, 52, 11, .28);
      const tt = calm() ? t * .3 : t;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < 46; i++) { const a = i * 2.4 + tt * 2.6, rr = 12 + (i % 6) * 3.4 + Math.sin(tt * 4 + i) * 2, front = Math.sin(a) > 0; if (front !== !!pass) continue; x.globalAlpha = .65; R(x, Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * .34), 2, 1, P[front ? 1 : 2]); }
        for (let i = 0; i < 190; i++) {
          const hf = (i * .618034) % 1, a = tt * (7 - hf * 3.4) + i * 2.39996, front = Math.sin(a) > 0;
          if (front !== !!pass) continue;
          const rr = 4 + hf * 18 + hf * hf * 12, sway = Math.sin(tt * 1.7 + hf * 3) * hf * 10, X = Math.round(cx + sway + Math.cos(a) * rr), Y = Math.round(cy - 4 - hf * 116 + Math.sin(a) * rr * .3);
          x.globalAlpha = (1 - hf * .7) * (front ? .9 : .55);
          R(x, X, Y, hf < .3 ? 2 : 1, 1, P[front ? (Math.cos(a) < 0 ? 0 : 1) : (Math.cos(a) < 0 ? 2 : 3)]);
        }
      }
      x.globalAlpha = 1;
    },

    overlook(x, cam, o, done, t) {
      const A = cache.moon, s = done ? A.ridgeDone : A.ridge, [ax, ay] = HS.wa(cam, o.x, o.y), X = ax - 62, Y = ay - s.height + 6;
      if (!vis(X - 10, Y, s.width + 40, s.height + 30)) return;
      x.globalAlpha = .55; x.drawImage(A.ridgeShadow, X + 2, Y + 18); x.globalAlpha = 1;
      x.drawImage(s, X, Y);
      if (done && Math.floor(t * 3) % 4 === 0) { R(x, X + 88, Y + 3, 1, 5, '#ffffff'); R(x, X + 86, Y + 5, 5, 1, '#ffffff'); }
    },

    boulderShadow(x, cam, X, Y, i, a = .55) {
      const b = cache.moon.boulders[i % 3], [ax, ay] = HS.wa(cam, X, Y + 4), sx = ax - (b.s.width >> 1), sy = ay - b.s.height + 4;
      if (!vis(sx, sy, b.sh.width, b.sh.height)) return;
      x.globalAlpha = a; x.drawImage(b.sh, sx, sy); x.globalAlpha = 1;
    },
    boulder(x, cam, X, Y, i) {
      const b = cache.moon.boulders[i % 3], [ax, ay] = HS.wa(cam, X, Y + 4), sx = ax - (b.s.width >> 1), sy = ay - b.s.height + 4;
      if (vis(sx, sy, b.s.width, b.s.height)) x.drawImage(b.s, sx, sy);
    },

    // the player and whatever is in their hands
    crew(x, cam, p, suit, o, held, t) {
      const [hx, hy] = HS.drawCrew(x, cam, p.x, p.y, suit, o);
      if (o.down) { if (Math.floor(t * 3) % 2) { R(x, hx - 2, hy - 8, 5, 5, OUT); R(x, hx - 1, hy - 7, 3, 3, '#ff5a50'); } return; }
      if (held) { const s = common.held[held], bob = Math.round(Math.sin(p.walk * 16)); x.drawImage(s, hx - (s.width >> 1), hy - s.height + 3 + bob); }
    },

    // the ascent ship drops in, hovers over the lander with its light on the crew, and climbs away
    ship(x, cam, ext, t) {
      const Lx = HS.LANDER.x, Ly = HS.LANDER.y, k = HS.ease(HS.seg(ext.t, 0, 2.2)), up = HS.ease(HS.seg(ext.t, 3, 5)), Y = HS.lerp(Ly - 150, Ly - 26, k) - up * 170;
      const [gx, gy] = HS.wa(cam, Lx, Ly + 6), [sx, sy] = HS.wa(cam, Lx, Y + 5), s = common.ship;
      const near = clamp(1 - (gy - sy) / 600, 0, 1);
      if (near > 0) HS.shadow(x, gx + 10, gy, 40 + near * 70, 8 + near * 12, .1 + near * .25);
      if (ext.t > 1.4 && ext.t < 3.2) {
        const k2 = Math.min(1, (ext.t - 1.4) * 3, (3.2 - ext.t) * 3);
        for (let y = sy; y < gy; y += 2) { const q = (y - sy) / Math.max(1, gy - sy), hw = Math.round(10 + q * 46); for (let X = -hw; X < hw; X += 2) if (k2 * (.5 - q * .25) > bayer((X + hw) >> 1, y >> 1) + .1) R(x, sx + X, y, 2, 2, '#78ffdc'); }
      }
      if (!vis(sx - 40, sy - 130, 80, 200)) return;
      const fl = calm() ? 1 : Math.floor(t * 20) % 3, len = 22 + fl * 6 + (ext.t > 3 ? 18 : 0);
      for (let i = 0; i < len; i += 2) { const q = i / len, fw = Math.max(2, Math.round((1 - q) * 18 + 2)), wob = calm() ? 0 : Math.round(Math.sin(t * 40 + i) * 1.4); R(x, sx - (fw >> 1) + wob, sy + 1 + i, fw, 2, q < .25 ? '#fff6d8' : q < .55 ? '#ffd27a' : q < .8 ? '#ff9a3c' : '#e8602a'); }
      x.drawImage(s, sx - 33, sy - 111);
      const on = Math.sin(t * 6) > 0; R(x, sx - 33, sy - 54, 2, 2, on ? '#ff5a50' : '#5a1814'); R(x, sx + 30, sy - 54, 2, 2, on ? '#6edc82' : '#1a5a2a');
    },

    // the storm: haze from the trailing edge, then the wall of dust at the leading edge, and grains blowing ahead
    storm(x, cam, s, t) {
      const A = cache.mars, a = Math.round((s.dir > 0 ? s.x - s.w : s.x) * U) - cam.ox, b = a + s.w * U, x0 = Math.max(HS.AX0, a), x1 = Math.min(HS.AX1, b);
      const lead = s.dir > 0 ? b : a, tt = calm() ? t * .2 : t;
      if (x1 > x0) {
        const ox = ((Math.round(tt * 70 * s.dir) % 256) + 256) % 256, oy = ((Math.round(tt * 18 + cam.oy) % 256) + 256) % 256;
        for (let band = 0; band < 10; band++) {
          // fade in over the first 240 px from the trailing edge, in 24 px steps
          const ba = s.dir > 0 ? a + band * 24 : b - (band + 1) * 24, bw = band < 9 ? 24 : 0;
          const c0 = band < 9 ? Math.max(x0, ba) : s.dir > 0 ? Math.max(x0, a + 216) : x0, c1 = band < 9 ? Math.min(x1, ba + bw) : s.dir > 0 ? x1 : Math.min(x1, b - 216);
          if (c1 <= c0) continue;
          x.save(); x.beginPath(); x.rect(c0, HS.AY0, c1 - c0, HS.AH); x.clip(); x.globalAlpha = band < 9 ? (band + 1) / 10 : 1;
          for (let X = Math.floor((c0 - ox) / 256) * 256 + ox - 256; X < c1; X += 256) for (let Yy = -oy - Math.ceil(HS.AOY / 256) * 256; Yy < HS.AY1; Yy += 256) if (X + 256 > c0) x.drawImage(A.haze, X, Yy);
          x.restore();
        }
      }
      // the wall
      const wy = ((Math.round(tt * 12 + cam.oy) % 256) + 256) % 256, wall = s.dir > 0 ? A.wall : A.wallL, wxp = s.dir > 0 ? lead - 104 : lead - 56;
      if (wxp < HS.AX1 && wxp + 160 > HS.AX0) for (let Yy = -wy - Math.ceil(HS.AOY / 256) * 256; Yy < HS.AY1; Yy += 256) x.drawImage(wall, wxp, Yy);
      // grains blowing ahead of and through the storm
      x.globalAlpha = .7;
      for (let i = 0; i < 140; i++) {
        const span = s.w * U + 220, q = ((hash(i, 7) * span + tt * (160 + hash(i, 3) * 140)) % span), X = Math.round(s.dir > 0 ? a + q : b - q), Y = HS.AY0 + Math.round((hash(i, 11) * HS.AH + tt * (20 + hash(i, 5) * 30) + HS.AH * 4) % HS.AH);
        if (X < HS.AX0 || X >= HS.AX1) continue;
        const l = 3 + ((hash(i, 13) * 8) | 0); R(x, s.dir > 0 ? X - l : X, Y, l, 1, i % 3 ? PAL.mars.dust[1] : PAL.mars.dust[0]);
      }
      x.globalAlpha = 1;
    },

    // a solar flare: hard light washing over everything except the shade, with streaks and particle hits
    flare(x, cam, t, safe, rocks) {
      x.fillStyle = `rgba(255,244,205,${safe ? .1 : .2 + (calm() ? 0 : Math.sin(t * 20) * .04)})`; x.fillRect(HS.AX0, HS.AY0, HS.AW, HS.AH);
      rocks.forEach(([X, Y], i) => SA.boulderShadow(x, cam, X, Y, i, .42));
      const tt = calm() ? 0 : t;
      x.globalAlpha = .55;
      for (let i = 0; i < 18; i++) {
        const sp = 600 + hash(i, 1) * 500, len = 60 + ((hash(i, 2) * 160) | 0), q = (tt * sp + hash(i, 3) * 2400) % 2400, X0 = Math.round(q - 600 + hash(i, 4) * 700), Y0 = Math.round(q * .62 - 400 + hash(i, 5) * 500);
        for (let k = 0; k < len; k += 2) { const X = X0 - k, Y = Y0 - Math.round(k * .62); if (X < HS.AX0 || X >= HS.AX1 || Y < HS.AY0 || Y >= HS.AY1) continue; R(x, X, Y, 2, 1, k < len * .3 ? '#ffffff' : '#fff0c0'); }
      }
      x.globalAlpha = 1;
      const f = Math.floor(tt * 12);
      for (let i = 0; i < 90; i++) { if (hash(i, f) < .5) continue; R(x, (HS.AX0 + hash(i * 3, f) * HS.AW) | 0, (HS.AY0 + hash(i * 5, f + 1) * HS.AH) | 0, 1, 1, '#ffffff'); }
    },

    mapImage: (id) => ready(id).map,
    icon: (k) => commonReady().icon[k]
  };
})();
