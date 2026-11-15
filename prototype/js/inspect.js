// Homestead part inspector: press [I] on the build screen with a part in your hands or at your feet.
// Left: the part itself at 4x on a lit pedestal, scanned, doing what it does (engines fire, the ion grid glows,
// arrays glint, the RTG radiates, antennas send, the laser pulses, the camera flashes, the radar pings).
// Right: every number the game uses for it, ranked against the other parts for the same slot, then what
// mounting it would do to your rocket, before and after, with the rocket drawn as a blueprint.
// The art is on the 1280 x 720 grid (one art pixel = half a HUD unit); the text is real text over it.
(() => {
  const HS = window.HS, g = HS.g, L = HS.liftoff, R = L.R;
  const { T, C, CAT, PIX, clamp, fmt } = HS;
  const SLOTC = (slot) => (slot === 'comms' ? C.cyan : CAT[slot]);
  const easeOut = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
  let calmV = null;
  const calm = () => (calmV ??= !!L.calm());

  // ---------- the numbers: [label, value, shown as, better (hi | lo), what it means]
  const dest = () => (HS.S.mission.id === 'moon' ? 'the Moon' : 'Mars');
  const heatWord = (v) => (v <= 0 ? 'none' : v < .7 ? 'low' : v < 1.2 ? 'medium' : 'high');
  const STATS = {
    prop: [
      ['LIFT', (p) => p.lift, (v) => `${v} kg`, 'hi', 'the most the whole rocket may weigh'],
      ['ACCELERATION', (p) => p.accel, (v) => `+${v.toFixed(2)} km/s a second`, 'hi', 'how fast [W] reaches transfer speed'],
      ['STEERING', (p) => p.turn, (v, p) => ({ pulse: 'fixed pulses', smooth: 'smooth', slow: 'slow, it drifts' })[p.steer], 'hi', 'how the pilot dodges debris'],
      ['FUEL BURN', (p) => p.burn / HS.EVENT_K, (v) => `${v.toFixed(1)}% a second`, 'lo', 'fuel used while thrusting'],
      ['TRAVEL TIME', (p) => p.transit, (v) => fmt(HS.S.mission.transit * v), 'lo', () => `to ${dest()}`]
    ],
    power: [
      ['SUPPLY', (p) => p.power, (v) => `${v} W`, 'hi', 'shared by every system on board'],
      ['SOURCE', (p) => (p.solar ? 0 : 1), (v, p) => p.source || (p.solar ? 'sunlight' : 'radioisotope'), 'none', (p) => (p.solar ? 'weaker far from the Sun, drops in flares' : 'steady through flares and night')],
      // the surface multiplies solar recharge by 0.43 on Mars (surface.js), so rank by what you will actually get
      ['SUIT RECHARGE', (p) => p.recharge * (p.solar && HS.S.mission.id === 'mars' ? .43 : 1), (v) => `${+v.toFixed(1)}% a second`, 'hi', (p) => (p.solar && HS.S.mission.id === 'mars' ? 'at the lander; 43% sunlight on Mars' : 'at the lander, on the surface')],
      ['CORE HEAT', (p) => p.heat, heatWord, 'lo', 'heat the science station must cool'],
      ['DEBRIS TARGET', (p) => p.target, (v) => (v ? `${v} units wider` : 'no wider'), 'lo', 'big arrays get hit more']
    ],
    comms: [
      ['UPLINK', (p) => p.rate, (v) => `${v.toFixed(2)} units a second`, 'hi', 'data home from the lander'],
      ['BEAM WIDTH', (p) => p.beam, (v) => `${v}° either side`, 'hi', 'room to keep Earth in the beam'],
      ['DRIFT', (p) => p.drift, (v) => `${v}x when turning`, 'lo', 'how far the dish wanders'],
      ['DEBRIS WARNING', (p) => p.warn, (v) => `${v} s`, 'hi', 'time the pilot gets to dodge']
    ],
    payload: [
      ['RICH SITE', (p) => p.rich, (v) => `${v} data`, 'hi', 'each scan of a rich site'],
      ['POOR SITE', (p) => p.poor, (v) => `${v} data`, 'hi', 'each scan of a poor site'],
      ['SCAN TIME', (p) => p.scan, (v) => `${v} s`, 'lo', 'holding [E] on a site'],
      ['CORE HEAT', (p) => p.heat, heatWord, 'lo', 'heat the science station must cool']
    ]
  };
  const COMMON = [
    ['MASS', (p) => p.mass, (v) => `${v} kg`, 'lo', 'counts against the engine\'s lift'],
    ['POWER DRAW', (p) => Math.max(0, -p.power), (v) => `${v} W`, 'lo', 'taken from the power supply']
  ];
  const rowsFor = (part) => STATS[part.slot].concat(part.slot === 'power' ? [COMMON[0]] : COMMON);
  const pool = (slot) => Object.keys(HS.PARTS).filter((k) => HS.PARTS[k].slot === slot).map((k) => HS.PARTS[k]);
  // how good a value is among the parts for the same slot, 0 (worst) to 1 (best), and its place
  function standing(row, part) {
    if (row[3] === 'none') return { g: null, others: [], place: '', v: row[1](part) };
    const vals = pool(part.slot).map((p) => row[1](p)), v = row[1](part), lo = Math.min(...vals), hi = Math.max(...vals);
    const good = (x) => (hi === lo ? 1 : row[3] === 'hi' ? (x - lo) / (hi - lo) : (hi - x) / (hi - lo));
    const better = vals.filter((x) => good(x) > good(v) + 1e-9).length, n = vals.length;
    const place = better === 0 ? 'BEST' : better === n - 1 ? 'WORST' : `${better + 1}${['ST', 'ND', 'RD'][better] || 'TH'} OF ${n}`;
    return { g: good(v), others: vals.map(good), place, v };
  }

  // ---------- the specimen: the part at 4x on a pedestal, scanned and animated, drawn at art resolution
  const [sc, sx] = L.make(372, 300);
  // where the 34 x 34 icon lands, and its scale; engines stand higher so their flame clears the pedestal
  const IX = 118, K = 4, FIRES = new Set(['chem', 'solid', 'sal_prop']);
  let IY = 64;
  const at = (u, v) => [IX + u * K, IY + v * K];
  const disc = (x, cx, cy, rx, ry, col) => { for (let y = -ry; y <= ry; y++) { const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / (ry + .5)) ** 2))); R(x, cx - hw, cy + y, hw * 2 + 1, 1, col); } };
  const arc = (x, cx, cy, r, a0, a1, col, step = 1) => { for (let a = a0; a <= a1; a += step / r) R(x, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 2, 2, col); };
  const FLAMES = { chem: ['#fff6d8', '#ffd27a', '#ff9a3c', '#e8501a'], solid: ['#fff0c0', '#ffb050', '#ff6a2a', '#b8401a'], sal_prop: ['#ffe8b0', '#ffb050', '#e8602a', '#8a3a1a'] };
  function flame(x, cx, y0, hw0, len, cols, t, sputter) {
    for (let y = 0; y < len; y++) {
      const k = y / len, hw = hw0 * Math.pow(1 - k, .7) * (1 + .1 * Math.sin(y * .5 + t * 30));
      for (let X = -Math.ceil(hw); X <= hw; X += 2) {
        const d = Math.abs(X) / hw;
        if (d > 1 || (k > .45 && L.bayer(X >> 1, y >> 1) < (k - .45) / .55)) continue;
        if (sputter && ((X * 7 + y * 3 + Math.floor(t * 24)) % 11) === 0) continue;
        R(x, cx + X, y0 + y, 2, 2, cols[d < .3 * (1 - k * .6) ? 0 : d < .62 ? 1 : d < .86 ? 2 : 3]);
      }
    }
  }
  // stateless particles: n points looping along a path, phase from time
  function stream(x, n, t, speed, fn) { for (let i = 0; i < n; i++) { const k = (t * speed + i / n + ((i * 37) % 11) / 23) % 1; fn(k, i); } }
  function effect(x, id, t) {
    const pulse = .5 + .5 * Math.sin(t * 3);
    if (id === 'chem' || id === 'solid' || id === 'sal_prop') {
      const [cx, y0] = at(id === 'sal_prop' ? 16 : 17, id === 'sal_prop' ? 31 : 32);
      const hw = id === 'chem' ? 52 : id === 'solid' ? 26 : 24, len = (id === 'chem' ? 62 : 58) + Math.round(Math.sin(t * 17) * 4);
      x.globalAlpha = .25; disc(x, cx, y0 + 30, hw + 30, 34, '#ff9a3c'); x.globalAlpha = 1;
      flame(x, cx, y0, hw, len, FLAMES[id], t, id === 'sal_prop');
    } else if (id === 'ion') {
      const [cx, cy] = at(17, 14);
      x.globalAlpha = .18 + .14 * pulse; disc(x, cx, cy, 70, 70, '#3ab4e6'); x.globalAlpha = .25 + .2 * pulse; disc(x, cx, cy, 56, 56, '#9ae8ff'); x.globalAlpha = 1;
      stream(x, 26, t, .5, (k, i) => { const a = i * 2.39996, r = 56 + k * 80; x.globalAlpha = 1 - k; R(x, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * .9), 2, 2, i % 3 ? '#9ae8ff' : '#ffffff'); });
      x.globalAlpha = 1;
    } else if (id === 'solar_s' || id === 'solar_l' || id === 'sal_power') {
      // a glint sweeping across the cells, and power rising off them
      const k = (t * .45) % 1.4, gx = IX - 40 + k * 230;
      x.globalAlpha = .55; for (let y = 0; y < 136; y += 2) R(x, Math.round(gx - y * .55), IY + y, 10, 2, '#ffffff'); x.globalAlpha = 1;
      stream(x, 12, t, .45, (k2, i) => { const X = IX + 10 + ((i * 53) % 116), Y = IY + 10 - k2 * 50; x.globalAlpha = 1 - k2; R(x, X, Y, 4, 2, '#ffe680'); R(x, X + 2, Y + 2, 4, 2, '#ffe680'); R(x, X, Y + 4, 4, 2, '#ffd23c'); });
      x.globalAlpha = 1;
    } else if (id === 'rtg') {
      stream(x, 30, t, .55, (k, i) => { const side = i % 2 ? 1 : -1, X = IX + 68 + side * (50 + (i % 5) * 6) + Math.sin(k * 9 + i) * 4, Y = IY + 120 - (i % 7) * 12 - k * 70; x.globalAlpha = (1 - k) * .9; R(x, Math.round(X), Math.round(Y), 2, 2, k < .4 ? '#ffb070' : '#ff7a3c'); });
      x.globalAlpha = .12 + .08 * pulse; disc(x, IX + 68, IY + 70, 80, 70, '#ff7a3c'); x.globalAlpha = 1;
    } else if (id === 'lga' || id === 'dish' || id === 'sal_comms') {
      const [cx, cy] = id === 'dish' ? at(16, 4) : at(17, 1);
      for (let w = 0; w < 4; w++) { const k = ((t * .6) + w / 4) % 1, r = 12 + k * 90; x.globalAlpha = 1 - k; arc(x, cx, cy, r, -Math.PI * .85, -Math.PI * .15, id === 'sal_comms' && w % 2 ? '#9aa2b2' : '#e6ebf0', 3); }
      x.globalAlpha = 1;
    } else if (id === 'laser') {
      const [cx, cy] = at(28, 5), on = (t * 1.2) % 1 < .55;
      if (on) { for (let i = 0; i < 90; i++) { R(x, cx + i, cy - i, 3, 3, i % 9 < 6 ? '#ff5a50' : '#ffd0c8'); } x.globalAlpha = .35; disc(x, cx, cy, 16, 16, '#ff5a50'); x.globalAlpha = 1; }
    } else if (id === 'camera') {
      const [cx, cy] = at(18, 19), k = (t * .5) % 1;
      if (k < .12) { x.globalAlpha = 1 - k / .12; disc(x, cx, cy, 60, 60, '#ffffff'); for (let a = 0; a < 8; a++) { const an = a * Math.PI / 4; for (let r = 30; r < 110; r += 3) R(x, Math.round(cx + Math.cos(an) * r), Math.round(cy + Math.sin(an) * r), 2, 2, '#fff6d8'); } x.globalAlpha = 1; }
    } else if (id === 'spectro') {
      const [cx, cy] = at(27, 6);
      x.globalAlpha = .7; for (let i = 0; i < 60; i++) R(x, cx + 60 - i, cy - 60 + i, 2, 2, (Math.floor(t * 10) + i) % 4 ? '#fff6d8' : '#ffffff'); x.globalAlpha = 1;
      const k = (t * .7) % 1, [wx, wy] = at(9 + k * 14, 14); x.globalAlpha = .6; R(x, Math.round(wx), wy, 6, 24, '#ffffff'); x.globalAlpha = 1;
    } else if (id === 'radar') {
      const [cx, cy] = at(17, 11);
      for (let w = 0; w < 3; w++) { const k = ((t * .5) + w / 3) % 1, r = 20 + k * 100; x.globalAlpha = 1 - k; arc(x, cx, cy, r, -Math.PI * .95, -Math.PI * .05, '#e6b946', 3); }
      x.globalAlpha = 1;
    } else if (id === 'sal_payload') {
      const [cx, cy] = at(15, 17);
      if ((t * 3) % 1 < .25) stream(x, 8, t, 2, (k, i) => { const a = i * 1.7; R(x, Math.round(cx + Math.cos(a) * k * 40), Math.round(cy + Math.sin(a) * k * 40), 2, 2, i % 2 ? '#ffd27a' : '#ffffff'); });
    }
  }
  function specimen(id, t, col) {
    id = HS.look(id);   // new parts borrow an existing part's art (S4-12)
    const x = sx, W = sc.width, H = sc.height;
    IY = FIRES.has(id) ? 34 : 70;
    x.clearRect(0, 0, W, H);
    for (let y = 0; y < H; y++) R(x, 0, y, W, 1, `rgb(${10 + y * .04 | 0},${18 + y * .06 | 0},${32 + y * .1 | 0})`);
    for (let X = 0; X < W; X += 24) R(x, X, 0, 1, H, 'rgba(120,200,255,.06)');
    for (let Y = 0; Y < H; Y += 24) R(x, 0, Y, W, 1, 'rgba(120,200,255,.06)');
    // the pedestal, its rim lit in the slot colour
    const pcx = W >> 1, pcy = 238;
    x.globalAlpha = .1; x.fillStyle = col; x.beginPath(); x.moveTo(pcx - 40, 0); x.lineTo(pcx + 40, 0); x.lineTo(pcx + 120, pcy); x.lineTo(pcx - 120, pcy); x.fill(); x.globalAlpha = 1;
    disc(x, pcx, pcy + 14, 124, 22, HS.ART_OUT); disc(x, pcx, pcy + 10, 122, 20, '#1e2838'); disc(x, pcx, pcy, 120, 18, '#2a3a52'); disc(x, pcx, pcy - 2, 114, 15, '#34465f');
    x.globalAlpha = .55 + .35 * Math.sin(t * 2.2); arc(x, pcx, pcy - 2, 114, 0, Math.PI * 2, col, 2); x.globalAlpha = 1;
    // the shadow, the effect behind, the part, bobbing a pixel at a time
    const bob = calm() ? 0 : Math.round(Math.sin(t * 2) * 2);
    HS.shadow(x, pcx, pcy - 2, 120, 14, .45);
    x.save(); x.translate(0, bob);
    if (!calm()) effect(x, id, t);
    x.imageSmoothingEnabled = false; const s = HS.partIcon(id); x.drawImage(s, IX, IY, s.width * K, s.height * K);
    x.restore();
    // the scanner: a cyan line sweeping down, leaving a faint band
    if (!calm()) {
      const k = (t * .42) % 1.3, y = IY - 10 + k * 170;
      if (k < 1) { x.globalAlpha = .12; R(x, IX - 16, Math.round(y) - 18, 168, 18, '#78ffdc'); x.globalAlpha = .85; R(x, IX - 16, Math.round(y), 168, 2, '#78ffdc'); x.globalAlpha = 1; }
    }
    // corner brackets
    for (const [bx, by, dx, dy] of [[IX - 22, IY - 14, 1, 1], [IX + 158, IY - 14, -1, 1], [IX - 22, IY + 150, 1, -1], [IX + 158, IY + 150, -1, -1]]) { R(x, bx - (dx < 0 ? 18 : 0), by, 18, 2, '#78ffdc'); R(x, bx - (dx < 0 ? 2 : 0), by - (dy < 0 ? 18 : 0), 2, 18, '#78ffdc'); }
    return sc;
  }

  // ---------- the panel, in 640-space HUD units
  const wrap = (s, w, size) => HS.wrap(s, w, size);
  // o: { action: what [E] does now, left: build seconds left }
  function panel(id, t, o = {}) {
    const part = HS.PARTS[id], S = HS.S, col = SLOTC(part.slot), anim = calm() ? 99 : t;
    const k0 = easeOut(anim / .25), X = 26, Y = 18 + (1 - k0) * 8, W = 588, H = 326;
    g.fillStyle = `rgba(4,7,13,${.72 * k0})`; g.fillRect(0, 0, 640, 360);
    g.globalAlpha = k0;
    HS.box(X, Y, W, H, col, 6, 'rgba(8,14,26,.97)');
    T('INSPECT', X + 12, Y + 14, 8, col, { w: 700 });
    T(`${HS.SLOT_NAME[part.slot]}  ·  runs at the ${HS.NAME[HS.SLOT_ROLE[part.slot]].toLowerCase()}'s station`, X + 66, Y + 14, 7, C.muted, { w: 600 });
    T('[I] close', X + W - 12, Y + 14, 7, C.muted, { w: 600, a: 'right' });
    // left: the specimen, the name, what it really is
    const lx = X + 10, sw = 186, shh = sw * sc.height / sc.width;
    g.imageSmoothingEnabled = false; g.drawImage(specimen(id, t, col), lx, Y + 24, sw, shh);
    g.strokeStyle = 'rgba(120,200,255,.25)'; g.lineWidth = .5; g.strokeRect(lx + .25, Y + 24.25, sw - .5, shh - .5);
    let ly = Y + 24 + shh + 16;
    T(part.name, lx, ly, 13, C.white, { w: 700, f: PIX });
    ly += 12; T(part.salvage ? 'SALVAGE  ·  scrap from the yard' : `BASED ON  ${part.real}`, lx, ly, 6.5, part.salvage ? C.amber : '#f1d9cf', { w: 600 });
    ly += 6;
    for (const line of wrap(part.fact || part.real || '', sw, 6.5).slice(0, 6)) { ly += 9; T(line, lx, ly, 6.5, '#c8d2dc'); }
    // right: the numbers
    const rx = X + 212, rw = W - 224;
    T('SPECS', rx, Y + 34, 7.5, C.white, { w: 700 }); T('bars: how it ranks among the parts for this slot', rx + rw, Y + 34, 6, C.muted, { a: 'right' });
    const rows = rowsFor(part);
    rows.forEach((row, i) => {
      const st = standing(row, part), ry = Y + 44 + i * 17, kb = easeOut((anim - .2 - i * .07) / .55);
      T(row[0], rx, ry + 6, 6.5, C.muted, { w: 600 });
      T(typeof row[4] === 'function' ? row[4](part) : row[4], rx, ry + 13.5, 5.5, '#6f7d8c');
      const bx = rx + 96, bw = 112;
      if (st.g == null) { g.globalAlpha = k0 * clamp(kb * 1.5, 0, 1); T(row[2](st.v, part), bx, ry + 7, 7, C.white, { w: 600 }); g.globalAlpha = k0; return; }
      g.fillStyle = '#1e2838'; g.fillRect(bx, ry + 2, bw, 5);
      for (const o of st.others) { g.fillStyle = 'rgba(200,210,225,.45)'; g.fillRect(bx + (.08 + .92 * o) * bw - .5, ry + 1, 1, 7); }
      g.fillStyle = st.g >= .99 ? C.green : st.g <= .01 ? C.red : col; g.fillRect(bx, ry + 2, bw * (.08 + .92 * st.g) * kb, 5);
      g.globalAlpha = k0 * clamp(kb * 1.5, 0, 1);
      T(row[2](st.v, part), bx + bw + 8, ry + 7, 7, C.white, { w: 600 });
      T(st.place, rx + rw, ry + 7, 6.5, st.place === 'BEST' ? C.green : st.place === 'WORST' ? C.red : C.muted, { w: 700, a: 'right' });
      g.globalAlpha = k0;
    });
    // what it would do to your rocket
    const oy = Y + 44 + rows.length * 17 + 8, m = HS.model(), n = HS.model({ [part.slot]: id }), cur = S.slots[part.slot];
    g.fillStyle = 'rgba(120,200,255,.15)'; g.fillRect(rx, oy - 6, rw, .5);
    T('ON YOUR ROCKET', rx, oy + 6, 7.5, C.white, { w: 700 });
    T(cur === id ? 'already mounted' : cur ? `instead of the ${HS.PARTS[cur].name}` : `in the empty ${HS.SLOT_NAME[part.slot].toLowerCase()} slot`, rx + 84, oy + 6, 6.5, C.muted);
    const heat = (mm) => (mm.payload ? mm.payload.heat : 0) + (mm.power ? mm.power.heat : 0), tr = (mm) => (mm.prop ? HS.S.mission.transit * mm.prop.transit : 0);
    const cmp = [
      ['MASS', `${m.mass} kg`, `${n.mass} kg`, m.lift && n.lift ? (n.lift - n.mass) - (m.lift - m.mass) : m.mass - n.mass, n.overweight ? `of ${n.lift} kg lift: too heavy` : n.lift ? `of ${n.lift} kg lift` : 'no engine yet'],
      ['POWER', m.supply ? `${m.draw}/${m.supply} W` : `${m.draw} W`, n.supply ? `${n.draw}/${n.supply} W` : `${n.draw} W`, (n.supply - n.draw) - (m.supply - m.draw), n.supply ? (n.draw > n.supply ? 'short: breakers will trip' : `${n.supply - n.draw} W spare`) : 'no source yet']
    ];
    if (part.slot === 'prop') cmp.push(['TRAVEL', m.prop ? fmt(tr(m)) : '-', fmt(tr(n)), m.prop ? tr(m) - tr(n) : 1, `to ${dest()}`]);
    if (part.slot === 'comms') { cmp.push(['UPLINK', m.comms ? m.comms.rate.toFixed(2) : '0', n.comms.rate.toFixed(2), n.comms.rate - (m.comms ? m.comms.rate : 0), 'units a second']); cmp.push(['WARNING', m.comms ? `${m.comms.warn} s` : '-', `${n.comms.warn} s`, n.comms.warn - (m.comms ? m.comms.warn : 0), 'before debris arrives']); }
    if (part.slot === 'payload') cmp.push(['DATA', m.payload ? `${m.payload.rich}` : '0', `${n.payload.rich}`, n.payload.rich - (m.payload ? m.payload.rich : 0), 'per rich scan']);
    if (part.slot === 'payload' || part.slot === 'power') cmp.push(['CORE HEAT', heatWord(heat(m)), heatWord(heat(n)), heat(m) - heat(n), 'for the science station']);
    cmp.forEach(([name, a, b, d, note], i) => {
      const cy = oy + 18 + i * 12, kc = clamp((anim - .5 - i * .1) / .3, 0, 1);
      if (kc <= 0) return;
      g.globalAlpha = k0 * kc;
      const tone = Math.abs(d) < 1e-9 ? C.white : d > 0 ? C.green : C.red;
      T(name, rx, cy, 6.5, C.muted, { w: 600 }); T(a, rx + 56, cy, 7, '#8a96a6'); T('→', rx + 112, cy, 7, tone, { w: 700 }); T(b, rx + 124, cy, 7, tone, { w: 700 });
      T(note, rx + 180, cy, 6.5, name === 'MASS' && n.overweight ? C.red : name === 'POWER' && n.supply && n.draw > n.supply ? C.amber : C.muted);
      g.globalAlpha = k0;
    });
    {
      const vy = oy + 18 + cmp.length * 12 + 6, kv = clamp((anim - .5 - cmp.length * .1) / .3, 0, 1);
      const v = n.overweight ? ['TOO HEAVY TO REACH ORBIT WITH IT', C.red] : n.supply && n.draw > n.supply ? ['NOT ENOUGH POWER WITH IT', C.amber]
        : n.mounted === 4 ? ['READY TO FLY WITH IT', C.green] : [`FITS: ${n.mounted} OF 4 PARTS WITH IT`, C.cyan];
      if (kv > 0) { g.globalAlpha = k0 * kv; g.fillStyle = v[1]; g.fillRect(rx, vy - 6, 2, 9); T(v[0], rx + 6, vy + 1, 7, v[1], { w: 700 }); g.globalAlpha = k0; }
    }
    // the rocket with this part, as a blueprint, the slot marked
    const bp = HS.blueprint.ink({ prop: '', power: '', comms: '', payload: '', ...Object.fromEntries(HS.SLOTS.map((s) => [s, S.slots[s] || ''])), [part.slot]: id });
    const bx0 = X + W - 12 - bp.c.width / 2 - 6, by0 = oy - 2, bw0 = bp.c.width / 2 + 8, bh0 = bp.c.height / 2 + 8;
    g.fillStyle = '#0f3364'; g.fillRect(bx0, by0, bw0, bh0);
    g.drawImage(bp.c, bx0 + 4, by0 + 4, bp.c.width / 2, bp.c.height / 2);
    const [ax, ay] = bp.anchors[part.slot], r = 4 + (calm() ? 0 : Math.sin(t * 5) * 1.2);
    g.strokeStyle = C.amber; g.lineWidth = .75; g.beginPath(); g.arc(bx0 + 4 + ax / 2, by0 + 4 + ay / 2, r, 0, Math.PI * 2); g.stroke();
    // in play, under the verdict
    const py = oy + 18 + cmp.length * 12 + 34;
    g.fillStyle = 'rgba(120,200,255,.15)'; g.fillRect(rx, py - 10, rw, .5);
    T('IN FLIGHT', rx, py, 6.5, C.muted, { w: 600 }); T(part.flight, rx + 64, py, 7, C.white);
    T('ON THE SURFACE', rx, py + 11, 6.5, C.muted, { w: 600 }); T(part.surf, rx + 64, py + 11, 7, C.white);
    if (o.action) T(o.action, X + 12, Y + H - 9, 6.5, C.cyan, { w: 600 });
    if (o.left != null) T(`build time ${fmt(o.left)}  ·  the clock keeps running`, X + W - 12, Y + H - 9, 6.5, o.left < 30 ? C.amber : C.muted, { a: 'right' });
    g.globalAlpha = 1;
  }

  HS.inspect = { panel, rowsFor, standing };
})();
