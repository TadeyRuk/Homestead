import { partInfo } from "../core/catalog";
import type { Point } from "../core/map";
import type { Role, Slot } from "../core/state";
import { partName } from "../data/data";
import { rocket } from "../ui/sprites";
import { C, MONO, ROLE_COLOUR, SLOT_COLOUR } from "../ui/tokens";
import { PLAYER_HALF, type Rect } from "./geom";
import type { GroundMap, Wall } from "./world";

// S2-15: drawn in code after the proposal's art sheet (proposal/refs/d-style.png, p1-map.png,
// p3-split.png) and seat 3's tokens. Seat 6's sprites replace these shapes file for file later;
// the sizes here are the ones agreed on #85.

/** one palette per setting; the Moon and Mars share one surface layout */
export interface Palette {
  ground: string;
  /** small tufts and pebbles scattered over the ground */
  speck: string;
  /** big soft patches in the ground */
  blotch: string;
  floors: Record<string, string>;
  wall: string;
  wallEdge: string;
  text: string;
}

export const CAMPUS_PALETTE: Palette = {
  ground: "#2c5a46",
  speck: "#24493a",
  blotch: "#2f6049",
  floors: { road: "#6f747c", runway: "#4b5058", apron: "#80858d", yard: "#5d636b" },
  wall: "#5f6570",
  wallEdge: "#3a3f48",
  text: C.white,
};

export const MOON_PALETTE: Palette = {
  ground: "#5b5d63",
  speck: "#4c4e54",
  blotch: "#55575d",
  floors: { pit: "#45474d" },
  wall: "#8a8d94",
  wallEdge: "#2e3035",
  text: C.white,
};

export const MARS_PALETTE: Palette = {
  ground: "#9a4a2a",
  speck: "#6b2f1b",
  blotch: "#a5552f",
  floors: { pit: "#7a3820" },
  wall: "#6b2f1b",
  wallEdge: "#3a180c",
  text: C.white,
};

export function paletteFor(which: "campus" | "surface", mission: "moon" | "mars"): Palette {
  if (which === "campus") return CAMPUS_PALETTE;
  return mission === "moon" ? MOON_PALETTE : MARS_PALETTE;
}

/** role colours, the same as seat 3's tokens so a role reads the same on the map and in the HUD */
export const ROLE_COLOURS: Record<Role, string> = ROLE_COLOUR;

type Ctx = CanvasRenderingContext2D;

