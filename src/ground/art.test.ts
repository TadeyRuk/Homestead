import { describe, expect, it } from "vitest";
import { createState } from "../core/state";
import { CAMPUS } from "./campus";
import { CAMPUS_PALETTE, drawGround, partLabel, ROLE_COLOURS } from "./draw";
import "./ground.register";
import { groundScene } from "./scene";
import { SURFACE } from "./surface";
import { player, recordingCtx } from "./testing";
import { ROLE_COLOUR } from "../ui/tokens";

// S2-15: the code-drawn art pass after the proposal mocks

describe("art direction (#85)", () => {
  it("knows what every wall is, so a tree draws as a tree and a rock as a rock", () => {
    for (const map of [CAMPUS, SURFACE]) expect(map.walls.filter((w) => !w.kind)).toEqual([]);
    const kinds = (m: typeof CAMPUS | typeof SURFACE) => new Set(m.walls.map((w) => w.kind));
    expect([...kinds(CAMPUS)].sort()).toEqual(["booth", "building", "crate", "dish", "edge", "rocket", "tree"]);
    expect([...kinds(SURFACE)].sort()).toEqual(["edge", "ridge", "rim", "rock"]);
  });

  it("uses seat 3's role colours, so a role reads the same on the map and in the HUD", () => {
    expect(ROLE_COLOURS).toEqual(ROLE_COLOUR);
  });

  it("scatters ground detail only where the camera looks, so a frame stays cheap", () => {
    const whole = recordingCtx();
    drawGround(whole.ctx, CAMPUS, CAMPUS_PALETTE);
    const view = recordingCtx();
    drawGround(view.ctx, CAMPUS, CAMPUS_PALETTE, { x: 1000, y: 600, w: 960, h: 540 });
    const fills = (r: ReturnType<typeof recordingCtx>) => r.calls.filter((c) => c.name === "fillRect").length;
    expect(fills(view)).toBeLessThan(fills(whole) / 3);
  });

  it("is the same scatter every frame, with no randomness", () => {
    const a = recordingCtx();
    const b = recordingCtx();
    drawGround(a.ctx, SURFACE, CAMPUS_PALETTE, { x: 0, y: 0, w: 960, h: 540 });
    drawGround(b.ctx, SURFACE, CAMPUS_PALETTE, { x: 0, y: 0, w: 960, h: 540 });
    expect(a.calls).toEqual(b.calls);
  });

  it("names parts in tags by their readable name, capitalised even for the instruments", () => {
    expect(partLabel("seismometer")).toBe("Seismometer");
    expect(partLabel("solid-motor")).toBe("Solid motor");
  });

  it("marks a downed player in words as well as lying down", () => {
    const s = createState(1, "mars");
    s.phase = "campus";
    s.players.push(player("a", 1000, 1150), player("b", 1040, 1150, { down: true }));
    s.players[1].name = "Bea";
    const r = recordingCtx();
    groundScene("campus").draw(r.ctx, s, { playerId: "a", now: 0 });
    expect(r.texts()).toContain("Bea (down)");
  });
});
