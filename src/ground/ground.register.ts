// seat 2's rules and scenes; loaded at startup by src/register.ts
import { registerScene } from "../core/scene";
import { registerRule } from "../core/step";
import { CAMPUS } from "./campus";
import { carryRule } from "./carry";
import { groundRule } from "./player";
import { groundScene } from "./scene";
import { SURFACE } from "./surface";
import { registerGround } from "./world";

registerGround("campus", CAMPUS);
registerGround("surface", SURFACE);

// order matters within a phase: walls first, so later rules see where players really are
registerRule("campus", groundRule);
registerRule("surface", groundRule);
registerRule("campus", carryRule);
registerRule("surface", carryRule);

registerScene("campus", groundScene("campus"));
registerScene("surface", groundScene("surface"));
