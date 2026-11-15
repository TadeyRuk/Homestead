// Homestead title film (liftoff), the few outside helpers it uses, ported to plain JS from the main
// game (Homestead main @ 6c3d22c): clamp, lerp, noise, shade and calm from src/ui/kit.ts, the role
// colours and fonts from src/ui/tokens.ts, and the role order from src/core/lobby.ts.
// Loads first: it creates window.HS.liftoff, which the other js/liftoff/*.js files read and fill.
(() => {
  const L = (window.HS.liftoff = {});

  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /** a small seeded generator for decoration only (stars, sparks); game randomness stays in core/rng */
  function noise(seed) {
    let s = seed | 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shade(h, f) {
    const n = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    return `rgb(${n.map((v) => clamp(Math.round(v * f), 0, 255)).join(",")})`;
  }

  const calm = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ROLES = ["pilot", "engineer", "comms", "science"];
  const ROLE_COLOUR = {
    pilot: "#f08a24",
    engineer: "#e8c547",
    comms: "#3fc6d9",
    science: "#e0509a",
  };
  const MONO = '"IBM Plex Mono", ui-monospace, Consolas, monospace';
  const PIXEL = '"Pixelify Sans", "Courier New", monospace';

  Object.assign(L, { clamp, lerp, noise, shade, calm, ROLES, ROLE_COLOUR, MONO, PIXEL });
})();
