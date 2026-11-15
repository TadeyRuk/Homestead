import type { Scene } from "../core/scene";
import { KIOSK_REACH, PAD_REACH } from "./carry";
import { edgeArrow, follow, PX_PER_M, type EdgeArrow } from "./camera";
import { SLOTS, slotSpot } from "../build/pad";
import { C, MONO } from "../ui/tokens";
import { drawCountdown, drawGround, drawHeldData, drawInstrument, drawLander, drawMarker, drawPadSlots, drawParts, drawPlayers, drawShip, drawSuitBars, drawTaskRing, nameTag, paletteFor } from "./draw";
import { gameSpot, surfaceGame } from "../missions/games";
import { bonusSpot } from "../missions/objectives";
import { drawGameOverlay } from "./overlay";
import { missionList } from "../missions/stats";
import { shipDescent } from "./extraction";
import { drawHazard, hazardAt } from "./hazards";
import { LANDER_REACH } from "./suit";
import { SURFACE } from "./surface";
import { groundFor, type Ground, type GroundMap } from "./world";

const TASK_LABELS = { scan: "Scanning", drill: "Drilling", deploy: "Deploying", photo: "Photographing" } as const;

/**
 * The top-down scene shared by the campus and the surface; it only draws. Each screen
 * follows only its own player, so the crew has to split up to cover the map.
 */
export function groundScene(which: Ground): Scene {
  return {
    draw(ctx, state, view) {
      const map: GroundMap = groundFor(which);
      const { width: w, height: h } = ctx.canvas;
      const me = state.players.find((p) => p.id === view.playerId);
      // someone without a player (never in a normal run) sees the middle of the map
      const centre = me ?? { x: map.width / 2, y: map.height / 2 };
      const cam = follow(centre, map, w, h);

      ctx.save();
      ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
      drawGround(ctx, map, paletteFor(which, state.mission), { x: cam.x, y: cam.y, w, h });
      if (which === "campus") {
        if (map.pad) {
          const pad = map.pad;
          // the ring is where E mounts or starts the countdown
          drawMarker(ctx, pad, C.crew, "Launch pad", PAD_REACH);
          drawPadSlots(
            ctx,
            SLOTS.map((slot) => ({
              name: slot,
              at: slotSpot(pad, slot),
              part: state.ship.slots[slot],
              salvaged: state.ship.salvaged.includes(slot),
            })),
          );
          // the stub scene used to show this; seat 1's countdown lives in state.launchAt
          if (state.launchAt !== null) drawCountdown(ctx, pad, Math.max(0, Math.ceil((state.launchAt - view.now) / 1000)));
        }
        // the ring is where E buys
        if (map.kiosk) drawMarker(ctx, map.kiosk, C.pink, "Kiosk", KIOSK_REACH);
      } else {
        const sv = state.surface;
        for (const site of map.sites ?? []) {
          const done = sv.scanned.includes(site.id);
          const colour = done ? "#5d636c" : site.rich ? "#ffd84a" : "#c9ced8";
          const name = `${site.rich ? "Rich site" : "Site"}${done ? " (scanned)" : ""}`;
          drawMarker(ctx, site, colour, name, site.rich ? 20 : 14);
        }
        if (map === SURFACE) {
          const list = missionList(state.mission);
          const sample = state.mission === "mars" ? "Core sample" : "Regolith";
          // only what this run drew from the pool (S2-18)
          if ("sample" in state.objectives && !sv.sampleDrilled) drawMarker(ctx, SURFACE.sampleSites[state.mission], "#ff7b3a", sample, 14);
          if (sv.deployed) drawInstrument(ctx, SURFACE.deploySpot, list.instrument);
          else if ("deploy" in state.objectives) drawMarker(ctx, SURFACE.deploySpot, "#b48cff", state.mission === "mars" ? "Weather station" : "Seismometer", 14);
          if (!state.objectives.bonus) drawMarker(ctx, bonusSpot(state), "#ffffff", "Photo spot", 12);
          // each minigame on this run's list that is still to do (S2-19)
          for (const [kind, done] of Object.entries(state.objectives)) {
            const def = done ? undefined : surfaceGame(kind);
            const spot = def ? gameSpot(kind, state.mission) : null;
            if (def && spot) drawMarker(ctx, spot, "#4fd8ff", def.name, 14);
          }
        }
        // the ring is the recharge zone
        if (map.lander) {
          drawLander(ctx, map.lander);
          drawMarker(ctx, map.lander, C.crew, "Lander", LANDER_REACH);
        }
      }
      drawParts(ctx, state.parts);
      drawPlayers(ctx, state.players, view.playerId);
      if (which === "surface") {
        for (const p of state.players) {
          if (p.down) continue;
          drawSuitBars(ctx, p);
          const task = state.surface.tasks[p.id];
          if (task) drawTaskRing(ctx, p, task.progress, TASK_LABELS[task.kind]);
          // everyone else sees who is busy in a minigame
          const game = state.surface.games[p.id];
          const gameName = game ? surfaceGame(game.kind)?.name : undefined;
          if (gameName) nameTag(ctx, gameName, p.x, p.y + 50, "#4fd8ff", "#4fd8ff", 10);
          const held = state.surface.held[p.id] ?? 0;
          if (held > 0) drawHeldData(ctx, p, held);
        }
      }
      if (which === "surface") {
        // seat 6's storm wall or flare tint (#97): over everyone else, so the storm hides what is in it
        const hazard = hazardAt(state, view.now);
        drawHazard(ctx, hazard);
        // but never your own astronaut: you can still steer yourself out of the dust
        if (hazard && me) {
          drawPlayers(ctx, [me], view.playerId);
          if (!me.down) drawSuitBars(ctx, me);
        }
      }
      if (which === "surface" && map.lander) drawShip(ctx, map.lander, shipDescent(state, view.now));
      ctx.restore();

      // the way home: the pad on the campus, the lander on the surface
      const home = which === "campus" ? map.pad : map.lander;
      const arrow = home && me ? edgeArrow(cam, home, me) : null;
      if (arrow) drawArrow(ctx, arrow, which === "campus" ? "Pad" : "Lander");

      // this player's open minigame, over their own view only
      const run = which === "surface" && me && !me.down ? state.surface.games[me.id] : undefined;
      const def = run ? surfaceGame(run.kind) : undefined;
      if (run && def) drawGameOverlay(ctx, run, def, state.mission, view.now);
    },
  };
}

function drawArrow(ctx: CanvasRenderingContext2D, a: EdgeArrow, name: string): void {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.angle);
  // amber, as in the mocks: the way home stands out from the teal rings
  ctx.fillStyle = C.amber;
  ctx.strokeStyle = "#0b0e14";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-18, -11);
  ctx.lineTo(-13, 0);
  ctx.lineTo(-18, 11);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  ctx.restore();

  // the label sits upright on the screen side of the arrow, pushed back far enough to clear it
  const text = `${name} ${Math.round(a.distance / PX_PER_M)} m`;
  ctx.font = `600 12px ${MONO}`;
  const half = ctx.measureText(text).width / 2;
  const lx = a.x - Math.cos(a.angle) * (28 + half);
  const ly = a.y - Math.sin(a.angle) * 36 + 4;
  ctx.textAlign = "center";
  ctx.fillStyle = "#0b0e14";
  ctx.fillText(text, lx + 1, ly + 1);
  ctx.fillStyle = C.amber;
  ctx.fillText(text, lx, ly);
  ctx.textAlign = "left";
}
