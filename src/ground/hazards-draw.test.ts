import { describe, expect, it } from "vitest";
import { PHASE_SECONDS } from "../core/phases";
import { createState, type GameState, type MissionId } from "../core/state";
import { hazardAt, type Hazard } from "./hazards";
import { groundScene } from "./scene";
import { SURFACE } from "./surface";
import { player, recordingCtx } from "./testing";
import "../register";

// #97: seat 6's hazards (#96) shown on the surface, drawn by seat 2's scene

const START = 70_000_000;
let run = 0;

function surface(mission: MissionId): GameState {
  const s = createState(48213, mission);
  s.phase = "surface";
  s.runStartedAt = START + ++run;
  s.phaseEndsAt = START + PHASE_SECONDS.surface * 1000;
  return s;
}

/** the first whole second of the surface when `test` holds */
function when(s: GameState, test: (h: Hazard | null) => boolean): number {
  for (let i = 0; i < PHASE_SECONDS.surface; i++) if (test(hazardAt(s, START + i * 1000))) return START + i * 1000;
  throw new Error("never");
}

function draw(s: GameState, now: number) {
  const r = recordingCtx();
  groundScene("surface").draw(r.ctx, s, { playerId: "a", now });
  return r;
}

type Call = { name: string; args: unknown[] };
const fullHeight = (c: Call) => c.name === "fillRect" && c.args[1] === 0 && c.args[3] === SURFACE.height;
/** the storm wall: a full-height strip as wide as the storm (the ground itself is a full-map fill) */
const wallStrip = (c: Call) => fullHeight(c) && c.args[2] === 700;
/** full-map fills: the ground, plus the flare tint while it burns */
const fullMap = (c: Call) => fullHeight(c) && c.args[0] === 0 && c.args[2] === SURFACE.width;

describe("hazards on the surface screen (#97)", () => {
  it("draws the Mars storm wall where the hazard says it is, and nothing while calm", () => {
    const s = surface("mars");
    s.players.push(player("a", 300, 300));
    const calm = draw(s, START);
    expect(calm.calls.filter(wallStrip)).toEqual([]);

    const t = when(s, (h) => h?.kind === "storm" && h.left > 800);
    const storm = hazardAt(s, t) as Extract<Hazard, { kind: "storm" }>;
    Object.assign(s.players[0], { x: storm.left + 100, y: 900 }); // the wall on screen
    const r = draw(s, t);
    expect(r.calls.filter(wallStrip).map((c) => c.args)).toEqual([[storm.left, 0, 700, SURFACE.height]]);
  });

  it("hides other players in the storm but keeps your own astronaut and suit bars on top", () => {
    const s = surface("mars");
    const t = when(s, (h) => h?.kind === "storm" && h.left > 800);
    const storm = hazardAt(s, t) as Extract<Hazard, { kind: "storm" }>;
    const inside = { x: storm.left + 300, y: 900 };
    s.players.push(player("a", inside.x, inside.y), player("b", inside.x + 40, inside.y));
    s.players[1].name = "Bea";
    const r = draw(s, t);
    const wall = r.calls.findIndex(wallStrip);
    expect(wall).toBeGreaterThan(-1);
    const after = r.calls.slice(wall + 1);
    const names = after.filter((c) => c.name === "fillText").map((c) => c.args[0]);
    expect(names).toContain(s.players[0].name);
    expect(names).not.toContain("Bea");
    // the suit bars are redrawn too, so you can see your oxygen while you walk out
    expect(after.filter((c) => c.name === "fillRect").length).toBeGreaterThan(4);
  });

  it("tints the Moon only while the flare burns, not during its warning", () => {
    const s = surface("moon");
    s.players.push(player("a", 1000, 900));
    const fills = (now: number) => draw(s, now).calls.filter(fullMap).length;
    const calm = fills(START);
    expect(fills(when(s, (h) => h?.kind === "flare" && h.stage === "warning"))).toBe(calm);
    expect(fills(when(s, (h) => h?.kind === "flare" && h.stage === "active"))).toBe(calm + 1);
  });

  it("leaves the campus alone", () => {
    const s = surface("mars");
    s.phase = "campus";
    s.players.push(player("a", 1000, 900));
    const r = recordingCtx();
    groundScene("campus").draw(r.ctx, s, { playerId: "a", now: when(surface("mars"), (h) => h?.kind === "storm") });
    expect(r.calls.filter(wallStrip)).toEqual([]);
  });

  it("restores the canvas, so the HUD draws in screen space", () => {
    const s = surface("mars");
    s.players.push(player("a", 1000, 900));
    const r = draw(s, when(s, (h) => h?.kind === "storm"));
    const count = (n: string) => r.calls.filter((c) => c.name === n).length;
    expect(count("save")).toBe(count("restore"));
  });
});
