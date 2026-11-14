import type { Point } from "../core/map";
import type { Role } from "../core/state";
import { PLAYER_HALF } from "./geom";
import type { GroundMap } from "./world";

/** placeholder colours until the art pass; one palette per setting */
export interface Palette {
  ground: string;
  floors: Record<string, string>;
  wall: string;
  wallEdge: string;
  text: string;
}

export const CAMPUS_PALETTE: Palette = {
  ground: "#1f3a2c",
  floors: { road: "#4a4f57", runway: "#3b3f46", apron: "#5d636c", yard: "#2c4a3a" },
  wall: "#565c67",
  wallEdge: "#2b2f36",
  text: "#e6e9ef",
};

// the Moon and Mars share one surface layout; only the colours change
export const MOON_PALETTE: Palette = {
  ground: "#5b5d63",
  floors: { pit: "#45474d" },
  wall: "#8a8d94",
  wallEdge: "#2e3035",
  text: "#f2f4f8",
};

export const MARS_PALETTE: Palette = {
  ground: "#9a4a2a",
  floors: { pit: "#7a3820" },
  wall: "#6b2f1b",
  wallEdge: "#3a180c",
  text: "#fff1e6",
};

export function paletteFor(which: "campus" | "surface", mission: "moon" | "mars"): Palette {
  if (which === "campus") return CAMPUS_PALETTE;
  return mission === "moon" ? MOON_PALETTE : MARS_PALETTE;
}

// role colours from the proposal mocks, so each player reads as their job
export const ROLE_COLOURS: Record<Role, string> = {
  pilot: "#f08a24",
  engineer: "#e8c547",
  comms: "#3fc6d9",
  science: "#e0509a",
};

type Ctx = CanvasRenderingContext2D;

export function drawGround(ctx: Ctx, map: GroundMap, palette: Palette): void {
  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, 0, map.width, map.height);
  for (const f of map.floors) {
    ctx.fillStyle = palette.floors[f.kind] ?? palette.floors.road ?? palette.ground;
    ctx.fillRect(f.x, f.y, f.w, f.h);
  }
  for (const pit of map.pits ?? []) {
    ctx.fillStyle = palette.floors.pit ?? palette.ground;
    ctx.beginPath();
    ctx.arc(pit.x, pit.y, pit.r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const w of map.walls) {
    ctx.fillStyle = palette.wallEdge;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = palette.wall;
    ctx.fillRect(w.x + 2, w.y + 2, w.w - 4, w.h - 6);
  }
  ctx.fillStyle = palette.text;
  ctx.font = "600 13px sans-serif";
  ctx.textAlign = "center";
  for (const l of map.labels) ctx.fillText(l.text, l.x, l.y);
  ctx.textAlign = "left";
}

/** a ring with a name, for the pad, the kiosk and the lander */
export function drawMarker(ctx: Ctx, at: Point, colour: string, name: string, radius = 22): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = colour;
  ctx.font = "600 11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(name, at.x, at.y - radius - 6);
  ctx.textAlign = "left";
}

interface Loose extends Point {
  readonly part: string;
}

/** loose parts as small crates, labelled until the art pass gives each part its own sprite */
export function drawParts(ctx: Ctx, parts: readonly Loose[]): void {
  for (const piece of parts) {
    ctx.fillStyle = "#0b0e14";
    ctx.beginPath();
    ctx.ellipse(piece.x, piece.y + 7, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2f4f8";
    ctx.save();
    ctx.translate(piece.x, piece.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();
    ctx.fillStyle = "#c9ced8";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(piece.part, piece.x, piece.y + 22);
    ctx.textAlign = "left";
  }
}

interface Drawable extends Point {
  readonly id: string;
  readonly name: string;
  readonly roles: readonly Role[];
  readonly down: boolean;
  readonly carrying: string | null;
}

export function drawPlayers(ctx: Ctx, players: readonly Drawable[], me: string): void {
  // everyone else first, so this tab's own player is always on top
  const ordered = [...players.filter((p) => p.id !== me), ...players.filter((p) => p.id === me)];
  for (const p of ordered) {
    const s = PLAYER_HALF * 2;
    ctx.globalAlpha = p.down ? 0.45 : 1;
    if (p.id === me) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x - PLAYER_HALF - 3, p.y - PLAYER_HALF - 3, s + 6, s + 6);
    }
    ctx.fillStyle = p.roles[0] ? ROLE_COLOURS[p.roles[0]] : "#c9ced8";
    ctx.fillRect(p.x - PLAYER_HALF, p.y - PLAYER_HALF, s, s);
    ctx.fillStyle = "#0b0e14";
    ctx.fillRect(p.x - 4, p.y - 4, 8, 4); // visor, so a player reads as an astronaut and not a crate
    if (p.carrying) {
      // the part held over the head, named, so everyone can see who has what
      ctx.fillStyle = "#f2f4f8";
      ctx.fillRect(p.x - 4, p.y - PLAYER_HALF - 10, 8, 8);
      ctx.fillStyle = "#ffd84a";
      ctx.font = "600 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.carrying, p.x, p.y - PLAYER_HALF - 14);
      ctx.textAlign = "left";
    }
    ctx.fillStyle = "#e6e9ef";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p.down ? `${p.name} (down)` : p.name, p.x, p.y + PLAYER_HALF + 14);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }
}

/**
 * The extraction ship coming down on the lander. `t` runs 0 (out of sight above) to 1 (landed);
 * its shadow grows on the ground as it nears.
 */
export function drawShip(ctx: Ctx, lander: Point, t: number): void {
  if (t <= 0) return;
  const lift = (1 - t) * 420;
  ctx.globalAlpha = 0.25 + 0.35 * t;
  ctx.fillStyle = "#0b0e14";
  ctx.beginPath();
  ctx.ellipse(lander.x, lander.y + 6, 26 + 30 * t, 10 + 10 * t, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  const x = lander.x;
  const y = lander.y - 20 - lift;
  ctx.fillStyle = "#f2f4f8";
  ctx.beginPath();
  ctx.moveTo(x, y - 46);
  ctx.lineTo(x + 22, y + 10);
  ctx.lineTo(x - 22, y + 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ff8a3a";
  ctx.beginPath();
  ctx.moveTo(x - 10, y + 10);
  ctx.lineTo(x + 10, y + 10);
  ctx.lineTo(x, y + 30 + 6 * Math.sin(t * 140)); // flicker from the descent, so no Math.random()
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e6e9ef";
  ctx.font = "600 12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Extraction", x, y - 54);
  ctx.textAlign = "left";
}
