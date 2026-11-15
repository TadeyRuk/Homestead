// Homestead tutorial: Mission Control cards that teach each phase the first time it starts. Build, flight and the
// surface each get a card when they open, and in flight each station gets its own card the first time this
// player works it. A card says what the phase is for and every key it uses. Solo, the game holds still until the
// card is read ([ENTER], [SPACE], [ESC] or a tap); online nothing can pause, so the card closes itself after
// AUTO_S seconds. Each card shows once per browser (localStorage); the pause menu's [H] shows the current one
// again, and the title's [G] pill turns the tutorial back on from the start. main.js calls step and draw.
// Starting a run from the ?scene= debug link skips the cards unless ?tutorial=1 is set too.
(() => {
  const HS = window.HS, g = HS.g;
  const { T, C, PIX, clamp } = HS;
  const KEY = 'hs.tutorial', AUTO_S = 16, ST = ['pilot', 'eng', 'comms', 'sci'];
  const ORDER = ['build', 'flight', 'pilot', 'eng', 'comms', 'sci', 'surface'];
  const q = new URLSearchParams(location.search);
  const skip = q.has('scene') && q.get('tutorial') !== '1';
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let prefs = { off: false, seen: {} };
  try { const p = JSON.parse(localStorage.getItem(KEY) || 'null'); if (p && typeof p === 'object') prefs = { off: !!p.off, seen: p.seen || {} }; } catch (e) { }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { } };
  let open = null, queue = [];   // the card on screen ({ id, t }) and the ones waiting behind it

  const online = () => !!(HS.online && HS.online());
  const minutes = (s) => `${Math.round(s / 60)} minutes`;

  // ---------- what each card says. keys: [[keycaps], what they do]
  function card(id) {
    const S = HS.S, mars = S && S.mission && S.mission.id === 'mars';
    switch (id) {
      case 'build': return {
        head: 'PHASE 1 OF 3', title: 'Build your rocket', col: C.amber,
        goal: `Find one part for each of the four slots (propulsion, power, comms, payload) and carry it to the launch pad. You have ${minutes(HS.BUILD_TIME)}.`,
        keys: [
          [['W', 'A', 'S', 'D'], 'walk (the arrow keys work too)'],
          [['E'], 'pick up a part, mount it at the pad, open the kiosk'],
          [['Q'], 'drop the part you are carrying'],
          [['I'], 'inspect a part: what it does in flight and on the surface'],
          [['B'], 'blueprint: your rocket\'s mass, power, data and budget'],
          [['TAB'], 'hold for the campus map'],
          [['N'], 'name your rocket (the clock stops while you type)'],
          [['L'], 'at the pad: launch. Empty slots get salvage parts']
        ],
        tip: 'Every part is a trade-off. Too heavy for the engine and the rocket never reaches orbit; draw more power than you make and the breakers trip. The pink kiosk sells any part for credits.'
      };
      case 'flight': return online() ? {
        head: 'PHASE 2 OF 3', title: 'Fly it there', col: C.cyan,
        goal: 'Each of you runs your own station until the ship arrives. A tab that blinks along the top is a station that needs help: say so out loud.',
        keys: [
          [['1', '2', '3', '4'], 'ask another player to swap stations with you'],
          [['TAB'], 'move between your own stations, if you hold more than one']
        ],
        tip: 'The run ends early if the hull, the fuel or the cabin oxygen reaches zero.'
      } : {
        head: 'PHASE 2 OF 3', title: 'Fly it there', col: C.cyan,
        goal: 'Four stations keep the ship alive until it arrives. Solo, you run all four: jump to whichever one needs you.',
        keys: [
          [['1'], 'Pilot: dodge debris, hold the transfer speed'],
          [['2'], 'Rocket Engineer: power bus and hull welds'],
          [['3'], 'Comms Engineer: keep Earth in the dish\'s beam'],
          [['4'], 'Science Officer: core temperature and oxygen'],
          [['TAB'], 'next station']
        ],
        tip: 'A red tab needs you now, an amber one soon. The run ends early if the hull, the fuel or the cabin oxygen reaches zero.'
      };
      case 'pilot': return {
        head: 'STATION 1  PILOT', title: 'Pilot', col: C.pilot,
        goal: 'Steer around the debris and hold the ship at transfer speed. Off that speed the trip runs slow.',
        keys: [
          [['A', 'D'], 'steer left and right'],
          [['W'], 'speed up (burns fuel)'],
          [['S'], 'slow down (burns fuel)']
        ],
        tip: 'Keep the needle on the green band of the speed dial. A good comms link warns you before debris arrives.'
      };
      case 'eng': return {
        head: 'STATION 2  ROCKET ENGINEER', title: 'Rocket Engineer', col: C.eng,
        goal: 'Keep the loads you switch on below what the power part supplies, or the breaker trips and the ship goes dark for 4 seconds.',
        keys: [
          [['Q', 'W', 'E', 'R', 'T', 'Y', 'U'], 'switch the seven loads on or off (or click them)'],
          [['MOUSE'], 'drag along a hull crack to weld it shut'],
          [['F'], 'hold to weld slowly without the mouse']
        ],
        tip: 'Switching the engine off saves power, but then the pilot cannot steer. A crack leaks cabin oxygen until it is welded.'
      };
      case 'comms': return {
        head: 'STATION 3  COMMS ENGINEER', title: 'Comms Engineer', col: C.comms,
        goal: 'The dish drifts off Earth. Keep Earth in the beam: a strong link warns the pilot about debris and sends data home.',
        keys: [
          [['A', 'D'], 'lean the dish back toward Earth']
        ],
        tip: 'Hold a full lock for 2 seconds and data comes in twice as fast. The dish drifts more while the pilot steers hard.'
      };
      case 'sci': return {
        head: 'STATION 4  SCIENCE OFFICER', title: 'Science Officer', col: C.sci,
        goal: 'Keep the energy core warm but not hot, and keep the cabin\'s oxygen up.',
        keys: [
          [['W'], 'open the coolant valve: cools the core'],
          [['S'], 'close the valve: lets the core warm up'],
          [['SPACE'], 'feed the first tray item to the oxygen converter'],
          [['MOUSE'], 'click any tray item to feed that one']
        ],
        tip: 'Ice, CO2 cartridges and food make oxygen. Never feed the wrench: it jams the intake for 5 seconds. Too hot damages the instrument; too cold cuts the power.'
      };
      case 'surface': return {
        head: 'PHASE 3 OF 3', title: 'Do the job', col: C.cyan,
        goal: `Work through Mission Control's list (bottom left) in ${minutes(HS.SURFACE_TIME)}. Data and samples only count once you bring them back to the lander.`,
        keys: [
          [['W', 'A', 'S', 'D'], 'walk'],
          [['E'], 'hold at a marker to scan, drill, deploy or start a task'],
          [['F'], 'take the bonus photo from the right spot'],
          [['Q'], 'switch the panel between the list and your suit'],
          [['TAB'], 'hold for the map'],
          [['V'], 'at the lander, once the list is done: call the ship early']
        ],
        tip: (mars ? 'Dust storms drain suits four times faster: wait them out at the lander.' : 'Solar flares drain suits six times faster: shelter at the lander or behind a rock.') +
          ' The lander refills your suit. If a suit fault flashes, press the keys it shows, in order.'
      };
    }
    return null;
  }

  // ---------- which card fits this moment
  function current() {
    const s = HS.sceneName, d = HS.dbg || {};
    try {
      if (s === 'build') { const B = d.build && d.build(); return B && !B.done && !B.naming ? ['build'] : []; }
      if (s === 'flight') { const F = d.flight && d.flight(); return F && !F.over && !F.done ? ['flight', ST[F.st] || 'pilot'] : []; }
      if (s === 'surface') { const U = d.surface && d.surface(); return U && !U.ext && !U.down && !U.game ? ['surface'] : []; }
    } catch (e) { /* a scene mid-change: try again next step */ }
    return [];
  }

  function show(id) { open = { id, t: 0 }; prefs.seen[id] = 1; save(); HS.sfx.blip(); }
  function close() { open = null; HS.sfx.ok(); if (queue.length) show(queue.shift()); }

  HS.guide = {
    // true while the tutorial counts as on: not switched off, and some card still to show
    on: () => !prefs.off && ORDER.some((id) => !prefs.seen[id]),
    // the title's [G]: off, or back on from the first card
    toggle() { if (this.on()) prefs.off = true; else prefs = { off: false, seen: {} }; save(); return this.on(); },
    // the pause menu's [H]: this moment's cards again
    again() { const ids = current(); queue = ids.slice(1); if (ids.length) show(ids[0]); },
    isOpen: () => !!open,
    // one fixed step; true means the scene should not run this step (solo, a card is up)
    step(dt) {
      if (!open) {
        if (prefs.off || skip || HS.typing) return false;
        const id = current().find((k) => !prefs.seen[k]);
        if (!id) return false;
        show(id);
      }
      open.t += dt;
      const k = HS.local.hit, tap = HS.local.click;
      if (open.t > .35 && (k.has('Enter') || tap || (!online() && (k.has('Space') || k.has('Escape'))))) { if (!online()) { k.clear(); HS.local.click = false; } close(); }
      else if (online() && open.t > AUTO_S) close();
      return !!open && !online();
    },
    draw() {
      if (!open) return;
      const c = card(open.id); if (!c) { open = null; return; }
      const solo = !online(), t = open.t, k = calm ? 1 : clamp(t / .22, 0, 1), rise = calm ? 0 : (1 - k) * 8;
      const W = 420, X = 110, PAD = 14, IW = W - PAD * 2;
      // the description column starts just past this card's widest row of keycaps
      const KW = Math.max(...c.keys.map(([caps]) => caps.reduce((a, s) => a + capW(s) + 2, -2))) + 12;
      const goal = HS.wrap(c.goal, IW, 8.5), tip = HS.wrap(c.tip, IW - 10, 7.5);
      const H = PAD + 12 + 24 + goal.length * 12 + 8 + c.keys.length * 16 + 8 + tip.length * 10.5 + 12 + 22;
      const Y = Math.round(180 - H / 2 + rise);
      g.save();
      if (solo) HS.fillStage(`rgba(4,7,13,${.62 * k})`);
      g.globalAlpha = k;
      // the card: ink, a coloured edge and a header strip, like the game's other panels
      HS.box(X, Y, W, H, c.col, 6, 'rgba(8,14,26,.96)');
      g.fillStyle = HS.rgba(c.col, .14); HS.rr(X + 1, Y + 1, W - 2, 18, 5); g.fill();
      T('MISSION CONTROL  /  TRAINING', X + PAD, Y + 11, 7, c.col, { w: 600, b: 'middle' });
      T(c.head, X + W - PAD, Y + 11, 7, C.muted, { w: 600, a: 'right', b: 'middle' });
      let y = Y + PAD + 12 + 10;
      T(c.title, X + PAD, y, 17, C.white, { w: 700, f: PIX, b: 'middle' });
      y += 18;
      goal.forEach((s) => { T(s, X + PAD, y, 8.5, '#c8d2dc', { b: 'middle' }); y += 12; });
      y += 6;
      // the keys, as keycaps, and what each does
      g.strokeStyle = '#22324a'; g.lineWidth = 1; g.beginPath(); g.moveTo(X + PAD, y - 2); g.lineTo(X + W - PAD, y - 2); g.stroke();
      y += 4;
      for (const [caps, what] of c.keys) {
        let cx = X + PAD;
        caps.forEach((s, i) => { cx += cap(s, cx, y) + (i < caps.length - 1 ? 2 : 0); });
        T(what, X + PAD + KW, y + 6.5, 8, C.white, { b: 'middle' });
        y += 16;
      }
      y += 4;
      g.fillStyle = HS.rgba(C.amber, .1); g.fillRect(X + PAD, y - 4, IW, tip.length * 10.5 + 6);
      g.fillStyle = C.amber; g.fillRect(X + PAD, y - 4, 2, tip.length * 10.5 + 6);
      tip.forEach((s) => { T(s, X + PAD + 8, y + 4, 7.5, C.amber, { b: 'middle' }); y += 10.5; });
      // how to go on
      const fy = Y + H - 13;
      if (solo) {
        const blink = calm || Math.floor(t * 2) % 2 === 0;
        T(HS.touch ? 'tap to continue' : '[ENTER] continue', X + W - PAD, fy, 8.5, blink ? C.cyan : HS.rgba(C.cyan, .55), { w: 600, a: 'right', b: 'middle' });
        T('pause and press [H] to see this again', X + PAD, fy, 7, '#6f7d8c', { b: 'middle' });
      } else {
        T(HS.touch ? 'tap to close' : '[ENTER] close', X + W - PAD, fy, 8.5, C.cyan, { w: 600, a: 'right', b: 'middle' });
        T('the game keeps running', X + PAD, fy, 7, '#6f7d8c', { b: 'middle' });
        HS.bar(X + 1, Y + H - 3, W - 2, 2, 1 - t / AUTO_S, HS.rgba(c.col, .7), 'transparent');
      }
      g.restore();
    }
  };

  // one keycap: a raised key with its label; returns its width
  const capW = (s) => Math.max(13, HS.tw(s, 7, { w: 600 }) + 8);
  function cap(s, x, y) {
    const w = capW(s);
    g.fillStyle = '#05090f'; HS.rr(x, y + 1.5, w, 12, 2.5); g.fill();
    g.fillStyle = '#1b2638'; HS.rr(x, y, w, 12, 2.5); g.fill();
    g.strokeStyle = '#4a5d78'; g.lineWidth = 1; HS.rr(x + .5, y + .5, w - 1, 11, 2.5); g.stroke();
    T(s, x + w / 2, y + 6.5, 7, C.white, { w: 600, a: 'center', b: 'middle' });
    return w;
  }
})();
