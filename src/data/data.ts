import type { PartInfo } from "../core/catalog";
import type { MissionInfo } from "../core/missions";
import type { MissionId } from "../core/state";
import type { MissionList, ScanStats } from "../missions/stats";
import missionsJson from "./missions.json";
import partsJson from "./parts.json";

/** how a pilot's engine steers: fixed pulses, smooth, or slow */
export type Steer = "pulse" | "smooth" | "slow";

/** one part with everything the screens, the pilot and the report read; the rules read the PartInfo fields */
export interface PartData extends PartInfo {
  name: string;
  /** engines: how the pilot steers */
  steer?: Steer;
  /** engines: lanes per second a full turn moves the ship, before mass slows it */
  turn?: number;
  /** engines: fuel (0..1) burned per second of full thrust, before mass makes it worse */
  burn?: number;
  /** power parts: true for arrays that solar flares and distance from the Sun weaken */
  solar?: boolean;
  /** power parts: how much wider the ship is to debris, 1 = normal */
  target?: number;
  /** power parts: drill torque on the surface ice drill (S2-20), the width of its safe pressure band, 0..1 */
  torque?: number;
  /** what the part does in flight, in a few words, from proposal section 04 */
  flight: string;
  /** what the part does on the surface, in a few words */
  surface: string;
  /** the real hardware it is based on, named by the report; "scrap" for salvage */
  real: string;
  /** the report's "what real missions do" line for this part */
  fact: string;
}

/** a mission card: what the brief shows and what startRun hands the crew */
export interface MissionData extends MissionInfo {
  name: string;
  travel: string;
  radioDelay: string;
  fact: string;
  hazard: string;
  objectives: string[];
  bonus: string;
  list: Omit<MissionList, "bonusLabel"> & { bonusLabel: string };
}

export const PARTS: readonly PartData[] = partsJson as PartData[];

const missions = missionsJson as unknown as Record<MissionId, MissionData> & {
  scans: Record<string, ScanStats>;
  uplinks: Record<string, number>;
};

export const MISSIONS: Record<MissionId, MissionData> = { moon: missions.moon, mars: missions.mars };
export const SCANS: Record<string, ScanStats> = missions.scans;
export const UPLINKS: Record<string, number> = missions.uplinks;

/** a part's full data, or undefined for an id the data file doesn't know (such as a carried sample) */
export function partData(id: string | null | undefined): PartData | undefined {
  return id ? PARTS.find((p) => p.id === id) : undefined;
}

/** a readable name for any part id: the data file's name, or the id with its dashes turned to spaces */
export function partName(id: string | null | undefined): string {
  if (!id) return "nothing";
  return partData(id)?.name ?? id.replace(/-/g, " ");
}
