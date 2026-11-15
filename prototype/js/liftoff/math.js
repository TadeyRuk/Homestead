// Homestead title film (liftoff), math: ported to plain JS from src/ui/liftoff/math.ts
// (Homestead main @ 6c3d22c, seat 3 UI). Only the TypeScript types were removed; every other line is
// the original. Classic script: reads its imports from, and adds its exports to, window.HS.liftoff.
(() => {
  const L = window.HS.liftoff;
  const { clamp, lerp } = L;

  /** the art grid, per ART-RULES.md: one art pixel is one screen pixel at 1280 wide */
  const ART_W = 1280;
  const ART_H = 720;
  /** the world seen from the hull is drawn at half that, in 2 x 2 chunks (far background) */
  const LW = 640;
  const LH = 360;
  const LN_PIXELS = LW * LH;

  const sstep = (a, b, x) => {
    const k = clamp((x - a) / (b - a));
    return k * k * (3 - 2 * k);
  };
  const ease = (k) => k * k * (3 - 2 * k);
  /** 0 -> 1 over 0.6 s from a, then 1 -> 0 over 0.6 s ending at b */
  const bump = (t, a, b) => sstep(a, a + 0.6, t) * (1 - sstep(b - 0.6, b, t));
  const hash = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm3 = (v) => {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
  };

  const BAYER_TABLE = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const BAYER = BAYER_TABLE;
  /** ordered-dither threshold for a pixel, 0..1 */
  const bayer = (x, y) => BAYER_TABLE[(y & 3) * 4 + (x & 3)];

  // ---------- the hull camera: a mild fisheye (stereographic), like a GoPro

  /** pixels per radian at the centre of the lens */
  const LENS_F = 577;
  /** where the rocket's aft axis lands on screen */
  const VP = [500, 604];
  /** hull radius in metres */
  const RH = 1.5;

  /** the direction (camera space) that screen pixel (px, py) looks along */
  function lensDir(px, py) {
    const dx = px - ART_W / 2;
    const dy = py - ART_H / 2;
    const rp = Math.hypot(dx, dy);
    if (rp < 1e-6) return [0, 0, 1];
    const th = 2 * Math.atan(rp / (2 * LENS_F));
    const s = Math.sin(th);
    return [(s * dx) / rp, (-s * dy) / rp, Math.cos(th)];
  }

  /** camera-space direction -> [screen x, screen y, pixels per metre at distance 1], or null behind the lens */
  function lensProj(x, y, z) {
    const len = Math.hypot(x, y, z);
    if (len < 1e-9) return null;
    const th = Math.acos(clamp(z / len, -1, 1));
    if (th > 2.3) return null;
    const rr = Math.hypot(x, y);
    const rp = 2 * LENS_F * Math.tan(th / 2);
    const c = Math.cos(th / 2);
    const k = LENS_F / (c * c) / len;
    if (rr < 1e-9) return [ART_W / 2, ART_H / 2, k];
    return [ART_W / 2 + (x / rr) * rp, ART_H / 2 - (y / rr) * rp, k];
  }

  // the camera's basis: E1 looks down the aft axis, E2 is screen-up beside it
  const E1 = lensDir(VP[0], VP[1]);
  const E2 = norm3([-E1[1] * E1[0], 1 - E1[1] * E1[1], -E1[1] * E1[2]]);
  const E3 = [E1[1] * E2[2] - E1[2] * E2[1], E1[2] * E2[0] - E1[0] * E2[2], E1[0] * E2[1] - E1[1] * E2[0]];

  /** body frame: x is the belly side, y runs to the nose, z is sideways */
  const camToBody = (d) => [-dot3(d, E2), -dot3(d, E1), dot3(d, E3)];
  const bodyToCam = (p) => [
    -p[1] * E1[0] - p[0] * E2[0] + p[2] * E3[0],
    -p[1] * E1[1] - p[0] * E2[1] + p[2] * E3[1],
    -p[1] * E1[2] - p[0] * E2[2] + p[2] * E3[2],
  ];
  /** the camera's position on the hull, a little proud of the skin */
  const CP = (() => {
    const r = camToBody([1, 0, 0]);
    const l = Math.hypot(r[0], r[2]);
    return [(r[0] / l) * (RH + 0.75), 0, (r[2] / l) * (RH + 0.75)];
  })();

  /** a point in body metres -> [x, y, px per metre at distance 1] on screen */
  function projBody(p) {
    const c = bodyToCam([p[0] - CP[0], p[1] - CP[1], p[2] - CP[2]]);
    return c[2] > 0.02 ? lensProj(c[0], c[1], c[2]) : null;
  }

  // ---------- the two destinations

  const sunDir = (elev, az) => {
    const e = (elev * Math.PI) / 180;
    const a = (az * Math.PI) / 180;
    return [-Math.cos(e) * Math.cos(a), Math.sin(e), -Math.cos(e) * Math.sin(a)];
  };

  const DEST = {
    mars: {
      Rp: 3389.5,
      hMax: 120,
      dMax: 230,
      vMax: 3.45,
      // set so the Sun rises into view just after staging
      sun: norm3([-0.9571, -0.144, -0.2516]),
      atm: { H: 11.1, k: 0.032, k2: 2.6 },
      amb: [0.34, 0.29, 0.4],
      sunC: [1.3, 1.1, 0.9],
      twi: [0.55, 0.2, 0.08],
      hazeD: [62, 54, 78],
      hazeL: [200, 150, 112],
      sky: [176, 128, 100],
      blue: [130, 180, 250],
      lit0: -0.025,
      lit1: 0.07,
    },
    moon: {
      Rp: 1737.4,
      hMax: 55,
      dMax: 110,
      vMax: 1.68,
      sun: sunDir(5, 36),
      atm: null,
      amb: [0.05, 0.05, 0.065],
      sunC: [1.12, 1.1, 1.06],
      twi: [0, 0, 0],
      hazeD: [0, 0, 0],
      hazeL: [0, 0, 0],
      sky: [0, 0, 0],
      blue: [0, 0, 0],
      lit0: -0.012,
      lit1: 0.05,
    },
  };

  /** the title's clock, in seconds */
  const T = {
    /** the cut from the pad to the hull camera */
    cut: 16.8,
    loop: 40,
    fadeOut: 38.4,
    mecoAt: 28,
    sepAt: 28.6,
    vacFrom: 29.6,
    vacTo: 35,
  };

  /** altitude, attitude and lighting at scene time t (seconds on the title clock) */
  function flightState(t, dest) {
    const D = DEST[dest];
    const u = clamp((t - 16) / 22);
    const h = 0.02 + D.hMax * Math.pow(u, 2.4);
    const dr = D.dMax * Math.pow(u, 3.2);
    const beta = 1.14 * sstep(0.03, 0.9, u);
    const roll = -0.62 * sstep(0.08, 0.2, u);
    const th = dr / D.Rp;
    const up = [Math.sin(th), Math.cos(th)];
    const fw = [Math.cos(th), -Math.sin(th)];
    const cb = Math.cos(beta);
    const sb = Math.sin(beta);
    const aw = [cb * up[0] + sb * fw[0], cb * up[1] + sb * fw[1], 0];
    const b0 = [-sb * up[0] + cb * fw[0], -sb * up[1] + cb * fw[1]];
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    const bw = [cr * b0[0], cr * b0[1], sr];
    const zw = [-sr * b0[0], -sr * b0[1], cr];
    const O = [(D.Rp + h) * up[0], (D.Rp + h) * up[1], 0];
    const es = Math.asin(clamp(dot3(D.sun, [up[0], up[1], 0]), -1, 1));
    const dip = Math.acos(D.Rp / (D.Rp + h));
    const rel = es + dip;
    const boost = t < T.mecoAt ? 1 : Math.max(0, 1 - (t - T.mecoAt) / 0.25);
    return {
      u,
      h,
      dr,
      v: D.vMax * Math.pow(u, 1.3),
      beta,
      roll,
      aw,
      bw,
      zw,
      O,
      D,
      moon: dest === "moon",
      skyLight: 0.36 + 0.64 * sstep(-0.05, 0.02, rel),
      sunVis: dest === "moon" ? 1 : sstep(-0.004, 0.012, rel),
      rel,
      boost,
      padGlow: boost * clamp(1 - h / 2.2) * 0.9,
      padR2: (0.025 + h * 0.5) ** 2,
    };
  }

  /** a world-frame vector in the rocket's body frame */
  const w2b = (st, v) => [dot3(v, st.bw), dot3(v, st.aw), dot3(v, st.zw)];

  function projWorldDir(st, v) {
    const c = bodyToCam(w2b(st, v));
    return c[2] > 0.02 ? lensProj(c[0], c[1], c[2]) : null;
  }
  function projWorldPt(st, p) {
    const c = bodyToCam(w2b(st, [p[0] - st.O[0], p[1] - st.O[1], p[2] - st.O[2]]));
    return c[2] <= 1e-5 ? null : lensProj(c[0], c[1], c[2]);
  }

  /** how bright the sky is along a world direction (0 dark .. 1), or -1 when the planet is in the way */
  function skyAt(st, v) {
    const D = st.D;
    const O = st.O;
    const bb = dot3(O, v);
    const cx = O[1] * v[2] - O[2] * v[1];
    const cy = O[2] * v[0] - O[0] * v[2];
    const cz = O[0] * v[1] - O[1] * v[0];
    const hc = Math.hypot(cx, cy, cz) - D.Rp;
    if (bb < 0 && hc < 0) return -1;
    if (!D.atm) return 0;
    const ht = bb < 0 ? Math.max(hc, 0) : st.h;
    return (1 - Math.exp(-D.atm.k2 * Math.exp(-ht / D.atm.H))) * st.skyLight;
  }

  /** where Phobos (Mars) or Earth (Moon) hangs in the sky, in the planet's frame */
  const SKY_BODY = {
    mars: norm3([-0.9272, 0.3221, 0.1909]),
    moon: norm3([-0.957, 0.2717, 0.102]),
  };

  // ---------- what the hull camera's captions say

  const ev = (from, to, head, sub) => ({ from, to, head, sub });
  const EVENTS = {
    mars: [
      ev(16.9, 19.4, "LIFTOFF", "Clear of the tower"),
      ev(19.4, 21.4, "ROLL PROGRAM", "Lining up with the orbit"),
      ev(21.6, 24.6, "MAX-Q", "Peak pressure on the hull. Thin air, so it's gentle"),
      ev(25, 27.8, "THE SKY GOES BLACK", "Most of the air is below you now"),
      ev(28, 28.6, "MECO", "Booster engines off"),
      ev(28.6, 30, "STAGE SEP", "The booster falls away"),
      ev(30, 31.3, "SECOND ENGINE", "The vacuum nozzle glows hot"),
      ev(31.4, 34.6, "SUNRISE", "Climbing out of the planet's shadow"),
      ev(35, 38.6, "SECO · ORBIT", "3.4 km/s. Next stop: home"),
    ],
    moon: [
      ev(16.9, 19.4, "LIFTOFF", "Clear of the tower"),
      ev(19.4, 21.4, "ROLL PROGRAM", "Lining up with the orbit"),
      ev(21.6, 24.6, "NO MAX-Q", "No air, so nothing pushes back"),
      ev(25, 27.8, "SKIMMING THE CRATERS", "Low orbit here is only 50 km up"),
      ev(28, 28.6, "MECO", "Booster engines off"),
      ev(28.6, 30, "STAGE SEP", "The booster falls away"),
      ev(30, 31.3, "SECOND ENGINE", "The vacuum nozzle glows hot"),
      ev(31.4, 34.6, "EARTH IN VIEW", "It hangs still in the lunar sky"),
      ev(35, 38.6, "SECO · ORBIT", "1.7 km/s. Next stop: home"),
    ],
  };

  // ---------- the crew's walk: out of the airlock, along the path, up the lift, across the arm, in

  const CREW_T = { door: 1.2, gap: 0.6, speed: 40, liftA: 8.3, liftB: 10.2, armV: 64, hatch: 11 };
  /** where astronaut k (0..3, in walking order) is at time t, or null when not on screen */
  function crewState(t, k) {
    const doorX = 418;
    const liftX = 618;
    const gy = 568;
    const ay = 482;
    const t0 = CREW_T.door + k * CREW_T.gap;
    if (t < t0) return null;
    const tx = liftX - 3 + (k - 1.5) * 4;
    if (t < CREW_T.liftA) {
      const x = Math.min(tx, doorX + (t - t0) * CREW_T.speed);
      return { x, y: gy, walk: x < tx };
    }
    if (t < CREW_T.liftB) {
      return { x: tx, y: Math.round(lerp(gy, ay, ease((t - CREW_T.liftA) / (CREW_T.liftB - CREW_T.liftA)))), walk: false, lift: true };
    }
    if (t < CREW_T.liftB + k * 0.22) return { x: tx, y: ay, walk: false };
    const x = tx + (t - CREW_T.liftB - k * 0.22) * CREW_T.armV;
    if (x > 682) return null;
    return { x, y: ay, walk: true };
  }

  Object.assign(L, { ART_W, ART_H, LW, LH, LN_PIXELS, sstep, ease, bump, hash, dot3, norm3, BAYER, bayer, LENS_F, VP, RH, lensDir, lensProj, E1, E2, E3, camToBody, bodyToCam, CP, projBody, DEST, T, flightState, w2b, projWorldDir, projWorldPt, skyAt, SKY_BODY, EVENTS, CREW_T, crewState });
})();
