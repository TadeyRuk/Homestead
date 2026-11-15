// PeerJS 1.5 already uses Google's STUN server and its own TURN relays (eu-0 / us-0.turn.peerjs.com).
// If those can't get two players through their routers (S1-07), set VITE_ICE_SERVERS at build time to a
// JSON list of RTCIceServer entries, for example a TURN relay with a username and credential.

type IceServer = { urls: string | string[]; username?: string; credential?: string };

const isServer = (v: unknown): v is IceServer => {
  const s = v as IceServer;
  return !!s && (typeof s.urls === "string" || (Array.isArray(s.urls) && s.urls.every((u) => typeof u === "string")));
};

/** the configured ICE servers, or undefined to keep PeerJS's defaults */
export function iceServersFrom(raw: string | undefined): IceServer[] | undefined {
  if (!raw) return undefined;
  try {
    const list = JSON.parse(raw) as unknown;
    if (Array.isArray(list) && list.length > 0 && list.every(isServer)) return list;
  } catch {
    // reported below; a typo here must not break every connection
  }
  console.warn("VITE_ICE_SERVERS is not a JSON list of { urls, username?, credential? }; using PeerJS's servers");
  return undefined;
}
