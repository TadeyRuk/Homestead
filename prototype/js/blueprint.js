// Homestead rocket blueprint: the build screen's rocket status, drawn as an engineering drawing. The rocket is
// the same sprite the flight scene flies (HS.flightArt.ship, built from the mounted parts), re-inked as white
// lines and pale-blue fills on drafting blue, with leader lines from each part to its specs.
//  - HS.blueprint.panel(pv, pvId): the compact ROCKET panel, always on the build screen (top right)
//  - HS.blueprint.sheet(t):        the full sheet, toggled with [B]
// The art is on the 1280 x 720 grid (one art pixel = half a HUD unit); the text is real text over it.
(() => {
  const HS = window.HS, g = HS.g, L = HS.liftoff;
  const { T, C, CAT, PIX, clamp, fmt } = HS;
  const BLUE = '#0f3364', BLUE2 = '#123b72', INK = '#e8f4ff', INK2 = '#9ccaf6', DIM = '#6fa2d6', AMBER = C.amber;
  const SLOTC = (slot) => (slot === 'comms' ? '#dce8f4' : CAT[slot]);

  // ---------- inking the ship: outline in white, inner edges in pale blue, fills as a light wash
  const inked = new Map();
  function ink(ids) {
    const k = [ids.prop, ids.power, ids.comms, ids.payload].join('|');
    let r = inked.get(k);
    if (r) return r;
    const ship = HS.flightArt.ship(ids), src = ship.c, w = src.width, h = src.height;
    // read the pixels from a scratch canvas made for reading (the sprite's own canvas was already read once)
    const rc = document.createElement('canvas'); rc.width = w; rc.height = h;
    const rx = rc.getContext('2d', { willReadFrequently: true }); rx.drawImage(src, 0, 0);
    const d = rx.getImageData(0, 0, w, h).data;
    const [c, x] = L.make(w, h), out = x.createImageData(w, h), o = out.data;
    const lum = (i) => d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11;
    const set = (i, r0, g0, b0, a0) => { o[i] = r0; o[i + 1] = g0; o[i + 2] = b0; o[i + 3] = a0; };
    for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) {
      const i = (y * w + X) * 4;
      if (!d[i + 3]) continue;
      const l = lum(i), outline = d[i] < 24 && d[i + 1] < 30 && d[i + 2] < 44;
      if (outline) { set(i, 232, 244, 255, 255); continue; }
      const r = X + 1 < w && d[i + 7] ? Math.abs(l - lum(i + 4)) : 0, dn = y + 1 < h && d[i + 4 * w + 3] ? Math.abs(l - lum(i + 4 * w)) : 0;
      if (r > 34 || dn > 34) set(i, 156, 202, 246, 235);
      else set(i, 150, 205, 255, Math.round(255 * (.08 + l / 255 * .2)));
    }
    x.putImageData(out, 0, 0);
    // empty slots: a dashed amber outline where the part will go
    const { CX, BL, BR } = HS.flightArt.SHIP_GEOM, dash = (X0, Y0, ww, hh) => {
      for (let k2 = 0; k2 < ww; k2 += 4) { L.R(x, X0 + k2, Y0, 2, 1, AMBER); L.R(x, X0 + k2, Y0 + hh, 2, 1, AMBER); }
      for (let k2 = 0; k2 < hh; k2 += 4) { L.R(x, X0, Y0 + k2, 1, 2, AMBER); L.R(x, X0 + ww, Y0 + k2, 1, 2, AMBER); }
    };
    if (!ids.prop) dash(CX - 13 + 1, 113, 26, 15);
    if (!ids.power) dash(BR + 3, 60, 20, 22);
    if (!ids.comms) dash(BL - 22, 30, 19, 26);
    if (!ids.payload) dash(CX + 16, 26, 14, 14);
    r = { c, anchors: anchors(ids) };
    inked.set(k, r);
    return r;
  }
  // where each slot's part sits on the ship sprite (art pixels, outline included)
  function anchors(ids) {
    ids = HS.lookSlots(ids);
    const { CX, BL, BR } = HS.flightArt.SHIP_GEOM, P = HS.PARTS;
    const pw = ids.power, cm = ids.comms;
    return {
      prop: [CX + 1, ids.prop === 'ion' ? 123 : 121],
      power: pw === 'rtg' ? [BR + 14, 67] : pw && P[pw] && P[pw].solar ? [BR + (pw === 'solar_l' ? 32 : 14), 73] : [BR + 13, 71],
      comms: cm === 'dish' ? [BL - 14, 47] : cm === 'lga' ? [BL - 7, 31] : cm === 'laser' ? [BL - 20, 33] : cm === 'sal_comms' ? [BL - 8, 33] : [BL - 12, 43],
      payload: [CX + 23, 34]
    };
  }

  // ---------- drafting helpers, in 640-space HUD units (0.5 unit = one pixel at 1280)
  function paper(x, y, w, h, fine = 5, major = 25) {
    g.fillStyle = BLUE; g.fillRect(x, y, w, h);
    for (let X = 0; X <= w; X += fine) { g.fillStyle = X % major ? 'rgba(150,200,255,.07)' : 'rgba(150,200,255,.17)'; g.fillRect(x + X, y, .5, h); }
    for (let Y = 0; Y <= h; Y += fine) { g.fillStyle = Y % major ? 'rgba(150,200,255,.07)' : 'rgba(150,200,255,.17)'; g.fillRect(x, y + Y, w, .5); }
    g.fillStyle = INK2; g.fillRect(x, y, w, .5); g.fillRect(x, y + h - .5, w, .5); g.fillRect(x, y, .5, h); g.fillRect(x + w - .5, y, .5, h);
    g.fillStyle = 'rgba(156,202,246,.55)'; g.fillRect(x + 2.5, y + 2.5, w - 5, .5); g.fillRect(x + 2.5, y + h - 3, w - 5, .5); g.fillRect(x + 2.5, y + 2.5, .5, h - 5); g.fillRect(x + w - 3, y + 2.5, .5, h - 5);
  }
  const hline = (x0, x1, y, col) => { g.fillStyle = col; g.fillRect(Math.min(x0, x1), Math.round(y * 2) / 2, Math.abs(x1 - x0) + .5, .5); };
  const vline = (x, y0, y1, col) => { g.fillStyle = col; g.fillRect(Math.round(x * 2) / 2, Math.min(y0, y1), .5, Math.abs(y1 - y0) + .5); };
  // a leader: a dot on the part, out sideways, then along to the label
  function leader(ax, ay, lx, ly, col) {
    g.fillStyle = col; g.fillRect(ax - 1, ay - 1, 2, 2);
    const mx = lx > ax ? lx - 4 : lx + 4;
    hline(ax, mx, ay, col); vline(mx, ay, ly, col); hline(mx, lx, ly, col);
  }
  const fit = (s, size, max, o) => { if (HS.tw(s, size, o) <= max) return s; while (s.length > 1 && HS.tw(s + '…', size, o) > max) s = s.slice(0, -1); return s + '…'; };
  const ids = (extra) => {
    const s = Object.assign({}, HS.S.slots, extra || {});
    return { prop: s.prop || '', power: s.power || '', comms: s.comms || '', payload: s.payload || '' };
  };
  // the one number that says what a part is for
  function keyStat(part, short) {
    if (!part) return '';
    if (part.slot === 'prop') return `lifts ${part.lift} kg`;
    if (part.slot === 'power') return `+${part.power} W ${part.solar ? 'solar' : 'steady'}`;
    if (part.slot === 'comms') return `${part.rate.toFixed(2)} units/s${short ? '' : ' up'}`;
    return short ? `${part.rich} per rich scan` : `${part.rich} data per rich scan`;
  }
  const flightTime = (m) => (m.prop ? Math.round(HS.S.mission.transit * m.prop.transit) : 0);
  function verdict(m) {
    if (m.mounted < 4) return { s: `${m.mounted} OF 4 PARTS`, col: DIM };
    if (m.overweight) return { s: 'TOO HEAVY', col: C.red };
    if (m.supply && m.draw > m.supply) return { s: 'POWER SHORT', col: AMBER };
    return { s: 'READY TO FLY', col: C.green };
  }
  // a gauge: a track, the current fill, and (when previewing) an amber marker where it would go
  function gauge(x, y, w, f, col, pf) {
    g.fillStyle = 'rgba(150,200,255,.16)'; g.fillRect(x, y, w, 4);
    g.fillStyle = col; g.fillRect(x, y, w * clamp(f, 0, 1), 4);
    if (f > 1) { g.fillStyle = C.red; g.fillRect(x + w - 2, y - 1, 2, 6); }
    if (pf != null) { g.fillStyle = AMBER; g.fillRect(x + w * clamp(pf, 0, 1) - .5, y - 1.5, 1, 7); }
  }

  // ---------- the compact panel (replaces the old LAUNCH PAD text table)
  const SLOT_ORDER = ['payload', 'comms', 'power', 'prop'];
  function panel(pv, pvId) {
    const S = HS.S, m = HS.model(), n = pv ? HS.model({ [pv.slot]: pvId }) : null;
    const W = 182, H = 122, X = HS.X1 - W - 6, Y = HS.Y0 + 30;   // pinned to the top-right corner
    paper(X, Y, W, H);
    // the rocket's name when it has one ([N] names it)
    const nm = HS.rocketName ? HS.rocketName() : '', right = n ? 'IF MOUNTED' : nm ? '[B] blueprint' : '[N] name it';
    const rw = HS.tw(right, 6.5, { w: 600 });
    T(nm ? fit(nm, 8.5, W - rw - 22, { w: 700, f: PIX }) : 'ROCKET', X + 7, Y + 11.5, nm ? 8.5 : 7.5, INK, nm ? { w: 700, f: PIX } : { w: 600 });
    T(right, X + W - 7, Y + 11, 6.5, n ? AMBER : nm ? DIM : AMBER, { w: 600, a: 'right' });
    const shown = ink(ids(n ? { [pv.slot]: pvId } : null)), sx = X + 6, sy = Y + 17;
    g.imageSmoothingEnabled = false; g.drawImage(shown.c, sx, sy, shown.c.width / 2, shown.c.height / 2);
    // callouts down the right-hand side
    const cx = X + 96, cw = W - 102;
    SLOT_ORDER.forEach((slot, i) => {
      const id = n && pv.slot === slot ? pvId : S.slots[slot], part = id ? HS.PARTS[id] : null, prev = n && pv.slot === slot;
      const [ax, ay] = shown.anchors[slot], ly = Y + 22 + i * 17, col = prev ? AMBER : SLOTC(slot);
      leader(sx + ax / 2, sy + ay / 2, cx - 2, ly, prev ? AMBER : 'rgba(232,244,255,.7)');
      g.fillStyle = col; g.fillRect(cx, ly - 2, 3, 3);
      const slotName = HS.SLOT_NAME[slot][0] + HS.SLOT_NAME[slot].slice(1).toLowerCase();
      T(fit(part ? part.name : `${slotName}: empty`, 6.5, cw - 6, { w: 600 }), cx + 6, ly + 1.5, 6.5, part ? (prev ? AMBER : INK) : AMBER, { w: 600 });
      T(fit(part ? keyStat(part, true) : 'salvage at launch', 6, cw - 6), cx + 6, ly + 9.5, 6, part ? col : DIM);
    });
    // mass and power gauges, budget and status along the bottom
    const mm = n || m, gy = Y + 92;
    T('MASS', X + 7, gy + 4, 6, DIM, { w: 600 });
    gauge(X + 34, gy, 70, mm.lift ? mm.mass / mm.lift : mm.mass / 900, mm.overweight ? C.red : mm.massFrac > .8 ? AMBER : C.cyan, n ? null : null);
    T(mm.lift ? `${mm.mass}/${mm.lift} kg` : `${mm.mass} kg`, X + W - 7, gy + 4.5, 6.5, n && n.mass !== m.mass ? AMBER : INK, { a: 'right', w: 600 });
    T('POWER', X + 7, gy + 13, 6, DIM, { w: 600 });
    gauge(X + 34, gy + 9, 70, mm.supply ? mm.draw / mm.supply : 0, mm.supply && mm.draw > mm.supply ? C.red : mm.loadFrac > .85 ? AMBER : C.eng);
    T(mm.supply ? `${mm.draw}/${mm.supply} W` : 'no source', X + W - 7, gy + 13.5, 6.5, n && (n.draw !== m.draw || n.supply !== m.supply) ? AMBER : INK, { a: 'right', w: 600 });
    const v = verdict(mm);
    T(`${S.credits} CR`, X + 7, Y + H - 6, 6.5, C.pink, { w: 600 });
    T(v.s, X + W - 7, Y + H - 6, 6.5, v.col, { w: 700, a: 'right' });
  }

  // ---------- the full sheet ([B])
  function box(slot, bx, by, bw, bh, id, prevId, ax, ay) {
    const part = id ? HS.PARTS[id] : null, sal = HS.PARTS[HS.SALVAGE[slot]], col = SLOTC(slot);
    g.fillStyle = 'rgba(8,30,62,.88)'; g.fillRect(bx, by, bw, bh);
    hline(bx, bx + bw, by, INK2); hline(bx, bx + bw, by + bh, INK2); vline(bx, by, by + bh, INK2); vline(bx + bw, by, by + bh, INK2);
    leader(ax, ay, ax < bx ? bx : bx + bw, by + 10, 'rgba(232,244,255,.75)');
    g.fillStyle = col; g.fillRect(bx + 5, by + 6, 4, 4);
    T(HS.SLOT_NAME[slot], bx + 12, by + 10, 6.5, col, { w: 600 });
    T('→ ' + HS.NAME[HS.SLOT_ROLE[slot]].toLowerCase(), bx + bw - 5, by + 10, 6, DIM, { a: 'right' });
    if (!part) {
      T('EMPTY', bx + 6, by + 24, 10, AMBER, { w: 700, f: PIX });
      T(fit(`launch now and it gets: ${sal.name}`, 6.5, bw - 12), bx + 6, by + 36, 6.5, INK2);
      T(fit(`${keyStat(sal)}, ${sal.mass} kg, free`, 6.5, bw - 12), bx + 6, by + 46, 6.5, DIM);
      T(fit(sal.flight + '. ' + sal.surf + '.', 6, bw - 12), bx + 6, by + 56, 6, DIM);
      return;
    }
    T(fit(part.name, 10, bw - 12, { f: PIX, w: 700 }), bx + 6, by + 24, 10, INK, { w: 700, f: PIX });
    // chips: mass, power, the key number (not for power parts), cost; a chip that would overflow the box is dropped
    let cx = bx + 6;
    const chip = (s, c) => { const w = HS.tw(s, 6, { w: 600 }) + 6; if (cx + w > bx + bw - 4) return; g.fillStyle = 'rgba(150,200,255,.12)'; g.fillRect(cx, by + 29, w, 9); T(s, cx + 3, by + 35.5, 6, c, { w: 600 }); cx += w + 3; };
    chip(`${part.mass} kg`, INK); chip(`${part.power > 0 ? '+' : ''}${part.power} W`, part.power > 0 ? C.green : AMBER); if (slot !== 'power') chip(keyStat(part, slot === 'payload'), col); chip(`${part.cost || 0} CR`, C.pink);
    T('FLIGHT', bx + 6, by + 46, 5.5, DIM, { w: 600 }); T(fit(part.flight, 6, bw - 40), bx + 34, by + 46, 6, INK);
    T('SURFACE', bx + 6, by + 55, 5.5, DIM, { w: 600 }); T(fit(part.surf, 6, bw - 40), bx + 34, by + 55, 6, INK);
    T('REAL', bx + 6, by + 64, 5.5, DIM, { w: 600 }); T(fit(part.real, 6, bw - 40), bx + 34, by + 64, 6, '#f1d9cf');
    if (prevId) T('IF MOUNTED', bx + bw - 5, by + 24, 6, AMBER, { w: 700, a: 'right' });
  }
  function sheet(t, pv, pvId) {
    const S = HS.S, m = HS.model(), n = pv ? HS.model({ [pv.slot]: pvId }) : null, mm = n || m;
    HS.fillStage('rgba(4,7,13,.6)');
    const X = 30, Y = 22, W = 580, H = 318;
    paper(X, Y, W, H, 5, 25);
    T('ROCKET BLUEPRINT', X + 12, Y + 14, 9, INK, { w: 700 });
    const nm = HS.rocketName ? HS.rocketName() : '';
    if (nm) T(nm, X + 112, Y + 14.5, 10, INK, { w: 700, f: PIX });
    T(`${nm ? '' : S.mission.name + '  ·  '}${mm.mounted} of 4 slots filled${nm ? '' : '   ·   [N] name the rocket'}`, nm ? X + 118 + HS.tw(nm, 10, { w: 700, f: PIX }) : X + 112, Y + 14, 7, DIM, { w: 600 });
    T('[B] close', X + W - 12, Y + 14, 7, DIM, { w: 600, a: 'right' });
    // the rocket at 2x, on a dash-dot centre line
    const shown = ink(ids(n ? { [pv.slot]: pvId } : null)), sw = shown.c.width, sh = shown.c.height, sx = 320 - sw / 2, sy = Y + 30;
    for (let y = sy - 6; y < sy + sh + 8; y += 8) { vline(320, y, y + 4, 'rgba(156,202,246,.5)'); vline(320, y + 6, y + 6.5, 'rgba(156,202,246,.5)'); }
    g.imageSmoothingEnabled = false; g.drawImage(shown.c, sx, sy, sw, sh);
    // overall height and span, measured off the drawing in art pixels, as drafting dimensions
    const A = shown.anchors, bw = 178, bh = 70;
    const slotsAt = { comms: [X + 14, Y + 30], payload: [X + W - 14 - bw, Y + 30], prop: [X + 14, Y + 110], power: [X + W - 14 - bw, Y + 110] };
    for (const slot of HS.SLOTS) {
      const id = n && pv.slot === slot ? pvId : S.slots[slot], [bx, by] = slotsAt[slot], [ax, ay] = A[slot];
      box(slot, bx, by, bw, bh, id, n && pv.slot === slot ? pvId : null, sx + ax, sy + ay);
    }
    // totals
    const tx = X + 14, ty = Y + 196;
    T('TOTALS', tx, ty + 8, 7, INK, { w: 700 });
    const rows = [
      ['MASS', mm.lift ? mm.mass / mm.lift : mm.mass / 900, mm.lift ? `${mm.mass} of ${mm.lift} kg lift` : `${mm.mass} kg, no engine`, mm.overweight ? C.red : mm.massFrac > .8 ? AMBER : C.cyan, n && m.lift ? m.mass / m.lift : null],
      ['POWER', mm.supply ? mm.draw / mm.supply : 0, mm.supply ? `${mm.draw} W used of ${mm.supply} W` : 'no power source', mm.supply && mm.draw > mm.supply ? C.red : mm.loadFrac > .85 ? AMBER : C.eng, n && m.supply ? m.draw / m.supply : null],
      ['DATA', mm.payload ? mm.payload.rich / 19 : 0, mm.payload ? `${mm.payload.rich} per rich scan, ${mm.payload.poor} per poor` : 'no instrument', AMBER, null],
      ['UPLINK', mm.comms ? mm.comms.rate / .95 : 0, mm.comms ? `${mm.comms.rate.toFixed(2)} units a second` : 'no antenna', C.comms, null],
      ['FLIGHT', mm.prop ? clamp(1.2 - flightTime(mm) / (S.mission.transit * 1.3), 0, 1) : 0, mm.prop ? `${fmt(flightTime(mm))} to arrive` : 'no engine', C.green, null],
      ['BUDGET', S.credits / S.creditsStart, `${S.credits} CR left, parts worth ${HS.SLOTS.reduce((a, s) => a + ((HS.PARTS[n && pv.slot === s ? pvId : S.slots[s]] || {}).cost || 0), 0)} CR`, C.pink, null]
    ];
    rows.forEach(([name, f, s, col, pf], i) => {
      const ry = ty + 18 + i * 14;
      T(name, tx, ry + 4.5, 6, DIM, { w: 600 }); gauge(tx + 40, ry, 90, f, col, pf);
      T(s, tx + 138, ry + 4.5, 6.5, INK);
    });
    // the verdict, stamped
    const v = verdict(mm);
    g.save(); g.translate(X + 318, Y + 262); g.rotate(-.12);
    const vw = HS.tw(v.s, 12, { w: 700, f: PIX }) + 18;
    g.globalAlpha = .9; g.strokeStyle = v.col; g.lineWidth = 1.5; g.strokeRect(-vw / 2, -12, vw, 24); g.strokeRect(-vw / 2 + 2.5, -9.5, vw - 5, 19);
    T(v.s, 0, 0, 12, v.col, { w: 700, f: PIX, a: 'center', b: 'middle' });
    g.restore();
    // the title block
    const bx = X + W - 14 - 178, by = Y + H - 70, cells = [['PROJECT', 'HOMESTEAD'], ['MISSION', S.mission.name], ['DRAWING', `HS-${S.seed}`], ['DRAWN BY', S.name || 'SOLO CREW'], ['ROCKET', (HS.rocketName && HS.rocketName()) || 'UNNAMED']];
    g.fillStyle = 'rgba(8,30,62,.88)'; g.fillRect(bx, by, 178, 60);
    hline(bx, bx + 178, by, INK2); hline(bx, bx + 178, by + 60, INK2); vline(bx, by, by + 60, INK2); vline(bx + 178, by, by + 60, INK2);
    cells.forEach(([k, v2], i) => {
      const cy = by + i * 12;
      if (i) hline(bx, bx + 178, cy, 'rgba(156,202,246,.45)');
      T(k, bx + 5, cy + 8, 5.5, DIM, { w: 600 }); T(v2, bx + 52, cy + 8.5, 6.5, INK, { w: 600 });
    });
    vline(bx + 48, by, by + 60, 'rgba(156,202,246,.45)');
  }

  HS.blueprint = { panel, sheet, keyStat, ink, ids, paper, COL: { INK, INK2, DIM, AMBER } };
})();
