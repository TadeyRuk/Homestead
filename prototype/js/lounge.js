// Homestead lounge: something to do at the lander once Mission Control's list is done, while the crew waits for
// the extraction ship. Opens for a player standing at the lander when every drawn objective and the uplink are done.
//   [V] vote to call the ship now: when every crew member still standing has voted, it arrives in CALL_S seconds
//   [1] trivia, shared: one question for the whole crew at a time, answered with [1]-[4]
//   [2] Wordle, shared: one five-letter word for the crew; anyone at the lander types the next guess
// Shared state lives in U.lounge and each player's open panel in U.lng (one of surface.js's per-player keys), so both
// travel in the host's snapshot. Content is in js/lounge-data.js. surface.js calls step, tick, draw and hint.
(() => {
  const HS = window.HS, g = HS.g;
  const { T, box, tag, bar, C, clamp } = HS;
  const CALL_S = 10;        // seconds from the last vote to the ship landing
  const ASK_S = 15;         // seconds to answer a trivia question
  const SHOW_S = 3.5;       // seconds the right answer stays up
  const TRIES = 6;
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // a question with its answers shuffled by the seed, as plain data for the snapshot
  function newQuestion(L) {
    const q = HS.TRIVIA[L.tq.order[L.tq.n % L.tq.order.length]], r = HS.R(L.seed * 7 + L.tq.n * 31 + 3);
    const opts = HS.shuffle([1, 2, 3, 4], r).map(i => q[i]);
    Object.assign(L.tq, { q: q[0], opts, right: opts.indexOf(q[1]), ans: {}, t: 0, reveal: 0 });
  }
  function newWord(L) {
    Object.assign(L.wd, { w: HS.WORDS[L.wd.order[L.wd.n % L.wd.order.length]], guesses: [], cur: '', state: 'play' });
  }
  // a guess marked like Wordle: 2 right letter in the right place, 1 in the word elsewhere, 0 not in the word
  function marks(guess, word) {
    const out = [0, 0, 0, 0, 0], left = {};
    for (let i = 0; i < 5; i++) { if (guess[i] === word[i]) out[i] = 2; else left[word[i]] = (left[word[i]] || 0) + 1; }
    for (let i = 0; i < 5; i++) if (!out[i] && left[guess[i]]) { out[i] = 1; left[guess[i]]--; }
    return out;
  }

  HS.lounge = {
    marks,
    start(S) {
      const L = { seed: S.seed, votes: {}, callT: null, tq: { order: HS.shuffle(HS.TRIVIA.map((_, i) => i), HS.R(S.seed * 3 + 1)), n: 0, score: 0, asked: 0 },
        wd: { order: HS.shuffle(HS.WORDS.map((_, i) => i), HS.R(S.seed * 5 + 2)), n: 0, solved: 0 } };
      newQuestion(L); newWord(L);
      return L;
    },
    // Mission Control's list is done: every drawn objective and the uplink
    ready(S) { return !!(S.goals && S.goals.every(k => HS.goalDone(k, S)) && HS.goalDone('uplink', S)); },

    // one crew member's turn (inside HS.each, their state swapped into U). True while a lounge panel has their keys
    step(U, dt, home) {
      const L = U.lounge; if (!L) return false;
      if (!home || U.down || !this.ready(HS.S)) { U.lng = null; delete L.votes[U.me]; return false; }
      // [V], or [E] (the Work button on touch screens) from the lounge bar; never a V typed into Wordle
      if (L.callT == null && (U.lng !== 'wordle' && HS.hit('KeyV') || !U.lng && !(U.stab && U.stab.fault.on) && HS.hit('KeyE'))) {
        if (L.votes[U.me]) delete L.votes[U.me]; else L.votes[U.me] = true;
        HS.sfx.blip();
      }
      if (!U.lng) {
        if (HS.hit('Digit1', 'Numpad1')) U.lng = 'trivia'; else if (HS.hit('Digit2', 'Numpad2')) U.lng = 'wordle';
        if (U.lng) HS.sfx.ok();
        return !!U.lng;
      }
      if (HS.hit('KeyQ')) { U.lng = null; HS.sfx.blip(); return true; }
      if (U.lng === 'trivia') {
        if (L.tq.reveal <= 0) for (let k = 1; k <= 4; k++) if (HS.hit('Digit' + k, 'Numpad' + k)) { L.tq.ans[U.me] = k - 1; HS.sfx.blip(); }
      } else {
        const w = L.wd;
        if (w.state !== 'play') { if (HS.hit('Enter', 'Space')) { w.n++; newWord(L); HS.sfx.ok(); } return true; }
        for (const ch of LETTERS) if (w.cur.length < 5 && HS.hit('Key' + ch)) { w.cur += ch; HS.sfx.type(); }
        if (HS.hit('Backspace')) w.cur = w.cur.slice(0, -1);
        if (HS.hit('Enter') && w.cur.length === 5) {
          w.guesses.push(w.cur);
          if (w.cur === w.w) { w.state = 'won'; w.solved++; HS.sfx.jingle(); HS.log('wordle', { word: w.w, tries: w.guesses.length }); }
          else if (w.guesses.length >= TRIES) { w.state = 'lost'; HS.sfx.sad(); }
          else HS.sfx.blip();
          w.cur = '';
        }
      }
      return true;
    },

    // once a tick on the host: trivia rounds and the vote. Returns 'call' when the ship should come now
    tick(U, dt) {
      const L = U.lounge; if (!L || !this.ready(HS.S)) return null;
      const ids = Object.keys(U.ps), standing = ids.filter(id => !U.ps[id].down);
      // trivia: the crew members who have it open answer; the answer shows when all have, or when time is up
      const tq = L.tq, playing = standing.filter(id => U.ps[id].lng === 'trivia');
      if (tq.reveal > 0) { tq.reveal -= dt; if (tq.reveal <= 0) { tq.n++; newQuestion(L); } }
      else if (playing.length) {
        tq.t += dt;
        if (playing.every(id => tq.ans[id] != null) || tq.t >= ASK_S) {
          const right = Object.values(tq.ans).filter(a => a === tq.right).length;
          tq.score += right; tq.asked++; tq.reveal = SHOW_S;
          if (right) HS.sfx.good(); else HS.sfx.buzz();
        }
      }
      // the vote: everyone still standing has voted (they can only vote at the lander)
      if (L.callT == null && standing.length && standing.every(id => L.votes[id])) { L.callT = CALL_S; HS.sfx.launch(); HS.log('ship_called', { left: Math.round(U.left) }); }
      if (L.callT != null) { L.callT -= dt; if (L.callT <= 0) return 'call'; }
      return null;
    },

    // the line under the hint bar
    hint(U) {
      if (U.lng === 'trivia') return '[1] [2] [3] [4] answer   [V] vote for the ship   [Q] back';
      if (U.lng === 'wordle') return U.lounge.wd.state === 'play' ? 'type a word   [ENTER] guess   [BACKSPACE] delete   [Q] back' : '[ENTER] next word   [Q] back';
      return null;
    },

    // what this screen shows at the lander: the lounge bar, or the open panel
    draw(U, home) {
      const L = U.lounge, S = HS.S; if (!L || !home || U.down || !this.ready(S)) return;
      const ids = Object.keys(U.ps), standing = ids.filter(id => !U.ps[id].down), votes = standing.filter(id => L.votes[id]).length;
      if (L.callT != null) tag(`SHIP CALLED: landing in ${Math.max(0, Math.ceil(L.callT))} s`, 320, (HS.Y0 || 0) + 54, C.green, 8.5);
      if (!U.lng) {
        const X = 222, Y = 282, W = 410, H = 26;
        box(X, Y, W, H, C.green, 5);
        T('MISSION DONE', X + 8, Y + 11, 7.5, C.green, { w: 700 });
        T('the ship is on its way. While you wait:', X + 8, Y + 21, 6.5, C.muted);
        const v = L.callT != null ? 'ship called' : L.votes[U.me] ? `voted ${votes}/${standing.length}  [V] undo` : `[V] or [E] call the ship  ${votes}/${standing.length}`;
        T(v, X + W - 8, Y + 11, 7.5, L.votes[U.me] || L.callT != null ? C.green : C.white, { a: 'right', w: 600 });
        T('[1] trivia   [2] wordle', X + W - 8, Y + 21, 7, C.cyan, { a: 'right', w: 600 });
        return;
      }
      const X = 160, Y = 66, W = 320, H = 226;
      if (HS.fillStage) HS.fillStage('rgba(4,7,13,.55)'); else { g.fillStyle = 'rgba(4,7,13,.55)'; g.fillRect(0, 0, 640, 360); }
      box(X, Y, W, H, C.cyan, 6);
      if (U.lng === 'trivia') this.drawTrivia(L, U, X, Y, W, H, playingCount(U));
      else this.drawWordle(L.wd, X, Y, W, H);
      T(L.callT != null ? `ship in ${Math.max(0, Math.ceil(L.callT))} s` : `ship vote ${votes}/${standing.length}`, X + W - 10, Y + H - 9, 7, L.callT != null ? C.green : C.muted, { a: 'right' });
      function playingCount(U) { return Object.keys(U.ps).filter(id => !U.ps[id].down && U.ps[id].lng === 'trivia').length; }
    },

    drawTrivia(L, U, X, Y, W, H, playing) {
      const tq = L.tq, reveal = tq.reveal > 0, mine = tq.ans[U.me];
      T('CREW TRIVIA', X + 12, Y + 18, 9, C.cyan, { w: 700 });
      T(`crew score ${tq.score}   question ${tq.asked + 1}`, X + W - 12, Y + 18, 7, C.muted, { a: 'right' });
      HS.wrap(tq.q, W - 24, 8.5).slice(0, 3).forEach((line, i) => T(line, X + 12, Y + 40 + i * 12, 8.5, C.white, { w: 600 }));
      tq.opts.forEach((o, i) => {
        const y = Y + 82 + i * 26, right = reveal && i === tq.right, wrong = reveal && mine === i && i !== tq.right, picked = mine === i;
        g.fillStyle = right ? HS.rgba(C.green, .3) : wrong ? HS.rgba(C.red, .3) : picked ? HS.rgba(C.cyan, .22) : 'rgba(150,200,255,.08)';
        g.fillRect(X + 12, y, W - 24, 20);
        T(`[${i + 1}]`, X + 18, y + 13.5, 7.5, picked ? C.cyan : C.amber, { w: 700 });
        T(HS.wrap(o, W - 70, 7.5)[0], X + 44, y + 13.5, 7.5, right ? C.green : C.white);
        // who picked it: one dot per crew member
        const n = Object.values(tq.ans).filter(a => a === i).length;
        for (let k = 0; k < n; k++) { g.fillStyle = C.white; g.fillRect(X + W - 22 - k * 6, y + 8, 4, 4); }
      });
      const answered = Object.keys(tq.ans).length;
      if (reveal) T(mine == null ? 'Time is up.' : mine === tq.right ? 'Right!' : 'Not this time.', X + 12, Y + H - 9, 8, mine === tq.right ? C.green : C.amber, { w: 700 });
      else { bar(X + 12, Y + H - 14, 110, 4, 1 - clamp(tq.t / ASK_S, 0, 1), C.cyan); T(`${answered}/${Math.max(1, playing)} answered`, X + 128, Y + H - 9, 7, C.muted); }
    },

    drawWordle(w, X, Y, W, H) {
      T('MISSION WORDLE', X + 12, Y + 18, 9, C.cyan, { w: 700 });
      T(`solved ${w.solved}   one word for the whole crew`, X + W - 12, Y + 18, 7, C.muted, { a: 'right' });
      const S2 = 22, gap = 4, gx = X + W / 2 - (5 * S2 + 4 * gap) / 2, gy = Y + 30;
      for (let r = 0; r < TRIES; r++) {
        const guess = w.guesses[r] || (r === w.guesses.length && w.state === 'play' ? w.cur.padEnd(5) : '     '), m = w.guesses[r] ? marks(w.guesses[r], w.w) : null;
        for (let c = 0; c < 5; c++) {
          const x0 = gx + c * (S2 + gap), y0 = gy + r * (S2 + gap), ch = guess[c] || ' ';
          g.fillStyle = HS.ART_OUT || '#0a0f18'; g.fillRect(x0 - 1, y0 - 1, S2 + 2, S2 + 2);
          g.fillStyle = m ? (m[c] === 2 ? '#3fae5a' : m[c] === 1 ? '#c9a227' : '#3a4452') : ch.trim() ? '#22303f' : '#151e29';
          g.fillRect(x0, y0, S2, S2);
          if (ch.trim()) T(ch, x0 + S2 / 2, y0 + S2 / 2 + 1, 11, C.white, { a: 'center', b: 'middle', w: 700, f: HS.PIX });
        }
      }
      const msg = w.state === 'won' ? `Got it: ${w.w}` : w.state === 'lost' ? `The word was ${w.w}` : 'green: right place   gold: in the word';
      T(msg, X + 12, Y + H - 9, 7.5, w.state === 'won' ? C.green : w.state === 'lost' ? C.amber : C.muted, { w: w.state === 'play' ? 400 : 700 });
    }
  };
})();
