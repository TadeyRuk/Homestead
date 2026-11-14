import { describe, expect, it } from "vitest";
import { createState } from "../../core/state";
import { debrisWarnings, linkRate, WARN_MS } from "./link";

function withDebris(at: number) {
  const s = createState(1, "mars");
  s.flight.events = [{ kind: "debris", at, until: at + 6_000, strength: 1 }, { kind: "flare", at, until: at + 9_000, strength: 1 }];
  return s;
}

describe("link effects", () => {
  it("warns the pilot of debris coming within the warning window, only while the link holds", () => {
    const s = withDebris(10_000);
    s.ship.linkLocked = true;
    expect(debrisWarnings(s, 10_000 - WARN_MS + 1)).toHaveLength(1);
    expect(debrisWarnings(s, 10_000 - WARN_MS - 1000)).toHaveLength(0);
    s.ship.linkLocked = false;
    expect(debrisWarnings(s, 10_000 - 1000)).toHaveLength(0);
  });

  it("doubles the send rate while locked", () => {
    const s = createState(1, "mars");
    s.ship.linkLocked = true;
    expect(linkRate(s)).toBe(2);
    s.ship.linkLocked = false;
    expect(linkRate(s)).toBe(1);
  });
});
