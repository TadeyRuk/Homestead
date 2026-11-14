import { describe, expect, it } from "vitest";
import type { Input } from "./input";
import { enterPhase } from "./phases";
import { createState, type Player } from "./state";
import { PLAYER_SPEED, registerRule, step } from "./step";

const still: Input = { dx: 0, dy: 0, interact: false, panel: false, switch: false };
const player = (id: string, x = 100, y = 100): Player => ({
  id, name: id, roles: [], x, y, carrying: null, oxygen: 1, power: 1, down: false,
});

function campusWith(...players: Player[]) {
  const s = createState(1, "mars");
  enterPhase(s, "campus", 0);
  s.players.push(...players);
  return s;
}

describe("step", () => {
  it("moves each player by their held direction, speed and dt", () => {
    const s = campusWith(player("a"), player("b"));
    step(s, { a: { ...still, dx: 1 }, b: { ...still, dy: -1 } }, 1_000, 0.5);
    expect(s.players[0]).toMatchObject({ x: 100 + PLAYER_SPEED * 0.5, y: 100 });
    expect(s.players[1]).toMatchObject({ x: 100, y: 100 - PLAYER_SPEED * 0.5 });
  });

  it("leaves players without input where they are", () => {
    const s = campusWith(player("a"));
    step(s, {}, 1_000, 0.5);
    expect(s.players[0]).toMatchObject({ x: 100, y: 100 });
  });

  it("ignores input for a player who is not in the run", () => {
    const s = campusWith(player("a"));
    step(s, { ghost: { ...still, dx: 1 } }, 1_000, 0.5);
    expect(s.players).toHaveLength(1);
    expect(s.players[0].x).toBe(100);
  });

  it("moves to the next phase when the timer is up", () => {
    const s = campusWith(player("a"));
    step(s, {}, 180_000, 0.016);
    expect(s.phase).toBe("flight");
    expect(s.phaseEndsAt).toBe(180_000 + 180_000);
  });

  it("does not move a downed player", () => {
    const s = campusWith({ ...player("a"), down: true });
    step(s, { a: { ...still, dx: 1 } }, 1_000, 0.5);
    expect(s.players[0].x).toBe(100);
  });

  it("stays in the lobby until someone starts the run", () => {
    const s = createState(1, "mars");
    s.players.push(player("a"));
    step(s, {}, 5_000_000, 0.016);
    expect(s.phase).toBe("lobby");
  });

  it("keeps players still in the lobby while the crew gathers", () => {
    const s = createState(1, "mars");
    s.players.push(player("a"));
    step(s, { a: { ...still, dx: 1 } }, 1_000, 0.5);
    expect(s.players[0].x).toBe(100);
  });

  it("runs a seat's registered rule during its phase, with every player's input", () => {
    const seen: string[] = [];
    registerRule("surface", (state, inputs) => {
      for (const p of state.players) if (inputs[p.id]?.interact) seen.push(p.id);
    });
    const s = createState(1, "mars");
    enterPhase(s, "surface", 0);
    s.players.push(player("a"), player("b"));
    step(s, { b: { ...still, interact: true } }, 1_000, 0.016);
    expect(seen).toEqual(["b"]);
  });

  it("does not run a rule outside its phase", () => {
    let ran = false;
    registerRule("report", () => {
      ran = true;
    });
    const s = campusWith(player("a"));
    step(s, {}, 1_000, 0.016);
    expect(ran).toBe(false);
  });
});
