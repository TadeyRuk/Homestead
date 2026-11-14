# Seat 2: Ground and maps

**Owner:** polsalarm
**Folders:** `src/ground/`

You build the top-down layer that phase 1 (campus) and phase 3 (surface) both run on. Seat 3 puts parts and objectives on top of it.

## Needs from others

- Seat 1: `GameState`, input map, timers (S1-01, S1-06).
- Seat 3: part spawn points come from the seed, but which part goes where is seat 3's call. Agree a `spawnPoints` list on the campus map with them.

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
As big as the campus. Lander in the middle, rich sites far, poor sites close, crater rim, ridge. Moon and Mars variants can share a layout with different palettes.
**Done when:** the surface phase loads the map for the current mission with sites and the lander placed.

### S2-06 Suit drain and recharge (hour 8)
Suit oxygen and power drain slowly everywhere and fast in a hazard, and recharge at the lander at a rate from the power part. At zero the player is down until extraction and drops what they carry. Logs `player_down`.
**Done when:** a player who stays out too long goes down, and one who returns to the lander recharges.

### S2-07 Hazards (hour 8, cut item 4)
Moon solar flare: warning, then radiation on open ground, safe at the lander or behind rock. Mars dust storm: a wall crossing the map that cuts sight and drains suits. Logs `hazard_hit`.
**Done when:** each mission's hazard fires on the seeded schedule and hurts players in the open.

### S2-08 Extraction (hour 8)
The surface timer ends with the extraction ship. Logs `extraction` with who is standing and what is still carried, then switches to the report.
**Done when:** the run ends on time whether the list is finished or not.

## Fallback load (if seat 4 is still open at hour 3)

- Pilot minigame (S4-02, S4-03)
