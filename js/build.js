// Homestead phase 1: explore the launch campus, carry parts to the pad, mount them, launch.
(() => {
  const HS = window.HS, g = HS.g;
  const { T, box, bar, tag, C, CAT, PIX, clamp, px, fmt } = HS;
  const SPEED = 58, PAD = HS.PAD, KIOSK = HS.KIOSK;
  let B = null;

  const inSolid = (x, y) => HS.CAMPUS_SOLID.some(([X, Y, w, h]) => x > X - 3 && x < X + w + 3 && y > Y - 2 && y < Y + h + 4);
  const near = (a, bx, by, d) => Math.hypot(a.x - bx, a.y - by) < d;
  const toast = (s, col = C.cyan) => { B.toast = s; B.toastT = 2.4; B.toastCol = col; };
  const dropAt = (id, x, y) => { let X = x, Y = y, n = 0; while (inSolid(X, Y) && n++ < 20) Y += 6; B.parts.push({ id, x: clamp(X, 8, 632), y: clamp(Y, 12, 392), seen: true }); };

  function finishBuild(timeout) {
    const S = HS.S; S.buildLeft = timeout ? 0 : Math.floor(B.left);
    for (const slot of HS.SLOTS) if (!S.slots[slot]) { S.emptyAtTimeout.push(slot); S.salvaged.push(slot); S.slots[slot] = HS.SALVAGE[slot]; }
    HS.log('build', { slots: Object.assign({}, S.slots), salvaged: S.salvaged.slice(), credits: S.credits, left: S.buildLeft });
    B.done = true; HS.go('launch', '255,255,255');
  }

  function interact() {
    const S = HS.S, p = B.p;
    if (B.roll) return;
    if (near(p, PAD.mx, PAD.my, 26)) {
      if (!p.carry) { toast('Bring a part here to mount it', C.muted); HS.sfx.buzz(); return; }
      const part = HS.PARTS[p.carry], old = S.slots[part.slot];
      S.slots[part.slot] = p.carry; p.carry = null; HS.sfx.mount();
      const i = HS.SLOTS.indexOf(part.slot); B.fx.burst(518 + i * 18, 158, 26, 40, .7, [CAT[part.slot], '#ffffff', C.cyan], 1);
      B.mountFlash = .6;
      if (old) { dropAt(old, PAD.mx - 34 + i * 22, 182); toast(`${part.name} mounted. ${HS.PARTS[old].name} dropped beside the pad.`); }
      else toast(`${part.name} mounted in the ${HS.SLOT_NAME[part.slot].toLowerCase()} slot`);
      HS.log('mount', { id: S.slots[part.slot], t: B.t }); return;
    }
    let best = null, bd = 15;
    for (const q of B.parts) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = q; } }
    if (best) {
      B.parts.splice(B.parts.indexOf(best), 1);
      if (p.carry) dropAt(p.carry, best.x, best.y);
      p.carry = best.id; HS.sfx.pick(); return;
    }
    if (near(p, KIOSK.sx, KIOSK.sy, 22)) {
      if (S.credits < HS.KIOSK_COST) { toast('Not enough credits for the kiosk', C.red); HS.sfx.buzz(); return; }
      S.credits -= HS.KIOSK_COST; S.kioskBuys++; B.roll = { t: 0, result: HS.REAL_PARTS[(B.kr() * HS.REAL_PARTS.length) | 0] }; HS.sfx.ok(); return;
    }
    if (p.carry) { dropAt(p.carry, p.x + (p.flip ? -8 : 8), p.y + 2); p.carry = null; HS.sfx.drop(); }
  }

  HS.scenes.build = {
    enter() {
      const S = HS.S, r = HS.R(S.seed * 7 + 3);
      const spots = HS.shuffle(HS.CAMPUS_SPAWNS.filter(([x, y]) => !inSolid(x, y)), r);
      // one part for each slot is always out there; five more are random
      const bySlot = {}; HS.REAL_PARTS.forEach(id => (bySlot[HS.PARTS[id].slot] = bySlot[HS.PARTS[id].slot] || []).push(id));
      const picked = HS.SLOTS.map(s => bySlot[s][(r() * 3) | 0]);
      const rest = HS.shuffle(HS.REAL_PARTS.filter(id => !picked.includes(id)), r).slice(0, 5);
      B = {
        t: 0, left: HS.BUILD_TIME, p: { x: 520, y: 188, walk: 0, flip: false, face: 'down', carry: null }, done: false,
        parts: picked.concat(rest).map((id, i) => ({ id, x: spots[i][0], y: spots[i][1], seen: false })),
        kr: HS.R(S.seed * 13 + 101), roll: null, count: null, fx: new HS.Parts(), toast: '', toastT: 0, toastCol: C.cyan, mountFlash: 0, lastTick: 0, map: false
      };
      S.slots = { prop: null, power: null, comms: null, payload: null }; S.credits = S.creditsStart; S.salvaged = []; S.emptyAtTimeout = [];
      toast('Find a part for each of the four slots and carry it to the pad', C.amber); B.toastT = 5;
    },
    update(dt) {
      if (B.done) return;
      const p = B.p, S = HS.S;
      B.t += dt; B.left -= dt; B.toastT -= dt; B.mountFlash = Math.max(0, B.mountFlash - dt); B.fx.update(dt);
      B.map = HS.key('Tab');
      if (B.left <= 10 && Math.ceil(B.left) !== B.lastTick) { B.lastTick = Math.ceil(B.left); HS.sfx.tick(); }
      if (B.left <= 0) { toast('Build time is over'); finishBuild(true); return; }
      // move
      const a = HS.axis(), len = Math.hypot(a.x, a.y);
      if (len && !B.roll) {
        const sp = SPEED * (p.carry ? .92 : 1) * dt, nx = clamp(p.x + a.x / len * sp, 6, 634), ny = clamp(p.y + a.y / len * sp, 10, 394);
        if (!inSolid(nx, p.y)) p.x = nx; if (!inSolid(p.x, ny)) p.y = ny;
        p.walk += dt; if (a.x) p.flip = a.x < 0;
        p.face = a.x && Math.abs(a.x) >= Math.abs(a.y) ? 'side' : a.y < 0 ? 'up' : 'down';
        if (Math.random() < .25) B.fx.add(p.x, p.y + 3, (Math.random() - .5) * 8, -4, .35, 'rgba(210,230,220,.5)', 1);
      } else p.walk = 0;
      // kiosk roll
      if (B.roll) {
        B.roll.t += dt; if (B.roll.t < 2.4 && Math.floor(B.roll.t * 12) !== Math.floor((B.roll.t - dt) * 12)) HS.sfx.tick();
        if (B.roll.t >= 2.4 && !B.roll.given) { B.roll.given = true; if (p.carry) dropAt(p.carry, p.x + 10, p.y + 4); p.carry = B.roll.result; HS.sfx.good(); B.fx.burst(KIOSK.x + 10, KIOSK.y, 30, 46, .9, [C.pink, '#ffffff', C.cyan], 1); }
        if (B.roll.t > 3.6) B.roll = null;
      }
      // camera sees parts
      const cam = HS.camera(p);
      for (const q of B.parts) if (q.x > cam.x && q.x < cam.x + HS.VW && q.y > cam.y && q.y < cam.y + HS.VH) q.seen = true;
      if (HS.hit('KeyE', 'Space')) interact();
      if (HS.hit('KeyQ') && p.carry) { dropAt(p.carry, p.x + (p.flip ? -8 : 8), p.y + 2); p.carry = null; HS.sfx.drop(); }
      // launch countdown: anyone at the pad can start it, anyone can cancel it
      if (HS.hit('KeyL')) {
        if (B.count != null) { B.count = null; toast('Launch cancelled', C.amber); HS.sfx.drop(); }
        else if (near(p, PAD.mx, PAD.my, 30)) { B.count = 5; HS.sfx.warn(); }
        else { toast('Stand at the launch pad to start the countdown', C.muted); HS.sfx.buzz(); }
      }
      if (B.count != null) {
        const before = Math.ceil(B.count); B.count -= dt; if (Math.ceil(B.count) !== before && B.count > 0) HS.sfx.tick();
        if (B.count <= 0) finishBuild(false);
      }
    },
    draw() {
      const S = HS.S, p = B.p, t = B.t, cam = HS.camera(p);
      // ----- world, on the 1280 x 720 art grid (js/campus.js, js/art.js)
      const x = HS.ax, dyn = [];
      dyn.push({ y: 150, draw: (x) => HS.drawBays(x, cam, S.slots, t) });
      for (const q of B.parts) dyn.push({ y: q.y + 2, draw: (x) => HS.drawPart(x, cam, q.x, q.y, q.id, t) });
      dyn.push({ y: p.y + 4, draw: (x) => {
        const [hx, hy] = HS.drawCrew(x, cam, p.x, p.y, S.suit, { walk: p.walk, flip: p.flip, face: p.face, carry: !!p.carry, t });
        if (p.carry) x.drawImage(HS.partIcon(p.carry), hx - 17, hy - 30 + Math.round(Math.sin(p.walk * 16)));
      } });
      HS.drawCampus(x, cam, t, dyn, B.count);
      HS.drawFx(x, cam, B.fx);
      HS.blitArt();

      // ----- labels in the world
      for (const [X, Y, s] of HS.CAMPUS_LABELS) { const q = HS.toScreen(cam, X, Y); if (q.x > 30 && q.x < 610 && q.y > 44 && q.y < 330) T(s, q.x, q.y, 7, 'rgba(235,240,245,.55)', { w: 600, a: 'center' }); }
      let nearest = null, nd = 40;
      for (const q of B.parts) {
        const s = HS.toScreen(cam, q.x, q.y), part = HS.PARTS[q.id];
        if (s.x > 30 && s.x < 610 && s.y > 50 && s.y < 310 && !(s.x < 300 && s.y > 196)) tag(part.name, s.x, s.y + 20, part.slot === 'comms' ? C.cyan : CAT[part.slot]);
        const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < nd) { nd = d; nearest = q; }
      }
      const ks = HS.toScreen(cam, KIOSK.x + 10, KIOSK.y - 6); if (ks.x > 40 && ks.x < 600 && ks.y > 50 && ks.y < 330) tag(`PARTS KIOSK  ${HS.KIOSK_COST} CR`, ks.x, ks.y - 8, C.pink);
      const ps = HS.toScreen(cam, PAD.x, PAD.y - 46); if (ps.x > 40 && ps.x < 600 && ps.y > 36 && ps.y < 330) tag('LAUNCH PAD', ps.x, ps.y, C.cyan);
      HS.arrowReset(); HS.edgeArrow(cam, PAD.mx, PAD.my, C.cyan, 'PAD');
      if (S.credits >= HS.KIOSK_COST) HS.edgeArrow(cam, KIOSK.sx, KIOSK.sy, C.pink, 'KIOSK');

      // ----- HUD
      const carry = p.carry ? HS.PARTS[p.carry] : null;
      HS.chip('crew', 8, 30, carry ? 'carrying ' + carry.name : 'hands empty');
      const low = B.left < 30;
      HS.topBox('BUILD TIME  ' + fmt(B.left), `slots ${HS.model().mounted} of 4`, low && Math.floor(t * 4) % 2 ? C.red : low ? C.amber : C.white, 320);
      this.meters(carry || (nearest && nd < 15 ? HS.PARTS[nearest.id] : null), carry ? p.carry : nearest && nd < 15 ? nearest.id : null);
      const info = carry || (nearest ? HS.PARTS[nearest.id] : null);
      if (info) this.card(info, carry ? 'IN YOUR HANDS' : 'NEARBY');

      // prompt for the action E would do right now
      let pr = null, pc = C.cyan;
      const atPad = near(p, PAD.mx, PAD.my, 26), atKiosk = near(p, KIOSK.sx, KIOSK.sy, 22);
      if (B.roll) pr = null;
      else if (atPad && carry) { const old = S.slots[carry.slot]; pr = old ? `[E] swap in ${carry.name}, drop ${HS.PARTS[old].name}` : `[E] mount ${carry.name}`; pc = CAT[carry.slot] === '#e6ebf0' ? C.cyan : CAT[carry.slot]; }
      else if (nearest && nd < 15) pr = carry ? `[E] drop ${carry.name}, take ${HS.PARTS[nearest.id].name}` : `[E] pick up ${HS.PARTS[nearest.id].name}  ${HS.PARTS[nearest.id].mass} kg`;
      else if (atKiosk) { pr = S.credits >= HS.KIOSK_COST ? `[E] buy a random part  ${HS.KIOSK_COST} CR` : 'kiosk: not enough credits'; pc = C.pink; }
      else if (atPad && B.count == null) { const n = 4 - HS.model().mounted; pr = n ? `[L] launch now (${n} empty slot${n > 1 ? 's' : ''} will get salvage parts)` : '[L] start the launch countdown'; pc = C.amber; }
      if (pr) HS.prompt(pr, 320, 300, pc);
      if (atPad && B.count == null) {
        const m = HS.model();
        if (m.overweight) tag(`TOO HEAVY: ${m.mass} kg on a ${m.lift} kg engine. It will not reach orbit.`, 320, 60, C.red, 8.5);
        else if (m.supply && m.draw > m.supply) tag(`POWER SHORT: ${m.draw} W needed, ${m.supply} W supplied. Breakers will trip.`, 320, 60, C.amber, 8.5);
      }
      if (B.toastT > 0) { g.globalAlpha = clamp(B.toastT * 2, 0, 1); tag(B.toast, 320, 322, B.toastCol, 8.5); g.globalAlpha = 1; }
      HS.hint('[E] use   [Q] drop   [L] launch   [TAB] hold for map');

      // kiosk roll
      if (B.roll) {
        const k = clamp(B.roll.t / 2.4, 0, 1), done = B.roll.t >= 2.4, names = HS.REAL_PARTS.map(id => HS.PARTS[id].name);
        const res = HS.PARTS[B.roll.result], name = done ? res.name : names[Math.floor(Math.pow(k, .45) * 30) % names.length];
        box(200, 110, 240, 86, C.pink, 6);
        T(`PARTS KIOSK   -${HS.KIOSK_COST} CR`, 320, 130, 9, C.pink, { w: 600, a: 'center' });
        T(name, 320, 160, 18, done ? C.cyan : C.white, { w: 700, a: 'center', f: PIX });
        T(done ? `it is in your hands  (${HS.SLOT_NAME[res.slot].toLowerCase()} slot)` : 'rolling...', 320, 182, 8, C.muted, { a: 'center' });
      }
      if (B.map) this.map(cam);
      if (B.count != null) {
        g.fillStyle = 'rgba(4,7,13,.5)'; g.fillRect(0, 0, 640, 360);
        const n = Math.ceil(B.count), pop = 1 + (B.count % 1) * .25;
        T('LAUNCH IN ' + n, 320, 170, 34 * pop, C.amber, { w: 700, a: 'center', b: 'middle', f: PIX });
        T('[L] cancel', 320, 204, 9, C.muted, { a: 'center', b: 'middle' });
      }
      if (B.mountFlash > 0) { g.fillStyle = `rgba(120,255,220,${B.mountFlash * .25})`; g.fillRect(0, 0, 640, 360); }
    },

    // six meters. pv previews what the build becomes if this part is mounted.
    meters(pv, pvId) {
      const S = HS.S, m = HS.model(), n = pv ? HS.model({ [pv.slot]: pvId }) : null, x = 462, y = 30;
      box(x, y, 172, 104, C.cyan, 5); T('LAUNCH PAD', x + 8, y + 13, 8, C.cyan, { w: 600 });
      if (n) T('if mounted', x + 164, y + 13, 7, C.amber, { a: 'right', w: 600 });
      const tr = (mm) => mm.prop ? Math.round(S.mission.transit * mm.prop.transit) : 0;
      const rows = [
        ['MASS', (mm) => mm.lift ? mm.mass / mm.lift : mm.mass / 900, (mm) => mm.lift ? `${mm.mass}/${mm.lift} kg` : `${mm.mass} kg`, (mm) => mm.overweight ? C.red : mm.massFrac > .8 ? C.amber : C.cyan],
        ['POWER', (mm) => mm.supply ? mm.draw / mm.supply : 0, (mm) => mm.supply ? `${mm.draw}/${mm.supply} W` : 'no source', (mm) => mm.supply && mm.draw > mm.supply ? C.red : mm.loadFrac > .85 ? C.amber : C.eng],
        ['BUDGET', () => S.credits / S.creditsStart, () => `${S.credits} CR`, () => C.pink],
        ['DATA', (mm) => mm.payload ? mm.payload.rich / 19 : 0, (mm) => mm.payload ? `${mm.payload.rich} per rich scan` : 'none', () => C.amber],
        ['COMMS', (mm) => mm.comms ? mm.comms.rate / .95 : 0, (mm) => mm.comms ? `${mm.comms.rate.toFixed(2)} units/s` : 'none', () => C.comms],
        ['TIME', (mm) => mm.prop ? 1 - (tr(mm) / (S.mission.transit * 1.3)) + .2 : 0, (mm) => mm.prop ? `flight ${fmt(tr(mm))}` : '-', () => C.green]
      ];
      rows.forEach(([name, f, v, col], i) => {
        const yy = y + 21 + i * 13.5, mm = n || m, changed = n && v(n) !== v(m);
        T(name, x + 8, yy + 7, 7, C.muted, { w: 600 }); bar(x + 46, yy + 1, 50, 6, f(mm), col(mm));
        if (changed) { g.strokeStyle = C.amber; g.lineWidth = 1; g.strokeRect(x + 45.5, yy + .5, 51, 7); }
        T(v(mm), x + 164, yy + 7, 7, changed ? C.amber : C.white, { a: 'right', w: changed ? 600 : 500 });
      });
    },

    card(part, head) {
      const x = 8, y = 232, w = 240, col = part.slot === 'comms' ? C.cyan : CAT[part.slot];
      box(x, y, w, 80, col, 5);
      T(head + '  /  ' + HS.SLOT_NAME[part.slot], x + 8, y + 12, 7, col, { w: 600 });
      T(part.name, x + 8, y + 27, 12, C.white, { w: 700, f: PIX });
      T(`${part.mass} kg`, x + w - 8, y + 12, 7.5, C.white, { a: 'right' });
      T(`${part.power > 0 ? '+' : ''}${part.power} W`, x + w - 8, y + 26, 7.5, part.power > 0 ? C.green : C.amber, { a: 'right', w: 600 });
      T('FLIGHT', x + 8, y + 41, 6.5, C.muted, { w: 600 }); T(part.flight, x + 46, y + 41, 7, C.white);
      T('SURFACE', x + 8, y + 53, 6.5, C.muted, { w: 600 }); T(part.surf, x + 46, y + 53, 7, C.white);
      T('REAL', x + 8, y + 65, 6.5, C.muted, { w: 600 }); T(part.real, x + 46, y + 65, 7, '#f1d9cf');
      T('uses the ' + HS.NAME[HS.SLOT_ROLE[part.slot]].toLowerCase() + '\'s station in flight', x + 8, y + 75, 6, C.muted);
    },

    map(cam) {
      const x0 = 100, y0 = 44, k = 440 / 640;
      g.fillStyle = 'rgba(4,7,13,.72)'; g.fillRect(0, 0, 640, 360);
      box(x0 - 8, y0 - 22, 456, 312, C.cyan, 6);
      T('CAMPUS MAP', x0, y0 - 8, 8.5, C.cyan, { w: 600 }); T('parts appear once you have seen them', x0 + 440, y0 - 8, 7, C.muted, { a: 'right' });
      g.imageSmoothingEnabled = true; g.drawImage(HS.campusMap(), x0, y0, 440, 275); g.imageSmoothingEnabled = false;
      g.fillStyle = 'rgba(4,7,13,.25)'; g.fillRect(x0, y0, 440, 275);
      for (const q of B.parts) if (q.seen) { const part = HS.PARTS[q.id]; g.fillStyle = CAT[part.slot]; g.fillRect(x0 + q.x * k - 3, y0 + q.y * k - 3, 6, 6); g.strokeStyle = '#04070d'; g.lineWidth = 1; g.strokeRect(x0 + q.x * k - 3.5, y0 + q.y * k - 3.5, 7, 7); T(part.name, x0 + q.x * k, y0 + q.y * k - 6, 6.5, C.white, { a: 'center' }); }
      g.strokeStyle = C.white; g.lineWidth = 1; g.strokeRect(x0 + cam.x * k, y0 + cam.y * k, HS.VW * k, HS.VH * k);
      if (Math.floor(B.t * 4) % 2) { g.fillStyle = HS.S.suit; g.fillRect(x0 + B.p.x * k - 2, y0 + B.p.y * k - 2, 5, 5); }
      T('PAD', x0 + PAD.x * k, y0 + PAD.my * k + 16, 7, C.cyan, { a: 'center', w: 600 }); T('KIOSK', x0 + KIOSK.x * k + 7, y0 + KIOSK.sy * k + 6, 7, C.pink, { a: 'center', w: 600 });
      HS.SLOTS.forEach((s, i) => { g.fillStyle = CAT[s]; g.fillRect(x0 + i * 92, y0 + 280, 6, 6); T(HS.SLOT_NAME[s].toLowerCase(), x0 + 10 + i * 92, y0 + 286, 7, C.muted); });
    }
  };
  HS.dbg = HS.dbg || {}; HS.dbg.build = () => B;   // test hook
})();
