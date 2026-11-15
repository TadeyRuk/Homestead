import { metersFor, type Meters } from "../build/meters";
import { ROLES } from "../core/lobby";
import { PHASE_SECONDS } from "../core/phases";
import type { DeepReadonly } from "../core/scene";
import type { GameState, Phase, Player } from "../core/state";
import { timeLeft } from "../core/timer";
import { MISSIONS, partData, partName } from "../data/data";
import { follow } from "../ground/camera";
import { hazardAt, hazardBanner } from "../ground/hazards";
import { atLander } from "../ground/suit";
import { groundFor } from "../ground/world";
import { objectiveLines } from "../missions/objectives";
import { el, meter, onFrame, overlay, type Frame } from "./overlay";
import { sfx } from "./sfx";
import { ROLE_COLOUR, ROLE_NAME, SLOT_COLOUR, SLOT_NAME } from "./tokens";

/**
 * Seat 3's HUD over every phase (S3-05, S3-06, S3-07): the phase clock, credits and the carried
 * part, the six meters on the campus, the crew strip in flight, and the mission and suit panel on
 * the surface. It only reads the GameState the scene was handed.
 */

const ROLE_SHORT = { pilot: "Pilot", engineer: "Engineer", comms: "Comms", science: "Science" } as const;

const PHASE_LABEL: Partial<Record<Phase, string>> = {
  brief: "Brief",
  campus: "Build",
  flight: "Transit",
  surface: "Surface",
  report: "Report",
};

const at = (node: HTMLElement, x: number | null, y: number | null, w?: number, from: "left" | "right" = "left", fromY: "top" | "bottom" = "top") => {
  if (x !== null) node.style[from] = `calc(var(--u) * ${x})`;
  if (y !== null) node.style[fromY] = `calc(var(--u) * ${y})`;
  if (w !== undefined) node.style.width = `calc(var(--u) * ${w})`;
  return node;
};

/** sets text only when it changed, so the DOM isn't touched every frame */
function put(node: HTMLElement, s: string): void {
  if (node.textContent !== s) node.textContent = s;
}

function show(node: HTMLElement, on: boolean): void {
  if (node.hidden === on) node.hidden = !on;
}

