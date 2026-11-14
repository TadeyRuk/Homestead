# Seat 1: Core and network

**Owner:** Seedlign
**Folders:** `src/core/`, `src/net/`, `src/lobby/`, `src/build/spawns.ts`, `src/build/launch.ts`, plus `package.json`, `vite.config.ts`, `tsconfig.json`
**Also:** merges every PR into `main`, every one to two hours

Everyone else waits on S1-01, so it lands first and nobody branches before it.

## Needs from others

- Seat 3: `src/data/parts.json` and `missions.json` shapes by hour 1.5, so the state can hold part ids.
- Seat 3: the lobby screens (S3-03) that call your host and join functions.

## Issues

### S1-01 Contract in code (hour 1.5)
`src/core/state.ts`, `events.ts`, `rng.ts` with the shape and event kinds from `docs/team/README.md`. A seeded RNG that gives the same sequence for the same seed.
**Done when:** every seat can import `GameState`, `EventKind` and `rng` and the build passes.

### S1-02 Game loop and phase switching (hour 1.5)
One `requestAnimationFrame` loop, a scene interface (`enter`, `update(dt)`, `draw(ctx)`, `exit`), and a switch that moves brief, campus, flight, surface, report on timer or on event.
**Done when:** a stub scene per phase shows its name and the run steps through all six phases on timers.

### S1-03 Host and join by code (hour 1.5)
PeerJS in `src/net/`. Host gets a six-character code as its peer id. Joiners type it and connect over a WebRTC data channel.
**Done when:** two browser tabs join by code and see each other's square move.

### S1-04 Host-authoritative sync (hour 6)
Clients send inputs only. The host applies them, then broadcasts state snapshots several times a second. Clients draw from the latest snapshot.
**Done when:** two tabs agree on positions, timers and mounted parts through a full run.

### S1-05 Lobby and role logic (hour 6)
The functions seat 3's lobby screens call: host, join, set name, pick role, pick mission. Solo gets all four roles. Two or three players split roles. Host picks mission or random and sets the seed.
**Done when:** one to four players can start a run with roles assigned, driven from seat 3's screens.

### S1-06 Input map and shared timers (hour 6)
WASD or arrows to move, E to pick up or mount, Q for the panel, Tab to switch station. A timer helper every phase uses for its countdown.
**Done when:** seats 2 to 5 read input and timers from `src/core/` and not from `window` directly.

### S1-07 Online run on two machines (hour 8)
Test across two real machines on different networks. If WebRTC fails behind a strict NAT, document a fallback (a TURN server from a free tier, or play on the same network).
**Done when:** two players on two machines finish a run, or the cut to solo is called at hour 8.

### S1-08 Merges and itch.io build (ongoing, hour 10.5)
Merge PRs every one to two hours, play after each merge. Make sure `npm run build` output runs from a zipped `dist/` on itch.io.
**Done when:** the uploaded itch.io build runs a full solo run in a fresh browser.

### S1-09 Seeded part spawns (hour 6)
Lives in `src/build/spawns.ts`, on seat 2's spawn points. Use the seed to place parts on the campus spawn points, so every run differs and the same seed gives the same campus.
**Done when:** two tabs on the same seed see identical spawns, and a new seed changes them.

### S1-10 Countdown, salvage, launch (hour 6)
Lives in `src/build/launch.ts`, reading seat 2's pad slots (S2-10). Anyone at the pad starts a five-second countdown, anyone can cancel. When the build timer runs out, empty slots get a weak salvage part. Launch is never blocked: too heavy lifts off and fails. Logs `launch_started`, `launch_cancelled`, `salvage_filled`, `launch_failed`.
**Done when:** a run can launch early, on timeout with salvage, and fail when overweight.

## Fallback load (if seat 4 is still open at hour 3)

- Comms dish minigame (S4-04, S4-05)
- Event director, arrival and solo pacing (S4-06, S4-09, S4-10). The flight shell (S4-01) is already done.
