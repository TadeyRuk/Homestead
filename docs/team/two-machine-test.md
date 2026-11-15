# Two-machine test (S1-07)

Proves online play works between two real computers on different networks, not just two tabs on one machine. Two people, about 15 minutes. Do it before hour 8: if it fails then, the cut list says submit solo.

## Setup

- Two computers on **different internet connections** (one at home, one on phone hotspot or campus Wi-Fi). Same Wi-Fi proves less.
- Both run the same `main`: `git pull`, `npm install`.
- Both use a desktop browser (Chrome, Edge, Brave or Firefox), with the game window visible, not covered by another window.

## Steps

1. **Host:** `npm run dev`, open the link, type a name, click **Host**. Read out the 6-character code.
2. **Joiner:** `npm run dev`, open the link, type a name and the code, click **Join**.
   - Pass: both lobbies list both names with their roles.
3. **Host:** click **Start**.
   - Pass: both screens leave the lobby and show the brief, with the same countdown.
4. **Both:** walk around on the campus for a minute.
   - Pass: each sees the other move smoothly, and their own player responds instantly.
5. **Joiner:** press E at the launch pad, then let the 5 s countdown run.
   - Pass: both see the countdown and both move on together.
6. **Joiner:** close the tab.
   - Pass: within 10 s the host is back in the lobby with "<name> left. The run has ended."
7. Repeat once with the roles swapped (the other person hosts).

## What to report

In issue #8, write for each step: pass or fail, both networks (home Wi-Fi, hotspot, campus), and both browsers. On a failure, copy any red lines from the browser console (F12, Console tab) on both machines.

## If Join fails or hangs

- **"No game with that code":** the code was mistyped, or the host's tab closed. Host again.
- **"Could not reach the host" after 15 s:** the two routers couldn't connect, even through PeerJS's built-in relays. Set a different TURN relay:
  1. Get TURN credentials (any TURN provider, or a self-hosted coturn).
  2. Copy `.env.example` to `.env` and fill in `VITE_ICE_SERVERS`.
  3. Rebuild with `npm run dev`, or `npm run package` for itch.io.
  4. Repeat the test.
- **Joins, then drops after about 10 s:** the host's window was hidden or covered, which slows its timers. Keep it visible and repeat.