export function startHud(): void {
  const root = overlay();
  if (!root) return;

  // the phase clock, top right, in place of the shell's plain seconds
  const clockLabel = el("span", "hs-clock-label");
  const clockTime = el("span", "hs-clock-time");
  const clock = at(el("div", "hs-panel hs-clock", [clockLabel, clockTime]), 4, 4, undefined, "right");
  // the brief and the report show their own countdowns; this only hides the shell's plain seconds there
  const mask = at(el("div", "hs-mask"), 2, 3, 40, "right");

  // campus: credits, and the six meters
  const credits = at(el("div", "hs-panel hs-chip"), 4, 4);
  const meterNames = ["mass", "power", "budget", "data", "comms", "time"] as const;
  const labels: Record<(typeof meterNames)[number], string> = { mass: "Mass", power: "Power", budget: "Budget", data: "Data", comms: "Comms", time: "Time" };
  const meters = Object.fromEntries(meterNames.map((n) => [n, meter(labels[n])])) as Record<(typeof meterNames)[number], ReturnType<typeof meter>>;
  const meterTitle = el("h2", "", ["Rocket"]);
  const meterNote = el("p", "hs-meters-note");
  const metersPanel = at(el("div", "hs-panel hs-meters", [meterTitle, ...meterNames.map((n) => meters[n].node), meterNote]), 4, 30, 134, "right");

  // campus and surface: what this player holds
  const carryName = el("strong");
  const carryInfo = el("span", "hs-carry-info");
  const carry = el("div", "hs-panel hs-carry", [el("span", "hs-carry-label", ["Carrying"]), carryName, carryInfo]);
  carry.style.left = "50%";
  carry.style.transform = "translateX(-50%)";
  at(carry, null, 18, undefined, "left", "bottom");

  // flight: the crew strip
  const crewChips = ROLES.map((role) => {
    const name = el("span", "hs-crew-role", [ROLE_SHORT[role]]);
    const trouble = el("span", "hs-crew-trouble");
    const chip = el("div", "hs-crew-chip", [name, trouble]);
    chip.style.setProperty("--role", ROLE_COLOUR[role]);
    return { role, chip, trouble };
  });
  const crew = at(el("div", "hs-crew", crewChips.map((c) => c.chip)), null, 4);
  crew.style.right = "calc(var(--u) * 84)";

  // surface: Mission Control's list and the suit, one at a time; Q flips
  const listTitle = el("h2");
  const listBody = el("ul", "hs-list");
  const listHint = el("p", "hs-hint");
  const list = at(el("div", "hs-panel hs-mission", [listTitle, listBody, listHint]), 4, 4, 168);
  let showSuit = false;

  // surface: seat 6's hazard warning (S6-10), centred along the top
  const banner = el("div", "hs-panel hs-banner");
  banner.style.left = "50%";
  banner.style.transform = "translateX(-50%)";
  at(banner, null, 4);

  root.append(mask, clock, credits, metersPanel, carry, crew, list, banner);
  for (const n of [mask, clock, credits, metersPanel, carry, crew, list, banner]) n.hidden = true;

  window.addEventListener("keydown", (e) => {
    if (e.code !== "KeyQ" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
    if (!list.hidden) {
      showSuit = !showSuit;
      sfx.blip();
    }
  });

  let lastTroubles = "";

  onFrame((frame: Frame | null) => {
    const phase = frame?.state.phase;
    const live = !!frame && phase !== "lobby";
    const ownClock = phase === "brief" || phase === "report";
    show(clock, live && !ownClock);
    show(mask, live && ownClock);
    show(credits, live && phase === "campus");
    show(metersPanel, live && phase === "campus");
    show(crew, live && phase === "flight");
    show(list, live && phase === "surface");
    if (!frame || !live) {
      show(banner, false);
      show(carry, false);
      return;
    }
    const { state, view } = frame;
    const me = state.players.find((p) => p.id === view.playerId) as DeepReadonly<Player> | undefined;
    const left = timeLeft(state, view.now);

    // the clock
    const label = phase === "surface" && left <= 10 ? "Extraction" : (PHASE_LABEL[phase!] ?? "");
    put(clockLabel, label);
    const secs = Number.isFinite(left) ? Math.max(0, Math.ceil(left)) : 0;
    put(clockTime, `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`);
    clock.dataset.tone = secs <= 10 ? "bad" : secs <= 30 ? "warn" : "ok";

    // what this player carries, on the maps
    const holding = me?.carrying ?? null;
    show(carry, (phase === "campus" || phase === "surface") && !!holding);
    if (holding) {
      put(carryName, partName(holding));
      const info = partData(holding);
      put(carryInfo, info ? `${SLOT_NAME[info.slot].toLowerCase()} · ${info.mass} kg · ${info.power > 0 ? "+" : ""}${info.power} W` : "bring it to the lander");
      carry.style.setProperty("--slot", info ? SLOT_COLOUR[info.slot] : "#ffb43c");
    }

    // fade any panel the player is standing under, using seat 2's camera to find them on screen
    if (me && (phase === "campus" || phase === "surface")) {
      const canvas = document.querySelector<HTMLCanvasElement>("#game");
      const map = groundFor(phase);
      if (canvas && map) {
        const cam = follow(me, map, canvas.width, canvas.height);
        const sx = ((me.x - cam.x) / canvas.width) * 640;
        const sy = ((me.y - cam.y) / canvas.height) * 360;
        for (const panel of [metersPanel, list, credits, carry]) {
          if (panel.hidden) continue;
          const r = panel.getBoundingClientRect();
          const o = root!.getBoundingClientRect();
          const u = o.width / 640;
          const x0 = (r.left - o.left) / u - 10;
          const x1 = (r.right - o.left) / u + 10;
          const y0 = (r.top - o.top) / u - 14;
          const y1 = (r.bottom - o.top) / u + 24; // the carried part's name floats above the player
          panel.dataset.under = sx > x0 && sx < x1 && sy > y0 && sy < y1 ? "1" : "";
        }
      }
    }

    if (phase === "campus") drawCampus(state, left, holding);
    else if (phase === "flight") drawFlight(state, me);
    else if (phase === "surface") drawSurface(state, me, left);

    // the hazard is derived from the seed and the clock, so every tab shows the same warning
    const hazard = phase === "surface" ? hazardAt(state, view.now) : null;
    const line = hazardBanner(hazard);
    show(banner, !!line);
    if (line) {
      put(banner, line);
      const tone = hazard?.kind === "flare" && hazard.stage === "warning" ? "warn" : "bad";
      if (banner.dataset.tone !== tone) {
        // a new warning or the hazard arriving: one beep
        sfx.warn();
        banner.dataset.tone = tone;
      }
    } else banner.dataset.tone = "";
  });

  function drawCampus(state: DeepReadonly<GameState>, left: number, holding: string | null): void {
    const start = MISSIONS[state.mission].credits;
    put(credits, `${state.credits} credits · kiosk 20 a roll`);
    const now = metersFor(state, left, PHASE_SECONDS.campus, start);
    const preview = holding && partData(holding) ? metersFor(state, left, PHASE_SECONDS.campus, start, holding) : null;
    const m: Meters = preview ?? now;
    for (const n of meterNames) {
      const v = m[n];
      meters[n].set(v.fill, v.text, v.tone);
    }
    put(meterTitle, preview ? "If mounted" : "Rocket");
    metersPanel.dataset.preview = preview ? "1" : "";
    let note = "";
    if (m.mass.lift === 0) note = "No engine yet: the rocket can't lift off.";
    else if (m.mass.mass > m.mass.lift) note = "Too heavy for this engine. The launch will fail.";
    else if (m.power.draw > m.power.supply) note = "Draws more than it supplies: the breaker will trip.";
    else if (!state.ship.slots.comms || !state.ship.slots.payload || !state.ship.slots.power) note = "Empty slots get salvage when the clock runs out.";
    else note = "E at the pad, empty-handed: launch countdown.";
    put(meterNote, note);
    meterNote.dataset.tone = note.startsWith("Too heavy") || note.startsWith("No engine") ? "bad" : note.startsWith("Draws") ? "warn" : "";
  }

  function drawFlight(state: DeepReadonly<GameState>, me: DeepReadonly<Player> | undefined): void {
    let troubles = "";
    for (const c of crewChips) {
      const t = state.trouble[c.role];
      put(c.trouble, t ?? "steady");
      c.chip.dataset.trouble = t ? "1" : "";
      c.chip.dataset.here = me?.station === c.role ? "1" : "";
      const holder = state.players.find((p) => p.roles.includes(c.role));
      c.chip.title = holder ? `${ROLE_NAME[c.role]}: ${holder.name}` : ROLE_NAME[c.role];
      if (t) troubles += c.role;
    }
    // a new problem somewhere on the ship: one warning beep
    if (troubles.length > lastTroubles.length) sfx.warn();
    lastTroubles = troubles;
  }

  function drawSurface(state: DeepReadonly<GameState>, me: DeepReadonly<Player> | undefined, left: number): void {
    const sv = state.surface;
    if (!showSuit) {
      put(listTitle, "Mission Control");
      // seat 2's list (S2-18): this run's drawn objectives, then the uplink and the bonus
      const rows = objectiveLines(state).map((line): [string, string, boolean] => {
        const value =
          line.need > 1
            ? `${line.count} / ${line.need}`
            : line.done
              ? "done"
              : line.id === "sample" && sv.sampleDrilled
                ? "carry it home"
                : "";
        return [line.id === "uplink" ? "Uplink data" : line.label, value, line.done];
      });
      renderRows(rows);
      const held = me ? Math.floor(sv.held[me.id] ?? 0) : 0;
      put(listHint, `${held > 0 ? `You hold ${held} data units: bring them to the lander. ` : ""}Q: suit`);
    } else {
      put(listTitle, "Suit");
      const o = me?.oxygen ?? 0;
      const pw = me?.power ?? 0;
      const lander = me ? atLander(me as Player) : false;
      const rows: [string, string, boolean][] = [
        ["Oxygen", `${Math.round(o * 100)}%`, o > 0.3],
        ["Power", `${Math.round(pw * 100)}%`, pw > 0.3],
        ["Carrying", me?.carrying ? partName(me.carrying) : "nothing", true],
        ["Data in hand", `${Math.floor(me ? (sv.held[me.id] ?? 0) : 0)} units`, true],
        ["Lander", lander ? "recharging here" : "away", lander],
      ];
      renderRows(rows, true);
      put(listHint, `Extraction in ${Math.max(0, Math.ceil(left))} s · Q: mission`);
    }
  }

  function renderRows(rows: [string, string, boolean][], suit = false): void {
    while (listBody.children.length < rows.length) listBody.append(el("li", "", [el("span"), el("span")]));
    while (listBody.children.length > rows.length) listBody.lastElementChild!.remove();
    rows.forEach(([name, value, ok], i) => {
      const li = listBody.children[i] as HTMLElement;
      put(li.children[0] as HTMLElement, name);
      put(li.children[1] as HTMLElement, value);
      li.dataset.ok = ok ? "1" : "";
      li.dataset.suit = suit ? "1" : "";
      li.dataset.low = suit && !ok ? "1" : "";
    });
  }
}
