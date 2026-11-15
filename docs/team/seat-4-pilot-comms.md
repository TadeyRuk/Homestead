# Seat 4: Pilot and Comms

**Owner:** open (add your GitHub login here and in `docs/team/README.md` when you take it)
**Folders:** `src/flight/pilot/`, `src/flight/comms/`, `src/flight/events/`

Two of the four flight stations, plus flight events. The flight shell (S4-01) is done and seat 1's: register your stations with `registerStation` (see `docs/team/README.md`). Each station's difficulty comes from the parts mounted on the campus.

## Needs from others

- Seat 1: `GameState`, phase switching, input map (S1-01, S1-02, S1-06).
- Seat 3: part stats through `partInfo()` in `src/core/catalog.ts` (seat 3 fills it from `src/data/`), and the crew strip (S3-07) that shows your stations' trouble.

## If still open at hour 3

Seat 3 (TadeyRuk) takes S4-02 and S4-03. Seat 1 has done S4-04, S4-05, S4-06, S4-08, S4-09 and S4-10. S4-07 is next. See the fallback table in `docs/team/README.md`.

## Issues

### S4-01 Flight shell and station switching (done by seat 1, #33)
Shipped in `src/flight/`. Transit length is still the fixed 180 s; tying it to the engine and destination waits on seat 3's data.

### S4-02 Pilot: steering and debris (hour 6)
The ship from outside, steering through debris. Engine and total mass decide handling: a solid motor steers in pulses, chemical is responsive, ion is slow. Hits damage the hull by section. Logs `debris_hit`, `hull_breach`.
**Done when:** the pilot can steer, and debris hits lower the hull.

### S4-03 Pilot: speed, fuel, hull (hour 8)
Keep speed near the transfer target without wasting fuel. Heavier ships burn more. Zero hull or zero fuel ends the run. Logs `fuel_low`.
**Done when:** fuel and hull run down and can end the run.

### S4-04 Comms: dish balancing (done by seat 1: `src/flight/comms/`)
The dish on a pivot drifts every time the pilot turns. The player leans it back to keep Earth in the beam. Low-gain barely drifts, the high-gain dish drifts on turns, the laser is hardest. Logs `link_lost`, `link_locked`.
**Done when:** pilot turns push the dish off and the player can hold it on target.

### S4-05 Comms: link effects (done by seat 1: `debrisWarnings` and `linkRate` in `src/flight/comms/link.ts`)
A steady lock doubles the send rate and gives the pilot early debris warning.
**Done when:** debris warnings show for the pilot only while the link holds.

### S4-06 Event director (done by seat 1: `src/flight/events/director.ts`)
Seeded flight events: debris fields, solar flares hitting solar arrays, load spikes. More events on Mars than the Moon, fewer in solo.
**Done when:** the same seed gives the same events, and Mars has more of them.

### S4-07 Part effects in flight (hour 8)
Mounted parts change the flight beyond handling: a large solar array is a bigger debris target, solar flares from the event director cut solar array output, an RTG ignores flares. Read every number from `src/data/parts.json`.
**Done when:** the same debris field hits a large-array ship more often than a small-array one, and a flare drops supply only on solar builds.

### S4-08 Engine-off handshake (done by seat 1: `src/flight/handshake.register.ts`; live once seat 5 stores the bus in `state.flight.bus`)
When the Engineer tries to switch off the engine on the power bus (S5-02), the Pilot gets a prompt to agree or refuse. Refusing keeps the load on. Solo players see the prompt on their next Pilot visit.
**Done when:** the engine only sheds after the Pilot agrees, in both two-player and solo runs.

### S4-09 Arrival and landing (done by seat 1: `src/flight/flight.register.ts`)
When transit ends, record fuel and hull on arrival for the score, play a short landing, and hand off to the surface phase. A ship that runs out of fuel or hull before arrival ends the run here instead.
**Done when:** every run that survives the flight lands on the surface with arrival fuel and hull in `GameState`.

### S4-10 Solo pacing and two-role crews (done by seat 1: `stationPace` in `src/flight/stations.ts`; Tab already cycles only a player's own roles)
Solo players hold all four stations, so events come more slowly and stations not on screen drift more gently. With two or three players, anyone holding two roles switches between just their own stations. Most judges will play solo, so this is what they see.
**Done when:** a solo player can survive a Mars flight by switching stations, and a two-player run only cycles each player's own stations.
