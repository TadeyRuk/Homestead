// Homestead phase 3: sortie and homestead. Work through Mission Control's list before extraction.
(() => {
  const HS = window.HS, g = HS.g;
  const { T, box, bar, tag, C, PIX, clamp, seg, fmt } = HS;
  const L = HS.LANDER, A = HS.surfaceArt;   // the art is in js/surface-art.js
  let U = null;
  // what each crew member has of their own on the surface; use() swaps one of them into U, keep() saves it back
  const PK = ['p', 'carry', 'carried', 'o2', 'pw', 'hold', 'tab', 'down', 'downT', 'inHazard', 'game', 'lng'];
  const use = (id) => { const o = U.ps[id]; for (const k of PK) U[k] = o[k]; U.me = id; };
  const keep = (id) => { const o = U.ps[id]; for (const k of PK) o[k] = U[k]; };

  const atLander = (p) => ((p.x - L.x) / 34) ** 2 + ((p.y - L.y) / 24) ** 2 < 1.15;
  const note = (s, col = C.cyan, d = 3) => { U.noteS = s; U.noteT = d; U.noteCol = col; };
  const stormAt = (x) => U.storms.some(s => { if (s.x == null) return false; const a = s.dir > 0 ? s.x - s.w : s.x, b = s.dir > 0 ? s.x : s.x + s.w; return x > a && x < b; });
  const flareOn = () => U.flares.some(f => U.t >= f.at && U.t < f.at + f.dur);
  const flareSoon = () => U.flares.find(f => U.t >= f.at - 10 && U.t < f.at);
  const sheltered = (p) => atLander(p) || U.rocks.some(([X, Y]) => Math.hypot(p.x - (X + 5), p.y - (Y + 6)) < 13);

  function goDown() {
    const S = HS.S; U.down = true; U.lng = null; S.lostDown += U.carried; U.carried = 0; U.carry = null;
    // the run only ends early when nobody is left standing
    if (Object.keys(U.ps).every(id => id === U.me || U.ps[id].down)) { S.crewStanding = 0; S.ended = { phase: 'surface', reason: 'suit', hazard: U.inHazard }; }
    HS.log('down', { lost: S.lostDown, hazard: U.inHazard, left: Math.round(U.left) });
    HS.sfx.sad(); HS.shake(5); HS.flash('255,60,60', .4); U.downT = 0;
  }
  function extraction() { if (U.ext) return; for (const id in U.ps) U.ps[id].lng = null; U.lng = null; keep(U.me); HS.S.carried = Object.values(U.ps).reduce((a, o) => a + o.carried, 0); U.ext = { t: 0 }; HS.S.surfaceLeft = Math.max(0, U.left); HS.log('extract', { uplinked: Math.floor(HS.S.uplinked), buffer: HS.S.buffer, carried: HS.S.carried }); HS.sfx.extract(); }

  HS.scenes.surface = {
    enter() {
      const S = HS.S, m = HS.model(), mi = S.mission, r = HS.R(S.seed * 17 + 11), D = HS.SURFACE[mi.id], mars = mi.id === 'mars';
      const rich = HS.shuffle(D.rich, r).slice(0, mi.sites[0]), poor = HS.shuffle(D.poor, r).slice(0, mi.sites[1]);
      U = {
        t: 0, left: HS.SURFACE_TIME, m, mars, p: { x: L.x + 4, y: L.y + 16, walk: 0, flip: false, face: 'down' }, carry: null, o2: 100, pw: 100, fx: new HS.Parts(),
        sites: rich.map(([x, y]) => ({ x, y, kind: 'rich', done: false })).concat(poor.map(([x, y]) => ({ x, y, kind: 'poor', done: false }))),
        sample: { x: D.sample[(r() * 2) | 0][0], y: 0, done: false }, deploy: { x: 0, y: 0, done: false, prog: 0 },
        hold: null, tab: 'MISSION', noteS: '', noteT: 0, noteCol: C.cyan, down: false, downT: 0, ext: null, done: false, inHazard: false, map: false, photoT: 0, lowBeep: 0,
        storms: [], flares: [], rocks: D.rocks, devil: { x: 0, y: 0 }, overlook: null, upT: 0, ps: {}, me: 'host', lng: null,
        lounge: HS.lounge ? HS.lounge.start(S) : null   // the wait at the lander once the list is done (js/lounge.js)
      };
      HS.ids().forEach((id, i) => { U.ps[id] = { p: { x: L.x + 4 + i * 10, y: L.y + 16, walk: 0, flip: false, face: 'down' }, carry: null, carried: 0, o2: 100, pw: 100, hold: null, tab: 'MISSION', down: false, downT: 0, inHazard: false, game: null, lng: null }; });
      use(U.ps[HS.net.me] ? HS.net.me : HS.ids()[0]);
      const si = D.sample.find(s => s[0] === U.sample.x); U.sample.y = si[1];
      const di = D.deploy[(r() * 2) | 0]; U.deploy.x = di[0]; U.deploy.y = di[1];
      // hazards keep their old spacing on the longer clock: the first two stretch with it and a third is added
      const k = HS.SURFACE_TIME / 180;
      if (mars) { const d1 = r() < .5 ? 1 : -1; U.storms = [{ at: (26 + r() * 14) * k, dir: d1, w: 230, x: null }, { at: (104 + r() * 18) * k * .8, dir: -d1, w: 260, x: null }, { at: (150 + r() * 14) * k, dir: d1, w: 250, x: null }]; U.devilSeed = r() * 6; }
      else { U.flares = [{ at: (34 + r() * 14) * k, dur: 12 }, { at: (108 + r() * 20) * k * .8, dur: 13 }, { at: (152 + r() * 12) * k, dur: 12 }]; const o = D.overlook[(r() * D.overlook.length) | 0]; U.overlook = { x: o[0], y: o[1] }; }
      S.uplinked = 0; S.buffer = 0; S.carried = 0; S.lostDown = 0; S.yieldLost = 0; S.scansRich = 0; S.scansPoor = 0; S.sampleDone = false; S.deployDone = false; S.bonusDone = false; S.crewStanding = 1; S.hazardTime = 0;
      // the list (S2-18): three objectives drawn by the seed from the mission's pool, then the uplink and the bonus every run
      S.tasks = {}; S.goals = HS.drawGoals(S.seed, mi.id, m);
      U.sample.off = !S.goals.includes('sample'); U.deploy.off = !S.goals.includes('deploy');
      A.enter(mi.id);   // builds this mission's ground and sprites the first time
      note(`Mission Control: ${HS.goalWords(S.goals, mi.id).join(', ')}. Data counts at the lander.`, C.amber, 6);
    },

    update(dt) {
      const S = HS.S, m = U.m;
      if (U.done) return;
      U.t += dt; U.noteT -= dt; U.photoT -= dt; U.fx.update(dt);
      if (U.ext) { U.ext.t += dt; if (U.ext.t > 5) { U.done = true; HS.go('report'); } return; }
      const ids = Object.keys(U.ps);
      // extraction comes early once the whole crew is down
      if (ids.every(id => U.ps[id].down)) { if (Math.max(...ids.map(id => (U.ps[id].downT += dt))) > 2.6) extraction(); return; }
      U.left -= dt; if (U.left <= 0) { U.left = 0; extraction(); return; }

      // hazards
      for (const s of U.storms) {
        if (U.t >= s.at - 8 && !s.warned) { s.warned = true; note(`DUST STORM coming from the ${s.dir > 0 ? 'west' : 'east'}. It drains suits four times faster.`, C.amber, 5); HS.sfx.warn(); }
        if (U.t >= s.at) s.x = s.dir > 0 ? (U.t - s.at) * 13 : 640 - (U.t - s.at) * 13;
      }
      U.storms = U.storms.filter(s => s.x == null || (s.dir > 0 ? s.x - s.w < 660 : s.x + s.w > -20));
      for (const f of U.flares) {
        if (U.t >= f.at - 10 && !f.warned) { f.warned = true; note('SOLAR FLARE in 10 s. Get to the lander or behind a rock.', C.amber, 5); HS.sfx.warn(); }
        if (U.t >= f.at && !f.hit) { f.hit = true; HS.flash('255,250,220', .5); HS.sfx.hitHull(); }
      }
      if (U.mars) { const k = U.t * .11 + U.devilSeed; U.devil.x = 320 + Math.sin(k) * 250 + Math.sin(k * 2.7) * 30; U.devil.y = 200 + Math.cos(k * 1.3) * 150; }

      HS.each((id) => { if (!U.ps[id] || U.ext) return; use(id); this.walk(dt); keep(id); });
      use(U.ps[HS.net.me] ? HS.net.me : ids[0]);
      if (U.lounge && HS.lounge.tick(U, dt) === 'call') { extraction(); return; }

      // the lander uplinks whatever the crew has handed in
      if (S.buffer > 0) { const d = Math.min(S.buffer, m.comms.rate * dt); S.buffer -= d; S.uplinked += d; U.upT += dt; if (U.upT > .25) { U.upT = 0; U.fx.add(L.x + A.ANT.x, L.y + A.ANT.y, (Math.random() - .5) * 4, -30, 1.1, '#78ffdc', 1); } }
    },

    // one crew member's turn, with their suit swapped into U by use()
    walk(dt) {
      const S = HS.S, m = U.m, p = U.p, mi = S.mission;
      if (U.down) return;
      // an open minigame: this player stands still and their keys belong to it; the clock, the suit and the hazards run on
      const lounging = !U.game && !!U.lounge && HS.lounge.step(U, dt, atLander(p));
      const busy = !!U.game || lounging;
      if (U.game) { const n = HS.gameFrame.step(U, dt); if (n) note(n[0], n[1]); }
      if (!busy && HS.hit('KeyQ')) { U.tab = U.tab === 'MISSION' ? 'SUIT' : 'MISSION'; HS.sfx.blip(); }
      if (!busy && HS.In.click && HS.over(8, this.panelY() + 2, 204, 20)) { U.tab = HS.In.mx < 100 ? 'MISSION' : 'SUIT'; HS.sfx.blip(); }
      const home = atLander(p), storm = U.mars && stormAt(p.x) && !home, flare = !U.mars && flareOn() && !sheltered(p);
      U.inHazard = storm || flare; if (U.inHazard) S.hazardTime += dt;
      // move
      const a = busy ? { x: 0, y: 0 } : HS.axis(), len = Math.hypot(a.x, a.y);
      if (len) {
        const sp = mi.walk * (U.carry ? .9 : 1) * (storm ? .8 : 1) * dt;
        p.x = clamp(p.x + a.x / len * sp, 6, 634); p.y = clamp(p.y + a.y / len * sp, 10, 394);
        p.walk += dt; if (a.x) p.flip = a.x < 0; U.hold = null;
        p.face = a.x && Math.abs(a.x) >= Math.abs(a.y) ? 'side' : a.y < 0 ? 'up' : 'down';
        if (Math.random() < .3) U.fx.add(p.x, p.y + 3, (Math.random() - .5) * 8, -5, .5, U.mars ? 'rgba(220,150,110,.6)' : 'rgba(200,204,214,.6)', 1);
      } else p.walk = 0;

      // hold E on the nearest thing
      const tgt = busy ? null : this.target();
      if (tgt && tgt.game) { if (HS.hit('KeyE', 'Space') && !len) HS.gameFrame.open(U, tgt.game); }
      else if (tgt && HS.key('KeyE', 'Space') && !len) {
        if (!U.hold || U.hold.id !== tgt.id) U.hold = { id: tgt.id, prog: 0 };
        U.hold.prog += dt / tgt.time; U.pw -= .5 * dt;
        if (Math.floor(U.t * 6) !== Math.floor((U.t - dt) * 6)) HS.sfx.scan();
        if (Math.random() < .5) U.fx.add(tgt.x + (Math.random() - .5) * 8, tgt.y, (Math.random() - .5) * 14, -12 - Math.random() * 14, .5, tgt.col, 1);
        if (U.hold.prog >= 1) { U.hold = null; tgt.finish(); }
      } else if (!HS.key('KeyE', 'Space')) U.hold = null;

      // bonus photo
      if (!busy && HS.hit('KeyF') && !S.bonusDone) {
        const ok = U.mars ? Math.hypot(p.x - U.devil.x, p.y - U.devil.y) < 46 : Math.hypot(p.x - U.overlook.x, p.y - U.overlook.y) < 18;
        U.photoT = .35; HS.sfx.photo();
        if (ok) { S.bonusDone = true; note(`Bonus photo taken. Mission Control loves it.`, C.green, 4); HS.sfx.done(); HS.log('bonus'); }
        else note(U.mars ? 'Too far from the dust devil for a photo' : 'Earth is only in view from the marked overlook', C.muted, 2.5);
      }

      // lander: drop off data and samples, recharge, uplink
      if (home) {
        if (U.carried > 0) { S.buffer += U.carried; note(`${U.carried} data units handed to the lander`, C.cyan); U.carried = 0; HS.sfx.good(); }
        if (U.carry === 'sample') { U.carry = null; S.sampleDone = true; note(mi.objectives.sample + ': done', C.green); HS.sfx.done(); HS.log('sample'); }
        const rc = m.power.recharge * (m.power.solar && U.mars ? .43 : 1) * dt; U.o2 = Math.min(100, U.o2 + rc); U.pw = Math.min(100, U.pw + rc);
      } else {
        const k = storm ? 4 : flare ? 6 : 1; U.o2 -= .7 * k * dt; U.pw -= .32 * k * dt;
      }
      U.lowBeep -= dt;
      if ((U.o2 < 30 || U.pw < 30) && U.lowBeep <= 0) { U.lowBeep = 1.6; HS.sfx.warn(); }
      if (U.o2 <= 0 || U.pw <= 0) { U.o2 = Math.max(0, U.o2); U.pw = Math.max(0, U.pw); goDown(); }
    },

    save() { keep(U.me); return HS.pack(U); },
    load(d) { if (!U) return; Object.assign(U, d); use(U.ps[HS.net.me] ? HS.net.me : Object.keys(U.ps)[0]); },
    // joiner prediction (js/net-game.js), as in build.js
    mine(d) { return d && d.ps && d.ps[HS.net.me] ? d.ps[HS.net.me].p : null; },
    me() { return U && U.ps[HS.net.me] ? U.p : null; },
    predict(q, dt) {
      if (!this.me() || U.done || U.ext || U.down || U.game || U.lng) return false;
      const a = HS.axis(), len = Math.hypot(a.x, a.y);
      if (!len) { q.walk = 0; return false; }
      const storm = U.mars && stormAt(q.x) && !atLander(q);
      const sp = HS.S.mission.walk * (U.carry ? .9 : 1) * (storm ? .8 : 1) * dt;
      q.x = clamp(q.x + a.x / len * sp, 6, 634); q.y = clamp(q.y + a.y / len * sp, 10, 394);
      q.walk += dt; if (a.x) q.flip = a.x < 0;
      q.face = a.x && Math.abs(a.x) >= Math.abs(a.y) ? 'side' : a.y < 0 ? 'up' : 'down';
      return true;
    },

    // what holding E would work on right now
    target() {
      const S = HS.S, m = U.m, p = U.p, mi = S.mission, near = (o, d = 14) => Math.hypot(p.x - o.x, p.y - o.y) < d;
      for (const s of U.sites) if (!s.done && near(s)) {
        const base = m.payload[s.kind], got = Math.max(1, Math.round(base * (1 - S.instDamage / 100)));
        return { id: 'site' + s.x, x: s.x, y: s.y, col: '#78ffe6', time: m.payload.scan, label: `[E] hold to scan  +${got} data`, finish: () => { s.done = true; U.carried += got; S.yieldLost += base - got; if (s.kind === 'rich') S.scansRich++; else S.scansPoor++; HS.sfx.good(); note(`Scan done: +${got} data in your hands. Take it to the lander.`, C.cyan); HS.log('scan', { kind: s.kind, got, base }); } };
      }
      if (!U.sample.off && !U.sample.done && near(U.sample)) return { id: 'sample', x: U.sample.x, y: U.sample.y, col: '#ffb43c', time: 3.2, label: U.mars ? '[E] hold to drill the core' : '[E] hold to collect regolith', finish: () => { U.sample.done = true; U.carry = 'sample'; HS.sfx.pick(); note('Sample in hand. Carry it to the lander.', C.amber); } };
      if (!U.deploy.off && !U.deploy.done && near(U.deploy)) return { id: 'deploy', x: U.deploy.x, y: U.deploy.y, col: '#e6e8ec', time: 4, label: `[E] hold to deploy the ${mi.objectives.deploy.toLowerCase()}`, finish: () => { U.deploy.done = true; S.deployDone = true; HS.sfx.done(); note(mi.objectives.deploy + ': deployed', C.green); HS.log('deploy'); } };
      for (const k of S.goals) {
        const def = HS.surfaceGames[k], s = def && HS.gameSpot(k, mi.id);
        if (s && !S.tasks[k] && near(s) && !HS.gameFrame.busy(U, k)) return { id: 'game:' + k, game: k, x: s.x, y: s.y, col: HS.CAT[def.slot] || C.cyan, label: `[E] ${def.name.toLowerCase()}` };
      }
      return null;
    },

    draw() {
      const S = HS.S, p = U.p, t = U.t, mi = S.mission, m = U.m, cam = HS.camera(p), mars = U.mars;
      // ----- world, on the 1280 x 720 art grid (js/surface-art.js, js/art.js)
      const x = HS.ax, id = mi.id, hold = (k) => (U.hold && U.hold.id === k ? U.hold.prog : 0), home = atLander(p);
      A.ground(x, cam, id);
      A.track(p, t, !mars); A.tracks(x, cam, t, !mars);
      A.ring(x, cam, t, home);
      if (!mars) { U.rocks.forEach(([X, Y], i) => A.boulderShadow(x, cam, X, Y, i)); if (flareOn() || flareSoon()) for (const [X, Y] of U.rocks) A.shelterRing(x, cam, X, Y, t); }
      // depth-sorted by where each thing touches the ground
      const list = [{ y: L.y + 4, draw: () => A.lander(x, cam, t, S.buffer > 0, home) }];
      for (const s of U.sites) list.push({ y: s.y + 2, draw: () => A.site(x, cam, s, t, hold('site' + s.x), !mars) });
      if (!U.sample.off) list.push({ y: U.sample.y + 2, draw: () => A.sample(x, cam, U.sample, t, hold('sample'), !mars) });
      if (!U.deploy.off) list.push({ y: U.deploy.y + 2, draw: () => A.deploy(x, cam, U.deploy, U.deploy.done ? 1 : hold('deploy'), t, !mars) });
      for (const k of S.goals) { const s = HS.surfaceGames[k] && HS.gameSpot(k, id); if (s) list.push({ y: s.y + 2, draw: () => HS.gameFrame.drawSpot(x, cam, k, s, t, !!S.tasks[k]) }); }
      if (mars) list.push({ y: U.devil.y + 2, draw: () => A.devil(x, cam, U.devil, t) });
      else { list.push({ y: U.overlook.y + 2, draw: () => A.overlook(x, cam, U.overlook, S.bonusDone, t) }); U.rocks.forEach(([X, Y], i) => list.push({ y: Y + 4, draw: () => A.boulder(x, cam, X, Y, i) })); }
      if (U.down || !(U.ext && U.ext.t > 2.6)) {
        const held = U.down ? null : U.carry ? (mars ? 'core' : 'can') : U.carried > 0 ? 'data' : null;
        list.push({ y: p.y + 4, draw: () => A.crew(x, cam, p, S.suit, { walk: p.walk, flip: p.flip, face: p.face, carry: !!held, down: U.down, t }, held, t) });
      }
      for (const id in U.ps) {
        const o = U.ps[id]; if (id === U.me || (U.ext && U.ext.t > 2.6 && !o.down)) continue;
        const held = o.down ? null : o.carry ? (mars ? 'core' : 'can') : o.carried > 0 ? 'data' : null, q = o.p;
        list.push({ y: q.y + 4, draw: () => A.crew(x, cam, q, HS.member(id).suit, { walk: q.walk, flip: q.flip, face: q.face, carry: !!held, down: o.down, t }, held, t) });
      }
      list.sort((a, b) => a.y - b.y);
      for (const d of list) d.draw();
      HS.drawFx(x, cam, U.fx);
      if (U.ext) A.ship(x, cam, U.ext, t);
      for (const s of U.storms) if (s.x != null) A.storm(x, cam, s, t);
      if (!mars && flareOn()) A.flare(x, cam, t, sheltered(p), U.rocks);
      HS.blitArt();
      if (!U.ext) HS.nameTags(cam, Object.fromEntries(Object.entries(U.ps).map(([id, o]) => [id, o.p])));
      if (mars && stormAt(p.x) && !home) { g.fillStyle = 'rgba(120,70,40,.28)'; g.fillRect(0, 0, 640, 360); }

      // ----- labels
      const lab = (X, Y, s, col, dy = 22) => { const q = HS.toScreen(cam, X, Y); if (q.x > 40 && q.x < 600 && q.y > 50 && q.y < 300 && !(q.x < 290 && q.y + dy > 222) && !U.ext) tag(s, q.x, q.y + dy, col, 7.5); };
      for (const s of U.sites) if (!s.done) { const base = m.payload[s.kind]; lab(s.x, s.y, `${s.kind.toUpperCase()} SITE +${Math.max(1, Math.round(base * (1 - S.instDamage / 100)))}`, s.kind === 'rich' ? C.cyan : '#8ac8c0'); }
      if (!U.sample.off && !U.sample.done) lab(U.sample.x, U.sample.y, mi.objectives.sampleSite, C.amber);
      if (!U.deploy.off && !U.deploy.done) lab(U.deploy.x, U.deploy.y, mi.objectives.deploySite, C.cyan);
      for (const k of S.goals) { const def = HS.surfaceGames[k], s = def && HS.gameSpot(k, id); if (s && !S.tasks[k]) lab(s.x, s.y, def.name.toUpperCase(), HS.CAT[def.slot] || C.cyan, 12); }
      lab(L.x, L.y + 22, S.buffer > 0 ? `LANDER  uplinking ${m.comms.rate.toFixed(2)}/s` : 'LANDER', C.cyan, 14);
      if (mars && !S.bonusDone) lab(U.devil.x, U.devil.y - 30, '[F] photograph', C.pink, 0);
      if (!mars && !S.bonusDone) lab(U.overlook.x, U.overlook.y, 'EARTH VIEW  [F] photo', C.pink);
      if (!mars && (flareOn() || flareSoon())) for (const [X, Y] of U.rocks) lab(X + 5, Y + 6, 'SHELTER', C.green, 12);
      HS.arrowReset(); if (!U.ext) HS.edgeArrow(cam, L.x, L.y, C.cyan, 'LANDER', true);
      if (!U.sample.off && !U.sample.done && !U.ext) HS.edgeArrow(cam, U.sample.x, U.sample.y, C.amber, mars ? 'CORE' : 'REGOLITH', true);
      if (!U.deploy.off && !U.deploy.done && !U.ext) HS.edgeArrow(cam, U.deploy.x, U.deploy.y, '#e6e8ec', 'DEPLOY', true);
      for (const k of S.goals) { const def = HS.surfaceGames[k], s = def && HS.gameSpot(k, id); if (s && !S.tasks[k] && !U.ext) HS.edgeArrow(cam, s.x, s.y, HS.CAT[def.slot] || C.cyan, def.name.toUpperCase(), true); }
      const rich = U.sites.filter(s => !s.done && s.kind === 'rich').sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (rich && S.goals.includes('scan') && S.scansRich < mi.objectives.scans && !U.ext) HS.edgeArrow(cam, rich.x, rich.y, '#78ffe6', 'RICH', true);

      // ----- HUD
      const st = U.down ? 'DOWN' : U.carry ? 'carrying the sample' : U.carried > 0 ? `carrying ${U.carried} data units` : atLander(p) ? 'at the lander: recharging' : 'hands empty';
      HS.chip('crew', 8, 30, st);
      const low = U.left < 20;
      HS.topBox(U.ext ? 'EXTRACTION' : 'EXTRACTION IN ' + fmt(U.left), `data uplinked ${Math.floor(S.uplinked)} / ${mi.target}`, low && Math.floor(t * 4) % 2 ? C.red : low ? C.amber : C.white);
      this.panel(8, this.panelY());
      if (!U.down && !U.ext) {
        const tg = U.game || U.lng ? null : this.target();
        if (U.game) HS.gameFrame.panel(U);
        if (tg) { const k = U.hold && U.hold.id === tg.id ? U.hold.prog : 0; HS.prompt(k > 0 ? `${tg.label}  ${Math.round(k * 100)}%` : tg.label, 430, 318, tg.col === '#e6e8ec' ? C.cyan : tg.col); if (k > 0) bar(360, 330, 140, 4, k, C.cyan); }
        else if (!U.game && (U.o2 < 35 || U.pw < 35)) HS.prompt(`${U.o2 < U.pw ? 'oxygen' : 'suit power'} ${Math.round(Math.min(U.o2, U.pw))}%  get to the lander`, 430, 318, C.red);
        if (U.inHazard) tag(mars ? 'IN THE DUST STORM: suit drain x4' : 'SOLAR FLARE: suit drain x6. Find shelter.', 320, 54, C.red, 8.5);
        else if (!mars && flareOn()) tag('Sheltered from the flare', 320, 54, C.green, 8.5);
        else { const f = flareSoon(); if (f) tag(`SOLAR FLARE IN ${Math.ceil(f.at - t)} s`, 320, 54, C.amber, 8.5); }
      }
      if (U.noteT > 0) { g.globalAlpha = clamp(U.noteT * 2, 0, 1); tag(U.noteS, 320, 72, U.noteCol, 8); g.globalAlpha = 1; }
      if (U.photoT > 0) { g.fillStyle = `rgba(255,255,255,${U.photoT * 2})`; g.fillRect(0, 0, 640, 360); }
      if (!U.ext && HS.lounge) HS.lounge.draw(U, atLander(p));
      HS.hint(U.lng && HS.lounge && !U.down && !U.ext ? HS.lounge.hint(U) : U.game ? (HS.surfaceGames[U.game.kind] || {}).keys + '   [Q] step away   [TAB] hold for map' : '[E] hold to work   [F] photo   [Q] mission / suit   [TAB] hold for map');
      if (HS.local.down.has('Tab')) this.map(cam);   // each screen holds its own map
      if (U.down && !U.ext) { g.fillStyle = 'rgba(4,7,13,.45)'; g.fillRect(0, 0, 640, 360); HS.prompt(S.lostDown ? `suit empty: ${S.lostDown} carried units lost` : 'suit empty', 320, 180, C.red); }
      if (U.ext) {
        g.fillStyle = `rgba(4,7,13,${seg(U.ext.t, .2, 1.2) * .55})`; g.fillRect(0, 0, 640, 360); g.globalAlpha = seg(U.ext.t, .4, 1);
        T('EXTRACTION', 320, 150, 32, C.white, { w: 700, a: 'center', b: 'middle', f: PIX }); T('the ship from Earth leaves on time', 320, 180, 9, C.muted, { a: 'center', b: 'middle' });
        g.globalAlpha = 1;
      }
    },

    // one panel, two tabs: the mission list or the suit readout. Q flips it.
    // the panel sits on the bottom edge and grows upwards when the list is longer than five rows
    rows() {
      const S = HS.S, mi = S.mission, o = mi.objectives;
      return S.goals.map(k => k === 'scan' ? ['Scan rich sites', S.scansRich, o.scans] : k === 'sample' ? [o.sample, S.sampleDone ? 1 : 0, 1] : k === 'deploy' ? [o.deploy, S.deployDone ? 1 : 0, 1]
        : [HS.surfaceGames[k] ? HS.surfaceGames[k].label(mi.id) : k, S.tasks[k] ? 1 : 0, 1])
        .concat([['Uplink data', Math.floor(S.uplinked), mi.target], ['Bonus: ' + o.bonus[0].toLowerCase() + o.bonus.slice(1), S.bonusDone ? 1 : 0, 1]]);
    },
    panelY() { return 236 - Math.max(0, this.rows().length - 5) * 15; },
    panel(x, y) {
      const S = HS.S, mi = S.mission, w = 204, rows = this.rows();
      box(x, y, w, 346 - y, C.cyan, 5);
      ['MISSION', 'SUIT'].forEach((n, i) => { const tx = x + 8 + i * 62, on = n === U.tab; g.fillStyle = on ? C.cyan : '#18222e'; g.fillRect(tx, y + 7, 58, 15); T(n, tx + 29, y + 15, 7.5, on ? C.ink : C.muted, { w: 600, a: 'center', b: 'middle' }); });
      T('[Q] switch', x + w - 8, y + 15, 7, C.muted, { a: 'right', b: 'middle' });
      const lowSuit = Math.min(U.o2, U.pw) < 35;
      if (U.tab === 'MISSION' && lowSuit && Math.floor(U.t * 4) % 2) { g.fillStyle = C.red; g.fillRect(x + 70 + 58 - 6, y + 9, 4, 4); }
      if (U.tab === 'MISSION') {
        rows.forEach(([n, a, b], i) => {
          const yy = y + 38 + i * 15, done = a >= b; g.strokeStyle = done ? C.cyan : C.muted; g.lineWidth = 1.5; g.strokeRect(x + 8, yy - 7, 8, 8);
          if (done) { g.beginPath(); g.moveTo(x + 9.5, yy - 3); g.lineTo(x + 12, yy - .5); g.lineTo(x + 16, yy - 7); g.stroke(); }
          T(n, x + 22, yy, 7.5, done ? C.muted : i === rows.length - 1 ? '#c8d2dc' : C.white); T(a + '/' + b, x + w - 8, yy, 7.5, done ? C.muted : C.white, { w: 600, a: 'right' });
        });
      } else {
        const home = atLander(U.p), rc = U.m.power.recharge * (U.m.power.solar && U.mars ? .43 : 1);
        [['OXYGEN', U.o2, U.o2 < 35 ? C.red : C.green], ['POWER', U.pw, U.pw < 35 ? C.red : C.eng]].forEach(([n, v, col], i) => { const yy = y + 38 + i * 15; T(n, x + 8, yy, 7, C.muted, { w: 600 }); bar(x + 56, yy - 7, 104, 7, v / 100, col); T(Math.round(v) + '%', x + w - 8, yy, 7.5, col, { w: 600, a: 'right' }); });
        T(U.mars ? 'DUST' : 'SUN', x + 8, y + 68, 7, C.muted, { w: 600 }); T(U.inHazard ? (U.mars ? 'storm: drain x4' : 'flare: drain x6') : home ? `recharging ${rc.toFixed(1)}% per second` : U.mars ? 'clear air' : 'quiet', x + 56, y + 68, 7.5, U.inHazard ? C.amber : home ? C.green : C.white);
        T('CARRYING', x + 8, y + 83, 7, C.muted, { w: 600 }); T(U.carry ? 'the sample' : U.carried > 0 ? `${U.carried} data units` : 'nothing', x + 56, y + 83, 7.5, C.white);
        T('LANDER', x + 8, y + 98, 7, C.muted, { w: 600 }); T(S.buffer > 0 ? `${Math.ceil(S.buffer)} units waiting to send` : 'nothing waiting', x + 56, y + 98, 7.5, S.buffer > 0 ? C.cyan : C.white);
      }
    },

    map(cam) {
      const S = HS.S, x0 = 100, y0 = 44, k = 440 / 640;
      g.fillStyle = 'rgba(4,7,13,.72)'; g.fillRect(0, 0, 640, 360);
      box(x0 - 8, y0 - 22, 456, 312, C.cyan, 6);
      T('SURFACE MAP', x0, y0 - 8, 8.5, C.cyan, { w: 600 }); T('time does not stop while you look', x0 + 440, y0 - 8, 7, C.muted, { a: 'right' });
      // the ground at one art pixel per map pixel, and crisp icons that match the sprites
      g.imageSmoothingEnabled = false; g.drawImage(A.mapImage(S.mission.id), x0, y0, 440, 275);
      g.fillStyle = 'rgba(4,7,13,.18)'; g.fillRect(x0, y0, 440, 275);
      for (const s of U.storms) if (s.x != null) { const a = clamp(s.dir > 0 ? s.x - s.w : s.x, 0, 640), b = clamp((s.dir > 0 ? s.x - s.w : s.x) + s.w, 0, 640); g.fillStyle = 'rgba(232,160,100,.42)'; g.fillRect(Math.round((x0 + a * k) * 2) / 2, y0, Math.round((b - a) * k * 2) / 2, 275); T('STORM', x0 + (a + b) / 2 * k, y0 + 12, 7, '#ffd9b0', { a: 'center', w: 600 }); }
      // icons are drawn at half size here, which is one art pixel per screen pixel at 1280 wide
      const icon = (kind, X, Y, lbl) => {
        const s = A.icon(kind), dx = Math.round((x0 + X * k) * 2) - (s.width >> 1), dy = Math.round((y0 + Y * k) * 2) - s.height + 2;
        g.drawImage(s, dx / 2, dy / 2, s.width / 2, s.height / 2);
        if (lbl) T(lbl, x0 + X * k, dy / 2 - 2, 6.5, C.white, { a: 'center' });
      };
      for (const s of U.sites) icon(s.done ? 'done' : s.kind, s.x, s.y, s.done ? '' : s.kind);
      if (!U.sample.off && !U.sample.done) icon('sample', U.sample.x, U.sample.y, U.mars ? 'core' : 'regolith');
      if (!U.deploy.off && !U.deploy.done) icon('deploy', U.deploy.x, U.deploy.y, 'deploy');
      for (const kind of S.goals) { const s = HS.surfaceGames[kind] && HS.gameSpot(kind, S.mission.id); if (s) HS.gameFrame.mapSpot(kind, s, x0, y0, k, !!S.tasks[kind]); }
      if (!S.bonusDone) { if (U.mars) icon('devil', U.devil.x, U.devil.y, 'dust devil'); else icon('overlook', U.overlook.x, U.overlook.y, 'earth view'); }
      T('LANDER', x0 + L.x * k, y0 + L.y * k + 24, 7, C.cyan, { a: 'center', w: 600 });
      g.strokeStyle = C.white; g.lineWidth = 1; g.strokeRect(x0 + cam.x * k, y0 + cam.y * k, HS.VW * k, HS.VH * k);
      if (Math.floor(U.t * 4) % 2) { const px0 = Math.round((x0 + U.p.x * k) * 2) / 2, py0 = Math.round((y0 + U.p.y * k) * 2) / 2; g.fillStyle = HS.ART_OUT; g.fillRect(px0 - 3, py0 - 3, 6, 6); g.fillStyle = S.suit; g.fillRect(px0 - 2, py0 - 2, 4, 4); }
    }
  };
  HS.dbg = HS.dbg || {}; HS.dbg.surface = () => U;   // test hook
})();
