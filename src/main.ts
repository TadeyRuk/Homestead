const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) throw new Error("Missing #game canvas");
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Canvas 2D context unavailable");

const keys = new Set<string>();
addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

const player = { x: canvas.width / 2, y: canvas.height / 2, speed: 180 };

let last = performance.now();
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  const dx = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0);
  const dy = (keys.has("s") ? 1 : 0) - (keys.has("w") ? 1 : 0);
  player.x += dx * player.speed * dt;
  player.y += dy * player.speed * dt;

  ctx!.fillStyle = "#0b0e14";
  ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
  ctx!.fillStyle = "#e8b04b";
  ctx!.fillRect(player.x - 8, player.y - 8, 16, 16);
  ctx!.fillStyle = "#8a93a6";
  ctx!.font = "14px sans-serif";
  ctx!.fillText("Homestead scaffold. WASD to move.", 16, 28);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
