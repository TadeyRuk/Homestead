import type { EventKind } from "../../core/events";

/** plain data, so it rides in state.flight.dish and reaches joiners in snapshots */
export interface Dish {
  /** radians off Earth; 0 is dead on */
  angle: number;
  locked: boolean;
}

/** half-width of the beam, in radians: inside it the link holds */
export const BEAM = 0.15;
/** radians per second the comms player can lean the dish; above the laser's drift, so a held turn is always recoverable */
export const LEAN_RATE = 1.2;
/** furthest the dish can swing; without a cap a long turn would leave a debt that outlasts it */
export const MAX_ANGLE = 1.2;
/** radians per second a full pilot turn pushes a drift-1 antenna */
const TURN_PUSH = 1;

export interface DishInputs {
  /** the pilot's steering; turning is what knocks the dish off target */
  pilot: { dx: number };
  /** the comms player's lean */
  comms: { dx: number };
  /** the mounted antenna's drift from the catalog: low-gain barely moves, a laser moves most */
  drift: number;
  /** the antenna's part id, for the events */
  part: string;
  /** stationPace for comms: gentler while nobody watches the station */
  pace: number;
}

export type Emit = (kind: EventKind, fields: { part?: string }) => void;

export function createDish(): Dish {
  return { angle: 0, locked: true };
}

export function stepDish(dish: Dish, i: DishInputs, dt: number, emit: Emit): void {
  dish.angle += i.pilot.dx * i.drift * TURN_PUSH * i.pace * dt;
  dish.angle += i.comms.dx * LEAN_RATE * dt;
  dish.angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, dish.angle));
  const locked = Math.abs(dish.angle) < BEAM;
  if (locked !== dish.locked) emit(locked ? "link_locked" : "link_lost", { part: i.part });
  dish.locked = locked;
}
