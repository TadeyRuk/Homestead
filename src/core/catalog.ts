import type { Slot } from "./state";

export interface PartInfo {
  id: string;
  slot: Slot;
  /** kg */
  mass: number;
  /** watts: positive supplies, negative draws */
  power: number;
  /** kg the engine can lift; required on propulsion parts */
  lift?: number;
  /** energy core temperature added per second while mounted (payload and power parts); 0 when absent */
  heat?: number;
  /** comms parts: how far a pilot turn knocks the antenna off Earth, 0..1 */
  drift?: number;
  /** the weak part a slot gets when the build timer runs out; never spawns on the campus */
  salvage?: boolean;
}

// placeholders from proposal section 04's parts table; seat 3 replaces them with registerParts (S3-01)
let parts: PartInfo[] = [
  { id: "solid-motor", slot: "propulsion", mass: 180, power: -10, lift: 600 },
  { id: "chemical-engine", slot: "propulsion", mass: 300, power: -30, lift: 900 },
  { id: "ion-drive", slot: "propulsion", mass: 120, power: -250, lift: 500 },
  { id: "small-solar", slot: "power", mass: 60, power: 300 },
  { id: "large-solar", slot: "power", mass: 150, power: 600 },
  // "runs hot" in the proposal; heat values are placeholders for seat 3 and seat 5 to balance
  { id: "rtg", slot: "power", mass: 110, power: 450, heat: 0.02 },
  // proposal: low-gain "hardly drifts", the dish "drifts when the pilot turns", the laser is "hardest to keep on target"
  { id: "low-gain", slot: "comms", mass: 15, power: -20, drift: 0.1 },
  { id: "high-gain", slot: "comms", mass: 70, power: -80, drift: 0.5 },
  { id: "laser", slot: "comms", mass: 40, power: -120, drift: 0.9 },
  { id: "camera", slot: "payload", mass: 30, power: -40, heat: 0.01 },
  { id: "spectrometer", slot: "payload", mass: 80, power: -110, heat: 0.03 },
  { id: "radar", slot: "payload", mass: 160, power: -200, heat: 0.06 },
  // salvage: worse than anything on the campus, so running out the clock always costs something
  { id: "salvage-motor", slot: "propulsion", mass: 250, power: -20, lift: 550, salvage: true },
  { id: "salvage-battery", slot: "power", mass: 90, power: 150, salvage: true },
  { id: "salvage-antenna", slot: "comms", mass: 25, power: -40, drift: 0.3, salvage: true },
  { id: "salvage-camera", slot: "payload", mass: 40, power: -60, heat: 0.02, salvage: true },
];

const SLOTS: Slot[] = ["propulsion", "power", "comms", "payload"];

// checked here so a bad list fails at startup, not at the build timeout in front of the judges
export function registerParts(list: PartInfo[]): void {
  for (const slot of SLOTS) {
    if (!list.some((p) => p.slot === slot && p.salvage)) throw new Error(`registerParts: no salvage part for "${slot}"`);
  }
  const noLift = list.find((p) => p.slot === "propulsion" && !(p.lift && p.lift > 0));
  if (noLift) throw new Error(`registerParts: engine "${noLift.id}" needs a lift`);
  parts = list;
}

/** the part, or undefined; use where an unknown id should be handled rather than thrown */
export function findPart(id: string): PartInfo | undefined {
  return parts.find((x) => x.id === id);
}

export function partInfo(id: string): PartInfo {
  const p = parts.find((x) => x.id === id);
  if (!p) throw new Error(`unknown part "${id}"`);
  return p;
}

/** the parts that can spawn on the campus or be rolled at the kiosk */
export function buildable(): PartInfo[] {
  return parts.filter((p) => !p.salvage);
}

export function salvageFor(slot: Slot): string {
  const p = parts.find((x) => x.salvage && x.slot === slot);
  if (!p) throw new Error(`no salvage part for slot "${slot}"`);
  return p.id;
}

type Slots = Readonly<Record<Slot, string | null>>;

export function massOf(slots: Slots): number {
  return Object.values(slots).reduce((sum, id) => sum + (id ? partInfo(id).mass : 0), 0);
}

/** what the mounted engine can lift; 0 with no engine */
export function liftOf(slots: Slots): number {
  return slots.propulsion ? (partInfo(slots.propulsion).lift ?? 0) : 0;
}
