import type { DeepReadonly, View } from "../core/scene";
import type { GameState, Role } from "../core/state";

/** one role's screen during flight; its rules go through registerRule("flight", ...) */
export interface Station {
  draw(ctx: CanvasRenderingContext2D, state: DeepReadonly<GameState>, view: View): void;
}

const LABEL: Record<Role, string> = { pilot: "Pilot", engineer: "Rocket Engineer", comms: "Comms Engineer", science: "Science Officer" };

const stub = (role: Role): Station => ({
  draw(ctx) {
    ctx.fillStyle = "#8a93a6";
    ctx.font = "14px sans-serif";
    ctx.fillText(`${LABEL[role]} station (stub)`, 16, 56);
  },
});

const stations: Record<Role, Station> = {
  pilot: stub("pilot"),
  engineer: stub("engineer"),
  comms: stub("comms"),
  science: stub("science"),
};

// seats 4 and 5 call this from a *.register.ts file in their own folder
export function registerStation(role: Role, station: Station): void {
  stations[role] = station;
}

export function stationFor(role: Role): Station {
  return stations[role];
}

export function stationLabel(role: Role): string {
  return LABEL[role];
}

/** the station after `current` among this player's roles; the first one when current is null or not theirs */
export function nextStation(roles: readonly Role[], current: Role | null): Role | null {
  if (roles.length === 0) return null;
  const i = current === null ? -1 : roles.indexOf(current);
  return roles[(i + 1) % roles.length];
}
