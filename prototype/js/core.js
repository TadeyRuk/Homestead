// Homestead core: helpers, palette, HUD drawing, input, sound, particles.
// All HUD coordinates are in a 640x360 space; the canvas is 1280x720 and scaled 2x.
(() => {
  const HS = window.HS = {};
  const cv = document.getElementById('screen');
  const g = cv.getContext('2d');
  HS.cv = cv; HS.g = g; HS.W = 640; HS.H = 360;

  // ---------- helpers
  const R = HS.R = (s) => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const clamp = HS.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = HS.lerp = (a, b, t) => a + (b - a) * t;
  HS.ease = (t) => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  HS.seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  HS.off = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  HS.shade = (h, f) => { const [r, gg, b] = hex(h); return `rgb(${clamp(r * f, 0, 255) | 0},${clamp(gg * f, 0, 255) | 0},${clamp(b * f, 0, 255) | 0})`; };
  HS.rgba = (h, a) => { const [r, gg, b] = hex(h); return `rgba(${r},${gg},${b},${a})`; };
  HS.px = (x, X, Y, w, h, c) => { x.fillStyle = c; x.fillRect(Math.round(X), Math.round(Y), w, h); };
  HS.ell = (x, X, Y, rx, ry, c) => { x.fillStyle = c; x.beginPath(); x.ellipse(X, Y, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2); x.fill(); };
  HS.noise = (x, w, h, r, amt, dens) => {
    const d = x.getImageData(0, 0, w, h), a = d.data;
    for (let i = 0; i < a.length; i += 4) if (r() < dens) { const k = (r() * 2 - 1) * amt; a[i] += k; a[i + 1] += k; a[i + 2] += k; }
    x.putImageData(d, 0, 0);
  };
  HS.fmt = (s) => { s = Math.max(0, s); return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
  HS.typed = (s, t, cps = 40) => s.slice(0, Math.max(0, Math.floor(t * cps)));
  HS.shuffle = (arr, r) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------- palette (from the team's walkthrough)
  const C = HS.C = { crew: '#78ffdc', pilot: '#f08c32', eng: '#f0d246', comms: '#46d2e6', sci: '#e155b9', cyan: '#78ffdc', amber: '#ffb43c', red: '#ff5a50', white: '#ebf0f5', muted: '#96a5b4', green: '#6edc82', ink: '#080e1a', pink: '#ff96e1' };
  HS.CAT = { prop: '#f08c32', power: '#5a96f5', comms: '#e6ebf0', payload: '#e6b946' };
  HS.NAME = { crew: 'SOLO CREW', pilot: 'PILOT', eng: 'ROCKET ENGINEER', comms: 'COMMS ENGINEER', sci: 'SCIENCE OFFICER' };
  HS.ROLES = ['pilot', 'eng', 'comms', 'sci'];
  HS.SUITS = ['#f08c32', '#f0d246', '#46d2e6', '#e155b9', '#6edc82', '#ebf0f5', '#a078ff', '#ff5a50'];
  const MONO = '"IBM Plex Mono", ui-monospace, Consolas, monospace';
  const PIX = HS.PIX = '"Pixelify Sans", "Courier New", monospace';

  // ---------- HUD drawing
  const T = HS.T = (s, x, y, size, col, o = {}) => {
    g.font = `${o.w || 500} ${size}px ${o.f || MONO}`; g.fillStyle = col;
    g.textAlign = o.a || 'left'; g.textBaseline = o.b || 'alphabetic'; g.fillText(s, x, y);
  };
  HS.tw = (s, size, o = {}) => { g.font = `${o.w || 500} ${size}px ${o.f || MONO}`; return g.measureText(s).width; };
  const rr = HS.rr = (x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
  const box = HS.box = (x, y, w, h, edge, r = 5, fill = 'rgba(8,14,26,.9)') => { rr(x, y, w, h, r); g.fillStyle = fill; g.fill(); if (edge) { g.strokeStyle = edge; g.lineWidth = 1.5; g.stroke(); } };
  HS.tag = (s, x, y, col, size = 8) => {
    g.font = `600 ${size}px ${MONO}`; const w = g.measureText(s).width;
    x = clamp(x, HS.X0 + w / 2 + 8, HS.X1 - w / 2 - 8);
    box(x - w / 2 - 5, y - size + 1, w + 10, size + 7, col, 3); T(s, x, y + 1.5, size, col, { w: 600, a: 'center', b: 'middle' });
  };
  HS.bar = (x, y, w, h, f, col, back = '#1e2838') => { g.fillStyle = back; g.fillRect(x, y, w, h); g.fillStyle = col; g.fillRect(x, y, w * clamp(f, 0, 1), h); };
  HS.chip = (role, x, y, extra) => {
    const n = HS.NAME[role]; const w1 = HS.tw(n, 8.5, { w: 600 }); const w2 = extra ? HS.tw(extra, 8) + 8 : 0;
    box(x, y, w1 + 14 + w2, 17, C[role], 4); T(n, x + 7, y + 9, 8.5, C[role], { w: 600, b: 'middle' });
    if (extra) T(extra, x + w1 + 14, y + 9, 8, C.white, { b: 'middle' });
  };
  HS.prompt = (s, cx, cy, col) => {
    const w = HS.tw(s, 8.5, { w: 600 }); cx = clamp(cx, HS.X0 + w / 2 + 12, HS.X1 - w / 2 - 12);
    box(cx - w / 2 - 8, cy - 9, w + 16, 18, col, 4); T(s, cx, cy + .5, 8.5, col, { w: 600, a: 'center', b: 'middle' });
  };
  HS.topBox = (a, b, col = C.white, cx = 320) => {
    const y0 = HS.Y0;   // pinned to the top of the screen
    box(cx - 78, y0 - 4, 156, 34, C.cyan, 5); T(a, cx, y0 + 9, 9.5, col, { w: 600, a: 'center', b: 'middle' }); T(b, cx, y0 + 21, 7.5, C.muted, { a: 'center', b: 'middle' });
  };
  HS.wrap = (s, maxW, size, o = {}) => {
    g.font = `${o.w || 500} ${size}px ${o.f || MONO}`;
    const out = []; let line = '';
    for (const word of s.split(' ')) { const t = line ? line + ' ' + word : word; if (g.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t; }
    if (line) out.push(line); return out;
  };

  // ---------- starfield
  const stars = (() => { const r = R(17); return Array.from({ length: 200 }, () => ({ x: r() * 640, y: r() * 360, s: r() < .1 ? 2 : 1, v: 2 + r() * 10, b: 90 + r() * 150 })); })();
  HS.starfield = (t, sp = 1) => {
    HS.fillStage('#060b16');
    // the 640 x 360 star pattern, spread over the whole stage
    const kx = HS.SW / 640, ky = HS.SH / 360;
    for (const s0 of stars) { const s = { x: HS.X0 + s0.x * kx, s: s0.s, b: s0.b }, y = HS.Y0 + ((s0.y + t * s0.v * sp) % 360) * ky; const tw = .75 + .25 * Math.sin(t * 2 + s.x); g.fillStyle = `rgb(${s.b * tw | 0},${s.b * tw | 0},${Math.min(255, s.b * tw + 30) | 0})`; g.fillRect(s.x, y, s.s, s.s); }
  };

  // ---------- particles (work in any context / coordinate space)
  HS.Parts = function () { this.a = []; };
  HS.Parts.prototype = {
    add(x, y, vx, vy, life, col, size = 1, grav = 0) { if (this.a.length < 500) this.a.push({ x, y, vx, vy, life, max: life, col, size, grav }); },
    burst(x, y, n, speed, life, cols, size = 1, grav = 0) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = speed * (.3 + Math.random() * .7); this.add(x, y, Math.cos(a) * v, Math.sin(a) * v, life * (.5 + Math.random() * .5), cols[i % cols.length], size, grav); } },
    update(dt) { for (let i = this.a.length - 1; i >= 0; i--) { const p = this.a[i]; p.life -= dt; if (p.life <= 0) { this.a.splice(i, 1); continue; } p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; } },
    draw(x) { for (const p of this.a) { x.globalAlpha = clamp(p.life / p.max * 1.6, 0, 1); x.fillStyle = p.col; x.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); } x.globalAlpha = 1; }
  };

  // ---------- input
  // HS.local is this tab's keys and pointer. HS.In is whoever the game is reading right now: the host points it
  // at each crew member's input in turn (js/net-game.js), so scenes read HS.key and HS.In as before
  const In = HS.local = HS.In = { down: new Set(), hit: new Set(), mx: 320, my: 180, mdown: false, click: false, any: false };
  const GAME_KEYS = new Set(['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Backspace']);
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) In.hit.add(e.code);
    In.down.add(e.code); In.any = true; HS.audioUnlock();
  });
  window.addEventListener('keyup', (e) => In.down.delete(e.code));
  window.addEventListener('blur', () => { In.down.clear(); In.mdown = false; });
  // pointer -> HUD units, measured from the safe box's top left like everything else
  const mpos = (e) => { const r = cv.getBoundingClientRect(), k = HS.scale || 2; In.mx = (e.clientX - r.left) * cv.width / r.width / k - (HS.OX || 0); In.my = (e.clientY - r.top) * cv.height / r.height / k - (HS.OY || 0); };
  cv.addEventListener('pointerdown', (e) => { mpos(e); In.mdown = true; In.click = true; In.any = true; HS.audioUnlock(); cv.focus(); });
  cv.addEventListener('pointermove', mpos);
  window.addEventListener('pointerup', () => { In.mdown = false; });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  HS.key = (...codes) => codes.some(c => HS.In.down.has(c));
  HS.hit = (...codes) => codes.some(c => HS.In.hit.has(c));
  HS.axis = () => ({
    x: (HS.key('KeyD', 'ArrowRight') ? 1 : 0) - (HS.key('KeyA', 'ArrowLeft') ? 1 : 0),
    y: (HS.key('KeyS', 'ArrowDown') ? 1 : 0) - (HS.key('KeyW', 'ArrowUp') ? 1 : 0)
  });
  HS.over = (x, y, w, h) => HS.In.mx >= x && HS.In.mx <= x + w && HS.In.my >= y && HS.In.my <= y + h;
  HS.button = (label, x, y, w, h, col, hot) => {
    const o = HS.over(x, y, w, h);
    box(x, y, w, h, col, 5, o || hot ? HS.rgba(col, .22) : 'rgba(8,14,26,.9)');
    T(label, x + w / 2, y + h / 2 + .5, 9.5, col, { w: 600, a: 'center', b: 'middle' });
    return o && HS.In.click;
  };
  HS.endFrame = () => { In.hit.clear(); In.click = false; };

  // ---------- sound: small square-wave blips, starts after the first key or click
  let AC = null; HS.muted = false;
  HS.audioUnlock = () => {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; return; }
    loadClips(); HS.musicFor(HS.sceneName);   // audio starts on the first key or tap, so the clips and music start here
  };
  const tone = (f, d = .07, type = 'square', v = .035, f2 = 0, delay = 0) => {
    if (HS.muted || !AC) return; const t = AC.currentTime + delay, o = AC.createOscillator(), gn = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(gn).connect(AC.destination); o.start(t); o.stop(t + d + .02);
  };
  const hiss = (d, v = .05, lp = 1200) => {
    if (HS.muted || !AC) return; const n = Math.floor(AC.sampleRate * d), b = AC.createBuffer(1, n, AC.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), gn = AC.createGain(); f.type = 'lowpass'; f.frequency.value = lp; gn.gain.value = v;
    s.buffer = b; s.connect(f).connect(gn).connect(AC.destination); s.start();
  };
  HS.sfx = {
    blip: () => tone(660, .05), ok: () => { tone(520, .06); tone(780, .09, 'square', .035, 0, .06); },
    pick: () => tone(440, .08, 'square', .035, 880), drop: () => tone(300, .08, 'square', .03, 150),
    mount: () => { tone(330, .06); tone(495, .06, 'square', .035, 0, .06); tone(660, .12, 'square', .035, 0, .12); },
    buzz: () => tone(110, .22, 'sawtooth', .05), warn: () => { tone(880, .09, 'square', .03); tone(880, .09, 'square', .03, 0, .16); },
    tick: () => tone(1200, .03, 'square', .02), hitHull: () => { hiss(.35, .09, 500); tone(90, .3, 'sawtooth', .06, 40); },
    boom: () => { hiss(1.2, .12, 400); tone(70, .9, 'sawtooth', .07, 30); }, launch: () => hiss(3.5, .09, 700),
    trip: () => { tone(200, .35, 'sawtooth', .06, 50); hiss(.2, .06, 2000); }, weld: () => hiss(.06, .02, 4000),
    good: () => { tone(660, .07); tone(880, .1, 'square', .035, 0, .07); }, jam: () => tone(140, .3, 'square', .05, 90),
    scan: () => tone(900, .05, 'sine', .03, 1300), photo: () => { hiss(.08, .05, 5000); tone(1500, .04, 'square', .02); },
    type: () => tone(900 + Math.random() * 200, .012, 'square', .008),
    jingle: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .14, 'square', .035, 0, i * .11)),
    sad: () => [392, 330, 262].forEach((f, i) => tone(f, .22, 'triangle', .05, 0, i * .2))
  };

  // the events S6-04 names that had no sound of their own; each starts as the blip it used to share
  Object.assign(HS.sfx, { buy: HS.sfx.good, win: HS.sfx.jingle, fail: HS.sfx.jam, done: HS.sfx.jingle, extract: HS.sfx.launch });

  // ---------- recorded sound (S6-04). A name listed in SFX_FILES plays its clip from assets/sfx/ instead of the blip,
  // and falls back to the blip until the clip has loaded or if it fails to. MUSIC loops per scene. M mutes all of it.
  // Both lists stay empty until the clips are committed, so the game asks for no files it does not have.
  HS.SFX_FILES = {};   // sound name -> file, e.g. pick: 'pick.ogg'
  // five EDM loops (README credits), each with a NASA recording mixed in: Earth's chorus radio waves, the Artemis
  // lunar surface recording, Perseverance's Mars wind. Earth plays at home; flight and the surface have their own.
  HS.MUSIC = { earth: 'music-earth.ogg', 'flight-moon': 'music-flight-moon.ogg', 'flight-mars': 'music-flight-mars.ogg', moon: 'music-moon.ogg', mars: 'music-mars.ogg' };
  const clips = {};    // file -> decoded buffer, once loaded
  let music = null, musicFile = '';
  const loadClip = (file) => {
    if (clips[file] !== undefined || !AC) return;
    clips[file] = null;
    fetch('assets/sfx/' + file).then((r) => r.ok ? r.arrayBuffer() : Promise.reject(new Error('HTTP ' + r.status)))
      .then((b) => AC.decodeAudioData(b)).then((buf) => { clips[file] = buf; if (file === musicFile) { musicFile = ''; HS.musicFor(HS.sceneName); } })
      .catch((e) => console.warn('sound not loaded, keeping the blip:', file, e.message));
  };
  const loadClips = () => { for (const f of Object.values(HS.SFX_FILES)) loadClip(f); for (const f of Object.values(HS.MUSIC)) loadClip(f); };
  const playClip = (file, v = .55) => {
    const buf = clips[file];
    if (!buf) return false;
    if (HS.muted || !AC) return true;
    const s = AC.createBufferSource(), gn = AC.createGain(); s.buffer = buf; gn.gain.value = v; s.connect(gn).connect(AC.destination); s.start();
    return true;
  };
  for (const [name, file] of Object.entries(HS.SFX_FILES)) {
    const blip = HS.sfx[name];
    if (blip) HS.sfx[name] = () => { if (!playClip(file)) blip(); };
  }
  HS.musicNow = () => musicFile;   // which loop is playing, for tests
  const AWAY = ['landing', 'surface'];   // the planet's own theme; flight has the journey's; everything else is Earth's
  // starts the loop this scene wants, if any, and stops the old one; called on every scene change and on M
  HS.musicFor = (scene) => {
    const world = HS.S && HS.S.mission && HS.S.mission.id === 'moon' ? 'moon' : 'mars';
    const key = scene === 'flight' ? 'flight-' + world : AWAY.includes(scene) ? world : scene ? 'earth' : '';
    const file = (!HS.muted && AC && HS.MUSIC[key]) || '';
    if (file === musicFile) return;
    if (music) { try { music.stop(); } catch (e) { /* already stopped */ } music = null; }
    musicFile = file;
    const buf = file && clips[file];
    if (!buf) return;   // not loaded yet: loadClip starts it when it arrives
    // background, not foreground: the music sits well under the game's own sounds, and lower still in flight,
    // where the stations' alarms and blips carry the game
    const s = AC.createBufferSource(), gn = AC.createGain(); s.buffer = buf; s.loop = true; gn.gain.value = scene === 'flight' ? .09 : .12;
    s.connect(gn).connect(AC.destination); s.start(); music = s;
  };

  HS.hint = (s) => { const w = HS.tw(s, 6.5); g.fillStyle = 'rgba(8,14,26,.7)'; g.fillRect(HS.X0, HS.Y1 - 11, w + 16, 11); T(s, HS.X0 + 8, HS.Y1 - 5, 6.5, '#aab6c2', { b: 'middle' }); };
  // fill the whole stage (the window), margins included
  HS.fillStage = (col) => { g.fillStyle = col; g.fillRect(HS.X0 - 10, HS.Y0 - 10, HS.SW + 20, HS.SH + 20); };
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;   // no shake, softer flashes
  HS.shakeAmt = 0; HS.shake = (a) => { if (!calm) HS.shakeAmt = Math.max(HS.shakeAmt, a); };
  HS.flashA = 0; HS.flashCol = '255,60,60'; HS.flash = (col = '255,60,60', a = .3) => { HS.flashCol = col; HS.flashA = calm ? Math.min(a, .15) : a; };
})();
