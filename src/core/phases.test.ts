import { describe, expect, it } from "vitest";
import { createState } from "./state";
import { enterPhase, nextPhase } from "./phases";

describe("phase order", () => {
  it("runs lobby, brief, campus, flight, surface, report, then back to lobby", () => {
    const order = ["lobby"];
    let p = nextPhase("lobby");
    while (p !== "lobby") {
      order.push(p);
      p = nextPhase(p);
    }
    expect(order).toEqual(["lobby", "brief", "campus", "flight", "surface", "report"]);
  });
});

describe("enterPhase", () => {
  it("sets the phase and its end time from the proposal's lengths", () => {
    const s = createState(1, "mars");
    enterPhase(s, "campus", 5_000);
    expect(s.phase).toBe("campus");
    expect(s.phaseEndsAt).toBe(5_000 + 180_000);
  });

  it("starts the run clock when the brief begins", () => {
    const s = createState(1, "mars");
    enterPhase(s, "brief", 7_000);
    expect(s.runStartedAt).toBe(7_000);
    expect(s.phaseEndsAt).toBe(7_000 + 20_000);
  });

  it("gives the lobby no deadline", () => {
    const s = createState(1, "mars");
    enterPhase(s, "lobby", 7_000);
    expect(s.phaseEndsAt).toBeNull();
  });
});

describe("a new run", () => {
  it("clears the previous run's event log when the brief begins", () => {
    const s = createState(1, "mars");
    s.log.push({ t: 3, phase: "report", kind: "extraction" });
    enterPhase(s, "brief", 9_000);
    expect(s.log).toEqual([]);
  });
});

describe("onEnterPhase", () => {
  it("runs a seat's hook as its phase starts, after the old map's parts are cleared", async () => {
    const { onEnterPhase } = await import("./phases");
    const seen: number[] = [];
    onEnterPhase("campus", (s) => seen.push(s.parts.length));
    const s = createState(1, "mars");
    s.parts.push({ id: "x1", part: "rtg", x: 0, y: 0 });
    enterPhase(s, "campus", 0);
    expect(seen).toEqual([0]);
  });
});
