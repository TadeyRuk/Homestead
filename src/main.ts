import "./register";
import { createInput, type Input } from "./core/input";
import { inSurfaceGame } from "./missions/games";
import { followPhase, sceneFor } from "./core/scene";
import { createState, type GameState, type Phase } from "./core/state";
import { PLAYER_SPEED } from "./core/step";
import { timeLeft } from "./core/timer";
import { renderLobby } from "./lobby/lobby";
import { host, join } from "./net/peer";
import { createClient, createHost, HOST_ID, PING_MS } from "./net/session";
import { createInterpolator, createPrediction } from "./net/smooth";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
const ui = document.querySelector<HTMLElement>("#ui");
if (!canvas || !ui) throw new Error("Missing #game canvas or #ui root");
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Canvas 2D context unavailable");

const input = createInput();
const STILL: Input = { dx: 0, dy: 0, interact: false, panel: false, switch: false };
const TICK_MS = 1000 / 60;
const FLUSH_MS = 250; // time for a final "end" message to leave before the peer is destroyed
// other players are drawn this far in the past, so two snapshots (about 33 ms apart) are always on hand
const INTERP_DELAY_MS = 100;

// what this tab is doing right now; null while sitting in the lobby form
type Mode =
  | { kind: "host"; run: number; state: GameState; session: ReturnType<typeof createHost>; close(): void }
  | {
      kind: "client";
      run: number;
      client: ReturnType<typeof createClient>;
      prediction: ReturnType<typeof createPrediction>;
      others: ReturnType<typeof createInterpolator>;
      close(): void;
    };
let mode: Mode | null = null;
let run = 0; // bumps every run, so callbacks from an old run can't end a new one
let drawn: Phase = "lobby";
let sent = "";
let crewShown = "";
let lobby = openLobby();

function endedBy(thisRun: number) {
  return (reason: string) => {
    if (mode?.run === thisRun) backToLobby(reason);
  };
}

function startHosting(name: string, closePeer: () => void) {
  const thisRun = ++run;
  const state = createState(Date.now() >>> 0, "mars");
  const session = createHost(state, name, endedBy(thisRun));
  input.read(); // drop presses made while the lobby form had the screen
  // a timer, not the frame loop: browsers stop animation frames in background tabs, and joiners need snapshots
  let last = performance.now();
  const ticker = setInterval(() => {
    const now = performance.now();
    // up to 1 s per tick, so normal background-tab throttling (about one tick a second) doesn't slow the run
    try {
      session.tick(now, Math.min((now - last) / 1000, 1), input.read());
    } catch (e) {
      // a rule that throws every tick would otherwise freeze the run silently
      console.error("host tick failed", e);
      session.end("The game hit an error");
    }
    last = now;
  }, TICK_MS);
  mode = {
    kind: "host",
    run: thisRun,
    state,
    session,
    close: () => {
      clearInterval(ticker);
      setTimeout(closePeer, FLUSH_MS);
    },
  };
  return { state, session };
}

function openLobby(message = "") {
  ui!.hidden = false;
  const l = renderLobby(ui!, {
    onSolo: (name) => {
      const { session } = startHosting(name, () => {});
      session.start(performance.now());
      l.hide();
    },
    onHost: async (name) => {
      l.setBusy(true);
      l.setStatus("Getting a code...");
      try {
        const hosting = await host();
        const { state, session } = startHosting(name, hosting.close);
        hosting.onConnection((conn) => session.addConnection(conn));
        l.setStatus("");
        l.showHosting(hosting.code, state.seed);
      } catch (e) {
        l.setBusy(false);
        l.setStatus("");
        l.showError(`${(e as Error).message}. Try again, or play solo.`);
      }
    },
    onJoin: async (name, code) => {
      l.setBusy(true);
      l.setStatus("Connecting...");
      try {
        const joined = await join(code);
        const thisRun = ++run;
        input.read(); // drop presses made while the lobby form had the screen
        const others = createInterpolator();
        const client = createClient(joined.conn, name, endedBy(thisRun), undefined, (s, hostNow) =>
          others.push(hostNow, s.players),
        );
        // an interval, not the frame loop, so pings keep going while this tab is in the background
        const pinger = setInterval(client.ping, PING_MS);
        mode = {
          kind: "client",
          run: thisRun,
          client,
          prediction: createPrediction(PLAYER_SPEED),
          others,
          close: () => {
            clearInterval(pinger);
            client.leave();
            setTimeout(joined.close, FLUSH_MS);
          },
        };
        l.showJoined();
        l.setStatus("Joined. Waiting for the host to start.");
      } catch (e) {
        l.setBusy(false);
        l.setStatus("");
        l.showError(`${(e as Error).message}. Check the code and try again.`);
      }
    },
    onStart: () => {
      if (mode?.kind !== "host") return;
      mode.session.start(performance.now());
      l.hide();
    },
    onPickRole: (role) => {
      if (mode?.kind === "host") mode.session.takeRole(role);
      else if (mode?.kind === "client") mode.client.pickRole(role);
    },
    onMission: (choice) => {
      if (mode?.kind === "host") mode.session.setMission(choice);
    },
  });
  if (message) l.showError(message);
  return l;
}

