import { describe, expect, it } from "vitest";
import { createState } from "./core/state";
import { sceneFor } from "./core/scene";
import "./register";

describe("auto-registration", () => {
  it("loads every *.register.ts file, so the flight shell replaces the flight stub", () => {
    const texts: string[] = [];
    const ctx = { fillText: (t: string) => texts.push(t), set fillStyle(_: string) {}, set font(_: string) {} };
    const s = createState(1, "mars");
    s.phase = "flight";
    sceneFor("flight").draw(ctx as unknown as CanvasRenderingContext2D, s, { playerId: "nobody", now: 0 });
    expect(texts).toContain("No station yet. Roles are picked in the lobby.");
  });
});
