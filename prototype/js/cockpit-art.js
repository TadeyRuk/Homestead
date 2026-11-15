// Homestead cockpit: the pilot station seen from the pilot's seat, on the 1280 x 720 art grid (src/ui/ART-RULES.md).
// The flight's rules are unchanged: js/flight.js still keeps the ship's place in its lane (F.x) and each rock's
// lateral x and approach y in the old 160 x 90 q-space. This file only draws them in first person. The lane is
// the view ahead, debris comes at the windshield out of the distance, and the dashboard's instruments read the
// numbers the old panels showed: speed, fuel, hull, link, the power bus and a radar with the old top-down view.
// Speed shows as a star field that stretches into a warp tunnel as the ship speeds up. Text is drawn by
// js/flight.js over the art (labels at half these coordinates); nothing here is text.
(() => {
  const HS = window.HS, L = HS.liftoff, FA = HS.flightArt, K = FA.kit;
  const { R, hex, mix, make, noise, bayer, clamp } = L;
  const { paint, outlined, disc, line, glow, background, earthCap, planetSprite, rockFrame, warmRocks } = K;
  const TAU = Math.PI * 2;
  let calmV = null;
  const calm = () => (calmV ??= !!L.calm());

  // ---------- layout (art pixels). js/flight.js places its labels from these, halved.
  const VP = [640, 236];   // straight ahead: the middle of the windshield
  const CK = FA.COCKPIT = {
    VP,
    GAUGE: { x: 420, y: 566, r: 62 },
    RADAR: { x: 548, y: 496, w: 184, h: 130 },
    CAM: { x: 806, y: 496, w: 160, h: 82 },
    HULL: { x: 806, y: 598, w: 160, h: 60 },
    THR: { x: 1022, y: 494, w: 82, h: 190 },
    FUEL: { x: 1132, y: 504, w: 26, h: 168 },
    LINK: { x: 1186, y: 524, w: 54, h: 64 },
    BUS: { x: 136, y: 482, w: 196, h: 96 },
    PLATE: { x: 130, y: 594, w: 208, h: 40 },
    LAMPS: { x: 454, y: 460, w: 58, h: 20, gap: 4, icons: ['debris', 'link', 'engine', 'fuel', 'hull', 'warp'] },
    CAUTION: { x: 842, y: 458, s: 24 },
    YOKE: { x: 640, y: 678 },
    // the controls, as keycaps: the letter is drawn on each cap by js/flight.js, which also reads ck.keys
    KEYS: [
      { k: 'A', x: 140, codes: ['KeyA', 'ArrowLeft'] }, { k: 'D', x: 166, codes: ['KeyD', 'ArrowRight'] },
      { k: 'W', x: 226, codes: ['KeyW', 'ArrowUp'] }, { k: 'S', x: 276, codes: ['KeyS', 'ArrowDown'] }
    ],
    KEY_Y: 604, KEY_S: 22,
    HEAVY: { x: 140, y: 640 }
  };
  const { GAUGE, RADAR, CAM, HULL, THR, FUEL, LINK, BUS, PLATE, LAMPS, CAUTION, YOKE, KEYS, KEY_Y, KEY_S, HEAVY } = CK;
  const VENT = { x: 70, y: 522, r: 29 }, TOG = { x: 36, y: 562, w: 78, h: 52 }, CARD = { x: 38, y: 626 };
  const KNOB_X = 996, KNOBS = [[512, -2.2], [552, -.6], [592, .9]], GUARD = { x: 986, y: 626 };
  const PATCH = { x: 1213, y: 642, r: 22 }, BOB = { x: 300 };

  // the canopy: a bar across the top, a pillar either side leaning in, and the glare shield over the dashboard
  const topEdge = (X) => { const u = (X - 640) / 640; return 26 + 22 * u * u; };
  const dashTop = (X) => { const u = (X - 640) / 640; return 440 + 30 * u * u; };
  const pillar = (Y) => { const s = clamp((Y - 40) / 430), xo = 60 + s * 168; return [xo, xo + 44 + s * 10]; };   // left; the right mirrors it

  const PAL = {
    gasket: hex('#07090d'),
    canopy: ['#161a21', '#1e232b', '#2a3039', '#3a414c'].map(hex),
    pillar: ['#4c5562', '#363d48', '#262c35', '#1a1e25'].map(hex),
    shield: ['#59636f', '#20252d', '#181c23', '#12151a'].map(hex),
    face: ['#2c323c', '#262c35', '#21262e', '#1a1e25'].map(hex),
    wall: ['#1c2129', '#262c35'].map(hex)
  };

  // a round screw head, 5 x 5, lit from the top left, with its slot turned a little each time
  function screw(x, X, Y, k = 0) {
    disc(x, X, Y, 3, '#0a0d12'); disc(x, X, Y, 2, '#4a5462');
    R(x, X - 1, Y - 2, 2, 1, '#9aa4b2'); R(x, X - 2, Y - 1, 1, 2, '#8a94a2'); R(x, X + 1, Y + 1, 1, 1, '#1a1e25'); R(x, X + 2, Y, 1, 1, '#262c35');
    if (k % 2) R(x, X, Y - 1, 1, 3, '#1a1e25'); else R(x, X - 1, Y, 3, 1, '#1a1e25');
  }
  // a raised frame b px wide round the dark glass of a screen or tube: lit outside edge at the top left, a chamfer
  // sloping in to the glass (shaded at the top left, lit at the bottom right), and a screw in each corner
  function bezel(x, X, Y, w, h, b = 8) {
    R(x, X - b - 1, Y - b - 1, w + b * 2 + 2, h + b * 2 + 2, '#0a0d12');
    R(x, X - b, Y - b, w + b * 2, h + b * 2, '#2b313a');
    R(x, X - b, Y - b, w + b * 2, 2, '#4f5864'); R(x, X - b, Y - b, 2, h + b * 2, '#47505c');
    R(x, X - b, Y + h + b - 2, w + b * 2, 2, '#181c22'); R(x, X + w + b - 2, Y - b + 2, 2, h + b * 2 - 2, '#1c2027');
    R(x, X - 3, Y - 3, w + 6, 3, '#14181d'); R(x, X - 3, Y - 3, 3, h + 6, '#161a20');
    R(x, X - 3, Y + h, w + 6, 3, '#3a424d'); R(x, X + w, Y - 1, 3, h + 4, '#333a45');
    R(x, X - 1, Y - 1, w + 2, h + 2, '#020305');
    R(x, X, Y, w, h, '#05080c');
    if (b >= 7) [[X - b + 4, Y - b + 4], [X + w + b - 5, Y - b + 4], [X - b + 4, Y + h + b - 5], [X + w + b - 5, Y + h + b - 5]].forEach(([sx, sy], i) => screw(x, sx, sy, i));
  }
  // a raised plate the switches and lamps sit on: lit top and left edges, a shadow along the bottom and right,
  // a fine brushed grain, and a screw in each corner
  function plate(x, X, Y, w, h, fill = '#1f242c') {
    R(x, X - 1, Y - 1, w + 2, h + 3, '#07090c');
    R(x, X, Y, w, h, fill);
    x.globalAlpha = .05; for (let yy = Y + 3; yy < Y + h - 2; yy += 2) R(x, X + 2, yy, w - 4, 1, '#ffffff'); x.globalAlpha = 1;
    R(x, X, Y, w, 1, '#4a525e'); R(x, X, Y, 1, h, '#3e4652');
    R(x, X, Y + h - 1, w, 1, '#121519'); R(x, X + w - 1, Y + 1, 1, h - 1, '#14181d');
    [[X + 4, Y + 4], [X + w - 5, Y + 4], [X + 4, Y + h - 5], [X + w - 5, Y + h - 5]].forEach(([sx, sy], i) => screw(x, sx, sy, i + 1));
  }
  // a hole cut into the dashboard: shaded top and left walls, lit bottom and right walls
  function recess(x, X, Y, w, h, fill = '#14181e') {
    R(x, X - 1, Y - 1, w + 2, h + 2, '#07090c'); R(x, X, Y, w, h, fill);
    R(x, X, Y, w, 3, '#0b0e12'); R(x, X, Y, 3, h, '#0d1015');
    R(x, X, Y + h - 2, w, 2, '#363e49'); R(x, X + w - 2, Y + 3, 2, h - 3, '#2c333d');
  }
  // an icon engraved into a panel: the dark cut first, then the face in col
  function engrave(x, name, X, Y, col = '#8f9aa8') {
    x.drawImage(HS.icon(name, '#06080b', { flat: true }), X + 1, Y + 1);
    x.drawImage(HS.icon(name, col, { flat: true }), X, Y);
  }
  // a toggle switch: a hex nut and a steel bat pointing up (on) or down (off)
  function toggle(x, X, Y, up) {
    disc(x, X, Y, 6, '#0a0d12'); disc(x, X - 1, Y - 1, 5, '#8a94a2'); disc(x, X + 1, Y + 1, 5, '#262c35'); disc(x, X, Y, 4, '#56606c');
    const y0 = up ? Y - 14 : Y + 2, tip = up ? Y - 17 : Y + 13;
    R(x, X - 2, y0, 5, 12, '#0a0d12'); R(x, X - 1, y0, 3, 12, '#b8c0cc'); R(x, X - 1, y0, 1, 12, '#e8ecf2'); R(x, X + 1, y0, 1, 12, '#6a7482');
    R(x, X - 3, tip, 7, 5, '#0a0d12'); R(x, X - 2, tip + 1, 5, 3, '#c8d0dc'); R(x, X - 2, tip + 1, 2, 1, '#ffffff');
  }
  // a small triangle pointing d ('l', 'r', 'u', 'd'), for the keycaps
  function arrow(x, X, Y, d, col) {
    for (let i = 0; i < 5; i++) {
      if (d === 'l') R(x, X + i, Y + 4 - i, 1, i * 2 + 1, col);
      else if (d === 'r') R(x, X + 4 - i, Y + 4 - i, 1, i * 2 + 1, col);
      else if (d === 'u') R(x, X + 4 - i, Y + i, i * 2 + 1, 1, col);
      else R(x, X + 4 - i, Y + 4 - i, i * 2 + 1, 1, col);
    }
  }
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; };

  // ---------- the empty cockpit: everything that never moves, with the windshield left clear. It is built for the
  // whole stage (js/art.js), not mirrored into the margins: a wider window shows more of the side windows and a
  // taller one more canopy and dashboard, with the instruments staying in the safe box. Rebuilt when the window
  // changes shape.
  let FRAME = null, frameKey = '';
  function frame() {
    const { AW, AH, AOX, AOY } = HS, key = AW + 'x' + AH;
    if (FRAME && key === frameKey) return FRAME;
    const shell = paint(AW, AH, (set) => {
      for (let Q = 0; Q < AH; Q++) for (let P = 0; P < AW; P++) {
        const X = P - AOX, Y = Q - AOY, te = topEdge(X), dt = dashTop(X), right = X >= 640, Xm = right ? 1279 - X : X, b = bayer(P, Q);
        if (Y < te) {   // canopy bar, lit along its lower lip, with a gasket against the glass
          const d = te - Y;
          set(P, Q, d < 2 ? PAL.gasket : PAL.canopy[clamp(Math.floor(3.2 - d / 10 + (b - .5)), 0, 3)]);
          continue;
        }
        if (Y >= dt) {  // glare shield, padded and stitched, then the dashboard face with a fine powder-coat grain
          const d = Y - dt, hs = hash(P, Q);
          if (d < 2) set(P, Q, PAL.shield[0]);
          else if (d < 12) {
            if (d === 5 && (P + 1) % 6 < 3) set(P, Q, hex('#4a525e'));                       // the stitching
            else if (d === 6 && (P + 1) % 6 < 3) set(P, Q, hex('#0d1014'));
            else set(P, Q, PAL.shield[clamp(Math.floor(1 + (d - 2) / 10 * 2 + b * .8), 1, 3)]);
          }
          else if (d < 13) set(P, Q, PAL.gasket);
          else if (d < 15) set(P, Q, hex('#353c47'));                                           // the lip under the shield
          else {
            const c = PAL.face[clamp(Math.floor(clamp((d - 13) / 260) * 3 + b * .95), 0, 3)], n = (hs & 15) === 0 ? -5 : (hs & 15) === 1 ? 4 : 0;
            set(P, Q, n ? [c[0] + n, c[1] + n, c[2] + n] : c);
          }
          continue;
        }
        const edge = Math.min(P, AW - 1 - P);
        if (edge < 18) { set(P, Q, edge === 17 ? PAL.wall[1] : edge % 5 === 0 ? PAL.gasket : PAL.wall[0]); continue; }   // the ribbed side walls
        const [xo, xi] = pillar(Y);
        if (Xm >= xo - 2 && Xm < xi + 2) {
          if (Xm < xo || Xm >= xi) { set(P, Q, PAL.gasket); continue; }
          let p = (Xm - xo) / (xi - xo); if (right) p = 1 - p;   // light from the left: the left face of each pillar is lit
          if ((!right && Xm === xo) || (right && Xm === xi - 1)) { set(P, Q, hex('#6e7886')); continue; }   // its lit edge
          if ((!right && Xm === xi - 1) || (right && Xm === xo)) { set(P, Q, hex('#14171c')); continue; }
          set(P, Q, PAL.pillar[clamp(Math.floor(p * 3.6 + (b - .5) * .6), 0, 3)]);
        }
        // anything else is glass
      }
    });
    const [c, x] = make(AW, AH);
    x.drawImage(shell, 0, 0);
    // canopy rivets, along the whole bar
    for (let X = -AOX + 40; X < AW - AOX - 40; X += 64) { const P = X + AOX, y = Math.round(topEdge(X) - 9) + AOY; R(x, P, y, 3, 3, '#3a414c'); R(x, P, y, 2, 1, '#56606c'); R(x, P + 2, y + 1, 1, 2, '#0f1318'); }
    // the rest is laid out in the safe box
    x.translate(AOX, AOY);
    // a taller window shows more canopy above and more dashboard below: panel seams and rivet rows break them up
    for (let Y = -24; Y > -AOY - 4; Y -= 64) {
      R(x, -AOX, Y, AW, 1, '#0d1014'); R(x, -AOX, Y + 1, AW, 1, '#2e343e');
      for (let X = -AOX + 24; X < AW - AOX; X += 48) screw(x, X, Y - 8, X >> 4);
    }
    for (let Y = 724; Y < 720 + AOY; Y += 72) {
      R(x, -AOX, Y, AW, 1, '#0d1014'); R(x, -AOX, Y + 1, AW, 1, '#2e343e');
      for (let X = -AOX + 24; X < AW - AOX; X += 48) if (Math.abs(X - YOKE.x) > 30) screw(x, X, Y + 9, X >> 4);
    }
    // rivets down each pillar
    for (const Y of [96, 176, 256, 336, 416]) { const [xo, xi] = pillar(Y), cx = Math.round((xo + xi) / 2); screw(x, cx, Y, 0); screw(x, 1279 - cx, Y, 1); }
    // the glass: a few faint streaks, fine dust, and the dashboard's own reflection low on the windshield
    x.globalAlpha = .05;
    for (const [x0, y0, x1, y1, w] of [[330, 60, 250, 300, 3], [356, 60, 280, 270, 1], [930, 70, 990, 230, 2], [960, 74, 1010, 200, 1]]) line(x, x0, y0, x1, y1, '#dfe8ff', w);
    x.globalAlpha = 1;
    const dust = noise(91);
    for (let i = 0; i < 140; i++) { const X = Math.round(240 + dust() * 800), Y = Math.round(60 + dust() * 360); x.globalAlpha = .05 + dust() * .07; R(x, X, Y, 1, 1, '#e8f0ff'); }
    for (let Y = 0; Y < 46; Y++) { x.globalAlpha = (Y / 46) * .07; R(x, 280, Math.round(dashTop(640)) - 46 + Y, 720, 1, '#9fb0c4'); }
    x.globalAlpha = 1;

    // ---------- the dashboard's hardware, left to right
    // an air vent with its louvres
    disc(x, VENT.x, VENT.y, VENT.r + 2, '#07090c'); disc(x, VENT.x - 1, VENT.y - 1, VENT.r, '#8a94a2'); disc(x, VENT.x + 1, VENT.y + 1, VENT.r, '#1a1e25');
    disc(x, VENT.x, VENT.y, VENT.r - 1, '#4a5462'); disc(x, VENT.x, VENT.y, VENT.r - 4, '#07090c');
    for (let dy = -20; dy <= 20; dy += 6) { const hw = Math.round(Math.sqrt(Math.max(0, (VENT.r - 5) ** 2 - dy * dy))); R(x, VENT.x - hw, VENT.y + dy, hw * 2, 3, '#3e4652'); R(x, VENT.x - hw, VENT.y + dy, hw * 2, 1, '#6a7482'); R(x, VENT.x - hw, VENT.y + dy + 3, hw * 2, 1, '#050608'); }
    disc(x, VENT.x, VENT.y, 4, '#0a0d12'); disc(x, VENT.x, VENT.y, 3, '#7a8492'); R(x, VENT.x - 1, VENT.y - 2, 2, 1, '#c8d0dc');
    // three toggles on a plate; the last is under a red guard
    plate(x, TOG.x, TOG.y, TOG.w, TOG.h);
    [true, true, false].forEach((up, i) => toggle(x, TOG.x + 16 + i * 23, TOG.y + 32, up));
    x.globalAlpha = .55; R(x, TOG.x + 54, TOG.y + 12, 16, 34, '#c8281e'); x.globalAlpha = 1;
    R(x, TOG.x + 54, TOG.y + 12, 16, 1, '#ff7a6a'); R(x, TOG.x + 54, TOG.y + 12, 1, 34, '#e0483c'); R(x, TOG.x + 69, TOG.y + 12, 1, 34, '#7a1410'); R(x, TOG.x + 54, TOG.y + 45, 16, 1, '#7a1410');
    // a checklist card under a clip
    R(x, CARD.x - 1, CARD.y - 1, 72, 70, '#07090c'); R(x, CARD.x, CARD.y, 70, 68, '#d6cfbb'); R(x, CARD.x, CARD.y, 70, 1, '#f2ecda'); R(x, CARD.x + 69, CARD.y, 1, 68, '#a49c88'); R(x, CARD.x, CARD.y + 67, 70, 1, '#a49c88');
    for (let i = 0; i < 6; i++) {
      const Y = CARD.y + 14 + i * 8, done = i < 3;
      R(x, CARD.x + 6, Y, 5, 5, '#6a6454'); R(x, CARD.x + 7, Y + 1, 3, 3, '#e8e2d0');
      if (done) { R(x, CARD.x + 7, Y + 2, 1, 1, '#2a7a3a'); R(x, CARD.x + 8, Y + 3, 1, 1, '#2a7a3a'); R(x, CARD.x + 9, Y + 1, 1, 2, '#2a7a3a'); R(x, CARD.x + 10, Y, 1, 1, '#2a7a3a'); }
      R(x, CARD.x + 15, Y + 2, [40, 32, 46, 28, 38, 22][i], 1, done ? '#a49c88' : '#5a5446');
    }
    R(x, CARD.x + 22, CARD.y - 4, 26, 9, '#07090c'); R(x, CARD.x + 23, CARD.y - 3, 24, 7, '#8a94a2'); R(x, CARD.x + 23, CARD.y - 3, 24, 2, '#c8d0dc'); R(x, CARD.x + 23, CARD.y + 2, 24, 2, '#4a5462'); screw(x, CARD.x + 35, CARD.y, 0);

    // the power bus: an LED, the load's icon and a toggle for each of the seven loads (switched by the engineer),
    // and the load meter under them
    plate(x, BUS.x - 6, BUS.y - 4, BUS.w + 12, BUS.h + 4);
    for (let i = 0; i < 7; i++) { const cx = BUS.x + 14 + i * 28; R(x, cx - 5, BUS.y + 3, 10, 6, '#07090c'); }
    engrave(x, 'bolt', BUS.x + 2, BUS.y + 70, '#ffd27a');
    recess(x, BUS.x + 24, BUS.y + 72, BUS.w - 30, 12, '#05080a');
    // the keycaps' plate, with the arrows that say what each key does
    plate(x, PLATE.x, PLATE.y, PLATE.w, PLATE.h, '#191d24');
    arrow(x, 193, KEY_Y + 6, 'l', '#f08c32'); arrow(x, 203, KEY_Y + 6, 'r', '#f08c32');
    arrow(x, 253, KEY_Y + 7, 'u', '#f08c32'); arrow(x, 303, KEY_Y + 6, 'd', '#f08c32');

    // the speed dial: a square instrument plate, a chrome ring, the scale
    plate(x, GAUGE.x - 78, GAUGE.y - 78, 156, 156, '#1b2027');
    disc(x, GAUGE.x, GAUGE.y, 73, '#07090c');
    disc(x, GAUGE.x - 1, GAUGE.y - 1, 71, '#9aa4b2'); disc(x, GAUGE.x + 1, GAUGE.y + 1, 71, '#14171c'); disc(x, GAUGE.x, GAUGE.y, 70, '#4a5260');
    disc(x, GAUGE.x, GAUGE.y, 67, '#2a3039'); disc(x, GAUGE.x, GAUGE.y, 66, '#0a0d12'); disc(x, GAUGE.x, GAUGE.y, GAUGE.r + 1, '#05080c');
    for (let i = 0; i <= 30; i++) {
      const a = (135 + i * 9) * Math.PI / 180, major = i % 3 === 0, r0 = major ? (i % 6 ? 53 : 50) : 57;
      line(x, Math.round(GAUGE.x + Math.cos(a) * r0), Math.round(GAUGE.y + Math.sin(a) * r0), Math.round(GAUGE.x + Math.cos(a) * 59), Math.round(GAUGE.y + Math.sin(a) * 59), major ? (i % 6 ? '#8a94a2' : '#d8dee8') : '#4a5462', major && !(i % 6) ? 2 : 1);
    }

    // the annunciator: six lamps under the glare shield, each with its icon in the lens, and the master caution
    plate(x, LAMPS.x - 6, LAMPS.y - 5, LAMPS.icons.length * (LAMPS.w + LAMPS.gap) + 8, LAMPS.h + 10, '#15191f');
    LAMPS.icons.forEach((n, i) => {
      const X = LAMPS.x + i * (LAMPS.w + LAMPS.gap);
      R(x, X - 1, LAMPS.y - 1, LAMPS.w + 2, LAMPS.h + 2, '#07090c'); R(x, X, LAMPS.y, LAMPS.w, LAMPS.h, '#1c1a1a'); R(x, X, LAMPS.y, LAMPS.w, 1, '#302c2c');
      engrave(x, n, X + LAMPS.w / 2 - 8, LAMPS.y + 2, '#4a4242');
    });
    R(x, CAUTION.x - 3, CAUTION.y - 3, CAUTION.s + 6, CAUTION.s + 7, '#07090c'); R(x, CAUTION.x - 2, CAUTION.y - 2, CAUTION.s + 4, CAUTION.s + 4, '#3a424e'); R(x, CAUTION.x - 2, CAUTION.y - 2, CAUTION.s + 4, 1, '#6a7482');
    for (let i = 0; i < CAUTION.s + 4; i += 4) { R(x, CAUTION.x - 2 + i, CAUTION.y + CAUTION.s + 2, 2, 2, '#e6b946'); R(x, CAUTION.x + i, CAUTION.y + CAUTION.s + 2, 2, 2, '#14171c'); }

    // radar, rear camera, hull
    bezel(x, RADAR.x, RADAR.y, RADAR.w, RADAR.h);
    // five push buttons under the radar
    for (let i = 0; i < 5; i++) { const X = 568 + i * 30; R(x, X - 1, 641, 22, 14, '#07090c'); R(x, X, 642, 20, 12, '#2e353f'); R(x, X + 2, 644, 16, 8, ['#2a3a2e', '#2a3346', '#3a3226', '#2a3a2e', '#3a2a2e'][i]); R(x, X + 2, 644, 16, 1, 'rgba(255,255,255,.18)'); }
    bezel(x, CAM.x, CAM.y, CAM.w, CAM.h);
    plate(x, HULL.x - 6, HULL.y, HULL.w + 12, HULL.h, '#161a20');
    engrave(x, 'hull', HULL.x + 4, HULL.y + 5);
    for (let i = 0; i < 5; i++) recess(x, HULL.x + 6 + i * 31, HULL.y + 25, 28, 28, '#07090b');
    // three knobs and a guarded switch between the hull and the throttle
    for (const [Y, a] of KNOBS) {
      for (let k = 0; k < 7; k++) { const ta = (135 + k * 45) * Math.PI / 180; R(x, Math.round(KNOB_X + Math.cos(ta) * 13), Math.round(Y + Math.sin(ta) * 13), 1, 1, '#6a7482'); }
      disc(x, KNOB_X, Y, 10, '#07090c'); disc(x, KNOB_X - 1, Y - 1, 9, '#8a94a2'); disc(x, KNOB_X + 1, Y + 1, 9, '#14171c'); disc(x, KNOB_X, Y, 8, '#3a424e');
      for (let k = 0; k < 12; k++) { const ka = k * Math.PI / 6; R(x, Math.round(KNOB_X + Math.cos(ka) * 8), Math.round(Y + Math.sin(ka) * 8), 1, 1, '#262c35'); }
      disc(x, KNOB_X, Y, 5, '#4a5462'); line(x, KNOB_X, Y, Math.round(KNOB_X + Math.cos(a) * 7), Math.round(Y + Math.sin(a) * 7), '#e8ecf2');
    }
    for (let yy = 0; yy < 34; yy++) for (let xx = 0; xx < 20; xx++) R(x, GUARD.x + xx, GUARD.y + yy, 1, 1, ((xx + yy) >> 2) % 2 ? '#14171c' : '#e6b946');
    R(x, GUARD.x - 1, GUARD.y - 1, 22, 1, '#07090c'); R(x, GUARD.x - 1, GUARD.y + 34, 22, 1, '#07090c');
    toggle(x, GUARD.x + 10, GUARD.y + 20, false);
    x.globalAlpha = .6; R(x, GUARD.x + 2, GUARD.y + 2, 16, 30, '#d2281e'); x.globalAlpha = 1;
    R(x, GUARD.x + 2, GUARD.y + 2, 16, 1, '#ff8a7a'); R(x, GUARD.x + 2, GUARD.y + 2, 1, 30, '#ff5a4a'); R(x, GUARD.x + 17, GUARD.y + 2, 1, 30, '#7a1410'); R(x, GUARD.x + 2, GUARD.y + 31, 16, 1, '#7a1410');

    // the throttle quadrant
    plate(x, THR.x, THR.y, THR.w, THR.h);
    engrave(x, 'engine', THR.x + THR.w / 2 - 8, THR.y + 5);
    const tx = THR.x + THR.w / 2;
    R(x, tx - 8, THR.y + 22, 16, THR.h - 34, '#0a0d12'); R(x, tx - 7, THR.y + 23, 14, THR.h - 36, '#020304'); R(x, tx + 5, THR.y + 23, 2, THR.h - 36, '#1a1e25');
    for (let i = 0; i <= 10; i++) { const y = Math.round(THR.y + THR.h - 24 - i * (THR.h - 48) / 10); R(x, tx - 22, y, i % 5 ? 6 : 10, 1, '#6a7482'); R(x, tx + (i % 5 ? 16 : 12), y, i % 5 ? 6 : 10, 1, '#6a7482'); }
    // fuel: a glass tube with a scale on its frame
    engrave(x, 'fuel', FUEL.x + FUEL.w / 2 - 8, FUEL.y - 26);
    bezel(x, FUEL.x, FUEL.y, FUEL.w, FUEL.h, 6);
    for (let i = 1; i < 10; i++) R(x, FUEL.x + FUEL.w + 1, Math.round(FUEL.y + FUEL.h - i * FUEL.h / 10), i % 5 ? 3 : 5, 1, '#8a94a2');
    // the comms link meter, and the crew's mission patch under it
    plate(x, LINK.x - 6, LINK.y - 22, LINK.w + 12, LINK.h + 30);
    engrave(x, 'link', LINK.x + LINK.w / 2 - 8, LINK.y - 19);
    recess(x, LINK.x - 2, LINK.y - 2, LINK.w + 2, LINK.h + 4, '#05080a');
    disc(x, PATCH.x, PATCH.y, PATCH.r + 1, '#07090c'); disc(x, PATCH.x, PATCH.y, PATCH.r, '#b8641e'); disc(x, PATCH.x - 1, PATCH.y - 1, PATCH.r - 1, '#f08c32'); disc(x, PATCH.x, PATCH.y, PATCH.r - 3, '#0e1838');
    for (const [sx, sy] of [[-11, -8], [-6, -14], [9, -12], [13, 2], [-13, 5], [4, 12]]) R(x, PATCH.x + sx, PATCH.y + sy, 1, 1, '#e8f0ff');
    disc(x, PATCH.x + 7, PATCH.y + 8, 5, '#8a4228'); disc(x, PATCH.x + 6, PATCH.y + 7, 4, '#d0703c'); R(x, PATCH.x + 4, PATCH.y + 5, 2, 1, '#f0a070');
    for (let i = 0; i < 12; i++) R(x, PATCH.x - 9 + i, PATCH.y + 6 - i, 2, 2, '#e8ecf2');
    R(x, PATCH.x + 2, PATCH.y - 7, 3, 3, '#ffffff'); R(x, PATCH.x - 10, PATCH.y + 7, 2, 2, '#ffb070'); R(x, PATCH.x - 12, PATCH.y + 9, 2, 2, '#ff6a3c');

    // the kick panel along the bottom, with its vents, and the yoke's column coming up out of the floor
    for (const vx of [372, 760]) for (let i = 0; i < 4; i++) { R(x, vx, 698 + i * 5, 148, 3, '#0a0d12'); R(x, vx, 698 + i * 5 + 3, 148, 1, '#363e49'); }
    for (let Y = 690; Y < 720 + AOY; Y++) { R(x, YOKE.x - 16, Y, 32, 1, '#1c2129'); R(x, YOKE.x - 14, Y, 6, 1, '#5a6472'); R(x, YOKE.x - 8, Y, 14, 1, '#3a424e'); R(x, YOKE.x + 6, Y, 8, 1, '#262c35'); }
    R(x, YOKE.x - 20, 692, 40, 4, '#0a0d12'); R(x, YOKE.x - 19, 692, 38, 1, '#5a6472');
    FRAME = c; frameKey = key;
    return c;
  }

  // ---------- the yoke: 13 frames, turned from -24 to +24 degrees, lit from the top left
  const yokes = new Map(), YW = 364, YH = 220, YOX = 182, YOY = 140;
  function yokeFrame(i) {
    let c = yokes.get(i);
    if (c) return c;
    const a = i * 4 * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const BAR = ['#9aa2b2', '#6a7282', '#4a5262', '#2a3040'].map(hex), GRIP = ['#4a4f58', '#2e333b', '#1f232a', '#15181d'].map(hex), HUB = ['#7a8292', '#5a6272', '#3a4252'].map(hex);
    c = outlined(paint(YW, YH, (set) => {
      for (let Y = 0; Y < YH; Y++) for (let X = 0; X < YW; X++) {
        const dx = X + .5 - YOX, dy = Y + .5 - YOY, lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca, b = bayer(X, Y);
        // the hub: round, so it does not turn, but its index mark does
        if (dx * dx + dy * dy <= 26 * 26) {
          const r = Math.hypot(dx, dy);
          if (Math.abs(lx) < 2 && ly > -24 && ly < -16) { set(X, Y, hex('#e8ecf2')); continue; }
          if (r < 10) { set(X, Y, hex(r < 4 && dx < 0 && dy < 0 ? '#ffb070' : r < 8 ? '#f08a24' : '#8a4a14')); continue; }
          set(X, Y, HUB[clamp(Math.floor(1 + (dx + dy) / 30 + (b - .5) * .5), 0, 2)]);
          continue;
        }
        // the grips: rubber, ribbed, round at the top
        const gx = lx - Math.sign(lx) * 138;
        if (Math.abs(gx) <= 12 && ly >= -62 && ly <= 12 && (ly >= -50 || gx * gx + (ly + 50) * (ly + 50) <= 144)) {
          const t = (gx + 12) / 24;
          set(X, Y, (Math.round(ly) & 7) === 0 && ly > -46 ? GRIP[3] : GRIP[clamp(Math.floor(t * 3.4 + (b - .5) * .4), 0, 3)]);
          continue;
        }
        // the bar between them
        if (Math.abs(lx) <= 138 && Math.abs(ly) <= 8) set(X, Y, BAR[clamp(Math.floor((ly + 8) / 16 * 3.6 + (b - .5) * .4), 0, 3)]);
      }
    }));
    yokes.set(i, c);
    return c;
  }

  // ---------- the view ahead
  const view = { F: null, t: 0, wv: 0, yaw: 0, yoke: 0, stars: [] };
  // stars start anywhere that projects onto the stage at the far plane (z = 1)
  const spawn = (s, r = Math.random) => { s.x = (r() * 2 - 1) * (HS.AW / 520 + .2); s.y = (r() * 2 - 1) * (HS.AH / 520 + .2); s.b = .45 + r() * .55; return s; };
  function reset(F) {
    const r = noise(57), n = Math.min(900, Math.round(360 * HS.AW * HS.AH / (1280 * 720)));
    Object.assign(view, { F, t: F.t, wv: 0, yaw: 0, yoke: 0 });
    view.stars = Array.from({ length: n }, () => Object.assign(spawn({}, r), { z: .05 + r() * .95 }));
  }
  // stars fly out of the point ahead; their streaks grow with speed into the warp tunnel
  function starfield(x, vx, vy, dt, speed, eng, cm) {
    const wv = view.wv, v = (eng ? .05 + speed * .012 : .025) * (1 + wv * (cm ? 1.5 : 6)), f0 = 260 * (1 + wv * .18);
    const roll = -view.yaw * .07, cr = Math.cos(roll), sr = Math.sin(roll);
    const tail = Math.min(cm ? .04 : .7, v * .12 + wv * wv * (cm ? .02 : .6));
    const col = mix([236, 240, 255], [140, 200, 255], wv);
    // nine batches: three depths (line width) by three brightnesses
    const paths = Array.from({ length: 9 }, () => []);
    for (const s of view.stars) {
      s.z -= v * dt; s.x += view.yaw * dt * .35;
      if (s.z < .03) { spawn(s); s.z = 1; continue; }
      const X = s.x / s.z * f0, Y = s.y / s.z * f0, ax = vx + X * cr - Y * sr, ay = vy + X * sr + Y * cr;
      if (ax < HS.AX0 - 40 || ax > HS.AX1 + 40 || ay < HS.AY0 - 40 || ay > HS.AY1 + 40) { spawn(s); s.z = 1; continue; }
      const zt = s.z + tail, Xt = s.x / zt * f0, Yt = s.y / zt * f0;
      paths[(s.z < .22 ? 2 : s.z < .55 ? 1 : 0) * 3 + (s.b < .63 ? 0 : s.b < .82 ? 1 : 2)].push(Math.round(vx + Xt * cr - Yt * sr), Math.round(vy + Xt * sr + Yt * cr), Math.round(ax), Math.round(ay));
    }
    x.save(); x.lineCap = 'square';
    paths.forEach((p, i) => {
      if (!p.length) return;
      const k = (i / 3) | 0, b = [.55, .73, .91][i % 3];
      x.lineWidth = [1, 1.5, 2][k];
      x.strokeStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${[.45, .75, 1][k] * b})`;
      x.beginPath();
      for (let j = 0; j < p.length; j += 4) { x.moveTo(p[j], p[j + 1]); x.lineTo(p[j + 2], p[j + 3]); }
      x.stroke();
    });
    x.restore();
  }
  // debris depth: q units before the ship to a scale on screen. A rock hits when it is about 8 to 11 q away (the
  // ship's length, js/flight.js), so it is about twice its old size by then; one that misses flies off the side
  const depth = (z) => 8 / (z - 4);
  function brackets(x, X, Y, s, col) {
    X = Math.round(X); Y = Math.round(Y);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const cx = X + sx * s, cy = Y + sy * s;
      R(x, sx < 0 ? cx : cx - 7, cy - (sy < 0 ? 0 : 1), 8, 2, col); R(x, cx - (sx < 0 ? 0 : 1), sy < 0 ? cy : cy - 7, 2, 8, col);
    }
  }

  // o: { dest, engine, flame }. Returns the warning lamps, 0 off, 1 amber, 2 red (blinks), 3 green, 4 cyan.
  FA.pilot = (x, F, o) => {
    if (view.F !== F) reset(F);
    const t = F.t, cm = calm(), m = F.m, S = HS.S, live = F.blackout <= 0, eng = o.engine;
    const dt = clamp(t - view.t, 0, .1); view.t = t;
    // how hard the ship is turning, -1..1, and the warp, 0..1: speed above the transfer band, and more while the engine pushes
    const turnMax = Math.max(1, m.prop.turn * (1 - .45 * Math.min(1, m.heavy)));
    view.yoke += (clamp(F.vx / turnMax, -1, 1) - view.yoke) * Math.min(1, dt * 8);
    view.yaw += (view.yoke - view.yaw) * Math.min(1, dt * 3);
    const want = eng ? clamp(clamp((F.speed - 7.4) / 2.2) * .7 + (F.thrust > 0 ? .35 : F.thrust < 0 ? -.2 : 0)) : 0;
    view.wv += (want - view.wv) * Math.min(1, dt * (want > view.wv ? 1.6 : 2.4));
    const wv = view.wv, jit = cm ? 0 : wv * 3;
    const vx = VP[0] - view.yaw * 90 + (Math.random() - .5) * jit, vy = VP[1] + (Math.random() - .5) * jit;

    // deep space, the stars, the destination ahead
    x.imageSmoothingEnabled = false;
    R(x, HS.AX0, HS.AY0, HS.AW, HS.AH, '#04060f');
    x.drawImage(background(), Math.round(-view.yaw * 24), 0); HS.bleedFrom(background());
    starfield(x, vx, vy, dt, F.speed, eng, cm);
    const prog = clamp(F.prog), dr = Math.max(6, Math.round((6 + Math.pow(prog, 1.4) * 100) / 2) * 2);
    const px = Math.round(vx + (80 - F.x) * 1.5), py = Math.round(vy - 40);
    if (o.dest === 'mars' && dr >= 20) { const ph = L.phobosSprite(); x.drawImage(ph, px - dr - 34, py + Math.round(dr * .45)); }
    const ps = planetSprite(o.dest, dr);
    x.drawImage(ps, px - (ps.width >> 1), py - (ps.height >> 1));

    // debris, far ones first; each is drawn at its own size until it is closer than the nose, then scaled up
    for (const rk of F.rocks.slice().sort((a, b) => a.y - b.y)) {
      const z = 63 - rk.y;
      if (z < 4.6) continue;
      const sc = depth(z), b = clamp(Math.round(rk.s * 2), 6, 12), R0 = b * 4, v = Math.floor(rk.s * 997) % 2;
      const f = Math.floor((((rk.rot % TAU) + TAU) % TAU) / TAU * 12) % 12, hy = ((Math.floor(rk.s * 7919) % 100) / 100 - .5) * 70 + 24;
      const sx = vx + (rk.x - F.x) * 8 * sc, sy = vy + hy * sc, r = R0 * sc * .9;
      const spr = r <= R0 ? rockFrame(b, v, f, Math.max(2, Math.round(r))) : rockFrame(b, v, f), k = r <= R0 ? 1 : r / R0;
      const w = Math.round(spr.width * k), h = Math.round(spr.height * k);
      x.drawImage(spr, Math.round(sx - w / 2), Math.round(sy - h / 2), w, h);
    }
    // where warned debris will come from, far ahead
    if (cm || Math.floor(t * 6) % 2) for (const pd of F.pending) if (pd.warned) brackets(x, vx + ((pd.aimed ? F.x : pd.x) - F.x) * 8 * depth(70), vy + 12, 12, '#ff5a50');

    // the warp: a glow ahead, rings rushing past, the glass tinted blue
    if (wv > .02) {
      glow(x, vx, vy, 110, '170,215,255', wv * .55);
      if (!cm && wv > .3) {
        x.save(); x.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          const k = (t * (.5 + wv) + i / 5) % 1, r = 20 + k * k * 760;
          x.strokeStyle = `rgba(120,200,255,${((wv - .3) / .7) * (1 - k) * .35})`;
          x.beginPath(); x.ellipse(vx, vy, r, r * .62, 0, 0, TAU); x.stroke();
        }
        x.restore();
      }
      x.fillStyle = `rgba(60,120,255,${wv * .08})`; x.fillRect(HS.AX0, HS.AY0, HS.AW, HS.AH);
    }
    // a hull breach cracks the windshield until it is welded
    if (F.breach) {
      x.save(); x.strokeStyle = 'rgba(225,238,255,.5)'; x.lineWidth = 1; x.beginPath();
      F.breach.pts.forEach(([bx, by], i) => {
        const X = bx * 2 - 40, Y = 60 + (by - 96) * 1.6;
        if (i) x.lineTo(X, Y); else x.moveTo(X, Y);
        if (i % 2) { x.moveTo(X, Y); x.lineTo(X + (i % 4 ? 14 : -10), Y + (i % 3 ? -16 : 12)); x.moveTo(X, Y); }
      });
      x.stroke(); x.restore();
    }

    x.drawImage(frame(), HS.AX0, HS.AY0);

    // ---------- the instruments, live while the bus has power
    const blink = (hz) => cm || Math.floor(t * hz) % 2;
    const lamps = [
      F.rocks.length || F.pending.some((p) => p.warned) ? 2 : 0,
      F.link < 60 ? 2 : 0,
      !eng ? 2 : F.thrust > 0 ? 3 : 0,
      S.fuel < 20 ? 2 : S.fuel < 40 ? 1 : 0,
      F.breach ? 2 : S.hull < 60 ? 1 : 0,
      wv > .55 ? 4 : 0
    ].map((v) => (live ? v : 0));
    const LAMP = [null, ['#ffb84a', '255,184,74', '#5a3a0a'], ['#ff5a50', '255,90,80', '#5a1010'], ['#6edc82', '110,220,130', '#14401e'], ['#78d8ff', '120,216,255', '#0e3a52']];
    lamps.forEach((v, i) => {
      if (!v || (v === 2 && !blink(4))) return;
      const X = LAMPS.x + i * (LAMPS.w + LAMPS.gap), [col, rgb, ink] = LAMP[v];
      R(x, X, LAMPS.y, LAMPS.w, LAMPS.h, col); R(x, X, LAMPS.y, LAMPS.w, 2, 'rgba(255,255,255,.35)'); R(x, X, LAMPS.y + LAMPS.h - 2, LAMPS.w, 2, 'rgba(0,0,0,.18)');
      x.drawImage(HS.icon(LAMPS.icons[i], ink, { flat: true }), X + LAMPS.w / 2 - 8, LAMPS.y + 2);
      glow(x, X + LAMPS.w / 2, LAMPS.y + LAMPS.h / 2, 34, rgb, .35);
    });
    // master caution: lit red while any lamp is red
    const caution = lamps.includes(2), C0 = CAUTION;
    R(x, C0.x, C0.y, C0.s, C0.s, caution && blink(2) ? '#ff4a3c' : '#4a1612'); R(x, C0.x, C0.y, C0.s, 2, caution && blink(2) ? '#ffb0a0' : '#6a2620'); R(x, C0.x, C0.y + C0.s - 2, C0.s, 2, '#2a0a08');
    R(x, C0.x + 5, C0.y + 7, C0.s - 10, 2, 'rgba(0,0,0,.35)'); R(x, C0.x + 5, C0.y + 12, C0.s - 10, 2, 'rgba(0,0,0,.35)'); R(x, C0.x + 5, C0.y + 17, C0.s - 10, 2, 'rgba(0,0,0,.35)');
    if (caution && blink(2)) glow(x, C0.x + C0.s / 2, C0.y + C0.s / 2, 40, '255,70,50', .45);

    // the power bus: each load's LED, its icon lit while it is on, and its toggle
    F.loads.forEach((l, i) => {
      const cx = BUS.x + 14 + i * 28, on = l.on && live;
      R(x, cx - 4, BUS.y + 4, 8, 4, on ? '#6edc82' : l.on ? '#1e3a24' : '#9a2a2a'); if (on) { R(x, cx - 4, BUS.y + 4, 8, 1, '#d8ffe0'); glow(x, cx, BUS.y + 6, 10, '110,220,130', .35); }
      x.drawImage(HS.icon(HS.LOAD_ICON[l.key] || 'bolt', '#06080b', { flat: true }), cx - 7, BUS.y + 15);
      x.drawImage(HS.icon(HS.LOAD_ICON[l.key] || 'bolt', on ? '#c8d6e4' : '#3e4652', { flat: true }), cx - 8, BUS.y + 14);
      toggle(x, cx, BUS.y + 52, l.on);
    });
    // the load meter: how much of the supply the switched-on loads draw
    const frac = clamp(F.frac || 0, 0, 1.2), segs = 14;
    for (let i = 0; i < segs; i++) {
      const lit = live && frac * segs / 1.2 > i, X = BUS.x + 27 + i * 11, k = i / segs * 1.2;
      R(x, X, BUS.y + 75, 9, 6, lit ? (k > 1 ? '#ff5a50' : k > .9 ? '#ffb84a' : '#6edc82') : '#16201a');
    }

    // the keycaps sink while their key is held
    const keys = KEYS.map((kc) => {
      const down = !!(HS.key && HS.key(...kc.codes)), o = down ? 2 : 0, X = kc.x, Y = KEY_Y + o, s = KEY_S;
      R(x, X - 1, KEY_Y - 1, s + 2, s + 4, '#07090c');
      R(x, X, Y, s, s - o + 2, '#7a8292'); R(x, X + 1, Y, s - 2, s - 4, down ? '#d0d6de' : '#e4e8ee'); R(x, X + 1, Y, s - 2, 1, '#ffffff'); R(x, X + 1, Y, 1, s - 4, '#ffffff');
      R(x, X + s - 2, Y + 1, 1, s - 5, '#aab2c0'); R(x, X + 1, Y + s - 4, s - 2, 1, '#aab2c0');
      if (down) glow(x, X + s / 2, Y + s / 2, 22, '255,150,60', .25);
      return down;
    });

    // the yoke turns with the ship; its thumb buttons fire the attitude thrusters
    const yi = Math.round(view.yoke * 6), yk = yokeFrame(yi), ya = yi * 4 * Math.PI / 180;
    x.drawImage(yk, YOKE.x - YOX - 1, YOKE.y - YOY - 1);
    for (const side of [-1, 1]) {
      const lx = side * 138, ly = -58, X = YOKE.x + lx * Math.cos(ya) - ly * Math.sin(ya), Y = YOKE.y + lx * Math.sin(ya) + ly * Math.cos(ya);
      const on = live && eng && view.yoke * side > .15;
      R(x, Math.round(X) - 4, Math.round(Y) - 2, 8, 5, on ? '#ffd27a' : '#6a3a16'); R(x, Math.round(X) - 4, Math.round(Y) - 2, 8, 1, on ? '#fff6d8' : '#8a4a14');
      if (on) glow(x, X, Y, 16, '255,180,80', .5);
    }
    if (!live) { finish(x, F, live, cm); warmRocks(2); return { lamps, wv, keys }; }

    // speed: the transfer band in green, the needle in the pilot's orange
    const ang = (s) => (135 + 270 * clamp((s - 6.5) / 3)) * Math.PI / 180;
    x.save(); x.strokeStyle = '#46c86e'; x.lineWidth = 5; x.beginPath(); x.arc(GAUGE.x, GAUGE.y, 56, ang(F.target - .25), ang(F.target + .25)); x.stroke(); x.restore();
    const na = ang(F.speed + (cm ? 0 : Math.sin(t * 9) * .008));
    line(x, GAUGE.x, GAUGE.y, Math.round(GAUGE.x + Math.cos(na) * 50), Math.round(GAUGE.y + Math.sin(na) * 50), '#ff7a3c', 2);
    disc(x, GAUGE.x, GAUGE.y, 5, '#c8d0dc'); R(x, GAUGE.x - 2, GAUGE.y - 2, 2, 2, '#ffffff');

    // radar: the old top-down lane, the ship at the bottom, debris coming down at it
    const RX = RADAR.x + RADAR.w / 2, RY = RADAR.y + RADAR.h - 12, rq = (q) => Math.round(RX + (q - F.x) * 1.1);
    x.save(); x.beginPath(); x.rect(RADAR.x, RADAR.y, RADAR.w, RADAR.h); x.clip();
    R(x, RADAR.x, RADAR.y, RADAR.w, RADAR.h, '#03140d');
    x.strokeStyle = 'rgba(70,220,140,.22)'; x.lineWidth = 1;
    for (const r of [40, 80, 120]) { x.beginPath(); x.arc(RX, RY, r, Math.PI, TAU); x.stroke(); }
    for (const w of [12, 148]) R(x, rq(w), RADAR.y, 1, RADAR.h, 'rgba(70,220,140,.45)');
    if (!cm) for (let i = 0; i < 10; i++) {
      const a = Math.PI + (((t * .7) % 1) * Math.PI) - i * .035;
      x.strokeStyle = `rgba(90,255,160,${.3 - i * .03})`; x.beginPath(); x.moveTo(RX, RY); x.lineTo(RX + Math.cos(a) * 200, RY + Math.sin(a) * 200); x.stroke();
    }
    for (const rk of F.rocks) { const X = rq(rk.x), Y = Math.round(RY - (63 - rk.y) * 1.6), s = rk.s > 4.5 ? 4 : 3; R(x, X - 1, Y - 1, s, s, '#ff6a50'); }
    if (blink(5)) for (const pd of F.pending) if (pd.warned) R(x, rq(pd.aimed ? F.x : pd.x) - 3, RADAR.y + 3, 6, 3, '#ffb84a');
    for (let i = 0; i < 6; i++) R(x, RX - i, RY - 5 + i, i * 2 + 1, 1, '#9affc8');
    for (let Y = RADAR.y; Y < RADAR.y + RADAR.h; Y += 3) R(x, RADAR.x, Y, RADAR.w, 1, 'rgba(0,0,0,.25)');
    x.restore();

    // rear camera: Earth falling away, and the engine's glow under the tail
    x.save(); x.beginPath(); x.rect(CAM.x, CAM.y, CAM.w, CAM.h); x.clip();
    R(x, CAM.x, CAM.y, CAM.w, CAM.h, '#04070f');
    const ec = earthCap(), es = .62 - .5 * Math.sqrt(prog), ew = Math.round(ec.c.width * es), eh = Math.round(ec.c.height * es);
    x.imageSmoothingEnabled = true;   // a camera picture, not pixel art
    x.drawImage(ec.c, Math.round(CAM.x + CAM.w / 2 - ew / 2), Math.round(CAM.y + CAM.h - eh * .8), ew, eh);
    x.imageSmoothingEnabled = false;
    if (eng) glow(x, CAM.x + CAM.w / 2, CAM.y + CAM.h + 4, F.thrust > 0 ? 46 : 30, o.flame, F.thrust > 0 ? .55 : .3);
    for (let Y = CAM.y; Y < CAM.y + CAM.h; Y += 2) R(x, CAM.x, Y, CAM.w, 1, 'rgba(0,0,0,.22)');
    R(x, CAM.x + 6, CAM.y + 6, 5, 5, blink(1.5) ? '#ff4a3c' : '#401010');
    x.restore();

    // hull: one block per section, as the engineer's panel has them
    F.sections.forEach((v, i) => {
      const breach = F.breach && F.breach.sec === i, X = HULL.x + 8 + i * 31, Y = HULL.y + 28;
      const [lo, mid, hi] = breach ? (blink(5) ? ['#a82a24', '#ff5a50', '#ffb0a0'] : ['#3a1210', '#7a2a26', '#9a4a44']) : v >= 100 ? ['#2a7a44', '#46c86e', '#9af0b4'] : v >= 60 ? ['#8a6a1e', '#e6b946', '#fff0a0'] : ['#7a2222', '#dc4646', '#ff9a8a'];
      R(x, X, Y, 24, 22, mid); R(x, X, Y, 24, 2, hi); R(x, X, Y, 2, 22, hi); R(x, X, Y + 19, 24, 3, lo); R(x, X + 22, Y + 2, 2, 20, lo);
      if (v < 100 && !breach) { line(x, X + 5, Y + 5, X + 12, Y + 12, lo); line(x, X + 12, Y + 12, X + 18, Y + 14, lo); R(x, X + 6, Y + 5, 1, 1, hi); }   // a scratch
    });

    // throttle: the lever sits at the ship's speed, with the transfer band marked; it is pushed while you speed up
    const tx = THR.x + THR.w / 2, ty = (s) => Math.round(THR.y + THR.h - 24 - clamp((s - 5) / 5) * (THR.h - 48));
    R(x, tx - 7, ty(F.target + .25), 14, Math.max(2, ty(F.target - .25) - ty(F.target + .25)), 'rgba(70,200,110,.55)');
    const hy = ty(F.speed) - (F.thrust > 0 ? 3 : F.thrust < 0 ? -3 : 0);
    R(x, tx - 2, hy, 4, THR.y + THR.h - 14 - hy, '#8a94a2');
    R(x, tx - 22, hy - 9, 44, 18, '#0a0d12'); R(x, tx - 21, hy - 8, 42, 16, '#c8641e'); R(x, tx - 21, hy - 8, 42, 3, '#f0a050'); R(x, tx - 21, hy + 5, 42, 3, '#8a4a14');
    if (F.thrust > 0) glow(x, tx, hy, 30, wv > .55 ? '120,216,255' : '255,160,70', .45);

    // fuel, with bubbles rising while it flows
    const fh = Math.round((FUEL.h - 4) * clamp(S.fuel / 100)), fcol = S.fuel < 20 ? '#dc4646' : '#f08a24';
    R(x, FUEL.x + 2, FUEL.y + FUEL.h - 2 - fh, FUEL.w - 4, fh, fcol); R(x, FUEL.x + 2, FUEL.y + FUEL.h - 2 - fh, 4, fh, 'rgba(255,255,255,.25)');
    if (eng && F.thrust && !cm) for (let i = 0; i < 4; i++) { const k = (t * .8 + i / 4) % 1, Y = Math.round(FUEL.y + FUEL.h - 4 - k * fh); if (fh > 8) R(x, FUEL.x + 8 + ((i * 7) % 14), Y, 2, 2, '#ffd8a8'); }

    // comms link strength, five bars
    for (let i = 0; i < 5; i++) {
      const h = 12 + i * 12, X = LINK.x + i * 11, on = F.link > (i + 1) * 19;
      R(x, X, LINK.y + LINK.h - h, 8, h, on ? '#3fc6d9' : '#16222a'); if (on) { R(x, X, LINK.y + LINK.h - h, 8, 2, '#b8f4ff'); R(x, X + 6, LINK.y + LINK.h - h + 2, 2, h - 2, '#228a9a'); }
    }
    if (F.link >= 60) glow(x, LINK.x + LINK.w / 2, LINK.y + LINK.h - 20, 40, '63,198,217', .12);

    // the screens light the dashboard round them
    glow(x, RADAR.x + RADAR.w / 2, RADAR.y + RADAR.h / 2, 150, '60,220,140', .07);
    glow(x, CAM.x + CAM.w / 2, CAM.y + CAM.h / 2, 110, '110,160,255', .05);
    finish(x, F, live, cm);
    warmRocks(2);
    return { lamps, wv, keys };
  };

  // ---------- the last layer: glass glints over the instruments, and the bobblehead on the glare shield
  const bob = { a: 0, v: 0, yaw: 0, hits: 0, t: 0 };
  function glint(x, X, Y, w, h) {
    x.save(); x.beginPath(); x.rect(X, Y, w, h); x.clip();
    x.fillStyle = 'rgba(220,235,255,.06)'; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + w * .42, Y); x.lineTo(X, Y + h * .9); x.closePath(); x.fill();
    x.fillStyle = 'rgba(220,235,255,.05)'; x.beginPath(); x.moveTo(X + w * .5, Y); x.lineTo(X + w * .58, Y); x.lineTo(X + w * .1, Y + h); x.lineTo(X + w * .02, Y + h); x.closePath(); x.fill();
    x.restore();
  }
  // the bobblehead astronaut: a white suit on a spring, its gold visor catching the light
  let BODY = null, HEAD = null;
  function bobSprites() {
    if (BODY) return;
    const SUIT = ['#8a92a2', '#aab2c0', '#dfe3ea', '#ffffff'];
    BODY = L.sprite(18, 20, (x) => {
      R(x, 0, 16, 18, 4, '#3a424e'); R(x, 0, 16, 18, 1, '#6a7482'); R(x, 0, 19, 18, 1, '#1a1e25');           // the base
      R(x, 4, 4, 10, 12, SUIT[2]); R(x, 4, 4, 2, 12, SUIT[3]); R(x, 11, 4, 3, 12, SUIT[1]); R(x, 4, 14, 10, 2, SUIT[0]);
      R(x, 1, 5, 3, 8, SUIT[2]); R(x, 1, 5, 1, 8, SUIT[3]); R(x, 14, 5, 3, 8, SUIT[1]); R(x, 1, 12, 3, 2, SUIT[0]); R(x, 14, 12, 3, 2, SUIT[0]);   // arms
      R(x, 6, 7, 6, 4, '#f08c32'); R(x, 6, 7, 6, 1, '#ffb070'); R(x, 7, 9, 1, 1, '#5a96f5'); R(x, 9, 9, 1, 1, '#e6b946');                        // the chest pack
      R(x, 6, 2, 6, 2, '#5a6272'); R(x, 6, 2, 6, 1, '#8a92a2');                                                                                // the neck ring
    }, HS.ART_OUT);
    HEAD = L.sprite(20, 18, (x) => {
      for (let y = 0; y < 18; y++) for (let X = 0; X < 20; X++) {
        const nx = (X + .5 - 10) / 10, ny = (y + .5 - 9) / 9, rr = nx * nx + ny * ny;
        if (rr > 1) continue;
        const lum = -nx * .5 - ny * .6 + Math.sqrt(1 - rr) * .5;
        x.fillStyle = lum > .62 ? '#ffffff' : lum > .3 ? '#dfe3ea' : lum > 0 ? '#aab2c0' : '#8a92a2'; x.fillRect(X, y, 1, 1);
      }
      R(x, 4, 6, 12, 8, '#2a1a08'); R(x, 5, 6, 10, 7, '#c8901e'); R(x, 5, 6, 10, 2, '#ffe08a'); R(x, 5, 11, 10, 2, '#7a4e10'); R(x, 6, 7, 2, 2, '#fffbe8');   // the visor
      R(x, 9, 0, 2, 1, '#e8ecf2');
    }, HS.ART_OUT);
  }
  function finish(x, F, live, cm) {
    glint(x, RADAR.x, RADAR.y, RADAR.w, RADAR.h); glint(x, CAM.x, CAM.y, CAM.w, CAM.h);
    // the dial's glass: a curved highlight at the top left
    x.save(); x.strokeStyle = 'rgba(230,240,255,.16)'; x.lineWidth = 3; x.beginPath(); x.arc(GAUGE.x, GAUGE.y, 58, Math.PI * 1.08, Math.PI * 1.38); x.stroke();
    x.strokeStyle = 'rgba(230,240,255,.08)'; x.lineWidth = 2; x.beginPath(); x.arc(GAUGE.x, GAUGE.y, 52, Math.PI * 1.12, Math.PI * 1.3); x.stroke(); x.restore();
    R(x, FUEL.x + FUEL.w - 6, FUEL.y + 4, 2, FUEL.h - 8, 'rgba(230,240,255,.12)');
    // the bobblehead nods with every turn and hit: a damped spring driven by the change in yaw
    bobSprites();
    const dt = clamp(F.t - bob.t, 0, .1); bob.t = F.t;
    const hits = HS.S.hits || 0;
    if (!cm) {
      if (hits > bob.hits) bob.v += (Math.random() < .5 ? -1 : 1) * 9;
      bob.v += ((view.yaw - bob.yaw) * -60 - bob.a * 90 - bob.v * 4.5) * dt; bob.a = clamp(bob.a + bob.v * dt, -1.2, 1.2);
    } else bob.a = bob.v = 0;
    bob.hits = hits; bob.yaw = view.yaw;
    const X = BOB.x, base = Math.round(dashTop(X)) + 1, hx = Math.round(X + bob.a * 6), hy = base - 44 + Math.round(Math.abs(bob.a) * 2);
    x.drawImage(BODY, X - 10, base - 22);
    for (let k = 0; k < 8; k++) { const sx = Math.round(X + (hx - X) * k / 8) + (k % 2 ? 0 : -1); R(x, sx - 1, base - 19 - k, 4, 1, '#0a0d12'); R(x, sx, base - 19 - k, 2, 1, k % 2 ? '#8a94a2' : '#c8d0dc'); }
    x.drawImage(HEAD, hx - 11, hy - 1);
  }
})();
