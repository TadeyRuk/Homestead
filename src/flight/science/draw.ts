import type { DeepReadonly } from "../../core/scene";
import type { Ship } from "../../core/state";
import { partName } from "../../data/data";
import { alpha, bar, box, text } from "../../ui/kit";
import { C, ROLE_COLOUR } from "../../ui/tokens";
import { LOW_OXYGEN, TRAY_SIZE, type Converter, type Item } from "./converter";
import { SAFE_HIGH, SAFE_LOW, type Core } from "./core";

/** a panel on seat 3's 640 x 360 grid; the station's draw calls begin() first */
export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

const EDGE = ROLE_COLOUR.science;
const COLD = C.blue;

const ITEM_LOOK: Record<Item, { label: string; colour: string }> = {
  ice: { label: "ICE", colour: "#7fc8e8" },
  co2: { label: "CO2", colour: "#b7a6e8" },
  food: { label: "FOOD", colour: "#c9a26b" },
  wrench: { label: "WRENCH", colour: "#9aa3b2" },
};

export function drawConverter(
  ctx: CanvasRenderingContext2D,
  c: DeepReadonly<Converter>,
  ship: DeepReadonly<Pick<Ship, "cabinOxygen">>,
  a: Area,
): void {
  const x = a.x + 10;
  const w = a.w - 20;
  const oxygen = ship.cabinOxygen;
  box(ctx, a.x, a.y, a.w, a.h, EDGE);
  text(ctx, "OXYGEN CONVERTER", x, a.y + 16, 9, EDGE, { weight: 600 });

  bar(ctx, x, a.y + 26, w, 9, oxygen, oxygen < LOW_OXYGEN ? C.red : oxygen < 0.5 ? C.amber : C.green);
  text(ctx, `cabin oxygen ${Math.round(oxygen * 100)}%`, x, a.y + 47, 7, oxygen < LOW_OXYGEN ? C.red : C.white, {
    weight: oxygen < LOW_OXYGEN ? 600 : 500,
  });
  text(ctx, c.jammed > 0 ? `INTAKE JAMMED  clears in ${Math.ceil(c.jammed)} s` : "intake running", x + w, a.y + 47, 7, c.jammed > 0 ? C.red : C.dim, {
    align: "right",
    weight: c.jammed > 0 ? 600 : 500,
  });

  // the tray, oldest on the left, sliding toward the intake as new items arrive
  const slot = w / TRAY_SIZE;
  const trayY = a.y + 62;
  c.tray.forEach((item, i) => {
    const sx = x + i * slot;
    if (i === c.cursor) {
      ctx.fillStyle = alpha(EDGE, 0.14);
      ctx.fillRect(sx, trayY - 4, slot - 4, 44);
    }
    ctx.fillStyle = ITEM_LOOK[item].colour;
    ctx.fillRect(sx + 6, trayY, slot - 16, 20);
    text(ctx, ITEM_LOOK[item].label, sx + (slot - 4) / 2, trayY + 34, 7, C.white, { align: "center", weight: 600 });
  });

  text(ctx, "ice and CO2 help most, food a little, a wrench jams it", x, a.y + a.h - 20, 7, C.dim);
  text(ctx, "A/D pick   E feed", x, a.y + a.h - 8, 7, C.dim);
}

export function drawCore(
  ctx: CanvasRenderingContext2D,
  core: DeepReadonly<Core>,
  ship: DeepReadonly<Pick<Ship, "coreTemp" | "instrumentHealth">>,
  a: Area,
): void {
  const x = a.x + 10;
  const w = a.w - 20;
  const temp = ship.coreTemp;
  const tone = temp > SAFE_HIGH ? C.red : temp < SAFE_LOW ? COLD : C.green;
  box(ctx, a.x, a.y, a.w, a.h, EDGE);
  text(ctx, "ENERGY CORE", x, a.y + 16, 9, EDGE, { weight: 600 });
  text(ctx, core.heat > 0 ? `heated by the ${partName(core.part).toLowerCase()}` : "nothing on board heats it", x, a.y + 29, 7, C.muted);

  // the temperature bar, cold on the left, with the safe band marked behind it
  const barY = a.y + 38;
  ctx.fillStyle = C.line;
  ctx.fillRect(x, barY, w, 12);
  ctx.fillStyle = alpha(C.green, 0.25);
  ctx.fillRect(x + w * SAFE_LOW, barY, w * (SAFE_HIGH - SAFE_LOW), 12);
  ctx.fillStyle = tone;
  ctx.fillRect(x + w * temp - 2, barY - 3, 4, 18);
  const status = temp > SAFE_HIGH ? "TOO HOT  the instrument is taking damage" : temp < SAFE_LOW ? "TOO COLD" : "in the safe band";
  text(ctx, status, x, barY + 28, 7, tone, { weight: temp > SAFE_HIGH || temp < SAFE_LOW ? 600 : 500 });

  text(ctx, "coolant valve", x, barY + 48, 7, C.muted);
  bar(ctx, x + 70, barY + 42, w - 70, 7, core.valve, C.blue);
  text(ctx, "instrument", x, barY + 64, 7, C.muted);
  bar(ctx, x + 70, barY + 58, w - 70, 7, ship.instrumentHealth, ship.instrumentHealth < 0.5 ? C.amber : C.green);

  text(ctx, "W open valve   S close valve", x, a.y + a.h - 8, 7, C.dim);
}
