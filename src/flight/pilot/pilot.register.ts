// seat 3, taking seat 4's fallback (S4-02, S4-03): the pilot's station
import { registerRule } from "../../core/step";
import { registerStation } from "../stations";
import { drawPilot } from "./draw";
import { pilotRule } from "./pilot";

registerRule("flight", pilotRule);
registerStation("pilot", { draw: drawPilot });
