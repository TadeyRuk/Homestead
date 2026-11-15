// Homestead phase 1: explore the launch campus, carry parts to the pad, mount them, launch.
(() => {
  const HS = window.HS, g = HS.g;
  const { T, box, bar, tag, C, CAT, PIX, clamp, px, fmt } = HS;
  const SPEED = 58, PAD = HS.PAD, KIOSK = HS.KIOSK;
  const SHOP_COLS = 3, SHOP_ROWS = 2, SHOP_PAGE = SHOP_COLS * SHOP_ROWS;   // the kiosk shop: parts per shelf, shelves per page
  let B = null, sheetOpen = false;   // the [B] sheet is this screen's own view, never sent

  const inSolid = (x, y) => HS.CAMPUS_SOLID.some(([X, Y, w, h]) => x > X - 3 && x < X + w + 3 && y > Y - 2 && y < Y + h + 4);
  const near = (a, bx, by, d) => Math.hypot(a.x - bx, a.y - by) < d;
  const toast = (s, col = C.cyan) => { B.toast = s; B.toastT = 2.4; B.toastCol = col; };
  // paid: the part was bought at the kiosk, so mounting it costs nothing more (HS.spent in state.js)
  const dropAt = (id, x, y, paid) => { let X = x, Y = y, n = 0; while (inSolid(X, Y) && n++ < 20) Y += 6; B.parts.push({ id, x: clamp(X, 8, 632), y: clamp(Y, 12, 392), seen: true, paid: !!paid }); };

  function finishBuild(timeout) {
    const S = HS.S; S.buildLeft = timeout ? 0 : Math.floor(B.left);
    for (const slot of HS.SLOTS) if (!S.slots[slot]) { S.emptyAtTimeout.push(slot); S.salvaged.push(slot); S.slots[slot] = HS.SALVAGE[slot]; }
    HS.spend();
    if (S.spent > S.cap) HS.log('over_budget', { spent: S.spent, cap: S.cap });
    HS.log('build', { slots: Object.assign({}, S.slots), salvaged: S.salvaged.slice(), credits: S.credits, left: S.buildLeft });
    B.done = true; HS.go('launch', '255,255,255');
  }

  // buying from the catalog: the part shown lands in this player's hands, paid in full (HS.spent counts it);
  // going over the cost cap is allowed, and the score pays for it
  function buy(id) {
    const S = HS.S, p = B.p, part = HS.PARTS[id];
    if (p.carry) dropAt(p.carry, p.x + 10, p.y + 4, p.paid);
    p.carry = id; p.paid = true; S.bought.push(id); S.kioskBuys++; HS.spend();
    p.shopAt = p.shop; p.shop = null; p.got = { id, t: 0 };
    HS.sfx.buy(); B.fx.burst(KIOSK.x + 10, KIOSK.y, 30, 46, .9, [C.pink, '#ffffff', C.cyan], 1);
    HS.log('buy', { id, cost: part.cost || 0, t: B.t });
    if (S.spent > S.cap) toast(`Over the cost cap: ${S.spent} of ${S.cap} CR spent`, C.red);
  }

  function interact() {
    const S = HS.S, p = B.p;
    // E means mount only when you carry a part at the pad; with empty hands a part within reach is picked up
    // first, so a part lying beside the pad (where a swapped-out part lands) can be taken from any side
    if (p.carry && near(p, PAD.mx, PAD.my, 26)) {
      const part = HS.PARTS[p.carry], old = S.slots[part.slot], oldPaid = S.paid[part.slot];
      S.slots[part.slot] = p.carry; S.paid[part.slot] = !!p.paid; p.carry = null; p.paid = false; HS.spend(); HS.sfx.mount();
      const i = HS.SLOTS.indexOf(part.slot); B.fx.burst(518 + i * 18, 158, 26, 40, .7, [CAT[part.slot], '#ffffff', C.cyan], 1);
      B.mountFlash = .6;
      if (old) { dropAt(old, PAD.mx - 34 + i * 22, 182, oldPaid); toast(`${part.name} mounted. ${HS.PARTS[old].name} dropped beside the pad.`); }
      else toast(`${part.name} mounted in the ${HS.SLOT_NAME[part.slot].toLowerCase()} slot`);
      HS.log('mount', { id: S.slots[part.slot], t: B.t }); return;
    }
    let best = null, bd = 15;
    for (const q of B.parts) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = q; } }
    if (best) {
      B.parts.splice(B.parts.indexOf(best), 1);
      if (p.carry) dropAt(p.carry, best.x, best.y, p.paid);
      p.carry = best.id; p.paid = !!best.paid; HS.sfx.pick(); return;
    }
    if (near(p, PAD.mx, PAD.my, 26)) { toast('Bring a part here to mount it', C.muted); HS.sfx.buzz(); return; }
    // the kiosk opens its catalog (S6-12) at the page this player last looked at
    if (near(p, KIOSK.sx, KIOSK.sy, 22)) { p.shop = p.shopAt || 0; p.shopAx = 0; p.shopAy = 0; HS.sfx.blip(); return; }
    if (p.carry) { dropAt(p.carry, p.x + (p.flip ? -8 : 8), p.y + 2, p.paid); p.carry = null; p.paid = false; HS.sfx.drop(); }
  }

  HS.scenes.build = {
    enter() {
      sheetOpen = false;
      const S = HS.S, r = HS.R(S.seed * 7 + 3);
      const spots = HS.shuffle(HS.CAMPUS_SPAWNS.filter(([x, y]) => !inSolid(x, y)), r);
      // one part for each slot is always out there; five more are random
      const bySlot = {}; HS.REAL_PARTS.forEach(id => (bySlot[HS.PARTS[id].slot] = bySlot[HS.PARTS[id].slot] || []).push(id));
      const picked = HS.SLOTS.map(s => bySlot[s][(r() * bySlot[s].length) | 0]);
      const rest = HS.shuffle(HS.REAL_PARTS.filter(id => !picked.includes(id)), r).slice(0, 5);
      B = {
        t: 0, left: HS.BUILD_TIME, p: null, ps: {}, me: 'host', done: false,
        parts: picked.concat(rest).map((id, i) => ({ id, x: spots[i][0], y: spots[i][1], seen: false })),
        count: null, naming: null, fx: new HS.Parts(), toast: '', toastT: 0, toastCol: C.cyan, mountFlash: 0, lastTick: 0
      };
      // one avatar per crew member, side by side at the pad; B.p is whoever the update is moving right now
      HS.ids().forEach((id, i) => { B.ps[id] = { x: 520 + i * 14, y: 188, walk: 0, flip: false, face: 'down', carry: null }; });
      B.p = B.ps[HS.net.me] || B.ps.host;
      S.slots = { prop: null, power: null, comms: null, payload: null }; S.bought = []; S.paid = {}; HS.spend(); S.salvaged = []; S.emptyAtTimeout = [];
      toast('Find a part for each of the four slots and carry it to the pad', C.amber); B.toastT = 5;
    },
    update(dt) {
      if (B.done) return;
      // naming the rocket ([N]) stops the build clock, the countdown, the kiosk and everyone's hands until the name
      // is saved or dropped; the campus keeps moving (B.t), and only the namer's keys are read (js/naming.js)
      if (B.naming) { B.t += dt; const r = HS.naming.type(B, dt); if (r === 'saved') { toast(`Rocket named: ${HS.S.rocket}`, C.cyan); B.toastT = 3; } return; }
      B.t += dt; B.left -= dt; B.toastT -= dt; B.mountFlash = Math.max(0, B.mountFlash - dt); B.fx.update(dt);
      if (B.left <= 10 && Math.ceil(B.left) !== B.lastTick) { B.lastTick = Math.ceil(B.left); HS.sfx.tick(); }
      if (B.left <= 0) { toast('Build time is over'); finishBuild(true); return; }
      HS.each((id) => { if (!B.done && B.ps[id]) { B.me = id; B.p = B.ps[id]; this.move(dt); } });
      B.me = HS.net.me; B.p = B.ps[B.me] || B.p;
      if (B.count != null && !B.done) {
        const before = Math.ceil(B.count); B.count -= dt; if (Math.ceil(B.count) !== before && B.count > 0) HS.sfx.tick();
        if (B.count <= 0) finishBuild(false);
      }
    },
    // one crew member's turn: walk, look, pick up and mount, start or stop the countdown
    move(dt) {
      const p = B.p, S = HS.S;
      if (p.got) { p.got.t += dt; if (p.got.t > 1.6) p.got = null; }
      // browsing the shop: the stick (keys or the touch joystick) moves the cursor along the shelves, one step per
      // push: left and right along a shelf, up and down between shelves and pages. E buys, Q or leaving the kiosk
      // closes it. The player stands still while it is open.
      if (p.shop != null) {
        const ax = HS.axis(), n = HS.REAL_PARTS.length;
        if (!near(p, KIOSK.sx, KIOSK.sy, 26) || HS.hit('KeyQ')) { p.shopAt = p.shop; p.shop = null; HS.sfx.blip(); }
        else {
          if (ax.x && ax.x !== p.shopAx) { p.shop = (p.shop + (ax.x > 0 ? 1 : n - 1)) % n; HS.sfx.tick(); }
          if (ax.y && ax.y !== p.shopAy) { p.shop = (p.shop + (ax.y > 0 ? SHOP_COLS : n - SHOP_COLS)) % n; HS.sfx.tick(); }
          p.shopAx = ax.x; p.shopAy = ax.y;
          if (HS.hit('KeyE', 'Space')) buy(HS.REAL_PARTS[p.shop]);
          p.walk = 0;
          return;
        }
      }
      // move
      const a = HS.axis(), len = Math.hypot(a.x, a.y);
      if (len && !p.inspect) {
        const sp = SPEED * (p.carry ? .92 : 1) * dt, nx = clamp(p.x + a.x / len * sp, 6, 634), ny = clamp(p.y + a.y / len * sp, 10, 394);
        if (!inSolid(nx, p.y)) p.x = nx; if (!inSolid(p.x, ny)) p.y = ny;
        p.walk += dt; if (a.x) p.flip = a.x < 0;
        p.face = a.x && Math.abs(a.x) >= Math.abs(a.y) ? 'side' : a.y < 0 ? 'up' : 'down';
        if (Math.random() < .25) B.fx.add(p.x, p.y + 3, (Math.random() - .5) * 8, -4, .35, 'rgba(210,230,220,.5)', 1);
      } else p.walk = 0;
      // camera sees parts
      const cam = HS.camera(p);
      for (const q of B.parts) if (q.x > cam.x && q.x < cam.x + HS.VW && q.y > cam.y && q.y < cam.y + HS.VH) q.seen = true;
      // [I] inspects the part in your hands, or the nearest one at your feet; you stand still while it is open
      if (HS.hit('KeyI')) {
        if (p.inspect) { p.inspect = null; HS.sfx.blip(); }
        else {
          let id = p.carry, bd = 15;
          if (!id) for (const q of B.parts) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; id = q.id; } }
          if (id) { p.inspect = { id, t: 0 }; HS.sfx.scan(); }
          else { toast('Carry a part, or stand by one, to inspect it', C.muted); HS.sfx.buzz(); }
        }
      }
      if (p.inspect) p.inspect.t += dt;
      if (HS.hit('KeyN') && !p.inspect && !(HS.net && HS.net.ask)) { HS.naming.open(B, B.me); return; }
      if (HS.hit('KeyE', 'Space')) { p.inspect = null; interact(); }
      if (HS.hit('KeyQ') && p.carry) { p.inspect = null; dropAt(p.carry, p.x + (p.flip ? -8 : 8), p.y + 2, p.paid); p.carry = null; p.paid = false; HS.sfx.drop(); }
      // launch countdown: anyone at the pad can start it, anyone can cancel it
      if (HS.hit('KeyL') && !p.inspect) {
        if (B.count != null) { B.count = null; toast('Launch cancelled', C.amber); HS.sfx.drop(); }
        else if (near(p, PAD.mx, PAD.my, 30)) { B.count = 5; HS.sfx.warn(); }
        else { toast('Stand at the launch pad to start the countdown', C.muted); HS.sfx.buzz(); }
      }
    },
    // the kiosk shop: a page of parts on two shelves, each drawn with its own pixel art (HS.partIcon, js/art.js) over
    // a cost tag in its slot colour; the cursor's part is described along the bottom with what buying it costs the cap
    catalog(i) {
      const S = HS.S, ids = HS.REAL_PARTS, n = ids.length, pages = Math.ceil(n / SHOP_PAGE), page = Math.floor(i / SHOP_PAGE);
      const id = ids[i], part = HS.PARTS[id], cost = part.cost || 0, after = S.spent + cost, over = after > S.cap;
      const X = 150, Y = 56, W = 340, H = 250, OUT = HS.ART_OUT, slotCol = (s) => (s === 'comms' ? C.cyan : CAT[s]);
      box(X, Y, W, H, C.pink, 6);
      T('SHOP', X + 12, Y + 20, 16, C.pink, { w: 700, f: PIX });
      T('PARTS KIOSK', X + 70, Y + 19, 7, C.muted, { w: 600 });
      T(`${S.spent} of ${S.cap} CR spent`, X + W - 12, Y + 19, 7.5, S.spent > S.cap ? C.red : C.white, { a: 'right', w: 600 });
      // page arrows and dots
      T('<', X + 10, Y + 92, 14, C.muted, { w: 700, f: PIX }); T('>', X + W - 10, Y + 92, 14, C.muted, { w: 700, f: PIX, a: 'right' });
      for (let k = 0; k < pages; k++) { g.fillStyle = k === page ? C.pink : '#3a4452'; g.fillRect(X + W / 2 - pages * 5 + k * 10, Y + 32, 6, 3); }
      g.imageSmoothingEnabled = false;
      const cw = 96, x0 = X + (W - cw * SHOP_COLS) / 2, rows = [Y + 42, Y + 104];
      for (let r = 0; r < SHOP_ROWS; r++) {
        const sy = rows[r] + 40;
        // the shelf: a metal plank with a lit top edge, outlined like the art (js/surface-games.js drawSpot)
        g.fillStyle = OUT; g.fillRect(x0 - 2, sy - 1, cw * SHOP_COLS + 4, 7);
        g.fillStyle = '#8a93a3'; g.fillRect(x0 - 1, sy, cw * SHOP_COLS + 2, 5); g.fillStyle = '#b4bcca'; g.fillRect(x0 - 1, sy, cw * SHOP_COLS + 2, 1);
        for (let c = 0; c < SHOP_COLS; c++) {
          const k = page * SHOP_PAGE + r * SHOP_COLS + c; if (k >= n) continue;
          const pid = ids[k], pp = HS.PARTS[pid], cx = x0 + c * cw + cw / 2, sel = k === i, bob = sel ? Math.round(Math.sin(B.t * 5) * 1.5) : 0;
          if (sel) { g.fillStyle = HS.rgba(C.pink, .16); g.fillRect(cx - 44, rows[r] - 2, 88, 58); g.strokeStyle = C.pink; g.lineWidth = 1.5; g.strokeRect(cx - 44, rows[r] - 2, 88, 58); }
          g.drawImage(HS.partIcon(pid), Math.round(cx - 16), sy - 34 + bob, 32, 32);
          // the cost tag hanging from the shelf
          const tw = HS.tw(`${pp.cost || 0} CR`, 7, { w: 700 }) + 10, tx = Math.round(cx - tw / 2);
          g.fillStyle = OUT; g.fillRect(tx - 1, sy + 6, tw + 2, 11); g.fillStyle = slotCol(pp.slot); g.fillRect(tx, sy + 7, 3, 9);
          g.fillStyle = '#1b2430'; g.fillRect(tx + 3, sy + 7, tw - 3, 9);
          T(`${pp.cost || 0} CR`, cx + 1.5, sy + 14, 7, S.spent + (pp.cost || 0) > S.cap ? C.red : C.amber, { a: 'center', w: 700 });
        }
      }
      // the part under the cursor
      const dy = Y + 176, col = slotCol(part.slot);
      g.fillStyle = 'rgba(150,200,255,.07)'; g.fillRect(X + 10, dy - 6, W - 20, 52);
      T(part.name, X + 16, dy + 8, 11, C.white, { w: 700, f: PIX });
      T(HS.SLOT_NAME[part.slot], X + W - 16, dy + 7, 7, col, { w: 600, a: 'right' });
      T(`${part.mass} kg   ${part.power > 0 ? '+' : ''}${part.power} W   ${part.flight}`, X + 16, dy + 21, 7, C.white);
      T(part.real, X + 16, dy + 32, 6.5, '#f1d9cf');
      T(over ? `${cost} CR: over the cap, ${after} of ${S.cap} CR` : `${cost} CR: ${after} of ${S.cap} CR spent after buying`, X + W - 16, dy + 32, 6.5, over ? C.red : C.muted, { a: 'right' });
      T('[A] [D] [W] [S] or the stick: choose   [E] buy   [Q] close', X + W / 2, Y + H - 10, 7, C.muted, { a: 'center' });
    },

    save() { return HS.pack(B); },
    load(d) { if (!B) return; Object.assign(B, d); B.p = B.ps[HS.net.me] || B.p; },
    // joiner prediction (js/net-game.js): the own avatar in snapshot d, the live one, and one step of this tab's
    // walking with the host's rules; true when it moved
    mine(d) { return d && d.ps ? d.ps[HS.net.me] : null; },
    me() { return B && B.ps[HS.net.me]; },
    predict(q, dt) {
      const p = this.me();
      if (!p || B.done || B.naming || p.shop != null || p.inspect) return false;
      const a = HS.axis(), len = Math.hypot(a.x, a.y);
      if (!len) { q.walk = 0; return false; }
      const sp = SPEED * (p.carry ? .92 : 1) * dt, nx = clamp(q.x + a.x / len * sp, 6, 634), ny = clamp(q.y + a.y / len * sp, 10, 394);
      if (!inSolid(nx, q.y)) q.x = nx; if (!inSolid(q.x, ny)) q.y = ny;
      q.walk += dt; if (a.x) q.flip = a.x < 0;
      q.face = a.x && Math.abs(a.x) >= Math.abs(a.y) ? 'side' : a.y < 0 ? 'up' : 'down';
      return true;
    },
    draw() {
      const S = HS.S, p = B.p, t = B.t, cam = HS.camera(p);
      // ----- world, on the 1280 x 720 art grid (js/campus.js, js/art.js)
      const x = HS.ax, dyn = [];
      dyn.push({ y: 150, draw: (x) => HS.drawBays(x, cam, S.slots, t) });
      for (const q of B.parts) { const [qa, qb] = HS.wa(cam, q.x, q.y); dyn.push({ y: q.y + 2, ghost: [qa - 18, qb - 34, qa + 18, qb + 6], draw: (x) => HS.drawPart(x, cam, q.x, q.y, q.id, t) }); }
      const [pa, pb] = HS.wa(cam, p.x, p.y + 4);
      // who: the van and the crew react to the player; ghost: shown as a silhouette when a building hides it
      dyn.push({ y: p.y + 4, who: { X: p.x, Y: p.y }, ghost: [pa - 19, pb - 80, pa + 19, pb], draw: (x) => {
        const [hx, hy] = HS.drawCrew(x, cam, p.x, p.y, S.suit, { walk: p.walk, flip: p.flip, face: p.face, carry: !!p.carry, t });
        if (p.carry) x.drawImage(HS.partIcon(p.carry), hx - 17, hy - 30 + Math.round(Math.sin(p.walk * 16)));
      } });
      for (const id in B.ps) {
        const o = B.ps[id]; if (o === p) continue;
        const [oa, ob] = HS.wa(cam, o.x, o.y + 4), suit = HS.member(id).suit;
        dyn.push({ y: o.y + 4, ghost: [oa - 19, ob - 80, oa + 19, ob], draw: (x) => {
          const [hx, hy] = HS.drawCrew(x, cam, o.x, o.y, suit, { walk: o.walk, flip: o.flip, face: o.face, carry: !!o.carry, t });
          if (o.carry) x.drawImage(HS.partIcon(o.carry), hx - 17, hy - 30 + Math.round(Math.sin(o.walk * 16)));
        } });
      }
      HS.drawCampus(x, cam, t, dyn, B.count);
      HS.drawFx(x, cam, B.fx);
      HS.blitArt();
      HS.nameTags(cam, B.ps);

      // ----- labels in the world
      for (const [X, Y, s] of HS.CAMPUS_LABELS) { const q = HS.toScreen(cam, X, Y); if (q.x > HS.X0 + 30 && q.x < HS.X1 - 30 && q.y > HS.Y0 + 44 && q.y < HS.Y1 - 30) T(s, q.x, q.y, 7, 'rgba(235,240,245,.55)', { w: 600, a: 'center' }); }
      let nearest = null, nd = 40;
      for (const q of B.parts) {
        const s = HS.toScreen(cam, q.x, q.y), part = HS.PARTS[q.id];
        if (s.x > HS.X0 + 30 && s.x < HS.X1 - 30 && s.y > HS.Y0 + 50 && s.y < HS.Y1 - 50 && !(s.x < HS.X0 + 300 && s.y > HS.Y1 - 164)) tag(part.name, s.x, s.y + 20, part.slot === 'comms' ? C.cyan : CAT[part.slot]);
        const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < nd) { nd = d; nearest = q; }
      }
      const ks = HS.toScreen(cam, KIOSK.x + 10, KIOSK.y - 6); if (ks.x > HS.X0 + 40 && ks.x < HS.X1 - 40 && ks.y > HS.Y0 + 50 && ks.y < HS.Y1 - 30) tag('PARTS KIOSK', ks.x, ks.y - 8, C.pink);
      const ps = HS.toScreen(cam, PAD.x, PAD.y - 46); if (ps.x > HS.X0 + 40 && ps.x < HS.X1 - 40 && ps.y > HS.Y0 + 36 && ps.y < HS.Y1 - 30) tag(HS.rocketName() || 'LAUNCH PAD', ps.x, ps.y, C.cyan);
      HS.arrowReset(); HS.edgeArrow(cam, PAD.mx, PAD.my, C.cyan, 'PAD');
      HS.edgeArrow(cam, KIOSK.sx, KIOSK.sy, C.pink, 'KIOSK');

      // ----- HUD
      const carry = p.carry ? HS.PARTS[p.carry] : null;
      // the HUD is pinned to the screen's corners and edges (HS.X0..X1, Y0..Y1; js/art.js)
      HS.chip('crew', HS.X0 + 8, HS.Y0 + 30, carry ? 'carrying ' + carry.name : 'hands empty');
      const low = B.left < 30;
      HS.topBox('BUILD TIME  ' + fmt(B.left), `slots ${HS.model().mounted} of 4`, low && Math.floor(t * 4) % 2 ? C.red : low ? C.amber : C.white, 320);
      // the rocket as it stands (or would, with the part in your hands or at your feet), as a blueprint
      const pvId = carry ? p.carry : nearest && nd < 15 ? nearest.id : null, pv = pvId ? HS.PARTS[pvId] : null;
      HS.blueprint.panel(pv, pvId);
      const infoId = carry ? p.carry : nearest ? nearest.id : null;
      if (infoId) this.card(infoId, carry ? 'IN YOUR HANDS' : 'NEARBY');

      // prompt for the action E would do right now
      let pr = null, pc = C.cyan;
      const atPad = near(p, PAD.mx, PAD.my, 26), atKiosk = near(p, KIOSK.sx, KIOSK.sy, 22);
      if (p.shop != null) pr = null;
      else if (atPad && carry) { const old = S.slots[carry.slot]; pr = old ? `[E] swap in ${carry.name}, drop ${HS.PARTS[old].name}` : `[E] mount ${carry.name}`; pc = CAT[carry.slot] === '#e6ebf0' ? C.cyan : CAT[carry.slot]; }
      else if (nearest && nd < 15) pr = carry ? `[E] drop ${carry.name}, take ${HS.PARTS[nearest.id].name}` : `[E] pick up ${HS.PARTS[nearest.id].name}  ${HS.PARTS[nearest.id].mass} kg`;
      else if (atKiosk) { pr = '[E] browse the parts catalog'; pc = C.pink; }
      else if (atPad && B.count == null) { const n = 4 - HS.model().mounted; pr = n ? `[L] launch now (${n} empty slot${n > 1 ? 's' : ''} will get salvage parts)` : '[L] start the launch countdown'; pc = C.amber; }
      if (pr) HS.prompt(pr, 320, HS.Y1 - 60, pc);
      if (atPad && B.count == null) {
        const m = HS.model();
        if (m.overweight) tag(`TOO HEAVY: ${m.mass} kg on a ${m.lift} kg engine. It will not reach orbit.`, Math.min(320, HS.X1 - 350), HS.Y0 + 60, C.red, 8.5);
        else if (m.supply && m.draw > m.supply) tag(`POWER SHORT: ${m.draw} W needed, ${m.supply} W supplied. Breakers will trip.`, Math.min(320, HS.X1 - 350), HS.Y0 + 60, C.amber, 8.5);
      }
      if (B.toastT > 0) { g.globalAlpha = clamp(B.toastT * 2, 0, 1); tag(B.toast, 320, HS.Y1 - 38, B.toastCol, 8.5); g.globalAlpha = 1; }
      HS.hint('[E] use   [Q] drop   [L] launch   [I] inspect   [B] blueprint   [N] name   [TAB] map');

      // the catalog this screen's player is browsing, and the card for a part just bought
      if (p.shop != null) this.catalog(p.shop);
      else if (p.got) {
        const res = HS.PARTS[p.got.id];
        g.globalAlpha = clamp((1.6 - p.got.t) * 3, 0, 1);
        box(200, 120, 240, 62, C.pink, 6);
        T(`PARTS KIOSK   -${res.cost || 0} CR`, 320, 138, 9, C.pink, { w: 600, a: 'center' });
        T(res.name, 320, 160, 15, C.cyan, { w: 700, a: 'center', f: PIX });
        T(`in your hands  (${HS.SLOT_NAME[res.slot].toLowerCase()} slot)`, 320, 174, 7.5, C.muted, { a: 'center' });
        g.globalAlpha = 1;
      }
      // the map, the blueprint sheet and the inspector are each screen's own view
      // while the rocket is being named, this screen's own keys belong to the dialog (HS.typing: no mute, no pause)
      HS.typing = !!(B.naming && B.naming.who === HS.net.me);
      const mapHeld = !B.naming && HS.local.down.has('Tab');
      if (HS.pressed.has('KeyB') && !B.naming) sheetOpen = !sheetOpen;
      if (sheetOpen && !mapHeld && !B.naming) HS.blueprint.sheet(t, pv, pvId);
      if (p.inspect && !mapHeld) HS.inspect.panel(p.inspect.id, p.inspect.t, { action: pr || (p.carry === p.inspect.id ? 'carry it to the pad to mount it   [Q] drop it' : ''), left: B.left });
      if (mapHeld) this.map(cam);
      if (B.count != null) {
        HS.fillStage('rgba(4,7,13,.5)');
        const n = Math.ceil(B.count), pop = 1 + (B.count % 1) * .25;
        T('LAUNCH IN ' + n, 320, 170, 34 * pop, C.amber, { w: 700, a: 'center', b: 'middle', f: PIX });
        T('[L] cancel', 320, 204, 9, C.muted, { a: 'center', b: 'middle' });
      }
      if (B.mountFlash > 0) HS.fillStage(`rgba(120,255,220,${B.mountFlash * .25})`);
      HS.naming.dialog(B, t);
    },
    exit() { HS.typing = false; },

    // the part you hold or stand by: the part itself, big, with its numbers as chips (the full specs are on [B])
    card(id, head) {
      const part = HS.PARTS[id], x = HS.X0 + 8, y = HS.Y1 - 140, w = 236, h = 68, col = part.slot === 'comms' ? C.cyan : CAT[part.slot];
      box(x, y, w, h, col, 5);
      g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x + 6, y + 6, 44, 44);
      g.fillStyle = col; g.fillRect(x + 6, y + 48, 44, 2);
      const s = HS.partIcon(id); g.imageSmoothingEnabled = false; g.drawImage(s, x + 11, y + 10, s.width, s.height);
      T(head, x + 56, y + 12, 6.5, C.muted, { w: 600 }); T(HS.SLOT_NAME[part.slot], x + w - 7, y + 12, 6.5, col, { w: 600, a: 'right' });
      T(part.name, x + 56, y + 26, 11, C.white, { w: 700, f: PIX });
      let cx = x + 56;
      const chip = (s2, c) => { const cw = HS.tw(s2, 6.5, { w: 600 }) + 8; g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(cx, y + 31, cw, 10); T(s2, cx + 4, y + 38.5, 6.5, c, { w: 600 }); cx += cw + 3; };
      chip(`${part.mass} kg`, C.white); chip(`${part.power > 0 ? '+' : ''}${part.power} W`, part.power > 0 ? C.green : C.amber);
      if (part.slot !== 'power') chip(HS.blueprint.keyStat(part), col);
      T('FLIGHT', x + 8, y + 57, 5.5, C.muted, { w: 600 }); T(part.flight, x + 40, y + 57, 6.5, C.white);
      T('SURFACE', x + 8, y + 65, 5.5, C.muted, { w: 600 }); T(part.surf, x + 40, y + 65, 6.5, C.white);
      T('[I] inspect', x + w - 7, y + 65, 6.5, C.cyan, { w: 600, a: 'right' });
    },

    map(cam) {
      const x0 = 100, y0 = 44, k = 440 / 640;
      HS.fillStage('rgba(4,7,13,.72)');
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
