import { onEnterPhase } from "../core/phases";
import { registerRule } from "../core/step";
import { launchRule } from "./launch";
import { spawnParts } from "./spawns";

// seat 1's campus: seeded parts on entry (S1-09), countdown and liftoff every tick (S1-10)
onEnterPhase("campus", (state) => spawnParts(state));
registerRule("campus", launchRule);
