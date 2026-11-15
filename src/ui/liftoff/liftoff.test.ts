import { describe, expect, it } from "vitest";
import { Prep } from "./gfx";
import {
  CREW_T,
  DEST,
  EVENTS,
  LENS_F,
  T,
  VP,
  type Dest,
  camToBody,
  crewState,
  dot3,
  flightState,
  lensDir,
  lensProj,
  projBody,
  skyAt,
  bodyToCam,
} from "./math";

const dests: Dest[] = ["mars", "moon"];
const times = Array.from({ length: 111 }, (_, i) => T.cut + i * 0.2);

describe("the hull camera", () => {
  it("projects a pixel's direction back onto that pixel", () => {
    for (const [x, y] of [[640, 360], [100, 80], [1200, 650], [30, 700], [900, 20]]) {
      const d = lensDir(x, y);
      const p = lensProj(d[0], d[1], d[2]);
      expect(p?.[0]).toBeCloseTo(x, 3);
      expect(p?.[1]).toBeCloseTo(y, 3);
    }
  });

  it("has the rocket's aft axis land where the picture expects it", () => {
    const axis = bodyToCam([0, -1, 0]);
    const p = lensProj(axis[0], axis[1], axis[2]);
    expect(p?.[0]).toBeCloseTo(VP[0], 3);
    expect(p?.[1]).toBeCloseTo(VP[1], 3);
  });

  it("keeps the camera frame orthonormal", () => {
    const e = [camToBody([1, 0, 0]), camToBody([0, 1, 0]), camToBody([0, 0, 1])];
    for (let i = 0; i < 3; i++) {
      expect(Math.hypot(...e[i])).toBeCloseTo(1, 6);
      for (let j = i + 1; j < 3; j++) expect(dot3(e[i], e[j])).toBeCloseTo(0, 6);
    }
  });

  it("sees the booster's engines on screen, left of the Sun's side", () => {
    const p = projBody([0, -28.6, 0]);
    expect(p).not.toBeNull();
    expect(p![0]).toBeGreaterThan(0);
    expect(p![0]).toBeLessThan(1280);
    expect(p![1]).toBeGreaterThan(0);
    expect(p![1]).toBeLessThan(720);
    expect(LENS_F).toBeGreaterThan(0);
  });
});

describe("the flight profile", () => {
  it.each(dests)("climbs and speeds up all the way to orbit on %s", (dest) => {
    let h = -1;
    let dr = -1;
    let v = -1;
    for (const t of times) {
      const st = flightState(t, dest);
      expect(st.h).toBeGreaterThanOrEqual(h);
      expect(st.dr).toBeGreaterThanOrEqual(dr);
      expect(st.v).toBeGreaterThanOrEqual(v);
      h = st.h;
      dr = st.dr;
      v = st.v;
    }
    const end = flightState(T.cut + 22, dest);
    expect(end.h).toBeCloseTo(DEST[dest].hMax + 0.02, 1);
    expect(end.v).toBeCloseTo(DEST[dest].vMax, 2);
  });

  it("sits on the pad at ignition, and is still under 100 m up when the camera cuts in", () => {
    for (const dest of dests) {
      const lit = flightState(16, dest);
      expect(lit.h).toBeCloseTo(0.02, 3);
      expect(lit.v).toBe(0);
      expect(flightState(T.cut, dest).h).toBeLessThan(0.1);
    }
  });

  it("pitches over from vertical to well past 60 degrees", () => {
    expect(flightState(T.cut, "mars").beta).toBeLessThan(0.01);
    expect(flightState(T.cut + 22, "mars").beta).toBeGreaterThan(1.0);
  });

  it("keeps the rocket's axes unit length and at right angles", () => {
    for (const t of times) {
      const st = flightState(t, "mars");
      for (const a of [st.aw, st.bw, st.zw]) expect(Math.hypot(...a)).toBeCloseTo(1, 6);
      expect(dot3(st.aw, st.bw)).toBeCloseTo(0, 6);
      expect(dot3(st.aw, st.zw)).toBeCloseTo(0, 6);
    }
  });

  it("cuts the booster's thrust at MECO", () => {
    expect(flightState(T.mecoAt - 0.1, "mars").boost).toBe(1);
    expect(flightState(T.mecoAt + 0.5, "mars").boost).toBe(0);
  });

  it("is the same every time it is asked", () => {
    expect(flightState(25, "mars")).toEqual(flightState(25, "mars"));
  });
});

