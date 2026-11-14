import { describe, expect, it } from "vitest";
import { dealRoles, joinCrew, ROLES, startRun, takeRole } from "./lobby";
import { createState, type Player, type Role } from "./state";

const p = (id: string, roles: Role[] = []): Player => ({
  id, name: id, roles, station: null, x: 0, y: 0, carrying: null, oxygen: 1, power: 1, down: false,
});
function crew(n: number) {
  const s = createState(7, "mars");
  for (let i = 0; i < n; i++) s.players.push(p(`p${i}`));
  dealRoles(s);
  return s;
}
const held = (s: ReturnType<typeof crew>) => s.players.flatMap((x) => x.roles).sort();

describe("dealRoles", () => {
  it("gives a solo player all four roles", () => {
    expect(crew(1).players[0].roles).toEqual(["pilot", "engineer", "comms", "science"]);
  });

  it("splits four roles between two players as Pilot+Comms and Engineer+Science", () => {
    expect(crew(2).players.map((x) => x.roles)).toEqual([["pilot", "comms"], ["engineer", "science"]]);
  });

  it("gives one of three players two roles and the rest one each", () => {
    expect(crew(3).players.map((x) => x.roles)).toEqual([["pilot", "science"], ["engineer"], ["comms"]]);
  });

  it("gives four players one role each", () => {
    expect(crew(4).players.map((x) => x.roles)).toEqual([["pilot"], ["engineer"], ["comms"], ["science"]]);
  });
});

describe("takeRole", () => {
  it("swaps one-for-one with whoever held the role", () => {
    const s = crew(2);
    takeRole(s, "p1", "pilot");
    expect(s.players.map((x) => x.roles.slice().sort())).toEqual([["comms", "engineer"], ["pilot", "science"]]);
  });

  it("keeps every role held exactly once and nobody empty", () => {
    const s = crew(3);
    takeRole(s, "p1", "science");
    takeRole(s, "p2", "pilot");
    takeRole(s, "p0", "comms");
    expect(held(s)).toEqual([...ROLES].sort());
    expect(s.players.every((x) => x.roles.length > 0)).toBe(true);
  });

  it("does nothing for a role the player already holds, or an unknown player", () => {
    const s = crew(2);
    const before = JSON.stringify(s.players);
    takeRole(s, "p0", "pilot");
    takeRole(s, "ghost", "science");
    expect(JSON.stringify(s.players)).toBe(before);
  });
});

describe("startRun", () => {
  it("resolves Random to a mission from the seed, the same for the same seed", () => {
    const a = crew(1);
    const b = crew(1);
    startRun(a, "random", 1_000);
    startRun(b, "random", 1_000);
    expect(["moon", "mars"]).toContain(a.mission);
    expect(b.mission).toBe(a.mission);
  });

  it("uses the host's pick and opens the brief", () => {
    const s = crew(2);
    startRun(s, "moon", 1_000);
    expect(s.mission).toBe("moon");
    expect(s.phase).toBe("brief");
  });

  it("clears whatever the last run left behind, keeping the crew and their roles", () => {
    const s = crew(2);
    s.ship.slots.power = "rtg";
    s.ship.hull = 0.2;
    s.data.uplinked = 30;
    s.objectives.scan = true;
    s.trouble.pilot = "Debris";
    s.log.push({ t: 1, phase: "report", kind: "extraction" });
    s.players[0].down = true;
    s.players[0].oxygen = 0;
    s.players[0].carrying = "camera";
    s.players[0].station = "comms";
    startRun(s, "mars", 1_000);
    expect(s.ship.slots.power).toBeNull();
    expect(s.ship.hull).toBe(1);
    expect(s.data.uplinked).toBe(0);
    expect(s.objectives).toEqual({});
    expect(s.trouble).toEqual({});
    expect(s.log).toEqual([]);
    expect(s.players[0]).toMatchObject({ down: false, oxygen: 1, carrying: null, station: null, roles: ["pilot", "comms"] });
  });

describe("joinCrew", () => {
  function grow(...ids: string[]) {
    const s = createState(7, "mars");
    s.players.push(p(ids[0]));
    dealRoles(s);
    for (const id of ids.slice(1)) {
      s.players.push(p(id));
      joinCrew(s, id);
    }
    return s;
  }

  it("gives a newcomer roles taken from whoever holds the most", () => {
    expect(grow("a", "b").players.map((x) => x.roles)).toEqual([["pilot", "engineer"], ["comms", "science"]]);
  });

  it("keeps a role someone picked when another player joins", () => {
    const s = grow("a", "b");
    takeRole(s, "b", "pilot");
    s.players.push(p("c"));
    joinCrew(s, "c");
    expect(s.players.find((x) => x.id === "b")!.roles).toContain("pilot");
  });

  it("keeps every role held exactly once as the crew grows to four", () => {
    const s = grow("a", "b", "c", "d");
    expect(held(s)).toEqual([...ROLES].sort());
    expect(s.players.every((x) => x.roles.length === 1)).toBe(true);
  });
});

describe("startRun resets everything it doesn't deliberately keep", () => {
  it("leaves no field of the last run behind", () => {
    const KEEP = ["seed", "players", "phase", "phaseEndsAt", "runStartedAt", "mission", "credits", "data"];
    const s = crew(2);
    const dirty = createState(99, "moon") as unknown as Record<string, unknown>;
    for (const key of Object.keys(dirty)) {
      if (!KEEP.includes(key)) (s as unknown as Record<string, unknown>)[key] = { stale: true };
    }
    startRun(s, "mars", 1_000);
    const fresh = createState(s.seed, "mars") as unknown as Record<string, unknown>;
    for (const key of Object.keys(fresh)) {
      if (!KEEP.includes(key)) expect([key, (s as unknown as Record<string, unknown>)[key]]).toEqual([key, fresh[key]]);
    }
  });
});
});
