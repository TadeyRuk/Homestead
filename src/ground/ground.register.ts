// seat 2's rules and scenes; loaded at startup by src/register.ts
import { padRule } from "../build/pad";
import { onEnterPhase } from "../core/phases";
import { claimsPress, objectivesRule, startSurface } from "../missions/objectives";
import { registerScene } from "../core/scene";
import { registerRule } from "../core/step";
import { CAMPUS } from "./campus";
import { carryRule, registerPressClaim } from "./carry";
import { extractionRule } from "./extraction";
import { groundRule } from "./player";
import { groundScene } from "./scene";
import { fillSuits, suitRule } from "./suit";
import { SURFACE } from "./surface";
import { registerGround } from "./world";

registerGround("campus", CAMPUS);
registerGround("surface", SURFACE);

// order matters within a phase: walls first, so later rules see where players really are
registerRule("campus", groundRule);
registerRule("surface", groundRule);
registerRule("campus", carryRule);
// the list before carrying: a press that starts or belongs to a job never also picks up or drops
registerRule("surface", objectivesRule);
registerRule("surface", carryRule);
// E at the pad while carrying mounts (S2-10); seat 1's launch rule takes empty-handed E there
registerRule("campus", padRule);
registerRule("surface", suitRule);
// last on the surface, so it sees every suit and every carried part as the tick ends
registerRule("surface", extractionRule);

onEnterPhase("surface", fillSuits);
onEnterPhase("surface", startSurface);
// E at a site, the sample, the deploy spot or the photo spot is a job, never a pickup or drop
registerPressClaim(claimsPress);

registerScene("campus", groundScene("campus"));
registerScene("surface", groundScene("surface"));
