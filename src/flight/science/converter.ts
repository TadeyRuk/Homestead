import type { EventKind } from "../../core/events";
import type { Input } from "../../core/input";
import { rng } from "../../core/rng";
import type { GameEvent, Ship } from "../../core/state";

export type Item = "ice" | "co2" | "food" | "wrench";

/** cabin oxygen each item adds when fed; the wrench jams the intake instead */
export const ITEM_OXYGEN: Record<Item, number> = { ice: 0.12, co2: 0.1, food: 0.04, wrench: 0 };
/** a full cabin lasts 90 s with nobody at the converter */
export const DRAIN_PER_SECOND = 1 / 90;
export const TRAY_SIZE = 5;
/** seconds between new items on the tray */
export const REFILL_SECONDS = 2.5;
/** seconds a wrench keeps the intake jammed */
export const JAM_SECONDS = 4;
/** the cabin warning line; S5-08 carries the warning to the crew strip */
export const LOW_OXYGEN = 0.25;

// one in ten items is a wrench; the rest split evenly between the three that help
const DEAL: readonly Item[] = ["ice", "ice", "ice", "co2", "co2", "co2", "food", "food", "food", "wrench"];
// a separate stream for the tray, so it never shares numbers with spawns, the kiosk or the bus
const TRAY_STREAM = 0x6f787931;

/** plain data, so it can ride in GameState snapshots */
export interface Converter {
  seed: number;
  /** oldest first; a full tray drops its oldest item when a new one arrives */
  tray: Item[];
  /** the tray slot the science officer has selected */
  cursor: number;
  /** last held dx, so holding a key moves the cursor once */
  heldDx: number;
  /** seconds until the next item arrives */
  refill: number;
  /** seconds until a jammed intake clears; 0 while it runs */
  jammed: number;
  /** items dealt so far; picks the next item from the seeded stream */
  dealt: number;
  /** under the warning line already, so oxygen_low logs once per drop */
  low: boolean;
}

export type Emit = (kind: EventKind, fields: Pick<GameEvent, "part" | "value">) => void;

export function createConverter(seed: number): Converter {
  const c: Converter = { seed, tray: [], cursor: 0, heldDx: 0, refill: REFILL_SECONDS, jammed: 0, dealt: 0, low: false };
  while (c.tray.length < TRAY_SIZE) deal(c);
  return c;
}

/**
 * One tick of the converter; input is the science officer's, or still when nobody is at the station.
 * pace is stationPace: 1 while someone is at the station, less while nobody watches, so the cabin drains slower.
 */
export function stepConverter(c: Converter, ship: Pick<Ship, "cabinOxygen">, input: Input, dt: number, emit: Emit, pace = 1): void {
  steer(c, input);
  if (input.interact && c.tray.length > 0) feed(c, ship, emit);

  c.jammed = Math.max(0, c.jammed - dt);
  c.refill -= dt;
  // a loop, not an if, so a long background-tab tick still deals every item it missed
  while (c.refill <= 0) {
    c.refill += REFILL_SECONDS;
    deal(c);
  }

  ship.cabinOxygen = Math.max(0, ship.cabinOxygen - DRAIN_PER_SECOND * pace * dt);
  if (ship.cabinOxygen < LOW_OXYGEN && !c.low) emit("oxygen_low", { value: ship.cabinOxygen });
  c.low = ship.cabinOxygen < LOW_OXYGEN;
}

function steer(c: Converter, input: Input): void {
  if (input.dx !== 0 && input.dx !== c.heldDx) c.cursor += input.dx;
  c.heldDx = input.dx;
  c.cursor = Math.min(Math.max(0, c.tray.length - 1), Math.max(0, c.cursor));
}

function feed(c: Converter, ship: Pick<Ship, "cabinOxygen">, emit: Emit): void {
  const [item] = c.tray.splice(c.cursor, 1);
  c.cursor = Math.min(c.cursor, Math.max(0, c.tray.length - 1));
  if (item === "wrench") {
    c.jammed = JAM_SECONDS;
    emit("converter_jammed", {});
  } else if (c.jammed === 0) {
    ship.cabinOxygen = Math.min(1, ship.cabinOxygen + ITEM_OXYGEN[item]);
  }
  // anything fed into a jammed intake is lost
}

function deal(c: Converter): void {
  const item = rng((c.seed ^ TRAY_STREAM) + c.dealt).pick(DEAL);
  c.dealt += 1;
  if (c.tray.length >= TRAY_SIZE) {
    c.tray.shift();
    // keep the cursor on the same item as the tray slides left
    c.cursor = Math.max(0, c.cursor - 1);
  }
  c.tray.push(item);
}
