import { describe, expect, it } from "vitest";
import type { EventKind } from "../../core/events";
import type { Input } from "../../core/input";
import type { GameEvent } from "../../core/state";
import {
  createWelder, LEAK_PER_SECOND, openBreach, stepWeld, TOLERANCE, WASTE_PER_SECOND, type Emit, type Point, type Welder,
} from "./weld";

const still: Input = { dx: 0, dy: 0, interact: false, panel: false, switch: false };

type Logged = { kind: EventKind } & Pick<GameEvent, "part" | "value">;
function recorder() {
  const logged: Logged[] = [];
  return { logged, emit: (kind: EventKind, fields: Pick<GameEvent, "part" | "value">) => logged.push({ kind, ...fields }) };
}

const ship = (hull = 0.6) => ({ hull, cabinOxygen: 0.8 });

// steers the torch toward a point the way a player holding keys would, one 0.05 s tick at a time
function steerTo(w: Welder, s: { hull: number; cabinOxygen: number }, to: Point, emit: Emit = () => {}) {
  for (let i = 0; i < 400 && w.jobs[0]; i++) {
    const dx = Math.abs(to.x - w.torch.x) > 0.015 ? Math.sign(to.x - w.torch.x) : 0;
    const dy = Math.abs(to.y - w.torch.y) > 0.015 ? Math.sign(to.y - w.torch.y) : 0;
    if (dx === 0 && dy === 0) return;
    stepWeld(w, s, { ...still, dx, dy }, 0.05, emit);
  }
}

// traces the whole crack carefully, point by point
function trace(w: Welder, s: { hull: number; cabinOxygen: number }, emit: Emit = () => {}) {
  const job = w.jobs[0];
  for (const p of job.crack) steerTo(w, s, p, emit);
}

describe("hull weld", () => {
  it("has nothing to weld until the hull is breached", () => {
    const w = createWelder(1);
    const s = ship();
    stepWeld(w, s, still, 1, () => {});
    expect(w.jobs).toEqual([]);
    expect(s.cabinOxygen).toBe(0.8);
  });

  it("opens a weld job with a seeded crack when the hull is breached", () => {
    const a = createWelder(4);
    const b = createWelder(4);
    openBreach(a, 0.2, "debris");
    openBreach(b, 0.2, "debris");
    expect(a.jobs).toHaveLength(1);
    expect(a.jobs[0].crack.length).toBeGreaterThan(3);
    expect(a.jobs[0].crack).toEqual(b.jobs[0].crack);
  });

  it("gives each breach a different crack", () => {
    const w = createWelder(4);
    openBreach(w, 0.2);
    openBreach(w, 0.2);
    expect(w.jobs[0].crack).not.toEqual(w.jobs[1].crack);
  });

  it("leaks cabin air while a breach is open", () => {
    const w = createWelder(1);
    openBreach(w, 0.2);
    const s = ship();
    stepWeld(w, s, still, 2, () => {});
    expect(s.cabinOxygen).toBeCloseTo(0.8 - LEAK_PER_SECOND * 2);
  });

  it("moves the torch with the held direction and keeps it on the panel", () => {
    const w = createWelder(1);
    const start = { ...w.torch };
    stepWeld(w, ship(), { ...still, dx: 1 }, 0.1, () => {});
    expect(w.torch.x).toBeGreaterThan(start.x);
    stepWeld(w, ship(), { ...still, dx: -1, dy: -1 }, 100, () => {});
    expect(w.torch).toEqual({ x: 0, y: 0 });
  });

  it("seals the crack point by point, in order", () => {
    const w = createWelder(2);
    openBreach(w, 0.2);
    const s = ship();
    const crack = w.jobs[0].crack;
    steerTo(w, s, crack[1]);
    expect(w.jobs[0].next).toBe(0); // skipping ahead does nothing
    steerTo(w, s, crack[0]);
    expect(w.jobs[0].next).toBe(1);
  });

  it("restores the hull and stops the leak when the whole crack is traced, logging the cause", () => {
    const w = createWelder(2);
    openBreach(w, 0.2, "debris");
    const s = ship(0.6);
    const { logged, emit } = recorder();
    trace(w, s, emit);
    expect(w.jobs).toEqual([]);
    expect(s.hull).toBeGreaterThan(0.75);
    expect(logged).toMatchObject([{ kind: "breach_sealed", part: "debris" }]);
    const air = s.cabinOxygen;
    stepWeld(w, s, still, 2, () => {});
    expect(s.cabinOxygen).toBe(air);
  });

  it("never restores the hull past full", () => {
    const w = createWelder(2);
    openBreach(w, 0.5);
    const s = ship(0.9);
    trace(w, s);
    expect(s.hull).toBe(1);
  });

  it("wastes sealant while the torch is off the line", () => {
    const w = createWelder(2);
    openBreach(w, 0.2);
    const s = ship();
    steerTo(w, s, w.jobs[0].crack[0]);
    const job = w.jobs[0];
    const before = job.sealant;
    // straight up and away from the crack
    stepWeld(w, s, { ...still, dy: -1 }, 0.5, () => {});
    stepWeld(w, s, still, 1, () => {});
    expect(job.sealant).toBeLessThan(before - WASTE_PER_SECOND * 0.9);
  });

  it("restores less hull after a sloppy weld than a clean one", () => {
    const clean = createWelder(2);
    const sloppy = createWelder(2);
    openBreach(clean, 0.3);
    openBreach(sloppy, 0.3);
    const a = ship(0.5);
    const b = ship(0.5);
    trace(clean, a);
    steerTo(sloppy, b, sloppy.jobs[0].crack[0]);
    stepWeld(sloppy, b, { ...still, dy: 1 }, 0.4, () => {});
    stepWeld(sloppy, b, still, 2, () => {});
    trace(sloppy, b);
    expect(b.hull).toBeLessThan(a.hull);
  });

  it("does not waste sealant before the weld has started", () => {
    const w = createWelder(2);
    openBreach(w, 0.2);
    stepWeld(w, ship(), still, 3, () => {});
    expect(w.jobs[0].sealant).toBe(1);
  });

  it("works through breaches one at a time", () => {
    const w = createWelder(3);
    openBreach(w, 0.1, "debris");
    openBreach(w, 0.1, "debris");
    const s = ship(0.5);
    trace(w, s);
    expect(w.jobs).toHaveLength(1);
  });

  it("counts the torch as on a point within the tolerance", () => {
    const w = createWelder(2);
    openBreach(w, 0.2);
    const p = w.jobs[0].crack[0];
    w.torch = { x: p.x + TOLERANCE * 0.9, y: p.y };
    stepWeld(w, ship(), still, 0.01, () => {});
    expect(w.jobs[0].next).toBe(1);
  });
});
