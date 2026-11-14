import type { Scene } from "../core/scene";
import { CAMPUS_PALETTE, drawGround, drawMarker, drawPlayers } from "./draw";
import { groundFor, type Ground, type GroundMap } from "./world";

/** the top-down scene shared by the campus and the surface; it only draws */
export function groundScene(which: Ground): Scene {
  return {
    draw(ctx, state, view) {
      const map: GroundMap = groundFor(which);
      ctx.save();
      drawGround(ctx, map, CAMPUS_PALETTE);
      if (map.pad) drawMarker(ctx, map.pad, "#7ef0d0", "Launch pad");
      if (map.kiosk) drawMarker(ctx, map.kiosk, "#ff5fae", "Kiosk", 16);
      if (which === "surface" && map.lander) drawMarker(ctx, map.lander, "#7ef0d0", "Lander", 30);
      drawPlayers(ctx, state.players, view.playerId);
      ctx.restore();
    },
  };
}
