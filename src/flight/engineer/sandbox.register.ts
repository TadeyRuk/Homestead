// seat 5 (S5-09): a dev-server-only debug URL that opens one flight station with chosen parts, for building
// and balancing stations without playing the campus first. Open the game with, for example,
// ?station=engineer&parts=ion,rtg,lowgain,radar and press Play solo.
import { registerRule } from "../../core/step";
import { parseSandbox, sandboxRule } from "./sandbox";

const sandbox = import.meta.env.DEV && typeof location !== "undefined" ? parseSandbox(location.search) : null;
if (sandbox) {
  registerRule("brief", sandboxRule(sandbox));
  console.info(`sandbox: ${sandbox.station} station with ${JSON.stringify(sandbox.slots)}`);
}
