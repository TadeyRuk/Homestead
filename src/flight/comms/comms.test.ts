import { describe, expect, it } from "vitest";
import "../../register";
import { enterPhase } from "../../core/phases";
import { createState } from "../../core/state";
import { step } from "../../core/step";

const still = { dx: 0, dy: 0, interact: false, panel: false, switch: false };

describe("comms in a real flight", () => {
  it("loses the link when the pilot keeps turning, and reports it for the crew strip", () => {
    const s = createState(1, "mars");
    s.players.push({ id: "a", name: "a", roles: ["pilot", "engineer", "comms", "science"], station: null, x: 0, y: 0, carrying: null, oxygen: 1, power: 1, down: false });
    s.ship.slots.comms = "laser";
    enterPhase(s, "flight", 0);
    for (let t = 1; t <= 60; t++) step(s, { a: { ...still, dx: 1 } }, t * 50, 0.05);
    expect(s.ship.linkLocked).toBe(false);
    expect(s.trouble.comms).toBe("Link lost");
    expect(s.log.map((e) => e.kind)).toContain("link_lost");
  });

  it("has no link at all with no antenna mounted", () => {
    const s = createState(1, "mars");
    enterPhase(s, "flight", 0);
    step(s, {}, 50, 0.05);
    expect(s.ship.linkLocked).toBe(false);
  });
});
