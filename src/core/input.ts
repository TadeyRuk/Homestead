export type Action = "up" | "down" | "left" | "right" | "interact" | "panel" | "switch";

/** one player's keys; joiners send it to the host when it changes, rules read it from step()'s inputs */
export interface Input {
  /** -1, 0 or 1 */
  dx: number;
  /** -1, 0 or 1 */
  dy: number;
  interact: boolean;
  panel: boolean;
  switch: boolean;
}

// physical keys (KeyboardEvent.code), so WASD sits in the same place on AZERTY and QWERTZ
const KEYS: Record<string, Action> = {
  KeyW: "up", ArrowUp: "up",
  KeyS: "down", ArrowDown: "down",
  KeyA: "left", ArrowLeft: "left",
  KeyD: "right", ArrowRight: "right",
  KeyE: "interact",
  KeyQ: "panel",
  Tab: "switch",
};

export function keyToAction(code: string): Action | null {
  return KEYS[code] ?? null;
}

const CONTROLS = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"]);

// keys aimed at a form control belong to the page (typing, Tab between fields), not the game
function onControl(target: unknown): boolean {
  const el = target as { tagName?: string; isContentEditable?: boolean } | null;
  return !!el && (CONTROLS.has(el.tagName ?? "") || !!el.isContentEditable);
}

// the only keyboard listener in the game; seats read input through read()
export function createInput(target: EventTarget = window): { read(): Input; dispose(): void } {
  const down = new Set<string>(); // codes, so two keys for one action release independently
  const pressed = new Set<Action>();
  const held = (a: Action) => [...down].some((code) => KEYS[code] === a);

  const onDown = (e: Event) => {
    const { code, ctrlKey, metaKey, altKey } = e as KeyboardEvent;
    const action = keyToAction(code);
    // modifier combos are browser shortcuts, and macOS drops keyup for keys released under Cmd
    if (!action || ctrlKey || metaKey || altKey || onControl(e.target)) return;
    e.preventDefault(); // stops Tab moving browser focus
    if (!held(action)) pressed.add(action);
    down.add(code);
  };
  const onUp = (e: Event) => down.delete((e as KeyboardEvent).code);
  // keyup never arrives if the key is released in another window
  const onBlur = () => {
    down.clear();
    pressed.clear();
  };

  target.addEventListener("keydown", onDown);
  target.addEventListener("keyup", onUp);
  target.addEventListener("blur", onBlur);

  return {
    read() {
      const input: Input = {
        dx: (held("right") ? 1 : 0) - (held("left") ? 1 : 0),
        dy: (held("down") ? 1 : 0) - (held("up") ? 1 : 0),
        interact: pressed.has("interact"),
        panel: pressed.has("panel"),
        switch: pressed.has("switch"),
      };
      pressed.clear();
      return input;
    },
    dispose() {
      target.removeEventListener("keydown", onDown);
      target.removeEventListener("keyup", onUp);
      target.removeEventListener("blur", onBlur);
      down.clear();
      pressed.clear();
    },
  };
}
