import { findPart } from "../../core/catalog";
import { logEvent } from "../../core/events";
import { registerRule } from "../../core/step";
import { registerStation, stationInput, stationPace } from "../stations";
import { BEAM, createDish, stepDish, type Dish } from "./dish";

// seat 1, taking seat 4's fallback (S4-04, S4-05): the comms dish and its lock
registerRule("flight", (state, inputs, now, dt) => {
  const antenna = state.ship.slots.comms;
  if (!antenna) {
    state.ship.linkLocked = false;
    return;
  }
  const dish = ((state.flight.dish as Dish | undefined) ??= createDish());
  stepDish(
    dish,
    {
      pilot: stationInput(state, inputs, "pilot"),
      comms: stationInput(state, inputs, "comms"),
      drift: findPart(antenna)?.drift ?? 0.3,
      part: antenna,
      pace: stationPace(state, "comms"),
    },
    dt,
    (kind, fields) => logEvent(state, kind, now, fields),
  );
  state.ship.linkLocked = dish.locked;
  if (dish.locked) delete state.trouble.comms;
  else state.trouble.comms = "Link lost";
});

registerStation("comms", {
  draw(ctx, state) {
    const dish = state.flight.dish as Dish | undefined;
    const cx = 480, cy = 300, r = 150;
    ctx.strokeStyle = "#3a4558";
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
    ctx.stroke();
    // Earth sits straight up; the beam is the wedge the dish is pointing along
    ctx.fillStyle = "#5b7fa6";
    ctx.beginPath();
    ctx.arc(cx, cy - r, 12, 0, 2 * Math.PI);
    ctx.fill();
    if (!dish) {
      ctx.fillStyle = "#8a93a6";
      ctx.font = "14px sans-serif";
      ctx.fillText("No antenna mounted: no link to Earth.", 16, 56);
      return;
    }
    const a = -Math.PI / 2 + dish.angle;
    ctx.fillStyle = dish.locked ? "rgba(232, 176, 75, 0.25)" : "rgba(255, 138, 122, 0.25)";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a - BEAM, a + BEAM);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e6e9ef";
    ctx.font = "600 14px sans-serif";
    ctx.fillText(dish.locked ? "Link locked" : "Link lost: lean the dish back to Earth", 16, 56);
    ctx.fillStyle = "#8a93a6";
    ctx.font = "14px sans-serif";
    ctx.fillText("A and D: lean the dish", 16, 76);
  },
});
