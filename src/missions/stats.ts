import type { MissionId } from "../core/state";

/** what one scan with a payload takes and gives, before site richness and instrument health */
export interface ScanStats {
  seconds: number;
  /** data units from a poor site; a rich site gives RICH_FACTOR times this */
  data: number;
}

/** a rich site gives this many times a poor one's data */
export const RICH_FACTOR = 2;

// placeholders from proposal section 04 ("quick scans, little data" to "slow scans, most data");
// seat 3 replaces them from src/data/ with registerScanStats (S3-01)
let scans: Record<string, ScanStats> = {
  camera: { seconds: 2, data: 4 },
  spectrometer: { seconds: 4, data: 8 },
  radar: { seconds: 6, data: 13 },
  "salvage-camera": { seconds: 3, data: 3 },
};

/** data units per second each antenna uploads at the lander; same placeholder note as above */
let uplinks: Record<string, number> = {
  "low-gain": 1.5,
  "high-gain": 4,
  laser: 6,
  "salvage-antenna": 0.8,
};

export function registerScanStats(table: Record<string, ScanStats>): void {
  scans = table;
}

export function registerUplinkRates(table: Record<string, number>): void {
  uplinks = table;
}

/** a payload's scan; anything unknown or missing scans like the salvage camera */
export function scanStats(payload: string | null): ScanStats {
  return (payload && scans[payload]) || scans["salvage-camera"] || { seconds: 3, data: 3 };
}

/** an antenna's upload rate; anything unknown or missing sends like the salvage antenna */
export function uplinkRate(antenna: string | null): number {
  return (antenna && uplinks[antenna]) || uplinks["salvage-antenna"] || 0.8;
}

/** Mission Control's list for one mission, from proposal section 06 */
export interface MissionList {
  /** rich sites to scan */
  scans: number;
  /** the item drilled and carried to the lander */
  sample: string;
  sampleLabel: string;
  /** the item carried from the lander and deployed at the ridge */
  instrument: string;
  instrumentLabel: string;
  bonusLabel: string;
}

let lists: Record<MissionId, MissionList> = {
  mars: {
    scans: 3,
    sample: "core-sample",
    sampleLabel: "Drill a core at the crater rim",
    instrument: "weather-station",
    instrumentLabel: "Deploy the weather station on the ridge",
    bonusLabel: "Photograph a dust devil",
  },
  moon: {
    scans: 2,
    sample: "regolith",
    sampleLabel: "Collect regolith from the crater floor",
    instrument: "seismometer",
    instrumentLabel: "Deploy the seismometer on the ridge",
    bonusLabel: "Photograph Earth from the surface",
  },
};

export function registerMissionList(mission: MissionId, list: MissionList): void {
  lists = { ...lists, [mission]: list };
}

export function missionList(mission: MissionId): MissionList {
  return lists[mission];
}

/** seconds for each timed surface job other than a scan */
export const TASK_SECONDS = { drill: 4, deploy: 3, photo: 2 } as const;
