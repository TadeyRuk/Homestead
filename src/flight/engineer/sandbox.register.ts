// seat 5 (S5-09): a dev-server-only debug URL that opens one flight station with chosen parts, for building
// and balancing stations without playing the campus first. Open the game with, for example,
// ?station=engineer&parts=ion,rtg,lowgain,radar and press Play solo.
import { registerRule } from "../../core/step";
import { sandboxRule } from "./sandbox";

if (import.meta.env.DEV && typeof location !== "undefined" && new URLSearchParams(location.search).has("station")) {
  registerRule("brief", sandboxRule(location.search));
}
