// seat 2's rules and scenes; loaded at startup by src/register.ts
import { padRule } from "../build/pad";
import { registerScene } from "../core/scene";
import { registerRule } from "../core/step";
import { CAMPUS } from "./campus";
import { carryRule } from "./carry";
import { extractionRule } from "./extraction";
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
// E at the pad while carrying mounts (S2-10); seat 1's launch rule takes empty-handed E there
registerRule("campus", padRule);
// last on the surface, so it sees every suit and every carried part as the tick ends
registerRule("surface", extractionRule);

registerScene("campus", groundScene("campus"));
registerScene("surface", groundScene("surface"));
