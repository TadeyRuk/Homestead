import { describe, expect, it } from "vitest";
import { placePart } from "../core/parts";
import { enterPhase } from "../core/phases";
import { createState } from "../core/state";
import { step } from "../core/step";
import { CAMPUS } from "./campus";
import { KIOSK_REACH, PAD_REACH, PICK_REACH } from "./carry";
import "./ground.register";
import { groundScene } from "./scene";
import { player, recordingCtx, STILL } from "./testing";

const E = { ...STILL, interact: true };
const OPEN = { x: 1000, y: 1150 }; // a spawn point in open ground, far from the pad and kiosk
let clock = 50_000;

/** a campus run past its first tick, with one player standing at `at` */
function campus(at = OPEN, extra = {}) {
  const s = createState(1, "mars");
  s.players.push(player("a"));
  clock += 10_000;
  enterPhase(s, "brief", clock);
  enterPhase(s, "campus", clock);
  step(s, {}, clock, 0.016); // places the crew
  Object.assign(s.players[0], at, extra);
  return s;
}
const press = (s: ReturnType<typeof campus>, id = "a") => step(s, { [id]: E }, (clock += 100), 0.016);
const kinds = (s: ReturnType<typeof campus>) => s.log.map((e) => e.kind);

describe("carrying", () => {
  it("picks up a part in reach with E and logs part_picked", () => {
    const s = campus();
    s.parts.push({ id: "lp1", part: "rtg", x: OPEN.x + 20, y: OPEN.y });
    press(s);
    expect(s.players[0].carrying).toBe("rtg");
    expect(s.parts).toEqual([]);
    expect(s.log).toMatchObject([{ kind: "part_picked", part: "rtg", player: "a", phase: "campus" }]);
  });

  it("carries the part across the map", () => {
    const s = campus();
    s.parts.push({ id: "lp1", part: "rtg", x: OPEN.x, y: OPEN.y });
    press(s);
    for (let i = 0; i < 30; i++) step(s, { a: { ...STILL, dx: 1 } }, (clock += 100), 0.1);
    expect(s.players[0].x).toBeGreaterThan(OPEN.x + 400);
    expect(s.players[0].carrying).toBe("rtg");
  });

  it("drops the carried part where the player stands with E and logs part_dropped", () => {
    const s = campus(OPEN, { carrying: "camera" });
    press(s);
    expect(s.players[0].carrying).toBeNull();
    expect(s.parts).toMatchObject([{ id: expect.stringMatching(/^d\d+$/), part: "camera", x: OPEN.x, y: OPEN.y }]);
    expect(s.log).toMatchObject([{ kind: "part_dropped", part: "camera", player: "a" }]);
  });

  it("swaps: picking up a second part drops the first beside you", () => {
    const s = campus(OPEN, { carrying: "camera" });
    s.parts.push({ id: "lp1", part: "rtg", x: OPEN.x + 10, y: OPEN.y });
    press(s);
    expect(s.players[0].carrying).toBe("rtg");
    expect(s.parts).toMatchObject([{ part: "camera", x: OPEN.x, y: OPEN.y }]);
    expect(kinds(s)).toEqual(["part_dropped", "part_picked"]);
  });

  it("takes the nearest of two parts in reach", () => {
    const s = campus();
    s.parts.push({ id: "far", part: "camera", x: OPEN.x + 25, y: OPEN.y }, { id: "near", part: "rtg", x: OPEN.x + 5, y: OPEN.y });
    press(s);
    expect(s.players[0].carrying).toBe("rtg");
    expect(s.parts.map((p) => p.id)).toEqual(["far"]);
  });

  it("ignores parts out of reach", () => {
    const s = campus();
    s.parts.push({ id: "lp1", part: "rtg", x: OPEN.x + PICK_REACH + 5, y: OPEN.y });
    press(s);
    expect(s.players[0].carrying).toBeNull();
    expect(s.log).toEqual([]);
  });

  it("does nothing on E with empty hands and nothing near", () => {
    const s = campus();
    press(s);
    expect(s.log).toEqual([]);
  });

  it("only acts on a press, not every tick", () => {
    const s = campus(OPEN, { carrying: "camera" });
    press(s);
    step(s, { a: STILL }, (clock += 100), 0.016);
    expect(s.players[0].carrying).toBeNull();
    expect(s.parts).toHaveLength(1);
  });

  it("gives every dropped piece its own id, so two of one part can lie on the map", () => {
    const s = campus(OPEN, { carrying: "camera" });
    press(s); // drop
    press(s); // pick it back up
    press(s); // drop again
    s.parts.push({ id: "other", part: "camera", x: 0, y: 0 });
    expect(new Set(s.parts.map((p) => p.id)).size).toBe(s.parts.length);
  });

  it("lets a downed player do nothing", () => {
    const s = campus(OPEN, { down: true });
    s.parts.push({ id: "lp1", part: "rtg", x: OPEN.x, y: OPEN.y });
    press(s);
    expect(s.players[0].carrying).toBeNull();
  });

  it("leaves E at the pad to mounting and the countdown", () => {
    const pad = CAMPUS.pad;
    const s = campus({ x: pad.x, y: pad.y + PAD_REACH - 10 }, { carrying: "camera" });
    press(s);
    expect(s.players[0].carrying).toBe("camera");
    expect(s.log).toEqual([]);
  });

  it("leaves E at the kiosk to buying when nothing is lying there", () => {
    const kiosk = CAMPUS.kiosk;
    const s = campus({ x: kiosk.x, y: kiosk.y + KIOSK_REACH - 10 }, { carrying: "camera" });
    press(s);
    expect(s.players[0].carrying).toBe("camera");
    expect(s.parts).toEqual([]);
  });

  it("picks up a part bought at the kiosk, which lands on the kiosk itself", () => {
    const kiosk = CAMPUS.kiosk;
    const s = campus({ x: kiosk.x, y: kiosk.y + 10 });
    placePart(s, "rtg", kiosk, "k"); // what buyFromKiosk does
    press(s);
    expect(s.players[0].carrying).toBe("rtg");
    expect(s.parts).toEqual([]);
  });

  it("works for two players at once", () => {
    const s = campus();
    s.players.push(player("b", OPEN.x + 300, OPEN.y));
    s.parts.push({ id: "x", part: "rtg", x: OPEN.x, y: OPEN.y }, { id: "y", part: "camera", x: OPEN.x + 300, y: OPEN.y });
    step(s, { a: E, b: E }, (clock += 100), 0.016);
    expect(s.players.map((p) => p.carrying)).toEqual(["rtg", "camera"]);
  });

  it("draws loose parts on the map", () => {
    const s = campus();
    s.parts.push({ id: "lp1", part: "rtg", x: OPEN.x + 50, y: OPEN.y });
    const r = recordingCtx();
    groundScene("campus").draw(r.ctx, s, { playerId: "a", now: 0 });
    expect(r.texts()).toContain("rtg");
  });
});
