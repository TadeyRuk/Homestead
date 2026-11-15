import { findPart } from "../core/catalog";
import { nearest } from "../core/map";
import type { GameState, Player } from "../core/state";
import { partName } from "../data/data";
import { KIOSK_PRICE } from "../build/kiosk";
import { slotOf } from "../build/pad";
import { jobHere } from "../missions/objectives";
import { missionList } from "../missions/stats";
import { atKiosk, atPad, PICK_REACH } from "./carry";

type ReadState = Pick<GameState, "phase" | "parts" | "launchAt" | "credits" | "mission" | "surface" | "objectives">;

const named = (id: string) => {
  const mass = findPart(id)?.mass;
  return mass === undefined ? partName(id) : `${partName(id)} ${mass} kg`;
};

const JOB_WORDS = { scan: "scan this site", drill: "drill the sample", deploy: "deploy", photo: "take the bonus photo" } as const;

/**
 * What E does for this player where they stand right now, for seat 3's HUD prompt (S2-15):
 * "[E] pick up Solid motor 180 kg", "[E] mount RTG", "[E] buy a part, 20 credits", or null when
 * E does nothing here. It follows the same order the host rules use, so the prompt never lies:
 * surface jobs first, then the pad, then the kiosk (a part lying there is picked up before buying),
 * then picking up and dropping.
 */
export function ePrompt(state: ReadState, p: Player): string | null {
  if (p.down) return null;
  const s = state as GameState;
  if (state.phase === "surface") {
    const running = state.surface.tasks[p.id];
    if (running) return null; // the task ring already says what is happening
    const job = jobHere(s, p);
    if (job) {
      const words = job.kind === "deploy" ? `deploy the ${partName(missionList(state.mission).instrument)}` : JOB_WORDS[job.kind];
      return `[E] ${words}`;
    }
  } else if (state.phase === "campus") {
    if (atPad(s, p)) {
      if (p.carrying) return slotOf(p.carrying) ? `[E] mount ${partName(p.carrying)}` : null;
      return state.launchAt === null ? "[E] start the launch countdown" : "[E] stop the countdown";
    }
    if (atKiosk(s, p) && !nearest(state.parts, p, PICK_REACH)) {
      return state.credits >= KIOSK_PRICE ? `[E] buy a part, ${KIOSK_PRICE} credits` : `Kiosk: ${KIOSK_PRICE} credits a part, not enough left`;
    }
  } else {
    return null;
  }
  const piece = nearest(state.parts, p, PICK_REACH);
  if (piece) return p.carrying ? `[E] swap for ${named(piece.part)}` : `[E] pick up ${named(piece.part)}`;
  if (p.carrying) return `[E] put down ${partName(p.carrying)}`;
  return null;
}
