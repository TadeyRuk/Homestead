import { createInput } from "./core/input";
import { nextPhase } from "./core/phases";
import { changePhase, sceneFor } from "./core/scene";
import { createState } from "./core/state";
import { isUp, timeLeft } from "./core/timer";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) throw new Error("Missing #game canvas");
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Canvas 2D context unavailable");

const input = createInput();
const state = createState(Date.now() >>> 0, "mars");
state.players.push({
  id: "local",
  name: "You",
  roles: ["pilot", "engineer", "comms", "science"],
  x: canvas.width / 2,
  y: canvas.height / 2,
  carrying: null,
  oxygen: 1,
  power: 1,
  down: false,
});
changePhase(state, "brief", performance.now());

const SPEED = 180;
let last = performance.now();

function frame(now: number) {
  const dt = Math.max(0, Math.min((now - last) / 1000, 0.1));
  last = now;

  const { dx, dy } = input.read();
  const me = state.players[0];
  me.x += dx * SPEED * dt;
  me.y += dy * SPEED * dt;
  if (isUp(state, now)) changePhase(state, nextPhase(state.phase), now);

  const scene = sceneFor(state.phase);
  scene.update?.(state, dt);
  ctx!.fillStyle = "#0b0e14";
  ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
  scene.draw(ctx!, state, { playerId: me.id });
  const left = timeLeft(state, now);
  if (Number.isFinite(left)) {
    ctx!.fillStyle = "#8a93a6";
    ctx!.font = "14px sans-serif";
    ctx!.textAlign = "right";
    ctx!.fillText(`${Math.ceil(left)} s`, canvas!.width - 16, 28);
    ctx!.textAlign = "left";
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
