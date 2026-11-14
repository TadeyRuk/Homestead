# Seat 2: Ground, maps and build logic

**Owner:** polsalarm
**Folders:** `src/ground/`, `src/build/`, `src/missions/`

You build the top-down layer that phase 1 (campus) and phase 3 (surface) run on, plus the game rules that happen on it: spawns, the pad, the meters' math, launch, the kiosk and surface objectives. Seat 3 draws the screens for all of it from `GameState`, so this seat writes no HTML panels.

This is the biggest seat. If it falls behind, drop hazards (S2-07) first, then the kiosk (S2-13).

## Needs from others

- Seat 1: `GameState`, input map, timers (S1-01, S1-06).
- Seat 3: `src/data/parts.json` and `missions.json` (S3-01). Read every part number from there.
- Seat 3: the screens that show your state (pad meters, mission panel). Agree the `GameState` fields with them early.

## Issues

### S2-01 Top-down player (hour 1.5)
A player that moves with the input map, collides with walls, and is small against the map. Uses `GameState.players`.
**Done when:** your player walks around a test room in both tabs with S1-03.

### S2-02 Per-player camera (hour 6)
Each screen follows only its own player and shows about a tenth of the map. Arrows at the screen edge point back to the launch pad (campus) or the lander (surface).
**Done when:** two players on one map each see their own area, with a pad arrow.

### S2-03 Carrying (hour 6)
Carry one part at a time. E picks up, picking up a second part drops the first beside you. Logs `part_picked` and `part_dropped`.
**Done when:** parts can be carried across the map and dropped, and the log has the events.

### S2-04 Campus map (hour 6)
Several screens wide: launch pad, hangar yard, tracking station, kiosk, plus about a dozen spawn points. Placeholder shapes.
**Done when:** the map loads in the campus phase with the pad, kiosk and spawn points placed.

### S2-05 Surface map (hour 6)
As big as the campus. Lander in the middle, rich sites far, poor sites close, crater rim, ridge. Moon and Mars can share a layout with different palettes.
**Done when:** the surface phase loads the map for the current mission with sites and the lander placed.

### S2-06 Suit drain and recharge (hour 8)
Suit oxygen and power drain slowly everywhere and fast in a hazard, and recharge at the lander at a rate from the power part. At zero the player is down until extraction and drops what they carry. Logs `player_down`.
**Done when:** a player who stays out too long goes down, and one who returns to the lander recharges.

### S2-07 Hazards (hour 8, cut first)
Moon solar flare: warning, then radiation on open ground, safe at the lander or behind rock. Mars dust storm: a wall crossing the map that cuts sight and drains suits. Logs `hazard_hit`.
**Done when:** each mission's hazard fires on the seeded schedule and hurts players in the open.

### S2-08 Extraction (hour 8)
The surface timer ends with the extraction ship. Logs `extraction` with who is standing and what is still carried, then switches to the report.
**Done when:** the run ends on time whether the list is finished or not.

### S2-09 Seeded part spawns (hour 6)
Use the seed to place parts on the campus spawn points, so every run differs and the same seed gives the same campus.
**Done when:** two tabs on the same seed see identical spawns, and a new seed changes them.

### S2-10 Pad slots and swapping (hour 6)
Four slots at the pad: propulsion, power, comms, payload. Mounting into a full slot swaps the old part out beside the pad. Logs `part_mounted` and `part_swapped`.
**Done when:** a part carried to the pad mounts, and a second one swaps.

### S2-11 Meter math (hour 6)
Compute the six meters from the mounted parts: mass against engine lift, power supply against draw, budget, data per reading, comms rate, time. Write them to `GameState` for seat 3 to draw.
**Done when:** mounting or swapping a part changes the computed values.

### S2-12 Countdown, salvage, launch (hour 6)
Anyone at the pad starts a five-second countdown, anyone can cancel. When the build timer runs out, empty slots get a weak salvage part. Launch is never blocked: too heavy lifts off and fails. Logs `launch_started`, `launch_cancelled`, `salvage_filled`, `launch_failed`.
**Done when:** a run can launch early, on timeout with salvage, and fail when overweight.

### S2-13 Kiosk (hour 8, cut list item 1)
Pay 20 credits for one seeded random part, which appears at the kiosk. Logs `kiosk_bought`.
**Done when:** buying deducts credits and spawns a part at the kiosk.

### S2-14 Surface objective rules (hour 8)
Mission Control's list per mission from `missions.json`: scans at rich sites, a sample carried to the lander, a deployed instrument, an uplink target, a bonus. Scan time and data from the payload and `instrumentHealth`. Uplink rate from the antenna. Data and samples count only once they reach the lander. Logs `site_scanned`, `sample_collected`, `data_uplinked`, `objective_done`.
**Done when:** each objective can be completed on the surface and flips its flag in `GameState.objectives`.
