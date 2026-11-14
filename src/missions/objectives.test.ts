import { describe, expect, it } from "vitest";
import type { Input } from "../core/input";
import type { Point } from "../core/map";
import { enterPhase } from "../core/phases";
import { createState, type MissionId } from "../core/state";
import { step } from "../core/step";
import "../ground/ground.register";
import { groundScene } from "../ground/scene";
import { SURFACE } from "../ground/surface";
import { player, recordingCtx, STILL } from "../ground/testing";
import { bonusSpot, objectiveLines, OBJECTIVES } from "./objectives";
import { missionList, RICH_FACTOR, scanStats, uplinkRate } from "./stats";

const E: Input = { ...STILL, interact: true };
const lander = SURFACE.lander;
const rich = SURFACE.sites.filter((s) => s.rich);
const poor = SURFACE.sites.filter((s) => !s.rich);
let clock = 50_000_000;

function landed(mission: MissionId = "mars", ship: Partial<Record<"payload" | "comms" | "power", string>> = {}) {
  const s = createState(7, mission);
  s.players.push(player("a"), player("b"));
  s.ship.slots = { propulsion: "chemical-engine", power: "rtg", comms: "high-gain", payload: "spectrometer", ...ship };
  s.data.target = mission === "mars" ? 40 : 25;
  clock += 1_000_000;
  enterPhase(s, "brief", clock);
  enterPhase(s, "surface", clock);
  step(s, {}, clock, 0.016);
  return s;
}
type S = ReturnType<typeof landed>;
const at = (s: S, id: string, p: Point) => Object.assign(s.players.find((x) => x.id === id)!, { x: p.x, y: p.y });
const press = (s: S, id = "a") => step(s, { [id]: E }, (clock += 100), 0.016);
function wait(s: S, seconds: number) {
  for (let t = 0; t < seconds; t += 0.25) step(s, {}, (clock += 250), 0.25);
}
const kinds = (s: S, kind: string) => s.log.filter((e) => e.kind === kind);

describe("starting the surface", () => {
  it("puts every objective on the list as not done, and the instrument at the lander", () => {
    const s = landed("mars");
    expect(s.objectives).toEqual(Object.fromEntries(OBJECTIVES.map((id) => [id, false])));
    const instrument = s.parts.find((x) => x.part === "weather-station")!;
    expect(Math.hypot(instrument.x - lander.x, instrument.y - lander.y)).toBeLessThan(80);
    expect(landed("moon").parts.map((x) => x.part)).toEqual(["seismometer"]);
  });

  it("picks the bonus spot from the seed, the same every time", () => {
    expect(landed().surface.bonusSpot).toBe(landed().surface.bonusSpot);
    expect(SURFACE.bonusSpots).toContainEqual(bonusSpot(landed()));
  });
});

describe("scanning", () => {
  it("scans a rich site with E over the payload's scan time, and the data goes into the scanner's hands", () => {
    const s = landed();
    at(s, "a", rich[0]);
    press(s);
    expect(s.surface.tasks.a).toMatchObject({ kind: "scan", target: rich[0].id });
    wait(s, scanStats("spectrometer").seconds - 0.5);
    expect(s.surface.scanned).toEqual([]);
    wait(s, 1);
    const data = scanStats("spectrometer").data * RICH_FACTOR;
    expect(s.surface.scanned).toEqual([rich[0].id]);
    expect(s.surface.held.a).toBe(data);
    expect(s.data.collected).toBe(data);
    expect(s.data.uplinked).toBe(0); // only counts once it reaches the lander
    expect(kinds(s, "site_scanned")).toEqual([
      expect.objectContaining({ player: "a", part: "spectrometer", value: data, phase: "surface" }),
    ]);
  });

  it("takes longer and gives more with a radar than a camera", () => {
    expect(scanStats("radar").seconds).toBeGreaterThan(scanStats("camera").seconds);
    expect(scanStats("radar").data).toBeGreaterThan(scanStats("camera").data);
  });

  it("gives less data from an instrument damaged in flight", () => {
    const s = landed();
    s.ship.instrumentHealth = 0.5;
    at(s, "a", rich[0]);
    press(s);
    wait(s, 10);
    expect(s.surface.held.a).toBe(Math.round(scanStats("spectrometer").data * RICH_FACTOR * 0.5));
  });

  it("gives a poor site data but no credit toward the scan objective", () => {
    const s = landed();
    for (const site of poor) {
      at(s, "a", site);
      press(s);
      wait(s, 5);
    }
    expect(s.surface.scanned).toHaveLength(poor.length);
    expect(s.objectives.scan).toBe(false);
    expect(s.surface.held.a).toBe(scanStats("spectrometer").data * poor.length);
  });

  it("scans a site only once", () => {
    const s = landed();
    at(s, "a", rich[0]);
    press(s);
    wait(s, 5);
    press(s);
    wait(s, 5);
    expect(kinds(s, "site_scanned")).toHaveLength(1);
  });

  it("cancels a scan when the player walks away", () => {
    const s = landed();
    at(s, "a", rich[0]);
    press(s);
    wait(s, 1);
    at(s, "a", { x: rich[0].x + 200, y: rich[0].y });
    wait(s, 5);
    expect(s.surface.tasks.a).toBeUndefined();
    expect(s.surface.scanned).toEqual([]);
  });

  it("flips the scan flag once enough rich sites are scanned, and logs it once", () => {
    const s = landed("mars"); // Mars wants three
    for (const site of rich.slice(0, missionList("mars").scans)) {
      at(s, "a", site);
      press(s);
      wait(s, 5);
    }
    expect(s.objectives.scan).toBe(true);
    at(s, "a", rich[3]);
    press(s);
    wait(s, 5);
    expect(kinds(s, "objective_done").filter((e) => e.objective === "scan")).toHaveLength(1);
  });

  it("does not pick up or drop anything with the press that starts a scan", () => {
    const s = landed();
    at(s, "a", rich[0]);
    s.players[0].carrying = "weather-station";
    press(s);
    expect(s.players[0].carrying).toBe("weather-station");
    expect(kinds(s, "part_dropped")).toEqual([]);
  });
});

