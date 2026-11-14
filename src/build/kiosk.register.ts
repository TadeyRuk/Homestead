// seat 6's kiosk; loaded at startup by src/register.ts
import { registerRule } from "../core/step";
import { kioskRule } from "./kiosk";

// build/ sorts before ground/, so this runs before seat 2's carry rule and can spend the press first
registerRule("campus", kioskRule);
