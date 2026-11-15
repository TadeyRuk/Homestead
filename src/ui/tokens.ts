import type { Role, Slot } from "../core/state";

/** the palette from the walkthrough mock; screens and the HUD use these and nothing else */
export const C = {
  ink: "#080e1a",
  space: "#060b16",
  panel: "rgba(8, 14, 26, 0.92)",
  line: "#1e2838",
  white: "#ebf0f5",
  muted: "#96a5b4",
  dim: "#5f6e80",
  crew: "#78ffdc",
  amber: "#ffb43c",
  red: "#ff5a50",
  green: "#6edc82",
  pink: "#ff96e1",
  blue: "#5a96f5",
} as const;

/** role colours, matching seat 2's player squares so a role reads the same everywhere */
export const ROLE_COLOUR: Record<Role, string> = {
  pilot: "#f08a24",
  engineer: "#e8c547",
  comms: "#3fc6d9",
  science: "#e0509a",
};

export const ROLE_NAME: Record<Role, string> = {
  pilot: "Pilot",
  engineer: "Rocket Engineer",
  comms: "Comms Engineer",
  science: "Science Officer",
};

export const SLOT_COLOUR: Record<Slot, string> = {
  propulsion: "#f08c32",
  power: "#5a96f5",
  comms: "#e6ebf0",
  payload: "#e6b946",
};

export const SLOT_NAME: Record<Slot, string> = {
  propulsion: "Propulsion",
  power: "Power",
  comms: "Comms",
  payload: "Payload",
};

export const MONO = '"IBM Plex Mono", ui-monospace, Consolas, monospace';
export const PIXEL = '"Pixelify Sans", "Courier New", monospace';
