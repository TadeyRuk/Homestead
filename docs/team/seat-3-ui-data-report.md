# Seat 3: UI, data and report

**Owner:** TadeyRuk
**Folders:** `src/ui/`, `src/data/`, `src/report/`, `src/build/meters.ts`

Every HTML/CSS screen and the HUD, the part and mission data everyone reads, and the mission report. Screens draw from `GameState` only. The game rules behind them belong to the seat that owns the state: seat 1 for network and lobby, seat 2 for the build and objectives, seats 4 and 5 for flight.

## Needs from others

- Seat 1: `GameState`, event kinds, phase switching (S1-01, S1-02), and the host and join calls behind the lobby (S1-03, S1-05).
- Seat 2: mounted parts from the pad (S2-10) and objective flags (S2-14) in `GameState`.
- Seats 4 and 5: each station's trouble state for the crew strip.
- Seat 6: the NASA links behind each part and each report line.

## Issues

### S3-01 Parts and mission data (hour 1.5)
`src/data/parts.json` with the twelve parts from proposal section 04: slot, mass, power, flight and surface effects, the real hardware it is based on. `missions.json` for Moon and Mars: transit, radio delay, credits, data target, objectives, hazard.
Register each mission's starting credits and data target with `registerMissionInfo` from `src/core/missions.ts`, so `startRun` hands them to the crew.
**Done when:** seats 2, 4 and 5 read part stats from the data file, and a run starts with your mission's credits.

### S3-02 UI kit (hour 1.5)
An HTML overlay above the canvas in `src/ui/`, with colour and type tokens, and panel, meter bar and button components.
**Done when:** a screen can mount a panel without writing new CSS.

### S3-03 Lobby screens (hour 6)
Host, join, code display, name entry, role pick, mission pick and seed display. Calls seat 1's network functions.
**Done when:** one to four players reach a run through the screens.

### S3-04 Brief card (hour 6)
The mission card from Mission Control at the start of each run: destination, objectives, data target, credits.
**Done when:** the brief phase shows the seeded mission.

### S3-05 Pad meters (hour 6)
The six meters at the pad, drawn from the values seat 2 writes to `GameState`, with a warning when mass is over the engine's lift.
**Done when:** the meters redraw when a part mounts or swaps.

### S3-06 Mission and suit panel (hour 8)
Objective list and suit readout in one panel. Q flips between them, so the screen never shows both at once.
**Done when:** objective ticks and suit levels update live on the surface.

### S3-07 HUD and crew strip (hour 8)
Phase timers, the carried part, and the crew strip in flight showing what each station is dealing with.
**Done when:** every phase shows its timer, and the crew strip shows each station's trouble.

### S3-08 Report logic and score (hour 8)
Read the event log, find the biggest loss, and walk it back to the part and the choice that caused it, in plain words. End with the real mission that made the same trade. Score: data uplinked against target first, then crew standing, unspent credits, build time left, fuel and hull on arrival.
**Done when:** a finished run produces a report that names the part behind the biggest loss, plus a score.

### S3-09 Report screen (hour 8)
Draws the report and score from S3-08.
**Done when:** every run ends on a readable report screen.

### S3-10 Meter math (hour 6)
Compute the six meters from the mounted parts: mass against engine lift, power supply against draw, budget, data per reading, comms rate, time. Write them to `GameState`, then draw them in S3-05. Lives in `src/build/meters.ts`.
**Done when:** mounting or swapping a part changes the computed values.

## Fallback load (if seat 4 is still open at hour 3)

- Pilot minigame (S4-02, S4-03)
