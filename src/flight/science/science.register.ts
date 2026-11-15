// seat 5 (S5-01): the Science Officer's station, the oxygen converter beside the energy core
import { logEvent } from "../../core/events";
import { enterPhase, onEnterPhase } from "../../core/phases";
import type { DeepReadonly } from "../../core/scene";
import { registerRule } from "../../core/step";
import { begin } from "../../ui/kit";
import type { Welder } from "../engineer/weld";
import { registerStation, stationInput, stationPace } from "../stations";
import { createConverter, LOST_OXYGEN, stepConverter, type Converter, type Emit } from "./converter";
import { createCore, stepCore, type Core } from "./core";
import { drawConverter, drawCore, type Area } from "./draw";
import { heatFor } from "./heat";
import { scienceTrouble } from "./trouble";

const LEFT: Area = { x: 16, y: 34, w: 296, h: 300 };
const RIGHT: Area = { x: 328, y: 34, w: 296, h: 300 };

// a full tray, and a core heated by the payload and power part mounted this run
onEnterPhase("flight", (state) => {
  state.flight.converter = createConverter(state.seed);
  state.flight.core = createCore(heatFor(state.ship.slots));
});

registerRule("flight", (state, inputs, now, dt) => {
  const converter = state.flight.converter as Converter | undefined;
  const core = state.flight.core as Core | undefined;
  if (!converter || !core) return;
  // low cabin air names the breach leaking it, when one is open, so the report can trace it (S5-10)
  const leak = (state.flight.weld as Welder | undefined)?.jobs[0]?.part;
  const emit: Emit = (kind, fields) =>
    logEvent(state, kind, now, kind === "oxygen_low" && !fields.part && leak ? { ...fields, part: leak } : fields);
  // the two never share a key: A, D and E feed the converter, W and S work the valve
  const keys = stationInput(state, inputs, "science");
  const pace = stationPace(state, "science");
  stepConverter(converter, state.ship, { ...keys, dy: 0 }, dt, emit, pace);
  stepCore(core, state.ship, { ...keys, dx: 0, interact: false }, dt, emit, pace);
  const trouble = scienceTrouble(converter, state.ship);
  if (trouble) state.trouble.science = trouble;
  else delete state.trouble.science;

  // no air left: the crew is lost and the run goes to the report (S5-08); the phase check keeps it to
  // one ship_lost when the hull gave out on the same tick
  if (state.ship.cabinOxygen > 0 || state.phase !== "flight") return;
  logEvent(state, "oxygen_low", now, { value: 0, part: leak });
  logEvent(state, "ship_lost", now, { value: LOST_OXYGEN, part: leak });
  enterPhase(state, "report", now);
});

registerStation("science", {
  draw(ctx, state) {
    const converter = state.flight.converter as DeepReadonly<Converter> | undefined;
    const core = state.flight.core as DeepReadonly<Core> | undefined;
    if (!converter || !core) return;
    begin(ctx);
    drawConverter(ctx, converter, state.ship, LEFT);
    drawCore(ctx, core, state.ship, RIGHT);
    ctx.restore();
  },
});
