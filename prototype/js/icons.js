// Homestead icons: 16 x 16 glyphs on the 1280 art grid (src/ui/ART-RULES.md: HUD icons are 16 x 16 on a whole-pixel
// grid, lit from the top left, with a 1 px dark outline). Each glyph is a shape over the 16 x 16 cells, so one glyph
// serves the HUD, tinted by state, and the cockpit's lamp lenses and switch plates, flat and engraved.
//   HS.icon(name, col)                  an 18 x 18 canvas: shaded in col, outlined
//   HS.icon(name, col, { flat: true })  a bare 16 x 16 mask in col, for engraving into art
//   HS.drawIcon(name, x, y, col)        on the HUD in 640-space (one unit is two art pixels), top left at x, y
(() => {
  const HS = window.HS, L = HS.liftoff, { make, hex, mix, sprite, clamp, bayer } = L;

  // shapes, tested at each cell's centre
  const disc = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  const ring = (cx, cy, r0, r1) => (x, y) => { const d = Math.hypot(x - cx, y - cy); return d >= r0 && d <= r1; };
  const box = (x0, y0, x1, y1) => (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
  const seg = (x0, y0, x1, y1, w) => (x, y) => {
    const dx = x1 - x0, dy = y1 - y0, t = clamp(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1));
    return Math.hypot(x - x0 - dx * t, y - y0 - dy * t) <= w / 2;
  };
  const poly = (pts) => (x, y) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const any = (...f) => (x, y) => f.some((g) => g(x, y));
  const cut = (a, ...b) => (x, y) => a(x, y) && !b.some((g) => g(x, y));
  const wave = (c, a = 1.3) => (x, y) => y >= 2 && y <= 14 && Math.abs(x - (c + Math.sin(y * .9) * a)) <= .95;

  // name: [solid, dark detail, light detail]
  const G = {
    // the four stations
    pilot: [any(seg(2, 2.5, 2, 9.5, 2.6), seg(14, 2.5, 14, 9.5, 2.6), seg(2, 10, 14, 10, 2.4), disc(8, 9.5, 3.4), box(7, 12, 9, 16)), disc(8, 9.5, 1.2), any(box(1, 3, 2, 8), box(13, 3, 14, 8))],
    eng: [cut(any(seg(3.5, 12.5, 10, 6, 3), disc(3.5, 12.5, 1.9), disc(11, 5, 4.2)), seg(11, 5, 16, 0, 2.8), disc(11, 5, 1.2))],
    comms: [any(cut(disc(6.5, 8.5, 6), disc(10, 5, 5.6)), seg(6, 9, 11.5, 3.5, 1.2), disc(12, 3, 1.6), box(5, 13, 8, 15), box(3, 14, 10, 15))],
    sci: [any(box(6, 1, 10, 6), box(5, 1, 11, 2), poly([[6, 5.5], [10, 5.5], [14.2, 13], [13.2, 14.5], [2.8, 14.5], [1.8, 13]])), null, poly([[3.6, 10.5], [12.4, 10.5], [13.6, 13], [12.8, 13.6], [3.2, 13.6], [2.4, 13]])],
    // ship status
    o2: [any(disc(6, 10, 4.6), disc(12, 4.5, 2.6), disc(12.5, 12, 1.6), disc(4, 3.5, 1.4)), null, any(disc(4.6, 8.6, .9), disc(11.3, 3.6, .6))],
    hull: [poly([[2, 2], [14, 2], [14, 7.5], [12, 11], [8, 15], [4, 11], [2, 7.5]]), null, poly([[3, 3], [8, 3], [8, 13.6], [5, 10.4], [3, 7.2]])],
    fuel: [any(disc(8, 10, 4.6), poly([[8, 1], [12.3, 8.6], [3.7, 8.6]])), null, seg(5.5, 9.5, 5.5, 11.5, 1)],
    time: [any(ring(8, 8, 5.2, 7.2), seg(8, 8, 8, 3.8, 1.6), seg(8, 8, 11, 9.5, 1.6))],
    heavy: [any(cut(ring(8, 4.6, 1.6, 3.2), box(0, 6, 16, 16)), poly([[4, 6], [12, 6], [14.6, 14.6], [1.4, 14.6]])), seg(6, 10, 10, 10, 1.2)],
    ship: [any(poly([[2, 6], [11, 6], [14.6, 8], [11, 10], [2, 10]]), poly([[2, 6], [6, 6], [3.5, 2.5], [1, 2.5]]), poly([[2, 10], [6, 10], [3.5, 13.5], [1, 13.5]])), disc(10, 8, 1)],
    // the cockpit's warning lamps
    debris: [poly([[4, 3], [9, 1.6], [13, 3.6], [15, 9], [12, 14], [6, 14.4], [1.6, 11], [1.2, 6]]), any(disc(10, 6.5, 1.7), disc(5.5, 10, 1.2), disc(11, 11.5, 1))],
    link: [any(disc(3.5, 12.5, 1.9), ...[[4.2, 5.8], [7.8, 9.4], [11.4, 13]].map(([a, b]) => cut(ring(3.5, 12.5, a, b), (x, y) => x < 2.6 || y > 13.4)))],
    engine: [any(box(5, 1, 11, 4), box(6.5, 4, 9.5, 5), poly([[6, 5], [10, 5], [13.6, 10], [2.4, 10]]), disc(8, 12.8, 1.9), poly([[6.2, 12.8], [9.8, 12.8], [8, 15.8]])), box(2, 9, 14, 10), disc(8, 12.8, .9)],
    warp: [any(seg(2, 8.5, 8, 2.5, 2.6), seg(8, 2.5, 14, 8.5, 2.6), seg(2, 14, 8, 8, 2.6), seg(8, 8, 14, 14, 2.6))],
    // the power bus loads
    bulb: [any(disc(8, 6.5, 5), poly([[5, 9], [11, 9], [10, 11], [6, 11]]), box(6, 11, 10, 14), box(7, 14, 9, 15)), box(6, 12, 10, 13), disc(6, 5, 1.1)],
    snow: [any(seg(8, 1.5, 8, 14.5, 1.6), seg(2.4, 4.7, 13.6, 11.3, 1.6), seg(2.4, 11.3, 13.6, 4.7, 1.6), disc(8, 8, 2))],
    heat: [any(wave(4), wave(8), wave(12))],
    // the power bus itself, and the speed the pilot holds
    bolt: [poly([[9.6, .8], [2.6, 9.4], [7.2, 9.4], [5.6, 15.4], [13.4, 6.2], [8.8, 6.2], [10.6, .8]]), null, poly([[9.2, 2], [4.4, 8.2], [6.4, 8.2]])],
    target: [any(ring(8, 8, 4.6, 6.4), disc(8, 8, 1.7), box(7.2, .4, 8.8, 3.6), box(7.2, 12.4, 8.8, 15.6), box(.4, 7.2, 3.6, 8.8), box(12.4, 7.2, 15.6, 8.8))]
  };
  // the loads on the power bus, by their key in js/flight.js
  HS.LOAD_ICON = { comms: 'comms', payload: 'sci', engine: 'engine', life: 'o2', pump: 'snow', lights: 'bulb', heater: 'heat' };

  const cache = new Map();
  HS.icon = (name, col, o = {}) => {
    const k = name + col + (o.flat ? 'f' : ''); let c = cache.get(k);
    if (c) return c;
    const [solid, dark, light] = G[name], base = hex(col);
    const at = (x, y) => x >= 0 && y >= 0 && x < 16 && y < 16 && solid(x + .5, y + .5);
    const draw = (x) => {
      for (let y = 0; y < 16; y++) for (let X = 0; X < 16; X++) {
        if (!at(X, y)) continue;
        let c3 = base;
        if (!o.flat) {
          if (dark && dark(X + .5, y + .5)) c3 = mix(base, [8, 14, 26], .62);
          else if (light && light(X + .5, y + .5)) c3 = mix(base, [255, 255, 255], .5);
          else if (!at(X, y - 1)) c3 = mix(base, [255, 255, 255], .38);             // lit from the top
          else if (!at(X, y + 1) || !at(X + 1, y)) c3 = mix(base, [8, 14, 26], .38); // shaded below and right
        } else if (dark && dark(X + .5, y + .5)) continue;
        x.fillStyle = `rgb(${c3[0] | 0},${c3[1] | 0},${c3[2] | 0})`; x.fillRect(X, y, 1, 1);
      }
    };
    if (o.flat) { const [cv, x] = make(16, 16); draw(x); c = cv; } else c = sprite(16, 16, draw, HS.ART_OUT);
    cache.set(k, c);
    return c;
  };

  // little planets for the route, lit from the top left: Earth, the Moon and Mars, 14 x 14 with an outline
  const PLANET = {
    earth: [[28, 70, 150], [52, 116, 208], [120, 180, 240], [64, 140, 76]],
    moon: [[84, 84, 92], [150, 150, 156], [214, 214, 218], [112, 112, 120]],
    mars: [[110, 52, 34], [190, 100, 60], [236, 160, 108], [140, 66, 42]]
  };
  HS.planetIcon = (id) => {
    const k = 'planet:' + id; let c = cache.get(k);
    if (c) return c;
    const [deep, base, lit, land] = PLANET[id] || PLANET.moon;
    c = sprite(14, 14, (x) => {
      for (let y = 0; y < 14; y++) for (let X = 0; X < 14; X++) {
        const nx = (X + .5 - 7) / 6.6, ny = (y + .5 - 7) / 6.6, rr = nx * nx + ny * ny;
        if (rr > 1) continue;
        const lum = -nx * .55 - ny * .6 + Math.sqrt(1 - rr) * .6, b = bayer(X, y) - .5;
        // a few patches: Earth's land, the Moon's maria, Mars's dark plains
        const patch = Math.sin(X * 1.7 + y * .6) + Math.sin(y * 1.3 - X * .5) > .9;
        let col = patch ? land : base;
        if (lum + b * .2 > .62) col = mix(col, lit, .7); else if (lum + b * .2 < .05) col = mix(col, deep, .8);
        x.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`; x.fillRect(X, y, 1, 1);
      }
    }, HS.ART_OUT);
    cache.set(k, c);
    return c;
  };

  // on the HUD: 9 x 9 units with the outline, snapped to whole art pixels
  const snap = (v) => Math.round(v * 2) / 2;
  HS.drawIcon = (name, x, y, col) => { const g = HS.g; g.imageSmoothingEnabled = false; g.drawImage(HS.icon(name, col), snap(x) - .5, snap(y) - .5, 9, 9); };
  // a planet centred on cx, cy: 8 x 8 units with the outline
  HS.drawPlanet = (id, cx, cy) => { const g = HS.g; g.imageSmoothingEnabled = false; g.drawImage(HS.planetIcon(id), snap(cx - 4), snap(cy - 4), 8, 8); };
})();
