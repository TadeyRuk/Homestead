import { describe, expect, it } from "vitest";
import "../data/data.register";
import { computeMeters, withPart } from "./meters";

const empty = { propulsion: null, power: null, comms: null, payload: null };
const opts = { credits: 40, startCredits: 40, secondsLeft: 120, buildSeconds: 180 };

describe("meter math (S3-10)", () => {
  it("weighs the mounted parts against the engine's lift", () => {
    const m = computeMeters({ ...empty, propulsion: "ion-drive", power: "large-solar", payload: "radar" }, opts);
    expect(m.mass.mass).toBe(120 + 150 + 160);
    expect(m.mass.lift).toBe(500);
    expect(m.mass.tone).toBe("warn");
    // with the proposal's masses only the salvage motor can be overloaded: 250 + 150 + 160 + 70 > 550
    const over = computeMeters({ propulsion: "salvage-motor", power: "large-solar", payload: "radar", comms: "high-gain" }, opts);
    expect(over.mass.tone).toBe("bad");
  });

  it("sets supply against draw, and flags a bus that can't carry its loads", () => {
    const m = computeMeters({ propulsion: "ion-drive", power: "small-solar", comms: "laser", payload: "radar" }, opts);
    expect(m.power.supply).toBe(300);
    expect(m.power.draw).toBe(250 + 120 + 200);
    expect(m.power.tone).toBe("bad");
  });

  it("reads data per reading from the payload and uplink rate from the antenna", () => {
    const m = computeMeters({ ...empty, comms: "laser", payload: "radar" }, opts);
    expect(m.data.perScan).toBeGreaterThan(computeMeters({ ...empty, payload: "camera" }, opts).data.perScan);
    expect(m.comms.rate).toBeGreaterThan(computeMeters({ ...empty, comms: "low-gain" }, opts).comms.rate);
    expect(computeMeters(empty, opts).comms.text).toBe("no antenna");
  });

  it("changes when a part mounts or swaps", () => {
    const before = computeMeters({ ...empty, propulsion: "solid-motor" }, opts);
    const after = computeMeters(withPart({ ...empty, propulsion: "solid-motor" }, "chemical-engine"), opts);
    expect(after.mass.lift).toBe(900);
    expect(before.mass.lift).toBe(600);
  });

  it("previews nothing for something that isn't a part, like a sample", () => {
    expect(withPart(empty, "core-sample")).toBe(empty);
  });
});
