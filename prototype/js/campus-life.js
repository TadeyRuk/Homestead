// Homestead launch campus life: the ground crew, the campus van and the forklift, birds high overhead, cloud
// shadows sliding over everything, steam off the fuel tanks and blinking warning lights. All on the 1280 x 720
// art grid in the same 3/4 view and top-left sun as js/campus.js. Purely visual: nothing here collides with
// the player or changes the game. Crew turn to look at you when you walk up; the van stops if you are in its way.
(() => {
  const HS = window.HS, L = HS.liftoff, U = HS.U;
  const { R, hex, mix, sprite, make, fbm2, bayer, noise } = L;
  const OUT = HS.ART_OUT;
  const css = (c) => `rgb(${c.map(v => Math.max(0, Math.min(255, v)) | 0).join(',')})`;
  const tone = (c, k) => css(k <= 1 ? hex(c).map(v => v * k) : mix(hex(c), [255, 255, 255], k - 1));
  const calm = () => !!(L.calm && L.calm());
  const SUN = [.62, .3];

  // ---------- the ground crew: hard hat, face, coverall, hi-vis vest; 30 x 44, feet on the bottom row
  // views front, back, side (facing right); frames 0 idle, 1 breathe, 2 and 3 walk
  const LOOKS = [
    { hat: '#f2d23a', suit: '#2c3e66', vest: '#c8f03c', skin: '#e0ac80', hair: '#3a2a1a' },
    { hat: '#f4f4f4', suit: '#5a6272', vest: '#ff8a2a', skin: '#8a5a3a', hair: '#1a1410' },
    { hat: '#f4f4f4', suit: '#e8ecf2', vest: null, skin: '#f1c7a0', hair: '#8a5a2a' },
    { hat: '#ff8a2a', suit: '#2a5a4a', vest: '#c8f03c', skin: '#c98e62', hair: '#2a1e16' },
    { hat: '#3a8ad8', suit: '#8a3a2a', vest: null, skin: '#f1c7a0', hair: '#c89a5a' },
    { hat: '#f2d23a', suit: '#3a4252', vest: '#ff8a2a', skin: '#a8724a', hair: '#1a1410' },
    { hat: '#e8ecf2', suit: '#24324e', vest: '#c8f03c', skin: '#e0ac80', hair: '#5a3a24' },
    { hat: '#ff8a2a', suit: '#5a4a3a', vest: null, skin: '#8a5a3a', hair: '#1a1410' }
  ];
  function worker(x, o, view, frame, prop) {
    const b = frame === 1 ? 1 : 0, st = frame === 2 ? 1 : frame === 3 ? -1 : 0;
    const sd = tone(o.suit, .66), sh = tone(o.suit, 1.2), kd = tone(o.skin, .78), kh = tone(o.skin, 1.12), hd = tone(o.hat, .7), hh = tone(o.hat, 1.3), boot = '#3a2a1e';
    const vest = (X0, w) => {
      if (!o.vest) return;
      R(x, X0, 17 + b, w, 12, o.vest); R(x, X0 + w - 2, 17 + b, 2, 12, tone(o.vest, .72)); R(x, X0, 17 + b, 1, 12, tone(o.vest, 1.2));
      R(x, X0, 22 + b, w, 2, '#e8ecf2'); R(x, X0, 26 + b, w, 2, '#e8ecf2');
    };
    if (view !== 'side') {
      const leg = (lx, up, dark) => { R(x, lx, 30, 5, 10 - up, dark ? sd : o.suit); R(x, lx + 4, 30, 1, 10 - up, sd); R(x, lx - 1, 40 - up, 7, 4, boot); R(x, lx - 1, 40 - up, 7, 1, '#6a4a2e'); };
      leg(9, st > 0 ? 2 : 0, false); leg(16, st < 0 ? 2 : 0, true);
      R(x, 8, 16 + b, 14, 15 - b, o.suit); R(x, 19, 16 + b, 3, 15 - b, sd); R(x, 8, 16 + b, 1, 13, sh);
      if (view === 'front') { vest(9, 12); if (o.vest) R(x, 14, 17 + b, 2, 12, o.suit); } else vest(9, 12);
      R(x, 8, 29, 14, 2, '#3a2a1a'); if (view === 'front') R(x, 14, 29, 2, 2, '#c8a040');
      const arm = (ax, sw, dark) => { R(x, ax, 17 + b + sw, 3, 10, dark ? sd : o.suit); R(x, ax, 27 + b + sw, 3, 3, dark ? kd : o.skin); };
      if (prop === 'clipboard' && view === 'front') { arm(5, 0, false); R(x, 19, 20 + b, 3, 6, sd); R(x, 13, 20 + b, 8, 10, '#8a6440'); R(x, 14, 21 + b, 6, 8, '#f2f4f8'); for (let k = 0; k < 3; k++) R(x, 15, 23 + b + k * 2, 4, 1, '#8a92a2'); R(x, 16, 19 + b, 2, 2, '#c8ccd4'); }
      else if (prop === 'weld' && view === 'back') { R(x, 5, 15 + b, 3, 8, o.suit); R(x, 22, 15 + b, 3, 8, sd); }
      else { arm(5, st, false); arm(22, -st, true); }
      R(x, 13, 14 + b, 4, 2, kd);
      if (view === 'front') {
        R(x, 10, 7 + b, 10, 8, o.skin); R(x, 18, 7 + b, 2, 8, kd); R(x, 10, 7 + b, 1, 7, kh);
        R(x, 12, 10 + b, 2, 2, '#1a1a24'); R(x, 16, 10 + b, 2, 2, '#1a1a24'); R(x, 12, 10 + b, 1, 1, '#ffffff'); R(x, 16, 10 + b, 1, 1, '#ffffff');
        R(x, 13, 13 + b, 4, 1, kd);
      } else { R(x, 10, 7 + b, 10, 7, o.hair); R(x, 18, 7 + b, 2, 7, tone(o.hair, .7)); R(x, 11, 13 + b, 8, 2, kd); }
      if (prop === 'weld' && view === 'back') { R(x, 9, 4 + b, 12, 9, '#2a3040'); R(x, 9, 4 + b, 12, 1, '#5a6272'); }
      R(x, 10, 1 + b, 10, 1, o.hat); R(x, 9, 2 + b, 12, 5, o.hat); R(x, 18, 2 + b, 3, 5, hd); R(x, 10, 2 + b, 4, 1, hh); R(x, 9, 3 + b, 1, 3, hh); R(x, 14, 1 + b, 2, 6, hd);
      R(x, 7, 6 + b, 16, 2, o.hat); R(x, 7, 7 + b, 16, 1, hd);
      return;
    }
    // ---- side, facing right
    const legS = (lx, dx, dark) => { R(x, lx + dx, 30, 5, 10, dark ? sd : o.suit); R(x, lx + dx - 1, 40, 8, 4, boot); R(x, lx + dx - 1, 40, 8, 1, '#6a4a2e'); };
    legS(12, -2 * st, true); legS(13, 2 * st, false);
    R(x, 10, 16 + b, 10, 15 - b, o.suit); R(x, 10, 16 + b, 1, 13, sh); R(x, 18, 16 + b, 2, 15 - b, sd); vest(10, 10);
    R(x, 10, 29, 10, 2, '#3a2a1a');
    if (prop === 'clipboard') { R(x, 14, 18 + b, 4, 7, o.suit); R(x, 17, 22 + b, 5, 3, o.suit); R(x, 20, 16 + b, 3, 12, '#8a6440'); R(x, 21, 17 + b, 2, 10, '#f2f4f8'); R(x, 21, 24 + b, 3, 3, o.skin); }
    else if (prop === 'talk') { R(x, 14, 18 + b, 4, 6, o.suit); R(x, 17, 20 + b - st, 6, 3, o.suit); R(x, 22, 19 + b - st, 3, 3, o.skin); }
    else { const sw = 2 * st; R(x, 13 + sw, 17 + b, 4, 10, sh); R(x, 13 + sw, 17 + b, 4, 10, o.suit); R(x, 16 + sw, 17 + b, 1, 10, sd); R(x, 13 + sw, 27 + b, 4, 3, o.skin); }
    R(x, 14, 14 + b, 4, 2, kd);
    R(x, 11, 7 + b, 9, 8, o.skin); R(x, 11, 7 + b, 4, 6, o.hair); R(x, 14, 10 + b, 2, 3, kd); R(x, 20, 10 + b, 1, 2, o.skin);
    R(x, 17, 10 + b, 2, 2, '#1a1a24'); R(x, 17, 10 + b, 1, 1, '#ffffff'); R(x, 17, 13 + b, 3, 1, kd);
    R(x, 11, 1 + b, 9, 1, o.hat); R(x, 10, 2 + b, 11, 5, o.hat); R(x, 11, 2 + b, 4, 1, hh); R(x, 10, 3 + b, 1, 3, hh); R(x, 18, 2 + b, 3, 5, hd);
    R(x, 9, 6 + b, 15, 2, o.hat); R(x, 9, 7 + b, 15, 1, hd);
  }
  const wCache = new Map();
  const workerSprite = (li, view, frame, prop = '') => {
    const k = li + view + frame + prop; let s = wCache.get(k);
    if (!s) { s = sprite(30, 44, (x) => worker(x, LOOKS[li], view, frame, prop), OUT); wCache.set(k, s); }
    return s;
  };
  function drawWorker(x, cam, X, Y, li, view, frame, flip, prop) {
    const [fx, fy] = HS.wa(cam, X, Y + 4), s = workerSprite(li, view, frame, prop);
    HS.shadow(x, fx + 3, fy, 24, 6, .32);
    x.fillStyle = 'rgba(4,10,18,.18)'; x.fillRect(fx + 4, fy - 1, 14, 3);
    if (flip) { x.save(); x.translate(fx * 2, 0); x.scale(-1, 1); x.drawImage(s, fx - 16, fy - 45); x.restore(); }
    else x.drawImage(s, fx - 16, fy - 45);
    return [fx, fy - 45];
  }
  // a speech bubble with three dots, or a wave
  function bubble(x, X, Y, t, wave) {
    R(x, X - 1, Y - 1, 24, 14, OUT); R(x, X, Y, 22, 12, '#f2f4f8'); R(x, X, Y, 22, 1, '#ffffff'); R(x, X + 4, Y + 12, 4, 3, '#f2f4f8'); R(x, X + 3, Y + 12, 1, 4, OUT); R(x, X + 8, Y + 12, 1, 3, OUT);
    if (wave) { const k = Math.floor(t * 6) % 2; R(x, X + 8 + k, Y + 3, 6, 6, '#e0ac80'); R(x, X + 8 + k, Y + 2, 1, 3, '#e0ac80'); R(x, X + 10 + k, Y + 1, 1, 3, '#e0ac80'); R(x, X + 12 + k, Y + 2, 1, 3, '#e0ac80'); }
    else for (let k = 0; k < 3; k++) R(x, X + 5 + k * 5, Y + 5, 2, 2, Math.floor(t * 3) % 3 >= k ? '#2a3040' : '#a8b0bc');
  }

  // ---------- vehicles: the campus van (side, front, back views) and the forklift
  const vCache = new Map();
  HS.vanSprite = (view, col) => {
    const k = view + col; let s = vCache.get(k);
    if (s) return s;
    const lo = tone(col, .72), hi = tone(col, 1.15), glass = '#2e4a6a', ref = 'rgba(200,230,255,.45)';
    const wheel = (x, cx, cy, r) => { for (let y = -r; y <= r; y++) { const hw = Math.round(Math.sqrt(r * r - y * y)); R(x, cx - hw, cy + y, hw * 2, 1, '#1a1e26'); } R(x, cx - 2, cy - 2, 4, 4, '#8a92a2'); R(x, cx - 2, cy - 2, 2, 1, '#c8ccd4'); };
    if (view === 'side') s = sprite(72, 42, (x) => {
      R(x, 4, 0, 52, 12, hi); R(x, 4, 0, 52, 1, '#ffffff'); for (let X = 10; X < 50; X += 10) R(x, X, 3, 6, 1, tone(col, .9));
      R(x, 56, 4, 8, 9, glass); R(x, 57, 5, 3, 6, ref);
      R(x, 2, 12, 66, 20, col); R(x, 2, 12, 66, 2, hi); R(x, 2, 28, 66, 4, lo); R(x, 64, 12, 4, 20, lo);
      R(x, 2, 22, 66, 3, '#f08c32'); R(x, 2, 22, 66, 1, '#ffb070');
      R(x, 10, 14, 32, 7, glass); R(x, 12, 15, 8, 4, ref); R(x, 46, 13, 14, 8, glass); R(x, 47, 14, 4, 5, ref);
      R(x, 44, 12, 1, 18, lo); R(x, 66, 22, 3, 3, '#fff4d0'); R(x, 0, 18, 3, 5, '#ff5a50'); R(x, 0, 30, 8, 3, '#4a5262'); R(x, 64, 30, 8, 3, '#4a5262');
      R(x, 6, 31, 60, 3, '#1a1e26'); wheel(x, 16, 34, 6); wheel(x, 54, 34, 6);
    }, OUT);
    else if (view === 'down') s = sprite(40, 62, (x) => {
      R(x, 3, 0, 34, 34, hi); R(x, 3, 0, 34, 1, '#ffffff'); R(x, 3, 0, 1, 34, '#ffffff'); R(x, 34, 0, 3, 34, tone(col, .92)); for (let y = 6; y < 30; y += 8) R(x, 7, y, 26, 1, tone(col, .88));
      R(x, 4, 34, 32, 10, glass); R(x, 6, 35, 6, 8, ref); R(x, 4, 34, 32, 2, 'rgba(4,10,18,.4)');
      R(x, 3, 44, 34, 13, col); R(x, 3, 44, 34, 2, '#f08c32'); R(x, 34, 44, 3, 13, lo);
      R(x, 11, 48, 18, 5, '#2a3040'); for (let k = 0; k < 4; k++) R(x, 12 + k * 4, 49, 2, 3, '#5a6272');
      R(x, 4, 47, 5, 4, '#fff4d0'); R(x, 31, 47, 5, 4, '#fff4d0'); R(x, 2, 56, 36, 4, '#4a5262'); R(x, 2, 56, 36, 1, '#8a92a2');
      R(x, 0, 48, 3, 12, '#1a1e26'); R(x, 37, 48, 3, 12, '#1a1e26');
    }, OUT);
    else s = sprite(40, 62, (x) => {
      R(x, 3, 0, 34, 36, hi); R(x, 3, 0, 34, 1, '#ffffff'); R(x, 3, 0, 1, 36, '#ffffff'); R(x, 34, 0, 3, 36, tone(col, .92)); for (let y = 6; y < 32; y += 8) R(x, 7, y, 26, 1, tone(col, .88));
      R(x, 3, 36, 34, 21, col); R(x, 3, 36, 34, 2, hi); R(x, 19, 36, 1, 21, lo); R(x, 34, 36, 3, 21, lo);
      R(x, 6, 38, 11, 8, glass); R(x, 22, 38, 11, 8, glass); R(x, 7, 39, 3, 6, ref); R(x, 23, 39, 3, 6, ref);
      R(x, 3, 48, 34, 2, '#f08c32'); R(x, 4, 46, 4, 7, '#ff5a50'); R(x, 32, 46, 4, 7, '#ff5a50');
      R(x, 2, 56, 36, 4, '#4a5262'); R(x, 2, 56, 36, 1, '#8a92a2'); R(x, 0, 48, 3, 12, '#1a1e26'); R(x, 37, 48, 3, 12, '#1a1e26');
    }, OUT);
    vCache.set(k, s); return s;
  };
  let FORK = null;
  const forkSprite = () => FORK ??= [0, 1].map((f) => sprite(54, 44, (x) => {
    const Y = '#f2c040', Yd = '#b88a1a', Yh = '#ffe080';
    R(x, 38, 0, 5, 34, '#4a5262'); R(x, 38, 0, 2, 34, '#7a8292'); R(x, 44, 0, 2, 34, '#3a4252');
    R(x, 40, 30, 14, 3, '#6a7282'); R(x, 40, 30, 14, 1, '#9aa2b2');
    R(x, 40, 14 + f, 14, 16, '#8a6440'); R(x, 40, 14 + f, 14, 3, '#b48a5a'); R(x, 46, 14 + f, 2, 16, '#5a3e24');
    R(x, 8, 2, 26, 3, '#3a4252'); R(x, 10, 2, 2, 16, '#3a4252'); R(x, 30, 2, 2, 16, '#3a4252');
    R(x, 16, 7, 8, 7, '#e0ac80'); R(x, 15, 3, 10, 5, '#f4f4f4'); R(x, 14, 7, 12, 2, '#d8dce4');
    R(x, 2, 16, 34, 16, Y); R(x, 2, 16, 34, 2, Yh); R(x, 2, 28, 34, 4, Yd); R(x, 2, 16, 9, 16, Yd); R(x, 2, 16, 9, 1, Y);
    R(x, 14, 20, 12, 5, '#2a3040'); R(x, 34, 18, 3, 3, '#ff5a50');
    const wh = (cx, cy, r) => { for (let yy = -r; yy <= r; yy++) { const hw = Math.round(Math.sqrt(r * r - yy * yy)); R(x, cx - hw, cy + yy, hw * 2, 1, '#1a1e26'); } R(x, cx - 2, cy - 2, 4, 4, '#8a92a2'); };
    wh(10, 36, 7); wh(31, 37, 6);
  }, OUT));

  // ---------- who lives here
  // walkers follow a route (back and forth, or round); idle ones stand and do something
  const WALK = [
    { li: 0, route: [[60, 218], [210, 218], [290, 218]], speed: 13 },
    { li: 1, route: [[387, 238], [387, 300], [387, 372]], speed: 12 },
    { li: 2, route: [[508, 177], [592, 177]], speed: 10 },
    { li: 3, route: [[496, 318], [540, 338], [586, 318], [556, 300]], speed: 9, loop: true, stop: 2.6, prop: 'clipboard' },
    { li: 4, route: [[274, 354], [274, 394]], speed: 11 },
    { li: 5, route: [[468, 150], [456, 64]], speed: 12 },
    { li: 6, route: [[132, 222], [60, 222], [60, 140]], speed: 12 }
  ];
  const IDLE = [
    { li: 7, X: 432, Y: 193, face: 'side', flip: false, prop: 'talk', chat: 0 },
    { li: 3, X: 443, Y: 193, face: 'side', flip: true, prop: 'talk', chat: 1 },
    { li: 5, X: 96, Y: 202, face: 'back', prop: 'weld', weld: true }
  ];
  const routeLen = (r) => { let l = 0; for (let i = 1; i < r.length; i++) l += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]); return l; };
  const at = (r, s) => { for (let i = 1; i < r.length; i++) { const [a, b] = r[i - 1], [c, d] = r[i], l = Math.hypot(c - a, d - b); if (s <= l || i === r.length - 1) { const k = Math.max(0, Math.min(1, s / l)); return [a + (c - a) * k, b + (d - b) * k, c - a, d - b]; } s -= l; } return [r[0][0], r[0][1], 1, 0]; };
  const st = { lastT: null, walkers: null, van: null, fork: null, flock: null, nextFlock: 4 };
  function init() {
    const r = noise(77);
    st.walkers = WALK.map((w) => {
      const len = routeLen(w.route), route = w.loop ? w.route.concat([w.route[0]]) : w.route;
      return Object.assign({}, w, { route, len: routeLen(route), s: r() * len, dir: 1, wait: r() * 2, walk: 0, look: 0 });
    });
    // the van: eastbound on the south lane round the south of the roundabout, back on the north lane
    const east = [[46, 212.5], [342, 212.5], [352, 221], [366, 226], [380, 227.5], [394, 226], [408, 221], [418, 212.5], [624, 212.5]];
    const west = [[624, 207.5], [418, 207.5], [408, 199], [394, 194], [380, 192.5], [366, 194], [352, 199], [342, 207.5], [46, 207.5]];
    st.van = { routes: [east, west], ri: 0, s: 120, v: 26, wait: 0, lens: [routeLen(east), routeLen(west)] };
    st.fork = { s: 0, dir: 1, wait: 0 };
  }

  // ---------- update and draw
  const near = (who, X, Y, d) => who && Math.hypot(who.X - X, who.Y - Y) < d;
  HS.campusLife = {
    entries(cam, t, dyn) {
      if (!st.walkers) init();
      const dt = st.lastT == null ? 0 : Math.max(0, Math.min(.1, t - st.lastT)); st.lastT = t;
      const who = (dyn.find(d => d.who) || {}).who, out = [], cm = calm();
      const vis = (X, Y) => X > cam.x - 30 && X < cam.x + HS.VW + 30 && Y > cam.y - 10 && Y < cam.y + HS.VH + 40;
      // walkers
      for (const w of st.walkers) {
        const greet = near(who, ...at(w.route, w.s).slice(0, 2), 16);
        if (greet) w.look = Math.min(1, w.look + dt * 3); else w.look = Math.max(0, w.look - dt * 2);
        if (w.wait > 0) w.wait -= dt;
        else if (!greet) {
          w.s += w.speed * dt * w.dir; w.walk += dt;
          if (w.loop) { const before = w.s; w.s = (w.s + w.len) % w.len; const nodes = []; let acc = 0; for (let i = 1; i < w.route.length; i++) { acc += Math.hypot(w.route[i][0] - w.route[i - 1][0], w.route[i][1] - w.route[i - 1][1]); nodes.push(acc); } if (nodes.some(n => before - w.speed * dt < n && before >= n)) w.wait = w.stop || 1.5; }
          else if (w.s > w.len) { w.s = w.len; w.dir = -1; w.wait = 1.5 + Math.random() * 2.5; }
          else if (w.s < 0) { w.s = 0; w.dir = 1; w.wait = 1.5 + Math.random() * 2.5; }
        }
        const [X, Y, dx0, dy0] = at(w.route, w.s), dx = dx0 * w.dir, dy = dy0 * w.dir;
        if (!vis(X, Y)) continue;
        const moving = w.wait <= 0 && !greet;
        let view = Math.abs(dx) > Math.abs(dy) ? 'side' : dy > 0 ? 'front' : 'back', flip = dx < 0;
        if (greet) { view = Math.abs(who.X - X) > Math.abs(who.Y - Y) * .7 ? 'side' : who.Y > Y ? 'front' : 'back'; flip = who.X < X; }
        else if (!moving) { view = w.prop === 'clipboard' ? 'front' : view; }
        const frame = moving && !cm ? 2 + (Math.floor(w.walk * 7) % 2) : Math.floor(t * 1.4 + w.li) % 2;
        out.push({ y: Y + 4, draw: (x) => { const [hx, hy] = drawWorker(x, cam, X, Y, w.li, view, frame, flip, moving ? '' : w.prop); if (w.look > .6) bubble(x, hx + 4, hy - 18, t, true); } });
      }
      // idle crew: a conversation by the kiosk, a welder at the open hangar
      for (const p of IDLE) {
        if (!vis(p.X, p.Y)) continue;
        const talking = p.chat != null && Math.floor(t / 2.4) % 2 === p.chat, frame = p.weld ? Math.floor(t * 1.2) % 2 : talking && !cm ? 2 + (Math.floor(t * 4) % 2) : Math.floor(t * 1.4 + p.li) % 2;
        out.push({ y: p.Y + 4, draw: (x) => {
          const [hx, hy] = drawWorker(x, cam, p.X, p.Y, p.li, p.face, frame, p.flip, p.prop);
          if (talking) bubble(x, hx + (p.flip ? -18 : 6), hy - 18, t, false);
          if (p.weld) weldFx(x, hx + 16, hy + 14, t, cm);
        } });
      }
      // the van: drives its lanes, waits at each end, and stops for you
      const v = st.van, rt = v.routes[v.ri];
      let [VX, VY, vdx, vdy] = at(rt, v.s);
      if (v.wait > 0) { v.wait -= dt; if (v.wait <= 0) { v.ri = 1 - v.ri; v.s = 0; } }
      else {
        const len = Math.hypot(vdx, vdy) || 1, ux = vdx / len, uy = vdy / len;
        const blocked = who && (() => { const ax = who.X - VX, ay = who.Y - VY, fwd = ax * ux + ay * uy, side = Math.abs(ax * uy - ay * ux); return fwd > -2 && fwd < 20 && side < 7; })();
        v.v = blocked ? Math.max(0, v.v - 90 * dt) : Math.min(26, v.v + 18 * dt);
        v.s += v.v * dt;
        if (v.s >= v.lens[v.ri]) { v.s = v.lens[v.ri]; v.wait = 3; }
        v.blocked = blocked;
      }
      if (vis(VX, VY)) {
        const view = Math.abs(vdx) >= Math.abs(vdy) ? 'side' : vdy > 0 ? 'down' : 'up', flip = vdx < 0 && view === 'side', s = HS.vanSprite(view, '#e8ecf2');
        out.push({ y: VY + 1, draw: (x) => {
          const [a, b] = HS.wa(cam, VX, VY + 1);
          x.fillStyle = 'rgba(4,10,18,.3)'; x.fillRect(a - (s.width >> 1) + 6, b - 4, s.width, 6);
          if (flip) { x.save(); x.translate(a * 2, 0); x.scale(-1, 1); x.drawImage(s, a - (s.width >> 1), b - s.height + 2); x.restore(); }
          else x.drawImage(s, a - (s.width >> 1), b - s.height + 2);
          const beacon = cm || Math.floor(t * 4) % 2;
          const top = b - s.height + 2;
          R(x, a - 3, top - 3, 6, 4, OUT); R(x, a - 2, top - 2, 4, 3, beacon ? '#ffb43c' : '#8a5a1a');
          if (v.blocked && Math.floor(t * 3) % 2) bubble(x, a + 10, top - 22, t, false);
        } });
      }
      // the forklift shuttles crates by the containers
      const f = st.fork;
      if (f.wait > 0) f.wait -= dt; else { f.s += 8 * dt * f.dir; if (f.s > 40 || f.s < 0) { f.s = Math.max(0, Math.min(40, f.s)); f.dir *= -1; f.wait = 2; } }
      const FX = 18 + f.s, FY = 342;
      if (vis(FX, FY)) out.push({ y: FY, draw: (x) => {
        const [a, b] = HS.wa(cam, FX, FY), s = forkSprite()[f.wait > 0 ? 1 : 0];
        x.fillStyle = 'rgba(4,10,18,.3)'; x.fillRect(a - 22, b - 3, 54, 6);
        if (f.dir < 0) { x.save(); x.translate(a * 2, 0); x.scale(-1, 1); x.drawImage(s, a - 26, b - s.height + 2); x.restore(); } else x.drawImage(s, a - 26, b - s.height + 2);
        if (Math.floor(t * 4) % 2) R(x, a - 18, b - 46, 3, 3, '#ffb43c');
      } });
      return out;
    },
    // drawn over everything: steam, blinking lights, birds (with their shadows far below), cloud shadows
    over(x, cam, t) {
      const cm = calm();
      // steam off the fuel tanks, drifting with the wind
      for (const [i, [X, Y]] of [[490, 300], [548, 322], [604, 288], [520, 362], [600, 340]].entries()) {
        const [a, b] = HS.wa(cam, X, Y + 8); if (a < -80 || a > 1360 || b < -40 || b > 860) continue;
        for (let k = 0; k < 6; k++) { const p = ((cm ? .5 : t * .3) + k / 6 + i * .17) % 1, r = 3 + p * 9; puff(x, a + p * 34 + Math.sin(p * 6 + i) * 3, b - 82 - p * 46, r, .45 * (1 - p)); }
      }
      // the assembly building's roof-corner beacons
      const as = HS.CAMPUS_BLD.find(b => b.k === 'assembly');
      if (cm || Math.floor(t * 1.3) % 2) for (const dx of [2, as.w * U - 6]) { const [a, b] = HS.wa(cam, as.X, as.Y - as.Rz); glowDot(x, a + dx + 1, b + 3); }
      // birds: a flock now and then, flying high (their shadows land far down and to the right)
      if (!cm) {
        if (!st.flock && t > st.nextFlock) { const r = Math.random(); st.flock = { t0: t, X: cam.x - 20, Y: cam.y + 40 + r * 70, n: 4 + Math.floor(r * 4), vx: 26, vy: -6 }; }
        const fl = st.flock;
        if (fl) {
          const e = t - fl.t0, hgt = 34;
          for (let i = 0; i < fl.n; i++) {
            const side = i % 2 ? 1 : -1, rank = Math.ceil(i / 2), X = fl.X + fl.vx * e - rank * 5, Y = fl.Y + fl.vy * e + side * rank * 3.5;
            const [sa, sb] = HS.wa(cam, X + hgt * SUN[0], Y + hgt * SUN[1]); x.fillStyle = 'rgba(4,10,18,.22)'; x.fillRect(sa - 4, sb, 9, 2);
            const [a, b] = HS.wa(cam, X, Y - hgt); bird(x, a, b, Math.floor(t * 8 + i * 1.7) % 4);
          }
          if (e > 14) { st.flock = null; st.nextFlock = t + 10 + Math.random() * 14; }
        }
      }
      // cloud shadows sliding over the whole campus, roofs and all
      for (const c of CLOUDS) {
        const X = ((c.x + (cm ? 0 : t * 3.2)) % 980) - 170, Y = ((c.y + (cm ? 0 : t * 1.3)) % 640) - 120;
        const [a, b] = HS.wa(cam, X, Y), s = cloud(c.k);
        if (a > 1280 || b > 720 || a + s.width * 2 < 0 || b + s.height * 2 < 0) continue;
        x.globalAlpha = .17; x.drawImage(s, a, b, s.width * 2, s.height * 2); x.globalAlpha = 1;
      }
    }
  };
  function weldFx(x, X, Y, t, cm) {
    const on = cm || (t % 2.2) < 1.5;
    if (!on) return;
    x.globalCompositeOperation = 'lighter'; x.fillStyle = 'rgba(160,200,255,.22)'; x.fillRect(X - 14, Y - 12, 28, 24); x.fillStyle = 'rgba(200,230,255,.4)'; x.fillRect(X - 6, Y - 5, 12, 10); x.globalCompositeOperation = 'source-over';
    R(x, X - 1, Y - 1, 3, 3, '#ffffff');
    for (let k = 0; k < 10; k++) { const p = ((t * 2.3 + k * .113) % 1), ang = k * 2.4, d = p * 22; R(x, Math.round(X + Math.cos(ang) * d), Math.round(Y + Math.abs(Math.sin(ang)) * d * .6 + p * p * 20), 2, 2, p < .4 ? '#fff6c8' : '#ffb43c'); }
  }
  function glowDot(x, X, Y) { x.globalCompositeOperation = 'lighter'; x.fillStyle = 'rgba(255,90,80,.3)'; x.fillRect(X - 5, Y - 5, 10, 10); x.globalCompositeOperation = 'source-over'; R(x, X - 2, Y - 2, 4, 4, '#ff5a50'); R(x, X - 2, Y - 2, 2, 1, '#ffc0b8'); }
  function puff(x, cx, cy, r, a) {
    if (a <= 0) return;
    x.globalAlpha = a;
    for (let y = -r; y <= r; y++) { const hw = Math.round(Math.sqrt(Math.max(0, r * r - y * y))); R(x, Math.round(cx - hw), Math.round(cy + y), hw * 2, 1, y < -r * .3 ? '#ffffff' : '#d8dee6'); }
    x.globalAlpha = 1;
  }
  // a gull, four wing frames
  function bird(x, a, b, f) {
    const up = [[-4, -2], [-2, -1], [0, 0], [2, -1], [4, -2]], mid = [[-4, 0], [-2, -1], [0, 0], [2, -1], [4, 0]], down = [[-4, 1], [-2, 0], [0, 0], [2, 0], [4, 1]];
    const sh = [up, mid, down, mid][f];
    for (const [dx, dy] of sh) R(x, a + dx - 1, b + dy - 1, 4, 3, OUT);
    for (const [dx, dy] of sh) R(x, a + dx, b + dy, 2, 1, '#f2f4f8');
    R(x, a, b, 2, 1, '#c8ccd4');
  }
  // cloud shadow blobs, generated once: soft-edged by an ordered dither
  const CLOUDS = [{ x: 0, y: 40, k: 0 }, { x: 330, y: 300, k: 1 }, { x: 640, y: 120, k: 2 }, { x: 820, y: 420, k: 0 }];
  const cloudC = [];
  function cloud(k) {
    if (cloudC[k]) return cloudC[k];
    const W = 260, H = 150, [c, x] = make(W, H), d = x.createImageData(W, H), a = d.data;
    for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) {
      const e = 1 - Math.hypot((X - W / 2) / (W / 2), (y - H / 2) / (H / 2)), n = fbm2(X / 40 + k * 7, y / 40, 64, 3);
      const v = e * 1.3 + (n - .5) * 1.1;
      if (v > .35 + bayer(X, y) * .3) { const i = (y * W + X) * 4; a[i] = 6; a[i + 1] = 18; a[i + 2] = 28; a[i + 3] = 255; }
    }
    x.putImageData(d, 0, 0); return (cloudC[k] = c);
  }
})();
