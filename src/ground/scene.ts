import type { Scene } from "../core/scene";
import { edgeArrow, follow, PX_PER_M, type EdgeArrow } from "./camera";
import { SLOTS, slotSpot } from "../build/pad";
import { drawCountdown, drawGround, drawMarker, drawPadSlots, drawParts, drawPlayers, drawShip, drawSuitBars, paletteFor } from "./draw";
import { shipDescent } from "./extraction";
import { LANDER_REACH } from "./suit";
import { SURFACE } from "./surface";
import { groundFor, type Ground, type GroundMap } from "./world";

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
      drawGround(ctx, map, paletteFor(which, state.mission));
      if (which === "campus") {
        if (map.pad) {
          const pad = map.pad;
          drawMarker(ctx, pad, "#7ef0d0", "Launch pad");
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
        if (map.kiosk) drawMarker(ctx, map.kiosk, "#ff5fae", "Kiosk", 16);
      } else {
        for (const site of map.sites ?? []) {
          drawMarker(ctx, site, site.rich ? "#ffd84a" : "#c9ced8", site.rich ? "Rich site" : "Site", site.rich ? 20 : 14);
        }
        if (map === SURFACE) {
          drawMarker(ctx, SURFACE.sampleSites[state.mission], "#ff7b3a", state.mission === "mars" ? "Core sample" : "Regolith", 14);
          drawMarker(ctx, SURFACE.deploySpot, "#b48cff", state.mission === "mars" ? "Weather station" : "Seismometer", 14);
        }
        // the ring is the recharge zone
        if (map.lander) drawMarker(ctx, map.lander, "#7ef0d0", "Lander", LANDER_REACH);
      }
      drawParts(ctx, state.parts);
      drawPlayers(ctx, state.players, view.playerId);
      if (which === "surface") for (const p of state.players) if (!p.down) drawSuitBars(ctx, p);
      if (which === "surface" && map.lander) drawShip(ctx, map.lander, shipDescent(state, view.now));
      ctx.restore();

      // the way home: the pad on the campus, the lander on the surface
      const home = which === "campus" ? map.pad : map.lander;
      const arrow = home && me ? edgeArrow(cam, home, me) : null;
      if (arrow) drawArrow(ctx, arrow, which === "campus" ? "Pad" : "Lander");
    },
  };
}

function drawArrow(ctx: CanvasRenderingContext2D, a: EdgeArrow, name: string): void {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.angle);
  ctx.fillStyle = "#7ef0d0";
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
  ctx.font = "600 12px sans-serif";
  const half = ctx.measureText(text).width / 2;
  const lx = a.x - Math.cos(a.angle) * (28 + half);
  const ly = a.y - Math.sin(a.angle) * 36 + 4;
  ctx.textAlign = "center";
  ctx.fillStyle = "#0b0e14";
  ctx.fillText(text, lx + 1, ly + 1);
  ctx.fillStyle = "#7ef0d0";
  ctx.fillText(text, lx, ly);
  ctx.textAlign = "left";
}
