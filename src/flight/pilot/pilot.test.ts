import { describe, expect, it } from "vitest";
import "../../data/data.register";
import type { Input } from "../../core/input";
import { createState, type GameState, type Player } from "../../core/state";
import type { FlightEvent } from "../events/director";
import { createWelder, type Welder } from "../engineer/weld";
import { FUEL_LOW, heaviness, type Pilot, pilotRule, SHIP_Y, shipHalf, SPEED_LOW } from "./pilot";

const still: Input = { dx: 0, dy: 0, interact: false, panel: false, switch: false };

function flight(slots: Partial<GameState["ship"]["slots"]> = {}, events: FlightEvent[] = []): GameState {
  const s = createState(7, "mars");
  s.phase = "flight";
  s.ship.slots = { propulsion: "chemical-engine", power: "small-solar", comms: "low-gain", payload: "camera", ...slots };
  s.players = [{ id: "a", name: "a", roles: ["pilot"], station: "pilot", x: 0, y: 0, carrying: null, oxygen: 1, power: 1, down: false } as Player];
  s.flight.events = events;
  return s;
}

function run(s: GameState, input: Input, seconds: number, from = 0): number {
  let now = from;
  for (let i = 0; i < seconds * 60; i++) {
    now += 1000 / 60;
    pilotRule(s, { a: input }, now, 1 / 60);
  }
  return now;
}

const pilot = (s: GameState) => s.flight.pilot as Pilot;
const field = (strength = 1): FlightEvent => ({ kind: "debris", at: 0, until: 60_000, strength });

describe("pilot station (S4-02, S4-03)", () => {
  it("steers with A and D, and a smooth engine answers faster than an ion drive", () => {
    const chem = flight();
    run(chem, { ...still, dx: 1 }, 0.5);
    const ion = flight({ propulsion: "ion-drive" });
    run(ion, { ...still, dx: 1 }, 0.5);
    expect(pilot(chem).x).toBeGreaterThan(pilot(ion).x);
    expect(pilot(ion).x).toBeGreaterThan(0);
  });

  it("moves a solid motor in fixed pulses", () => {
    const s = flight({ propulsion: "solid-motor" });
    run(s, { ...still, dx: -1 }, 0.3);
    const afterOne = pilot(s).x;
    expect(afterOne).toBeLessThan(-0.2);
    run(s, still, 0.5);
    expect(pilot(s).x).toBeCloseTo(afterOne, 1);
  });

  it("burns fuel to thrust, and speed bleeds away while coasting", () => {
    const s = flight();
    run(s, { ...still, dy: -1 }, 1);
    expect(s.ship.fuel).toBeLessThan(1);
    const fast = pilot(s).speed;
    expect(fast).toBeGreaterThan(1);
    run(s, still, 3);
    expect(pilot(s).speed).toBeLessThan(fast);
  });

  it("burns correction fuel while below the transfer band", () => {
    const s = flight();
    pilotRule(s, { a: still }, 0, 0); // create the station
    pilot(s).speed = SPEED_LOW - 0.1;
    const fuel = s.ship.fuel;
    run(s, still, 2);
    expect(s.ship.fuel).toBeLessThan(fuel);
  });

  it("makes a heavy ship handle worse and a large array a wider target", () => {
    expect(heaviness(flight({ propulsion: "solid-motor", power: "large-solar", payload: "radar" }))).toBeGreaterThan(1);
    expect(heaviness(flight())).toBe(1);
    expect(shipHalf(flight({ power: "large-solar" }))).toBeGreaterThan(shipHalf(flight()));
  });

  it("takes debris hits in a field", () => {
    const s = flight({}, [field()]);
    run(s, still, 20);
    expect(s.ship.hull).toBeLessThan(1);
    expect(s.log.map((e) => e.kind)).toContain("debris_hit");
  });

  /** one big rock just above the ship's line, dead ahead */
  function rockAhead(s: GameState): void {
    pilotRule(s, { a: still }, 0, 0);
    pilot(s).rocks.push({ id: 999, x: pilot(s).x, y: SHIP_Y - 0.05, r: 0.1, s: 1 });
  }

  it("opens a breach the engineer can weld when a big rock hits", () => {
    const s = flight();
    s.flight.weld = createWelder(1);
    rockAhead(s);
    run(s, still, 0.5);
    expect(s.log.map((e) => e.kind)).toEqual(expect.arrayContaining(["debris_hit", "hull_breach"]));
    expect((s.flight.weld as Welder).jobs.length).toBe(1);
    expect(pilot(s).hits).toBe(1);
  });

  it("softens hits while nobody watches the pilot station, so a solo crew can cope", () => {
    const watched = flight();
    rockAhead(watched);
    run(watched, still, 0.5);
    const away = flight();
    away.players[0].station = "comms";
    rockAhead(away);
    run(away, still, 0.5);
    expect(1 - away.ship.hull).toBeCloseTo((1 - watched.ship.hull) * 0.4, 5);
  });

  it("blames a large array for hits, since it made the ship a bigger target", () => {
    const s = flight({ power: "large-solar" }, [field()]);
    run(s, still, 20);
    expect(s.log.find((e) => e.kind === "debris_hit")?.part).toBe("large-solar");
  });

  it("lets the same debris field hit a large array more often than a small one (S4-07)", () => {
    const small = flight({}, [field()]);
    const large = flight({ power: "large-solar" }, [field()]);
    run(small, still, 20);
    run(large, still, 20);
    expect(pilot(large).hits).toBeGreaterThan(pilot(small).hits);
  });

  it("puts the same debris in the same places for the same seed", () => {
    const a = flight({}, [field()]);
    const b = flight({}, [field()]);
    run(a, still, 5);
    run(b, still, 5);
    expect(pilot(a).rocks).toEqual(pilot(b).rocks);
  });

  it("logs fuel_low once when fuel drops under the warning line", () => {
    const s = flight();
    s.ship.fuel = FUEL_LOW + 0.001;
    run(s, { ...still, dy: -1 }, 2);
    run(s, { ...still, dy: -1 }, 2);
    expect(s.log.filter((e) => e.kind === "fuel_low")).toHaveLength(1);
    expect(s.trouble.pilot).toBe("Fuel low");
  });

  it("shows nothing wrong on a quiet, on-target flight", () => {
    const s = flight();
    run(s, still, 1);
    expect(s.trouble.pilot).toBeUndefined();
    expect(s.ship.hull).toBe(1);
  });
});
