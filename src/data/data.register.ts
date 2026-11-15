// seat 3 (S3-01): the part and mission data, handed to the catalog every rule reads from
import { registerParts } from "../core/catalog";
import { registerMissionInfo } from "../core/missions";
import { registerMissionList, registerObjectivePool, registerScanStats, registerUplinkRates } from "../missions/stats";
import { MISSIONS, PARTS, SCANS, UPLINKS } from "./data";

registerParts([...PARTS]);
for (const id of ["moon", "mars"] as const) {
  const m = MISSIONS[id];
  registerMissionInfo(id, { credits: m.credits, dataTarget: m.dataTarget });
  registerMissionList(id, m.list);
  registerObjectivePool(id, m.pool);
}
registerScanStats(SCANS);
registerUplinkRates(UPLINKS);
