// Homestead online play: host and join by a six-character code (the network layer is js/net.js, built from
// src/proto by npm run build:proto; without it the game plays solo and the online button stays hidden).
// The host runs the game as it always has and sends the run state plus the scene's state about 30 times a
// second. Joiners send their keys and pointer and follow the host's scene: the play scenes only draw, the
// cutscenes run locally with no input.
(() => {
  const HS = window.HS, g = HS.g;
  const { T, box, C, PIX, clamp } = HS;
  const SNAP_MS = 33, PING_MS = 1000;
  const PLAY = ['build', 'flight', 'surface'];
  // scene state that is local to each tab: particles, generators and part models are rebuilt, not sent
  const LOCAL = new Set(['fx', 'r', 'kr', 'm']);

  const N = HS.net = {
    mode: 'solo',          // solo | host | client
    me: 'host',            // this tab's crew id
    crew: [],              // [{ id, name, suit }]
    room: null, client: null, code: '', want: false, msg: '', busy: false, gen: 0, lastSnap: 0, lastPing: 0, sent: '',
    roles: {},             // crew id -> the stations they may work in flight
    seat: {},              // crew id -> the role they are on in the lobby (what they offer in a swap)
    ask: null,             // { from, to, want, give, t }: a swap waiting for an answer
    moved: {},             // crew id -> the role a swap just gave them, so flight can move them onto it
    dealtFor: ''
  };
  HS.online = () => N.mode !== 'solo';
  HS.ids = () => N.mode === 'solo' ? ['host'] : N.crew.map(m => m.id);
  HS.member = (id) => N.crew.find(m => m.id === id) || { id, name: HS.S.name || 'Crew', suit: HS.S.suit };

  // ---------- roles: solo holds all four; online they are split 2+2, 1+1+2 or 1+1+1+1 in the lobby, and
  // players trade by asking: the holder of the role says yes or no. Only the host changes them.
  const SHORT = { pilot: 'PILOT', eng: 'ENG', comms: 'COMMS', sci: 'SCI' };
  const SPLIT = [[4], [2, 2], [1, 1, 2], [1, 1, 1, 1]];
  const ASK_MS = 10000;
  HS.rolesOf = (id) => N.mode === 'solo' ? HS.ROLES : (N.roles[id] || []);
  const ownerOf = (role) => Object.keys(N.roles).find(id => N.roles[id].includes(role));
  function deal() {
    const ids = HS.ids(), split = SPLIT[Math.min(ids.length, 4) - 1];
    let k = 0;
    N.roles = {}; N.seat = {}; N.ask = null; N.moved = {};
    ids.forEach((id, i) => { N.roles[id] = HS.ROLES.slice(k, k + split[i]); N.seat[id] = N.roles[id][0]; k += split[i]; });
    N.dealtFor = ids.join(',');
  }
  // host: a crew member pressed a role's key while on role `seat`; true when the role is already theirs
  HS.pickRole = (id, role, seat) => {
    if (HS.rolesOf(id).includes(role)) return true;
    const to = ownerOf(role);
    if (to && !N.ask && HS.rolesOf(id).includes(seat)) { N.ask = { from: id, to, want: role, give: seat, t: performance.now() }; HS.sfx.warn(); }
    return false;
  };
  // host, inside HS.as(id): the asked player answers with Enter or N, the asker can cancel with N; true if handled
  HS.answerRole = (id) => {
    const a = N.ask;
    if (!a) return false;
    if (a.from === id && HS.hit('KeyN')) { N.ask = null; HS.sfx.drop(); return true; }
    if (a.to !== id) return false;
    if (HS.hit('KeyN')) { N.ask = null; HS.sfx.drop(); return true; }
    if (!HS.hit('Enter')) return false;
    const R = N.roles;
    if (R[a.to].includes(a.want) && R[a.from].includes(a.give)) {
      R[a.to] = R[a.to].map(r => r === a.want ? a.give : r);
      R[a.from] = R[a.from].map(r => r === a.give ? a.want : r);
      N.seat[a.from] = a.want; if (N.seat[a.to] === a.want) N.seat[a.to] = a.give;
      N.moved = { [a.from]: a.want, [a.to]: a.give };
      HS.sfx.ok();
    }
    N.ask = null;
    return true;
  };
  // the line every screen shows while a swap is waiting, or null
  HS.askLine = () => {
    const a = N.ask;
    if (!a || N.mode === 'solo') return null;
    const nm = (id) => HS.member(id).name;
    if (a.to === N.me) return [`${nm(a.from)} wants your ${SHORT[a.want]} for their ${SHORT[a.give]}.  [ENTER] swap  [N] no`, C.amber];
    if (a.from === N.me) return [`Asked ${nm(a.to)} for ${SHORT[a.want]}.  [N] cancel`, C.muted];
    return [`${nm(a.from)} asked ${nm(a.to)} for ${SHORT[a.want]}`, C.muted];
  };

  // ---------- each crew member's input, as the HS.In shape the scenes read
  const blank = () => ({ down: new Set(), hit: new Set(), mx: 320, my: 180, mdown: false, click: false });
  // copied from the room once per frame, so a press or click a scene consumes stays consumed for the frame
  const remote = {};
  const readRemote = () => {
    const all = N.room.inputs();
    for (const id of HS.ids()) {
      if (id === N.me) continue;
      const raw = all[id], i = remote[id] = remote[id] || blank();
      if (raw) { i.down = new Set(raw.down); i.hit = new Set(raw.hit); i.mx = raw.mx; i.my = raw.my; i.mdown = raw.mdown; i.click = raw.click; }
      else { i.down.clear(); i.hit.clear(); i.click = false; }
    }
  };
  // the main loop runs several fixed steps a frame; a remote press counts in the first one only
  HS.clearRemotePresses = () => { for (const id in remote) { remote[id].hit.clear(); remote[id].click = false; } };
  HS.inputOf = (id) => id === N.me ? HS.local : (remote[id] = remote[id] || blank());
  // run fn with HS.key, HS.hit, HS.axis and HS.In reading crew member id's input
  HS.as = (id, fn) => { const keep = HS.In; HS.In = HS.inputOf(id); try { return fn(); } finally { HS.In = keep; } };
  // runs fn once per crew member, with that member's input
  HS.each = (fn) => { for (const id of HS.ids()) HS.as(id, () => fn(id)); };

  // ---------- sounds, shakes and flashes fired on the host play on every screen
  let outbox = [], lastData = null;
  // only the play scenes: joiners run the cutscenes themselves, sounds included
  const relay = (fn, kind, name) => (...args) => { if (N.mode === 'host' && PLAY.includes(HS.sceneName)) outbox.push([kind, name, args]); return fn(...args); };
  for (const k of Object.keys(HS.sfx)) HS.sfx[k] = relay(HS.sfx[k], 'sfx', k);
  HS.shake = relay(HS.shake, 'shake');
  HS.flash = relay(HS.flash, 'flash');
  const play = (fx) => { for (const [kind, name, args] of fx) { if (kind === 'sfx' && HS.sfx[name]) HS.sfx[name](); else if (kind === 'shake') HS.shake(...args); else if (kind === 'flash') HS.flash(...args); } };

  // ---------- snapshots
  HS.pack = (o) => { const out = {}; for (const k in o) if (!LOCAL.has(k) && typeof o[k] !== 'function') out[k] = o[k]; return out; };
  const packS = () => {
    const S = HS.S, out = Object.assign({}, S, { mission: S.mission.id });
    if (HS.sceneName !== 'report') out.log = [];
    return out;
  };
  const loadS = (s) => {
    const mine = HS.S ? { suit: HS.S.suit, visor: HS.S.visor, name: HS.S.name } : {};
    HS.S = Object.assign({}, s, { mission: HS.MISSIONS[s.mission] }, mine);
  };
  function sendSnap(now) {
    if (now - N.lastSnap < SNAP_MS) return;
    N.lastSnap = now;
    const cur = HS.scenes[HS.sceneName];
    const data = { scene: HS.sceneName, S: HS.S && HS.S.mission ? packS() : null, d: cur && cur.save ? cur.save() : null, fx: outbox, crew: N.crew, roles: N.roles, seat: N.seat, ask: N.ask };
    N.room.send(data, now);
    lastData = Object.assign({}, data, { fx: [] });   // a keepalive repeats the state, not the sounds
    outbox = [];
  }
  // ---------- smoothing on joiners: snapshots arrive about 30 a second and unevenly, so a joiner draws the
  // scene DELAY ms in the past, blending the two snapshots around that moment. Only positions are blended;
  // counters and everything else take the newer snapshot's value.
  const DELAY = 50, BLEND = new Set(['x', 'y', 'e', 'rot']);
  let buf = [];   // [{ t, d }] for the current scene, oldest first
  const blend = (a, b, k, key) => {
    if (typeof b === 'number') return typeof a === 'number' && BLEND.has(key) ? a + (b - a) * k : b;
    if (Array.isArray(b)) return Array.isArray(a) && a.length === b.length ? b.map((v, i) => blend(a[i], v, k, key)) : b;
    if (b && typeof b === 'object') { const o = {}, ao = a && typeof a === 'object' ? a : {}; for (const n in b) o[n] = blend(ao[n], b[n], k, n); return o; }
    return b;
  };
  function applySmoothed(now) {
    const cur = HS.scenes[HS.sceneName];
    if (!cur || !cur.load || !buf.length) return;
    const rt = now - DELAY;
    while (buf.length > 2 && buf[1].t <= rt) buf.shift();   // keep one snapshot at or before rt
    const [a, b] = buf;
    if (!b || rt <= a.t) cur.load(a.d);
    else if (rt >= b.t) cur.load(b.d);
    else cur.load(blend(a.d, b.d, (rt - a.t) / (b.t - a.t)));
  }

  // ---------- prediction on joiners: their own avatar moves on their own keys at once, with the host's rules
  // (each play scene's predict()), instead of waiting a round trip. It drifts back to the host's position when it
  // stops, and snaps when they disagree by more than SNAP_PX (a wall, a kiosk freeze the joiner did not foresee).
  const SNAP_PX = 48;
  let pred = null, predScene = '', lastFrame = 0;
  function applyPrediction(now) {
    const dt = lastFrame ? Math.min(.1, (now - lastFrame) / 1000) : 0;
    lastFrame = now;
    const cur = HS.scenes[HS.sceneName], live = cur && cur.me && cur.me();
    const srv = buf.length && cur.mine ? cur.mine(buf[buf.length - 1].d) : null;
    if (!live || !srv) { pred = null; return; }
    if (!pred || predScene !== HS.sceneName) { pred = { x: srv.x, y: srv.y, walk: 0, flip: srv.flip, face: srv.face }; predScene = HS.sceneName; }
    const moved = cur.predict(pred, dt);
    const off = Math.hypot(pred.x - srv.x, pred.y - srv.y);
    if (off > SNAP_PX) { pred.x = srv.x; pred.y = srv.y; }
    else if (!moved) { const k = Math.min(1, dt * 6); pred.x += (srv.x - pred.x) * k; pred.y += (srv.y - pred.y) * k; }
    live.x = pred.x; live.y = pred.y; live.walk = pred.walk; live.flip = pred.flip; live.face = pred.face;
  }

  function onSnap(data) {
    if (N.mode !== 'client' || !data) return;
    if (N.client.id()) N.me = N.client.id();   // the welcome comes before the first snapshot
    if (data.crew) N.crew = data.crew;
    if (data.roles) { N.roles = data.roles; N.seat = data.seat || {}; N.ask = data.ask || null; }
    if (data.fx) play(data.fx);
    if (data.S) loadS(data.S);
    if (data.scene !== HS.sceneName && data.scene !== 'lobby') { buf = []; pred = null; HS.netGo(data.scene); return; }
    if (data.d) buf.push({ t: performance.now(), d: data.d });
  }

  // ---------- the frame hooks main.js calls
  const encode = (i) => ({ down: [...i.down].slice(0, 24), hit: [...i.hit].slice(0, 24), mx: Math.round(i.mx), my: Math.round(i.my), mdown: i.mdown, click: i.click });
  // leaving a run: Esc once shows the question, Esc again within QUIT_MS leaves (the host leaving ends the game)
  const QUIT_MS = 3000, NO_QUIT = ['lobby', 'title', 'crew'];
  let quitAt = 0;
  function quitKey(now) {
    if (N.mode === 'solo' || NO_QUIT.includes(HS.sceneName) || !HS.local.hit.has('Escape')) return;
    HS.local.hit.delete('Escape');
    if (now - quitAt > QUIT_MS) { quitAt = now; HS.sfx.blip(); return; }
    quitAt = 0;
    if (N.mode === 'host') N.room.end('The host left the game');
    else { N.client.leave(); leave('You left the game'); }
  }
  HS.netDraw = () => {
    if (N.mode === 'solo' || !quitAt || performance.now() - quitAt > QUIT_MS) return;
    HS.prompt(N.mode === 'host' ? 'Leave? This ends the game for everyone.  [ESC] again to leave' : 'Leave the game?  [ESC] again to leave', 320, 180, C.amber);
  };

  HS.netBefore = () => {
    quitKey(performance.now());
    if (N.mode === 'host') readRemote();
    if (N.mode !== 'client') return;
    const now = performance.now(), i = encode(HS.local), s = JSON.stringify(i);
    // presses go every frame they happen; held keys and the pointer only when they change
    if (s !== N.sent || i.hit.length || i.click) { N.sent = s; N.client.sendInput(i); }
    applySmoothed(now);
    applyPrediction(now);
    if (now - N.lastPing > PING_MS) { N.lastPing = now; N.client.ping(); }
    N.client.check();
  };
  HS.netAfter = () => {
    if (N.mode !== 'host') return;
    N.room.check();
    if (N.mode !== 'host') return;   // check may have ended the game
    if (N.ask && performance.now() - N.ask.t > ASK_MS) N.ask = null;
    sendSnap(performance.now());
    N.room.clearPresses();
  };
  // joiners do not run the play scenes: the host's state arrives in snapshots. Cutscenes play locally.
  // full: read this tab's input; quiet: run with no input (the host decides); none: skip
  HS.netRuns = (name) => N.mode !== 'client' || name === 'lobby' ? 'full' : PLAY.includes(name) ? 'none' : 'quiet';
  HS.blankInput = blank();

  // a hidden tab gets no animation frames, so pings and the host's keepalive also run on a timer; without
  // it, switching tabs for ten seconds would drop the whole crew
  setInterval(() => {
    const now = performance.now();
    if (N.mode === 'client') { if (now - N.lastPing > PING_MS) { N.lastPing = now; N.client.ping(); } N.client.check(); }
    else if (N.mode === 'host') { N.room.check(); if (N.mode === 'host' && lastData && now - N.lastSnap > 900) { N.lastSnap = now; N.room.send(lastData, now); } }
  }, 500);

  function leave(reason) {
    const was = N.mode;
    N.mode = 'solo'; N.me = 'host'; HS.NAME.crew = 'SOLO CREW'; N.roles = {}; N.seat = {}; N.ask = null; N.moved = {}; N.dealtFor = ''; N.crew = []; N.room = null; N.client = null; N.code = ''; N.busy = false; N.want = false;
    if (was !== 'solo') { N.msg = reason; if (HS.sceneName !== 'title') HS.netGo('title'); }
  }
  const profile = () => ({ name: HS.S.name || 'Crew', suit: HS.S.suit });

  // gen moves on when the player backs out of the lobby, so a code that arrives late is thrown away
  const stale = (gen) => gen !== N.gen || HS.sceneName !== 'lobby';
  async function hostGame() {
    if (N.busy) return; N.busy = true; N.msg = 'Getting a code...';
    const gen = N.gen;
    let got;
    try { got = await window.HSNet.host(profile(), leave); }
    catch (e) { console.error('could not host', e); if (!stale(gen)) { N.busy = false; N.msg = e.message || 'Could not host'; HS.sfx.buzz(); } return; }
    if (stale(gen)) { got.room.end(''); return; }
    Object.assign(N, { mode: 'host', me: 'host', room: got.room, code: got.code, msg: '', busy: false });
    HS.NAME.crew = 'CREW';
    N.crew = got.room.members();
    HS.sfx.ok();
  }
  async function joinGame(code) {
    if (N.busy) return; N.busy = true; N.msg = 'Joining...';
    const gen = N.gen;
    let client;
    try { client = await window.HSNet.join(code, profile(), leave, onSnap); }
    catch (e) { console.error('could not join', e); if (!stale(gen)) { N.busy = false; N.msg = e.message || 'Could not join'; HS.sfx.buzz(); } return; }
    if (stale(gen)) { client.leave(); return; }
    Object.assign(N, { mode: 'client', client, code: code.toUpperCase(), msg: 'Waiting for the host to start', busy: false });
    HS.NAME.crew = 'CREW';
    HS.sfx.ok();
  }

  // ---------- the lobby: host or join, see who is in, the host starts the run
  const L = { t: 0, typing: '', hits: [] };
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const charOf = (code) => code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : '';
  HS.scenes.lobby = {
    enter() { L.t = 0; L.hits = []; HS.typing = true; if (N.mode === 'solo') N.msg = N.msg || ''; },
    exit() { HS.typing = false; },
    update(dt) {
      L.t += dt; N.crew = N.mode === 'host' ? N.room.members() : N.mode === 'client' ? N.client.members() : [];
      if (N.mode === 'host') {
        if (N.dealtFor !== HS.ids().join(',')) deal();
        let answered = false;
        HS.each((id) => {
          if (HS.answerRole(id)) { if (id === N.me) answered = true; return; }
          for (let d = 0; d < 4; d++) if (HS.hit('Digit' + (d + 1)) && HS.pickRole(id, HS.ROLES[d], N.seat[id])) { N.seat[id] = HS.ROLES[d]; HS.sfx.blip(); }
        });
        if (!answered && !N.ask && HS.hit('Enter') && L.t > .3) { N.room.lock(); HS.sfx.ok(); HS.go('brief'); }
        if (HS.hit('Escape')) N.room.end('The host closed the game');
        return;
      }
      if (N.mode === 'client') { if (HS.hit('Escape')) { N.client.leave(); leave(''); } return; }
      for (const code of HS.In.hit) { const ch = charOf(code); if (ch && CHARS.includes(ch) && L.typing.length < 6) { L.typing += ch; HS.sfx.type(); } }
      if (HS.hit('Backspace')) { L.typing = L.typing.slice(0, -1); HS.sfx.type(); }
      if (HS.hit('Enter') && !N.busy) { if (L.typing.length === 6) joinGame(L.typing); else hostGame(); }
      if (HS.hit('Escape')) { N.gen++; N.busy = false; N.msg = ''; HS.go('title'); }
      if (HS.In.click) { const h = L.hits.find(b => HS.over(b.x, b.y, b.w, b.h)); if (h) h.go(); }
    },
    draw() {
      HS.starfield(L.t, .4);
      const hits = L.hits = [];
      const btn = (label, x, y, w, col, go, hot) => { if (HS.button(label, x, y, w, 20, col, hot)) { HS.In.click = false; go(); } hits.push({ x, y, w, h: 20, go }); };
      box(150, 50, 340, 262, C.cyan, 6);
      T('Play online', 170, 78, 16, C.cyan, { w: 700, f: PIX });
      if (N.mode === 'solo') {
        T('HOST A GAME', 170, 104, 7.5, C.muted, { w: 600 });
        T('Get a code and read it out to your crew.', 170, 118, 8, C.white);
        btn('[ENTER] Host', 170, 126, 110, C.cyan, hostGame, !L.typing && !N.busy);
        T('OR JOIN WITH A CODE', 170, 170, 7.5, C.muted, { w: 600 });
        box(170, 178, 150, 26, '#2a3a52', 4, '#050a14');
        const shown = L.typing + (Math.floor(L.t * 2) % 2 && L.typing.length < 6 ? '_' : '');
        T(shown || 'type the code', 180, 192, shown ? 13 : 8, shown ? C.white : '#6f7d8c', { w: 600, b: 'middle' });
        btn('[ENTER] Join', 330, 181, 90, C.cyan, () => L.typing.length === 6 && joinGame(L.typing), L.typing.length === 6 && !N.busy);
        T('Up to four crew. The four flight roles are split between you.', 170, 228, 7.5, C.muted);
      } else {
        T(N.mode === 'host' ? 'YOUR CODE' : 'JOINED', 170, 104, 7.5, C.muted, { w: 600 });
        // the code is read aloud and typed: in the pixel font S/5, B/8 and Z/2 look the same, so it stays in mono
        T(N.code.split('').join(' '), 170, 132, 24, C.white, { w: 700 });
        T('CREW', 170, 160, 7.5, C.muted, { w: 600 });
        N.crew.forEach((m, i) => {
          const y = 172 + i * 16; g.fillStyle = m.suit; g.fillRect(170, y, 9, 9);
          T(m.name + (m.id === N.me ? '  (you)' : m.id === 'host' ? '  (host)' : ''), 186, y + 5, 8.5, C.white, { b: 'middle' });
          // their roles, right-aligned; the one they are on is bracketed
          let rx = 470;
          for (const r of HS.rolesOf(m.id).slice().reverse()) {
            const s = N.seat[m.id] === r ? `[${SHORT[r]}]` : SHORT[r];
            T(s, rx, y + 5, 7.5, C[r], { a: 'right', w: 600, b: 'middle' });
            rx -= HS.tw(s, 7.5, { w: 600 }) + 8;
          }
        });
        const ask = HS.askLine();
        if (ask) T(ask[0], 170, 238, 7.5, ask[1], { w: 600 });
        else T('[1]-[4] pick one of your roles, or ask for someone else\'s', 170, 238, 7.5, C.muted);
        if (N.mode === 'host') btn(N.crew.length > 1 ? '[ENTER] Start the run' : '[ENTER] Start solo', 170, 248, 150, C.amber, () => { if (!N.ask) { N.room.lock(); HS.go('brief'); } }, !N.ask);
      }
      if (N.msg) T(N.msg, 170, 292, 8, N.busy ? C.muted : C.amber);
      HS.hint(N.mode === 'solo' ? '[ESC] back to the title' : N.mode === 'host' ? '[ESC] close the game' : '[ESC] leave');
    }
  };

  HS.netAvailable = () => !!window.HSNet;
  // going back to the title ends an online game for everyone
  HS.netQuit = () => { if (N.mode === 'host') N.room.end('The host left the game'); else if (N.mode === 'client') { N.client.leave(); leave(''); } };
})();
