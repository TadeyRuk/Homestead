# Seat 5: Engineer and Science

**Owner:** open (add your GitHub login here and in `docs/team/README.md` when you take it)
**Folders:** `src/flight/engineer/`, `src/flight/science/`

Four small minigames, two per role. They plug into seat 4's flight shell and are the most independent work in the project, so a late joiner can pick this up cold.

## Needs from others

- Seat 1: `GameState`, input map (S1-01, S1-06).
- Seat 3: part power and heat numbers in `src/data/parts.json` (S3-01).
- Seat 4: the flight shell's station interface (S4-01). Until it lands, build each minigame as a standalone scene.

## If still open at hour 3

Seat 6 (acmrsu) takes S5-02. Seat 1 takes S5-05. S5-03 and S5-04 are cut. See the fallback table in `docs/team/README.md`.

## Issues

### S5-01 Station stubs (hour 1.5)
Engineer and Science station scenes that seat 4's shell can host, each with a placeholder screen.
**Done when:** both stations show up when Tab-switching in flight.

### S5-02 Engineer: power bus (hour 6)
Total load against supply. Switch loads off before the breaker trips. Switching off the engine needs the pilot to agree, and switching off the antenna drops the comms link. The power part sets how close to the limit the bus runs. Logs `breaker_tripped`, `load_shed`.
**Done when:** a small solar array trips the breaker much more often than an RTG.

### S5-03 Engineer: hull weld (hour 8, cut item 2)
A hull breach opens a welding job: trace the crack while cabin pressure falls. Time off the line wastes sealant. Logs `breach_sealed`.
**Done when:** a `hull_breach` from the pilot opens a weld, and tracing it restores the hull.

### S5-04 Science: energy core (hour 6, cut item 2)
Keep the core in its safe band with a coolant valve. Too hot damages the instrument, too cold drops power. A radar sounder heats much faster than a camera. Logs `core_overheated`, `core_too_cold`.
**Done when:** an overheated core lowers `instrumentHealth`, which seat 2's surface scans read (S2-14).

### S5-05 Science: oxygen converter (hour 6)
Flick items from a tray into the intake: ice and CO2 cartridges help, food waste helps a little, a wrench jams it. Keeps cabin oxygen up. Logs `oxygen_low`, `converter_jammed`.
**Done when:** cabin oxygen falls unless the player feeds the right items.
