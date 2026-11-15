// seat 6's surface hazards (S6-10); loaded at startup by src/register.ts
import { registerRule } from "../core/step";
import { hazardDrain, hazardRule } from "./hazards";
import { registerDrainModifier } from "./suit";

registerRule("surface", hazardRule);
registerDrainModifier(hazardDrain);
