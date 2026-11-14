import { describe, expect, it } from "vitest";
import type { EventKind } from "../../core/events";
import type { Input } from "../../core/input";
import type { GameEvent } from "../../core/state";
import {
  answerEngineOff, BASE_WATTS, createBus, draw, overloaded, powered, RESET_SECONDS, secondsToTrip, stepBus, TRIP_SECONDS,
  type Bus,
} from "./bus";

const still: Input = { dx: 0, dy: 0, interact: false, panel: false, switch: false };
const press: Input = { ...still, interact: true };
const down: Input = { ...still, dy: 1 };

type Logged = { kind: EventKind } & Pick<GameEvent, "part" | "value">;
function recorder() {
  const logged: Logged[] = [];
  return { logged, emit: (kind: EventKind, fields: Pick<GameEvent, "part" | "value">) => logged.push({ kind, ...fields }) };
}

// a chemical engine, high-gain dish and spectrometer, with numbers from the proposal's first pass
const loads = [
  { id: "chemical", slot: "propulsion", watts: 30 },
  { id: "highgain", slot: "comms", watts: 80 },
  { id: "spectrometer", slot: "payload", watts: 110 },
] as const;

function busOn(supply: number, seed = 1): Bus {
  return createBus(seed, { id: "small-solar", watts: supply }, loads);
}

// runs the bus for a while with nobody at the station, returns how many times the breaker tripped
function trips(bus: Bus, seconds: number): number {
  const { logged, emit } = recorder();
  for (let i = 0; i < seconds * 10; i++) stepBus(bus, still, 0.1, emit);
  return logged.filter((e) => e.kind === "breaker_tripped").length;
}

