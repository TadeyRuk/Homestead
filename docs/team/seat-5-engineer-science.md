# Seat 5: Engineer and Science

**Owner:** Emyol
**Folders:** `src/flight/engineer/`, `src/flight/science/`

Four small minigames, two per role. They plug into seat 4's flight shell and are the most independent work in the project, so a late joiner can pick this up cold.

## Needs from others

- Seat 1: `GameState`, input map (S1-01, S1-06).
- Seat 3: part power and heat numbers in `src/data/parts.json` (S3-01).
- Seat 4: the flight shell's station interface (S4-01). Until it lands, build each minigame as a standalone scene.

## Where to start

S5-09 (station sandbox) first: it loads one station on its own, so nothing waits on seat 4's flight shell. Then S5-01, S5-02, S5-05 and S5-06 (hour 6).

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

### S5-06 Part-driven numbers (hour 6)
Bus supply from the power part and draw from every mounted part, core heat per payload and from an RTG, all read from `src/data/parts.json`. No part numbers in station code.
**Done when:** swapping a part on the campus changes the bus margin and the core heat rate in flight.

### S5-07 Core and power coupling (hour 8, cut item 2)
The two Engineer and Science systems affect each other: a core run too cold lowers bus supply, an RTG adds heat to the core, shedding the payload on the bus slows core heating.
**Done when:** letting the core go cold trips the breaker sooner, and an RTG build runs the core hotter than a solar build.

### S5-08 Cabin oxygen failure (hour 8)
A low cabin oxygen warning reaches the crew strip. At zero the crew is lost and the run ends, logged as `oxygen_low` with the cause.
**Done when:** ignoring the converter ends the run, and the report can name it.

### S5-09 Station sandbox (hour 6)
A debug URL such as `?station=engineer&parts=ion,rtg,lowgain,radar` that loads one flight station on its own with chosen parts. For building the minigames before the flight shell lands, and for seat 6's balance runs. Works for all four stations.
**Done when:** each station opens on its own from the URL with the parts given.

### S5-10 Station trouble states (hour 8)
Each Engineer and Science station writes its current trouble to `GameState` for seat 3's crew strip (S3-07), and every event it logs names the part that caused it, so the report (S3-08) can trace it.
**Done when:** the crew strip shows a tripping breaker or hot core, and each logged event carries a `part`.
