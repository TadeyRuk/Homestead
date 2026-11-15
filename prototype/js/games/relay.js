// Homestead surface game (S4-11): relay antenna align, on the S2-19 frame (js/surface-games.js).
// An orbiter crosses the sky. Lean the lander's relay dish with A/D to keep it inside the beam until the data is
// sent. The dish eases toward the speed you ask for, like the smooth steering in flight (js/flight.js), and the
// antenna sets how forgiving it is: its beam (HS.PARTS[...].beam) sets the beam width, its drift how much the dish
// lags and overshoots, and its rate how fast the data goes up. If the orbiter sets before the data is sent, the attempt fails.
(() => {
  const HS = window.HS, g = HS.g;
  const { T, C, clamp } = HS;
  const SKY = 75;           // the orbiter rises and sets at +-75 degrees from straight up
  const PASS = 14;          // seconds the orbiter takes to cross: a real relay pass lasts about 8 to 10 minutes
  const SPEED = 18;         // degrees per second the dish turns while A or D is held
  const GRIP = 7;           // how fast the dish reaches that speed; divided by the antenna's drift
  const FALLBACK = { beam: 8, drift: 1.2, rate: .1 };   // no antenna: barely possible
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // half the beam's width in degrees, from the part's beam number (low-gain 11, high-gain dish 6, laser 4.5, the narrowest)
  const halfBeam = (P) => Math.max(4.5, P.beam * .5 + 1);
  // data sent per second inside the beam: the faster the antenna, the less time you need to hold it
  const sendRate = (P) => .15 + P.rate * .08;

  HS.surfaceGames.relay = {
    name: 'Relay link',
    slot: 'comms',
    label: () => 'Relay data through an orbiter',
    brief: () => 'relay data through an orbiter',
    tip: 'wide beam is easier',
    keys: '[A] [D] lean the dish',
    fact: () => 'Mars rovers send most of their data home through orbiters like Mars Reconnaissance Orbiter as they pass overhead. Pass times come from orbit predictions like JPL Horizons and GMAT.',
    failNote: () => 'The orbiter set before the data was sent. Wait for the next pass and try again.',

    start(ctx) {
      const P = ctx.P || FALLBACK, r = ctx.r, dir = r() < .5 ? 1 : -1;
      return {
        t: 0, aim: -dir * 55, vel: 0, sent: 0, inBeam: false,   // the dish starts toward where the orbiter rises
        // a little wobble, so the orbiter's path is never a straight line
        dir, wob: .5 + r(), wobF: 1 + r(), ph: r() * 6,
        half: halfBeam(P), drift: P.drift == null ? 1 : P.drift, rate: sendRate(P)
      };
    },

    // where the orbiter is in the sky at time t, in degrees from straight up
    sat(d) {
      const k = clamp(d.t / PASS, 0, 1);
      return d.dir * (-SKY + 2 * SKY * k) + Math.sin(d.t * d.wobF + d.ph) * d.wob;
    },

    update(d, dt) {
      d.t += dt;
      const lean = (HS.key('KeyD', 'ArrowRight') ? 1 : 0) - (HS.key('KeyA', 'ArrowLeft') ? 1 : 0);
      // the dish eases toward the speed you ask for; one that drifts more lags and overshoots more
      d.vel += (lean * SPEED - d.vel) * Math.min(1, dt * GRIP / Math.max(.3, d.drift));
      d.aim = clamp(d.aim + d.vel * dt, -85, 85);
      if (Math.abs(d.aim) >= 85) d.vel = 0;
      d.inBeam = Math.abs(this.sat(d) - d.aim) <= d.half;
      if (d.inBeam) {
        d.sent = Math.min(1, d.sent + d.rate * dt);
        if (Math.floor(d.t * 6) !== Math.floor((d.t - dt) * 6)) HS.sfx.scan();
        if (d.sent >= 1) return 'done';
      }
      return d.t >= PASS ? 'failed' : 'playing';
    },

    draw(d, b, info) {
      const cx = Math.round(b.x + b.w / 2), cy = Math.round(b.y + b.h - 14), R = Math.min(b.w / 2 - 10, b.h - 30);
      const at = (deg, r) => [cx + Math.sin(deg * Math.PI / 180) * r, cy - Math.cos(deg * Math.PI / 180) * r];
      const sat = this.sat(d), col = HS.CAT.comms || C.cyan;

      // the sky arc from horizon to horizon, with tick marks
      g.strokeStyle = HS.rgba(C.muted, .6); g.lineWidth = 1;
      g.beginPath(); g.arc(cx, cy, R, Math.PI, 0); g.stroke();
      for (let a = -SKY; a <= SKY; a += 15) { const [x1, y1] = at(a, R - 3), [x2, y2] = at(a, R + 2); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }

      // the beam: a cone from the dish, green while the orbiter is in it
      const [l1, l2] = [at(d.aim - d.half, R + 6), at(d.aim + d.half, R + 6)];
      g.fillStyle = HS.rgba(d.inBeam ? C.green : C.amber, d.inBeam ? .32 : .2);
      g.beginPath(); g.moveTo(cx, cy - 6); g.lineTo(l1[0], l1[1]); g.lineTo(l2[0], l2[1]); g.closePath(); g.fill();

      // the orbiter: a small body with two panel wings, blinking while it is linked
      const [sx, sy] = at(sat, R), blink = d.inBeam && !calm && Math.floor(d.t * 8) % 2 === 0;
      g.fillStyle = HS.ART_OUT || '#0a0f18'; g.fillRect(Math.round(sx) - 8, Math.round(sy) - 3, 16, 6);
      g.fillStyle = '#5a96f5'; g.fillRect(Math.round(sx) - 7, Math.round(sy) - 2, 5, 4); g.fillRect(Math.round(sx) + 2, Math.round(sy) - 2, 5, 4);
      g.fillStyle = blink ? C.green : '#e8ecf2'; g.fillRect(Math.round(sx) - 2, Math.round(sy) - 2, 4, 4);

      // the dish on its mast at the bottom, tilted toward where it points
      g.fillStyle = '#8a93a3'; g.fillRect(cx - 10, cy, 20, 4); g.fillStyle = '#b4bcca'; g.fillRect(cx - 1, cy - 8, 3, 8);
      g.save(); g.translate(cx + .5, cy - 8); g.rotate(d.aim * Math.PI / 180);
      g.fillStyle = col; g.fillRect(-9, -3, 18, 3); g.fillStyle = '#e8ecf2'; g.fillRect(-1, -8, 2, 5);
      g.restore();

      // how much is sent, and how long until the orbiter sets
      const left = Math.max(0, PASS - d.t);
      T('DATA SENT', b.x + 6, b.y + 10, 6.5, C.muted, { w: 600 });
      HS.bar(b.x + 6, b.y + 15, 90, 5, d.sent, d.inBeam ? C.green : C.cyan);
      T(`${Math.floor(d.sent * 100)}%`, b.x + 100, b.y + 20, 7, C.white, { w: 600 });
      T(`sets in ${left.toFixed(1)} s`, b.x + b.w - 6, b.y + 10, 7, left < 3 ? C.red : C.muted, { a: 'right', w: 600 });
      T(`beam ${Math.round(d.half * 2)} deg`, b.x + b.w - 6, b.y + 21, 7, C.muted, { a: 'right' });
      if (!d.inBeam && d.t > .6) T('Lost the orbiter: lean the dish back onto it', cx, b.y + b.h - 4, 7, C.amber, { a: 'center', w: 600 });
    }
  };
})();