describe("uplink", () => {
  it("sends held data at the lander at the antenna's rate, and logs one batch", () => {
    const s = landed("mars", { comms: "high-gain" });
    s.surface.held.a = 8;
    at(s, "a", lander);
    wait(s, 1);
    expect(s.data.uplinked).toBeCloseTo(uplinkRate("high-gain"), 5);
    wait(s, 5);
    expect(s.data.uplinked).toBeCloseTo(8, 5);
    expect(s.surface.held.a).toBe(0);
    expect(kinds(s, "data_uplinked")).toEqual([expect.objectContaining({ player: "a", part: "high-gain", value: 8 })]);
  });

  it("is slower through a weaker antenna", () => {
    expect(uplinkRate("laser")).toBeGreaterThan(uplinkRate("high-gain"));
    expect(uplinkRate("high-gain")).toBeGreaterThan(uplinkRate("low-gain"));
    expect(uplinkRate("low-gain")).toBeGreaterThan(uplinkRate("salvage-antenna"));
  });

  it("ends a batch when the player walks off mid-send, keeping the rest in hand", () => {
    const s = landed("mars", { comms: "low-gain" });
    s.surface.held.a = 10;
    at(s, "a", lander);
    wait(s, 2);
    at(s, "a", rich[0]);
    wait(s, 1);
    expect(s.surface.held.a).toBeCloseTo(10 - uplinkRate("low-gain") * 2, 5);
    expect(kinds(s, "data_uplinked")).toHaveLength(1);
  });

  it("never sends data a player is holding away from the lander", () => {
    const s = landed();
    s.surface.held.a = 10;
    at(s, "a", rich[0]);
    wait(s, 5);
    expect(s.data.uplinked).toBe(0);
  });

  it("logs a batch still sending when the surface ends, so the log adds up to the uplinked total", () => {
    const s = landed("mars", { comms: "low-gain" });
    s.surface.held.a = 30;
    at(s, "a", lander);
    s.phaseEndsAt = clock + 3_000; // the extraction ship arrives mid-send
    wait(s, 4);
    expect(s.phase).toBe("report");
    const logged = kinds(s, "data_uplinked").reduce((sum, e) => sum + (e.value ?? 0), 0);
    expect(s.data.uplinked).toBeGreaterThan(0);
    expect(logged).toBeCloseTo(s.data.uplinked, 1);
    expect(kinds(s, "data_uplinked")[0]).toMatchObject({ phase: "surface", player: "a", part: "low-gain" });
  });

  it("logs the batch of a player who goes down mid-send as the crew is wiped out", () => {
    const s = landed("mars", { comms: "low-gain" });
    s.surface.held.a = 30;
    at(s, "a", lander);
    wait(s, 1);
    for (const p of s.players) p.down = true; // the whole crew down ends the surface on this tick
    wait(s, 0.25);
    expect(s.phase).toBe("report");
    const logged = kinds(s, "data_uplinked").reduce((sum, e) => sum + (e.value ?? 0), 0);
    expect(logged).toBeCloseTo(s.data.uplinked, 1);
  });

  it("flips the uplink flag when the uplinked total reaches the target", () => {
    const s = landed("moon", { comms: "laser" });
    s.surface.held.a = 25;
    at(s, "a", lander);
    wait(s, 10);
    expect(s.objectives.uplink).toBe(true);
    expect(kinds(s, "objective_done")).toEqual([expect.objectContaining({ objective: "uplink" })]);
  });
});

