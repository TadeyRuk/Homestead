// Homestead touch controls, for phones and tablets: a joystick that holds W/A/S/D, buttons that press the keys
// each scene uses, and the phone's own keyboard for the callsign and the join code. They only feed HS.local,
// the same keys and pointer a keyboard fills, so the scenes need nothing of their own. Taps on the game's own
// buttons already work through the canvas's pointer events. Shown on touch screens only (or with ?touch).
(() => {
  const HS = window.HS;
  const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  if (!coarse && !new URLSearchParams(location.search).has('touch')) return;
  const In = HS.local;
  const PLAY = ['build', 'flight', 'surface'];

  const style = document.createElement('style');
  style.textContent = `
    #touch { position: fixed; inset: 0; pointer-events: none; z-index: 5; font: 600 13px "IBM Plex Mono", ui-monospace, monospace; -webkit-user-select: none; user-select: none; }
    #touch .stick { position: absolute; left: max(14px, env(safe-area-inset-left)); bottom: 14px; width: 132px; height: 132px; border-radius: 50%;
      border: 1.5px solid rgba(120,255,220,.45); background: rgba(8,14,26,.45); pointer-events: auto; touch-action: none; }
    #touch .knob { position: absolute; left: 41px; top: 41px; width: 50px; height: 50px; border-radius: 50%; background: rgba(120,255,220,.35); border: 1.5px solid #78ffdc; }
    #touch .pad { position: absolute; right: max(14px, env(safe-area-inset-right)); bottom: 14px; display: grid; grid-template-columns: repeat(3, auto); gap: 8px; justify-items: end; }
    #touch .top { position: absolute; right: max(14px, env(safe-area-inset-right)); top: 10px; display: flex; gap: 8px; }
    #touch button { pointer-events: auto; touch-action: none; min-width: 56px; min-height: 48px; padding: 0 12px; border-radius: 8px; color: #ebf0f5;
      font: inherit; background: rgba(8,14,26,.72); border: 1.5px solid #3a4a62; transition: transform .15s, background .15s; }
    #touch button.main { border-color: #78ffdc; color: #78ffdc; }
    #touch button.on { background: rgba(120,255,220,.25); transform: scale(.96); }
    #touch .type { position: fixed; left: 0; top: 0; width: 1px; height: 1px; opacity: 0; font-size: 16px; border: 0; padding: 0; }
    #touch .turn { display: none; }
    @media (orientation: portrait) {
      #touch .turn { display: grid; place-items: center; position: fixed; inset: 0; background: #04070d; color: #78ffdc; pointer-events: auto; font-size: 15px; text-align: center; padding: 24px; }
    }`;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.id = 'touch';
  root.innerHTML = '<div class="stick" hidden><div class="knob"></div></div><div class="pad"></div><div class="top"></div>' +
    '<input class="type" aria-label="Type" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false">' +
    '<div class="turn">Turn your phone sideways to play</div>';
  document.body.appendChild(root);
  const stick = root.querySelector('.stick'), knob = root.querySelector('.knob'), pad = root.querySelector('.pad'), top = root.querySelector('.top'), type = root.querySelector('.type');
  const wake = () => { In.any = true; HS.audioUnlock(); };

  // ---------- the joystick: past DEAD of its radius in a direction holds that key
  const R = 48, DEAD = .35;
  let sid = null, cx = 0, cy = 0;
  const hold = (code, on) => on ? In.down.add(code) : In.down.delete(code);
  const aim = (dx, dy) => {
    const len = Math.hypot(dx, dy), k = len > 1 ? 1 / len : 1;
    dx *= k; dy *= k;
    knob.style.transform = `translate(${dx * R}px, ${dy * R}px)`;
    hold('KeyA', dx < -DEAD); hold('KeyD', dx > DEAD); hold('KeyW', dy < -DEAD); hold('KeyS', dy > DEAD);
  };
  stick.addEventListener('pointerdown', (e) => {
    e.preventDefault(); wake();
    sid = e.pointerId; stick.setPointerCapture(sid);
    const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    aim((e.clientX - cx) / R, (e.clientY - cy) / R);
  });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) aim((e.clientX - cx) / R, (e.clientY - cy) / R); });
  const let_go = (e) => { if (e.pointerId !== sid) return; sid = null; aim(0, 0); };
  stick.addEventListener('pointerup', let_go); stick.addEventListener('pointercancel', let_go);

  // ---------- buttons: a press is a key going down (and a one-frame hit), held until the finger lifts
  function button(parent, label, code, main) {
    const b = document.createElement('button');
    b.textContent = label; if (main) b.className = 'main';
    if (typeof code === 'function') { b.addEventListener('click', (e) => { e.preventDefault(); wake(); code(); }); }
    else {
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); wake(); b.setPointerCapture(e.pointerId); b.classList.add('on'); In.down.add(code); In.hit.add(code); });
      const up = () => { b.classList.remove('on'); In.down.delete(code); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    }
    parent.appendChild(b);
  }

  // ---------- the phone's keyboard: what it types becomes key presses the crew and lobby screens already read
  const keyboard = () => { type.value = ''; type.focus(); };
  type.addEventListener('keydown', (e) => {
    e.stopPropagation();   // the window listener in core.js would count the key a second time
    if (e.key === 'Enter') { e.preventDefault(); In.hit.add('Enter'); type.blur(); }
  });
  type.addEventListener('input', (e) => {
    if (e.inputType === 'deleteContentBackward') In.hit.add('Backspace');
    for (const ch of (e.data || '').toUpperCase()) {
      if (/[A-Z]/.test(ch)) In.hit.add('Key' + ch);
      else if (/\d/.test(ch)) In.hit.add('Digit' + ch);
      else if (ch === ' ') In.hit.add('Space');
      else if (ch === '-') In.hit.add('Minus');
    }
    type.value = '';
  });

  // ---------- which controls each moment needs; rebuilt only when that changes
  const station = () => { try { return HS.sceneName === 'flight' ? HS.ROLES[HS.scenes.flight.save().st] : ''; } catch (e) { return ''; } };
  const askedMe = () => !!(HS.net && HS.net.ask && HS.net.ask.to === HS.net.me);
  const lobbyMode = () => HS.net ? HS.net.mode : 'solo';
  let shown = '', lastCheck = 0;
  function layout() {
    const s = HS.sceneName, play = PLAY.includes(s);
    stick.hidden = !play || HS.paused;
    pad.textContent = ''; top.textContent = '';
    // while you type the rocket's name, Esc means cancel (the Cancel button), so Pause and Leave step aside
    if (play && !HS.typing) button(top, HS.online && HS.online() ? 'Leave' : 'Pause', 'Escape');
    if (HS.paused) { button(pad, 'Resume', 'Enter', true); button(pad, 'Restart', 'KeyR'); button(pad, 'Title', 'KeyT'); return; }
    if (askedMe()) { button(pad, 'Swap', 'Enter', true); button(pad, 'No', 'KeyN'); }
    if (s === 'build' && HS.typing) { button(pad, 'Cancel', 'Escape'); button(pad, 'Suggest', 'Tab'); button(pad, 'Save', 'Enter'); button(pad, 'Type', keyboard, true); }
    else if (s === 'build') { button(pad, 'Map', 'Tab'); button(pad, 'Inspect', 'KeyI'); button(pad, 'Blueprint', 'KeyB'); button(pad, 'Name', 'KeyN'); button(pad, 'Launch', 'KeyL'); button(pad, 'Drop', 'KeyQ'); button(pad, 'Use', 'KeyE', true); }
    else if (s === 'surface') { button(pad, 'Map', 'Tab'); button(pad, 'Suit', 'KeyQ'); button(pad, 'Photo', 'KeyF'); button(pad, 'Work', 'KeyE', true); }
    else if (s === 'flight') {
      const st = station();
      button(pad, 'Station', 'Tab');
      if (st === 'eng') button(pad, 'Weld', 'KeyF', true);
      if (st === 'sci') button(pad, 'Tray', 'Space', true);
    } else if (s === 'crew') button(pad, 'Type name', keyboard, true);
    else if (s === 'lobby') {
      if (lobbyMode() === 'solo') { button(pad, 'Back', 'Escape'); button(pad, 'Type code', keyboard, true); }
      else { button(pad, 'Leave', 'Escape'); ['1', '2', '3', '4'].forEach((d) => button(pad, 'Role ' + d, 'Digit' + d)); }
    }
  }
  function tick(now) {
    if (now - lastCheck > 200) {
      lastCheck = now;
      const sig = [HS.sceneName, HS.paused, !!HS.typing, lobbyMode(), askedMe(), station(), HS.online && HS.online()].join('|');
      if (sig !== shown) { shown = sig; layout(); }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  HS.touch = true;
})();
