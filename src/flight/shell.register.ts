import { registerScene } from "../core/scene";
import { registerRule } from "../core/step";
import { engineOffPending } from "./handshake";
import { nextStation, stationFor, stationLabel } from "./stations";

// host: keep every player on one of their own stations, and move them on when they press Tab
registerRule("flight", (state, inputs) => {
  for (const p of state.players) {
    if (p.station === null || !p.roles.includes(p.station)) p.station = nextStation(p.roles, null);
    else if (inputs[p.id]?.switch) p.station = nextStation(p.roles, p.station);
  }
});

registerScene("flight", {
  draw(ctx, state, view) {
    const me = state.players.find((p) => p.id === view.playerId);
    ctx.fillStyle = "#e6e9ef";
    ctx.font = "600 16px sans-serif";
    if (!me?.station) {
      ctx.fillText("No station yet. Roles are picked in the lobby.", 16, 28);
      return;
    }
    const hint = me.roles.length > 1 ? "   Tab: next station" : "";
    ctx.fillText(`${stationLabel(me.station)}${hint}`, 16, 28);
    stationFor(me.station).draw(ctx, state, view);
    // the engine-off request goes on the Pilot's screen, over whatever the station draws
    if (me.station === "pilot" && engineOffPending(state)) {
      ctx.fillStyle = "#0b0e14e6";
      ctx.fillRect(16, 470, 480, 46);
      ctx.strokeStyle = "#e8b04b";
      ctx.strokeRect(16.5, 470.5, 479, 45);
      ctx.fillStyle = "#e6e9ef";
      ctx.font = "600 15px sans-serif";
      ctx.fillText("Engineer asks to cut the engine to save power.", 28, 490);
      ctx.fillStyle = "#e8b04b";
      ctx.font = "14px sans-serif";
      ctx.fillText("E: agree    Q: refuse", 28, 508);
    }
  },
});
