import { describe, expect, it } from "vitest";
import { KIOSK_PRICE } from "../build/kiosk";
import type { Input } from "../core/input";
import { mapFor } from "../core/map";
import { enterPhase } from "../core/phases";
import { createState, type GameState } from "../core/state";
import { step } from "../core/step";
import { partName } from "../data/data";
import "../register"; // every seat's rules, so each prompt is checked against what E really does
import { ePrompt } from "./prompt";
import { SURFACE } from "./surface";
import { player, STILL } from "./testing";

const PRESS: Input = { ...STILL, interact: true };
const OPEN = { x: 1000, y: 1150 };
let clock = 90_000_000;

function campus(at: { x: number; y: number } = OPEN, carrying: string | null = null, credits = 100): GameState {
  const s = createState(48213, "mars");
  s.phase = "campus";
  s.phaseEndsAt = 1e12;
  s.runStartedAt = clock += 1_000_000;
  s.credits = credits;
  s.players = [player("p1", 0, 0, { carrying })];
  step(s, { p1: STILL }, clock, 1 / 60);
  s.parts = [];
  s.log = [];
  Object.assign(s.players[0], at);
  return s;
}
const press = (s: GameState) => step(s, { p1: PRESS }, (clock += 100), 1 / 60);
const me = (s: GameState) => s.players[0];
const kinds = (s: GameState) => s.log.map((e) => e.kind);

describe("the E prompt for seat 3's HUD (S2-15)", () => {
  it("says nothing on open ground with empty hands, and E does nothing there", () => {
    const s = campus();
    expect(ePrompt(s, me(s))).toBeNull();
    press(s);
    expect(s.log).toEqual([]);
  });

  it("offers a part in reach by name and mass, and E picks it up", () => {
    const s = campus();
    s.parts.push({ id: "x", part: "solid-motor", x: OPEN.x + 20, y: OPEN.y });
    expect(ePrompt(s, me(s))).toBe(`[E] pick up ${partName("solid-motor")} 180 kg`);
    press(s);
    expect(me(s).carrying).toBe("solid-motor");
  });

  it("offers a swap while carrying, and a put-down with nothing in reach", () => {
    const s = campus(OPEN, "camera");
    expect(ePrompt(s, me(s))).toBe(`[E] put down ${partName("camera")}`);
    s.parts.push({ id: "x", part: "rtg", x: OPEN.x + 10, y: OPEN.y });
    expect(ePrompt(s, me(s))).toBe(`[E] swap for ${partName("rtg")} 110 kg`);
    press(s);
    expect(kinds(s)).toEqual(["part_dropped", "part_picked"]);
  });

  it("at the pad: mount when carrying, else start and then stop the countdown", () => {
    const pad = mapFor("campus").pad;
    const s = campus({ x: pad.x, y: pad.y + 20 }, "rtg");
    expect(ePrompt(s, me(s))).toBe(`[E] mount ${partName("rtg")}`);
    press(s);
    expect(s.ship.slots.power).toBe("rtg");
    expect(ePrompt(s, me(s))).toBe("[E] start the launch countdown");
    press(s);
    expect(s.launchAt).not.toBeNull();
    expect(ePrompt(s, me(s))).toBe("[E] stop the countdown");
  });

  it("at the kiosk: buy, then pick up what was bought, and say so when the crew can't pay", () => {
    const kiosk = mapFor("campus").kiosk;
    const s = campus({ x: kiosk.x, y: kiosk.y + 10 });
    expect(ePrompt(s, me(s))).toBe(`[E] buy a part, ${KIOSK_PRICE} credits`);
    press(s);
    expect(kinds(s)).toEqual(["kiosk_bought"]);
    expect(ePrompt(s, me(s))).toMatch(/^\[E\] pick up /);
    press(s);
    expect(me(s).carrying).not.toBeNull();

    const broke = campus({ x: kiosk.x, y: kiosk.y + 10 }, null, 0);
    expect(ePrompt(broke, me(broke))).toMatch(/not enough/);
    press(broke);
    expect(broke.log).toEqual([]);
  });

  it("says nothing for a downed player", () => {
    const s = campus();
    s.parts.push({ id: "x", part: "rtg", x: OPEN.x, y: OPEN.y });
    me(s).down = true;
    expect(ePrompt(s, me(s))).toBeNull();
  });

  it("on the surface: a job first, and nothing more once it is running", () => {
    const s = createState(48213, "mars");
    s.players.push(player("p1"));
    clock += 1_000_000;
    enterPhase(s, "brief", clock);
    enterPhase(s, "surface", clock);
    step(s, { p1: STILL }, clock, 1 / 60);
    const site = SURFACE.sites[0];
    Object.assign(me(s), { x: site.x, y: site.y + 10 });
    expect(ePrompt(s, me(s))).toBe("[E] scan this site");
    press(s);
    expect(s.surface.tasks.p1?.kind).toBe("scan");
    expect(ePrompt(s, me(s))).toBeNull();
  });

  it("says nothing outside the campus and the surface", () => {
    const s = campus();
    s.phase = "flight";
    s.parts.push({ id: "x", part: "rtg", x: OPEN.x, y: OPEN.y });
    expect(ePrompt(s, me(s))).toBeNull();
  });
});
