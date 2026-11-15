import { describe, expect, it } from "vitest";
import { createState } from "./state";
import { EVENT_KINDS, logEvent } from "./events";

describe("logEvent", () => {
  it("appends an event stamped with seconds since run start and the current phase", () => {
    const s = createState(1, "mars");
    s.phase = "flight";
    s.runStartedAt = 10_000;
    logEvent(s, "debris_hit", 12_500, { part: "large-solar", value: 0.2 });
    expect(s.log).toEqual([
      { t: 2.5, phase: "flight", kind: "debris_hit", part: "large-solar", value: 0.2 },
    ]);
  });

  it("keeps events in the order they happened", () => {
    const s = createState(1, "moon");
    logEvent(s, "part_picked", 1000);
    logEvent(s, "part_mounted", 2000);
    expect(s.log.map((e) => e.kind)).toEqual(["part_picked", "part_mounted"]);
  });

  it("lists the 30 kinds from the team contract plus task_failed", () => {
    expect(EVENT_KINDS).toHaveLength(31);
    expect(new Set(EVENT_KINDS).size).toBe(31);
    expect(EVENT_KINDS).toContain("task_failed");
  });
});
