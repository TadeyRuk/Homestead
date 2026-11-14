import { describe, expect, it } from "vitest";
import { createInterpolator, createPrediction } from "./smooth";

const SPEED = 180;

describe("own-player prediction", () => {
  it("moves the instant a key is held, before any snapshot", () => {
    const p = createPrediction(SPEED);
    p.reconcile({ x: 100, y: 100 }, false, 0);
    p.step({ dx: 1, dy: 0 }, 0.5);
    expect(p.position()).toEqual({ x: 190, y: 100 });
  });

  it("ignores the host lagging a little behind while the player keeps moving", () => {
    const p = createPrediction(SPEED);
    p.reconcile({ x: 100, y: 100 }, false, 0);
    p.step({ dx: 1, dy: 0 }, 0.1);
    p.reconcile({ x: 100, y: 100 }, true, 0.016); // host hasn't caught up yet
    expect(p.position().x).toBe(118);
  });

  it("eases onto the host's position once the player stops", () => {
    const p = createPrediction(SPEED);
    p.reconcile({ x: 100, y: 100 }, false, 0);
    p.step({ dx: 1, dy: 0 }, 0.1);
    for (let i = 0; i < 60; i++) p.reconcile({ x: 110, y: 100 }, false, 0.016);
    expect(p.position().x).toBeCloseTo(110, 0);
  });

  it("snaps when the host disagrees by a lot, like walking through a wall it blocked", () => {
    const p = createPrediction(SPEED);
    p.reconcile({ x: 100, y: 100 }, false, 0);
    p.step({ dx: 1, dy: 0 }, 1);
    p.reconcile({ x: 100, y: 100 }, true, 0.016);
    expect(p.position()).toEqual({ x: 100, y: 100 });
  });
});

describe("interpolating other players", () => {
  it("draws a player between the two snapshots around the render time", () => {
    const it = createInterpolator();
    it.push(1_000, [{ id: "b", x: 0, y: 0 }]);
    it.push(1_100, [{ id: "b", x: 100, y: 50 }]);
    expect(it.at(1_050).get("b")).toEqual({ x: 50, y: 25 });
  });

  it("holds the newest position rather than guessing past it", () => {
    const it = createInterpolator();
    it.push(1_000, [{ id: "b", x: 0, y: 0 }]);
    it.push(1_100, [{ id: "b", x: 100, y: 0 }]);
    expect(it.at(1_500).get("b")).toEqual({ x: 100, y: 0 });
  });

  it("shows a player who just joined at their first known position", () => {
    const it = createInterpolator();
    it.push(1_000, [{ id: "b", x: 0, y: 0 }]);
    it.push(1_100, [{ id: "b", x: 100, y: 0 }, { id: "c", x: 7, y: 9 }]);
    expect(it.at(1_050).get("c")).toEqual({ x: 7, y: 9 });
  });
});
