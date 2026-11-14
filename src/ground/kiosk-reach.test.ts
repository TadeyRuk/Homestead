import { describe, expect, it } from "vitest";
import { KIOSK_PRICE } from "../build/kiosk";
import type { Input } from "../core/input";
import { mapFor } from "../core/map";
import { createState } from "../core/state";
import { step } from "../core/step";
import "../register"; // every seat's rules in startup order: seat 6's kiosk before seat 2's carrying
import { KIOSK_REACH, PICK_REACH } from "./carry";
import { groundScene } from "./scene";
import { player, recordingCtx, STILL } from "./testing";

const PRESS: Input = { ...STILL, interact: true };
const kiosk = mapFor("campus").kiosk;
let clock = 70_000_000;

/** a campus run past its placement tick, with one player `dy` px south of the kiosk */
function nearKiosk(dy: number, credits = 100, carrying: string | null = null) {
  const s = createState(48213, "mars");
  s.phase = "campus";
  s.phaseEndsAt = 1e12;
  s.runStartedAt = clock += 1_000_000;
  s.credits = credits;
  s.players = [player("p1", 0, 0, { carrying })];
  step(s, { p1: STILL }, clock, 1 / 60);
  s.parts = [];
  Object.assign(s.players[0], { x: kiosk.x, y: kiosk.y + dy });
  return s;
}
const press = (s: ReturnType<typeof nearKiosk>) => step(s, { p1: PRESS }, (clock += 100), 1 / 60);
const kinds = (s: ReturnType<typeof nearKiosk>) => s.log.map((e) => e.kind);

describe("kiosk reach (#93)", () => {
  it("never counts a player as at the kiosk when a part on the kiosk would be out of their reach", () => {
    expect(KIOSK_REACH).toBeLessThanOrEqual(PICK_REACH);
  });

  it.each([0, 10, 20, 31])("at %ipx: one press buys, the next picks the part up", (dy) => {
    const s = nearKiosk(dy);
    press(s);
    press(s);
    expect(kinds(s)).toEqual(["kiosk_bought", "part_picked"]);
    expect(s.credits).toBe(100 - KIOSK_PRICE);
    expect(s.players[0].carrying).not.toBeNull();
    expect(s.parts).toEqual([]);
  });

  it.each([36, 39])("at %ipx, just outside, presses never buy, so credits can't drain away", (dy) => {
    const s = nearKiosk(dy);
    for (let i = 0; i < 3; i++) press(s);
    expect(kinds(s)).not.toContain("kiosk_bought");
    expect(s.credits).toBe(100);
  });

  it("walking in from just outside, the crew buys once and then picks up", () => {
    const s = nearKiosk(39);
    press(s); // too far: nothing
    s.players[0].y = kiosk.y + 25;
    press(s);
    press(s);
    expect(kinds(s)).toEqual(["kiosk_bought", "part_picked"]);
  });

  it("buying while carrying keeps the carried part, and the next press swaps it for the bought one", () => {
    const s = nearKiosk(20, 100, "camera");
    press(s);
    expect(s.players[0].carrying).toBe("camera");
    const bought = s.parts[0].part;
    press(s);
    expect(s.players[0].carrying).toBe(bought);
    expect(s.parts.map((p) => p.part)).toEqual(["camera"]); // dropped beside the kiosk
    expect(kinds(s)).toEqual(["kiosk_bought", "part_dropped", "part_picked"]);
  });

  it("draws the kiosk ring at its real reach", () => {
    const s = nearKiosk(20);
    const r = recordingCtx();
    groundScene("campus").draw(r.ctx, s, { playerId: "p1", now: clock });
    const radii = r.calls.filter((c) => c.name === "arc").map((c) => c.args[2]);
    expect(radii).toContain(KIOSK_REACH);
  });
});
