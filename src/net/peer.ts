import Peer, { type DataConnection } from "peerjs";
import { makeCode, peerId } from "./code";
import type { Conn } from "./session";

// signalling goes through the free public PeerJS server; pass options here to point at our own
const PEER_OPTIONS = { debug: 1 } as const;

function wrap(dc: DataConnection): Conn {
  return {
    send: (msg) => {
      if (!dc.open) return;
      try {
        dc.send(msg);
      } catch (e) {
        // a send that throws must not kill the host's frame loop; treat it as this peer dropping
        console.error("send failed, closing connection", e);
        dc.close();
      }
    },
    onData: (cb) => {
      dc.on("data", cb);
    },
    onClose: (cb) => {
      dc.on("close", cb);
      dc.on("error", cb);
    },
    close: () => dc.close({ flush: true }), // let a final "end" reason arrive before the close
  };
}

export interface Hosting {
  code: string;
  onConnection(cb: (conn: Conn) => void): void;
  close(): void;
}

const JOIN_TIMEOUT_MS = 15_000; // also bounds hosting

/** registers a fresh code with the signalling server, retrying if another game holds it */
export function host(attempts = 3): Promise<Hosting> {
  return new Promise((resolve, reject) => {
    const code = makeCode();
    const peer = new Peer(peerId(code), PEER_OPTIONS);
    let settled = false;
    // a signalling server that never answers would otherwise leave the lobby busy for good
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      peer.destroy();
      reject(new Error("The code server did not answer"));
    }, JOIN_TIMEOUT_MS);
    peer.on("open", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        code,
        onConnection: (cb) => peer.on("connection", (dc) => dc.on("open", () => cb(wrap(dc)))),
        close: () => peer.destroy(),
      });
    });
    // after open, errors belong to single connections, which report through their own close
    peer.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      peer.destroy();
      if (err.type === "unavailable-id" && attempts > 1) host(attempts - 1).then(resolve, reject);
      else reject(new Error(`Could not host: ${err.message}`));
    });
  });
}

export function join(code: string): Promise<{ conn: Conn; close(): void }> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(PEER_OPTIONS);
    let settled = false;
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      peer.destroy();
      reject(new Error(message));
    };
    // a strict NAT can leave the data channel never opening, with no error at all
    const timer = setTimeout(() => fail("Could not reach the host"), JOIN_TIMEOUT_MS);
    peer.on("open", () => {
      const dc = peer.connect(peerId(code), { reliable: true, serialization: "json" });
      dc.on("open", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ conn: wrap(dc), close: () => peer.destroy() });
      });
    });
    peer.on("error", (err) => {
      clearTimeout(timer);
      fail(err.type === "peer-unavailable" ? "No game with that code" : `Could not join: ${err.message}`);
    });
  });
}
