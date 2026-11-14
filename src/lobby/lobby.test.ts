// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderLobby } from "./lobby";

let root: HTMLElement;
const handlers = () => ({ onHost: vi.fn(), onJoin: vi.fn(), onStart: vi.fn(), onSolo: vi.fn() });
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

  it("shows the code and the crew to the host, with Start", () => {
    const h = handlers();
    const lobby = renderLobby(root, h);
    lobby.showHosting("K7MQ2X");
    lobby.showCrew(["Ada", "Bo"]);
    expect(root.textContent).toContain("K7MQ2X");
    expect(root.textContent).toContain("Ada, Bo");
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
});
