import { registerScene } from "../core/scene";
import { registerRule } from "../core/step";
import { begin, box, text } from "../ui/kit";
import { engineOffPrompt } from "./handshake";
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
    // the engine-off request: in the free strip above the Pilot's field, clear of the ship and the gauges,
    // and as a reminder on any other station for whoever holds the Pilot role
    const prompt = engineOffPrompt(state, me.id);
    if (prompt) {
      begin(ctx);
      box(ctx, 214, 6, 202, 17, "#e8b04b", 4);
      const msg = prompt === "answer" ? "ENGINEER: ENGINE OFF?  [E] YES  [Q] NO" : "ENGINE-OFF REQUEST: [TAB] TO PILOT";
      text(ctx, msg, 222, 15, 7.5, "#e8b04b", { weight: 600, base: "middle" });
      ctx.restore();
    }
  },
});
