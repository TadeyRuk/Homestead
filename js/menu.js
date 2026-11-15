// Homestead title screen, mission brief, and the launch and landing cutscenes.
(() => {
  const HS = window.HS, g = HS.g;
  const { T, box, C, PIX, seg, ease, lerp, clamp, typed, px, ell, off } = HS;
  HS.scenes = {};

  // ---------- title: the liftoff film (js/liftoff, from the main game's src/ui/title.ts) behind the mission setup
  // The film draws on its own 1280 x 720 art canvas. Each frame that canvas goes onto the screen canvas at the
  // screen canvas's full backing resolution (nearest neighbour), and the film's words and the setup panel are
  // drawn over it at that resolution, so nothing is drawn at 640 x 360 and text stays sharp.
  const LO = HS.liftoff, CREW = '#78ffdc', INK = '#080e1a', EDGE = '#2a3a52';
  const title = { t: 0, mission: 'mars', seed: 48213, film: null, last: 0, hits: [], frost: null };
  const reroll = () => { title.seed = 10000 + Math.floor(Math.random() * 89999); };
  const cycleSuit = () => { const i = HS.SUITS.indexOf(HS.S.suit); HS.S.suit = HS.SUITS[(i + 1) % HS.SUITS.length]; if (HS.saveCrew) HS.saveCrew(); };
  const film = () => (title.film ??= new LO.Liftoff(LO.calm()));
  // the main game's title shows a film you can scrub from a test script; same hook here
  window.__hsTitle = { seek(t) { const f = film(); f.setDest(title.mission); f.replay(); f.time = t; }, get time() { return title.film ? title.film.time : 0; } };
  const act = (id) => {
    if (id === 'moon' || id === 'mars') { if (title.mission !== id) { title.mission = id; HS.sfx.blip(); } }
    else if (id === 'suit') { cycleSuit(); HS.sfx.blip(); }
    else if (id === 'seed') { reroll(); HS.sfx.blip(); }
    else if (id === 'replay') { film().replay(); HS.sfx.blip(); }
    else if (id === 'start' && title.t > .4) HS.scenes.title.start();
  };
  // the setup panel: the main game's lobby form on the title (frosted glass, Pixelify heading, uppercase labels)
  const font = (size, w = 600, f = LO.MONO) => `${w} ${size}px ${f}`;
  const rrect = (x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
  function frost(art, x, y, w, h, r, blur, S) {
    // backdrop-filter: blur, done at half the art grid (a blur loses nothing to that, and costs a quarter),
    // then scaled up and clipped to the panel; unblurred where canvas filters are missing
    const m = blur * 3, F = title.frost ??= HS.off(1, 1);
    const [c, cx] = F, cw = Math.ceil((w + m * 2) / 2), ch = Math.ceil((h + m * 2) / 2);
    if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    cx.imageSmoothingEnabled = true;
    cx.filter = `blur(${blur / 2}px) saturate(1.15)`;
    cx.clearRect(0, 0, cw, ch);
    cx.drawImage(art, x - m, y - m, cw * 2, ch * 2, 0, 0, cw, ch);
    cx.filter = 'none';
    g.save(); rrect(x, y, w, h, r); g.clip();
    g.imageSmoothingEnabled = true; g.drawImage(c, m / 2, m / 2, w / 2, h / 2, x, y, w, h);
    g.restore();
  }
  function drawSetup(S, art, k) {
    const hits = title.hits = [];
    const mx = HS.In.mx * 2, my = HS.In.my * 2, over = (x, y, w, h) => mx >= x && mx <= x + w && my >= y && my <= y + h;
    const PW = 340, PAD = 24, X = 1229 - PW - PAD * 2 - 2, best = HS.best();
    const H = 454 + (best ? 29 : 0), Y = Math.round(360 - H / 2 + (1 - k) * 12);
    g.save();
    g.globalAlpha = k;
    // the panel: shadow, frosted backdrop, tint, edge and the inset highlight
    g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 40 * S; g.shadowOffsetY = 18 * S;
    rrect(X, Y, PW + PAD * 2 + 2, H, 6); g.fillStyle = INK; g.fill(); g.restore();
    frost(art, X, Y, PW + PAD * 2 + 2, H, 6, 10, S);
    rrect(X, Y, PW + PAD * 2 + 2, H, 6); g.fillStyle = 'rgba(10,16,30,.58)'; g.fill();
    g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,.16)'; rrect(X + .5, Y + .5, PW + PAD * 2 + 1, H - 1, 6); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(X + 6, Y + 1, PW + PAD * 2 - 10, 1);
    const L0 = X + 1 + PAD;
    const text = (s, x, y, size, col, o = {}) => { g.font = font(size, o.w, o.f); g.fillStyle = col; g.textAlign = o.a || 'left'; g.textBaseline = 'middle'; if ('letterSpacing' in g) g.letterSpacing = o.ls ? o.ls + 'px' : '0px'; g.fillText(s, x, y); };
    const label = (s, y) => text(s, L0, y + 9, 12, HS.C.muted, { ls: 0.96 });
    const btn = (id, s, x, y, kind, w) => {
      g.font = font(15); if ('letterSpacing' in g) g.letterSpacing = '0px';
      w = w || Math.ceil(g.measureText(s).width) + (kind === 'toggle' || kind === 'on' ? 24 : 40) + 2;
      const hot = over(x, y, w, 44), prim = kind === 'primary', on = kind === 'on';
      rrect(x, y, w, 44, 4);
      g.fillStyle = prim ? (hot ? '#a8ffe8' : CREW) : on ? 'rgba(120,255,220,.12)' : hot ? '#252e40' : '#1b2230'; g.fill();
      g.strokeStyle = prim || on ? CREW : hot ? '#3a4558' : EDGE; rrect(x + .5, y + .5, w - 1, 43, 4); g.stroke();
      text(s, x + w / 2, y + 22.5, 15, prim ? INK : on ? CREW : HS.C.white, { a: 'center' });
      hits.push({ id, x, y, w, h: 44 });
      return w;
    };
    const field = (x, y, w) => { rrect(x + .5, y + .5, w - 1, 43, 4); g.fillStyle = '#050a14'; g.fill(); g.strokeStyle = EDGE; g.stroke(); };
    let y = Y + PAD;
    text('Mission setup', L0, y + 9, 18, CREW, { w: 700, f: LO.PIXEL, ls: 0.72 });
    y += 38; label('MISSION', y);
    y += 26; const wm = btn('moon', '[1] Moon', L0, y, title.mission === 'moon' ? 'on' : 'toggle'); btn('mars', '[2] Mars', L0 + wm + 8, y, title.mission === 'mars' ? 'on' : 'toggle');
    y += 52; text(title.mission === 'moon' ? 'About 3 days away. Solar flares.' : 'About 7 months away. Dust storms.', L0, y + 10.5, 14, HS.C.muted, { w: 500 });
    y += 37; label('SUIT COLOUR', y);
    y += 26; field(L0, y, 44); g.fillStyle = INK; g.fillRect(L0 + 11, y + 11, 22, 22); g.fillStyle = HS.S.suit; g.fillRect(L0 + 12, y + 12, 20, 20);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(L0 + 12, y + 12, 20, 1);
    btn('suit', '[C] Change', L0 + 52, y, 'plain');
    y += 60; label('SEED', y); text('same seed, same run', L0 + PW, y + 9, 12, '#6f7d8c', { w: 500, a: 'right' });
    y += 26; g.font = font(15); const wr = Math.ceil(g.measureText('[R] New seed').width) + 42;
    field(L0, y, PW - wr - 8); text(String(title.seed), L0 + 13, y + 22.5, 15, HS.C.white, { w: 500 });
    btn('seed', '[R] New seed', L0 + PW - wr, y, 'plain', wr);
    y += 64; btn('start', '[Enter] Suit up', L0, y, 'primary');
    y += 52; text('Solo run: all four roles. About 10 min.', L0, y + 10.5, 14, HS.C.muted, { w: 500 });
    if (best) text('Best score ' + best, L0, y + 39.5, 14, HS.C.amber, { w: 600 });
    g.restore();
  }
  function drawReplay(S, art) {
    // the main game's "↻ Replay" pill, bottom centre
    const s = '↻ Replay'; g.font = font(11); if ('letterSpacing' in g) g.letterSpacing = '0px';
    const w = Math.ceil(g.measureText(s).width + 28.6 + 2), h = 28.4, x = Math.round(640 - w / 2), y = 720 - 7.5 - h;
    const mx = HS.In.mx * 2, my = HS.In.my * 2, hot = mx >= x && mx <= x + w && my >= y && my <= y + h;
    frost(art, x, y, w, h, h / 2, 6, S);
    rrect(x, y, w, h, h / 2); g.fillStyle = hot ? 'rgba(8,14,26,.85)' : 'rgba(8,14,26,.62)'; g.fill();
    g.lineWidth = 1; g.strokeStyle = hot ? CREW : 'rgba(255,255,255,.35)'; rrect(x + .5, y + .5, w - 1, h - 1, h / 2); g.stroke();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, x + w / 2, y + h / 2 + .5);
    title.hits.push({ id: 'replay', x, y, w, h });
  }
  HS.scenes.title = {
    enter() { title.t = 0; title.last = performance.now(); title.hits = []; if (!HS.S) HS.S = HS.loadCrew(); if (title.film) title.film.replay(); },
    // nothing of the film runs outside this scene: it has no loop or listeners of its own, and draws offscreen
    exit() { if (title.film) { title.film.env.fx.clear(); title.film.tx.clear(); } title.hits = []; },
    update(dt) {
      title.t += dt;
      if (HS.hit('ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Digit1', 'Digit2')) act(HS.hit('Digit1') ? 'moon' : HS.hit('Digit2') ? 'mars' : (title.mission === 'mars' ? 'moon' : 'mars'));
      if (HS.hit('KeyR')) act('seed');
      if (HS.hit('KeyC')) act('suit');
      if (HS.hit('Enter', 'Space')) act('start');
      if (HS.In.click) { const mx = HS.In.mx * 2, my = HS.In.my * 2, h = title.hits.find(b => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h); if (h) act(h.id); }
    },
    // a new run keeps the crew's suit, visor and callsign; the crew page comes before the brief
    start() { HS.newRun(title.mission, title.seed); HS.sfx.ok(); HS.go('crew'); },
    draw() {
      const now = performance.now(), dt = Math.min(0.1, (now - title.last) / 1000);
      title.last = now;
      const f = film(), si = HS.SUITS.indexOf(HS.S.suit);
      // what the setup says: the mission picks the world, and the suit colour dresses the first astronaut to board
      f.setDest(title.mission);
      f.env.lead = { name: HS.S.name || '', role: si >= 0 && si < 4 ? si : 0, suit: si >= 0 && si < 4 ? '' : HS.S.suit };
      f.prepare(4);
      const t = f.tick(dt);
      f.draw(t, dt);
      // the art is on a 1280 x 720 grid; show it as sharp pixels, then put the text on top at full resolution
      g.setTransform(1, 0, 0, 1, 0, 0);
      const S = HS.cv.width / LO.ART_W;
      g.imageSmoothingEnabled = S < 1;
      g.drawImage(f.art, 0, 0, HS.cv.width, HS.cv.height);
      f.tx.flush(g, S, LO.PIXEL, LO.MONO);
      // the setup panel and the replay pill, laid out on the same 1280 x 720 grid
      g.setTransform(S, 0, 0, S, 0, 0);
      const k = f.env.calm ? 1 : 1 - Math.pow(1 - seg(title.t, .3, .8), 3);
      drawSetup(S, f.art, k);
      drawReplay(S, f.art);
    }
  };

  // ---------- brief
  const brief = { t: 0, typedN: 0 };
  HS.scenes.brief = {
    enter() { brief.t = 0; brief.typedN = 0; },
    update(dt) {
      brief.t += dt;
      const n = Math.floor(brief.t * 30); if (n !== brief.typedN && brief.t < 4.2) { brief.typedN = n; if (n % 2 === 0) HS.sfx.type(); }
      if ((HS.hit('Enter', 'Space', 'KeyE') || HS.In.click) && brief.t > .5) { if (brief.t < 4.2) brief.t = 4.2; else { HS.sfx.ok(); HS.go('build'); } }
      if (brief.t > 20) HS.go('build');
    },
    draw() {
      const t = brief.t, m = HS.S.mission;
      HS.starfield(t + 15, .3);
      box(110, 34, 420, 290, C.cyan, 6);
      T('MISSION CONTROL  /  INCOMING BRIEF', 128, 56, 8.5, C.cyan, { w: 600 });
      T('seed ' + HS.S.seed, 512, 56, 7.5, C.muted, { a: 'right' });
      T(m.name, 128, 86, 24, C.white, { w: 700, f: PIX });
      m.card.forEach(([a, b], i) => { const k = t - .4 - i * .45; if (k < 0) return; T(a, 128, 112 + i * 19, 8.5, C.muted, { w: 600 }); T(typed(b, k, 55), 220, 112 + i * 19, 9, i === 6 ? C.amber : C.white, { w: i === 6 ? 600 : 500 }); });
      if (t > 4) {
        g.globalAlpha = seg(t, 4, 4.6);
        T('Extraction leaves when the clock runs out, finished or not.', 128, 254, 8, C.muted);
        g.strokeStyle = '#22324a'; g.lineWidth = 1; g.beginPath(); g.moveTo(128, 264); g.lineTo(512, 264); g.stroke();
        T('MOVE', 128, 280, 7.5, C.muted, { w: 600 }); T('WASD or arrow keys', 176, 280, 8, C.white);
        T('USE', 128, 293, 7.5, C.muted, { w: 600 }); T('[E] pick up, mount, scan     [L] launch     [TAB] map', 176, 293, 8, C.white);
        T('FLIGHT', 128, 306, 7.5, C.muted, { w: 600 }); T('[1] [2] [3] [4] switch between the four stations', 176, 306, 8, C.white);
        g.globalAlpha = 1;
        if (Math.floor(t * 2) % 2) HS.prompt('[ENTER] go to the launch campus', 320, 338, C.amber);
      }
    }
  };

  // ---------- launch cutscene (also plays the overweight failure)
  const [lp, lx] = off(320, 180);
  const smoke = (() => { const r = HS.R(31); return Array.from({ length: 70 }, () => ({ t0: r() * 3.4, dx: (r() - .5) * 2, s: 3 + r() * 6 })); })();
  const cut = { t: 0, fail: false, boom: false, fx: new HS.Parts() };
  HS.scenes.launch = {
    enter() { cut.t = 0; cut.fail = HS.model().overweight; cut.boom = false; cut.fx = new HS.Parts(); HS.sfx.launch(); HS.flash('255,255,255', .9); },
    update(dt) {
      cut.t += dt; cut.fx.update(dt);
      if (cut.t < 3.4) HS.shake(1.6);
      if (cut.fail && cut.t > 3 && !cut.boom) {
        cut.boom = true; HS.sfx.boom(); HS.shake(10); HS.flash('255,200,120', .8);
        cut.fx.burst(160, 96, 90, 90, 1.6, ['#ffd27a', '#ff6a3c', '#fff0c8', '#8a8e9a'], 2, 60);
        const m = HS.model(); HS.S.ended = { phase: 'launch', reason: 'overweight' }; HS.S.hull = 0; HS.log('overweight', { mass: m.mass, lift: m.lift });
      }
      if (cut.t > (cut.fail ? 5.4 : 4.6)) HS.go(cut.fail ? 'report' : 'flight');
    },
    draw() {
      const t = cut.t, m = HS.model(), fail = cut.fail;
      const kUp = fail ? ease(seg(t, .6, 3)) * .32 : ease(seg(t, .6, 4));
      const climb = kUp * 260;
      for (let y = 0; y < 180; y++) { const k = clamp((y - climb * .4) / 180, 0, 1); lx.fillStyle = `rgb(${lerp(6, 70, k) | 0},${lerp(10, 120, k) | 0},${lerp(28, 190, k) | 0})`; lx.fillRect(0, y, 320, 1); }
      const gy = 150 + climb; px(lx, 0, gy, 320, 40, '#2c584c'); px(lx, 120, gy - 6, 80, 6, '#9298a2'); px(lx, 100, gy - 60, 6, 54, '#707884');
      const ry = 120 - kUp * 70 + Math.sin(t * 60) * (t > .4 ? .6 : 0);
      for (const s of smoke) { const k = t - s.t0; if (k < 0 || k > 2.5) continue; const X = 160 + s.dx * k * 18, Y = gy - 6 - k * 4 + (climb * .2); ell(lx, X, Y, s.s + k * 6, (s.s + k * 6) * .6, `rgba(220,220,225,${.5 - k * .18})`); }
      if (!cut.boom) HS.rocket(lx, 160.5, ry + 26, 1, t > .3 ? 10 + (Math.floor(t * 20) % 3) * 3 : 0);
      cut.fx.draw(lx);
      g.imageSmoothingEnabled = false; g.drawImage(lp, 0, 0, 640, 360);
      const names = HS.SLOTS.map(s => HS.PARTS[HS.S.slots[s]].name).join('  /  ');
      if (!fail) {
        g.globalAlpha = seg(t, .8, 1.3) * (1 - seg(t, 3.4, 4.1));
        T('LIFTOFF', 320, 60, 30, C.white, { w: 700, a: 'center', b: 'middle', f: PIX });
        T(names + '   ' + m.mass + ' kg', 320, 86, 8.5, C.white, { a: 'center', b: 'middle' });
      } else if (t < 3) {
        g.globalAlpha = seg(t, .8, 1.3);
        T('TOO HEAVY', 320, 60, 30, C.amber, { w: 700, a: 'center', b: 'middle', f: PIX });
        T(`${m.mass} kg on an engine that lifts ${m.lift} kg`, 320, 86, 8.5, C.white, { a: 'center', b: 'middle' });
      } else {
        T('LAUNCH FAILED', 320, 60, 30, C.red, { w: 700, a: 'center', b: 'middle', f: PIX });
        T('The crew escape system fired. Everyone is alive, and the mission is over.', 320, 86, 8.5, C.white, { a: 'center', b: 'middle' });
      }
      g.globalAlpha = 1;
    }
  };

  // ---------- landing cutscene
  const land = { t: 0, dust: false };
  HS.scenes.landing = {
    enter() { land.t = 0; land.dust = false; },
    update(dt) { land.t += dt; if (land.t > 3.05 && !land.dust) { land.dust = true; HS.shake(5); HS.sfx.hitHull(); } if (land.t > 5.2 || (land.t > 3.6 && HS.hit('Enter', 'Space', 'KeyE'))) HS.go('surface'); },
    draw() {
      const t = land.t, mars = HS.S.mission.id === 'mars';
      for (let y = 0; y < 180; y++) { const k = y / 180; lx.fillStyle = mars ? `rgb(${lerp(40, 210, k) | 0},${lerp(24, 130, k) | 0},${lerp(30, 100, k) | 0})` : `rgb(${lerp(4, 16, k) | 0},${lerp(6, 18, k) | 0},${lerp(12, 30, k) | 0})`; lx.fillRect(0, y, 320, 1); }
      if (!mars) { const r = HS.R(9); for (let i = 0; i < 60; i++) px(lx, r() * 320, r() * 120, 1, 1, '#c8d0e0'); ell(lx, 250, 36, 12, 12, '#2858aa'); ell(lx, 246, 33, 5, 4, '#46885a'); ell(lx, 254, 40, 4, 3, '#e8eef4'); }
      const gy = 180 - ease(seg(t, 0, 3)) * 50; px(lx, 0, gy, 320, 60, mars ? '#9a4a30' : '#7a7e8a'); for (let i = 0; i < 40; i++) px(lx, (i * 37) % 320, gy + 4 + (i * 13) % 40, 3, 2, mars ? '#6e341f' : '#565a66');
      const ly = lerp(-20, gy - 16, ease(seg(t, 0, 3.1)));
      if (t < 3.1) { const f = 4 + (Math.floor(t * 20) % 2) * 3; px(lx, 158, ly + 16, 4, f, '#ff9a3c'); px(lx, 159, ly + 16, 2, f - 2, '#fff0c8'); }
      px(lx, 150, ly, 20, 12, '#b0924c'); px(lx, 154, ly - 5, 12, 5, '#c8aa62'); px(lx, 147, ly + 12, 2, 4, '#9a9aa4'); px(lx, 171, ly + 12, 2, 4, '#9a9aa4'); px(lx, 136, ly + 3, 12, 4, '#2c4aa0'); px(lx, 172, ly + 3, 12, 4, '#2c4aa0');
      if (t > 3) { const k = seg(t, 3, 4); for (let i = 0; i < 14; i++) ell(lx, 160 + (i - 7) * 6 * (1 + k * 2), gy - 2 - Math.abs(i - 7) * .5, 4 + k * 6, 3 + k * 3, mars ? `rgba(220,150,110,${.6 - k * .5})` : `rgba(200,204,214,${.6 - k * .5})`); }
      g.imageSmoothingEnabled = false; g.drawImage(lp, 0, 0, 640, 360);
      g.globalAlpha = seg(t, 3.1, 3.4);
      T('TOUCHDOWN', 320, 60, 30, C.white, { w: 700, a: 'center', b: 'middle', f: PIX });
      const dmg = HS.S.instDamage > 1 ? `instrument at ${Math.round(100 - HS.S.instDamage)}%` : 'instrument intact';
      T(`Hull ${Math.round(HS.S.hull)}%  /  fuel ${Math.round(HS.S.fuel)}%  /  ${dmg}`, 320, 86, 8.5, '#f1d9cf', { a: 'center', b: 'middle' });
      g.globalAlpha = 1;
    }
  };
})();
