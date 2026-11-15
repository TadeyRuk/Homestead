import { describe, expect, it } from "vitest";
import { mapFor } from "../core/map";
import { enterPhase } from "../core/phases";
import { createState, type MissionId } from "../core/state";
import { step } from "../core/step";
import { CAMPUS } from "./campus";
import { MARS_PALETTE, MOON_PALETTE, paletteFor } from "./draw";
import "./ground.register";
import { groundScene } from "./scene";
import { SURFACE } from "./surface";
import { isOpen, player, reachable, recordingCtx } from "./testing";

const lander = SURFACE.lander;
const dist = (p: { x: number; y: number }) => Math.hypot(p.x - lander.x, p.y - lander.y);
const rich = SURFACE.sites.filter((s) => s.rich);
const poor = SURFACE.sites.filter((s) => !s.rich);

describe("surface map", () => {
  it("is what every seat gets from mapFor('surface')", () => {
    expect(mapFor("surface")).toBe(SURFACE);
  });

  it("is as big as the campus, with the lander in the middle", () => {
    expect([SURFACE.width, SURFACE.height]).toEqual([CAMPUS.width, CAMPUS.height]);
    expect(lander).toEqual({ x: SURFACE.width / 2, y: SURFACE.height / 2 });
  });

  it("puts rich sites far from the lander and poor sites close", () => {
    expect(rich.length).toBeGreaterThanOrEqual(3); // Mars asks for three scans
    expect(poor.length).toBeGreaterThan(0);
    const nearestRich = Math.min(...rich.map(dist));
    const farthestPoor = Math.max(...poor.map(dist));
    expect(nearestRich).toBeGreaterThan(1000);
    expect(farthestPoor).toBeLessThan(500);
  });

  it("gives every site a unique id", () => {
    expect(new Set(SURFACE.sites.map((s) => s.id)).size).toBe(SURFACE.sites.length);
  });

  it("has a crater rim and a ridge that are solid", () => {
    const { crater } = SURFACE;
    // the top of the rim is a solid block, not one of the gaps
    const northRim = { x: crater.x, y: crater.y - crater.r };
    expect(isOpen(SURFACE, northRim)).toBe(false);
    expect(isOpen(SURFACE, { x: 600, y: 700 })).toBe(false); // on the ridge
  });

  it("puts the lander, sites, sample spots, deploy spot, bonus spots and starts on open ground", () => {
    const points = [
      lander,
      ...SURFACE.sites,
      ...SURFACE.starts,
      ...Object.values(SURFACE.sampleSites),
      SURFACE.deploySpot,
      ...SURFACE.bonusSpots,
      ...Object.values(SURFACE.gameSpots).flatMap((spots) => Object.values(spots)),
    ];
    for (const p of points) expect(isOpen(SURFACE, p), `${p.x},${p.y}`).toBe(true);
  });

  it("lets the crew walk from the lander to everything on the list, including into the crater", () => {
    const targets = [
      ...SURFACE.sites,
      ...Object.values(SURFACE.sampleSites),
      SURFACE.deploySpot,
      ...SURFACE.bonusSpots,
      ...Object.values(SURFACE.gameSpots).flatMap((spots) => Object.values(spots)),
    ];
    const ok = reachable(SURFACE, lander, targets);
    expect(targets.filter((_, i) => !ok[i])).toEqual([]);
  });

  it("keeps every minigame spot clear of the other spots, so one E press means one thing", () => {
    for (const mission of ["mars", "moon"] as const) {
      const others = [
        ...SURFACE.sites,
        SURFACE.sampleSites[mission],
        SURFACE.deploySpot,
        ...SURFACE.bonusSpots,
        ...SURFACE.starts,
      ];
      const games = Object.values(SURFACE.gameSpots).map((spots) => spots[mission]);
      for (const g of games) {
        for (const o of [...others, ...games.filter((x) => x !== g)]) {
          expect(Math.hypot(g.x - o.x, g.y - o.y), `${mission} ${g.x},${g.y} vs ${o.x},${o.y}`).toBeGreaterThan(80);
        }
      }
    }
  });

  it("puts the Moon's ice in the crater, and the panel spot beside the lander", () => {
    const { crater } = SURFACE;
    const ice = SURFACE.gameSpots["ice-drill"].moon;
    expect(Math.hypot(ice.x - crater.x, ice.y - crater.y)).toBeLessThan(crater.r - 40);
    const panel = SURFACE.gameSpots["panel-clean"].mars;
    expect(Math.hypot(panel.x - lander.x, panel.y - lander.y)).toBeLessThan(130);
  });

  it("puts the Mars core sample on the rim and the Moon sample on the crater floor", () => {
    const { crater } = SURFACE;
    const fromCentre = (p: { x: number; y: number }) => Math.hypot(p.x - crater.x, p.y - crater.y);
    expect(Math.abs(fromCentre(SURFACE.sampleSites.mars) - crater.r)).toBeLessThan(20);
    expect(fromCentre(SURFACE.sampleSites.moon)).toBeLessThan(crater.r / 2);
  });

  it("uses one layout with a palette per mission", () => {
    expect(paletteFor("surface", "moon")).toBe(MOON_PALETTE);
    expect(paletteFor("surface", "mars")).toBe(MARS_PALETTE);
  });
});

describe("surface phase", () => {
  let clock = 900_000;

  function land(mission: MissionId) {
    const s = createState(1, mission);
    s.players.push(player("a", 0, 0, { carrying: "rtg" }), player("b"));
    s.parts.push({ id: "s1", part: "camera", x: 10, y: 10 });
    clock += 10_000;
    enterPhase(s, "brief", clock);
    enterPhase(s, "surface", clock);
    step(s, {}, clock, 0.016);
    return s;
  }

  it("lands the crew round the lander with empty hands and no campus parts", () => {
    const s = land("mars");
    for (const p of s.players) {
      expect(dist(p)).toBeLessThan(120);
      expect(p.carrying).toBeNull();
    }
    // only the instrument waiting at the lander (S2-14), nothing from the campus
    expect(s.parts.map((x) => x.part)).toEqual(["weather-station"]);
  });

  it("draws the lander, the sites and the mission's own sample in the right palette", () => {
    for (const mission of ["moon", "mars"] as const) {
      const s = land(mission);
      Object.assign(s.players[0], { x: 1900, y: 900 }); // lander, the sample spot and a poor site on screen
      const r = recordingCtx();
      groundScene("surface").draw(r.ctx, s, { playerId: "a", now: 0 });
      expect(r.texts()).toEqual(expect.arrayContaining(["Lander", "Site", mission === "mars" ? "Core sample" : "Regolith"]));
    }
  });
});
