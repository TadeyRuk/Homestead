// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderLobby } from "./lobby";

let root: HTMLElement;
const handlers = () => ({ onHost: vi.fn(), onJoin: vi.fn(), onStart: vi.fn(), onSolo: vi.fn(), onPickRole: vi.fn(), onMission: vi.fn() });
const type = (id: string, value: string) => {
  const el = root.querySelector<HTMLInputElement>(`#${id}`)!;
  el.value = value;
};
const click = (text: string) =>
  [...root.querySelectorAll("button")].find((b) => b.textContent === text)!.click();
const error = () => root.querySelector('[role="alert"]')!.textContent;

beforeEach(() => {
  document.body.innerHTML = "";
  root = document.createElement("div");
  document.body.append(root);
});

describe("lobby", () => {
  it("hosts with the typed name", () => {
    const h = handlers();
    renderLobby(root, h);
    type("lobby-name", "Ada");
    click("Host");
    expect(h.onHost).toHaveBeenCalledWith("Ada");
  });

  it("joins with the name and the code in canonical form", () => {
    const h = handlers();
    renderLobby(root, h);
    type("lobby-name", "Bo");
    type("lobby-code", " k7mq2x ");
    click("Join");
    expect(h.onJoin).toHaveBeenCalledWith("Bo", "K7MQ2X");
  });

  it("explains a bad code next to the field and does not try to join", () => {
    const h = handlers();
    renderLobby(root, h);
    type("lobby-name", "Bo");
    type("lobby-code", "K7MQ0");
    click("Join");
    expect(h.onJoin).not.toHaveBeenCalled();
    expect(error()).toBe("Codes are 6 letters and numbers, like K7MQ2X.");
  });

  it("asks for a name before hosting or joining", () => {
    const h = handlers();
    renderLobby(root, h);
    click("Host");
    expect(h.onHost).not.toHaveBeenCalled();
    expect(error()).toBe("Enter a name first.");
  });

  it("shows the code and the crew with their roles to the host, with Start", () => {
    const h = handlers();
    const lobby = renderLobby(root, h);
    lobby.showHosting("K7MQ2X", 48213);
    lobby.showCrew([
      { name: "Ada", roles: ["pilot", "comms"], me: true },
      { name: "Bo", roles: ["engineer", "science"], me: false },
    ]);
    expect(root.textContent).toContain("K7MQ2X");
    expect(root.textContent).toContain("Ada (you): Pilot, Comms");
    expect(root.textContent).toContain("Bo: Engineer, Science");
    expect(root.textContent).toContain("Seed 48213");
    click("Start");
    expect(h.onStart).toHaveBeenCalled();
  });

  it("plays solo without hosting", () => {
    const h = handlers();
    renderLobby(root, h);
    type("lobby-name", "Ada");
    click("Play solo");
    expect(h.onSolo).toHaveBeenCalledWith("Ada");
    expect(h.onHost).not.toHaveBeenCalled();
  });

  it("takes focus off its buttons when it hides, so game keys reach the game", () => {
    const lobby = renderLobby(root, handlers());
    root.querySelector<HTMLButtonElement>("button")!.focus();
    lobby.hide();
    expect(root.contains(document.activeElement)).toBe(false);
  });

  it("marks the roles I hold and asks to take one I click", () => {
    const h = handlers();
    const lobby = renderLobby(root, h);
    lobby.showHosting("K7MQ2X", 1);
    lobby.showCrew([{ name: "Ada", roles: ["pilot", "comms"], me: true }]);
    const pilot = [...root.querySelectorAll("button")].find((b) => b.textContent === "Pilot")!;
    expect(pilot.getAttribute("aria-pressed")).toBe("true");
    click("Science");
    expect(h.onPickRole).toHaveBeenCalledWith("science");
  });

  it("lets the host pick the mission", () => {
    const h = handlers();
    const lobby = renderLobby(root, h);
    lobby.showHosting("K7MQ2X", 1);
    const select = root.querySelector<HTMLSelectElement>("#lobby-mission")!;
    select.value = "moon";
    select.dispatchEvent(new Event("change"));
    expect(h.onMission).toHaveBeenCalledWith("moon");
  });

  it("shows a joiner the crew and roles but no mission picker or Start", () => {
    const lobby = renderLobby(root, handlers());
    lobby.showJoined();
    lobby.showCrew([{ name: "Bo", roles: ["engineer"], me: true }]);
    expect(root.textContent).toContain("Bo (you): Engineer");
    expect(root.querySelector<HTMLElement>("#lobby-mission")!.closest("[hidden]")).not.toBeNull();
    expect([...root.querySelectorAll("button")].find((b) => b.textContent === "Start")!.closest("[hidden]")).not.toBeNull();
  });
});
