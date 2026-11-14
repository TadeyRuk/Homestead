# Seat 4: Pilot and Comms

**Owner:** open (add your GitHub login here and in `docs/team/README.md` when you take it)
**Folders:** `src/flight/` (the shell), `src/flight/pilot/`, `src/flight/comms/`, `src/flight/events/`

The flight phase shell and two of its four stations. Each station's difficulty comes from the parts mounted on the campus.

## Needs from others

- Seat 1: `GameState`, phase switching, input map (S1-01, S1-02, S1-06).
- Seat 3: part stats in `src/data/parts.json` (S3-01).
- Seat 5: their stations plug into your shell.

## If still open at hour 3

Seat 2 takes S4-02 and S4-03. Seat 1 takes S4-01, S4-04, S4-05 and S4-06. See the fallback table in `docs/team/README.md`.

## Issues

### S4-01 Flight shell and station switching (hour 6)
The flight scene that hosts four stations. Each player sees the station for their role. Anyone holding more than one role switches with Tab. A crew strip shows what the others are dealing with. Transit length from the engine and the destination.
**Done when:** a solo player can Tab through four stub stations, and the phase ends when transit ends.

### S4-02 Pilot: steering and debris (hour 6)
The ship from outside, steering through debris. Engine and total mass decide handling: a solid motor steers in pulses, chemical is responsive, ion is slow. Hits damage the hull by section. Logs `debris_hit`, `hull_breach`.
**Done when:** the pilot can steer, and debris hits lower the hull.

### S4-03 Pilot: speed, fuel, hull (hour 8)
Keep speed near the transfer target without wasting fuel. Heavier ships burn more. Zero hull or zero fuel ends the run. Logs `fuel_low`.
**Done when:** fuel and hull run down and can end the run.

### S4-04 Comms: dish balancing (hour 6)
The dish on a pivot drifts every time the pilot turns. The player leans it back to keep Earth in the beam. Low-gain barely drifts, the high-gain dish drifts on turns, the laser is hardest. Logs `link_lost`, `link_locked`.
**Done when:** pilot turns push the dish off and the player can hold it on target.

### S4-05 Comms: link effects (hour 8)
A steady lock doubles the send rate and gives the pilot early debris warning.
**Done when:** debris warnings show for the pilot only while the link holds.

### S4-06 Event director (hour 8)
Seeded flight events: debris fields, solar flares hitting solar arrays, load spikes. More events on Mars than the Moon, fewer in solo.
**Done when:** the same seed gives the same events, and Mars has more of them.
