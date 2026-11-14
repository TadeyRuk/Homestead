import { describe, expect, it, vi } from "vitest";
import { PHASE_ORDER } from "./phases";
import { followPhase, registerScene, sceneFor, type Scene } from "./scene";
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

describe("followPhase", () => {
  it("exits the scene this tab was drawing and enters the one for the state's phase", () => {
    const calls: string[] = [];
    registerScene("brief", { draw: () => {}, exit: () => calls.push("exit brief") });
    registerScene("campus", {
      draw: () => {},
      enter: (s) => calls.push(`enter campus while phase=${s.phase}`),
    });
    const s = createState(1, "moon");
    s.phase = "campus";
    expect(followPhase("brief", s)).toBe("campus");
    expect(calls).toEqual(["exit brief", "enter campus while phase=campus"]);
  });

  it("does nothing while the phase has not changed", () => {
    const calls: string[] = [];
    registerScene("flight", { draw: () => {}, enter: () => calls.push("enter"), exit: () => calls.push("exit") });
    const s = createState(1, "moon");
    s.phase = "flight";
    expect(followPhase("flight", s)).toBe("flight");
    expect(calls).toEqual([]);
  });
});

describe("double registration", () => {
  it("warns when a second scene replaces one a seat already registered", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    registerScene("surface", { draw: () => {} });
    expect(warn).not.toHaveBeenCalled();
    registerScene("surface", { draw: () => {} });
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