describe("power bus", () => {
  it("starts with every mounted part's load on and the breaker closed", () => {
    const bus = busOn(300);
    expect(bus.loads.map((l) => l.on)).toEqual([true, true, true]);
    expect(powered(bus, "propulsion")).toBe(true);
    expect(powered(bus, "comms")).toBe(true);
    expect(powered(bus, "payload")).toBe(true);
  });

  it("draws the base load plus every load that is on", () => {
    const bus = busOn(300);
    expect(draw(bus)).toBeGreaterThan(BASE_WATTS + 220 * 0.6);
    expect(draw(bus)).toBeLessThan(BASE_WATTS + 220 * 1.4);
    bus.loads.forEach((l) => (l.on = false));
    expect(draw(bus)).toBe(BASE_WATTS);
  });

  it("gives the same draw for the same seed and second, so every tab agrees", () => {
    const a = busOn(300, 9);
    const b = busOn(300, 9);
    stepBus(a, still, 2.5, () => {});
    stepBus(b, still, 2.5, () => {});
    expect(draw(a)).toBe(draw(b));
  });

  it("trips the breaker after a few seconds over supply and logs the power part", () => {
    const bus = busOn(100);
    const { logged, emit } = recorder();
    stepBus(bus, still, TRIP_SECONDS - 0.5, emit);
    expect(logged).toEqual([]);
    expect(secondsToTrip(bus)).toBeCloseTo(0.5);
    stepBus(bus, still, 1, emit);
    expect(logged).toMatchObject([{ kind: "breaker_tripped", part: "small-solar" }]);
    expect(powered(bus, "comms")).toBe(false);
  });

  it("resets the breaker after a while, with the same loads still on", () => {
    const bus = busOn(100);
    stepBus(bus, still, TRIP_SECONDS + 0.1, () => {});
    stepBus(bus, still, RESET_SECONDS + 0.1, () => {});
    expect(powered(bus, "comms")).toBe(true);
    expect(bus.strain).toBe(0);
  });

  it("never trips while the draw stays under supply", () => {
    expect(trips(busOn(1_000), 60)).toBe(0);
  });

  it("eases off the strain once the draw drops back under supply", () => {
    const bus = busOn(100);
    stepBus(bus, still, 2, () => {});
    bus.supply = 1_000;
    stepBus(bus, still, 1, () => {});
    expect(bus.strain).toBeLessThan(2 / TRIP_SECONDS);
  });

  it("moves the cursor once per press of up or down, and stops at the ends", () => {
    const bus = busOn(300);
    stepBus(bus, down, 0.1, () => {});
    stepBus(bus, down, 0.1, () => {}); // still held
    expect(bus.cursor).toBe(1);
    stepBus(bus, still, 0.1, () => {});
    stepBus(bus, down, 0.1, () => {});
    stepBus(bus, still, 0.1, () => {});
    stepBus(bus, down, 0.1, () => {});
    expect(bus.cursor).toBe(2);
    stepBus(bus, { ...still, dy: -1 }, 0.1, () => {});
    expect(bus.cursor).toBe(1);
  });

  it("sheds the selected load on interact and logs the part", () => {
    const bus = busOn(300);
    bus.cursor = 2;
    const { logged, emit } = recorder();
    stepBus(bus, press, 0.1, emit);
    expect(powered(bus, "payload")).toBe(false);
    expect(logged).toMatchObject([{ kind: "load_shed", part: "spectrometer", value: 110 }]);
  });

  it("switches a shed load back on without logging a shed", () => {
    const bus = busOn(300);
    bus.cursor = 1;
    const { logged, emit } = recorder();
    stepBus(bus, press, 0.1, emit);
    stepBus(bus, press, 0.1, emit);
    expect(powered(bus, "comms")).toBe(true);
    expect(logged).toHaveLength(1);
  });

  it("asks the pilot before shedding the engine, and sheds only when they agree", () => {
    const bus = busOn(300);
    const { logged, emit } = recorder();
    stepBus(bus, press, 0.1, emit);
    expect(bus.engineOffAsked).toBe(true);
    expect(powered(bus, "propulsion")).toBe(true);
    answerEngineOff(bus, true, emit);
    expect(bus.engineOffAsked).toBe(false);
    expect(powered(bus, "propulsion")).toBe(false);
    expect(logged).toMatchObject([{ kind: "load_shed", part: "chemical" }]);
  });

  it("keeps the engine on when the pilot refuses", () => {
    const bus = busOn(300);
    const { logged, emit } = recorder();
    stepBus(bus, press, 0.1, emit);
    answerEngineOff(bus, false, emit);
    expect(powered(bus, "propulsion")).toBe(true);
    expect(bus.engineOffAsked).toBe(false);
    expect(logged).toEqual([]);
  });

  it("ignores an answer nobody asked for", () => {
    const bus = busOn(300);
    answerEngineOff(bus, true, () => {});
    expect(powered(bus, "propulsion")).toBe(true);
  });

  it("drops the question when the engineer presses the engine again", () => {
    const bus = busOn(300);
    stepBus(bus, press, 0.1, () => {});
    stepBus(bus, press, 0.1, () => {});
    expect(bus.engineOffAsked).toBe(false);
  });

  it("lists only the slots that have a part, so an empty slot has nothing to switch", () => {
    const bus = createBus(1, { id: "rtg", watts: 450 }, [loads[0]]);
    expect(bus.loads).toHaveLength(1);
    expect(powered(bus, "payload")).toBe(false);
  });

  it("keeps the cursor at the top when the bus has no loads to select", () => {
    const bus = createBus(1, { id: "rtg", watts: 450 }, []);
    stepBus(bus, down, 0.1, () => {});
    stepBus(bus, press, 0.1, () => {});
    expect(bus.cursor).toBe(0);
  });

  it("reads as over supply only while the draw is over, not while the strain eases", () => {
    const bus = busOn(100);
    stepBus(bus, still, 2, () => {});
    expect(overloaded(bus)).toBe(true);
    bus.supply = 1_000;
    stepBus(bus, still, 0.1, () => {});
    expect(bus.strain).toBeGreaterThan(0);
    expect(overloaded(bus)).toBe(false);
  });

  it("trips a small solar array much more often than an RTG with the same loads", () => {
    const heavy = [loads[0], loads[1], { id: "radar", slot: "payload", watts: 200 }] as const;
    const solar = trips(createBus(3, { id: "small-solar", watts: 300 }, heavy), 120);
    const rtg = trips(createBus(3, { id: "rtg", watts: 450 }, heavy), 120);
    expect(solar).toBeGreaterThan(3);
    expect(rtg).toBe(0);
  });
});