describe("the sky", () => {
  it("is blocked by the planet underfoot and open overhead", () => {
    const st = flightState(T.cut + 8, "mars");
    const down = [-st.O[0], -st.O[1], -st.O[2]].map((c) => c / Math.hypot(...st.O));
    const up = st.O.map((c) => c / Math.hypot(...st.O));
    expect(skyAt(st, down)).toBe(-1);
    expect(skyAt(st, up)).toBeGreaterThanOrEqual(0);
  });

  it("has no air to glow on the Moon", () => {
    const st = flightState(T.cut + 8, "moon");
    const up = st.O.map((c) => c / Math.hypot(...st.O));
    expect(skyAt(st, up)).toBe(0);
  });

  it("rises the Sun on Mars during the climb and never needs to on the Moon", () => {
    expect(flightState(T.cut + 2, "mars").sunVis).toBe(0);
    expect(flightState(T.cut + 20, "mars").sunVis).toBeGreaterThan(0.5);
    expect(flightState(T.cut + 2, "moon").sunVis).toBe(1);
  });
});

describe("the captions", () => {
  it.each(dests)("run in order, one at a time, inside the flight on %s", (dest) => {
    let end: number = T.cut;
    for (const e of EVENTS[dest]) {
      expect(e.from).toBeGreaterThanOrEqual(end);
      expect(e.to).toBeGreaterThan(e.from);
      expect(e.to).toBeLessThanOrEqual(T.fadeOut + 0.4);
      end = e.to;
    }
  });
});

describe("the crew's walk", () => {
  it("keeps everyone indoors until the airlock opens", () => {
    for (let k = 0; k < 4; k++) expect(crewState(CREW_T.door - 0.1, k)).toBeNull();
  });

  it("brings them out one after another, walking right", () => {
    expect(crewState(CREW_T.door + 0.2, 0)?.walk).toBe(true);
    expect(crewState(CREW_T.door + 0.2, 1)).toBeNull();
    const a = crewState(3, 0)!;
    const b = crewState(4, 0)!;
    expect(b.x).toBeGreaterThan(a.x);
    expect(a.y).toBe(b.y);
  });

  it("stands all four at the foot of the gantry, then lifts them to the arm", () => {
    for (let k = 0; k < 4; k++) {
      const wait = crewState(CREW_T.liftA - 0.1, k)!;
      expect(wait.walk).toBe(false);
      expect(wait.x).toBeGreaterThan(600);
      expect(wait.x).toBeLessThan(640);
    }
    const up = crewState(CREW_T.liftB, 0)!;
    expect(up.y).toBeLessThan(crewState(CREW_T.liftA - 0.1, 0)!.y);
  });

  it("has everyone aboard before the countdown ends", () => {
    for (let k = 0; k < 4; k++) expect(crewState(T.cut - 3, k)).toBeNull();
  });
});

describe("Prep", () => {
  it("does its work in slices and hands back the result", () => {
    let steps = 0;
    const p = new Prep<number>(function* (self) {
      for (let i = 0; i < 5; i++) {
        steps++;
        yield;
      }
      self.value = 42;
    });
    expect(p.done).toBe(false);
    // a clock already past: no work yet
    expect(p.step(0)).toBe(false);
    expect(steps).toBe(0);
    expect(p.now()).toBe(42);
    expect(p.done).toBe(true);
    expect(steps).toBe(5);
    expect(p.now()).toBe(42);
  });
});
