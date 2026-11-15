// Naming the rocket, on the build screen. Anyone in the crew presses [N] and the build clock stops for everyone
// (the countdown, the kiosk roll and every crew member's hands too) until the name is saved or dropped.
// The open dialog lives in the build scene's shared state (B.naming), so in an online room the host types each
// letter from the namer's own input and every screen draws the same dialog. The name itself is HS.S.rocket,
// shown on the blueprint, at the pad, in the launch and landing captions, in flight and on the report.
(() => {
  const HS = window.HS, g = HS.g;
  const { T, C, PIX } = HS;
  const MAX = 16;
  const charOf = (code) => /^Key[A-Z]$/.test(code) ? code[3] : /^Digit\d$/.test(code) ? code[5] : code === 'Space' ? ' ' : code === 'Minus' ? '-' : null;
  // [TAB] suggestions: two words, picked from the run's seed so the same seed suggests the same names
  const FIRST = ['LUCKY', 'BRAVE', 'QUIET', 'IRON', 'SILVER', 'LITTLE', 'STEADY', 'BRIGHT', 'RUSTY', 'NIGHT', 'WILD', 'LONG', 'NORTH', 'GOLDEN'];
  const SECOND = ['KESTREL', 'LANTERN', 'COMET', 'SPARROW', 'PIONEER', 'HERON', 'TORTOISE', 'EMBER', 'MARIGOLD', 'ANVIL', 'OTTER', 'SHOT', 'WREN', 'BEACON'];
  const suggest = (seed, i) => { const r = HS.R(seed * 97 + i * 31 + 5); return FIRST[(r() * FIRST.length) | 0] + ' ' + SECOND[(r() * SECOND.length) | 0]; };

  // the rocket's name, or '' while it has none
  HS.rocketName = () => (HS.S && HS.S.rocket) || '';
  // shorten s with an ellipsis until it fits max units at this size
  HS.fitText = (s, size, max, o) => { if (HS.tw(s, size, o) <= max) return s; while (s.length > 1 && HS.tw(s + '…', size, o) > max) s = s.slice(0, -1); return s + '…'; };

  // ---------- host side
  function open(B, who) { B.naming = { who, text: HS.S.rocket || '', sug: 0, t: 0 }; HS.sfx.blip(); }
  // one step of the namer's typing; returns 'saved', 'dropped' or null while still open. The pause cannot be held
  // forever: if the namer leaves the room the dialog closes, and after IDLE seconds it saves what is typed.
  const IDLE = 60;
  const finish = (B, s) => { B.naming = null; s = s.trim(); if (!s) { HS.sfx.drop(); return 'dropped'; } HS.S.rocket = s; HS.log('name', { name: s }); HS.sfx.ok(); return 'saved'; };
  function type(B, dt) {
    const n = B.naming; n.t += dt;
    if (!HS.ids().includes(n.who)) { B.naming = null; return 'dropped'; }
    if (n.t > IDLE) return finish(B, n.text);
    return HS.as(n.who, () => {
      // keys in the order they were pressed: a Backspace and a letter in the same frame must not swap places
      for (const code of HS.In.hit) {
        if (code === 'Backspace') { if (n.text) { n.text = n.text.slice(0, -1); HS.sfx.type(); } continue; }
        const ch = charOf(code);
        if (ch && n.text.length < MAX && !(ch === ' ' && (!n.text || n.text.endsWith(' ')))) { n.text += ch; HS.sfx.type(); }
      }
      if (HS.hit('Tab')) { n.text = suggest(HS.S.seed, n.sug++); HS.sfx.blip(); }
      if (HS.hit('Escape')) { B.naming = null; HS.sfx.drop(); return 'dropped'; }
      if (HS.hit('Enter') && n.t > .15) return finish(B, n.text);
      return null;
    });
  }

  // ---------- every screen: the dialog over the campus
  function dialog(B, t) {
    const n = B.naming; if (!n) return;
    const bp = HS.blueprint, { INK, INK2, DIM, AMBER } = bp.COL, mine = n.who === HS.net.me;
    HS.fillStage('rgba(4,7,13,.55)');
    const W = 336, H = 128, X = 320 - W / 2, Y = 180 - H / 2 - 10;
    bp.paper(X, Y, W, H, 5, 25);
    T('NAME YOUR ROCKET', X + 12, Y + 15, 9, INK, { w: 700 });
    // the build clock is stopped: a stamp, with a slow blinking dot
    const st = 'BUILD CLOCK PAUSED', sw = HS.tw(st, 6.5, { w: 700 }) + 16;
    g.strokeStyle = AMBER; g.lineWidth = 1; g.strokeRect(X + W - sw - 10.5, Y + 6.5, sw, 13);
    if (Math.floor(t * 2) % 2) { g.fillStyle = AMBER; g.fillRect(X + W - sw - 6, Y + 11, 4, 4); }
    T(st, X + W - 14, Y + 15.5, 6.5, AMBER, { w: 700, a: 'right' });
    // the rocket being named, as it stands
    const shown = bp.ink(bp.ids(null)), rw = shown.c.width / 2, rh = shown.c.height / 2, scale = Math.min(1, 92 / rh);
    g.imageSmoothingEnabled = false; g.drawImage(shown.c, X + 14, Y + 26 + (92 - rh * scale) / 2, rw * scale, rh * scale);
    // the field
    const fx = X + 104, fy = Y + 34, fw = W - 116, fh = 30;
    g.fillStyle = 'rgba(8,30,62,.9)'; g.fillRect(fx, fy, fw, fh);
    g.strokeStyle = mine ? INK : INK2; g.lineWidth = 1; g.strokeRect(fx + .5, fy + .5, fw - 1, fh - 1);
    const shownText = n.text || '', caret = mine && Math.floor(t * 2.4) % 2 && shownText.length < MAX ? '_' : '';
    if (shownText || caret) T(HS.fitText(shownText, 15, fw - 24, { w: 700, f: PIX }) + caret, fx + 8, fy + 20, 15, C.white, { w: 700, f: PIX });
    else T(mine ? 'type a name' : '…', fx + 8, fy + 19, 9, DIM, { w: 600 });
    T(`${shownText.length}/${MAX}`, fx + fw - 6, fy + fh + 9, 6, DIM, { w: 600, a: 'right' });
    if (n.t > IDLE - 10) T(`closes in ${Math.max(0, Math.ceil(IDLE - n.t))} s`, fx + fw - 6, fy + fh + 26, 6.5, AMBER, { w: 600, a: 'right' });
    if (mine) {
      T('[TAB] suggest one', fx, fy + fh + 9, 6.5, INK2, { w: 600 });
      T('[ENTER] save', fx, fy + fh + 26, 7.5, C.cyan, { w: 700 });
      T('[ESC] cancel', fx + 70, fy + fh + 26, 7.5, INK2, { w: 600 });
    } else {
      const who = (HS.member(n.who).name || 'A crew member');
      T(HS.fitText(`${who} is naming the rocket`, 7.5, fw, { w: 600 }), fx, fy + fh + 12, 7.5, INK, { w: 600 });
      T('everyone waits: nothing moves until they are done', fx, fy + fh + 24, 6.5, DIM);
    }
    // the name a save would replace
    if (HS.rocketName() && HS.rocketName() !== shownText.trim()) T(HS.fitText('now: ' + HS.rocketName(), 6, 90, { w: 600 }), X + 14, Y + H - 6, 6, DIM, { w: 600 });
  }

  HS.naming = { open, type, dialog, suggest, MAX };
})();
