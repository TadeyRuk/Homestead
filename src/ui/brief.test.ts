import { describe, expect, it } from "vitest";
import type { Input } from "../core/input";
import { createState, type Player } from "../core/state";
import { briefRule, resetReady } from "./brief";

const still: Input = { dx: 0, dy: 0, interact: false, panel: false, switch: false };
const press: Input = { ...still, interact: true };

function crew(...ids: string[]) {
  const s = createState(1, "mars");
  s.phase = "brief";
  s.phaseEndsAt = 20_000;
  s.players = ids.map((id) => ({ id, name: id, roles: [], station: null, x: 0, y: 0, carrying: null, oxygen: 1, power: 1, down: false }) as Player);
  resetReady();
  return s;
}

describe("brief ready rule (S3-04)", () => {
  it("lets a solo player skip the card with E", () => {
    const s = crew("a");
    briefRule(s, { a: press }, 3_000);
    expect(s.phaseEndsAt).toBe(3_000);
  });

  it("ignores E in the first second, so a key held from the lobby can't skip the card unread", () => {
    const s = crew("a");
    briefRule(s, { a: press }, 500);
    expect(s.phaseEndsAt).toBe(20_000);
    // the early press must not count later either
    briefRule(s, { a: still }, 1_500);
    expect(s.phaseEndsAt).toBe(20_000);
  });

  it("waits for the whole crew", () => {
    const s = crew("a", "b");
    briefRule(s, { a: press, b: still }, 3_000);
    expect(s.phaseEndsAt).toBe(20_000);
    briefRule(s, { a: still, b: press }, 4_000);
    expect(s.phaseEndsAt).toBe(4_000);
  });
});
