import { describe, expect, it } from "vitest";
import type { EventKind } from "../../core/events";
import type { Input } from "../../core/input";
import type { GameEvent } from "../../core/state";
import {
  COOLING_PER_SECOND, createCore, DAMAGE_PER_SECOND, SAFE_HIGH, SAFE_LOW, stepCore, VALVE_PER_SECOND,
} from "./core";

const still: Input = { dx: 0, dy: 0, interact: false, panel: false, switch: false };
const open: Input = { ...still, dy: -1 };
const close: Input = { ...still, dy: 1 };

type Logged = { kind: EventKind } & Pick<GameEvent, "part" | "value">;
function recorder() {
  const logged: Logged[] = [];
  return { logged, emit: (kind: EventKind, fields: Pick<GameEvent, "part" | "value">) => logged.push({ kind, ...fields }) };
}

const ship = (coreTemp = 0.5) => ({ coreTemp, instrumentHealth: 1 });
// heat per second, the way S5-06 will hand it over from parts.json
const radar = { part: "radar", heat: 0.03 };
const camera = { part: "camera", heat: 0.006 };

describe("energy core", () => {
  it("starts with the coolant valve shut", () => {
    expect(createCore(radar).valve).toBe(0);
  });

  it("warms by the payload's heat when the valve is shut", () => {
    const s = ship(0.5);
    stepCore(createCore(radar), s, still, 2, () => {});
    expect(s.coreTemp).toBeGreaterThan(0.5);
  });

  it("heats a radar sounder core much faster than a camera core", () => {
    const hot = ship(0.4);
    const mild = ship(0.4);
    stepCore(createCore(radar), hot, still, 5, () => {});
    stepCore(createCore(camera), mild, still, 5, () => {});
    expect(hot.coreTemp - 0.4).toBeGreaterThan(3 * (mild.coreTemp - 0.4));
  });

  it("opens the valve while up is held and closes it while down is held", () => {
    const core = createCore(radar);
    stepCore(core, ship(), open, 0.5, () => {});
    expect(core.valve).toBeCloseTo(0.5 * VALVE_PER_SECOND);
    stepCore(core, ship(), close, 0.25, () => {});
    expect(core.valve).toBeCloseTo(0.25 * VALVE_PER_SECOND);
  });

  it("keeps the valve between shut and fully open", () => {
    const core = createCore(radar);
    stepCore(core, ship(), close, 1, () => {});
    expect(core.valve).toBe(0);
    stepCore(core, ship(), open, 10, () => {});
    expect(core.valve).toBe(1);
  });

  it("cools the core with the valve open", () => {
    const core = createCore(radar);
    core.valve = 1;
    const s = ship(0.5);
    stepCore(core, s, still, 2, () => {});
    expect(s.coreTemp).toBeCloseTo(0.5 + (radar.heat - COOLING_PER_SECOND) * 2, 2);
  });

  it("can always cool a core, even one heated past the base cooling rate", () => {
    // payload and RTG heat stacked together (S5-07) can beat the valve's base rate
    const core = createCore({ part: "radar", heat: COOLING_PER_SECOND * 1.5 });
    core.valve = 1;
    const s = ship(0.5);
    stepCore(core, s, still, 2, () => {});
    expect(s.coreTemp).toBeLessThan(0.5);
  });

  it("keeps the core temperature between 0 and 1", () => {
    const core = createCore(radar);
    const s = ship(0.99);
    stepCore(core, s, still, 10, () => {});
    expect(s.coreTemp).toBe(1);
    core.valve = 1;
    stepCore(core, s, still, 100, () => {});
    expect(s.coreTemp).toBe(0);
  });

  it("damages the instrument while the core runs hot", () => {
    const s = { coreTemp: SAFE_HIGH + 0.1, instrumentHealth: 1 };
    const core = createCore(camera);
    core.valve = camera.heat / COOLING_PER_SECOND; // hold the temperature steady
    stepCore(core, s, still, 2, () => {});
    expect(s.instrumentHealth).toBeCloseTo(1 - DAMAGE_PER_SECOND * 2, 2);
  });

  it("leaves the instrument alone inside the safe band", () => {
    const s = ship((SAFE_LOW + SAFE_HIGH) / 2);
    stepCore(createCore(camera), s, still, 1, () => {});
    expect(s.instrumentHealth).toBe(1);
  });

  it("never lowers instrument health below zero", () => {
    const s = { coreTemp: 1, instrumentHealth: 0.01 };
    stepCore(createCore(radar), s, still, 10, () => {});
    expect(s.instrumentHealth).toBe(0);
  });

  it("logs core_overheated once per climb over the band, naming the payload", () => {
    const core = createCore(radar);
    const s = ship(SAFE_HIGH - 0.01);
    const { logged, emit } = recorder();
    stepCore(core, s, still, 1, emit);
    stepCore(core, s, still, 1, emit);
    expect(logged).toMatchObject([{ kind: "core_overheated", part: "radar" }]);
    s.coreTemp = 0.5;
    stepCore(core, s, still, 0, emit);
    s.coreTemp = SAFE_HIGH - 0.01;
    stepCore(core, s, still, 1, emit);
    expect(logged.filter((e) => e.kind === "core_overheated")).toHaveLength(2);
  });

  it("logs core_too_cold once per drop under the band", () => {
    const core = createCore(camera);
    core.valve = 1;
    const s = ship(SAFE_LOW + 0.01);
    const { logged, emit } = recorder();
    stepCore(core, s, still, 1, emit);
    stepCore(core, s, still, 1, emit);
    expect(logged).toMatchObject([{ kind: "core_too_cold", part: "camera" }]);
  });

  it("lets a careful player hold a radar core in the safe band", () => {
    const core = createCore(radar);
    const s = ship(0.5);
    for (let i = 0; i < 1800; i++) {
      const input = s.coreTemp > 0.55 ? open : s.coreTemp < 0.45 ? close : still;
      stepCore(core, s, input, 0.1, () => {});
    }
    expect(s.coreTemp).toBeGreaterThan(SAFE_LOW);
    expect(s.coreTemp).toBeLessThan(SAFE_HIGH);
    expect(s.instrumentHealth).toBe(1);
  });

  it("heats more slowly while nobody is at the station", () => {
    const s = ship(0.4);
    stepCore(createCore(radar), s, still, 2, () => {}, 0.4);
    expect(s.coreTemp).toBeCloseTo(0.4 + radar.heat * 2 * 0.4);
  });

  it("cools more gently too while nobody is at the station, so an open valve left alone can't overcool", () => {
    const watched = ship(0.5);
    const unwatched = ship(0.5);
    const a = createCore(radar);
    const b = createCore(radar);
    a.valve = b.valve = 1;
    stepCore(a, watched, still, 1, () => {});
    stepCore(b, unwatched, still, 1, () => {}, 0.4);
    expect(0.5 - unwatched.coreTemp).toBeCloseTo((0.5 - watched.coreTemp) * 0.4);
  });
});
