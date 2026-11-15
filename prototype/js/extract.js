// Homestead extraction cutscene: the crew walks out to the ship and lifts off for home, played with the title's
// liftoff film (js/liftoff, drawn as on the title in js/menu.js) on the mission's own world, Moon or Mars, with the
// first astronaut to board in the player's suit. The film's title captions are switched off (env.quiet) and this
// scene puts the run's own words on top. Skippable after SKIP_AFTER seconds; ends just after the film fades out.
// surface.js comes here after extraction, unless the whole crew went down (then it goes straight to the report).
(() => {
  const HS = window.HS, g = HS.g, LO = HS.liftoff;
  const { T, C, PIX, clamp, seg } = HS;
  const END = 39.2;          // film seconds: the film fades out at 38.4 and would start over at 40
  const SKIP_AFTER = 2;
  const CALM_S = 6;          // with reduced motion the film holds one frame, so the scene ends on its own clock
  const ex = { film: null, t: 0, last: 0 };
  const film = () => (ex.film ??= new LO.Liftoff(LO.calm()));

  HS.scenes.extraction = {
    enter() {
      const f = film(), S = HS.S;
      f.setDest(S.mission.id); f.replay(); f.env.quiet = true;
      ex.t = 0; ex.last = performance.now();
      HS.sfx.extract();
    },
    exit() { if (ex.film) { ex.film.env.fx.clear(); ex.film.tx.clear(); } },
    update(dt) {
      ex.t += dt;
      const f = film(), done = f.env.calm ? ex.t > CALM_S : f.time >= END;
      if (done || (ex.t > SKIP_AFTER && HS.hit('Enter', 'Space', 'KeyE'))) HS.go('report');
    },
    draw() {
      const now = performance.now(), dt = Math.min(0.1, (now - ex.last) / 1000);
      ex.last = now;
      const S = HS.S, f = film(), si = HS.SUITS.indexOf(S.suit);
      f.env.lead = { name: S.name || '', role: si >= 0 && si < 4 ? si : 0, suit: si >= 0 && si < 4 ? '' : S.suit };
      f.prepare(4);
      const t = f.tick(dt);
      f.draw(t, dt);
      HS.ax.drawImage(f.art, 0, 0); HS.bleedArt(64); HS.blitArt();
      HS.flushFilm(f.tx, HS.scale / 2, HS.OX * HS.scale, HS.OY * HS.scale);
      // the run's words while the crew walks out, where the title puts its own
      const mi = S.mission, a = clamp(ex.t * 1.5, 0, 1) * (1 - seg(ex.t, 9.5, 10.5));
      if (a > 0) {
        g.globalAlpha = a;
        const x = HS.X0 + 26, y = HS.Y0 + 66;
        T('EXTRACTION', x, y, 36, C.white, { w: 700, f: PIX });
        T(`${mi.name}  ·  the ship from Earth takes the crew home`, x + 2, y + 18, 9, '#f1d9cf', { w: 600 });
        T(`data uplinked ${Math.floor(S.uplinked)} of ${mi.target}`, x + 2, y + 32, 8, C.amber, { w: 600 });
        g.globalAlpha = 1;
      }
      if (ex.t > SKIP_AFTER) HS.hint('[ENTER] skip to the mission report');
    }
  };
})();
