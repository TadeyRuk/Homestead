// Homestead surface minigames (S2-19): the frame every new surface task plugs into.
// Each game registers from its own file, loaded after this one and before surface.js:
//
//   HS.surfaceGames.drill = {
//     name: 'Ice drill',                       // the panel title, the map label and the report
//     slot: 'power',                           // the ship slot whose part sets the difficulty; logged on task_failed
//     label: (mid) => 'Drill for water ice',   // the line on Mission Control's list ('moon' or 'mars')
//     brief: (mid) => 'drill for ice',         // optional: a few words for the brief card
//     keys: '[W] [S] keep the needle in the green',
//     fact: (mid) => '...',                    // optional: a real-missions line for the panel and the report
//     eligible: (m) => true,                   // optional: may this build (HS.model()) get the task at all
//     spot: { moon: [x, y], mars: [x, y] },    // optional: defaults to HS.SURFACE[mid].games[kind] in world.js
//     start(ctx) { return {...} },             // a fresh attempt, plain data only (it travels in snapshots)
//     update(game, dt) { return 'playing' },   // host only: step it in place, say 'playing', 'failed' or 'done'
//     draw(game, b, info) {},                  // every screen: draw it inside b = { x, y, w, h } (HUD space)
//   };
//
// start gets ctx = { seed, mission, part, P, tries, r }: P is the part's data from HS.PARTS (null if the slot is
// empty) and r is a seeded random stream for this attempt. update reads that crew member's keys through
// HS.key / HS.hit, as everything inside HS.each does. draw gets info = { mission, part, P, tries, sinceFail }.
// The game never touches HS.S: the frame logs failures and completes the objective.
(() => {
  const HS = window.HS, g = HS.g;
  const { T, box, tag, C } = HS;
  HS.surfaceGames = {};

  // where a game's spot is on this mission's map, or null
  HS.gameSpot = (kind, mid) => {
    const def = HS.surfaceGames[kind], s = def && (def.spot ? def.spot[mid] : (HS.SURFACE[mid].games || {})[kind]);
    return s ? { x: s[0], y: s[1] } : null;
  };
  // a game can go on the list when it is registered and has a spot on both maps; with a build it has to suit it
  HS.gameReady = (kind, m) => {
    const def = HS.surfaceGames[kind];
    if (!def || !HS.gameSpot(kind, 'moon') || !HS.gameSpot(kind, 'mars')) return false;
    return !m || !def.eligible || !!def.eligible(m);
  };

  // has the run finished objective id: the fixed ones keep their own flags, the games are in S.tasks
  HS.goalDone = (id, S = HS.S) => {
    const o = S.mission.objectives;
    if (id === 'scan') return S.scansRich >= o.scans;
    if (id === 'sample') return !!S.sampleDone;
    if (id === 'deploy') return !!S.deployDone;
    if (id === 'uplink') return Math.floor(S.uplinked + 1e-6) >= S.mission.target;
    if (id === 'bonus') return !!S.bonusDone;
    return !!(S.tasks && S.tasks[id]);
  };

  const ctxFor = (run, S) => {
    const P = run.part ? HS.PARTS[run.part] : null;
    return { seed: S.seed, mission: S.mission.id, part: run.part, P, tries: run.tries, r: HS.R(S.seed * 131 + run.tries * 977 + run.kind.length * 53) };
  };

  HS.gameFrame = {
    // a fresh attempt for the crew member swapped into U
    open(U, kind) {
      const S = HS.S, def = HS.surfaceGames[kind], run = { kind, part: S.slots[def.slot] || null, tries: 0, failT: -9, g: null };
      run.g = def.start(ctxFor(run, S)); U.game = run; U.hold = null;
      HS.sfx.ok(); HS.log('task_open', { kind });
    },

    // one tick of the open game. Returns the note to show, if any. Q steps away without failing
    step(U, dt) {
      const S = HS.S, run = U.game, def = HS.surfaceGames[run.kind];
      if (!def || S.tasks[run.kind] || U.down) { U.game = null; return null; }
      if (HS.hit('KeyQ')) { U.game = null; HS.sfx.blip(); return null; }
      const res = def.update(run.g, dt);
      if (res === 'failed') {
        // progress resets and the player can go again at once
        HS.log('task_failed', { kind: run.kind, part: run.part, slot: def.slot, tries: run.tries + 1 });
        run.tries++; run.failT = U.t; run.g = def.start(ctxFor(run, S));
        HS.sfx.jam(); HS.shake(2);
        return [`${def.name} failed. Try again.`, C.red];
      }
      if (res === 'done') {
        U.game = null; S.tasks[run.kind] = true;
        HS.sfx.jingle(); HS.log(run.kind, { tries: run.tries, part: run.part });
        return [`${def.name}: done`, C.green];
      }
      return null;
    },

    // somebody else already has this game open
    busy(U, kind) { return Object.keys(U.ps).some(id => id !== U.me && U.ps[id].game && U.ps[id].game.kind === kind); },

    // the open game as a small panel over the player's own view
    panel(U) {
      const S = HS.S, run = U.game, def = HS.surfaceGames[run.kind]; if (!def) return;
      const mid = S.mission.id, P = run.part ? HS.PARTS[run.part] : null, X = 226, Y = 86, W = 256, H = 216;
      const since = U.t - run.failT, flash = since < .6 && Math.floor(since * 10) % 2 === 0;
      box(X, Y, W, H, flash ? C.red : C.cyan, 6);
      T(def.name.toUpperCase(), X + 10, Y + 16, 9, C.cyan, { w: 600 });
      T(P ? P.name : 'no ' + HS.SLOT_NAME[def.slot].toLowerCase() + ' part', X + W - 10, Y + 16, 7.5, P ? HS.CAT[def.slot] || C.white : C.red, { a: 'right', w: 600 });
      if (run.tries) T(`attempt ${run.tries + 1}`, X + W - 10, Y + 27, 7, C.muted, { a: 'right' });
      g.save(); g.beginPath(); g.rect(X + 4, Y + 30, W - 8, H - 58); g.clip();
      def.draw(run.g, { x: X + 6, y: Y + 30, w: W - 12, h: H - 58 }, { mission: mid, part: run.part, P, tries: run.tries, sinceFail: since });
      g.restore();
      T(def.keys, X + 10, Y + H - 16, 7, C.white);
      T('[Q] step away', X + W - 10, Y + H - 16, 7, C.muted, { a: 'right' });
      if (def.fact) { const line = HS.wrap(def.fact(mid), W, 6.5)[0]; T(line, X + W / 2, Y + H + 10, 6.5, C.muted, { a: 'center' }); }
      if (flash) tag('FAILED', X + W / 2, Y + H / 2, C.red, 10);
    },

    // the spot on the ground: a pad and a flag in the game's slot colour, art pixels (js/art.js)
    drawSpot(x, cam, kind, s, t, done) {
      const def = HS.surfaceGames[kind];
      if (def.drawSpot) return def.drawSpot(x, cam, s, t, done);
      const [ax, ay] = HS.wa(cam, s.x, s.y), col = done ? C.green : HS.CAT[def.slot] || C.cyan;
      if (ax < -60 || ax > 1340 || ay < -80 || ay > 780) return;
      HS.shadow(x, ax + 3, ay + 2, 34, 8, .28);
      x.fillStyle = HS.ART_OUT; x.fillRect(ax - 17, ay - 7, 34, 10);
      x.fillStyle = '#8a93a3'; x.fillRect(ax - 16, ay - 6, 32, 8);
      x.fillStyle = '#b4bcca'; x.fillRect(ax - 16, ay - 6, 32, 2);
      x.fillStyle = HS.ART_OUT; x.fillRect(ax - 1, ay - 40, 4, 36);
      x.fillStyle = '#e8ecf2'; x.fillRect(ax, ay - 39, 2, 34);
      const wave = Math.floor(t * 4) % 2;
      x.fillStyle = HS.ART_OUT; x.fillRect(ax + 2, ay - 40, 15, 11 + wave);
      x.fillStyle = col; x.fillRect(ax + 2, ay - 39, 14, 9 + wave);
      if (!done && Math.sin(t * 4) > 0) { x.fillStyle = col; x.fillRect(ax - 12, ay - 4, 4, 2); x.fillRect(ax + 8, ay - 4, 4, 2); }
    },

    // the spot on the TAB map
    mapSpot(kind, s, x0, y0, k, done) {
      const def = HS.surfaceGames[kind], col = done ? C.green : HS.CAT[def.slot] || C.cyan, X = x0 + s.x * k, Y = y0 + s.y * k;
      g.fillStyle = HS.ART_OUT; g.fillRect(X - 3.5, Y - 3.5, 7, 7); g.fillStyle = col; g.fillRect(X - 2.5, Y - 2.5, 5, 5);
      if (!done) T(def.name.toLowerCase(), X, Y - 6, 6.5, C.white, { a: 'center' });
    }
  };
})();
