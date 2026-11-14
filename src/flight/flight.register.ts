import { logEvent } from "../core/events";
import { enterPhase, onEnterPhase, PHASE_SECONDS } from "../core/phases";
import { registerRule } from "../core/step";
import { planEvents } from "./events/director";

// seat 1, taking seat 4's fallback: plan the flight's events (S4-06) and land the ship (S4-09)
onEnterPhase("flight", (state, now) => {
  state.flight.events = planEvents(state, now, PHASE_SECONDS.flight);
});

/** `ship_lost` value: what ran out (hull wins when both did on the same tick) */
export const LOST_HULL = 0;
export const LOST_FUEL = 1;

// a ship that runs out of hull or fuel never arrives; the report explains it
registerRule("flight", (state, _inputs, now) => {
  if (state.ship.hull > 0 && state.ship.fuel > 0) return;
  logEvent(state, "ship_lost", now, { value: state.ship.hull <= 0 ? LOST_HULL : LOST_FUEL });
  enterPhase(state, "report", now);
});

onEnterPhase("surface", (state, now) => {
  state.arrival = { fuel: state.ship.fuel, hull: state.ship.hull };
  logEvent(state, "landed", now, { value: state.ship.fuel });
});
