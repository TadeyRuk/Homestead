import { describe, expect, it } from "vitest";
import { createState, type MissionId, type Player, type Role } from "../../core/state";
import { activeEvents, planEvents } from "./director";

const crew = (n: number): Player[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`, name: `p${i}`, roles: [] as Role[], station: null, x: 0, y: 0, carrying: null, oxygen: 1, power: 1, down: false,
  }));
function run(seed: number, mission: MissionId, players: number) {
  const s = createState(seed, mission);
  s.players.push(...crew(players));
  return s;
}

describe("event director", () => {
  it("plans the same events for the same seed", () => {
    expect(planEvents(run(4, "mars", 2), 0, 180)).toEqual(planEvents(run(4, "mars", 2), 0, 180));
    expect(planEvents(run(5, "mars", 2), 0, 180)).not.toEqual(planEvents(run(4, "mars", 2), 0, 180));
  });

  it("throws more at Mars than the Moon, and fewer at a solo crew", () => {
    const mars = planEvents(run(1, "mars", 2), 0, 180).length;
    const moon = planEvents(run(1, "moon", 2), 0, 180).length;
    const solo = planEvents(run(1, "mars", 1), 0, 180).length;
    expect(mars).toBeGreaterThan(moon);
    expect(solo).toBeLessThan(mars);
  });

  it("keeps every event inside the flight and lets one be found while it runs", () => {
    const events = planEvents(run(2, "mars", 2), 1_000, 180);
    for (const e of events) {
      expect(e.at).toBeGreaterThanOrEqual(1_000);
      expect(e.until).toBeLessThanOrEqual(1_000 + 180_000);
      expect(["debris", "flare", "spike"]).toContain(e.kind);
    }
    const s = run(2, "mars", 2);
    s.flight.events = events;
    const e = events[0];
    expect(activeEvents(s, e.at)).toContainEqual(e);
    expect(activeEvents(s, e.until)).not.toContainEqual(e);
  });
});
