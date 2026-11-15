// Homestead surface events that keep the crew on their toes; not on Mission Control's list.
//   Suit malfunction (per player, away from the lander): every SUIT_GAP seconds or so a quick-time event: press the
//     three keys shown, in order, within QTE_S seconds. A miss costs SUIT_COST oxygen.
//   Lander relay fault (once a run): the lander stops recharging suits and sending data until someone standing at
//     it clears a five-key repair sequence ([R] to start). A miss just starts the sequence again.
//   Micrometeorites (both planets): rings mark where small rocks will land STRIKE_WARN seconds later. Anyone inside
//     a ring when it lands loses METEOR_COST oxygen; a fresh crater stays behind.
// Everything is seeded (HS.R) and kept as plain data in U.stab and the per-player keys qte / qteAt / qteN, so every
// screen sees the same events. surface.js calls tick (host, before the crew's turns), step (each crew member's
// turn), drawWorld (art layer) and drawHud.
(() => {
  const HS = window.HS, g = HS.g;
  const { T, box, tag, bar, C, clamp } = HS;
  const SUIT_GAP = [45, 75], QTE_S = 3, SUIT_COST = 15;
  const REPAIR_KEYS = 5, REPAIR_S = 6;
  const METEOR_GAP = [16, 26], METEOR_FIRST = 22, STRIKE_WARN = 1.6, METEOR_R = 15, METEOR_COST = 12, CRATERS = 14;
  const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'], NAME = { KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D' };
  // crater colours from the surface ramps in js/surface-art.js: floor, wall, lit rim
  const CRATER = { mars: ['#4f2116', '#733322', '#c37a56'], moon: ['#2e2e35', '#55555c', '#99999f'] };
  const calm = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const rnd = (seed, n) => HS.R(seed * 97 + n * 7919 + 13)();
  const between = (a, b, v) => a + (b - a) * v;
  const idHash = (id) => { let h = 7; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
  const sequence = (seed, n, len) => { const r = HS.R(seed * 131 + n * 17 + len); return Array.from({ length: len }, () => KEYS[(r() * 4) | 0]); };
  // a key press this turn: the first of W/A/S/D pressed, or null
  const pressed = () => KEYS.find(k => HS.hit(k)) || null;

  HS.stability = {
    start(S) {
      return { seed: S.seed, meteors: [], craters: [], next: METEOR_FIRST + rnd(S.seed, 1) * 6, n: 0,
        fault: { at: HS.SURFACE_TIME * between(.3, .5, rnd(S.seed, 2)), on: false, fixed: false, tries: 0, rep: null } };
    },

    // once a tick on the host, before the crew's turns: meteor showers and the lander fault
    tick(U, dt, atLander) {
      const st = U.stab; if (!st) return;
      const S = HS.S, f = st.fault;
      if (!f.on && !f.fixed && U.t >= f.at) { f.on = true; HS.sfx.trip(); HS.log('lander_fault', { left: Math.round(U.left) }); }
      // a shower: one ring near each standing player who is out on the surface
      if (U.t >= st.next) {
        st.n++; st.next = U.t + between(METEOR_GAP[0], METEOR_GAP[1], rnd(st.seed, 10 + st.n));
        const r = HS.R(st.seed * 53 + st.n * 101);
        for (const id of Object.keys(U.ps)) {
          const o = U.ps[id]; if (o.down || atLander(o.p)) continue;
          const a = r() * Math.PI * 2, d = 6 + r() * 22;
          st.meteors.push({ x: clamp(o.p.x + Math.cos(a) * d, 10, 630), y: clamp(o.p.y + Math.sin(a) * d, 14, 390), t: 0 });
        }
        if (st.meteors.length) HS.sfx.warn();
      }
      for (const m of st.meteors) {
        m.t += dt;
        if (m.t >= STRIKE_WARN && !m.hit) {
          m.hit = true; HS.shake(3); HS.sfx.hitHull();
          st.craters.push({ x: m.x, y: m.y, s: 3 + ((m.x * 7 + m.y * 3) | 0) % 3 }); if (st.craters.length > CRATERS) st.craters.shift();
          for (const id of Object.keys(U.ps)) {
            const o = U.ps[id];
            if (!o.down && Math.hypot(o.p.x - m.x, o.p.y - m.y) < METEOR_R) { o.o2 = Math.max(0, o.o2 - METEOR_COST); o.hitT = U.t; HS.log('meteor_hit', { player: id }); }
          }
          for (let i = 0; i < 14; i++) U.fx.add(m.x, m.y, (Math.random() - .5) * 60, -20 - Math.random() * 40, .7, U.mars ? '#d29069' : '#bdbdc3', 1);
        }
      }
      st.meteors = st.meteors.filter(m => m.t < STRIKE_WARN + .3);
    },

    // the lander cannot recharge or send data while its relay is down
    faulty(U) { return !!(U.stab && U.stab.fault.on); },

    // one crew member's turn (inside HS.each). True while a quick-time event has their keys
    step(U, dt, home, note) {
      const st = U.stab; if (!st || U.down) { if (U.qte) U.qte = null; return false; }
      const f = st.fault;
      // the repair sequence at the lander
      if (f.rep && f.rep.who === U.me) {
        if (!home) { f.rep = null; return false; }
        const k = pressed();
        f.rep.t += dt;
        if (k && k === f.rep.keys[f.rep.i]) { f.rep.i++; HS.sfx.weld(); }
        else if (k || f.rep.t > REPAIR_S) { f.tries++; f.rep = null; HS.sfx.jam(); note('Repair slipped. [R] to try again.', C.red); return true; }
        if (f.rep && f.rep.i >= f.rep.keys.length) { f.on = false; f.fixed = true; f.rep = null; HS.sfx.jingle(); HS.log('lander_fixed', { tries: f.tries + 1 }); note('Lander relay repaired: recharging and uplink are back.', C.green, 4); }
        return true;
      }
      if (f.on && !f.rep && home && !U.game && !U.lng && HS.hit('KeyR')) {
        f.rep = { who: U.me, keys: sequence(st.seed, 50 + f.tries, REPAIR_KEYS), i: 0, t: 0 };
        HS.sfx.ok(); return true;
      }
      // the suit malfunction: only out on the surface, never inside another panel
      if (U.qte) {
        const q = U.qte, k = pressed(); q.t += dt;
        if (k && k === q.keys[q.i]) { q.i++; HS.sfx.blip(); }
        else if (k || q.t > QTE_S) {
          U.o2 = Math.max(0, U.o2 - SUIT_COST); U.qte = null; HS.sfx.sad(); HS.shake(3); HS.flash('255,60,60', .25);
          note(`Suit fault not cleared: -${SUIT_COST}% oxygen`, C.red); HS.log('suit_fail', { player: U.me });
          U.qteAt = U.t + between(SUIT_GAP[0], SUIT_GAP[1], rnd(st.seed + idHash(U.me), 300 + U.qteN)); return true;
        }
        if (U.qte && U.qte.i >= U.qte.keys.length) {
          U.qte = null; HS.sfx.good(); note('Suit fault cleared', C.green);
          U.qteAt = U.t + between(SUIT_GAP[0], SUIT_GAP[1], rnd(st.seed + idHash(U.me), 300 + U.qteN));
        }
        return true;
      }
      if (U.qteAt == null) U.qteAt = U.t + between(SUIT_GAP[0], SUIT_GAP[1], rnd(st.seed + idHash(U.me), 200));
      if (!home && !U.game && !U.lng && U.t >= U.qteAt) {
        U.qteN = (U.qteN || 0) + 1;
        U.qte = { keys: sequence(st.seed + idHash(U.me), U.qteN, 3), i: 0, t: 0 };
        HS.sfx.warn(); return true;
      }
      return false;
    },

    // rings and craters on the art layer, under the crew
    drawWorld(x, cam, U, t) {
      const st = U.stab; if (!st) return;
      const col = CRATER[U.mars ? 'mars' : 'moon'], R = (X, Y, w, h, c) => { x.fillStyle = c; x.fillRect(X, Y, w, h); };
      for (const c of st.craters) {
        const [ax, ay] = HS.wa(cam, c.x, c.y), w = c.s * 4, h = c.s * 2;
        if (ax < -40 || ax > 1320 || ay < -40 || ay > 760) continue;
        R(ax - w - 2, ay - h - 1, w * 2 + 4, h * 2 + 2, HS.ART_OUT);
        R(ax - w, ay - h, w * 2, h * 2, col[1]); R(ax - w + 2, ay - h + 2, w * 2 - 4, h * 2 - 3, col[0]);
        R(ax - w, ay + h - 2, w * 2, 2, col[2]);
      }
      for (const m of st.meteors) {
        if (m.hit) continue;
        const [ax, ay] = HS.wa(cam, m.x, m.y), k = clamp(m.t / STRIKE_WARN, 0, 1), rr = METEOR_R * HS.U, blink = calm() || Math.floor(t * (6 + k * 10)) % 2 === 0;
        // the warning ring, dashed in 2-pixel blocks like the shelter rings
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 18) if (blink) R(Math.round(ax + Math.cos(a) * rr) - 1, Math.round(ay + Math.sin(a) * rr * .5) - 1, 2, 2, k > .6 ? '#ff5a50' : '#ffb43c');
        // the rock coming in, falling from above the ring as the warning runs out
        const fy = ay - (1 - k) * 160;
        R(ax - 2, fy - 2, 4, 4, '#ffe6b0'); R(ax - 1, fy - 8, 2, 6, HS.rgba('#ffb43c', .6));
      }
    },

    // the quick-time panels and the fault banner
    drawHud(U, home) {
      const st = U.stab; if (!st || U.down) return;
      const f = st.fault, keysRow = (keys, i, X, Y) => keys.forEach((k, j) => {
        const x0 = X + j * 30, done = j < i, now = j === i;
        g.fillStyle = HS.ART_OUT; g.fillRect(x0 - 1, Y - 1, 26, 26);
        g.fillStyle = done ? '#3fae5a' : now ? '#22303f' : '#151e29'; g.fillRect(x0, Y, 24, 24);
        T(NAME[k], x0 + 12, Y + 13, 12, done ? C.white : now ? C.amber : C.muted, { a: 'center', b: 'middle', w: 700, f: HS.PIX });
      });
      if (U.qte) {
        const q = U.qte, n = q.keys.length, W = n * 30 + 70, X = 320 - W / 2, Y = 120;
        box(X, Y, W, 74, C.red, 6);
        T('SUIT MALFUNCTION', 320, Y + 15, 9, C.red, { a: 'center', w: 700 });
        keysRow(q.keys, q.i, 320 - (n * 30 - 6) / 2, Y + 24);
        bar(X + 10, Y + 60, W - 20, 4, 1 - clamp(q.t / QTE_S, 0, 1), C.red);
      } else if (f.rep && f.rep.who === U.me) {
        const n = f.rep.keys.length, W = n * 30 + 70, X = 320 - W / 2, Y = 120;
        box(X, Y, W, 74, C.amber, 6);
        T('REPAIR THE LANDER RELAY', 320, Y + 15, 9, C.amber, { a: 'center', w: 700 });
        keysRow(f.rep.keys, f.rep.i, 320 - (n * 30 - 6) / 2, Y + 24);
        bar(X + 10, Y + 60, W - 20, 4, 1 - clamp(f.rep.t / REPAIR_S, 0, 1), C.amber);
      }
      if (f.on) tag(home ? (f.rep ? 'Repairing the relay...' : 'LANDER RELAY DOWN: [R] repair it') : 'LANDER RELAY DOWN: no recharge or uplink until someone repairs it', 320, 90, C.amber, 8);
      if (st.meteors.some(m => !m.hit && Math.hypot(U.p.x - m.x, U.p.y - m.y) < METEOR_R + 4)) tag('MICROMETEORITE: step out of the ring!', 320, 106, C.red, 8.5);
    },

    hint(U) {
      if (U.qte) return 'press the keys in order: W A S D';
      if (U.stab && U.stab.fault.rep && U.stab.fault.rep.who === U.me) return 'press the keys in order: W A S D';
      return null;
    }
  };
})();
