import { describe, expect, it } from "vitest";
import type { EventKind } from "../../core/events";
import type { Input } from "../../core/input";
import type { GameEvent } from "../../core/state";
import {
  createConverter, DRAIN_PER_SECOND, ITEM_OXYGEN, JAM_SECONDS, LOW_OXYGEN, REFILL_SECONDS, stepConverter, TRAY_SIZE,
  type Converter, type Item,
} from "./converter";

const still: Input = { dx: 0, dy: 0, interact: false, panel: false, switch: false };
const feed: Input = { ...still, interact: true };
const right: Input = { ...still, dx: 1 };

type Logged = { kind: EventKind } & Pick<GameEvent, "part" | "value">;
function recorder() {
  const logged: Logged[] = [];
  return { logged, emit: (kind: EventKind, fields: Pick<GameEvent, "part" | "value">) => logged.push({ kind, ...fields }) };
}

const cabin = (cabinOxygen = 0.5) => ({ cabinOxygen });

function withTray(...tray: Item[]): Converter {
  const c = createConverter(1);
  c.tray = tray;
  return c;
}

describe("oxygen converter", () => {
  it("starts with a full tray", () => {
    expect(createConverter(1).tray).toHaveLength(TRAY_SIZE);
  });

  it("deals the same tray for the same seed", () => {
    expect(createConverter(5).tray).toEqual(createConverter(5).tray);
  });

  it("lets cabin oxygen fall when nobody feeds it", () => {
    const ship = cabin(0.5);
    stepConverter(createConverter(1), ship, still, 10, () => {});
    expect(ship.cabinOxygen).toBeCloseTo(0.5 - DRAIN_PER_SECOND * 10);
  });

  it("never lets cabin oxygen go below zero", () => {
    const ship = cabin(0.01);
    stepConverter(createConverter(1), ship, still, 10, () => {});
    expect(ship.cabinOxygen).toBe(0);
  });

  it("raises cabin oxygen by the fed item's worth and takes it off the tray", () => {
    const c = withTray("ice", "food");
    const ship = cabin(0.5);
    stepConverter(c, ship, feed, 0, () => {});
    expect(ship.cabinOxygen).toBeCloseTo(0.5 + ITEM_OXYGEN.ice);
    expect(c.tray).toEqual(["food"]);
  });

  it("helps more with ice and CO2 than with food waste", () => {
    expect(ITEM_OXYGEN.ice).toBeGreaterThan(ITEM_OXYGEN.food);
    expect(ITEM_OXYGEN.co2).toBeGreaterThan(ITEM_OXYGEN.food);
    expect(ITEM_OXYGEN.food).toBeGreaterThan(0);
  });

  it("caps cabin oxygen at full", () => {
    const ship = cabin(0.99);
    stepConverter(withTray("ice"), ship, feed, 0, () => {});
    expect(ship.cabinOxygen).toBe(1);
  });

  it("jams on a wrench, logs it, and wastes what is fed while jammed", () => {
    const c = withTray("wrench", "ice");
    const ship = cabin(0.5);
    const { logged, emit } = recorder();
    stepConverter(c, ship, feed, 0, emit);
    expect(logged).toMatchObject([{ kind: "converter_jammed" }]);
    stepConverter(c, ship, feed, 0, emit);
    expect(ship.cabinOxygen).toBe(0.5);
    expect(c.tray).toEqual([]);
  });

  it("clears the jam after a while", () => {
    const c = withTray("wrench", "ice");
    const ship = cabin(0.5);
    stepConverter(c, ship, feed, 0, () => {});
    stepConverter(c, ship, still, JAM_SECONDS, () => {});
    expect(c.jammed).toBe(0);
    ship.cabinOxygen = 0.5;
    stepConverter(c, ship, feed, 0, () => {});
    expect(ship.cabinOxygen).toBeCloseTo(0.5 + ITEM_OXYGEN.ice);
  });

  it("moves the cursor once per press of left or right, and stops at the ends", () => {
    const c = withTray("ice", "food", "co2");
    stepConverter(c, cabin(), right, 0, () => {});
    stepConverter(c, cabin(), right, 0, () => {}); // still held
    expect(c.cursor).toBe(1);
    stepConverter(c, cabin(), still, 0, () => {});
    stepConverter(c, cabin(), right, 0, () => {});
    stepConverter(c, cabin(), still, 0, () => {});
    stepConverter(c, cabin(), right, 0, () => {});
    expect(c.cursor).toBe(2);
  });

  it("feeds the item under the cursor", () => {
    const c = withTray("food", "ice");
    c.cursor = 1;
    const ship = cabin(0.5);
    stepConverter(c, ship, feed, 0, () => {});
    expect(ship.cabinOxygen).toBeCloseTo(0.5 + ITEM_OXYGEN.ice);
    expect(c.cursor).toBe(0);
  });

  it("does nothing when the tray is empty", () => {
    const ship = cabin(0.5);
    stepConverter(withTray(), ship, feed, 0, () => {});
    expect(ship.cabinOxygen).toBe(0.5);
  });

  it("deals a new item every few seconds", () => {
    const c = withTray("ice");
    stepConverter(c, cabin(1), still, REFILL_SECONDS, () => {});
    expect(c.tray).toHaveLength(2);
  });

  it("lets the oldest item fall off a full tray, so a wrench can ride past", () => {
    const c = createConverter(1);
    c.tray = ["wrench", "ice", "ice", "ice", "ice"];
    stepConverter(c, cabin(1), still, REFILL_SECONDS, () => {});
    expect(c.tray).toHaveLength(TRAY_SIZE);
    expect(c.tray[0]).toBe("ice");
  });

  it("logs oxygen_low once when the cabin drops under the warning line, and again after it recovers", () => {
    const c = withTray("ice", "ice");
    const ship = cabin(LOW_OXYGEN + 0.01);
    const { logged, emit } = recorder();
    stepConverter(c, ship, still, 2, emit);
    stepConverter(c, ship, still, 2, emit);
    expect(logged.filter((e) => e.kind === "oxygen_low")).toHaveLength(1);
    stepConverter(c, ship, feed, 0, emit);
    ship.cabinOxygen = LOW_OXYGEN + 0.01;
    stepConverter(c, ship, still, 2, emit);
    expect(logged.filter((e) => e.kind === "oxygen_low")).toHaveLength(2);
  });

  it("keeps the cabin up over a flight when the player feeds the good items", () => {
    const c = createConverter(4);
    const ship = cabin(1);
    for (let i = 0; i < 1800; i++) {
      // pick the best item on the tray, the way a player would
      const best = c.tray.reduce((b, item, j) => (ITEM_OXYGEN[item] > ITEM_OXYGEN[c.tray[b]] ? j : b), 0);
      c.cursor = best;
      const worth = c.tray.length > 0 && ship.cabinOxygen < 0.85 && c.tray[best] !== "wrench";
      stepConverter(c, ship, worth ? feed : still, 0.1, () => {});
    }
    expect(ship.cabinOxygen).toBeGreaterThan(0.5);
  });
});
