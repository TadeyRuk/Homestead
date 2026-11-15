import { logEvent } from "../core/events";
import { registerRule } from "../core/step";
import { answerEngineOff, type Bus } from "./engineer/bus";
import { whoIsAt } from "./stations";

// seat 1, taking seat 4's S4-08: the pilot answers the engineer's engine-off request with E (agree) or Q
// (refuse); a solo player sees the request the next time they Tab to the Pilot station
registerRule("flight", (state, inputs, now) => {
  const bus = state.flight.bus as Bus | undefined;
  if (!bus?.engineOffAsked) return;
  const pilot = whoIsAt(state, "pilot");
  const input = pilot ? inputs[pilot.id] : undefined;
  if (!input?.interact && !input?.panel) return;
  answerEngineOff(bus, !!input.interact, (kind, fields) => logEvent(state, kind, now, fields));
});
