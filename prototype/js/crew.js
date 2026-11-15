// Homestead crew page: between the title and the brief. Your astronaut turns on a pedestal in the suit-up bay
// (the 36 x 48 sprite from js/art.js at a whole-number 4x), and you pick a callsign, a suit colour and a
// visor tint. The choices are kept in localStorage, and the callsign floats over your astronaut in the
// title film. Art on the 1280 x 720 grid; the panel's text is drawn over it at screen resolution.
(() => {
  const HS = window.HS, g = HS.g, L = HS.liftoff;
  const { R, mix, hex } = L;
  const C = HS.C, CREW = '#78ffdc', INK = '#080e1a', EDGE = '#2a3a52';
  const VISOR_IDS = ['gold', 'silver', 'blue', 'rose'], VISOR_NAME = { gold: 'Gold', silver: 'Silver', blue: 'Blue', rose: 'Rose' };
  const KEY = 'homestead.crew', MAX = 12;

  HS.loadCrew = () => {
    let o = {};
    try { o = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { o = {}; }
    return { suit: HS.SUITS.includes(o.suit) ? o.suit : C.pilot, visor: VISOR_IDS.includes(o.visor) ? o.visor : 'gold', name: typeof o.name === 'string' ? o.name.slice(0, MAX) : '' };
  };
  HS.saveCrew = () => { try { const S = HS.S; localStorage.setItem(KEY, JSON.stringify({ suit: S.suit, visor: S.visor, name: S.name })); } catch (e) { /* storage blocked: the choice lasts this visit */ } };

  const K = { t: 0, focus: 0, hits: [] };
  const charOf = (code) => /^Key[A-Z]$/.test(code) ? code[3] : /^Digit\d$/.test(code) ? code[5] : code === 'Space' ? ' ' : code === 'Minus' ? '-' : null;

  // ---------- the suit-up bay, drawn once
  let bay = null;
  function buildBay() {
    const [c, x] = L.make(1280, 720);
    for (let y = 0; y < 720; y++) R(x, 0, y, 1280, 1, `rgb(${mix(hex('#0c1424'), hex('#162238'), y / 560).map(v => v | 0).join(',')})`);
    for (let X = 0; X < 1280; X += 80) { R(x, X, 0, 2, 560, '#0a1020'); R(x, X + 2, 0, 1, 560, '#1e2a40'); }
    for (const Y of [130, 540]) { R(x, 0, Y, 1280, 6, '#1e2a40'); R(x, 0, Y, 1280, 1, '#2e3c58'); for (let X = 20; X < 1280; X += 40) R(x, X, Y + 2, 2, 2, '#3a4a68'); }
    // the window onto the pad at night
    const wx = 330, wy = 26, ww = 520, wh = 300;
    R(x, wx - 8, wy - 8, ww + 16, wh + 16, '#2a3448'); R(x, wx - 8, wy - 8, ww + 16, 3, '#4a5874');
    for (let y = 0; y < wh; y++) R(x, wx, wy + y, ww, 1, `rgb(${mix(hex('#050816'), hex('#1e2448'), y / wh).map(v => v | 0).join(',')})`);
    const r = L.noise(12); for (let i = 0; i < 160; i++) { const v = (120 + r() * 135) | 0; R(x, wx + r() * ww, wy + r() * wh * .7, r() < .1 ? 2 : 1, r() < .1 ? 2 : 1, `rgb(${v},${v},${Math.min(255, v + 30)})`); }
    R(x, wx, wy + wh - 40, ww, 40, '#1a2a24'); R(x, wx, wy + wh - 40, ww, 2, '#2c4a3a');
    L.gantry(x, wx + 330, wy + wh - 30, 230, 0.4, 150, 28);
    L.padRocket(x, wx + 420, wy + wh - 34, 0, 0, '#6edc82');
    for (let k = 1; k < 3; k++) R(x, wx + k * ww / 3, wy, 4, wh, '#2a3448');
    R(x, wx, wy + wh / 2, ww, 4, '#2a3448');
    for (let i = 0; i < 40; i++) R(x, wx + 10 + i * 6, wy + 10 + i * 5, 3, 2, 'rgba(255,255,255,.07)');
    // lockers along the left wall, slot-coloured name tags
    for (let i = 0; i < 4; i++) {
      const X = 30 + i * 70, Y = 190;
      R(x, X - 1, Y - 1, 64, 332, HS.ART_OUT); R(x, X, Y, 62, 330, '#3a4660'); R(x, X, Y, 62, 3, '#5a6886'); R(x, X + 58, Y, 4, 330, '#2a3448');
      for (let k = 0; k < 6; k++) R(x, X + 12, Y + 20 + k * 6, 36, 2, '#222c40');
      R(x, X + 14, Y + 70, 34, 10, ['#f08c32', '#f0d246', '#46d2e6', '#e155b9'][i]); R(x, X + 50, Y + 160, 4, 24, '#8a93a3');
    }
    // the floor, with a hazard edge
    R(x, 0, 560, 1280, 160, '#0a1018'); for (let X = 0; X < 1280; X += 24) R(x, X, 560, 12, 6, '#f2c040'); for (let X = 12; X < 1280; X += 24) R(x, X, 560, 12, 6, '#1a1c22');
    for (let y = 580; y < 720; y += 22) R(x, 0, y, 1280, 1, '#141c28');
    return c;
  }
  // a pixel ellipse
  const ell = (x, cx, cy, rx, ry, col) => { for (let y = -ry; y <= ry; y++) { const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / (ry + .5)) ** 2))); R(x, cx - hw, cy + y, hw * 2 + 1, 1, col); } };

  function drawPreview(t) {
    const x = HS.ax, S = HS.S;
    bay ??= buildBay();
    // the bay fills the window: its walls and floor mirror out into the margins (js/art.js)
    x.imageSmoothingEnabled = false; x.drawImage(bay, 0, 0); HS.bleedFrom(bay);
    // the pedestal and its light
    const cx = 430, fy = 640;
    x.globalAlpha = .08; for (let k = 0; k < 6; k++) { const w = 70 + k * 22; x.fillStyle = '#c8fff0'; x.beginPath(); x.moveTo(cx - 30 - k * 4, 0); x.lineTo(cx + 30 + k * 4, 0); x.lineTo(cx + w, fy); x.lineTo(cx - w, fy); x.fill(); } x.globalAlpha = 1;
    ell(x, cx, fy + 14, 156, 30, HS.ART_OUT); ell(x, cx, fy + 12, 154, 28, '#2a3448'); ell(x, cx, fy + 6, 150, 26, '#3a4660'); ell(x, cx, fy, 146, 24, '#4a5874');
    const glow = .6 + .4 * Math.sin(t * 2.4);
    x.globalAlpha = glow; for (let a = 0; a < 120; a++) { const k = a / 120 * Math.PI * 2; R(x, cx + Math.round(Math.cos(k) * 140), fy + Math.round(Math.sin(k) * 21), 3, 2, CREW); } x.globalAlpha = 1;
    // the astronaut on the turntable: front, side, back, other side
    const turn = Math.floor(t / 1.4) % 4, view = ['front', 'side', 'back', 'side'][turn], flip = turn === 3;
    const s = HS.crewSprite(S.suit, view, Math.floor(t * 1.6) % 2, false, S.visor), k = 4;
    HS.shadow(x, cx, fy, 120, 18, .45);
    const dx = cx - (s.width * k >> 1), dy = fy - s.height * k + 6;
    if (flip) { x.save(); x.translate(cx * 2, 0); x.scale(-1, 1); x.drawImage(s, dx, dy, s.width * k, s.height * k); x.restore(); }
    else x.drawImage(s, dx, dy, s.width * k, s.height * k);
    HS.blitArt();
  }

  // ---------- the panel, on the 1280 grid at screen resolution
  const font = (size, w = 600, f = L.MONO) => `${w} ${size}px ${f}`;
  const rrect = (x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
  function text(s, x, y, size, col, o = {}) { g.font = font(size, o.w, o.f); g.fillStyle = col; g.textAlign = o.a || 'left'; g.textBaseline = 'middle'; if ('letterSpacing' in g) g.letterSpacing = o.ls ? o.ls + 'px' : '0px'; g.fillText(s, x, y); }
  function drawPanel(t) {
    const S = HS.S, hits = K.hits = [], mx = HS.In.mx * 2, my = HS.In.my * 2, over = (x, y, w, h) => mx >= x && mx <= x + w && my >= y && my <= y + h;
    const W = 440, H = 536, X = HS.AX1 - 50 - W, Y = 92, L0 = X + 25, PW = W - 50;   // pinned to the right edge
    g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 40 * K.S; g.shadowOffsetY = 18 * K.S; rrect(X, Y, W, H, 6); g.fillStyle = 'rgba(10,16,30,.86)'; g.fill(); g.restore();
    g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,.16)'; rrect(X + .5, Y + .5, W - 1, H - 1, 6); g.stroke(); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(X + 6, Y + 1, W - 12, 1);
    const label = (s, y, hint) => { text(s, L0, y + 9, 12, C.muted, { ls: .96 }); if (hint) text(hint, L0 + PW, y + 9, 12, '#6f7d8c', { w: 500, a: 'right' }); };
    const ring = (on, x, y, w, h) => { if (on) { g.strokeStyle = CREW; g.lineWidth = 2; rrect(x - 3, y - 3, w + 6, h + 6, 6); g.stroke(); g.lineWidth = 1; } };
    let y = Y + 24;
    text('Crew', L0, y + 11, 22, CREW, { w: 700, f: L.PIXEL, ls: .88 });
    text(`${S.mission.name}  ·  seed ${S.seed}`, L0 + PW, y + 11, 13, C.muted, { w: 500, a: 'right' });
    // callsign
    y += 46; label('CALLSIGN', y, K.focus === 0 ? 'type to edit' : '');
    y += 26; ring(K.focus === 0, L0, y, PW, 48);
    rrect(L0 + .5, y + .5, PW - 1, 47, 4); g.fillStyle = '#050a14'; g.fill(); g.strokeStyle = EDGE; g.stroke();
    if (S.name) text(S.name, L0 + 14, y + 25, 20, C.white, { w: 600 }); else text('No callsign yet', L0 + 14, y + 25, 16, '#5a6878', { w: 500 });
    if (K.focus === 0 && Math.floor(t * 2) % 2 === 0) { g.font = font(20); const w = S.name ? g.measureText(S.name).width : 0; g.fillStyle = CREW; g.fillRect(L0 + 15 + w, y + 12, 2, 26); }
    hits.push({ id: 'name', x: L0, y, w: PW, h: 48 });
    // suit colour
    y += 70; label('SUIT COLOUR', y, '[←] [→]');
    y += 26; ring(K.focus === 1, L0, y, PW, 44);
    HS.SUITS.forEach((c, i) => {
      const sx = L0 + i * 49, on = S.suit === c, hot = over(sx, y, 44, 44);
      rrect(sx + .5, y + .5, 43, 43, 4); g.fillStyle = '#050a14'; g.fill(); g.strokeStyle = on ? CREW : hot ? '#3a4558' : EDGE; g.stroke();
      g.fillStyle = INK; g.fillRect(sx + 9, y + 9, 26, 26); g.fillStyle = c; g.fillRect(sx + 10, y + 10, 24, 24); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(sx + 10, y + 10, 24, 2);
      if (on) { g.fillStyle = INK; g.fillRect(sx + 17, y + 19, 10, 6); g.fillStyle = '#fff'; g.fillRect(sx + 18, y + 20, 8, 4); }
      hits.push({ id: 'suit:' + c, x: sx, y, w: 44, h: 44 });
    });
    // visor
    y += 66; label('VISOR', y, '[←] [→]');
    y += 26; ring(K.focus === 2, L0, y, PW, 44);
    VISOR_IDS.forEach((v, i) => {
      const bw = (PW - 24) / 4, bx = L0 + i * (bw + 8), on = S.visor === v, hot = over(bx, y, bw, 44), [, v1, v2, v3] = HS.VISORS[v];
      rrect(bx, y, bw, 44, 4); g.fillStyle = on ? 'rgba(120,255,220,.12)' : hot ? '#252e40' : '#1b2230'; g.fill(); g.strokeStyle = on ? CREW : hot ? '#3a4558' : EDGE; rrect(bx + .5, y + .5, bw - 1, 43, 4); g.stroke();
      g.fillStyle = INK; g.fillRect(bx + 10, y + 13, 22, 18); g.fillStyle = v1; g.fillRect(bx + 11, y + 14, 20, 16); g.fillStyle = v2; g.fillRect(bx + 11, y + 14, 20, 3); g.fillStyle = v3; g.fillRect(bx + 13, y + 18, 4, 3);
      text(VISOR_NAME[v], bx + 40, y + 22.5, 14, on ? CREW : C.white, { w: 600 });
      hits.push({ id: 'visor:' + v, x: bx, y, w: bw, h: 44 });
    });
    y += 66; text('Solo run: you cover all four flight stations.', L0, y + 10, 13, C.muted, { w: 500 });
    text('Your suit and visor show in every scene.', L0, y + 32, 13, C.muted, { w: 500 });
    // buttons
    y += 64;
    const btn = (id, s, x, kind) => {
      g.font = font(15); if ('letterSpacing' in g) g.letterSpacing = '0px';
      const w = Math.ceil(g.measureText(s).width) + 42, hot = over(x, y, w, 44), prim = kind === 'primary';
      rrect(x, y, w, 44, 4); g.fillStyle = prim ? (hot ? '#a8ffe8' : CREW) : hot ? '#252e40' : '#1b2230'; g.fill();
      g.strokeStyle = prim ? CREW : hot ? '#3a4558' : EDGE; rrect(x + .5, y + .5, w - 1, 43, 4); g.stroke();
      text(s, x + w / 2, y + 22.5, 15, prim ? INK : C.white, { a: 'center' });
      hits.push({ id, x, y, w, h: 44 }); return w;
    };
    const wb = btn('go', HS.net && HS.net.want ? '[Enter] To the lobby' : '[Enter] To the brief', L0, 'primary'); btn('back', '[Esc] Back', L0 + wb + 10, 'plain');
    // the callsign over the preview, like the film's
    if (S.name) text('▼ ' + S.name, 430, 404 - Math.round(Math.sin(t * 2) * 2), 18, S.suit, { w: 600, a: 'center' });
    text('SUIT-UP BAY', 40, 160, 12, '#5a6886', { ls: 1.5 });
  }

  function act(id) {
    const S = HS.S;
    if (id === 'name') { K.focus = 0; return; }
    if (id.startsWith('suit:')) { S.suit = id.slice(5); K.focus = 1; HS.sfx.blip(); return; }
    if (id.startsWith('visor:')) { S.visor = id.slice(6); K.focus = 2; HS.sfx.blip(); return; }
    if (id === 'go') { HS.saveCrew(); HS.sfx.ok(); HS.go(HS.net && HS.net.want ? 'lobby' : 'brief'); return; }
    if (id === 'back') { HS.saveCrew(); HS.sfx.blip(); HS.go('title'); }
  }
  HS.scenes.crew = {
    enter() { K.t = 0; K.focus = HS.S.name ? 1 : 0; K.hits = []; },
    exit() { HS.typing = false; },
    update(dt) {
      const S = HS.S;
      K.t += dt; HS.typing = K.focus === 0;
      if (HS.hit('ArrowDown', 'Tab')) { K.focus = (K.focus + 1) % 3; HS.sfx.blip(); }
      else if (HS.hit('ArrowUp')) { K.focus = (K.focus + 2) % 3; HS.sfx.blip(); }
      const lr = (HS.hit('ArrowRight') ? 1 : 0) - (HS.hit('ArrowLeft') ? 1 : 0);
      if (K.focus === 0) {
        for (const code of HS.In.hit) { const ch = charOf(code); if (ch && S.name.length < MAX && !(ch === ' ' && !S.name)) { S.name += ch; HS.sfx.type(); } }
        if (HS.hit('Backspace') && S.name) { S.name = S.name.slice(0, -1); HS.sfx.type(); }
      } else {
        if (K.focus === 1 && lr) { const i = HS.SUITS.indexOf(S.suit); S.suit = HS.SUITS[(i + lr + HS.SUITS.length) % HS.SUITS.length]; HS.sfx.blip(); }
        if (K.focus === 2 && lr) { const i = VISOR_IDS.indexOf(S.visor); S.visor = VISOR_IDS[(i + lr + VISOR_IDS.length) % VISOR_IDS.length]; HS.sfx.blip(); }
        if (HS.hit('KeyC')) { const i = HS.SUITS.indexOf(S.suit); S.suit = HS.SUITS[(i + 1) % HS.SUITS.length]; HS.sfx.blip(); }
      }
      if (HS.hit('Enter') && K.t > .3) act('go');
      if (HS.hit('Escape')) act('back');
      if (HS.In.click) { const mx = HS.In.mx * 2, my = HS.In.my * 2, h = K.hits.find(b => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h); if (h) act(h.id); }
    },
    draw() {
      const t = K.t;
      drawPreview(t);
      K.S = HS.scale / 2;
      g.setTransform(K.S, 0, 0, K.S, HS.OX * HS.scale, HS.OY * HS.scale);
      drawPanel(t);
    }
  };
})();
