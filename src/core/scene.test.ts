import { describe, expect, it } from "vitest";
import { PHASE_ORDER } from "./phases";
import { changePhase, registerScene, sceneFor, type Scene } from "./scene";
import { createState } from "./state";

describe("scene registry", () => {
  it("has a scene for every phase out of the box", () => {
    for (const phase of PHASE_ORDER) expect(sceneFor(phase)).toBeDefined();
  });

  it("lets a seat replace a phase's stub with its own scene", () => {
    const campus: Scene = { draw: () => {} };
    registerScene("campus", campus);
    expect(sceneFor("campus")).toBe(campus);
    expect(sceneFor("flight")).not.toBe(campus);
  });
});

describe("changePhase", () => {
  it("exits the old scene, switches phase, then enters the new scene", () => {
    const calls: string[] = [];
    registerScene("brief", { draw: () => {}, exit: () => calls.push("exit brief") });
    registerScene("campus", {
      draw: () => {},
      enter: (s) => calls.push(`enter campus while phase=${s.phase}`),
    });
    const s = createState(1, "moon");
    s.phase = "brief";
    changePhase(s, "campus", 1_000);
    expect(calls).toEqual(["exit brief", "enter campus while phase=campus"]);
    expect(s.phaseEndsAt).toBe(181_000);
  });
});
