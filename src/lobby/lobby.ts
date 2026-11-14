import type { MissionChoice } from "../core/lobby";
import { ROLES } from "../core/lobby";
import type { Role } from "../core/state";
import { normalizeCode } from "../net/code";
import "./lobby.css";

export interface LobbyHandlers {
  onHost(name: string): void;
  onJoin(name: string, code: string): void;
  onStart(): void;
  /** a local run with no network, so the game works even if signalling is down */
  onSolo(name: string): void;
  onPickRole(role: Role): void;
  onMission(choice: MissionChoice): void;
}

export interface CrewRow {
  name: string;
  roles: readonly Role[];
  me: boolean;
}

const ROLE_LABEL: Record<Role, string> = { pilot: "Pilot", engineer: "Engineer", comms: "Comms", science: "Science" };

// a bare form so two tabs can join; seat 3's lobby screens (S3-03) replace it
export function renderLobby(root: HTMLElement, h: LobbyHandlers) {
  root.innerHTML = `
    <form class="lobby" novalidate>
      <h1>Homestead</h1>
      <div class="lobby-name">
        <label for="lobby-name">Name</label>
        <input id="lobby-name" maxlength="16" autocomplete="nickname" />
      </div>
      <div class="lobby-pre">
        <div class="lobby-row">
          <button type="button" data-act="solo" class="primary">Play solo</button>
          <button type="button" data-act="host">Host</button>
        </div>
        <label for="lobby-code">Join code</label>
        <div class="lobby-row">
          <input id="lobby-code" maxlength="8" autocomplete="off" spellcheck="false" />
          <button type="button" data-act="join">Join</button>
        </div>
      </div>
      <p class="lobby-error" role="alert" aria-live="assertive"></p>
      <section class="lobby-room" hidden>
        <div class="lobby-host-only">
          <p class="lobby-label">Your code</p>
          <p class="lobby-code" aria-live="polite"></p>
        </div>
        <p class="lobby-label">Crew</p>
        <ul class="lobby-crew"></ul>
        <p class="lobby-label">Take a role</p>
        <div class="lobby-roles" role="group" aria-label="Take a role">
          ${ROLES.map((r) => `<button type="button" data-role="${r}" aria-pressed="false">${ROLE_LABEL[r]}</button>`).join("")}
        </div>
        <div class="lobby-host-only lobby-mission">
          <label for="lobby-mission">Mission</label>
          <select id="lobby-mission">
            <option value="random">Random</option>
            <option value="moon">Moon</option>
            <option value="mars">Mars</option>
          </select>
          <p class="lobby-seed"></p>
        </div>
        <div class="lobby-host-only">
          <button type="button" data-act="start" class="primary">Start</button>
        </div>
      </section>
      <p class="lobby-status" aria-live="polite"></p>
    </form>`;

  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const name = $<HTMLInputElement>("#lobby-name");
  const code = $<HTMLInputElement>("#lobby-code");
  const errorLine = $<HTMLElement>(".lobby-error");
  const statusLine = $<HTMLElement>(".lobby-status");
  const room = $<HTMLElement>(".lobby-room");
  const roleButtons = [...root.querySelectorAll<HTMLButtonElement>("[data-role]")];
  const enterRoom = (asHost: boolean) => {
    room.hidden = false;
    $<HTMLElement>(".lobby-pre").hidden = true;
    for (const el of root.querySelectorAll<HTMLElement>(".lobby-host-only")) el.hidden = !asHost;
    name.disabled = true;
    $<HTMLElement>(".lobby-name").hidden = true; // fixed now, and the crew list shows it
    for (const b of buttons) b.disabled = false;
  };
  const buttons = [...root.querySelectorAll<HTMLButtonElement>("button")];

  const showError = (msg: string) => {
    errorLine.textContent = msg;
  };
  const named = () => {
    const n = name.value.trim();
    if (!n) {
      showError("Enter a name first.");
      name.focus();
    }
    return n;
  };

  $("[data-act=solo]").addEventListener("click", () => {
    const n = named();
    if (n) h.onSolo(n);
  });
  $("[data-act=host]").addEventListener("click", () => {
    const n = named();
    if (n) h.onHost(n);
  });
  $("[data-act=join]").addEventListener("click", () => {
    const n = named();
    if (!n) return;
    const c = normalizeCode(code.value);
    if (!c) {
      showError("Codes are 6 letters and numbers, like K7MQ2X.");
      code.focus();
      return;
    }
    h.onJoin(n, c);
  });
  $("[data-act=start]").addEventListener("click", () => h.onStart());
  for (const b of roleButtons) {
    b.addEventListener("click", () => {
      if (b.getAttribute("aria-pressed") !== "true") h.onPickRole(b.dataset.role as Role);
    });
  }
  $("#lobby-mission").addEventListener("change", (e) => h.onMission((e.target as HTMLSelectElement).value as MissionChoice));
  root.querySelector("form")!.addEventListener("submit", (e) => e.preventDefault());

  return {
    showError,
    setStatus: (msg: string) => {
      statusLine.textContent = msg;
    },
    setBusy: (busy: boolean) => {
      for (const b of buttons) b.disabled = busy;
      if (busy) showError("");
    },
    showHosting: (c: string, seed: number) => {
      enterRoom(true);
      $<HTMLElement>(".lobby-code").textContent = c;
      $<HTMLElement>(".lobby-seed").textContent = `Seed ${seed}`;
    },
    showJoined: () => enterRoom(false),
    showCrew: (rows: readonly CrewRow[]) => {
      const list = $<HTMLElement>(".lobby-crew");
      list.replaceChildren(
        ...rows.map((r) => {
          const li = document.createElement("li");
          li.textContent = `${r.name}${r.me ? " (you)" : ""}: ${r.roles.map((x) => ROLE_LABEL[x]).join(", ")}`;
          return li;
        }),
      );
      const mine = rows.find((r) => r.me)?.roles ?? [];
      for (const b of roleButtons) b.setAttribute("aria-pressed", String(mine.includes(b.dataset.role as Role)));
    },
    hide: () => {
      // a focused button would keep swallowing game keys; not every browser blurs a hidden element
      if (root.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      root.hidden = true;
    },
  };
}
