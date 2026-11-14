import type { Scene } from "../core/scene";
import { edgeArrow, follow, PX_PER_M, type EdgeArrow } from "./camera";
import { CAMPUS_PALETTE, drawGround, drawMarker, drawPlayers } from "./draw";
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
      drawGround(ctx, map, CAMPUS_PALETTE);
      if (map.pad) drawMarker(ctx, map.pad, "#7ef0d0", "Launch pad");
      if (map.kiosk) drawMarker(ctx, map.kiosk, "#ff5fae", "Kiosk", 16);
      if (which === "surface" && map.lander) drawMarker(ctx, map.lander, "#7ef0d0", "Lander", 30);
      drawPlayers(ctx, state.players, view.playerId);
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

  // the label sits on the screen side of the arrow, upright
  const lx = a.x - Math.cos(a.angle) * 34;
  const ly = a.y - Math.sin(a.angle) * 26 + 4;
  ctx.font = "600 12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#0b0e14";
  ctx.fillText(`${name} ${Math.round(a.distance / PX_PER_M)} m`, lx + 1, ly + 1);
  ctx.fillStyle = "#7ef0d0";
  ctx.fillText(`${name} ${Math.round(a.distance / PX_PER_M)} m`, lx, ly);
  ctx.textAlign = "left";
}
