import { describe, expect, it } from "vitest";
import { mapFor } from "../core/map";
import { createState } from "../core/state";
import { CAMPUS } from "./campus";
import "./ground.register";
import { groundScene } from "./scene";
import { isOpen, player, reachable, recordingCtx } from "./testing";

const pad = CAMPUS.pad!;
const kiosk = CAMPUS.kiosk!;

describe("campus map", () => {
  it("is what every seat gets from mapFor('campus')", () => {
    expect(mapFor("campus")).toBe(CAMPUS);
  });

  it("is several screens wide, so one screen shows about a tenth of it", () => {
    expect(CAMPUS.width / 960).toBeGreaterThanOrEqual(3);
    expect((960 * 540) / (CAMPUS.width * CAMPUS.height)).toBeLessThan(0.11);
  });

  it("has about a dozen spawn points, all on open ground inside the map", () => {
    expect(CAMPUS.spawnPoints).toHaveLength(12);
    // a little room round each, so a part never looks wedged into a wall
    for (const p of CAMPUS.spawnPoints) expect(isOpen(CAMPUS, p, 12), `${p.x},${p.y}`).toBe(true);
  });

  it("spreads the spawn points out, so the crew has to split up", () => {
    const pts = CAMPUS.spawnPoints;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        expect(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y), `${i} and ${j}`).toBeGreaterThanOrEqual(300);
      }
    }
    // slide a screen across the map; it never catches more than three
    for (let x = 0; x <= CAMPUS.width - 960; x += 64) {
      for (let y = 0; y <= CAMPUS.height - 540; y += 54) {
        const seen = pts.filter((p) => p.x >= x && p.x < x + 960 && p.y >= y && p.y < y + 540);
        expect(seen.length, `screen at ${x},${y}`).toBeLessThanOrEqual(3);
      }
    }
  });

  it("puts the pad, the kiosk and the crew's start points on open ground", () => {
    for (const p of [pad, kiosk, ...CAMPUS.starts]) expect(isOpen(CAMPUS, p), `${p.x},${p.y}`).toBe(true);
    expect(CAMPUS.starts.length).toBeGreaterThanOrEqual(4);
  });

  it("starts the crew at the pad", () => {
    for (const s of CAMPUS.starts) expect(Math.hypot(s.x - pad.x, s.y - pad.y)).toBeLessThan(120);
  });

  it("lets the crew walk from the pad to every spawn point and the kiosk", () => {
    const targets = [...CAMPUS.spawnPoints, kiosk, ...CAMPUS.starts];
    const ok = reachable(CAMPUS, pad, targets);
    expect(targets.filter((_, i) => !ok[i])).toEqual([]);
  });

  it("keeps the kiosk well away from the pad, so buying costs a walk", () => {
    expect(Math.hypot(kiosk.x - pad.x, kiosk.y - pad.y)).toBeGreaterThan(500);
  });

  it("draws the pad and the kiosk in the campus phase", () => {
    const s = createState(1, "mars");
    s.phase = "campus";
    s.players.push(player("a", 2300, 700)); // pad and kiosk both on this screen
    const r = recordingCtx();
    groundScene("campus").draw(r.ctx, s, { playerId: "a", now: 0 });
    expect(r.texts()).toEqual(expect.arrayContaining(["Launch pad", "Kiosk"]));
  });
});
