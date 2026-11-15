// Homestead main loop and scene switcher.
(() => {
  const HS = window.HS, g = HS.g;
  let cur = null, next = null, fade = 0, fadeDir = 0, fadeCol = '4,7,13', last = 0;
  HS.time = 0; HS.speed = 1; HS.paused = false;
  let scale = 2;
  // keep the canvas backing store at the size it is shown, so text stays sharp on any window or display
  const fit = () => { const r = HS.cv.getBoundingClientRect(), d = window.devicePixelRatio || 1, w = Math.max(640, Math.min(3840, Math.round(r.width * d))); if (HS.cv.width !== w) { HS.cv.width = w; HS.cv.height = Math.round(w * 9 / 16); } scale = HS.cv.width / 640; };
  window.addEventListener('resize', fit); fit();
  const PLAY = ['build', 'flight', 'surface'];

  HS.go = (name, col) => { if (next) return; next = name; fadeDir = 1; fadeCol = col || '4,7,13'; };
  const enter = (name) => { if (cur && cur.exit) cur.exit(); cur = HS.scenes[name]; HS.sceneName = name; HS.In.hit.clear(); HS.In.click = false; if (cur.enter) cur.enter(); };

  function frame(now) {
    let dt = Math.min(.05, (now - last) / 1000) || 0; last = now;
    for (let i = 0; i < HS.speed; i++) { step(dt); if (i === 0 && HS.speed > 1) HS.endFrame(); }   // key presses count once per frame
    draw();
    // spend a few spare milliseconds a frame building the launch campus ahead of time (js/campus.js)
    if (HS.campusPrewarm && HS.sceneName !== 'build') HS.campusPrewarm(5);
    HS.endFrame();
    requestAnimationFrame(frame);
  }
  function step(dt) {
    HS.time += dt;
    if (HS.hit('KeyM') && !HS.typing) { HS.muted = !HS.muted; }
    if (HS.hit('Escape') && PLAY.includes(HS.sceneName) && !next) { HS.paused = !HS.paused; HS.sfx.blip(); }
    if (HS.paused) {
      if (HS.hit('KeyT')) { HS.paused = false; HS.go('title'); }
      else if (HS.hit('KeyR')) { const S = HS.S; HS.paused = false; HS.newRun(S.mission.id, S.seed); HS.S.suit = S.suit; HS.go('brief'); }
      else if (HS.hit('Enter', 'Space')) HS.paused = false;
      return;
    }
    if (fadeDir > 0) { fade += dt * 3.2; if (fade >= 1) { fade = 1; fadeDir = -1; enter(next); next = null; } }
    else if (fadeDir < 0) { fade -= dt * 2.4; if (fade <= 0) { fade = 0; fadeDir = 0; } }
    if (cur && fadeDir <= 0) cur.update(dt);
    HS.shakeAmt = Math.max(0, HS.shakeAmt - dt * 14);
    HS.flashA = Math.max(0, HS.flashA - dt * 1.2);
  }
  function draw() {
    const sx = HS.shakeAmt ? (Math.random() - .5) * HS.shakeAmt : 0, sy = HS.shakeAmt ? (Math.random() - .5) * HS.shakeAmt : 0;
    g.setTransform(scale, 0, 0, scale, Math.round(sx * scale), Math.round(sy * scale));
    g.globalAlpha = 1; g.imageSmoothingEnabled = false;
    g.fillStyle = '#04070d'; g.fillRect(-10, -10, 660, 380);
    if (cur) { g.save(); cur.draw(); g.restore(); }
    if (HS.flashA > 0) { g.fillStyle = `rgba(${HS.flashCol},${HS.flashA})`; g.fillRect(-10, -10, 660, 380); }
    // watermark required by the Space Apps AI rules, plus the sound state
    // on the title the film has its own words along the bottom, so the watermark moves to the top edge there
    const s = 'AI-assisted placeholder art', w = HS.tw(s, 6.5), wy = HS.sceneName === 'title' ? 0 : 349;
    g.fillStyle = 'rgba(8,14,26,.7)'; g.fillRect(640 - w - (PLAY.includes(HS.sceneName) ? 96 : 44), wy, w + 96, 11);
    HS.T(s, 636, wy + 6, 6.5, '#aab6c2', { a: 'right', b: 'middle' });
    HS.T(HS.muted ? '[M] off' : '[M] snd', 640 - w - 41, wy + 6, 6.5, HS.muted ? HS.C.red : '#6f7d8c', { b: 'middle' });
    if (HS.paused) {
      g.fillStyle = 'rgba(4,7,13,.78)'; g.fillRect(-10, -10, 660, 380);
      HS.box(210, 112, 220, 136, HS.C.cyan, 6);
      HS.T('PAUSED', 320, 140, 22, HS.C.white, { w: 700, a: 'center', b: 'middle', f: HS.PIX });
      [['[ESC] or [ENTER]', 'resume'], ['[R]', 'restart this seed'], ['[T]', 'quit to title'], ['[M]', HS.muted ? 'sound is off' : 'sound is on']].forEach(([k, v], i) => { HS.T(k, 306, 170 + i * 17, 8, HS.C.amber, { w: 600, a: 'right' }); HS.T(v, 316, 170 + i * 17, 8, HS.C.white); });
    } else if (PLAY.includes(HS.sceneName)) HS.T('[ESC] pause', 640 - w - 50, 355, 6.5, '#6f7d8c', { a: 'right', b: 'middle' });
    if (fade > 0) { g.fillStyle = `rgba(${fadeCol},${fade})`; g.fillRect(-10, -10, 660, 380); }
  }

  // debug / test hooks: ?scene=flight&mission=mars&seed=7&parts=chem,rtg,dish,spectro&speed=4
  const q = new URLSearchParams(location.search);
  HS.speed = HS.clamp(parseInt(q.get('speed') || '1', 10) || 1, 1, 16);
  const start = () => {
    const scene = q.get('scene');
    if (scene && HS.scenes[scene]) {
      HS.newRun(q.get('mission') === 'moon' ? 'moon' : 'mars', parseInt(q.get('seed') || '48213', 10));
      const parts = (q.get('parts') || 'solid,rtg,dish,camera').split(',');
      parts.forEach(id => { const p = HS.PARTS[id]; if (p) HS.S.slots[p.slot] = id; });
      HS.S.buildLeft = 37;
      enter(scene);
    } else enter('title');
    requestAnimationFrame((n) => { last = n; requestAnimationFrame(frame); });
  };
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(start, start);
})();