function backToLobby(reason: string) {
  const old = mode;
  mode = null;
  old?.close();
  sceneFor(drawn).exit?.();
  drawn = "lobby";
  sent = "";
  crewShown = "";
  lobby = openLobby(reason === "Run complete" ? "Run complete." : `${reason}. The run has ended.`);
}

// a hidden tab stops its frame loop, so tell the host this player let go of every key
document.addEventListener("visibilitychange", () => {
  if (document.hidden && mode?.kind === "client") {
    mode.client.sendInput(STILL);
    sent = JSON.stringify(STILL);
  }
});

let last = performance.now();

function frame(now: number) {
  requestAnimationFrame(frame); // first, so one bad frame can't stop drawing for good
  try {
    draw(now);
  } catch (e) {
    console.error("frame failed", e);
    if (mode) backToLobby("The game hit an error");
  }
}

// what a joiner draws: its own player from its keys, everyone else slid between snapshots
function smoothed(
  joined: Extract<Mode, { kind: "client" }>,
  state: GameState,
  me: string,
  i: Input,
  dt: number,
): GameState {
  const mine = state.players.find((p) => p.id === me);
  if (mine) {
    // the host keeps players still in the lobby, when down, and in a surface minigame; predict the same
    const still = state.phase === "lobby" || mine.down || inSurfaceGame(state, me);
    if (!still) joined.prediction.step(i, dt);
    joined.prediction.reconcile(mine, !still && (i.dx !== 0 || i.dy !== 0), dt);
  }
  const past = joined.others.at(joined.client.hostNow() - INTERP_DELAY_MS);
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === me ? { ...p, ...joined.prediction.position() } : { ...p, ...(past.get(p.id) ?? p) },
    ),
  };
}

// the lobby lists names and roles; redraw it only when they change
function showCrewIfChanged(state: GameState, me: string) {
  const rows = state.players.map((p) => ({ name: p.name, roles: p.roles, me: p.id === me }));
  const key = JSON.stringify(rows);
  if (key === crewShown) return;
  crewShown = key;
  lobby.showCrew(rows);
}

function draw(now: number) {
  const dt = Math.max(0, Math.min((now - last) / 1000, 0.1));
  last = now;

  let state: GameState | null = null;
  let me = HOST_ID;
  if (mode?.kind === "host") {
    state = mode.state;
  } else if (mode?.kind === "client") {
    const joined = mode;
    // only send when something changed, so a still player costs no traffic
    const i = input.read();
    const msg = JSON.stringify(i);
    if (msg !== sent || i.interact || i.panel || i.switch) joined.client.sendInput(i);
    sent = msg;
    joined.client.check();
    // check can end the run, and backToLobby then replaces mode
    if (mode === joined) {
      state = joined.client.state();
      me = joined.client.playerId() ?? "";
      if (state && state.phase !== "lobby") lobby.hide();
      if (state && state.phase !== "lobby") state = smoothed(joined, state, me, i, dt);
    }
  }

  if (state?.phase === "lobby") showCrewIfChanged(state, me);

  ctx!.fillStyle = "#0b0e14";
  ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
  if (state) {
    drawn = followPhase(drawn, state);
    const scene = sceneFor(state.phase);
    scene.update?.(state, dt);
    const hostNow = mode?.kind === "client" ? mode.client.hostNow() : now;
    scene.draw(ctx!, state, { playerId: me, now: hostNow });
    const left = timeLeft(state, hostNow);
    if (Number.isFinite(left)) {
      ctx!.fillStyle = "#8a93a6";
      ctx!.font = "14px sans-serif";
      ctx!.textAlign = "right";
      ctx!.fillText(`${Math.ceil(left)} s`, canvas!.width - 16, 28);
      ctx!.textAlign = "left";
    }
  }
}
requestAnimationFrame(frame);
