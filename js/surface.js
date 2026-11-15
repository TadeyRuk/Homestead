// Homestead phase 3: sortie and homestead. Work through Mission Control's list before extraction.
(() => {
  const HS = window.HS, g = HS.g;
  const { T, box, bar, tag, C, PIX, clamp, lerp, seg, px, ell, fmt } = HS;
  const [world, wx] = HS.off(640, 400);
  const L = HS.LANDER;
  let U = null;

  const atLander = (p) => ((p.x - L.x) / 34) ** 2 + ((p.y - L.y) / 24) ** 2 < 1.15;
  const note = (s, col = C.cyan, d = 3) => { U.noteS = s; U.noteT = d; U.noteCol = col; };
  const stormAt = (x) => U.storms.some(s => { if (s.x == null) return false; const a = s.dir > 0 ? s.x - s.w : s.x, b = s.dir > 0 ? s.x : s.x + s.w; return x > a && x < b; });
  const flareOn = () => U.flares.some(f => U.t >= f.at && U.t < f.at + f.dur);
  const flareSoon = () => U.flares.find(f => U.t >= f.at - 10 && U.t < f.at);
  const sheltered = (p) => atLander(p) || U.rocks.some(([X, Y]) => Math.hypot(p.x - (X + 5), p.y - (Y + 6)) < 13);

  function goDown() {
    const S = HS.S; U.down = true; S.crewStanding = 0; S.lostDown = S.carried; S.carried = 0; U.carry = null;
    S.ended = { phase: 'surface', reason: 'suit', hazard: U.inHazard };
    HS.log('down', { lost: S.lostDown, hazard: U.inHazard, left: Math.round(U.left) });
    HS.sfx.sad(); HS.shake(5); HS.flash('255,60,60', .4); U.downT = 0;
  }
  function extraction() { if (U.ext) return; U.ext = { t: 0 }; HS.S.surfaceLeft = Math.max(0, U.left); HS.log('extract', { uplinked: Math.floor(HS.S.uplinked), buffer: HS.S.buffer, carried: HS.S.carried }); HS.sfx.launch(); }

  HS.scenes.surface = {
    enter() {
      const S = HS.S, m = HS.model(), mi = S.mission, r = HS.R(S.seed * 17 + 11), D = HS.SURFACE[mi.id], mars = mi.id === 'mars';
      const rich = HS.shuffle(D.rich, r).slice(0, mars ? 4 : 3), poor = HS.shuffle(D.poor, r).slice(0, mars ? 4 : 3);
      U = {
        t: 0, left: HS.SURFACE_TIME, m, mars, p: { x: L.x + 4, y: L.y + 16, walk: 0, flip: false }, carry: null, o2: 100, pw: 100, fx: new HS.Parts(),
        sites: rich.map(([x, y]) => ({ x, y, kind: 'rich', done: false })).concat(poor.map(([x, y]) => ({ x, y, kind: 'poor', done: false }))),
        sample: { x: D.sample[(r() * 2) | 0][0], y: 0, done: false }, deploy: { x: 0, y: 0, done: false, prog: 0 },
        hold: null, tab: 'MISSION', noteS: '', noteT: 0, noteCol: C.cyan, down: false, downT: 0, ext: null, done: false, inHazard: false, map: false, photoT: 0, lowBeep: 0,
        storms: [], flares: [], rocks: D.rocks, devil: { x: 0, y: 0 }, overlook: null, upT: 0
      };
      const si = D.sample.find(s => s[0] === U.sample.x); U.sample.y = si[1];
      const di = D.deploy[(r() * 2) | 0]; U.deploy.x = di[0]; U.deploy.y = di[1];
      if (mars) { const d1 = r() < .5 ? 1 : -1; U.storms = [{ at: 26 + r() * 14, dir: d1, w: 230, x: null }, { at: 104 + r() * 18, dir: -d1, w: 260, x: null }]; U.devilSeed = r() * 6; }
      else { U.flares = [{ at: 34 + r() * 14, dur: 12 }, { at: 108 + r() * 20, dur: 13 }]; const o = D.overlook[(r() * D.overlook.length) | 0]; U.overlook = { x: o[0], y: o[1] }; }
      S.uplinked = 0; S.buffer = 0; S.carried = 0; S.lostDown = 0; S.yieldLost = 0; S.scansRich = 0; S.scansPoor = 0; S.sampleDone = false; S.deployDone = false; S.bonusDone = false; S.crewStanding = 1; S.hazardTime = 0;
      note(`Mission Control: ${mi.objectives.scans} rich sites, the ${mi.objectives.sampleSite.toLowerCase()}, the ${mi.objectives.deploy.toLowerCase()}. Data counts at the lander.`, C.amber, 6);
    },

    update(dt) {
      const S = HS.S, m = U.m, p = U.p, mi = S.mission;
      if (U.done) return;
      U.t += dt; U.noteT -= dt; U.photoT -= dt; U.fx.update(dt);
      if (U.ext) { U.ext.t += dt; if (U.ext.t > 5) { U.done = true; HS.go('report'); } return; }
      if (U.down) { U.downT += dt; if (U.downT > 2.6) extraction(); return; }
      U.left -= dt; if (U.left <= 0) { U.left = 0; extraction(); return; }
      U.map = HS.key('Tab');
      if (HS.hit('KeyQ')) { U.tab = U.tab === 'MISSION' ? 'SUIT' : 'MISSION'; HS.sfx.blip(); }
      if (HS.In.click && HS.over(8, 238, 204, 20)) { U.tab = HS.In.mx < 100 ? 'MISSION' : 'SUIT'; HS.sfx.blip(); }

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
      const home = atLander(p), storm = U.mars && stormAt(p.x) && !home, flare = !U.mars && flareOn() && !sheltered(p);
      U.inHazard = storm || flare; if (U.inHazard) S.hazardTime += dt;
      if (U.mars) { const k = U.t * .11 + U.devilSeed; U.devil.x = 320 + Math.sin(k) * 250 + Math.sin(k * 2.7) * 30; U.devil.y = 200 + Math.cos(k * 1.3) * 150; }

      // move
      const a = HS.axis(), len = Math.hypot(a.x, a.y);
      if (len) {
        const sp = mi.walk * (U.carry ? .9 : 1) * (storm ? .8 : 1) * dt;
        p.x = clamp(p.x + a.x / len * sp, 6, 634); p.y = clamp(p.y + a.y / len * sp, 10, 394);
        p.walk += dt; if (a.x) p.flip = a.x < 0; U.hold = null;
        if (Math.random() < .3) U.fx.add(p.x, p.y + 3, (Math.random() - .5) * 8, -5, .5, U.mars ? 'rgba(220,150,110,.6)' : 'rgba(200,204,214,.6)', 1);
      } else p.walk = 0;

      // hold E on the nearest thing
      const tgt = this.target();
      if (tgt && HS.key('KeyE', 'Space') && !len) {
        if (!U.hold || U.hold.id !== tgt.id) U.hold = { id: tgt.id, prog: 0 };
        U.hold.prog += dt / tgt.time; U.pw -= .5 * dt;
        if (Math.floor(U.t * 6) !== Math.floor((U.t - dt) * 6)) HS.sfx.scan();
        if (Math.random() < .5) U.fx.add(tgt.x + (Math.random() - .5) * 8, tgt.y, (Math.random() - .5) * 14, -12 - Math.random() * 14, .5, tgt.col, 1);
        if (U.hold.prog >= 1) { U.hold = null; tgt.finish(); }
      } else if (!HS.key('KeyE', 'Space')) U.hold = null;

      // bonus photo
      if (HS.hit('KeyF') && !S.bonusDone) {
        const ok = U.mars ? Math.hypot(p.x - U.devil.x, p.y - U.devil.y) < 46 : Math.hypot(p.x - U.overlook.x, p.y - U.overlook.y) < 18;
        U.photoT = .35; HS.sfx.photo();
        if (ok) { S.bonusDone = true; note(`Bonus photo taken. Mission Control loves it.`, C.green, 4); HS.sfx.jingle(); HS.log('bonus'); }
        else note(U.mars ? 'Too far from the dust devil for a photo' : 'Earth is only in view from the marked overlook', C.muted, 2.5);
      }

      // lander: drop off data and samples, recharge, uplink
      if (home) {
        if (S.carried > 0) { S.buffer += S.carried; note(`${S.carried} data units handed to the lander`, C.cyan); S.carried = 0; HS.sfx.good(); }
        if (U.carry === 'sample') { U.carry = null; S.sampleDone = true; note(mi.objectives.sample + ': done', C.green); HS.sfx.jingle(); HS.log('sample'); }
        const rc = m.power.recharge * (m.power.solar && U.mars ? .43 : 1) * dt; U.o2 = Math.min(100, U.o2 + rc); U.pw = Math.min(100, U.pw + rc);
      } else {
        const k = storm ? 4 : flare ? 6 : 1; U.o2 -= .7 * k * dt; U.pw -= .32 * k * dt;
      }
      if (S.buffer > 0) { const d = Math.min(S.buffer, m.comms.rate * dt); S.buffer -= d; S.uplinked += d; U.upT += dt; if (U.upT > .25) { U.upT = 0; U.fx.add(L.x + 22, L.y - 4, (Math.random() - .5) * 4, -30, 1.1, '#78ffdc', 1); } }
      U.lowBeep -= dt;
      if ((U.o2 < 30 || U.pw < 30) && U.lowBeep <= 0) { U.lowBeep = 1.6; HS.sfx.warn(); }
      if (U.o2 <= 0 || U.pw <= 0) { U.o2 = Math.max(0, U.o2); U.pw = Math.max(0, U.pw); goDown(); }
    },

    // what holding E would work on right now
    target() {
      const S = HS.S, m = U.m, p = U.p, mi = S.mission, near = (o, d = 14) => Math.hypot(p.x - o.x, p.y - o.y) < d;
      for (const s of U.sites) if (!s.done && near(s)) {
        const base = m.payload[s.kind], got = Math.max(1, Math.round(base * (1 - S.instDamage / 100)));
        return { id: 'site' + s.x, x: s.x, y: s.y, col: '#78ffe6', time: m.payload.scan, label: `[E] hold to scan  +${got} data`, finish: () => { s.done = true; S.carried += got; S.yieldLost += base - got; if (s.kind === 'rich') S.scansRich++; else S.scansPoor++; HS.sfx.good(); note(`Scan done: +${got} data in your hands. Take it to the lander.`, C.cyan); HS.log('scan', { kind: s.kind, got, base }); } };
      }
      if (!U.sample.done && near(U.sample)) return { id: 'sample', x: U.sample.x, y: U.sample.y, col: '#ffb43c', time: 3.2, label: U.mars ? '[E] hold to drill the core' : '[E] hold to collect regolith', finish: () => { U.sample.done = true; U.carry = 'sample'; HS.sfx.pick(); note('Sample in hand. Carry it to the lander.', C.amber); } };
      if (!U.deploy.done && near(U.deploy)) return { id: 'deploy', x: U.deploy.x, y: U.deploy.y, col: '#e6e8ec', time: 4, label: `[E] hold to deploy the ${mi.objectives.deploy.toLowerCase()}`, finish: () => { U.deploy.done = true; S.deployDone = true; HS.sfx.jingle(); note(mi.objectives.deploy + ': deployed', C.green); HS.log('deploy'); } };
      return null;
    },

    draw() {
      const S = HS.S, p = U.p, t = U.t, mi = S.mission, m = U.m, cam = HS.camera(p), mars = U.mars;
      // ----- world
      wx.drawImage(mars ? HS.marsBg : HS.moonBg, 0, 0);
      for (const s of U.sites) { const col = s.done ? '#6e6460' : s.kind === 'rich' ? '#78ffe6' : '#5ab4aa'; HS.diamond(wx, s.x, s.y, col, s.kind === 'rich' ? 5 : 4); if (!s.done && s.kind === 'rich') { wx.strokeStyle = 'rgba(120,255,230,.6)'; wx.lineWidth = 1; wx.beginPath(); wx.ellipse(s.x, s.y, 7 + Math.sin(t * 3) * 2, 4 + Math.sin(t * 3), 0, 0, 7); wx.stroke(); } }
      if (!U.sample.done) { const X = U.sample.x, Y = U.sample.y; wx.strokeStyle = '#aaaab4'; wx.lineWidth = 1; wx.beginPath(); wx.moveTo(X - 4, Y + 2); wx.lineTo(X, Y - 8); wx.lineTo(X + 4, Y + 2); wx.stroke(); px(wx, X, Y - 8 + (U.hold && U.hold.id === 'sample' ? Math.floor(t * 12) % 3 : 0), 1, 11, '#ff9640'); }
      { const X = U.deploy.x, Y = U.deploy.y, k = U.deploy.done ? 1 : U.hold && U.hold.id === 'deploy' ? U.hold.prog : 0;
        if (k > 0) { px(wx, X, Y - 12 * k, 1, Math.ceil(12 * k), '#e6e8ec'); if (k >= 1) { px(wx, X - 3, Y - 12, 7, 1, '#e6e8ec'); px(wx, Math.floor(t * 8) % 2 ? X - 3 : X + 3, Y - 13, 1, 1, '#fff'); } }
        else { px(wx, X - 3, Y, 7, 1, '#e6e8ec'); if (Math.floor(t * 2) % 2) px(wx, X, Y - 2, 1, 2, C.cyan); } }
      if (mars) { const d = U.devil; for (let i = 0; i < 9; i++) { const w = 2 + i * .9, sw = Math.sin(t * 7 + i * .8) * (1 + i * .4); ell(wx, d.x + sw, d.y - i * 3, w, 1.2, `rgba(226,170,120,${.75 - i * .06})`); } }
      else { const o = U.overlook; px(wx, o.x - 1, o.y - 6, 1, 8, '#e6e8ec'); px(wx, o.x, o.y - 6, 5, 3, S.bonusDone ? '#6e6460' : '#4688e6'); }
      for (let k = 0; k < 6; k++) if (S.buffer > 0) px(wx, L.x + 22, L.y - 1 - ((t * 30 + k * 7) % 42), 1, 1, '#78ffdc');
      U.fx.draw(wx);
      if (U.down) HS.astro(wx, p.x, p.y, S.suit, { down: 1 });
      else if (!(U.ext && U.ext.t > 2.6)) HS.astro(wx, p.x, p.y, S.suit, { walk: p.walk, flip: p.flip, carry: U.carry ? '#aaaab4' : S.carried > 0 ? '#5adcff' : null });
      // storm
      for (const s of U.storms) if (s.x != null) {
        const a = s.dir > 0 ? s.x - s.w : s.x, b = a + s.w;
        for (let X = Math.max(0, Math.floor(a)); X < Math.min(640, b); X++) { const e = Math.min(X - a, b - X); wx.fillStyle = `rgba(198,132,88,${Math.min(.66, e * .012)})`; wx.fillRect(X, 0, 1, 400); }
        const r = HS.R(3); for (let i = 0; i < 90; i++) { const X = a + ((r() * s.w + t * 60 * s.dir + 9999) % s.w), Y = (r() * 400 + t * 25) % 400; if (X < 0 || X > 640) continue; wx.strokeStyle = 'rgba(232,182,130,.55)'; wx.beginPath(); wx.moveTo(X, Y); wx.lineTo(X - 14 * s.dir, Y + 5); wx.stroke(); }
      }
      // extraction ship
      if (U.ext) {
        const k = HS.ease(seg(U.ext.t, 0, 2.2)), up = HS.ease(seg(U.ext.t, 3, 5)), Y = lerp(L.y - 150, L.y - 26, k) - up * 170, X = L.x;
        if (U.ext.t > 1.4 && U.ext.t < 3.2) { wx.fillStyle = 'rgba(120,255,220,.22)'; wx.beginPath(); wx.moveTo(X - 6, Y + 6); wx.lineTo(X + 6, Y + 6); wx.lineTo(X + 18, L.y + 12); wx.lineTo(X - 18, L.y + 12); wx.fill(); }
        px(wx, X - 14, Y - 4, 28, 9, '#d8dce4'); px(wx, X - 9, Y - 9, 18, 5, '#e8ecf2'); px(wx, X - 5, Y - 7, 10, 2, '#24386a'); px(wx, X - 18, Y, 4, 3, '#e8783c'); px(wx, X + 14, Y, 4, 3, '#c86432');
        const f = 3 + (Math.floor(t * 20) % 2) * 2; px(wx, X - 10, Y + 5, 3, f, '#ff9a3c'); px(wx, X + 7, Y + 5, 3, f, '#ff9a3c');
      }
      g.imageSmoothingEnabled = false; g.drawImage(world, cam.x, cam.y, HS.VW, HS.VH, 0, 0, 640, 360);
      // flare overlay
      if (!mars && flareOn()) { const safe = sheltered(p); g.fillStyle = `rgba(255,240,170,${safe ? .1 : .22 + Math.sin(t * 20) * .05})`; g.fillRect(0, 0, 640, 360); g.fillStyle = 'rgba(255,255,230,.18)'; for (let i = 0; i < 9; i++) g.fillRect(0, (t * 220 + i * 44) % 360, 640, 2); }
      if (mars && stormAt(p.x) && !atLander(p)) { g.fillStyle = 'rgba(120,70,40,.28)'; g.fillRect(0, 0, 640, 360); }

      // ----- labels
      const lab = (X, Y, s, col, dy = 22) => { const q = HS.toScreen(cam, X, Y); if (q.x > 40 && q.x < 600 && q.y > 50 && q.y < 300 && !(q.x < 290 && q.y + dy > 222) && !U.ext) tag(s, q.x, q.y + dy, col, 7.5); };
      for (const s of U.sites) if (!s.done) { const base = m.payload[s.kind]; lab(s.x, s.y, `${s.kind.toUpperCase()} SITE +${Math.max(1, Math.round(base * (1 - S.instDamage / 100)))}`, s.kind === 'rich' ? C.cyan : '#8ac8c0'); }
      if (!U.sample.done) lab(U.sample.x, U.sample.y, mi.objectives.sampleSite, C.amber);
      if (!U.deploy.done) lab(U.deploy.x, U.deploy.y, mi.objectives.deploySite, C.cyan);
      lab(L.x, L.y + 22, S.buffer > 0 ? `LANDER  uplinking ${m.comms.rate.toFixed(2)}/s` : 'LANDER', C.cyan, 14);
      if (mars && !S.bonusDone) lab(U.devil.x, U.devil.y - 30, '[F] photograph', C.pink, 0);
      if (!mars && !S.bonusDone) lab(U.overlook.x, U.overlook.y, 'EARTH VIEW  [F] photo', C.pink);
      if (!mars && (flareOn() || flareSoon())) for (const [X, Y] of U.rocks) lab(X + 5, Y + 6, 'SHELTER', C.green, 12);
      HS.arrowReset(); if (!U.ext) HS.edgeArrow(cam, L.x, L.y, C.cyan, 'LANDER', true);
      if (!U.sample.done && !U.ext) HS.edgeArrow(cam, U.sample.x, U.sample.y, C.amber, mars ? 'CORE' : 'REGOLITH', true);
      if (!U.deploy.done && !U.ext) HS.edgeArrow(cam, U.deploy.x, U.deploy.y, '#e6e8ec', 'DEPLOY', true);
      const rich = U.sites.filter(s => !s.done && s.kind === 'rich').sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (rich && S.scansRich < mi.objectives.scans && !U.ext) HS.edgeArrow(cam, rich.x, rich.y, '#78ffe6', 'RICH', true);

      // ----- HUD
      const st = U.down ? 'DOWN' : U.carry ? 'carrying the sample' : S.carried > 0 ? `carrying ${S.carried} data units` : atLander(p) ? 'at the lander: recharging' : 'hands empty';
      HS.chip('crew', 8, 30, st);
      const low = U.left < 20;
      HS.topBox(U.ext ? 'EXTRACTION' : 'EXTRACTION IN ' + fmt(U.left), `data uplinked ${Math.floor(S.uplinked)} / ${mi.target}`, low && Math.floor(t * 4) % 2 ? C.red : low ? C.amber : C.white);
      this.panel(8, 236);
      if (!U.down && !U.ext) {
        const tg = this.target();
        if (tg) { const k = U.hold && U.hold.id === tg.id ? U.hold.prog : 0; HS.prompt(k > 0 ? `${tg.label}  ${Math.round(k * 100)}%` : tg.label, 430, 318, tg.col === '#e6e8ec' ? C.cyan : tg.col); if (k > 0) bar(360, 330, 140, 4, k, C.cyan); }
        else if (U.o2 < 35 || U.pw < 35) HS.prompt(`${U.o2 < U.pw ? 'oxygen' : 'suit power'} ${Math.round(Math.min(U.o2, U.pw))}%  get to the lander`, 430, 318, C.red);
        if (U.inHazard) tag(mars ? 'IN THE DUST STORM: suit drain x4' : 'SOLAR FLARE: suit drain x6. Find shelter.', 320, 54, C.red, 8.5);
        else if (!mars && flareOn()) tag('Sheltered from the flare', 320, 54, C.green, 8.5);
        else { const f = flareSoon(); if (f) tag(`SOLAR FLARE IN ${Math.ceil(f.at - t)} s`, 320, 54, C.amber, 8.5); }
      }
      if (U.noteT > 0) { g.globalAlpha = clamp(U.noteT * 2, 0, 1); tag(U.noteS, 320, 72, U.noteCol, 8); g.globalAlpha = 1; }
      if (U.photoT > 0) { g.fillStyle = `rgba(255,255,255,${U.photoT * 2})`; g.fillRect(0, 0, 640, 360); }
      HS.hint('[E] hold to work   [F] photo   [Q] mission / suit   [TAB] hold for map');
      if (U.map) this.map(cam);
      if (U.down && !U.ext) { g.fillStyle = 'rgba(4,7,13,.45)'; g.fillRect(0, 0, 640, 360); HS.prompt(S.lostDown ? `suit empty: ${S.lostDown} carried units lost` : 'suit empty', 320, 180, C.red); }
      if (U.ext) {
        g.fillStyle = `rgba(4,7,13,${seg(U.ext.t, .2, 1.2) * .55})`; g.fillRect(0, 0, 640, 360); g.globalAlpha = seg(U.ext.t, .4, 1);
        T('EXTRACTION', 320, 150, 32, C.white, { w: 700, a: 'center', b: 'middle', f: PIX }); T('the ship from Earth leaves on time', 320, 180, 9, C.muted, { a: 'center', b: 'middle' });
        g.globalAlpha = 1;
      }
    },

    // one panel, two tabs: the mission list or the suit readout. Q flips it.
    panel(x, y) {
      const S = HS.S, mi = S.mission, o = mi.objectives, w = 204;
      box(x, y, w, 110, C.cyan, 5);
      ['MISSION', 'SUIT'].forEach((n, i) => { const tx = x + 8 + i * 62, on = n === U.tab; g.fillStyle = on ? C.cyan : '#18222e'; g.fillRect(tx, y + 7, 58, 15); T(n, tx + 29, y + 15, 7.5, on ? C.ink : C.muted, { w: 600, a: 'center', b: 'middle' }); });
      T('[Q] switch', x + w - 8, y + 15, 7, C.muted, { a: 'right', b: 'middle' });
      const lowSuit = Math.min(U.o2, U.pw) < 35;
      if (U.tab === 'MISSION' && lowSuit && Math.floor(U.t * 4) % 2) { g.fillStyle = C.red; g.fillRect(x + 70 + 58 - 6, y + 9, 4, 4); }
      if (U.tab === 'MISSION') {
        const rows = [['Scan rich sites', S.scansRich, o.scans], [o.sample, S.sampleDone ? 1 : 0, 1], [o.deploy, S.deployDone ? 1 : 0, 1], ['Uplink data', Math.floor(S.uplinked), mi.target], ['Bonus: ' + o.bonus[0].toLowerCase() + o.bonus.slice(1), S.bonusDone ? 1 : 0, 1]];
        rows.forEach(([n, a, b], i) => {
          const yy = y + 38 + i * 15, done = a >= b; g.strokeStyle = done ? C.cyan : C.muted; g.lineWidth = 1.5; g.strokeRect(x + 8, yy - 7, 8, 8);
          if (done) { g.beginPath(); g.moveTo(x + 9.5, yy - 3); g.lineTo(x + 12, yy - .5); g.lineTo(x + 16, yy - 7); g.stroke(); }
          T(n, x + 22, yy, 7.5, done ? C.muted : i === 4 ? '#c8d2dc' : C.white); T(a + '/' + b, x + w - 8, yy, 7.5, done ? C.muted : C.white, { w: 600, a: 'right' });
        });
      } else {
        const home = atLander(U.p), rc = U.m.power.recharge * (U.m.power.solar && U.mars ? .43 : 1);
        [['OXYGEN', U.o2, U.o2 < 35 ? C.red : C.green], ['POWER', U.pw, U.pw < 35 ? C.red : C.eng]].forEach(([n, v, col], i) => { const yy = y + 38 + i * 15; T(n, x + 8, yy, 7, C.muted, { w: 600 }); bar(x + 56, yy - 7, 104, 7, v / 100, col); T(Math.round(v) + '%', x + w - 8, yy, 7.5, col, { w: 600, a: 'right' }); });
        T(U.mars ? 'DUST' : 'SUN', x + 8, y + 68, 7, C.muted, { w: 600 }); T(U.inHazard ? (U.mars ? 'storm: drain x4' : 'flare: drain x6') : home ? `recharging ${rc.toFixed(1)}% per second` : U.mars ? 'clear air' : 'quiet', x + 56, y + 68, 7.5, U.inHazard ? C.amber : home ? C.green : C.white);
        T('CARRYING', x + 8, y + 83, 7, C.muted, { w: 600 }); T(U.carry ? 'the sample' : S.carried > 0 ? `${S.carried} data units` : 'nothing', x + 56, y + 83, 7.5, C.white);
        T('LANDER', x + 8, y + 98, 7, C.muted, { w: 600 }); T(S.buffer > 0 ? `${Math.ceil(S.buffer)} units waiting to send` : 'nothing waiting', x + 56, y + 98, 7.5, S.buffer > 0 ? C.cyan : C.white);
      }
    },

    map(cam) {
      const S = HS.S, x0 = 100, y0 = 44, k = 440 / 640;
      g.fillStyle = 'rgba(4,7,13,.72)'; g.fillRect(0, 0, 640, 360);
      box(x0 - 8, y0 - 22, 456, 312, C.cyan, 6);
      T('SURFACE MAP', x0, y0 - 8, 8.5, C.cyan, { w: 600 }); T('time does not stop while you look', x0 + 440, y0 - 8, 7, C.muted, { a: 'right' });
      g.imageSmoothingEnabled = true; g.drawImage(U.mars ? HS.marsBg : HS.moonBg, x0, y0, 440, 275); g.imageSmoothingEnabled = false;
      g.fillStyle = 'rgba(4,7,13,.3)'; g.fillRect(x0, y0, 440, 275);
      for (const s of U.storms) if (s.x != null) { const a = clamp(s.dir > 0 ? s.x - s.w : s.x, 0, 640), b = clamp((s.dir > 0 ? s.x - s.w : s.x) + s.w, 0, 640); g.fillStyle = 'rgba(232,160,100,.42)'; g.fillRect(x0 + a * k, y0, (b - a) * k, 275); T('STORM', x0 + (a + b) / 2 * k, y0 + 12, 7, '#ffd9b0', { a: 'center', w: 600 }); }
      const dot = (X, Y, col, s, lbl) => { HS.diamond(g, x0 + X * k, y0 + Y * k, col, s); if (lbl) T(lbl, x0 + X * k, y0 + Y * k - 7, 6.5, C.white, { a: 'center' }); };
      for (const s of U.sites) dot(s.x, s.y, s.done ? '#6e6460' : s.kind === 'rich' ? '#78ffe6' : '#5ab4aa', s.kind === 'rich' ? 6 : 4, s.done ? '' : s.kind);
      if (!U.sample.done) dot(U.sample.x, U.sample.y, C.amber, 6, U.mars ? 'core' : 'regolith');
      if (!U.deploy.done) dot(U.deploy.x, U.deploy.y, '#e6e8ec', 6, 'deploy');
      if (!S.bonusDone) dot(U.mars ? U.devil.x : U.overlook.x, U.mars ? U.devil.y : U.overlook.y, C.pink, 5, U.mars ? 'dust devil' : 'earth view');
      T('LANDER', x0 + L.x * k, y0 + L.y * k + 24, 7, C.cyan, { a: 'center', w: 600 });
      g.strokeStyle = C.white; g.lineWidth = 1; g.strokeRect(x0 + cam.x * k, y0 + cam.y * k, HS.VW * k, HS.VH * k);
      if (Math.floor(U.t * 4) % 2) { g.fillStyle = S.suit; g.fillRect(x0 + U.p.x * k - 2, y0 + U.p.y * k - 2, 5, 5); }
    }
  };
  HS.dbg = HS.dbg || {}; HS.dbg.surface = () => U;   // test hook
})();
