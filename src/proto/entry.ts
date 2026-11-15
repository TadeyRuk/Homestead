import { normalizeCode } from "../net/code";
import { host as hostPeer, join as joinPeer } from "../net/peer";
import { createRoomClient, createRoomHost, type Profile } from "../net/room";

/**
 * The prototype is plain classic scripts with no build step, so this file is bundled on its own
 * (vite.proto.config.ts) into prototype/js/net.js, which sets window.HSNet. Without that file the
 * prototype still plays solo.
 */
export async function host(me: Profile, onEnd: (reason: string) => void) {
  const hosting = await hostPeer();
  const room = createRoomHost(me, (reason) => {
    hosting.close();
    onEnd(reason);
  });
  hosting.onConnection((conn) => room.addConnection(conn));
  return { code: hosting.code, room };
}

export async function join(
  typed: string,
  me: Profile,
  onEnd: (reason: string) => void,
  onSnapshot: (data: unknown, hostNow: number) => void,
) {
  const code = normalizeCode(typed);
  if (!code) throw new Error("Codes are six letters and numbers");
  const { conn, close } = await joinPeer(code);
  const client = createRoomClient(conn, me, (reason) => {
    close();
    onEnd(reason);
  }, undefined, onSnapshot);
  return client;
}

export { normalizeCode };
