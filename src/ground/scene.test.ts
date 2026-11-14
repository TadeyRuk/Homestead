import { describe, expect, it } from "vitest";
import { createState } from "../core/state";
import { groundScene } from "./scene";
import { player, recordingCtx } from "./testing";
import { edgeWalls, registerGround, type CampusMap, type SurfaceGround } from "./world";

// a campus-sized field with the pad in the far corner
const FIELD: CampusMap & SurfaceGround = {
  width: 3072,
  height: 1728,
  walls: edgeWalls(3072, 1728),
  floors: [],
  labels: [],
  starts: [{ x: 2900, y: 200 }],
  spawnPoints: [],
  pad: { x: 2900, y: 200 },
  kiosk: { x: 1500, y: 1500 },
  lander: { x: 1536, y: 864 },
  sites: [],
};
registerGround("campus", FIELD);
registerGround("surface", FIELD);

function crew() {
  const s = createState(1, "mars");
  s.phase = "campus";
  s.players.push(player("a", 300, 1500), player("b", 2800, 300));
  return s;
}

describe("ground scene camera", () => {
  it("shows each player their own part of the map", () => {
    const s = crew();
    const a = recordingCtx();
    const b = recordingCtx();
    groundScene("campus").draw(a.ctx, s, { playerId: "a", now: 0 });
    groundScene("campus").draw(b.ctx, s, { playerId: "b", now: 0 });
    expect(a.first("translate")).toEqual([-0, -(1728 - 540)]);
    expect(b.first("translate")).toEqual([-(3072 - 960), -30]);
  });

  it("points a player far from the pad back to it, with the distance", () => {
    const r = recordingCtx();
    groundScene("campus").draw(r.ctx, crew(), { playerId: "a", now: 0 });
    expect(r.texts().some((t) => /^Pad \d+ m$/.test(t))).toBe(true);
  });

  it("hides the arrow once the pad is on screen", () => {
    const r = recordingCtx();
    groundScene("campus").draw(r.ctx, crew(), { playerId: "b", now: 0 });
    expect(r.texts().some((t) => t.startsWith("Pad "))).toBe(false);
  });

  it("points at the lander on the surface", () => {
    const s = crew();
    s.phase = "surface";
    const r = recordingCtx();
    groundScene("surface").draw(r.ctx, s, { playerId: "a", now: 0 });
    expect(r.texts().some((t) => /^Lander \d+ m$/.test(t))).toBe(true);
  });

  it("restores the canvas, so the timer core draws next lands in screen space", () => {
    const r = recordingCtx();
    groundScene("campus").draw(r.ctx, crew(), { playerId: "a", now: 0 });
    const saves = r.calls.filter((c) => c.name === "save").length;
    const restores = r.calls.filter((c) => c.name === "restore").length;
    expect(saves).toBe(restores);
  });
});
