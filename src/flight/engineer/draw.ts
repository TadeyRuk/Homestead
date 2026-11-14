import type { DeepReadonly } from "../../core/scene";
import { draw as busDraw, overloaded, secondsToTrip, type Bus } from "./bus";

/** where on the canvas a station draws; the flight shell (S4-01) decides */
export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DIM = "#8a93a6";
const TEXT = "#e6e9ef";
const OK = "#5fbf7f";
const WARN = "#e8b04b";
const BAD = "#e0605a";

export function drawBus(ctx: CanvasRenderingContext2D, bus: DeepReadonly<Bus>, area: Area): void {
  const { x, y, w } = area;
  const watts = busDraw(bus);
  // a dead power part still has to draw as fully loaded, not as NaN
  const load = bus.supply > 0 ? watts / bus.supply : watts > 0 ? Infinity : 0;

  ctx.font = "16px sans-serif";
  ctx.fillStyle = TEXT;
  ctx.fillText("Power bus", x, y + 20);
  ctx.font = "14px sans-serif";
  ctx.fillStyle = DIM;
  ctx.fillText(`${bus.source}: ${bus.supply} W`, x, y + 42);

  // load against supply; the bar's end is the supply line
  const barY = y + 56;
  ctx.fillStyle = "#1c2230";
  ctx.fillRect(x, barY, w, 18);
  ctx.fillStyle = load > 1 ? BAD : load > 0.85 ? WARN : OK;
  ctx.fillRect(x, barY, w * Math.min(load, 1), 18);
  ctx.fillStyle = TEXT;
  ctx.fillText(Number.isFinite(load) ? `${Math.round(load * 100)}% load` : "No supply", x + 6, barY + 14);

  const over = overloaded(bus);
  ctx.fillStyle = bus.tripped > 0 || over ? BAD : DIM;
  const breaker =
    bus.tripped > 0
      ? `Breaker tripped, resets in ${Math.ceil(bus.tripped)} s`
      : over
        ? `${secondsToTrip(bus).toFixed(1)} s from tripping`
        : bus.strain > 0
          ? "Breaker cooling down"
          : "Breaker closed";
  ctx.fillText(breaker, x, barY + 40);
  if (bus.engineOffAsked) {
    ctx.fillStyle = WARN;
    ctx.fillText("Engine off: waiting for the pilot", x, barY + 62);
  }

  const rowsY = barY + 92;
  bus.loads.forEach((l, i) => {
    const rowY = rowsY + i * 30;
    if (i === bus.cursor) {
      ctx.fillStyle = "#1c2230";
      ctx.fillRect(x - 6, rowY - 18, w + 12, 26);
    }
    ctx.fillStyle = l.on ? OK : DIM;
    ctx.fillText(l.on ? "ON" : "OFF", x, rowY);
    ctx.fillStyle = TEXT;
    ctx.fillText(`${l.slot}: ${l.id}`, x + 48, rowY);
    ctx.fillStyle = DIM;
    ctx.textAlign = "right";
    ctx.fillText(`${l.watts} W`, x + w, rowY);
    ctx.textAlign = "left";
  });

  ctx.fillStyle = DIM;
  ctx.fillText("W/S select, E switch", x, rowsY + bus.loads.length * 30 + 10);
}
