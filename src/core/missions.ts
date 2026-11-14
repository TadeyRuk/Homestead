import type { MissionId } from "./state";

/** what a run starts with; seat 3 registers the real numbers from src/data/ (S3-01) */
export interface MissionInfo {
  credits: number;
  /** data units Mission Control asks to have uplinked */
  dataTarget: number;
}

// data targets from proposal section 06; credits are placeholders (Moon gets fewer, per section 03)
const info: Record<MissionId, MissionInfo> = {
  moon: { credits: 60, dataTarget: 25 },
  mars: { credits: 100, dataTarget: 40 },
};

export function registerMissionInfo(mission: MissionId, value: MissionInfo): void {
  info[mission] = value;
}

export function missionInfo(mission: MissionId): MissionInfo {
  return info[mission];
}
