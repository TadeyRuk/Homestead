// seat 5 (S5-01): the Rocket Engineer's station, the power bus beside the hull weld
import { logEvent } from "../../core/events";
import { onEnterPhase } from "../../core/phases";
import type { DeepReadonly } from "../../core/scene";
import { registerRule } from "../../core/step";
import { begin } from "../../ui/kit";
import { registerStation, stationInput, stationPace } from "../stations";
import { stepBus, type Bus, type Emit } from "./bus";
import { drawBus, drawWeld, type Area } from "./draw";
import { busFor } from "./supply";
import { engineerTrouble } from "./trouble";
import { createWelder, routeEngineer, stepWeld, type Welder } from "./weld";

const LEFT: Area = { x: 16, y: 34, w: 296, h: 300 };
const RIGHT: Area = { x: 328, y: 34, w: 296, h: 300 };

// a fresh bus for the parts mounted this run, and an empty welder for the pilot's breaches to land in
onEnterPhase("flight", (state) => {
  state.flight.bus = busFor(state.seed, state.ship.slots);
  state.flight.weld = createWelder(state.seed);
});

registerRule("flight", (state, inputs, now, dt) => {
  const bus = state.flight.bus as Bus | undefined;
  const weld = state.flight.weld as Welder | undefined;
  if (!bus || !weld) return;
  const emit: Emit = (kind, fields) => logEvent(state, kind, now, fields);
  // the bus and the weld share W, S and E, so an open breach takes the keys
  const keys = routeEngineer(weld, stationInput(state, inputs, "engineer"));
  const pace = stationPace(state, "engineer");
  stepBus(bus, keys.bus, dt, emit, pace);
  stepWeld(weld, state.ship, keys.weld, dt, emit, pace);
  const trouble = engineerTrouble(bus, weld);
  if (trouble) state.trouble.engineer = trouble;
  else delete state.trouble.engineer;
});

registerStation("engineer", {
  draw(ctx, state) {
    const bus = state.flight.bus as DeepReadonly<Bus> | undefined;
    const weld = state.flight.weld as DeepReadonly<Welder> | undefined;
    if (!bus || !weld) return;
    begin(ctx);
    const welding = weld.jobs.length > 0;
    drawBus(ctx, bus, LEFT, !welding);
    drawWeld(ctx, weld, RIGHT, welding);
    ctx.restore();
  },
});
