// Homestead phase 2: travel and maintain. Four stations, one player switching between them.
// Every difficulty number here comes from the part mounted on the campus (see data.js).
(() => {
  const HS = window.HS, g = HS.g;
  const { T, box, bar, tag, C, PIX, clamp, lerp, seg, px, ell, shade } = HS;
  const ST = ['pilot', 'eng', 'comms', 'sci'];
  const SUB = { pilot: 'speed, fuel, hull', eng: 'power and hull', comms: 'keep Earth in the beam', sci: 'core temp and oxygen' };
  const ITEMS = { ice: { col: '#bee6ff', o2: 10, name: 'ice block' }, co2: { col: '#8c9096', o2: 6, name: 'CO2 cartridge' }, food: { col: '#825a3c', o2: 2, name: 'food waste' }, wrench: { col: '#c8ccd4', o2: 0, name: 'wrench' } };
  const LOAD_KEYS = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU'];
  let F = null;

  // joiner prediction for the station controls, eased so it starts and stops softly (see lead() below)
  const ahead = { x: 0, sp: 0, e: 0, v: 0 };
  const loadOn = (k) => { const l = F.loads.find(l => l.key === k); return l.on && F.blackout <= 0; };
  const supply = () => {
    const p = F.m.power; let s = p.power;
    if (p.solar) { s *= lerp(1, HS.S.mission.solarFlight, F.prog); if (F.flare > 0) s *= .55; }
    if (F.temp < 35) s *= .8;
    return s;
  };
  const loadW = () => F.loads.reduce((a, l) => a + (l.on ? l.w : 0), 0) + (F.surge > 0 ? F.surgeW : 0);
  const linkPct = () => { if (!loadOn('comms')) return 0; const k = Math.abs(F.e) / F.m.comms.beam; return k < .4 ? 100 : clamp(100 - (k - .4) / .8 * 100, 0, 100); };

  function endRun(reason) {
    if (F.over) return; F.over = { reason, t: 0 };
    HS.S.ended = { phase: 'flight', reason }; HS.log('lost', { reason, prog: F.prog });
    HS.sfx.boom(); HS.shake(8); HS.flash('255,60,60', .6);
  }
  function hitShip(rock) {
    const S = HS.S, dmg = (5 + rock.s * .9) / HS.EVENT_K;
    S.hull = Math.max(0, S.hull - dmg); S.hits++; if (!rock.warned) S.hitsNoWarn++;
    // which section is hit and the crack's shape come from the run's own damage stream, so the same seed
    // and the same hits give the same repair job (F.dr is separate from F.r, so hits never shift the debris)
    const sec = (F.dr() * 5) | 0; F.sections[sec] = Math.max(0, F.sections[sec] - 34);
    F.speed -= .15; F.fx.burst(F.x, 60, 22, 34, .7, ['#ffd27a', '#ff6a3c', '#ffffff'], 1);
    HS.sfx.hitHull(); HS.shake(7); HS.flash('255,60,60', .35);
    HS.log('hit', { warned: rock.warned, link: Math.round(linkPct()), hull: Math.round(S.hull) });
    if (!F.breach) {
      const r = F.dr, pts = [[364, 120]]; let x = 364, y = 120;
      while (x < 580) { x += 22 + r() * 16; y = clamp(y + (r() - .35) * 44, 96, 300); pts.push([Math.min(x, 596), y]); }
      let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      F.breach = { pts, len, prog: 0, sealant: 100, sec, t: 0 };
    } else S.hull = Math.max(0, S.hull - 3);
    if (S.hull <= 0) endRun('hull');
  }
  function breachPoint(b, prog) {
    let d = prog * b.len;
    for (let i = 1; i < b.pts.length; i++) { const l = Math.hypot(b.pts[i][0] - b.pts[i - 1][0], b.pts[i][1] - b.pts[i - 1][1]); if (d <= l) return [lerp(b.pts[i - 1][0], b.pts[i][0], d / l), lerp(b.pts[i - 1][1], b.pts[i][1], d / l)]; d -= l; }
    return b.pts[b.pts.length - 1];
  }
  function event() {
    const r = F.r, m = F.m, k = r();
    const type = F.events === 0 ? 'debris' : k < .42 ? 'debris' : k < .58 ? 'surge' : k < .72 ? (m.power.solar ? 'flare' : 'surge') : k < .86 ? 'spike' : 'course';
    F.events++;
    if (type === 'debris') {
      const n = 3 + ((r() * 3) | 0);
      for (let i = 0; i < n; i++) F.pending.push({ at: F.t + 6.5 + i * (1.1 + r() * .7), aimed: r() < .45, x: 16 + r() * 128, s: 3 + r() * 3 });
    } else if (type === 'surge') { F.surge = 10; F.surgeW = Math.round((40 + r() * 50) / 5) * 5; F.note('POWER SURGE  +' + F.surgeW + ' W for 10 s', C.eng); HS.sfx.warn(); }
    else if (type === 'flare') { F.flare = 11; F.note('SOLAR FLARE: the arrays drop to 55% for 11 s', C.amber); HS.sfx.warn(); HS.flash('255,240,200', .25); }
    else if (type === 'spike') { F.spike = 13; F.note('CORE SPIKE: the instrument is running hot', C.sci); HS.sfx.warn(); }
    else { const d = (r() < .5 ? -1 : 1) * (.4 + r() * .3); let nt = F.target + d; if (nt < 7.1 || nt > 8.9) nt = F.target - d; F.target = nt; F.note('COURSE CORRECTION: new transfer speed ' + F.target.toFixed(1) + ' km/s', C.pilot); HS.sfx.warn(); }
    const gap = HS.S.mission.eventGap; F.nextEvent = F.t + gap[0] + r() * (gap[1] - gap[0]);
  }

  HS.scenes.flight = {
    enter() {
      const S = HS.S, m = HS.model(), heat = m.payload.heat + m.power.heat;
      F = {
        t: 0, m, r: HS.R(S.seed * 31 + 7), dr: HS.R(S.seed * 41 + 5), prog: 0, D: S.mission.transit * m.prop.transit, st: 0, seats: {}, fx: new HS.Parts(), fx2: [], over: null, done: false,
        x: 80, vx: 0, pulse: 0, pulseDir: 0, speed: 7.3, target: 7.8, thrust: 0, rocks: [], pending: [], sections: [100, 100, 100, 100, 100], breach: null,
        loads: [
          { key: 'comms', name: m.comms.name, w: -m.comms.power, on: true }, { key: 'payload', name: m.payload.name, w: -m.payload.power, on: true },
          { key: 'engine', name: m.prop.name, w: -m.prop.power, on: true }, { key: 'life', name: 'Life support', w: 90, on: true },
          { key: 'pump', name: 'Coolant pump', w: 10, on: true }, { key: 'lights', name: 'Cabin lights', w: 20, on: true }, { key: 'heater', name: 'Galley heater', w: 40, on: true }
        ],
        surge: 0, surgeW: 0, flare: 0, overT: 0, blackout: 0, sup: m.supply,
        e: 0, ev: 0, lockT: 0, link: 100,
        temp: 55, valve: clamp((heat * 5.2 - 1.6) / 9.5, .05, 1), spike: 0, tray: [], throws: [], jam: 0, itemT: 1, popup: null,
        events: 0, nextEvent: 5, noteS: '', noteT: 0, noteCol: C.white, alertBeep: 0,
        note(s, col) { this.noteS = s; this.noteT = 4.5; this.noteCol = col; }
      };
      // online, each crew member starts at their own station (the lobby's order); solo, the one player switches between all four
      HS.ids().forEach((id) => { const mine = HS.rolesOf(id), r = HS.net.seat[id]; F.seats[id] = ST.indexOf(mine.includes(r) ? r : mine[0]); });
      F.st = F.seats[HS.net.me] || 0;
      S.fuel = 100; S.hull = 100; S.cabinO2 = 100; S.instDamage = 0; S.hits = 0; S.hitsNoWarn = 0; S.trips = 0; S.telemetry = 0; S.hotTime = 0;
      F.note('Reach transfer speed: hold [W] at the pilot station', C.pilot);
    },

    update(dt) {
      const S = HS.S, m = F.m;
      if (F.done) return;
      if (F.over) { F.over.t += dt; F.fx.update(dt); if (F.over.t > 3.2) { F.done = true; HS.go('report'); } return; }
      F.t += dt; S.flightTime = F.t; F.noteT -= dt; F.fx.update(dt);
      // each crew member moves between stations on their own; F.st is the station this screen shows
      // online a player may only work the stations they hold; pressing another station asks its holder to swap
      HS.each((id) => {
        const mine = HS.rolesOf(id), moved = HS.net.moved[id];
        let st = F.seats[id] ?? 0;
        if (!mine.includes(ST[st])) st = ST.indexOf(mine.includes(moved) ? moved : mine[0]);   // a swap took this station
        if (!HS.answerRole(id)) {
          const go = (i) => { if (HS.pickRole(id, ST[i], ST[st])) { st = i; HS.sfx.blip(); } };
          for (let i = 0; i < 4; i++) if (HS.hit('Digit' + (i + 1))) go(i);
          if (HS.hit('Tab') && mine.length > 1) { st = ST.indexOf(mine[(mine.indexOf(ST[st]) + 1) % mine.length]); HS.sfx.blip(); }
          for (let i = 0; i < 4; i++) if (HS.In.click && HS.over(214 + i * 46, 4, 42, 22)) { go(i); HS.In.click = false; }
        }
        F.seats[id] = st;
      });
      F.st = F.seats[HS.net.me] ?? 0;
      // the first crew member at a station works its controls
      const at = (st) => HS.ids().find(id => F.seats[id] === ST.indexOf(st));
      const by = (st, fn) => { const id = at(st); if (id) HS.as(id, fn); };
      if (F.t >= F.nextEvent && F.prog < .94) event();
      F.surge -= dt; F.flare -= dt; F.spike -= dt; F.jam -= dt;

      // ----- power bus
      const pump = F.loads[4]; pump.w = Math.round(10 + 35 * F.valve);
      by('eng', () => {
        F.loads.forEach((l, i) => { if (HS.hit(LOAD_KEYS[i]) || (HS.In.click && HS.over(24, 141 + i * 22, 286, 20))) { l.on = !l.on; HS.sfx[l.on ? 'pick' : 'drop'](); } });
      });
      F.sup = supply(); const frac = loadW() / F.sup; F.frac = frac;
      if (F.blackout > 0) { F.blackout -= dt; if (F.blackout <= 0) { F.loads[5].on = false; F.loads[6].on = false; F.note('Breaker reset. Lights and heater were left off.', C.eng); HS.sfx.ok(); } }
      else if (frac > 1) { F.overT += dt; if (F.overT > 4) { F.overT = 0; F.blackout = 4; S.trips++; HS.sfx.trip(); HS.shake(4); HS.flash('0,0,0', .7); F.note('BREAKER TRIPPED: everything is off for 4 s', C.red); HS.log('trip', { load: Math.round(loadW()), supply: Math.round(F.sup), flare: F.flare > 0, surge: F.surge > 0 }); } }
      else F.overT = Math.max(0, F.overT - dt * 2);
      const engineOn = loadOn('engine');

      // ----- pilot
      const heavy = Math.min(1, m.heavy), agility = 1 - .45 * heavy, prop = m.prop;
      let steer = 0;
      const pilot = engineOn && at('pilot');
      if (pilot) HS.as(pilot, () => {
        steer = HS.axis().x;
        if (prop.steer === 'smooth') F.vx = lerp(F.vx, steer * prop.turn * agility, Math.min(1, dt * 9));
        else if (prop.steer === 'slow') F.vx = clamp(F.vx + steer * prop.turn * 1.6 * agility * dt, -prop.turn * agility, prop.turn * agility) * (steer ? 1 : Math.max(0, 1 - dt * 1.2));
        else { // solid motor: fixed pulses
          F.pulse -= dt;
          if (steer && F.pulse <= -.2) { F.pulse = .14; F.pulseDir = steer; S.fuel -= prop.burn * .09 / HS.EVENT_K; HS.sfx.tick(); }
          F.vx = F.pulse > 0 ? F.pulseDir * prop.turn * 1.9 * agility : 0;
        }
        const th = (HS.key('KeyW', 'ArrowUp') ? 1 : 0) - (HS.key('KeyS', 'ArrowDown') ? 1 : 0);
        F.thrust = th;
        if (th) { F.speed = clamp(F.speed + th * prop.accel * dt, 5, 10); S.fuel -= prop.burn * (1 + heavy * .5) * dt / HS.EVENT_K; }
        if (prop.steer !== 'pulse' && steer) S.fuel -= prop.burn * .12 * dt / HS.EVENT_K;
      }); else { F.thrust = 0; F.vx = prop.steer === 'slow' ? F.vx * Math.max(0, 1 - dt * 1.2) : 0; }
      F.x = clamp(F.x + F.vx * dt, 12, 148); if (F.x <= 12 || F.x >= 148) F.vx = 0;
      if (F.thrust || F.t < 1) F.fx.add(F.x + (Math.random() - .5) * 2, 70, (Math.random() - .5) * 6, 26 + Math.random() * 20, .4, Math.random() < .5 ? '#ff9a3c' : '#fff0c8', 1);
      // debris
      const link = F.link = linkPct();
      for (let i = F.pending.length - 1; i >= 0; i--) {
        const pd = F.pending[i], eta = pd.at - F.t;
        if (!pd.warned && link > 60 && eta <= m.comms.warn) { pd.warned = true; HS.sfx.warn(); }
        if (eta <= 0) { F.pending.splice(i, 1); F.rocks.push({ x: pd.aimed ? clamp(F.x + (F.r() - .5) * 10, 12, 148) : pd.x, y: -8, s: pd.s, warned: !!pd.warned, rot: F.r() * 6 }); }
      }
      for (let i = F.rocks.length - 1; i >= 0; i--) {
        const rk = F.rocks[i]; rk.y += 24 * dt; rk.rot += dt;
        if (Math.abs(rk.x - F.x) < rk.s + 3 + m.power.target && Math.abs(rk.y - 63) < rk.s + 5) { F.rocks.splice(i, 1); hitShip(rk); continue; }
        if (rk.y > 100) F.rocks.splice(i, 1);
      }
      if (S.fuel <= 0) { S.fuel = 0; endRun('fuel'); return; }
      const off = Math.abs(F.speed - F.target), rate = off <= .25 ? 1 : lerp(1, .55, clamp((off - .25) / .6, 0, 1));
      F.rate = rate; F.prog += dt / F.D * rate * (F.blackout > 0 ? .5 : 1);

      // ----- hull breach and welding
      if (F.breach) {
        const b = F.breach; b.t += dt; S.cabinO2 -= .6 * dt; S.hull = Math.max(0, S.hull - .22 * dt);
        by('eng', () => {
          const [hx, hy] = breachPoint(b, b.prog), onLine = Math.hypot(HS.In.mx - hx, HS.In.my - hy) < 16;
          if ((HS.In.mdown && onLine && b.sealant > 0) || HS.key('KeyF')) {
            b.prog += dt * (HS.key('KeyF') && !(HS.In.mdown && onLine) ? .1 : .24);
            if (Math.random() < .7) F.fx2.push({ x: hx, y: hy, vx: (Math.random() - .5) * 90, vy: -Math.random() * 70, life: .35, col: Math.random() < .5 ? '#fff6c8' : '#ffc85a' });
            if (Math.random() < .2) HS.sfx.weld();
          } else if (HS.In.mdown && HS.over(332, 60, 300, 290)) b.sealant = Math.max(0, b.sealant - 26 * dt);
          else b.sealant = Math.min(100, b.sealant + 8 * dt);
        });
        if (b.prog >= 1) { F.sections[b.sec] = 70; HS.log('weld', { t: b.t }); F.breach = null; HS.sfx.good(); F.note('Breach sealed after ' + b.t.toFixed(0) + ' s', C.green); }
        if (S.hull <= 0) { endRun('hull'); return; }
      }
      for (let i = F.fx2.length - 1; i >= 0; i--) { const p = F.fx2[i]; p.life -= dt; p.vy += 200 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.life <= 0) F.fx2.splice(i, 1); }

      // ----- comms dish
      const c = m.comms;
      F.ev += ((F.r() - .5) * 26 * c.drift + F.e * .22 * c.drift + (F.vx / 70) * 30 * c.drift) * dt;
      by('comms', () => { F.ev -= HS.axis().x * -40 * dt; });
      F.ev *= Math.max(0, 1 - 1.3 * dt); F.e = clamp(F.e + F.ev * dt, -48, 48); if (Math.abs(F.e) >= 48) F.ev = 0;
      F.lockT = link >= 95 ? F.lockT + dt : 0;
      S.telemetry += c.rate * (F.lockT > 2 ? 2 : 1) * link / 100 * dt;

      // ----- science: core and oxygen
      by('sci', () => { F.valve = clamp(F.valve - HS.axis().y * .55 * dt, 0, 1); });
      const heat = (loadOn('payload') ? m.payload.heat : 0) + m.power.heat + (F.spike > 0 ? .7 : 0);
      F.temp = clamp(F.temp + (heat * 5.2 - (loadOn('pump') ? F.valve : 0) * 9.5 - 1.6) * dt, 0, 100);
      if (F.temp > 75) { S.instDamage = Math.min(60, S.instDamage + 1.4 * dt); S.hotTime += dt; }
      const life = loadOn('life'); S.cabinO2 -= (life ? .42 : 1.3) * dt;
      F.itemT -= dt;
      if (F.itemT <= 0 && F.tray.length < 6) { F.itemT = 2.6; const k = F.r(); F.tray.push({ type: k < .36 ? 'ice' : k < .66 ? 'co2' : k < .85 ? 'food' : 'wrench', born: F.t }); }
      by('sci', () => {
        let pick = -1;
        if (HS.In.click) F.tray.forEach((it, i) => { if (HS.over(344 + i * 21, 300, 20, 30)) pick = i; });
        if (HS.hit('Space') && F.tray.length) pick = 0;
        if (pick >= 0) {
          if (F.jam > 0 || !life) { HS.sfx.buzz(); F.popup = { s: life ? 'intake jammed' : 'life support is off', t: 1.5, col: C.red }; }
          else { const it = F.tray.splice(pick, 1)[0]; F.throws.push({ type: it.type, t: 0, from: 354 + pick * 21 }); HS.sfx.pick(); }
        }
      });
      for (let i = F.throws.length - 1; i >= 0; i--) {
        const th = F.throws[i]; th.t += dt;
        if (th.t >= .6) {
          F.throws.splice(i, 1); const it = ITEMS[th.type];
          if (th.type === 'wrench') { F.jam = 5; HS.sfx.jam(); HS.shake(3); F.popup = { s: 'a wrench jammed the intake for 5 s', t: 2.2, col: C.red }; }
          else { S.cabinO2 = Math.min(100, S.cabinO2 + it.o2); HS.sfx.good(); F.popup = { s: `${it.name}  +${it.o2}% O2`, t: 1.8, col: C.cyan }; for (let k = 0; k < 10; k++) F.fx2.push({ x: 552 + (Math.random() - .5) * 30, y: 96, vx: (Math.random() - .5) * 40, vy: -30 - Math.random() * 40, life: .5, col: '#6ec8f0' }); }
        }
      }
      if (F.popup) { F.popup.t -= dt; if (F.popup.t <= 0) F.popup = null; }
      if (S.cabinO2 <= 0) { S.cabinO2 = 0; endRun('oxygen'); return; }

      // ----- alerts
      F.alerts = this.alerts();
      F.alertBeep -= dt;
      if (F.alertBeep <= 0 && F.alerts.some((a, i) => a && a.sev === 2 && i !== F.st)) { F.alertBeep = 2.2; HS.sfx.warn(); }
      if (F.prog >= 1) { F.done = true; HS.log('arrive', { fuel: Math.round(S.fuel), hull: Math.round(S.hull), dmg: Math.round(S.instDamage), t: Math.round(F.t) }); HS.sfx.jingle(); HS.go('landing'); }
    },

    save() { return HS.pack(F); },
    // joiner prediction (js/net-game.js): after a snapshot is drawn, push this player's own station control
    // ahead by what their keys will have done by the time the host's answer arrives, T seconds from now. The
    // stick, the dish and the valve answer at once; the next snapshot replaces all of it, so nothing builds up.
    lead(T, dt) {
      if (!F || F.done || F.over) return;
      const role = ST[F.st], ax = HS.axis(), m = F.m, prop = m.prop, engine = role === 'pilot' && loadOn('engine');
      const th = engine ? (HS.key('KeyW', 'ArrowUp') ? 1 : 0) - (HS.key('KeyS', 'ArrowDown') ? 1 : 0) : 0;
      // the rates the host applies: steering at the engine's turn rate (a pulse motor averages about the same),
      // thrust at its acceleration, the dish settling near 30 a second, the valve at .55 a second
      const want = {
        x: engine ? ax.x * prop.turn * (1 - .45 * Math.min(1, m.heavy)) * T : 0,
        sp: th * prop.accel * T,
        e: role === 'comms' ? ax.x * 30 * T : 0,
        v: role === 'sci' ? -ax.y * .55 * T : 0
      };
      const k = Math.min(1, dt * 10);
      for (const n in ahead) ahead[n] += (want[n] - ahead[n]) * k;
      F.x = clamp(F.x + ahead.x, 12, 148); F.speed = clamp(F.speed + ahead.sp, 5, 10);
      F.e = clamp(F.e + ahead.e, -48, 48); F.valve = clamp(F.valve + ahead.v, 0, 1);
    },
    load(d) { if (!F) return; Object.assign(F, d); F.st = F.seats[HS.net.me] ?? F.st; },

    alerts() {
      const S = HS.S, m = F.m, out = [null, null, null, null];
      const warned = F.pending.filter(p => p.warned), eta = warned.length ? Math.min(...warned.map(p => p.at - F.t)) : 0;
      if (warned.length) out[0] = { sev: 2, s: `debris in ${Math.max(0, Math.ceil(eta))} s` };
      else if (F.rocks.length) out[0] = { sev: 2, s: 'debris, no warning' };
      else if (S.fuel < 20) out[0] = { sev: 2, s: 'fuel low' };
      else if (Math.abs(F.speed - F.target) > .25) out[0] = { sev: 1, s: 'off transfer speed' };
      if (F.blackout > 0) out[1] = { sev: 2, s: 'breaker tripped' };
      else if (F.frac > 1) out[1] = { sev: 2, s: `overload, trips in ${Math.max(1, Math.ceil(4 - F.overT))} s` };
      else if (F.breach) out[1] = { sev: 2, s: 'hull breach' };
      else if (F.frac > .9) out[1] = { sev: 1, s: 'bus near its limit' };
      if (F.link < 60) out[2] = { sev: m.comms.warn > 2 ? 2 : 1, s: 'link down, no debris warning' };
      if (F.temp > 75) out[3] = { sev: 2, s: 'core too hot' };
      else if (S.cabinO2 < 35) out[3] = { sev: 2, s: 'cabin oxygen low' };
      else if (F.temp < 35) out[3] = { sev: 1, s: 'core too cold' };
      else if (S.cabinO2 < 55) out[3] = { sev: 1, s: 'oxygen falling' };
      else if (F.temp > 68) out[3] = { sev: 1, s: 'core warming' };
      return out;
    },

    draw() {
      const S = HS.S, role = ST[F.st], t = F.t;
      this[role]();
      if (F.blackout > 0) { HS.fillStage('rgba(2,3,8,.72)'); if (Math.floor(t * 6) % 2) T('BREAKER TRIPPED', 320, 180, 22, C.red, { w: 700, a: 'center', b: 'middle', f: PIX }); T('resets in ' + Math.ceil(F.blackout) + ' s', 320, 204, 9, C.muted, { a: 'center', b: 'middle' }); }
      // station tabs, with alerts from the other stations
      // the shared HUD is pinned to the top edge and corners of the screen (js/art.js)
      const Y0 = HS.Y0;
      HS.chip(role, HS.X0 + 8, Y0 + 6, SUB[role]);
      const al = F.alerts || [null, null, null, null];
      const mine = HS.rolesOf(HS.net.me);
      ST.forEach((r, i) => {
        g.globalAlpha = mine.includes(r) ? 1 : .4;   // a station someone else holds: press it to ask for a swap
        const x = 214 + i * 46, on = i === F.st, a = al[i], blink = a && Math.floor(t * (a.sev === 2 ? 5 : 2)) % 2;
        const edge = a ? (a.sev === 2 ? C.red : C.amber) : on ? C[r] : '#3a4a62';
        box(x, Y0 + 4, 42, 22, edge, 4, a && blink ? HS.rgba(a.sev === 2 ? C.red : C.amber, .3) : on ? HS.rgba(C[r], .2) : 'rgba(8,14,26,.9)');
        T(`[${i + 1}]`, x + 4, Y0 + 13, 6.5, C.muted, { b: 'middle' }); T(['PILOT', 'ENG', 'COMMS', 'SCI'][i], x + 38, Y0 + 13, 6.5, on ? C.white : C[r], { w: 600, a: 'right', b: 'middle' });
        g.fillStyle = a ? edge : C[r]; g.fillRect(x + 4, Y0 + 20, 34, 2);
        g.globalAlpha = 1;
      });
      const ask = HS.askLine && HS.askLine();
      if (ask) HS.prompt(ask[0], 320, 40, ask[1]);
      const worst = al.map((a, i) => a && Object.assign({ i }, a)).filter(a => a && a.i !== F.st).sort((a, b) => b.sev - a.sev)[0];
      if (worst) { const col = worst.sev === 2 ? C.red : C.amber; tag(`[${worst.i + 1}] ${HS.NAME[ST[worst.i]]}: ${worst.s}`, 306, Y0 + 34, col, 7); }
      // transit box
      const m = S.mission, days = Math.round(m.days * clamp(F.prog, 0, 1));
      const TX = HS.X1 - 196;
      box(TX, Y0 - 4, 188, 46, C.cyan, 5);
      T(`${m.short.toUpperCase()} TRANSIT  ${Math.floor(clamp(F.prog, 0, 1) * 100)}%`, TX + 8, Y0 + 9, 8.5, C.white, { w: 600, b: 'middle' });
      T(m.id === 'moon' ? `T+ ${(m.days * clamp(F.prog, 0, 1) * 24).toFixed(0)} hours` : `T+ ${days} days`, TX + 180, Y0 + 9, 7, C.muted, { a: 'right', b: 'middle' });
      bar(TX + 8, Y0 + 17, 172, 4, F.prog, F.rate < 1 ? C.amber : C.cyan);
      T(F.rate < 1 ? 'slow: off the transfer speed' : 'on schedule', TX + 8, Y0 + 26.5, 6.5, F.rate < 1 ? C.amber : C.muted, { b: 'middle' });
      [['O2', S.cabinO2], ['HULL', S.hull], ['FUEL', S.fuel]].forEach(([n, v], i) => { T(n, TX + 8 + i * 60, Y0 + 36.5, 6.5, C.muted, { b: 'middle', w: 600 }); T(Math.round(v) + '%', TX + 8 + i * 60 + (i ? 22 : 13), Y0 + 36.5, 6.5, v < 30 ? C.red : v < 55 ? C.amber : C.white, { b: 'middle', w: 600 }); });
      if (F.noteT > 0) { g.globalAlpha = clamp(F.noteT * 2, 0, 1); tag(F.noteS, 306, Y0 + (role === 'pilot' ? 62 : 47), F.noteCol, 7); g.globalAlpha = 1; }
      HS.hint(HS.online() ? (mine.length > 1 ? '[TAB] switch between your stations   [1]-[4] ask for another' : '[1]-[4] ask another player for their station') : '[1] [2] [3] [4] or [TAB] switch station');
      if (F.over) {
        HS.fillStage(`rgba(4,7,13,${clamp(F.over.t * .6, 0, .8)})`);
        const msg = { hull: ['HULL LOST', 'The ship broke up before it arrived.'], fuel: ['OUT OF FUEL', 'The ship is drifting. Mission Control is sending a tug.'], oxygen: ['NO OXYGEN', 'The cabin ran out of air before arrival.'] }[F.over.reason];
        T(msg[0], 320, 168, 34, C.red, { w: 700, a: 'center', b: 'middle', f: PIX }); T(msg[1], 320, 200, 9, C.white, { a: 'center', b: 'middle' });
      }
    },
    pilot() {
      const S = HS.S, t = F.t, m = F.m, mars = S.mission.id === 'mars';
      const eng = loadOn('engine');
      // space, Earth, the destination, debris and the ship built from the four parts, on the 1280 x 720 art grid (js/flight-art.js)
      HS.flightArt.pilot(HS.ax, F, { dest: S.mission.id, engine: eng }); HS.flightArt.bleed(HS.ax, 'pilot', F); HS.blitArt();
      // warnings
      const warned = F.pending.filter(p => p.warned);
      if (warned.length) tag(`DEBRIS IN ${Math.max(0, Math.ceil(Math.min(...warned.map(p => p.at - t))))} s  (link warning)`, 306, 48, C.amber, 7);
      else if (F.link < 60) tag('LINK DOWN: no debris warning', 306, 48, C.red, 7);
      if (!eng) tag('ENGINE IS SWITCHED OFF at the power bus', 320, 150, C.red, 8.5);
      // speed dial
      // pinned to the screen: the dial and fuel to the bottom-left, the hull panel to the right edge
      const L0 = HS.X0, B0 = HS.Y1 - 360, R0 = HS.X1 - 640, dx = L0 + 58, dy = B0 + 292, r0 = 40;
      box(dx - r0 - 8, dy - r0 - 8, 2 * r0 + 16, 2 * r0 + 16, C.cyan, 48);
      const ang = (v) => (135 + 270 * clamp((v - 6.5) / 3, 0, 1)) * Math.PI / 180;
      g.strokeStyle = HS.rgba(C.green, .9); g.lineWidth = 5; g.beginPath(); g.arc(dx, dy, r0 - 3, ang(F.target - .25), ang(F.target + .25)); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 1.5; for (let a = 135; a <= 405; a += 27) { const ra = a * Math.PI / 180; g.beginPath(); g.moveTo(dx + Math.cos(ra) * (r0 - 7), dy + Math.sin(ra) * (r0 - 7)); g.lineTo(dx + Math.cos(ra) * r0, dy + Math.sin(ra) * r0); g.stroke(); }
      const na = ang(F.speed + Math.sin(t * 9) * .008); g.strokeStyle = '#ff7a3c'; g.lineWidth = 3; g.beginPath(); g.moveTo(dx, dy); g.lineTo(dx + Math.cos(na) * (r0 - 11), dy + Math.sin(na) * (r0 - 11)); g.stroke();
      const inBand = Math.abs(F.speed - F.target) <= .25;
      T(F.speed.toFixed(2), dx, dy + 16, 12, inBand ? C.white : C.amber, { w: 600, a: 'center', b: 'middle' }); T('km/s', dx, dy + 27, 6.5, C.muted, { a: 'center', b: 'middle' });
      box(L0 + 8, dy - r0 - 26, 100, 14, null, 3, 'rgba(8,14,26,.75)'); T('TRANSFER SPEED ' + F.target.toFixed(1), L0 + 13, dy - r0 - 18.5, 7, C.green, { b: 'middle', w: 600 });
      // fuel
      box(L0 + 116, B0 + 322, 316, 28, C.cyan, 5); T('FUEL', L0 + 124, B0 + 337, 8, C.muted, { w: 600, b: 'middle' }); bar(L0 + 152, B0 + 331, 220, 10, S.fuel / 100, S.fuel < 20 ? C.red : C.pilot); T(Math.round(S.fuel) + '%', L0 + 424, B0 + 337, 9, C.white, { w: 600, a: 'right', b: 'middle' });
      box(L0 + 116, B0 + 296, 316, 22, null, 4, 'rgba(8,14,26,.75)'); T('[A][D] steer   [W] speed up   [S] slow down', L0 + 124, B0 + 313, 6.5, '#c8d2dc'); T(`${m.prop.name}: ${m.prop.flight}`, L0 + 124, B0 + 304, 6.5, C.pilot);
      // hull
      box(R0 + 560, 70, 72, 196, C.cyan, 5); T('HULL', R0 + 568, 86, 8, C.muted, { w: 600 }); T(Math.round(S.hull) + '%', R0 + 624, 86, 9, S.hull < 40 ? C.red : C.white, { w: 600, a: 'right' });
      F.sections.forEach((v, i) => { const breach = F.breach && F.breach.sec === i; g.fillStyle = breach ? (Math.floor(t * 5) % 2 ? C.red : '#7a2a26') : v >= 100 ? C.green : v >= 60 ? C.amber : C.red; g.fillRect(R0 + 584, 96 + i * 30, 24, 26); });
      if (F.breach) T('breach', R0 + 596, 258, 7.5, C.red, { w: 600, a: 'center' });
      if (m.heavy > 0) T(`heavy: ${Math.round(m.massFrac * 100)}% of lift`, L0 + 424, B0 + 313, 6.5, C.amber, { a: 'right' });
    },

    eng() {
      const S = HS.S, t = F.t, m = F.m;
      // the cabin wall, the breaker panel and the hull plate with its crack and weld bead (js/flight-art.js)
      HS.flightArt.eng(HS.ax, F); HS.flightArt.bleed(HS.ax, 'eng', F); HS.blitArt();
      // power bus
      T('POWER BUS', 24, 62, 9, C.eng, { w: 600 }); T(`${m.power.name}  ${Math.round(F.sup)} W`, 310, 62, 7, F.sup < m.supply * .98 ? C.amber : C.muted, { a: 'right' });
      const L = F.frac;
      for (let i = 0; i < 30; i++) { const f = i / 30 * 1.2, col = f < .8 ? C.green : f < 1 ? C.amber : C.red; g.fillStyle = f < L ? col : shade(col, .25); g.fillRect(24 + i * 9.5, 70, 7.5, 14); }
      g.fillStyle = '#fff'; g.fillRect(24 + 285 / 1.2 - 1, 66, 2, 22);
      T('LOAD ' + Math.round(L * 100) + '%', 24, 104, 11, L > 1 ? C.red : L > .85 ? C.amber : C.green, { w: 600 });
      T(`${Math.round(loadW())} of ${Math.round(F.sup)} W`, 110, 104, 7.5, C.muted);
      if (L > 1 && F.blackout <= 0) T('trips in ' + Math.max(1, Math.ceil(4 - F.overT)) + ' s', 310, 104, 8, Math.floor(t * 6) % 2 ? C.red : '#ffb0aa', { w: 600, a: 'right' });
      if (F.surge > 0) T(`surge +${F.surgeW} W  ${Math.ceil(F.surge)} s`, 24, 118, 7, C.amber, { w: 600 });
      if (F.flare > 0) T(`solar flare  ${Math.ceil(F.flare)} s`, 150, 118, 7, C.amber, { w: 600 });
      if (F.temp < 35) T('cold core: supply -20%', 222, 118, 7, C.comms, { w: 600 });
      T('click a row or press its key to switch a load', 24, 134, 6.5, C.muted);
      const note = { comms: 'off: link lost', payload: 'off: core cools', engine: 'off: no thrust', life: 'off: oxygen falls 3x', pump: 'off: no cooling', lights: '', heater: '' };
      F.loads.forEach((l, i) => {
        const y = 141 + i * 22, hov = HS.over(24, y, 286, 20), on = l.on;
        box(24, y, 286, 19, hov ? C.eng : null, 3, on ? 'rgba(110,220,130,.10)' : 'rgba(255,90,80,.10)');
        T(`[${'QWERTYU'[i]}]`, 30, y + 10, 7.5, C.muted, { b: 'middle' }); T(l.name, 52, y + 10, 8, on ? C.white : C.muted, { b: 'middle' });
        T(note[l.key], 228, y + 10, 6, on ? '#6f7d8c' : C.amber, { a: 'right', b: 'middle' });
        T(l.w + ' W', 276, y + 10, 7.5, on ? C.white : C.muted, { a: 'right', b: 'middle' });
        g.fillStyle = on ? C.green : '#5a2a2a'; g.fillRect(284, y + 5, 20, 9); g.fillStyle = '#0a121a'; g.fillRect(on ? 295 : 285, y + 6, 8, 7);
      });
      // hull patch
      T('HULL PATCH', 340, 62, 9, C.eng, { w: 600 });
      const b = F.breach;
      if (!b) { T('no damage', 480, 200, 9, '#3c4654', { a: 'center', w: 600 }); T(`hull ${Math.round(S.hull)}%`, 624, 62, 7, C.muted, { a: 'right' }); }
      else {
        T('breach: cabin air is leaking', 624, 62, 7, Math.floor(t * 4) % 2 ? C.red : '#ffb0aa', { a: 'right', w: 600 });
        const [hx, hy] = breachPoint(b, b.prog), pulse = 8 + Math.sin(t * 8) * 2;
        g.strokeStyle = C.cyan; g.lineWidth = 1.5; g.beginPath(); g.arc(hx, hy, pulse, 0, 7); g.stroke();
        HS.flightArt.sparks(g, F.fx2);
        bar(340, 326, 150, 6, b.prog, '#ffc46e'); T(Math.round(b.prog * 100) + '% welded', 496, 332, 7, C.white);
        T('SEALANT', 560, 332, 6.5, C.muted); bar(596, 326, 32, 6, b.sealant / 100, b.sealant < 25 ? C.red : C.cyan);
        T('hold the mouse on the ring and follow the crack   ([F] welds slowly)', 340, 344, 6.5, '#c8d2dc');
      }
    },

    comms() {
      const S = HS.S, t = F.t, m = F.m;
      // beam geometry stays in the old 160 x 90 space (x 8 on the art grid): Earth at (36, 28), the dish at (96, 78)
      const ex = 36, ey = 28, pxv = 96, pyv = 78, tgt = Math.atan2(ey - pyv, ex - pxv), act = tgt + F.e * Math.PI / 180, half = m.comms.beam * .4 * Math.PI / 180 + .05;
      const on = loadOn('comms'), bc = !on ? '#555c68' : F.link >= 95 ? '#78ffdc' : F.link > 60 ? '#ffd27a' : '#ff5a50';
      HS.flightArt.comms(HS.ax, F, { tgt, act, half, bc, on, link: F.link }); HS.flightArt.bleed(HS.ax, 'comms', F); HS.blitArt();
      tag('EARTH', ex * 4, ey * 4 - 30, C.cyan, 7.5);
      const L = F.link, locked = F.lockT > 2;
      box(440, 62, 186, 124, C.comms, 5);
      T('LINK', 450, 78, 7.5, C.muted, { w: 600 }); T(Math.round(L) + '%', 450, 108, 24, L > 60 ? C.white : C.red, { w: 600 });
      for (let i = 0; i < 5; i++) { g.fillStyle = L > (i + 1) * 19 ? C.comms : '#2a3446'; g.fillRect(550 + i * 14, 104 - i * 7, 10, 10 + i * 7); }
      T(!on ? 'antenna is switched off' : locked ? 'LOCKED: send rate x2' : L >= 95 ? 'hold steady to lock...' : L > 60 ? 'link up' : 'no link', 450, 126, 7.5, locked ? C.green : L > 60 ? C.white : C.red, { w: 600 });
      T(`debris warning: ${L > 60 ? m.comms.warn + ' s ahead' : 'none'}`, 450, 140, 7, L > 60 ? C.white : C.red);
      T(`telemetry sent: ${S.telemetry.toFixed(0)}`, 450, 152, 7, C.muted);
      T('sand dots: where the beam must be', 450, 166, 6.5, '#c8a46e'); T('coloured dots: where it is', 450, 177, 6.5, bc);
      box(440, 196, 186, 44, null, 5, 'rgba(8,14,26,.8)');
      T(m.comms.name, 450, 211, 8, C.white, { w: 600 }); T(m.comms.flight, 450, 223, 7, C.muted); T(`beam ${m.comms.beam} degrees wide`, 450, 234, 6.5, C.muted);
      const off = Math.abs(F.e);
      if (Math.abs(F.vx) > 8) tag('The pilot is turning: the dish drifts', 300, 322, C.amber, 8);
      else if (off > m.comms.beam * .4) tag(F.e > 0 ? '[A] lean the dish back' : '[D] lean the dish back', 300, 322, C.comms, 8);
      else T('[A] [D] lean the dish', 300, 326, 7, '#c8d2dc', { a: 'center' });
    },

    sci() {
      const S = HS.S, t = F.t, m = F.m;
      const tp = F.temp, pumpOn = loadOn('pump');
      // the reactor column, coolant loop, valve, gauge and the oxygen converter (js/flight-art.js)
      HS.flightArt.sci(HS.ax, F, { pumpOn, o2: S.cabinO2 }); HS.flightArt.bleed(HS.ax, 'sci', F); HS.blitArt();
      // core
      T('ENERGY CORE', 24, 62, 9, C.sci, { w: 600 });
      const band = tp > 75 ? ['too hot: the instrument is losing accuracy', C.red] : tp < 35 ? ['too cold: the ship loses 20% power', C.comms] : ['in the safe band', C.muted];
      T('TEMP ' + Math.round(tp) + '%', 24, 318, 11, tp > 75 ? C.red : tp < 35 ? C.comms : C.green, { w: 600 });
      T(band[0], 24, 330, 6.5, band[1]);
      T('valve ' + Math.round(F.valve * 100) + '%' + (pumpOn ? '' : ' (pump off)'), 216, 318, 8, pumpOn ? C.white : C.red, { a: 'right' });
      T('[W] open   [S] close', 216, 330, 6.5, '#c8d2dc', { a: 'right' });
      T('HOT', 280, 76, 6.5, '#ff8a80'); T('SAFE', 280, 150, 6.5, '#8ee0a0'); T('COLD', 280, 240, 6.5, '#8ab4ff');
      T(`${m.payload.name}: ${m.payload.flight}`, 24, 344, 6.5, C.muted);
      if (S.instDamage > 1) T(`instrument accuracy ${Math.round(100 - S.instDamage)}%`, 310, 344, 6.5, C.amber, { a: 'right', w: 600 });
      // oxygen converter
      T('OXYGEN CONVERTER', 340, 62, 9, C.sci, { w: 600 });
      T('CABIN O2 ' + Math.round(S.cabinO2) + '%', 340, 78, 9, S.cabinO2 < 35 ? C.red : S.cabinO2 < 55 ? C.amber : C.white, { w: 600 });
      if (F.jam > 0) T(`JAMMED ${Math.ceil(F.jam)} s`, 624, 78, 8, Math.floor(t * 6) % 2 ? C.red : '#ffb0aa', { a: 'right', w: 600 });
      F.tray.forEach((it, i) => {
        const x = 344 + i * 21, y = 306, d = ITEMS[it.type], hov = HS.over(x, 300, 20, 30), pop = clamp((t - it.born) * 5, 0, 1), yy = y + (hov ? -3 : 0) + (1 - pop) * 10;
        g.globalAlpha = pop;
        HS.flightArt.item(g, it.type, x + 1.5, yy - 1);
        g.globalAlpha = 1;
        if (hov) { g.strokeStyle = C.white; g.lineWidth = 1; g.strokeRect(x - .5, 297.5, 21, 30); tag(it.type === 'wrench' ? 'wrench: jams the intake' : `${d.name}  +${d.o2}% O2`, x + 10, 290, it.type === 'wrench' ? C.red : C.cyan, 7); }
      });
      for (const th of F.throws) { const k = th.t / .6, X = lerp(th.from, 552, k), Y = 306 - 300 * k + 96 * k * k; HS.flightArt.thrown(g, th.type, X, Y, k * 7); }
      HS.flightArt.sparks(g, F.fx2);
      if (F.popup) tag(F.popup.s, 480, 112, F.popup.col, 8);
      T('click an item to throw it in   [SPACE] throws the first one', 340, 344, 6.5, '#c8d2dc');
    }
  };
  HS.dbg = HS.dbg || {}; HS.dbg.flight = () => F;   // test hook
})();
