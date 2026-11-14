import { describe, expect, it } from "vitest";
import { createInput, keyToAction } from "./input";

describe("keyToAction", () => {
  it("maps physical WASD and arrow keys to directions, whatever the layout", () => {
    expect(keyToAction("KeyW")).toBe("up");
    expect(keyToAction("ArrowUp")).toBe("up");
    expect(keyToAction("KeyA")).toBe("left");
    expect(keyToAction("ArrowLeft")).toBe("left");
    expect(keyToAction("KeyS")).toBe("down");
    expect(keyToAction("ArrowRight")).toBe("right");
  });

  it("maps E, Q and Tab to interact, panel and switch", () => {
    expect(keyToAction("KeyE")).toBe("interact");
    expect(keyToAction("KeyQ")).toBe("panel");
    expect(keyToAction("Tab")).toBe("switch");
  });

  it("ignores unmapped keys", () => {
    expect(keyToAction("KeyX")).toBeNull();
  });
});

function harness() {
  const target = new EventTarget();
  const input = createInput(target);
  const key = (type: string, code: string) =>
    target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { code }));
  return { target, input, key };
}

describe("createInput", () => {
  it("reports held directions as a move vector and one-shot presses once", () => {
    const { input, key } = harness();
    key("keydown", "KeyD");
    key("keydown", "KeyW");
    key("keydown", "KeyE");
    expect(input.read()).toEqual({ dx: 1, dy: -1, interact: true, panel: false, switch: false });
    expect(input.read()).toEqual({ dx: 1, dy: -1, interact: false, panel: false, switch: false });
    key("keyup", "KeyD");
    expect(input.read().dx).toBe(0);
  });

  it("keeps moving while one of two keys for the same direction is still held", () => {
    const { input, key } = harness();
    key("keydown", "KeyW");
    key("keydown", "ArrowUp");
    key("keyup", "ArrowUp");
    expect(input.read().dy).toBe(-1);
  });

  it("releases everything when the window loses focus", () => {
    const { target, input, key } = harness();
    key("keydown", "KeyD");
    target.dispatchEvent(new Event("blur"));
    expect(input.read().dx).toBe(0);
  });

  it("leaves keys alone while the player types in a form field", () => {
    const { target, input } = harness();
    const field = { tagName: "INPUT" };
    const e = Object.assign(new Event("keydown", { cancelable: true }), { code: "KeyE" });
    Object.defineProperty(e, "target", { value: field });
    target.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    expect(input.read().interact).toBe(false);
  });

  it("stops listening after dispose", () => {
    const { input, key } = harness();
    input.dispose();
    key("keydown", "KeyD");
    expect(input.read().dx).toBe(0);
  });

  it("lets browser shortcuts through instead of treating Ctrl+D as moving right", () => {
    const { target, input } = harness();
    const e = Object.assign(new Event("keydown", { cancelable: true }), { code: "KeyD", ctrlKey: true });
    target.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    expect(input.read().dx).toBe(0);
  });

  it("drops a press made just before the window lost focus", () => {
    const { target, input, key } = harness();
    key("keydown", "KeyE");
    target.dispatchEvent(new Event("blur"));
    expect(input.read().interact).toBe(false);
  });
});
