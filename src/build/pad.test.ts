import { describe, expect, it } from "vitest";
import "../build/build.register"; // seat 1's launch rule, loaded first, as the real startup does
import { nearest } from "../core/map";
import { enterPhase } from "../core/phases";
import { createState, type Slot } from "../core/state";
import { step } from "../core/step";
import { CAMPUS } from "../ground/campus";
import { PAD_REACH, PICK_REACH } from "../ground/carry";
import "../ground/ground.register";
import { groundScene } from "../ground/scene";
import { isOpen, player, reachable, recordingCtx, STILL } from "../ground/testing";
import { dropSpot, mountCarried, SLOTS, slotOf, slotSpot } from "./pad";

const E = { ...STILL, interact: true };
const pad = CAMPUS.pad;
const AT_PAD = { x: pad.x, y: pad.y + 30 };
let clock = 5_000_000;

/** a campus run past its first tick, with one player at the pad carrying `carrying` */
function atPad(carrying: string | null) {
  const s = createState(1, "mars");
  s.players.push(player("a"));
  clock += 1_000_000;
  enterPhase(s, "brief", clock);
  enterPhase(s, "campus", clock);
  s.parts = []; // seat 1's spawns put parts on the map at campus entry; these tests want a bare pad
  step(s, {}, clock, 0.016);
  Object.assign(s.players[0], AT_PAD, { carrying });
  return s;
}
const press = (s: ReturnType<typeof atPad>) => step(s, { a: E }, (clock += 100), 0.016);

describe("pad slots", () => {
  it("knows each rocket part's slot from the catalog, and nothing else's", () => {
    expect(slotOf("rtg")).toBe("power");
    expect(slotOf("laser")).toBe("comms");
    expect(slotOf("sample")).toBeNull();
  });

  it.each([
    ["propulsion", "ion-drive"],
    ["power", "rtg"],
    ["comms", "high-gain"],
    ["payload", "radar"],
  ] as [Slot, string][])("mounts a carried part into the %s slot with E at the pad", (slot, part) => {
    const s = atPad(part);
    press(s);
    expect(s.ship.slots[slot]).toBe(part);
    expect(s.players[0].carrying).toBeNull();
    expect(s.log).toMatchObject([{ kind: "part_mounted", part, player: "a", phase: "campus" }]);
  });

  it("swaps a second part into a full slot, dropping the old one beside the pad", () => {
    const s = atPad("small-solar");
    press(s);
    s.players[0].carrying = "rtg";
    press(s);
    expect(s.ship.slots.power).toBe("rtg");
    expect(s.parts).toMatchObject([{ part: "small-solar", ...dropSpot(pad, "power") }]);
    expect(s.log.map((e) => [e.kind, e.part])).toEqual([
      ["part_mounted", "small-solar"],
      ["part_swapped", "small-solar"],
      ["part_mounted", "rtg"],
    ]);
  });

  it("lets the crew pick the swapped-out part back up", () => {
    const s = atPad("small-solar");
    press(s);
    s.players[0].carrying = "rtg";
    press(s);
    const dropped = s.parts[0];
    Object.assign(s.players[0], { x: dropped.x, y: dropped.y + PICK_REACH / 2 });
    expect(nearest([pad], s.players[0], PAD_REACH)).toBeNull();
    press(s);
    expect(s.players[0].carrying).toBe("small-solar");
  });

  it("does not start the launch countdown with the same press that mounts", () => {
    const s = atPad("rtg");
    press(s);
    expect(s.launchAt).toBeNull();
    expect(s.log.map((e) => e.kind)).not.toContain("launch_started");
  });

  it("leaves an empty-handed press at the pad to the launch countdown", () => {
    const s = atPad(null);
    press(s);
    expect(s.launchAt).not.toBeNull();
    expect(s.log.map((e) => e.kind)).toEqual(["launch_started"]);
  });

  it("ignores a carried thing that isn't a rocket part", () => {
    const s = atPad("sample");
    expect(mountCarried(s, s.players[0], clock)).toBe(false);
    expect(s.ship.slots).toEqual({ propulsion: null, power: null, comms: null, payload: null });
    expect(s.log).toEqual([]);
  });

  it("does nothing away from the pad, for a downed player, or without E", () => {
    const away = atPad("rtg");
    Object.assign(away.players[0], { x: pad.x, y: pad.y + PAD_REACH + 20 });
    press(away);
    expect(away.ship.slots.power).toBeNull();

    const down = atPad("rtg");
    down.players[0].down = true;
    press(down);
    expect(down.ship.slots.power).toBeNull();

    const still = atPad("rtg");
    step(still, { a: STILL }, (clock += 100), 0.016);
    expect(still.ship.slots.power).toBeNull();
  });

  it("puts every slot display and drop spot on open ground the crew can reach, drops outside the pad zone", () => {
    const drops = SLOTS.map((slot) => dropSpot(pad, slot));
    for (const d of drops) {
      expect(isOpen(CAMPUS, d), `${d.x},${d.y}`).toBe(true);
      expect(Math.hypot(d.x - pad.x, d.y - pad.y)).toBeGreaterThan(PAD_REACH + PICK_REACH / 2);
    }
    for (const slot of SLOTS) expect(isOpen(CAMPUS, slotSpot(pad, slot))).toBe(true);
    expect(reachable(CAMPUS, CAMPUS.starts[0], drops).every(Boolean)).toBe(true);
  });

  it("draws each slot with its mounted part, and the countdown while it runs", () => {
    const s = atPad("rtg");
    press(s);
    s.players[0].carrying = null;
    press(s); // starts the countdown
    const r = recordingCtx();
    groundScene("campus").draw(r.ctx, s, { playerId: "a", now: clock });
    expect(r.texts()).toEqual(expect.arrayContaining(["power", "empty", "Launch in 5"]));
    // the rtg fills the power slot, so only the other three say empty
    expect(r.texts().filter((t) => t === "empty")).toHaveLength(3);
  });
});
