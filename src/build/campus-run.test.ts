import { describe, expect, it } from "vitest";
import "../register";
import { startRun } from "../core/lobby";
import { createState } from "../core/state";
import { step } from "../core/step";

describe("a campus run through step, with every seat's registrations loaded", () => {
  it("spawns parts as campus starts and launches once with salvage when the timer runs out", () => {
    const s = createState(3, "mars");
    s.players.push({ id: "a", name: "a", roles: [], station: null, x: 0, y: 0, carrying: null, oxygen: 1, power: 1, down: false });
    startRun(s, "mars", 0);
    step(s, {}, 20_000, 0.016);
    expect(s.phase).toBe("campus");
    expect(s.parts.length).toBeGreaterThan(0);
    const deadline = s.phaseEndsAt!;
    step(s, {}, deadline, 0.016);
    expect(s.phase).toBe("flight");
    expect(s.log.filter((e) => e.kind === "salvage_filled")).toHaveLength(4);
    step(s, {}, deadline + 16, 0.016);
    expect(s.phase).toBe("flight");
  });
});
