import type { DeepReadonly } from "../../core/scene";
import type { Ship } from "../../core/state";
import { LOW_OXYGEN, TRAY_SIZE, type Converter, type Item } from "./converter";
import { SAFE_HIGH, SAFE_LOW, type Core } from "./core";

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

const ITEM_LOOK: Record<Item, { label: string; color: string }> = {
  ice: { label: "Ice", color: "#7fc8e8" },
  co2: { label: "CO2", color: "#b7a6e8" },
  food: { label: "Food", color: "#c9a26b" },
  wrench: { label: "Wrench", color: "#9aa3b2" },
};

export function drawConverter(
  ctx: CanvasRenderingContext2D,
  c: DeepReadonly<Converter>,
  ship: DeepReadonly<Pick<Ship, "cabinOxygen">>,
  area: Area,
): void {
  const { x, y, w } = area;
  const oxygen = ship.cabinOxygen;

  ctx.font = "16px sans-serif";
  ctx.fillStyle = TEXT;
  ctx.fillText("Oxygen converter", x, y + 20);

  ctx.font = "14px sans-serif";
  const barY = y + 36;
  ctx.fillStyle = "#1c2230";
  ctx.fillRect(x, barY, w, 18);
  ctx.fillStyle = oxygen < LOW_OXYGEN ? BAD : oxygen < 0.5 ? WARN : OK;
  ctx.fillRect(x, barY, w * oxygen, 18);
  ctx.fillStyle = TEXT;
  ctx.fillText(`Cabin oxygen ${Math.round(oxygen * 100)}%`, x + 6, barY + 14);

  ctx.fillStyle = c.jammed > 0 ? BAD : DIM;
  ctx.fillText(c.jammed > 0 ? `Intake jammed, clears in ${Math.ceil(c.jammed)} s` : "Intake running", x, barY + 40);

  // the tray, oldest on the left, sliding toward the intake as new items arrive
  const slot = w / TRAY_SIZE;
  const trayY = barY + 64;
  c.tray.forEach((item, i) => {
    const sx = x + i * slot;
    if (i === c.cursor) {
      ctx.fillStyle = "#1c2230";
      ctx.fillRect(sx, trayY - 6, slot - 6, 64);
    }
    ctx.fillStyle = ITEM_LOOK[item].color;
    ctx.fillRect(sx + 10, trayY, slot - 26, 30);
    ctx.fillStyle = TEXT;
    ctx.fillText(ITEM_LOOK[item].label, sx + 10, trayY + 50);
  });

  ctx.fillStyle = DIM;
  ctx.fillText("A/D select, E feed", x, trayY + 90);
}

export function drawCore(
  ctx: CanvasRenderingContext2D,
  core: DeepReadonly<Core>,
  ship: DeepReadonly<Pick<Ship, "coreTemp" | "instrumentHealth">>,
  area: Area,
): void {
  const { x, y, w } = area;
  const temp = ship.coreTemp;

  ctx.font = "16px sans-serif";
  ctx.fillStyle = TEXT;
  ctx.fillText("Energy core", x, y + 20);
  ctx.font = "14px sans-serif";
  ctx.fillStyle = DIM;
  ctx.fillText(`Heated by ${core.part}`, x, y + 42);

  // the temperature bar, cold on the left, with the safe band marked behind it
  const barY = y + 56;
  ctx.fillStyle = "#1c2230";
  ctx.fillRect(x, barY, w, 18);
  ctx.fillStyle = "#24402f";
  ctx.fillRect(x + w * SAFE_LOW, barY, w * (SAFE_HIGH - SAFE_LOW), 18);
  ctx.fillStyle = temp > SAFE_HIGH ? BAD : temp < SAFE_LOW ? "#7fc8e8" : OK;
  ctx.fillRect(x + w * temp - 3, barY - 4, 6, 26);

  ctx.fillStyle = temp > SAFE_HIGH ? BAD : temp < SAFE_LOW ? "#7fc8e8" : DIM;
  const status = temp > SAFE_HIGH ? "Too hot: the instrument is taking damage" : temp < SAFE_LOW ? "Too cold" : "In the safe band";
  ctx.fillText(status, x, barY + 40);

  ctx.fillStyle = TEXT;
  ctx.fillText(`Coolant valve ${Math.round(core.valve * 100)}% open`, x, barY + 66);
  ctx.fillStyle = ship.instrumentHealth < 0.5 ? WARN : TEXT;
  ctx.fillText(`Instrument health ${Math.round(ship.instrumentHealth * 100)}%`, x, barY + 88);

  ctx.fillStyle = DIM;
  ctx.fillText("W open valve, S close valve", x, barY + 120);
}
