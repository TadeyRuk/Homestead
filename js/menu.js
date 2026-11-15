// Homestead title screen, mission brief, and the launch and landing cutscenes.
(() => {
  const HS = window.HS, g = HS.g;
  const { T, box, C, PIX, seg, ease, lerp, clamp, typed, px, ell, off } = HS;
  HS.scenes = {};

  // ---------- title
  const title = { t: 0, mission: 'mars', seed: 48213, fx: new HS.Parts() };
  const reroll = () => { title.seed = 10000 + Math.floor(Math.random() * 89999); };
  HS.scenes.title = {
    enter() { title.t = 0; if (!HS.S) HS.S = { suit: C.pilot }; },
    update(dt) {
      title.t += dt; title.fx.update(dt);
      const rx = 96 + Math.sin(title.t * .7) * 10, ry = 250 - ((title.t * 14) % 420) + 120;
      if (Math.random() < .9) title.fx.add(rx + (Math.random() - .5) * 4, ry + 4, (Math.random() - .5) * 8, 30 + Math.random() * 30, .7, Math.random() < .5 ? '#ff9a3c' : '#fff0c8', 2);
      title.rx = rx; title.ry = ry;
      if (HS.hit('ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Digit1', 'Digit2')) { title.mission = HS.hit('Digit1') ? 'moon' : HS.hit('Digit2') ? 'mars' : (title.mission === 'mars' ? 'moon' : 'mars'); HS.sfx.blip(); }
      if (HS.hit('KeyR')) { reroll(); HS.sfx.blip(); }
      if (HS.hit('KeyC')) { const i = HS.SUITS.indexOf(HS.S.suit); HS.S.suit = HS.SUITS[(i + 1) % HS.SUITS.length]; HS.sfx.blip(); }
      if (HS.hit('Enter', 'Space') && title.t > .4) this.start();
    },
    start() { const suit = HS.S.suit; HS.newRun(title.mission, title.seed); HS.S.suit = suit; HS.sfx.ok(); HS.go('brief'); },
    draw() {
      const t = title.t;
      HS.starfield(t);
      title.fx.draw(g); HS.rocket(g, title.rx, title.ry, 1.2, 0);
      g.globalAlpha = seg(t, .1, 1);
      T('HOMESTEAD', 320, 96, 64, '#ffffff', { w: 700, a: 'center', b: 'middle', f: PIX });
      g.globalAlpha = seg(t, .6, 1.6);
      T('Finish the Mission Given by Mission Control', 320, 138, 13, '#f1d9cf', { a: 'center', b: 'middle', f: PIX });
      T('So We Can Go Home to Our Families', 320, 155, 13, '#f1d9cf', { a: 'center', b: 'middle', f: PIX });
      g.globalAlpha = seg(t, 1, 1.8);
      // mission cards
      [['moon', 126], ['mars', 326]].forEach(([id, x], i) => {
        const m = HS.MISSIONS[id], on = title.mission === id, y = 182;
        if (HS.over(x, y, 188, 74) && HS.In.click) { title.mission = id; HS.sfx.blip(); }
        box(x, y, 188, 74, on ? C.cyan : '#3a4a62', 6, on ? 'rgba(120,255,220,.08)' : 'rgba(14,22,36,.95)');
        T(`[${i + 1}]`, x + 10, y + 16, 8, C.muted, { w: 600 }); T(m.name, x + 30, y + 17, 13, on ? C.white : C.muted, { w: 700, f: PIX });
        T(id === 'moon' ? 'About 3 days away. Short flight.' : 'About 7 months away. Long flight.', x + 10, y + 34, 7.5, C.muted);
        T(id === 'moon' ? 'Hazard: solar flares' : 'Hazard: dust storms', x + 10, y + 46, 7.5, C.muted);
        T(`uplink ${m.target} data units  /  ${m.credits} credits`, x + 10, y + 62, 7.5, on ? C.amber : C.muted, { w: 600 });
        if (id === 'moon') { ell(g, x + 168, y + 18, 9, 9, '#b4b8c4'); ell(g, x + 165, y + 16, 2, 2, '#8a8e9a'); ell(g, x + 171, y + 21, 3, 2, '#8a8e9a'); }
        else { ell(g, x + 168, y + 18, 9, 9, '#c45c38'); ell(g, x + 165, y + 20, 4, 2, '#9a4428'); }
      });
      // crew and seed
      box(126, 264, 188, 40, '#3a4a62', 6, 'rgba(14,22,36,.95)');
      HS.bigAstro(134, 268 + Math.sin(t * 2) * 1, 1.2, HS.S.suit);
      T('SUIT COLOUR', 168, 280, 7.5, C.muted, { w: 600 }); T('[C] change', 168, 293, 8, C.white);
      if (HS.over(126, 264, 188, 40) && HS.In.click) { const i = HS.SUITS.indexOf(HS.S.suit); HS.S.suit = HS.SUITS[(i + 1) % HS.SUITS.length]; HS.sfx.blip(); }
      box(326, 264, 188, 40, '#3a4a62', 6, 'rgba(14,22,36,.95)');
      T('SEED', 336, 280, 7.5, C.muted, { w: 600 }); T(String(title.seed), 336, 296, 14, C.white, { w: 700, f: PIX });
      T('[R] new seed', 506, 280, 8, C.white, { a: 'right' }); T('same seed, same run', 506, 293, 7, C.muted, { a: 'right' });
      if (HS.over(326, 264, 188, 40) && HS.In.click) { reroll(); HS.sfx.blip(); }
      const blink = Math.floor(t * 2) % 2 === 0;
      if (HS.button(blink ? '[ENTER]  START MISSION' : '[ENTER]  START MISSION ', 230, 314, 180, 22, C.amber, blink) && t > .4) this.start();
      T('Solo run: you cover all four roles. About ten minutes.', 320, 345, 7.5, C.muted, { a: 'center' });
      T('NASA Space Apps Challenge 2026  /  Space Mission Design Game', 8, 355, 6.5, '#6f7d8c', { b: 'middle' });
      const best = HS.best(); if (best) T('BEST ' + best, 632, 12, 8, C.amber, { w: 600, a: 'right' });
      g.globalAlpha = 1;
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
