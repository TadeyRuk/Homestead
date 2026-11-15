import type { DeepReadonly } from "../../core/scene";
import { partName } from "../../data/data";
import { alpha, bar, box, clamp, text } from "../../ui/kit";
import { C, ROLE_COLOUR, SLOT_NAME } from "../../ui/tokens";
import { draw as busDraw, effectiveSupply, overloaded, secondsToTrip, type Bus } from "./bus";
import type { Welder } from "./weld";

/** a panel on seat 3's 640 x 360 grid; the station's draw calls begin() first */
export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

const EDGE = ROLE_COLOUR.engineer;

/** active: this minigame has the engineer's keys right now, so its edge lights up */
export function drawBus(ctx: CanvasRenderingContext2D, bus: DeepReadonly<Bus>, a: Area, active: boolean): void {
  const x = a.x + 10;
  const w = a.w - 20;
  box(ctx, a.x, a.y, a.w, a.h, active ? EDGE : C.line);
  text(ctx, "POWER BUS", x, a.y + 16, 9, active ? EDGE : C.muted, { weight: 600 });
  const supply = effectiveSupply(bus);
  const cut = supply < bus.supply ? `  cold core: ${Math.round(supply)} W usable` : "";
  text(ctx, `${partName(bus.source)}  ${bus.supply} W${cut}`, x, a.y + 29, 7, cut ? C.amber : C.muted);

  // load against supply; the bar's end is the supply line
  const watts = busDraw(bus);
  // a dead power part still has to read as fully loaded, not as NaN
  const load = supply > 0 ? watts / supply : watts > 0 ? Infinity : 0;
  const over = overloaded(bus);
  bar(ctx, x, a.y + 36, w, 9, clamp(load), load > 1 ? C.red : load > 0.85 ? C.amber : C.green);
  text(ctx, Number.isFinite(load) ? `${Math.round(load * 100)}% load` : "no supply", x + w, a.y + 55, 7, C.white, { align: "right" });

  const [breaker, tone] =
    bus.tripped > 0
      ? [`BREAKER TRIPPED  resets in ${Math.ceil(bus.tripped)} s`, C.red]
      : over
        ? [`${secondsToTrip(bus).toFixed(1)} s from tripping`, C.red]
        : bus.strain > 0
          ? ["breaker cooling down", C.amber]
          : ["breaker closed", C.dim];
  text(ctx, breaker, x, a.y + 55, 7, tone, { weight: over || bus.tripped > 0 ? 600 : 500 });
  if (bus.engineOffAsked) text(ctx, "engine off? waiting for the pilot", x, a.y + 68, 7, C.amber);

  const rowsY = a.y + 80;
  bus.loads.forEach((l, i) => {
    const y = rowsY + i * 18;
    if (i === bus.cursor && active) {
      ctx.fillStyle = alpha(EDGE, 0.12);
      ctx.fillRect(a.x + 4, y - 11, a.w - 8, 16);
    }
    text(ctx, l.on ? "ON" : "OFF", x, y, 8, l.on ? C.green : C.dim, { weight: 600 });
    text(ctx, `${SLOT_NAME[l.slot]}: ${partName(l.id)}`, x + 26, y, 8, l.on ? C.white : C.dim);
    text(ctx, `${l.watts} W`, x + w, y, 8, C.muted, { align: "right" });
  });
  if (bus.loads.length === 0) text(ctx, "nothing on the bus to switch", x, rowsY, 8, C.dim);

  text(ctx, "W/S select   E switch", x, a.y + a.h - 8, 7, C.dim);
}

export function drawWeld(ctx: CanvasRenderingContext2D, w: DeepReadonly<Welder>, a: Area, active: boolean): void {
  const job = w.jobs[0];
  const x = a.x + 10;
  box(ctx, a.x, a.y, a.w, a.h, active ? EDGE : C.line);
  text(ctx, "HULL WELD", x, a.y + 16, 9, active ? EDGE : C.muted, { weight: 600 });
  const queued = w.jobs.length > 1 ? `  (${w.jobs.length - 1} more)` : "";
  text(ctx, job ? `breach open, cabin air leaking${queued}` : "hull holding", x, a.y + 29, 7, job ? C.red : C.dim);

  // the panel is square, so a crack keeps its shape whatever the area
  const size = Math.max(0, Math.min(a.w - 20, a.h - 66));
  const px0 = a.x + (a.w - size) / 2;
  const py0 = a.y + 38;
  const at = (p: { x: number; y: number }) => [px0 + p.x * size, py0 + p.y * size] as const;
  ctx.fillStyle = C.ink;
  ctx.fillRect(px0, py0, size, size);

  if (job) {
    ctx.lineWidth = 2.5;
    job.crack.forEach((p, i) => {
      if (i === 0) return;
      ctx.strokeStyle = i < job.next ? C.green : C.red;
      ctx.beginPath();
      ctx.moveTo(...at(job.crack[i - 1]));
      ctx.lineTo(...at(p));
      ctx.stroke();
    });
    // the point to reach next
    const [nx, ny] = at(job.crack[Math.min(job.next, job.crack.length - 1)]);
    ctx.strokeStyle = C.amber;
    ctx.lineWidth = 1;
    ctx.strokeRect(nx - 4, ny - 4, 8, 8);
    const [tx, ty] = at(w.torch);
    ctx.fillStyle = C.amber;
    ctx.beginPath();
    ctx.arc(tx, ty, 3, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, `sealant ${Math.round(job.sealant * 100)}%`, x, a.y + a.h - 8, 7, job.sealant < 0.5 ? C.amber : C.muted);
    text(ctx, "WASD trace the crack", a.x + a.w - 10, a.y + a.h - 8, 7, C.dim, { align: "right" });
  } else {
    text(ctx, "a breach from a debris hit opens here", a.x + a.w / 2, py0 + size / 2, 7, C.dim, { align: "center" });
  }
}