describe("sample", () => {
  it("drills the Mars core with E at the rim, carries it, and counts only at the lander", () => {
    const s = landed("mars");
    at(s, "a", SURFACE.sampleSites.mars);
    press(s);
    wait(s, 5);
    expect(s.players[0].carrying).toBe("core-sample");
    expect(s.objectives.sample).toBe(false);
    at(s, "a", lander);
    wait(s, 0.5);
    expect(s.players[0].carrying).toBeNull();
    expect(s.objectives.sample).toBe(true);
    expect(kinds(s, "sample_collected")).toEqual([expect.objectContaining({ player: "a", part: "core-sample" })]);
  });

  it("takes the Moon's regolith from the crater floor", () => {
    const s = landed("moon");
    at(s, "a", SURFACE.sampleSites.moon);
    press(s);
    wait(s, 5);
    expect(s.players[0].carrying).toBe("regolith");
  });

  it("needs empty hands to drill, and only one sample comes out", () => {
    const s = landed("mars");
    at(s, "a", SURFACE.sampleSites.mars);
    s.players[0].carrying = "weather-station";
    press(s); // drops the instrument instead
    expect(s.surface.tasks.a).toBeUndefined();
    press(s); // now drills (the dropped instrument lies within reach, but the drill claims the press)
    wait(s, 5);
    expect(s.players[0].carrying).toBe("core-sample");
    at(s, "b", SURFACE.sampleSites.mars);
    press(s, "b");
    expect(s.surface.tasks.b).toBeUndefined();
  });

  it("can be carried home by someone else after its carrier goes down", () => {
    const s = landed("mars");
    at(s, "a", SURFACE.sampleSites.mars);
    press(s);
    wait(s, 5);
    s.players[0].power = 0.001; // the suit gives out on the next tick
    wait(s, 0.25);
    expect(s.players[0].down).toBe(true);
    const dropped = s.parts.find((x) => x.part === "core-sample")!;
    at(s, "b", { x: dropped.x + 20, y: dropped.y });
    press(s, "b");
    expect(s.players[1].carrying).toBe("core-sample");
  });
});

describe("instrument", () => {
  it("is carried from the lander to the ridge and deployed with E", () => {
    const s = landed("mars");
    const instrument = s.parts.find((x) => x.part === "weather-station")!;
    at(s, "a", instrument);
    press(s);
    expect(s.players[0].carrying).toBe("weather-station");
    at(s, "a", SURFACE.deploySpot);
    press(s);
    expect(s.players[0].carrying).toBe("weather-station"); // still deploying
    wait(s, 4);
    expect(s.players[0].carrying).toBeNull();
    expect(s.surface.deployed).toBe(true);
    expect(s.objectives.deploy).toBe(true);
    expect(s.parts.find((x) => x.part === "weather-station")).toBeUndefined();
  });

  it("cannot be deployed anywhere but the deploy spot", () => {
    const s = landed("mars");
    at(s, "a", rich[0]);
    s.players[0].carrying = "weather-station";
    wait(s, 1);
    expect(s.surface.deployed).toBe(false);
  });
});

describe("bonus", () => {
  it("is done by standing at the seeded photo spot with E", () => {
    const s = landed();
    at(s, "a", bonusSpot(s));
    press(s);
    wait(s, 3);
    expect(s.objectives.bonus).toBe(true);
  });
});

describe("a whole list", () => {
  it("completes every objective on Mars and logs each objective_done once", () => {
    const s = landed("mars", { payload: "spectrometer", comms: "laser" });
    for (const site of rich.slice(0, 3)) {
      at(s, "a", site);
      press(s);
      wait(s, 5);
    }
    at(s, "a", SURFACE.sampleSites.mars);
    press(s);
    wait(s, 5);
    at(s, "a", lander); // delivers the sample and uplinks 3 x 16 data
    wait(s, 10);
    const instrument = s.parts.find((x) => x.part === "weather-station")!;
    at(s, "b", instrument);
    press(s, "b");
    at(s, "b", SURFACE.deploySpot);
    press(s, "b");
    wait(s, 4);
    at(s, "b", bonusSpot(s));
    press(s, "b");
    wait(s, 3);
    expect(s.objectives).toEqual({ scan: true, sample: true, deploy: true, uplink: true, bonus: true });
    expect(kinds(s, "objective_done").map((e) => e.objective).sort()).toEqual([...OBJECTIVES].sort());
    expect(objectiveLines(s).every((l) => l.done)).toBe(true);
  });
});

describe("for the mission panel", () => {
  it("lists each objective with its count, as the mock shows", () => {
    const s = landed("mars");
    at(s, "a", rich[0]);
    press(s);
    wait(s, 5);
    s.data.uplinked = 22.6;
    expect(objectiveLines(s).map((l) => [l.id, l.count, l.need, l.done])).toEqual([
      ["scan", 1, 3, false],
      ["sample", 0, 1, false],
      ["deploy", 0, 1, false],
      ["uplink", 22, 40, false],
      ["bonus", 0, 1, false],
    ]);
  });

  it("draws scanned sites, jobs in progress and data in hand", () => {
    const s = landed("mars");
    at(s, "a", rich[0]);
    press(s);
    wait(s, 5);
    at(s, "a", rich[1]);
    press(s);
    wait(s, 1);
    const r = recordingCtx();
    groundScene("surface").draw(r.ctx, s, { playerId: "a", now: clock });
    const texts = r.texts();
    expect(texts.some((t) => /^Scanning \d+%$/.test(t))).toBe(true);
    expect(texts).toContain(`${scanStats("spectrometer").data * RICH_FACTOR} data`);
  });
});
