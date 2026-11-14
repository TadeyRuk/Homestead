import { normalizeCode } from "../net/code";
import "./lobby.css";

export interface LobbyHandlers {
  onHost(name: string): void;
  onJoin(name: string, code: string): void;
  onStart(): void;
  /** a local run with no network, so the game works even if signalling is down */
  onSolo(name: string): void;
}

// a bare form so two tabs can join; seat 3's lobby screens (S3-03) replace it
export function renderLobby(root: HTMLElement, h: LobbyHandlers) {
  root.innerHTML = `
    <form class="lobby" novalidate>
      <h1>Homestead</h1>
      <label for="lobby-name">Name</label>
      <input id="lobby-name" maxlength="16" autocomplete="nickname" />
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
      <section class="lobby-hosting" hidden>
        <p class="lobby-label">Your code</p>
        <p class="lobby-code" aria-live="polite"></p>
        <p class="lobby-crew"></p>
        <button type="button" data-act="start" class="primary">Start</button>
      </section>
      <p class="lobby-status" aria-live="polite"></p>
    </form>`;

  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const name = $<HTMLInputElement>("#lobby-name");
  const code = $<HTMLInputElement>("#lobby-code");
  const errorLine = $<HTMLElement>(".lobby-error");
  const statusLine = $<HTMLElement>(".lobby-status");
  const hosting = $<HTMLElement>(".lobby-hosting");
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
    showHosting: (c: string) => {
      hosting.hidden = false;
      $<HTMLElement>(".lobby-code").textContent = c;
      $<HTMLElement>(".lobby-pre").hidden = true;
      name.disabled = true;
    },
    showCrew: (names: string[]) => {
      $<HTMLElement>(".lobby-crew").textContent = `Crew: ${names.join(", ")}`;
    },
    hide: () => {
      // a focused button would keep swallowing game keys; not every browser blurs a hidden element
      if (root.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      root.hidden = true;
    },
  };
}
