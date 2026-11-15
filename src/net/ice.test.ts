import { describe, expect, it, vi } from "vitest";
import { iceServersFrom } from "./ice";

describe("iceServersFrom", () => {
  it("keeps PeerJS's own STUN and TURN servers when nothing is configured", () => {
    expect(iceServersFrom(undefined)).toBeUndefined();
    expect(iceServersFrom("")).toBeUndefined();
  });

  it("reads a JSON list of servers, so a TURN relay can be added without a code change", () => {
    const raw = '[{"urls":"stun:stun.example.org:3478"},{"urls":"turn:turn.example.org:3478","username":"u","credential":"p"}]';
    expect(iceServersFrom(raw)).toEqual([
      { urls: "stun:stun.example.org:3478" },
      { urls: "turn:turn.example.org:3478", username: "u", credential: "p" },
    ]);
  });

  it("warns and falls back to the defaults on a malformed setting instead of breaking every connection", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(iceServersFrom("not json")).toBeUndefined();
    expect(iceServersFrom('[{"nope":1}]')).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
