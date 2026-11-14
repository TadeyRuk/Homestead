import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, makeCode, normalizeCode, peerId } from "./code";

describe("join codes", () => {
  it("are six characters from an alphabet without look-alikes", () => {
    for (let i = 0; i < 50; i++) {
      const code = makeCode();
      expect(code).toMatch(/^[A-Z2-9]{6}$/);
      for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
    }
    expect(CODE_ALPHABET).not.toMatch(/[01OI]/);
  });

  it("accepts what a player types, in any case and with stray spaces", () => {
    expect(normalizeCode(" k7mq2x ")).toBe("K7MQ2X");
  });

  it("rejects codes of the wrong length or with characters we never hand out", () => {
    expect(normalizeCode("K7MQ2")).toBeNull();
    expect(normalizeCode("K7MQ2XY")).toBeNull();
    expect(normalizeCode("K7MQ0X")).toBeNull();
    expect(normalizeCode("K7-Q2X")).toBeNull();
  });

  it("turns a code into a namespaced PeerJS id", () => {
    expect(peerId("K7MQ2X")).toBe("homestead-k7mq2x");
  });
});
