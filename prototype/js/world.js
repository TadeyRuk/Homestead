// Homestead world art: sprites and the three maps, drawn in pixel space (640x400 world, 3x zoom).
// Placeholder pixel art adapted from the team's proposal walkthrough. AI-assisted, not final art.
(() => {
  const HS = window.HS;
  const { R, px, ell, shade, off, noise, C } = HS;

  HS.WORLD_W = 640; HS.WORLD_H = 400; HS.VW = 640 / 3; HS.VH = 120;

  // ---------- sprites
  HS.astro = (x, X, Y, col, o = {}) => {
    X = Math.round(X); Y = Math.round(Y);
    if (o.down) {
      px(x, X - 6, Y + 1, 12, 2, 'rgba(0,0,0,.35)'); px(x, X - 2, Y - 2, 7, 3, col); px(x, X - 7, Y - 3, 5, 5, '#e8ecf2'); px(x, X - 6, Y - 2, 2, 2, '#24386a');
      px(x, X - 1, Y - 9, 1, 5, C.red); px(x, X - 3, Y - 7, 5, 1, C.red); return;
    }
    const step = o.walk ? (Math.floor(o.walk * 8) % 2) : 0, f = o.flip ? -1 : 1;
    px(x, X - 3, Y + 3, 7, 2, 'rgba(0,0,0,.35)');
    px(x, X - 3 * f, Y - 2, 1, 4, '#969ba5');
    px(x, X - 2, Y - 2, 5, 4, col); px(x, X + 2 * f, Y - 1, 1, 3, shade(col, .7));
    px(x, X - 2, Y + 2 - (step ? 1 : 0), 2, 1, shade(col, .6)); px(x, X + 1, Y + 2 - (step ? 0 : 1), 2, 1, shade(col, .6));
    px(x, X - 2, Y - 6, 5, 4, '#e8ecf2'); px(x, X - 3, Y - 5, 1, 2, '#e8ecf2');
    px(x, f > 0 ? X : X - 2, Y - 5, 3, 2, '#24386a'); px(x, f > 0 ? X + 1 : X - 1, Y - 5, 1, 1, '#a8d4ff');
    px(x, X - 2, Y - 9, 1, 3, '#9aa0aa'); px(x, X - 2, Y - 10, 1, 1, C.red);
    if (o.carry) { const b = Math.round(Math.sin((o.walk || 0) * 16)); px(x, X - 2, Y - 14 + b, 5, 4, shade(o.carry, .55)); px(x, X - 1, Y - 13 + b, 3, 2, o.carry); }
  };
  const [bigA, bax] = off(20, 28);
  HS.bigAstro = (x0, y0, scale, suit) => {
    const g = HS.g, visor = '#24386a';
    bax.clearRect(0, 0, 20, 28);
    ell(bax, 10, 26, 7, 1.5, 'rgba(0,0,0,.45)');
    px(bax, 3, 13, 3, 9, '#8c929c'); px(bax, 6, 13, 9, 10, suit); px(bax, 13, 13, 2, 10, shade(suit, .72));
    px(bax, 4, 14, 2, 6, shade(suit, .85)); px(bax, 15, 14, 2, 6, shade(suit, .7));
    px(bax, 6, 23, 3, 3, shade(suit, .6)); px(bax, 11, 23, 3, 3, shade(suit, .6));
    px(bax, 6, 4, 9, 9, '#e8ecf2'); px(bax, 5, 5, 11, 7, '#e8ecf2'); px(bax, 14, 5, 2, 7, '#c8ced8');
    px(bax, 9, 6, 6, 4, visor); px(bax, 13, 6, 1, 1, '#bfe0ff');
    px(bax, 7, 0, 1, 4, '#9aa0aa'); px(bax, 7, 0, 1, 1, C.red);
    g.imageSmoothingEnabled = false; g.drawImage(bigA, x0, y0, 20 * scale, 28 * scale);
  };
  HS.pickup = (x, X, Y, col, t) => {
    const p = 4 + Math.sin(t * 4) * .6, bob = Math.round(Math.sin(t * 3 + X) * 1);
    x.strokeStyle = C.cyan; x.lineWidth = 1; x.beginPath(); x.ellipse(X, Y + 3, p + 1, p * .45, 0, 0, 7); x.stroke();
    px(x, X - 2, Y - 3 + bob, 5, 4, shade(col, .55)); px(x, X - 1, Y - 2 + bob, 3, 2, col); px(x, X - 1, Y - 2 + bob, 1, 1, '#fff');
  };
  HS.diamond = (x, X, Y, col, s = 4) => { x.fillStyle = col; x.beginPath(); x.moveTo(X, Y - s); x.lineTo(X + s - 1, Y); x.lineTo(X, Y + s); x.lineTo(X - s + 1, Y); x.fill(); };
  // rocket drawn nose-up, centred on X with its base at Y. k scales it.
  HS.rocket = (x, X, Y, k = 1, flame = 0) => {
    const w = 9 * k, h = 36 * k;
    if (flame > 0) { x.fillStyle = '#ff9a3c'; x.beginPath(); x.moveTo(X - w * .45, Y); x.lineTo(X + w * .45, Y); x.lineTo(X, Y + flame); x.fill(); x.fillStyle = '#fff0c8'; x.beginPath(); x.moveTo(X - w * .22, Y); x.lineTo(X + w * .22, Y); x.lineTo(X, Y + flame * .6); x.fill(); }
    px(x, X - w / 2, Y - h, w, h, '#e2e5ec'); px(x, X + w / 6, Y - h, w / 3, h, '#b6bac4');
    x.fillStyle = '#e2e5ec'; x.beginPath(); x.moveTo(X - w / 2, Y - h); x.lineTo(X + w / 2, Y - h); x.lineTo(X, Y - h - 12 * k); x.fill();
    px(x, X - w / 2, Y - h * .66, w, 1, '#40404c'); px(x, X - w / 2, Y - h * .22, w, 1, '#40404c'); px(x, X + w / 2, Y - h * .82, 3 * k, 4 * k, '#78ffdc');
    x.fillStyle = '#e8783c'; x.beginPath(); x.moveTo(X - w / 2, Y - 8 * k); x.lineTo(X - w / 2 - 6 * k, Y + 1); x.lineTo(X - w / 2, Y); x.fill();
    x.fillStyle = '#c86432'; x.beginPath(); x.moveTo(X + w / 2, Y - 8 * k); x.lineTo(X + w / 2 + 6 * k, Y + 1); x.lineTo(X + w / 2, Y); x.fill();
  };

  // ---------- campus
  const bld = (x, X, Y, w, h, roof, face) => { px(x, X, Y, w, h, roof); px(x, X, Y + h, w, face, shade(roof, .68)); px(x, X, Y + h, w, 1, shade(roof, 1.35)); };
  const PAD = HS.PAD = { x: 545, y: 92, mx: 545, my: 156 };       // mx,my: where the crew stands to mount
  HS.KIOSK = { x: 410, y: 172, sx: 410, sy: 196 };
  HS.CAMPUS_SOLID = [[300, 100, 72, 90], [168, 66, 88, 42], [48, 150, 124, 51], [196, 280, 156, 63], [400, 166, 20, 20], [533, 44, 24, 60],
    // the campus's newer pieces (js/campus.js): water tower, weather mast, containers, parked vans, hedges
    [65, 98, 14, 6], [110, 57, 4, 4], [16, 295, 22, 5], [16, 307, 22, 5], [40, 321, 22, 5], [490, 233, 22, 5], [397, 24, 6, 8], [419, 24, 6, 8], [452, 24, 6, 8], [197, 345, 59, 4], [284, 345, 60, 4]];
  HS.CAMPUS_LABELS = [[336, 96, 'ASSEMBLY BUILDING'], [212, 62, 'TRACKING STATION'], [110, 146, 'HANGAR'], [274, 276, 'CREW QUARTERS'], [451, 228, 'PARTS YARD'], [110, 296, 'STORAGE YARD'], [548, 284, 'FUEL FARM']];
  // places a part can spawn (seeded each run)
  HS.CAMPUS_SPAWNS = [[85, 218], [150, 242], [498, 338], [566, 298], [180, 124], [444, 250], [330, 368], [40, 372], [618, 206], [276, 252], [30, 60], [130, 36], [286, 60], [600, 150], [470, 372],
    [104, 322], [238, 380], [600, 372], [436, 120], [52, 268], [362, 240], [452, 60], [250, 150], [150, 100]];
  // the campus art is in js/campus.js (1280 x 720 art grid); positions and collision stay here

  // ---------- Mars and the Moon
  HS.LANDER = { x: 320, y: 205 };
  const drawLander = (x) => {
    const L = HS.LANDER;
    for (let a2 = 0; a2 < 360; a2 += 10) px(x, L.x + 34 * Math.cos(a2 * Math.PI / 180), L.y + 24 * Math.sin(a2 * Math.PI / 180), 1, 1, '#78ffdc');
    [[-12, -9], [12, -9], [-12, 9], [12, 9]].forEach(([dx, dy]) => { x.strokeStyle = '#9696a0'; x.lineWidth = 1; x.beginPath(); x.moveTo(L.x, L.y); x.lineTo(L.x + dx, L.y + dy); x.stroke(); px(x, L.x + dx - 1, L.y + dy - 1, 3, 3, '#bebec8'); });
    px(x, L.x - 24, L.y - 3, 14, 5, '#2846a0'); px(x, L.x + 10, L.y - 3, 14, 5, '#2846a0'); ell(x, L.x, L.y, 8, 7, '#b0924c'); ell(x, L.x, L.y - 1, 5, 4, '#c8ac68'); ell(x, L.x, L.y - 9, 3, 3, '#e8eaee');
  };
  HS.SURFACE = {
    mars: {
      rich: [[80, 330], [470, 40], [560, 322], [70, 60], [600, 190]], poor: [[284, 160], [366, 256], [248, 236], [400, 150], [250, 300]],
      sample: [[480, 118], [200, 316]], deploy: [[124, 100], [540, 250]], rocks: [], sky: '#2a1410',
      // surface minigame spots (js/surface-games.js): drill S2-20, relay S4-11, panels S5-11
      games: { drill: [170, 180], relay: [430, 330], panels: [360, 80] }
    },
    moon: {
      rich: [[90, 320], [520, 60], [570, 330], [80, 80], [40, 200]], poor: [[270, 150], [380, 262], [240, 250], [410, 160]],
      sample: [[500, 110], [190, 300]], deploy: [[130, 110], [520, 260]],
      rocks: [[200, 110], [450, 150], [150, 250], [430, 300], [560, 200], [90, 160], [300, 330], [330, 70], [510, 350], [240, 190], [400, 220]], overlook: [[600, 30], [40, 370], [610, 370]], sky: '#05070c',
      games: { drill: [92, 204], relay: [470, 215], panels: [380, 40] }
    }
  };
  const craters = [[500, 100, 40], [190, 300, 22], [90, 200, 14], [420, 330, 16], [600, 60, 12], [250, 60, 10]];
  HS.marsBg = (() => {
    const [c, x] = off(640, 400); const r = R(23);
    const d = x.createImageData(640, 400), a = d.data;
    for (let y = 0; y < 400; y++) for (let X = 0; X < 640; X++) {
      const v = Math.sin(X * .05 + y * .11) + .6 * Math.sin(X * .13 - y * .07), i = (y * 640 + X) * 4;
      const col = v > .9 ? [136, 64, 42] : v < -1.1 ? [172, 88, 56] : [154, 74, 48];
      a[i] = col[0]; a[i + 1] = col[1]; a[i + 2] = col[2]; a[i + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    craters.forEach(([X, Y, s]) => { ell(x, X, Y, s, s * .6, '#783826'); x.strokeStyle = '#c4724c'; x.lineWidth = 2; x.beginPath(); x.ellipse(X, Y, s, s * .6, 0, 3.5, 5.9); x.stroke(); });
    x.strokeStyle = '#763624'; x.lineWidth = 12; x.beginPath(); x.moveTo(20, 140); x.lineTo(230, 60); x.stroke(); x.strokeStyle = '#ba6846'; x.lineWidth = 3; x.beginPath(); x.moveTo(20, 134); x.lineTo(230, 54); x.stroke();
    for (let i = 0; i < 200; i++) { const X = r() * 640, Y = r() * 400, s = 1 + r() * 2; ell(x, X, Y, s, s, '#602e20'); px(x, X - 1, Y - 1, 1, 1, '#b06040'); }
    noise(x, 640, 400, r, 8, .45); drawLander(x);
    return c;
  })();
  HS.moonBg = (() => {
    const [c, x] = off(640, 400); const r = R(61);
    const d = x.createImageData(640, 400), a = d.data;
    for (let y = 0; y < 400; y++) for (let X = 0; X < 640; X++) {
      const v = Math.sin(X * .04 - y * .09) + .7 * Math.sin(X * .11 + y * .06), i = (y * 640 + X) * 4;
      const k = v > .9 ? 104 : v < -1.1 ? 142 : 122; a[i] = k; a[i + 1] = k + 2; a[i + 2] = k + 8; a[i + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    craters.concat([[330, 110, 18], [120, 340, 12], [560, 270, 20], [40, 40, 16]]).forEach(([X, Y, s]) => { ell(x, X, Y, s, s * .6, '#5a5e6a'); x.strokeStyle = '#b4b8c4'; x.lineWidth = 2; x.beginPath(); x.ellipse(X, Y, s, s * .6, 0, 3.5, 5.9); x.stroke(); x.strokeStyle = '#3e424c'; x.lineWidth = 1; x.beginPath(); x.ellipse(X, Y, s, s * .6, 0, .4, 2.8); x.stroke(); });
    for (let i = 0; i < 220; i++) { const X = r() * 640, Y = r() * 400, s = 1 + r() * 2; ell(x, X, Y, s, s * .7, '#4e525c'); px(x, X - 1, Y - 1, 1, 1, '#b0b4c0'); }
    HS.SURFACE.moon.rocks.forEach(([X, Y]) => { ell(x, X + 5, Y + 5, 13, 6, 'rgba(10,12,20,.6)'); ell(x, X, Y, 9, 7, '#6a6e7a'); ell(x, X - 2, Y - 2, 5, 4, '#9a9eaa'); });
    noise(x, 640, 400, r, 8, .45); drawLander(x);
    return c;
  })();

  // the shared camera (HS.camera) is in js/art.js: it centres the player and snaps to the art grid
  // world point -> HUD units from the safe box's top left (cam.x, cam.y is the world at the stage's top left)
  HS.toScreen = (cam, X, Y) => ({ x: (X - cam.x) * 3 + HS.X0, y: (Y - cam.y) * 3 + HS.Y0 });
  // arrow at the screen edge pointing to an off-screen world point
  // Arrows are spread out so two targets in the same direction do not print on top of each other.
  let used = [];
  HS.arrowReset = () => { used = []; };
  HS.edgeArrow = (cam, X, Y, col, label, avoidPanel) => {
    const g = HS.g, s = HS.toScreen(cam, X, Y);
    const { X0, X1, Y0, Y1 } = HS;
    if (s.x > X0 + 20 && s.x < X1 - 20 && s.y > Y0 + 40 && s.y < Y1 - 20) return;
    // arrows sit on an ellipse-ish frame just inside the screen's edges
    const cx = (X0 + X1) / 2, cy = 200, hw = (X1 - X0) / 2 - 36, hh = Math.min(cy - Y0 - 94, Y1 - cy - 54), a = Math.atan2(s.y - cy, s.x - cx);
    const k = Math.min(Math.abs(hw / Math.cos(a)), Math.abs(hh / Math.sin(a)));
    let ax = cx + Math.cos(a) * k, ay = cy + Math.sin(a) * k;
    if (avoidPanel && ax < X0 + 226 && ay > Y1 - 138) { if (s.y > Y1 - 20) ax = X0 + 232; else ay = Y1 - 144; }
    const onSide = Math.abs(Math.abs(ax - cx) - hw) < 1;
    for (let n = 0; n < 6 && used.some(u => Math.abs(u[0] - ax) < 62 && Math.abs(u[1] - ay) < 16); n++) { if (onSide) ay += ay < cy ? 18 : -18; else ax += ax < cx ? 64 : -64; }
    used.push([ax, ay]);
    g.save(); g.translate(ax, ay); g.rotate(a); g.fillStyle = col; g.beginPath(); g.moveTo(9, 0); g.lineTo(-5, -6); g.lineTo(-5, 6); g.fill(); g.restore();
    if (label) {
      const w = HS.tw(label, 7.5, { w: 600 }), lx = HS.clamp(ax - Math.cos(a) * (w / 2 + 14), X0 + w / 2 + 6, X1 - 6 - w / 2), ly = HS.clamp(ay - Math.sin(a) * 16, Y0 + 50, Y1 - 30);
      g.fillStyle = 'rgba(8,14,26,.65)'; g.fillRect(lx - w / 2 - 3, ly - 6, w + 6, 12); HS.T(label, lx, ly + .5, 7.5, col, { w: 600, a: 'center', b: 'middle' });
    }
  };
})();
