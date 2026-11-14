import { describe, expect, it } from "vitest";
import { createState } from "./state";
import { startRun } from "./lobby";
import { missionInfo, registerMissionInfo } from "./missions";

describe("mission info", () => {
  it("has placeholder credits and the proposal's data targets until seat 3 registers real ones", () => {
    expect(missionInfo("moon").dataTarget).toBe(25);
    expect(missionInfo("mars").dataTarget).toBe(40);
    expect(missionInfo("mars").credits).toBeGreaterThan(0);
  });

  it("is what startRun hands the crew", () => {
    registerMissionInfo("moon", { credits: 70, dataTarget: 25 });
    const s = createState(1, "moon");
    startRun(s, "moon", 0);
    expect(s.credits).toBe(70);
    expect(s.data.target).toBe(25);
  });
});
