import { describe, expect, it } from "vitest";
import { createState } from "../core/state";
import { parseFromClient, parseFromHost } from "./protocol";

describe("parseFromClient (the host never trusts a joiner)", () => {
  it("accepts a hello with a name, trimmed and capped at 16 characters", () => {
    expect(parseFromClient({ t: "hello", name: "  Ada  " })).toEqual({ t: "hello", name: "Ada" });
    expect(parseFromClient({ t: "hello", name: "x".repeat(40) })).toEqual({ t: "hello", name: "x".repeat(16) });
  });

  it("rejects a hello with no usable name", () => {
    expect(parseFromClient({ t: "hello", name: "   " })).toBeNull();
    expect(parseFromClient({ t: "hello", name: 42 })).toBeNull();
  });

  it("accepts an input with directions of -1, 0 or 1 and boolean presses", () => {
    const input = { dx: -1, dy: 1, interact: true, panel: false, switch: false };
    expect(parseFromClient({ t: "input", input })).toEqual({ t: "input", input });
  });

  it("rejects inputs that would let a joiner speed-hack or send junk", () => {
    const ok = { dx: 0, dy: 0, interact: false, panel: false, switch: false };
    expect(parseFromClient({ t: "input", input: { ...ok, dx: 50 } })).toBeNull();
    expect(parseFromClient({ t: "input", input: { ...ok, dy: 0.5 } })).toBeNull();
    expect(parseFromClient({ t: "input", input: { ...ok, interact: "yes" } })).toBeNull();
    expect(parseFromClient({ t: "input" })).toBeNull();
  });

  it("accepts a ping, which keeps a quiet joiner from looking dropped", () => {
    expect(parseFromClient({ t: "ping" })).toEqual({ t: "ping" });
  });

  it("accepts a request for one of the four roles, and nothing else", () => {
    expect(parseFromClient({ t: "role", role: "pilot" })).toEqual({ t: "role", role: "pilot" });
    expect(parseFromClient({ t: "role", role: "captain" })).toBeNull();
    expect(parseFromClient({ t: "role" })).toBeNull();
  });

  it("rejects unknown types and non-objects", () => {
    expect(parseFromClient({ t: "snapshot", state: {} })).toBeNull();
    expect(parseFromClient("hello")).toBeNull();
    expect(parseFromClient(null)).toBeNull();
  });
});

describe("parseFromHost", () => {
  it("accepts welcome, snapshot and end", () => {
    const state = createState(1, "moon");
    expect(parseFromHost({ t: "welcome", playerId: "p2" })).toEqual({ t: "welcome", playerId: "p2" });
    expect(parseFromHost({ t: "snapshot", state, hostNow: 5 })).toEqual({ t: "snapshot", state, hostNow: 5 });
    expect(parseFromHost({ t: "end", reason: "Host left" })).toEqual({ t: "end", reason: "Host left" });
  });

  it("rejects a snapshot without a state that looks like a run", () => {
    expect(parseFromHost({ t: "snapshot", state: { phase: "campus" }, hostNow: 5 })).toBeNull();
    expect(parseFromHost({ t: "snapshot", state: createState(1, "moon") })).toBeNull();
    expect(parseFromHost({ t: "snapshot" })).toBeNull();
  });
});