/** a part's display name, capitalised; the instruments have no entry in the parts data */
export function partLabel(id: string): string {
  const name = partName(id);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** how far above a player's head the bars and badges start: higher while a part is held up there */
const headroom = (p: { readonly carrying?: string | null }) => (p.carrying ? 30 : 0);

/** a stable 0..1 number for a grid cell, so the ground's scatter never moves between frames or tabs */
function hash(i: number, j: number, salt = 0): number {
  let h = (i * 374761393 + j * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function cellsIn(view: Rect, size: number, each: (i: number, j: number) => void): void {
  const i0 = Math.floor(view.x / size);
  const j0 = Math.floor(view.y / size);
  const i1 = Math.ceil((view.x + view.w) / size);
  const j1 = Math.ceil((view.y + view.h) / size);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) each(i, j);
}

/** monospace text in a dark rounded box with a coloured border, like the labels in the mocks */
export function nameTag(ctx: Ctx, text: string, x: number, y: number, edge: string = C.line, colour: string = C.white, size = 11): void {
  ctx.font = `600 ${size}px ${MONO}`;
  const w = ctx.measureText(text).width + 12;
  const h = size + 9;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, 4);
  else ctx.rect(x - w / 2, y - h / 2, w, h);
  ctx.fillStyle = C.panel;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = colour;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y + 0.5);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

/** the whole map's ground, floors and walls; `view` limits the scatter to what is on screen */
export function drawGround(ctx: Ctx, map: GroundMap, palette: Palette, view: Rect = { x: 0, y: 0, w: map.width, h: map.height }): void {
  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, 0, map.width, map.height);
  // soft patches, then tufts or pebbles, both from the cell hash
  cellsIn(view, 160, (i, j) => {
    if (hash(i, j, 1) > 0.4) return;
    ctx.fillStyle = palette.blotch;
    ctx.beginPath();
    ctx.arc(i * 160 + hash(i, j, 2) * 120, j * 160 + hash(i, j, 3) * 120, 18 + hash(i, j, 4) * 30, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = palette.speck;
  cellsIn(view, 40, (i, j) => {
    if (hash(i, j, 5) > 0.3) return;
    const x = Math.round(i * 40 + hash(i, j, 6) * 34);
    const y = Math.round(j * 40 + hash(i, j, 7) * 34);
    ctx.fillRect(x, y, 4, 4);
    if (hash(i, j, 8) < 0.5) ctx.fillRect(x + 4, y - 2, 2, 2);
  });

  for (const f of map.floors) drawFloor(ctx, f, palette);
  for (const pit of map.pits ?? []) {
    ctx.fillStyle = palette.floors.pit ?? palette.ground;
    ctx.beginPath();
    ctx.arc(pit.x, pit.y, pit.r, 0, Math.PI * 2);
    ctx.fill();
    // the sunlit inner edge
    ctx.strokeStyle = palette.blotch;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(pit.x, pit.y, pit.r - 26, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
  for (const w of map.walls) drawWall(ctx, w, palette);
  for (const l of map.labels) nameTag(ctx, l.text, l.x, l.y);
}

function drawFloor(ctx: Ctx, f: GroundMap["floors"][number], palette: Palette): void {
  ctx.fillStyle = palette.floors[f.kind] ?? palette.floors.road ?? palette.ground;
  ctx.fillRect(f.x, f.y, f.w, f.h);
  if (f.kind === "runway") {
    // the centre line, dashed, as in the campus mock
    ctx.fillStyle = "#d8dce3";
    const y = f.y + f.h / 2 - 2;
    for (let x = f.x + 30; x < f.x + f.w - 50; x += 70) ctx.fillRect(x, y, 36, 4);
  } else if (f.kind === "apron") {
    // the launch pad's hexagon
    const cx = f.x + f.w / 2;
    const cy = f.y + f.h * 0.42;
    const r = Math.min(f.w, f.h) * 0.42;
    ctx.fillStyle = "#9aa0a8";
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k;
      ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.closePath();
    ctx.fill();
  }
}

function drawWall(ctx: Ctx, w: Wall, palette: Palette): void {
  switch (w.kind) {
    case "building": {
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      ctx.fillRect(w.x + 8, w.y + 8, w.w, w.h);
      ctx.fillStyle = palette.wallEdge;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = palette.wall;
      ctx.fillRect(w.x + 3, w.y + 3, w.w - 6, w.h - 22);
      // roof seams
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      for (let x = w.x + 12; x < w.x + w.w - 6; x += 12) ctx.fillRect(x, w.y + 3, 2, w.h - 22);
      // a row of lit windows along the front
      ctx.fillStyle = "#e8e19a";
      for (let x = w.x + 14; x < w.x + w.w - 18; x += 32) ctx.fillRect(x, w.y + w.h - 14, 12, 7);
      return;
    }
    case "booth": {
      ctx.fillStyle = "#7a2456";
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = C.pink;
      ctx.fillRect(w.x + 4, w.y + 4, w.w - 8, w.h - 22);
      ctx.fillStyle = "#ffd6f0";
      ctx.fillRect(w.x + 18, w.y + w.h / 2 - 8, w.w - 36, 4);
      return;
    }
    case "rocket": {
      // seat 3's rocket from the title film, scaled to fill the rocket's collision box
      rocket(ctx, w.x + w.w / 2, w.y + w.h, w.h / 48);
      return;
    }
    case "crate": {
      ctx.fillStyle = "#6b4c2f";
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = "#9a7048";
      ctx.fillRect(w.x + 3, w.y + 3, w.w - 6, w.h - 6);
      ctx.fillStyle = "#6b4c2f";
      ctx.fillRect(w.x + 3, w.y + w.h / 2 - 2, w.w - 6, 4);
      return;
    }
    case "dish": {
      const cx = w.x + w.w / 2;
      const cy = w.y + w.h / 2;
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      ctx.beginPath();
      ctx.ellipse(cx + 4, cy + 10, w.w / 2, w.h / 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c9ced8";
      ctx.beginPath();
      ctx.ellipse(cx, cy, w.w / 2 - 2, w.h / 2 - 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f2f4f8";
      ctx.beginPath();
      ctx.ellipse(cx, cy - 3, w.w / 2 - 12, w.h / 2 - 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8a93a6";
      ctx.fillRect(cx - 2, cy - 5, 4, 4);
      return;
    }
    case "tree": {
      // a pink clump of three, over a dark green shadow
      ctx.fillStyle = "#1c3c2f";
      ctx.beginPath();
      ctx.ellipse(w.x + w.w / 2 + 4, w.y + w.h - 6, w.w / 2, w.h / 4, 0, 0, Math.PI * 2);
      ctx.fill();
      const r = Math.min(w.w, w.h) / 3.2;
      const blobs = [
        [w.x + r + 2, w.y + w.h - r - 4],
        [w.x + w.w - r - 2, w.y + w.h - r - 6],
        [w.x + w.w / 2, w.y + r + 2],
      ];
      for (const [x, y] of blobs) {
        ctx.fillStyle = "#c13f7a";
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e0559a";
        ctx.beginPath();
        ctx.arc(x - r / 4, y - r / 4, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    case "rock":
    case "rim":
    case "ridge": {
      ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
      ctx.fillRect(w.x + 5, w.y + 6, w.w, w.h);
      ctx.fillStyle = palette.wallEdge;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = palette.wall;
      ctx.fillRect(w.x + 3, w.y + 3, w.w - 6, w.h - 8);
      // a highlight on the sunward corner
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.fillRect(w.x + 3, w.y + 3, w.w / 2, 4);
      return;
    }
    default: {
      // the map's edge, and any wall without a kind
      ctx.fillStyle = palette.wallEdge;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = palette.wall;
      ctx.fillRect(w.x + 2, w.y + 2, w.w - 4, w.h - 6);
    }
  }
}

/** a dashed ring with a name tag: the pad, the kiosk, sites and spots; the ring is the real reach */
export function drawMarker(ctx: Ctx, at: Point, colour: string, name: string, radius = 22): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  nameTag(ctx, name, at.x, at.y - radius - 14, colour, colour, 10);
}

/** the slot colour of any part id, grey for one the catalog doesn't know */
function slotOfPart(id: string): Slot | null {
  try {
    return partInfo(id).slot;
  } catch {
    return null;
  }
}

/** a 16 px part icon centred on (x, y), shaped by its slot and coloured by it */
export function drawPartIcon(ctx: Ctx, id: string, x: number, y: number): void {
  const slot = slotOfPart(id);
  const colour = slot ? SLOT_COLOUR[slot] : "#c9ced8";
  const dark = "#3a3f48";
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.fillRect(x - 8, y - 8, 17, 17);
  if (slot === "propulsion") {
    ctx.fillStyle = colour;
    ctx.fillRect(x - 6, y - 8, 12, 9);
    ctx.fillStyle = dark;
    ctx.fillRect(x - 7, y + 1, 14, 4);
    ctx.fillStyle = C.amber;
    ctx.fillRect(x - 3, y + 5, 6, 3);
  } else if (slot === "power") {
    ctx.fillStyle = "#d8e0f0";
    ctx.fillRect(x - 8, y - 6, 16, 12);
    ctx.fillStyle = colour;
    for (const [dx, dy] of [[-6, -4], [1, -4], [-6, 1], [1, 1]]) ctx.fillRect(x + dx, y + dy, 5, 3);
  } else if (slot === "comms") {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(x, y - 1, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.fillRect(x - 1, y - 2, 3, 3);
    ctx.fillRect(x - 4, y + 6, 8, 2);
  } else {
    ctx.fillStyle = colour;
    ctx.fillRect(x - 7, y - 6, 14, 12);
    ctx.fillStyle = slot ? "#3a2a10" : dark;
    ctx.fillRect(x - 3, y - 3, 6, 6);
  }
}

interface Loose extends Point {
  readonly part: string;
}

/** loose parts: the part's icon in its slot colour on a teal pickup ring, with a dark name tag */
export function drawParts(ctx: Ctx, parts: readonly Loose[]): void {
  for (const piece of parts) {
    const slot = slotOfPart(piece.part);
    ctx.strokeStyle = C.crew;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(piece.x, piece.y + 8, 14, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    drawPartIcon(ctx, piece.part, piece.x, piece.y);
    nameTag(ctx, partLabel(piece.part), piece.x, piece.y + 26, slot ? SLOT_COLOUR[slot] : C.line, C.white, 9);
  }
}

interface Drawable extends Point {
  readonly id: string;
  readonly name: string;
  readonly roles: readonly Role[];
  readonly down: boolean;
  readonly carrying: string | null;
}

/** a white helmet over a suit in the role's colour, 16 x 22, standing with its feet at y + 11 */
function astronaut(ctx: Ctx, x: number, y: number, suit: string): void {
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath();
  ctx.ellipse(x, y + 11, 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b6bac4"; // backpack
  ctx.fillRect(x - 8, y - 3, 3, 8);
  ctx.fillStyle = suit;
  ctx.fillRect(x - 5, y - 1, 10, 7);
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)"; // legs, a shade darker
  ctx.fillRect(x - 5, y + 6, 10, 5);
  ctx.fillStyle = suit;
  ctx.fillRect(x - 5, y + 6, 4, 4);
  ctx.fillRect(x + 1, y + 6, 4, 4);
  ctx.fillStyle = "#f4f6fa"; // helmet
  ctx.fillRect(x - 5, y - 11, 10, 10);
  ctx.fillRect(x - 4, y - 12, 8, 1);
  ctx.fillStyle = "#2c4a80"; // visor
  ctx.fillRect(x - 1, y - 9, 6, 5);
  ctx.fillStyle = "#9fd8ff";
  ctx.fillRect(x + 2, y - 8, 2, 2);
}

/** a downed astronaut lying on their side, helmet to the left */
function astronautDown(ctx: Ctx, x: number, y: number, suit: string): void {
  ctx.fillStyle = "rgba(60, 10, 10, 0.45)";
  ctx.beginPath();
  ctx.ellipse(x + 1, y + 6, 13, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = suit;
  ctx.fillRect(x - 3, y - 3, 14, 7);
  ctx.fillStyle = "#f4f6fa";
  ctx.fillRect(x - 12, y - 5, 10, 10);
  ctx.fillStyle = "#2c4a80";
  ctx.fillRect(x - 10, y - 3, 5, 6);
}

export function drawPlayers(ctx: Ctx, players: readonly Drawable[], me: string): void {
  // everyone else first, so this tab's own player is always on top
  const ordered = [...players.filter((p) => p.id !== me), ...players.filter((p) => p.id === me)];
  for (const p of ordered) {
    const suit = p.roles[0] ? ROLE_COLOURS[p.roles[0]] : "#c9ced8";
    if (p.id === me) {
      // this tab's own astronaut stands on a teal ring
      ctx.strokeStyle = C.crew;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 11, 13, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (p.down) astronautDown(ctx, p.x, p.y, suit);
    else astronaut(ctx, p.x, p.y, suit);
    if (p.carrying && !p.down) {
      // the part held over the head, named, so everyone can see who has what
      drawPartIcon(ctx, p.carrying, p.x, p.y - PLAYER_HALF - 14);
      ctx.fillStyle = C.amber;
      ctx.font = `600 10px ${MONO}`;
      ctx.textAlign = "center";
      ctx.fillText(partLabel(p.carrying), p.x, p.y - PLAYER_HALF - 27);
      ctx.textAlign = "left";
    }
    ctx.font = `600 11px ${MONO}`;
    ctx.textAlign = "center";
    const label = p.down ? `${p.name} (down)` : p.name;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillText(label, p.x + 1, p.y + PLAYER_HALF + 20);
    ctx.fillStyle = p.down ? C.red : C.white;
    ctx.fillText(label, p.x, p.y + PLAYER_HALF + 19);
    ctx.textAlign = "left";
  }
}

/** the lander: a gold body on legs with a blue solar panel each side */
export function drawLander(ctx: Ctx, at: Point): void {
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath();
  ctx.ellipse(at.x + 4, at.y + 18, 34, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#b6bac4";
  ctx.lineWidth = 3;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(at.x + s * 10, at.y + 4);
    ctx.lineTo(at.x + s * 22, at.y + 18);
    ctx.stroke();
  }
  ctx.fillStyle = "#2a4f9e";
  ctx.fillRect(at.x - 64, at.y - 8, 34, 14);
  ctx.fillRect(at.x + 30, at.y - 8, 34, 14);
  ctx.fillStyle = C.blue;
  for (let k = 0; k < 3; k++) {
    ctx.fillRect(at.x - 62 + k * 11, at.y - 6, 9, 10);
    ctx.fillRect(at.x + 32 + k * 11, at.y - 6, 9, 10);
  }
  ctx.fillStyle = "#b8893e";
  ctx.beginPath();
  ctx.arc(at.x, at.y - 2, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d9a85a";
  ctx.beginPath();
  ctx.arc(at.x - 4, at.y - 6, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f4f6fa";
  ctx.beginPath();
  ctx.arc(at.x, at.y - 22, 5, 0, Math.PI * 2);
  ctx.fill();
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
  nameTag(ctx, "Extraction", x, y - 60, C.amber, C.amber);
}

/**
 * The four slots round the pad (56 px apart, so 52 px boxes). A mounted part shows as its icon on a
 * border in its slot colour, amber for salvage; the HUD's rocket panel names it in full.
 */
export function drawPadSlots(
  ctx: Ctx,
  slots: readonly { name: string; at: Point; part: string | null; salvaged: boolean }[],
): void {
  for (const s of slots) {
    const colour = SLOT_COLOUR[s.name as Slot] ?? "#c9ced8";
    ctx.fillStyle = C.panel;
    ctx.fillRect(s.at.x - 26, s.at.y - 12, 52, 36);
    ctx.strokeStyle = s.part ? (s.salvaged ? C.amber : colour) : "#5d636c";
    ctx.lineWidth = 2;
    ctx.setLineDash(s.part ? [] : [4, 3]);
    ctx.strokeRect(s.at.x - 26, s.at.y - 12, 52, 36);
    ctx.setLineDash([]);
    ctx.textAlign = "center";
    ctx.fillStyle = s.part ? colour : C.dim;
    ctx.font = `600 8px ${MONO}`;
    ctx.fillText(s.name, s.at.x, s.at.y - 2);
    if (s.part) drawPartIcon(ctx, s.part, s.at.x, s.at.y + 12);
    else ctx.fillText("empty", s.at.x, s.at.y + 14);
    ctx.textAlign = "left";
  }
}

/** the launch countdown over the pad while it runs */
export function drawCountdown(ctx: Ctx, pad: Point, secondsLeft: number): void {
  nameTag(ctx, `Launch in ${secondsLeft}`, pad.x, pad.y - 150, C.amber, C.amber, 20);
}

/** a player's suit as two bars over their head: oxygen (blue), then power (yellow); red when low */
export function drawSuitBars(
  ctx: Ctx,
  p: Point & { readonly oxygen: number; readonly power: number; readonly carrying?: string | null },
): void {
  const w = 30;
  const up = headroom(p);
  const bar = (y: number, v: number, colour: string) => {
    ctx.fillStyle = "#0b0e14";
    ctx.fillRect(p.x - w / 2 - 1, y - 1, w + 2, 6);
    ctx.fillStyle = v < 0.25 ? C.red : colour;
    ctx.fillRect(p.x - w / 2, y, w * Math.max(0, Math.min(1, v)), 4);
  };
  bar(p.y - PLAYER_HALF - 34 - up, p.oxygen, "#4fd8ff");
  bar(p.y - PLAYER_HALF - 27 - up, p.power, "#ffd84a");
}

/** a ring filling round a player while a timed job runs, with what it is */
export function drawTaskRing(ctx: Ctx, at: Point, progress: number, label: string): void {
  ctx.strokeStyle = "#0b0e14";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(at.x, at.y, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = C.crew;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(at.x, at.y, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  ctx.stroke();
  nameTag(ctx, `${label} ${Math.round(progress * 100)}%`, at.x, at.y + PLAYER_HALF + 38, C.crew, C.crew, 10);
}

/** data units a player is carrying back to the lander */
export function drawHeldData(ctx: Ctx, at: Point & { readonly carrying?: string | null }, units: number): void {
  ctx.textAlign = "center";
  ctx.font = `600 10px ${MONO}`;
  ctx.fillStyle = "#b48cff";
  ctx.fillText(`${Math.ceil(units)} data`, at.x, at.y - PLAYER_HALF - 40 - headroom(at));
  ctx.textAlign = "left";
}

/** a deployed instrument: a mast with a cross-bar */
export function drawInstrument(ctx: Ctx, at: Point, name: string): void {
  ctx.fillStyle = C.crew;
  ctx.fillRect(at.x - 1, at.y - 26, 3, 26);
  ctx.fillRect(at.x - 10, at.y - 26, 21, 3);
  ctx.fillRect(at.x - 8, at.y - 1, 17, 3);
  nameTag(ctx, `${partLabel(name)} deployed`, at.x, at.y + 18, C.crew, C.crew, 10);
}
