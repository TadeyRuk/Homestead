// Homestead art: the shared sprite library for the playable scenes, drawn on the 1280 x 720 art grid
// (src/ui/ART-RULES.md): one art pixel is one screen pixel at 1280 wide, foreground detail is 1 x 1,
// every sprite has a 1 px dark outline, light comes from the top left, and text is never part of a sprite.
// World scenes draw into HS.art (1280 x 720), which is shown pixel-crisp like the title film; the HUD is
// drawn over it at screen resolution.
(() => {
  const HS = window.HS, L = HS.liftoff;
  const { R, hex, mix, sprite, make, shade } = L;

  // ---------- the art layer and the world camera
  // one world unit (the 640 x 400 maps) is 6 art pixels; the camera snaps to 2 art pixels, so the
  // 2 x 2 ground chunks never shimmer
  const U = HS.U = 6;
  const [art, ax] = make(1280, 720);
  HS.art = art; HS.ax = ax;
  HS.blitArt = () => { const g = HS.g; g.imageSmoothingEnabled = false; g.drawImage(art, 0, 0, 640, 360); };
  HS.camera = (p) => {
    const x = HS.clamp(p.x - HS.VW / 2, 0, 640 - HS.VW), y = HS.clamp(p.y - HS.VH / 2, 0, 400 - HS.VH);
    return { x: Math.round(x * 3) / 3, y: Math.round(y * 3) / 3, ox: Math.round(x * 3) * 2, oy: Math.round(y * 3) * 2 };
  };
  // world point -> art pixel
  HS.wa = (cam, X, Y) => [Math.round(X * U) - cam.ox, Math.round(Y * U) - cam.oy];

  // ---------- palette (shared with the title film)
  const OUT = '#0a0f1c', WHITE = '#e8ecf2', WSH = '#b4bcca', WSH2 = '#8a93a3', WHI = '#ffffff';
  const G1 = '#6a7282', G2 = '#4a5262', G3 = '#3a4252', G4 = '#2a3040';
  const M0 = '#f2f4f8', M1 = '#c8ccd4', M2 = '#8a92a2', M3 = '#4a5262', M4 = '#2a3040';
  // visor tints the crew page offers: [frame, glass, sheen, glint]
  const VISORS = HS.VISORS = { gold: ['#3a2a14', '#8a5f1c', '#d8a040', '#ffe0a0'], silver: ['#1e2430', '#5a6474', '#a8b4c4', '#f0f6ff'], blue: ['#0e1a34', '#1e4a8a', '#4a8ad8', '#bfe0ff'], rose: ['#2e1424', '#8a2a5a', '#d8609a', '#ffd0e8'] };
  HS.ART_OUT = OUT;
  const css = (c) => `rgb(${c.map(v => v | 0).join(',')})`;
  const lift = (c, k) => css(mix(hex(c), [255, 255, 255], k));

  // ---------- the astronaut, 36 x 48 (38 x 50 with the outline); feet on the bottom row
  // views: front, back, side (facing right; flip for left). frames: 0 idle, 1 breathe, 2 and 3 walk
  function body(x, c, view, frame, carry, visor) {
    const [VIS0, VIS1, VIS2, VIS3] = VISORS[visor] || VISORS.gold;
    const dk = shade(c, .62), hi = lift(c, .35);
    const b = frame === 1 ? 1 : 0;                       // breathe: the top half sinks a pixel
    const st = frame === 2 ? 1 : frame === 3 ? -1 : 0;   // stride
    if (view !== 'side') {
      // legs and boots, the lifted one 2 px shorter
      const leg = (lx, up, sh) => {
        R(x, lx, 34, 6, 10 - up, WHITE); R(x, lx + 5, 34, 1, 10 - up, sh ? WSH2 : WSH);
        R(x, lx, 38 - up, 6, 2, view === 'front' ? (sh ? dk : c) : WSH);
        R(x, lx - 1, 44 - up, 8, 4, G2); R(x, lx - 1, 44 - up, 8, 1, G1); R(x, lx - 1, 46 - up, 8, 1, view === 'front' ? c : G3);
      };
      leg(11, st > 0 ? 2 : 0, false); leg(19, st < 0 ? 2 : 0, true);
      R(x, 9, 32, 18, 2, G3); R(x, 16, 32, 4, 2, view === 'front' ? c : G2);
      // torso
      R(x, 9, 18 + b, 18, 14 - b, WHITE); R(x, 23, 18 + b, 4, 14 - b, WSH); R(x, 9, 18 + b, 1, 12, WHI);
      R(x, 9, 18 + b, 4, 3, c); R(x, 23, 18 + b, 4, 3, dk);
      // arms: swing with the stride, or raised when carrying
      const arm = (axx, sw, sh) => {
        if (carry) { R(x, axx, 3, 4, 17, WHITE); R(x, axx + 3, 3, 1, 17, sh ? WSH2 : WSH); R(x, axx, 1, 4, 3, sh ? dk : c); return; }
        R(x, axx, 19 + b + sw, 4, 11, WHITE); R(x, axx + 3, 19 + b + sw, 1, 11, sh ? WSH2 : WSH);
        R(x, axx, 30 + b + sw, 4, 3, sh ? dk : c);
      };
      arm(5, st, false); arm(27, -st, true);
      if (view === 'front') {
        // chest unit with three status lights
        R(x, 13, 21 + b, 10, 7, G2); R(x, 14, 22 + b, 8, 5, G4);
        R(x, 15, 23 + b, 1, 1, '#78ffdc'); R(x, 17, 23 + b, 1, 1, '#ffb43c'); R(x, 19, 23 + b, 1, 1, frame === 1 ? '#ff5a50' : '#7a2420');
        R(x, 15, 25 + b, 5, 1, M2);
      } else {
        // life-support pack
        R(x, 10, 17 + b, 16, 15, M1); R(x, 22, 17 + b, 4, 15, M2); R(x, 10, 17 + b, 16, 1, M0);
        for (let y = 21; y <= 25; y += 2) R(x, 13, y + b, 10, 1, M2);
        R(x, 10, 29 + b, 16, 2, c); R(x, 11, 12 + b, 1, 5, M2); R(x, 11, 11 + b, 1, 1, '#ff5a50');
      }
      // helmet
      const hy = b;
      R(x, 13, hy, 10, 1, WHITE); R(x, 11, 1 + hy, 14, 1, WHITE); R(x, 10, 2 + hy, 16, 1, WHITE);
      R(x, 9, 3 + hy, 18, 12, WHITE); R(x, 10, 15 + hy, 16, 1, WHITE); R(x, 11, 16 + hy, 14, 1, WHITE);
      R(x, 23, 3 + hy, 4, 12, WSH); R(x, 21, 15 + hy, 4, 2, WSH);
      R(x, 13, hy, 3, 1, WHI); R(x, 11, 1 + hy, 2, 1, WHI); R(x, 9, 4 + hy, 1, 8, WHI);
      R(x, 11, 17, 14, 1, view === 'front' ? c : dk);
      if (view === 'front') {
        R(x, 11, 4 + hy, 14, 9, VIS0); R(x, 12, 5 + hy, 12, 7, VIS1); R(x, 12, 5 + hy, 12, 1, VIS2);
        R(x, 13, 6 + hy, 3, 2, VIS3); R(x, 21, 10 + hy, 1, 1, VIS3);
        R(x, 9, 7 + hy, 1, 3, hi);
      } else { R(x, 9, 13 + hy, 18, 1, c); }
      return;
    }
    // ---- side, facing right
    const legS = (lx, dx, sh) => {
      R(x, lx, 34, 6, 5, sh ? WSH : WHITE); R(x, lx + dx, 39, 6, 5, sh ? WSH : WHITE);
      R(x, lx + dx, 38, 6, 2, sh ? dk : c);
      R(x, lx + dx - 1, 44, 9, 4, G2); R(x, lx + dx - 1, 44, 9, 1, G1); R(x, lx + dx + 5, 46, 3, 1, sh ? G3 : c);
    };
    legS(14, -3 * st, true); legS(16, 3 * st, false);
    R(x, 12, 32, 15, 2, G3);
    R(x, 12, 18 + b, 15, 14 - b, WHITE); R(x, 24, 18 + b, 3, 14 - b, WSH); R(x, 12, 18 + b, 1, 12, WHI);
    R(x, 20, 21 + b, 6, 5, G2); R(x, 21, 22 + b, 4, 3, G4); R(x, 22, 23 + b, 1, 1, '#78ffdc');
    // pack on the back
    R(x, 4, 17 + b, 8, 16, M1); R(x, 4, 17 + b, 8, 1, M0); R(x, 10, 17 + b, 2, 16, M2);
    for (let y = 21; y <= 27; y += 3) R(x, 5, y + b, 5, 1, M2);
    R(x, 4, 29 + b, 8, 2, c); R(x, 6, 11 + b, 1, 6, M2); R(x, 6, 10 + b, 1, 1, '#ff5a50');
    // helmet in profile, visor forward
    const hy = b;
    R(x, 16, hy, 9, 1, WHITE); R(x, 14, 1 + hy, 13, 1, WHITE); R(x, 13, 2 + hy, 15, 1, WHITE);
    R(x, 12, 3 + hy, 17, 12, WHITE); R(x, 13, 15 + hy, 15, 1, WHITE); R(x, 14, 16 + hy, 13, 1, WHITE);
    R(x, 16, hy, 3, 1, WHI); R(x, 12, 4 + hy, 1, 8, WHI); R(x, 14, 13 + hy, 6, 1, c);
    R(x, 20, 4 + hy, 9, 9, VIS0); R(x, 21, 5 + hy, 8, 7, VIS1); R(x, 21, 5 + hy, 8, 1, VIS2); R(x, 22, 6 + hy, 2, 2, VIS3);
    R(x, 13, 17, 13, 1, c);
    // the near arm
    if (carry) { R(x, 18, 2, 4, 18, WHITE); R(x, 21, 2, 1, 18, WSH); R(x, 18, 0, 4, 3, c); }
    else { const sw = 2 * st; R(x, 16, 19 + b, 4, 6, WHITE); R(x, 16 + sw, 24 + b, 4, 6, WHITE); R(x, 19 + sw, 24 + b, 1, 6, WSH); R(x, 16 + sw, 30 + b, 4, 3, c); }
  }
  const crewCache = new Map();
  const visorNow = () => (HS.S && HS.S.visor) || 'gold';
  HS.crewSprite = (c, view = 'front', frame = 0, carry = false, visor = visorNow()) => {
    const k = `${c}|${view}|${frame}|${carry ? 1 : 0}|${visor}`;
    let s = crewCache.get(k);
    if (!s) { s = sprite(36, 48, (x) => body(x, c, view, frame, carry, visor), OUT); crewCache.set(k, s); }
    return s;
  };
  // the suit-empty pose: the idle front sprite laid on its back (a quarter turn keeps pixels square)
  HS.crewDown = (c) => {
    const k = `${c}|down|${visorNow()}`;
    let s = crewCache.get(k);
    if (!s) { const f = HS.crewSprite(c); const [d, dx] = make(f.height, f.width); dx.translate(f.height, 0); dx.rotate(Math.PI / 2); dx.drawImage(f, 0, 0); s = d; crewCache.set(k, s); }
    return s;
  };
  // which view and frame a walker shows: o = { walk, flip, face: 'up' | 'down' | 'side', carry }
  HS.crewPose = (o) => {
    const moving = o.walk > 0, view = o.face === 'up' ? 'back' : o.face === 'side' ? 'side' : 'front';
    const frame = moving ? 2 + (Math.floor(o.walk * 7) % 2) : (Math.floor((o.t || 0) * 1.6) % 2);
    return { view, frame };
  };
  // a ground shadow, a pixel ellipse
  HS.shadow = (x, cx, cy, w, h, a = .35) => {
    x.globalAlpha = a;
    for (let r = 0; r < h; r++) { const k = (r - (h - 1) / 2) / (h / 2), hw = Math.round((w / 2) * Math.sqrt(Math.max(0, 1 - k * k))); R(x, cx - hw, cy - Math.floor(h / 2) + r, hw * 2, 1, '#000'); }
    x.globalAlpha = 1;
  };
  // draw a walker in a world scene: feet at world (X, Y + 4); returns the art position of the head top
  HS.drawCrew = (x, cam, X, Y, suit, o = {}) => {
    const [fx, fy] = HS.wa(cam, X, Y + 4);
    HS.shadow(x, fx, fy, 28, 7);
    if (o.down) { const s = HS.crewDown(suit); x.drawImage(s, fx - (s.width >> 1), fy - s.height + 4); return [fx, fy - s.height]; }
    const { view, frame } = HS.crewPose(o), s = HS.crewSprite(suit, view, frame, !!o.carry);
    const dx = fx - 19, dy = fy - 49;
    if (o.flip && view === 'side') { x.save(); x.translate(fx * 2, 0); x.scale(-1, 1); x.drawImage(s, dx, dy); x.restore(); }
    else x.drawImage(s, dx, dy);
    return [fx, dy];
  };

  // ---------- the twelve parts and four salvage parts, 32 x 32 each (34 x 34 with the outline)
  // every part has its own silhouette; its slot colour is a trim stripe (ART-RULES.md rule 4)
  const CAT = HS.CAT;
  const disc = (x, cx, cy, r, col, ry = r) => { for (let y = -ry; y <= ry; y++) { const hw = Math.round(r * Math.sqrt(Math.max(0, 1 - (y / (ry + .5)) ** 2))); R(x, cx - hw, cy + y, hw * 2 + 1, 1, col); } };
  const line = (x, x0, y0, x1, y1, w, col) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) R(x, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), w, w, col); };
  const RUST = '#8a5a3a', RUST2 = '#6a4028', RUST3 = '#b07a4a', TAPE = '#c8c4b0';
  const PARTS_ART = {
    // propulsion
    solid(x) { // a tall segmented booster casing on a flared nozzle
      const t = CAT.prop;
      R(x, 10, 2, 12, 22, M1); R(x, 10, 2, 3, 22, M0); R(x, 18, 2, 4, 22, M2);
      R(x, 11, 0, 10, 2, M1); R(x, 13, 0, 4, 1, M0);
      R(x, 10, 9, 12, 1, M3); R(x, 10, 16, 12, 1, M3);
      R(x, 10, 4, 12, 3, t); R(x, 10, 4, 3, 3, lift(t, .3)); R(x, 19, 4, 3, 3, shade(t, .7));
      R(x, 12, 24, 8, 2, M3); R(x, 11, 26, 10, 2, M3); R(x, 10, 28, 12, 2, M4); R(x, 9, 30, 14, 2, M4);
      R(x, 11, 26, 2, 4, G1); R(x, 12, 31, 8, 1, '#1a1e28');
    },
    chem(x) { // turbopump and pipes over a big copper bell
      const t = CAT.prop;
      R(x, 11, 0, 10, 7, M3); R(x, 11, 0, 10, 1, G1); R(x, 13, 2, 6, 3, M4);
      R(x, 6, 3, 3, 10, '#d86a2a'); R(x, 6, 3, 5, 2, '#d86a2a'); R(x, 6, 3, 1, 10, '#f09a5a');
      R(x, 23, 3, 3, 10, '#4a7ad8'); R(x, 21, 3, 5, 2, '#4a7ad8'); R(x, 25, 3, 1, 10, '#2a4a98');
      R(x, 12, 7, 8, 6, M1); R(x, 12, 7, 2, 6, M0); R(x, 18, 7, 2, 6, M2); R(x, 12, 9, 8, 2, t);
      for (let y = 13; y < 32; y++) { const hw = Math.round(4 + (y - 13) * .62); R(x, 16 - hw, y, hw * 2, 1, '#c07a3a'); R(x, 16 - hw, y, 2, 1, '#e8a868'); R(x, 16 + hw - 3, y, 3, 1, '#8a4e22'); }
      R(x, 6, 30, 20, 2, '#3a2010');
    },
    ion(x) { // a round gridded thruster face that glows blue
      const t = CAT.prop;
      R(x, 9, 24, 14, 6, M3); R(x, 9, 24, 14, 1, G1); R(x, 9, 27, 14, 2, t);
      disc(x, 16, 13, 13, M3); disc(x, 16, 13, 11, '#1a3a5a'); disc(x, 16, 13, 10, '#3ab4e6');
      for (let y = 4; y <= 22; y += 2) for (let X = 7; X <= 25; X += 2) if ((X - 16) ** 2 + (y - 13) ** 2 < 95) R(x, X, y, 1, 1, '#1a5a8a');
      disc(x, 13, 10, 3, '#9ae8ff'); R(x, 12, 9, 2, 1, '#ffffff');
      R(x, 4, 12, 2, 4, M2); R(x, 26, 12, 2, 4, M2);
    },
    // power
    solar_s(x) { // two square panels on a hinge
      const t = CAT.power;
      for (const X0 of [1, 18]) {
        R(x, X0, 6, 13, 20, '#1d2a5a'); for (let k = 3; k < 13; k += 4) R(x, X0 + k, 6, 1, 20, '#2f4a9a');
        for (let y = 11; y < 26; y += 5) R(x, X0, y, 13, 1, '#2f4a9a');
        R(x, X0, 6, 13, 1, '#8ab4e8'); R(x, X0, 6, 1, 20, '#5a7ac8');
      }
      R(x, 14, 3, 4, 26, M2); R(x, 14, 3, 1, 26, M1); R(x, 14, 14, 4, 4, t); R(x, 12, 28, 8, 3, M3);
    },
    solar_l(x) { // a long wing of panels
      const t = CAT.power;
      R(x, 0, 14, 32, 2, M2);
      for (let i = 0; i < 4; i++) {
        const X0 = i * 8;
        R(x, X0, 4, 7, 9, '#1d2a5a'); R(x, X0, 17, 7, 9, '#1d2a5a');
        R(x, X0 + 3, 4, 1, 9, '#2f4a9a'); R(x, X0 + 3, 17, 1, 9, '#2f4a9a'); R(x, X0, 8, 7, 1, '#2f4a9a'); R(x, X0, 21, 7, 1, '#2f4a9a');
        R(x, X0, 4, 7, 1, '#8ab4e8'); R(x, X0, 17, 7, 1, '#8ab4e8');
      }
      R(x, 13, 12, 6, 6, M3); R(x, 14, 13, 4, 4, t); R(x, 14, 27, 4, 4, M3);
    },
    rtg(x) { // a finned cylinder with a warning plate, warm at the base
      const t = CAT.power;
      for (let y = 5; y < 28; y += 3) { R(x, 4, y, 24, 1, M3); R(x, 4, y, 6, 1, G1); R(x, 26, y, 2, 1, '#ff7a3c'); }
      R(x, 10, 2, 12, 28, M3); R(x, 10, 2, 3, 28, G1); R(x, 19, 2, 3, 28, M4);
      R(x, 11, 0, 10, 2, M2); R(x, 10, 29, 12, 2, M4);
      R(x, 12, 10, 8, 8, '#e8c547'); R(x, 15, 12, 2, 2, '#1a1a1a'); R(x, 13, 15, 2, 2, '#1a1a1a'); R(x, 17, 15, 2, 2, '#1a1a1a'); R(x, 15, 14, 2, 1, '#1a1a1a');
      R(x, 10, 22, 12, 2, t);
    },
    // comms
    lga(x) { // a short mast with a helix and a horn
      const t = CAT.comms;
      R(x, 7, 28, 18, 3, M3); R(x, 7, 28, 18, 1, G1);
      R(x, 15, 10, 2, 18, M2); R(x, 15, 10, 1, 18, M1);
      for (let y = 12; y < 27; y += 3) { R(x, 12, y, 8, 1, '#c8a46e'); R(x, 12, y, 2, 1, '#f0d29a'); }
      for (let y = 2; y < 10; y++) { const hw = 2 + Math.round((y - 2) * .7); R(x, 16 - hw, y, hw * 2, 1, WHITE); R(x, 16 + hw - 2, y, 2, 1, WSH); }
      R(x, 14, 0, 4, 2, M2); R(x, 7, 26, 18, 2, t);
    },
    dish(x) { // a big parabolic dish on a pedestal, with its feed
      const t = CAT.comms;
      R(x, 13, 22, 6, 7, M2); R(x, 13, 22, 2, 7, M1); R(x, 8, 28, 16, 3, M3); R(x, 8, 28, 16, 1, G1);
      disc(x, 16, 12, 15, '#dfe3ea', 10); disc(x, 17, 13, 12, '#aab2c0', 7); disc(x, 18, 14, 8, '#8a92a2', 4);
      for (let X = 3; X < 15; X++) R(x, X, 12 - Math.round(Math.sqrt(Math.max(0, 100 - ((X - 16) * .66) ** 2 * 1))) + 1, 1, 1, WHI);
      line(x, 6, 16, 16, 4, 1, M3); line(x, 26, 16, 16, 4, 1, M3); R(x, 15, 3, 3, 3, '#ff5a50');
      R(x, 9, 24, 14, 2, t);
    },
    laser(x) { // a telescope on a gimbal fork, red lens forward
      const t = CAT.comms;
      R(x, 6, 26, 20, 5, M3); R(x, 6, 26, 20, 1, G1); R(x, 9, 18, 3, 9, M2); R(x, 20, 18, 3, 9, M2);
      for (let i = 0; i < 20; i++) { const cx = 7 + i, cy = 24 - i; R(x, cx - 3, cy - 3, 7, 7, i < 4 ? M2 : WHITE); }
      for (let i = 0; i < 20; i++) R(x, 7 + i + 2, 24 - i + 2, 2, 2, WSH);
      for (let i = 9; i < 12; i++) R(x, 7 + i - 3, 24 - i - 3, 7, 7, M3);
      disc(x, 27, 4, 4, '#4a1414'); disc(x, 27, 4, 3, '#ff5a50'); R(x, 26, 3, 2, 1, '#ffd0c8');
      R(x, 6, 29, 20, 2, t);
    },
    // payload
    camera(x) { // a camera body with a big glass lens
      const t = CAT.payload;
      R(x, 4, 9, 24, 18, G3); R(x, 4, 9, 24, 2, G1); R(x, 4, 9, 2, 18, G1); R(x, 25, 9, 3, 18, G4);
      R(x, 7, 5, 7, 4, G2); R(x, 7, 5, 7, 1, G1); R(x, 21, 6, 4, 3, '#ff5a50');
      disc(x, 17, 18, 8, M4); disc(x, 17, 18, 6, M3); disc(x, 17, 18, 4, '#2f5fc8'); R(x, 15, 16, 2, 2, '#a8c8ff'); R(x, 19, 20, 1, 1, '#a8c8ff');
      R(x, 4, 24, 24, 2, t);
    },
    spectro(x) { // an instrument box whose window shows a rainbow, with a small scope on top
      const t = CAT.payload;
      R(x, 3, 9, 26, 20, M1); R(x, 3, 9, 26, 2, M0); R(x, 3, 9, 2, 20, M0); R(x, 25, 9, 4, 20, M2);
      R(x, 18, 3, 9, 6, WHITE); R(x, 25, 3, 2, 6, WSH); R(x, 26, 4, 2, 4, '#2f5fc8');
      R(x, 6, 13, 20, 8, M4);
      ['#ff5a50', '#ff9a3c', '#ffd23c', '#6edc82', '#46d2e6', '#4a7ad8', '#a078ff'].forEach((c, i) => R(x, 7 + i * 2 + 2, 14, 2, 6, c));
      R(x, 6, 24, 20, 2, t); R(x, 8, 22, 3, 1, '#78ffdc');
    },
    radar(x) { // long dipole booms either side of a box, waves going out
      const t = CAT.payload;
      R(x, 0, 19, 32, 2, M2); R(x, 0, 19, 32, 1, M1); R(x, 0, 18, 2, 4, '#ff5a50'); R(x, 30, 18, 2, 4, '#ff5a50');
      R(x, 10, 15, 12, 13, M1); R(x, 10, 15, 12, 2, M0); R(x, 19, 15, 3, 13, M2); R(x, 12, 24, 8, 2, t);
      R(x, 15, 11, 2, 4, M2);
      for (const [r, a] of [[4, 1], [7, .8], [10, .55]]) for (let X = -r; X <= r; X++) { const y = Math.round(Math.sqrt(r * r - X * X)); x.globalAlpha = a; R(x, 16 + X, 11 - y, 1, 1, '#e6b946'); x.globalAlpha = 1; }
    },
    // salvage: rusty, dented, taped
    sal_prop(x) {
      const t = CAT.prop;
      R(x, 11, 4, 10, 14, RUST); R(x, 11, 4, 2, 14, RUST3); R(x, 18, 4, 3, 14, RUST2); R(x, 14, 8, 3, 3, RUST2);
      R(x, 9, 9, 14, 3, TAPE); R(x, 9, 9, 14, 1, '#e8e4d0');
      for (let y = 18; y < 30; y++) { const hw = Math.round(3 + (y - 18) * .5 + (y > 24 ? 1 : 0)); R(x, 15 - hw, y, hw * 2 + (y > 25 ? 2 : 0), 1, RUST2); R(x, 15 - hw, y, 2, 1, RUST); }
      R(x, 11, 13, 10, 2, t); R(x, 13, 2, 6, 2, M3);
    },
    sal_power(x) {
      const t = CAT.power;
      R(x, 6, 9, 20, 20, RUST); R(x, 6, 9, 20, 2, RUST3); R(x, 22, 9, 4, 20, RUST2);
      R(x, 9, 5, 4, 4, M3); R(x, 19, 5, 4, 4, M3); R(x, 10, 5, 2, 1, '#ff5a50'); R(x, 20, 5, 2, 1, '#2a2a2a');
      line(x, 6, 12, 25, 26, 2, TAPE); line(x, 6, 26, 25, 12, 2, TAPE); R(x, 6, 22, 20, 2, t);
    },
    sal_comms(x) {
      const t = CAT.comms;
      R(x, 10, 20, 12, 10, RUST); R(x, 10, 20, 3, 10, RUST3); R(x, 19, 20, 3, 10, RUST2); R(x, 10, 26, 12, 2, t);
      line(x, 16, 20, 14, 12, 1, M1); line(x, 14, 12, 20, 8, 1, M1); line(x, 20, 8, 12, 3, 1, M1); line(x, 12, 3, 18, 1, 1, M1);
      R(x, 17, 0, 2, 2, '#ff5a50'); R(x, 22, 22, 4, 2, TAPE);
    },
    sal_payload(x) {
      const t = CAT.payload;
      R(x, 5, 9, 22, 18, RUST); R(x, 5, 9, 22, 2, RUST3); R(x, 23, 9, 4, 18, RUST2);
      disc(x, 15, 17, 5, M4); disc(x, 15, 17, 3, '#3a5a88'); line(x, 12, 14, 18, 20, 1, '#c8d8f0');
      R(x, 21, 11, 5, 9, TAPE); R(x, 5, 24, 22, 2, t);
    }
  };
  const partCache = {};
  HS.partIcon = (id) => (partCache[id] ??= sprite(32, 32, PARTS_ART[id] || PARTS_ART.sal_payload, OUT));
  // a part lying in the world: a shadow, a pulsing pickup ring, and the part bobbing a pixel
  HS.drawPart = (x, cam, X, Y, id, t) => {
    const [cx, cy] = HS.wa(cam, X, Y), s = HS.partIcon(id), bob = Math.round(Math.sin(t * 3 + X) * 1.2);
    HS.shadow(x, cx, cy + 15, 30, 6, .3);
    const r = 20 + Math.round(Math.sin(t * 4) * 2);
    x.globalAlpha = .55;
    for (let a = 0; a < 40; a++) { const k = a / 40 * Math.PI * 2; if ((a + Math.floor(t * 8)) % 4 < 2) R(x, cx + Math.round(Math.cos(k) * r), cy + 15 + Math.round(Math.sin(k) * r * .35), 2, 1, '#78ffdc'); }
    x.globalAlpha = 1;
    x.drawImage(s, cx - 17, cy - 19 + bob);
  };
  // particles (HS.Parts, in world units) as 2 x 2 art-pixel sparks
  HS.drawFx = (x, cam, fx) => {
    for (const p of fx.a) { x.globalAlpha = HS.clamp(p.life / p.max * 1.6, 0, 1); x.fillStyle = p.col; x.fillRect(Math.round(p.x * U) - cam.ox, Math.round(p.y * U) - cam.oy, 2 * p.size + 1, 2 * p.size + 1); }
    x.globalAlpha = 1;
  };
  // the old 640-space crew portrait (report screen), now the new sprite at a whole-number scale
  HS.bigAstro = (x0, y0, scale, suit) => {
    const g = HS.g, s = HS.crewSprite(suit, 'front', 0), k = scale >= 1.3 ? 2 : 1;
    g.imageSmoothingEnabled = false; g.drawImage(s, x0, y0, s.width * k / 2, s.height * k / 2);
  };
})();
