// seat 2's surface minigames on the S2-19 frame; loaded at startup by src/register.ts
import { registerSurfaceGame } from "./games";
import { ICE_DRILL, iceDrill } from "./icedrill";

registerSurfaceGame(ICE_DRILL, iceDrill);
