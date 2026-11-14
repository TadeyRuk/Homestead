import { describe, expect, it } from "vitest";
import type { Input } from "../core/input";
import { mapFor } from "../core/map";
import { createState, type GameState } from "../core/state";
import { step } from "../core/step";
import { player, STILL } from "../ground/testing";
import { KIOSK_PRICE } from "./kiosk";
import "../register";

const PRESS: Input = { ...STILL, interact: true };
const NOW = 10_000;
let run = 0;

// seat 2 places the crew on start points on a run's first campus tick, so take that tick first, then walk over
function campusAtKiosk(credits: number, carrying: string | null = null): GameState {
  const s = createState(48213, "mars");
  s.phase = "campus";
  s.phaseEndsAt = NOW + 60_000;
  s.runStartedAt = ++run;
  s.credits = credits;
  s.players = [player("p1", 0, 0, { carrying })];
  step(s, { p1: STILL }, NOW - 1_000, 1 / 60);
  const { kiosk } = mapFor("campus");
  s.players[0].x = kiosk.x;
  s.players[0].y = kiosk.y + 20;
  return s;
}

const tick = (s: GameState, input: Input, at = NOW) => step(s, { p1: input }, at, 1 / 60);
const kinds = (s: GameState) => s.log.map((e) => e.kind);

describe("kiosk with every seat's rules loaded", () => {
  it("one press at an empty kiosk buys one part and leaves it lying there", () => {
    const s = campusAtKiosk(40);
    tick(s, PRESS);
    expect(s.credits).toBe(40 - KIOSK_PRICE);
    expect(s.parts).toHaveLength(1);
    expect(s.players[0].carrying).toBeNull();
    expect(kinds(s)).toEqual(["kiosk_bought"]);
  });

  it("the next press picks the bought part up instead of buying again", () => {
    const s = campusAtKiosk(40);
    tick(s, PRESS);
    const bought = s.parts[0].part;
    tick(s, PRESS, NOW + 100);
    expect(s.players[0].carrying).toBe(bought);
    expect(s.parts).toHaveLength(0);
    expect(s.credits).toBe(40 - KIOSK_PRICE);
    expect(kinds(s)).toEqual(["kiosk_bought", "part_picked"]);
  });

  it("buying while carrying keeps the carried part in hand", () => {
    const s = campusAtKiosk(40, "camera");
    tick(s, PRESS);
    expect(s.players[0].carrying).toBe("camera");
    expect(s.parts).toHaveLength(1);
    expect(kinds(s)).toEqual(["kiosk_bought"]);
  });

  it("a crew that can't pay gets nothing, and the press doesn't drop what they carry", () => {
    const s = campusAtKiosk(KIOSK_PRICE - 1, "camera");
    tick(s, PRESS);
    expect(s.credits).toBe(KIOSK_PRICE - 1);
    expect(s.parts).toHaveLength(0);
    expect(s.players[0].carrying).toBe("camera");
    expect(s.log).toEqual([]);
  });

  it("no press, no purchase", () => {
    const s = campusAtKiosk(40);
    tick(s, STILL);
    expect(s.credits).toBe(40);
    expect(s.parts).toHaveLength(0);
  });

  it("a downed player can't buy", () => {
    const s = campusAtKiosk(40);
    s.players[0].down = true;
    tick(s, PRESS);
    expect(s.credits).toBe(40);
  });

  it("a press away from the kiosk never buys", () => {
    const s = campusAtKiosk(40);
    s.players[0].x -= 300;
    tick(s, PRESS);
    expect(s.credits).toBe(40);
    expect(kinds(s)).not.toContain("kiosk_bought");
  });
});
