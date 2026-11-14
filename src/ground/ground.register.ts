// seat 2's rules and scenes; loaded at startup by src/register.ts
import { registerScene } from "../core/scene";
import { registerRule } from "../core/step";
import { CAMPUS } from "./campus";
import { groundRule } from "./player";
import { groundScene } from "./scene";
import { registerGround, TEST_ROOM } from "./world";

registerGround("campus", CAMPUS);
// a one-screen test room until the real surface map lands
registerGround("surface", TEST_ROOM);

// order matters within a phase: walls first, so later rules see where players really are
registerRule("campus", groundRule);
registerRule("surface", groundRule);

registerScene("campus", groundScene("campus"));
registerScene("surface", groundScene("surface"));
