// seat 3's UI layer (S3-02, S3-03, S3-05 to S3-07): fonts, the overlay, the title behind the lobby, the HUD
import { loadFonts } from "./fonts";
import { startHud } from "./hud";
import { startOverlay } from "./overlay";
import { toggleMute } from "./sfx";
import { startTitle } from "./title";
// the kit first, so the HUD's rules build on it
import "./ui.css";
import "./hud.css";

if (typeof document !== "undefined" && typeof requestAnimationFrame !== "undefined") {
  void loadFonts();
  startOverlay();
  startTitle();
  startHud();
  // M mutes the UI sounds; never while typing a name or a join code
  window.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement | null;
    if (e.code !== "KeyM" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    toggleMute();
  });
}
