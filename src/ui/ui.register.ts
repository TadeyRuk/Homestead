// seat 3's UI layer (S3-02, S3-03): fonts, the overlay over the canvas, the title behind the lobby
import { loadFonts } from "./fonts";
import { startOverlay } from "./overlay";
import { toggleMute } from "./sfx";
import { startTitle } from "./title";
import "./ui.css";

if (typeof document !== "undefined" && typeof requestAnimationFrame !== "undefined") {
  void loadFonts();
  startOverlay();
  startTitle();
  // M mutes the UI sounds; never while typing a name or a join code
  window.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement | null;
    if (e.code !== "KeyM" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    toggleMute();
  });
}
