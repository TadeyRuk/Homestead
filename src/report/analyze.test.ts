import { describe, expect, it } from "vitest";
import "../data/data.register";
import { logEvent } from "../core/events";
import { createState, type GameState, type Player } from "../core/state";
import { analyze, buildTimeLeft } from "./analyze";

function run(mission: "moon" | "mars" = "mars"): GameState {
  const s = createState(42, mission);
  s.players = [{ id: "a", name: "Ana", roles: ["pilot", "engineer", "comms", "science"], station: null, x: 0, y: 0, carrying: null, oxygen: 1, power: 1, down: false } as Player];
  s.data.target = mission === "mars" ? 40 : 25;
  s.ship.slots = { propulsion: "chemical-engine", power: "rtg", comms: "high-gain", payload: "spectrometer" };
  return s;
}

function at(s: GameState, phase: GameState["phase"]) {
  s.phase = phase;
  return s;
}

describe("report logic (S3-08)", () => {
  it("explains an overweight launch by the engine's lift and the heaviest part", () => {
    const s = run();
    s.ship.slots = { propulsion: "ion-drive", power: "large-solar", comms: "high-gain", payload: "radar" };
    at(s, "campus");
    logEvent(s, "launch_failed", 30_000, { part: "ion-drive", value: 480 - 500 + 100 });
    const r = analyze(s);
    expect(r.outcome).toBe("MISSION FAILED");
    expect(r.headline).toMatch(/overweight/);
    expect(r.chain.join(" ")).toMatch(/ion drive can lift \(500 kg\)/);
    expect(r.chain.join(" ")).toMatch(/radar sounder/);
    expect(r.blame).toBe("ion-drive");
    expect(r.real?.name).toBe("Ion propulsion on Dawn");
  });

  it("blames a large array for a hull lost to debris", () => {
    const s = at(run(), "flight");
    s.ship.slots.power = "large-solar";
    for (let i = 0; i < 6; i++) logEvent(s, "debris_hit", 60_000 + i, { part: "large-solar", value: 0.15 });
    logEvent(s, "ship_lost", 70_000, { value: 0 });
    const r = analyze(s);
    expect(r.outcome).toBe("MISSION FAILED");
    expect(r.chain[0]).toMatch(/6 debris hits/);
    expect(r.blame).toBe("large-solar");
    expect(r.real?.name).toBe("Juno's arrays");
  });

  it("blames the engine when the ship runs out of fuel", () => {
    const s = at(run(), "flight");
    logEvent(s, "ship_lost", 90_000, { value: 1 });
    const r = analyze(s);
    expect(r.headline).toMatch(/ran out of fuel/);
    expect(r.blame).toBe("chemical-engine");
  });

  it("matches the proposal's partial success: data in hands and a salvage antenna", () => {
    const s = at(run(), "report");
    s.ship.slots.comms = "salvage-antenna";
    s.ship.salvaged = ["comms"];
    s.credits = 40;
    s.arrival = { fuel: 0.6, hull: 0.8 };
    s.data.uplinked = 22;
    s.surface.held = { a: 12 };
    for (let i = 0; i < 5; i++) logEvent(s, "site_scanned", 300_000 + i, { part: "spectrometer", value: 8 });
    logEvent(s, "extraction", 400_000, { value: 1 });
    const r = analyze(s);
    expect(r.outcome).toBe("PARTIAL SUCCESS");
    expect(r.headline).toBe("You uplinked 22 of the 40 data units Mission Control asked for.");
    expect(r.chain[0]).toMatch(/12 units were still in someone's hands/);
    expect(r.chain.join(" ")).toMatch(/salvage antenna/);
    expect(r.chain.join(" ")).toMatch(/40 credits unspent/);
    expect(r.blame).toBe("salvage-antenna");
  });

  it("blames the payload when uploads were fast but scans were thin", () => {
    const s = at(run(), "report");
    s.ship.slots.comms = "laser";
    s.ship.slots.payload = "camera";
    s.arrival = { fuel: 0.6, hull: 0.8 };
    s.data.uplinked = 12;
    logEvent(s, "site_scanned", 300_000, { part: "camera", value: 4 });
    const r = analyze(s);
    expect(r.blame).toBe("camera");
    expect(r.chain.join(" ")).toMatch(/1 site/);
  });

  it("says nothing was scanned rather than blaming the antenna for an empty run", () => {
    const s = at(run(), "report");
    s.ship.slots = { propulsion: "salvage-motor", power: "salvage-battery", comms: "salvage-antenna", payload: "salvage-camera" };
    s.ship.salvaged = ["propulsion", "power", "comms", "payload"];
    s.arrival = { fuel: 0.9, hull: 1 };
    const r = analyze(s);
    expect(r.chain[0]).toBe("No site was scanned, so there was no data to send.");
    expect(r.blame).toBe("salvage-camera");
    expect(r.chain.join(" ")).toMatch(/engine, power, comms, payload slots were still empty/);
  });

  it("calls it a success when the target is met, and names the antenna that got it home", () => {
    const s = at(run(), "report");
    s.arrival = { fuel: 0.5, hull: 0.9 };
    s.data.uplinked = 44;
    s.objectives = { scan: true, sample: true, deploy: true, uplink: true, bonus: false };
    logEvent(s, "extraction", 400_000, { value: 1 });
    const r = analyze(s);
    expect(r.outcome).toBe("SUCCESS");
    expect(r.blame).toBe("high-gain");
    expect(r.score).toBeGreaterThan(700);
  });

  it("fails the run when the whole crew goes down", () => {
    const s = at(run(), "report");
    s.arrival = { fuel: 0.5, hull: 0.9 };
    s.players[0].down = true;
    logEvent(s, "player_down", 300_000, { player: "a" });
    logEvent(s, "extraction", 400_000, { value: 0 });
    const r = analyze(s);
    expect(r.outcome).toBe("MISSION FAILED");
    expect(r.headline).toMatch(/whole crew/);
    expect(r.blame).toBe("rtg");
  });

  it("scores data first, then crew, credits, build time and the ship on arrival", () => {
    const s = at(run(), "report");
    s.arrival = { fuel: 1, hull: 1 };
    s.data.uplinked = 40;
    s.credits = 20;
    const rows = Object.fromEntries(analyze(s).rows.map((r) => [r.label, r.points]));
    expect(rows["Data uplinked"]).toBe(600);
    expect(rows["Crew standing"]).toBe(150);
    expect(rows["Credits unspent"]).toBe(40);
    expect(rows["Fuel on arrival"]).toBe(50);
    expect(rows["Hull on arrival"]).toBe(50);
  });

  it("counts build time from the countdown that launched, not one that was cancelled", () => {
    const s = at(run(), "campus");
    logEvent(s, "launch_started", 10_000, { value: 120 });
    logEvent(s, "launch_cancelled", 11_000);
    logEvent(s, "launch_started", 40_000, { value: 90 });
    expect(buildTimeLeft(s.log)).toBe(90);
    logEvent(s, "salvage_filled", 200_000, { part: "salvage-antenna" });
    expect(buildTimeLeft(s.log)).toBe(0);
  });
});
