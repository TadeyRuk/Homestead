# Seat 3: Build, missions, report

**Owner:** TadeyRuk
**Folders:** `src/build/`, `src/missions/`, `src/report/`, `src/data/`

The part the judges score: the campus build, the six meters and the report. None of it is ever cut.

## Needs from others

- Seat 1: `GameState`, event kinds, seeded RNG (S1-01).
- Seat 2: campus map with spawn points and the pad (S2-04), carrying (S2-03), surface map with sites (S2-05).
- Seat 6: the NASA links that back each part and each report line.

## Issues

### S3-01 Parts and mission data (hour 1.5)
`src/data/parts.json` with the twelve parts from proposal section 04: slot, mass, power, flight and surface effects, the real hardware it is based on. `missions.json` for Moon and Mars: transit, radio delay, credits, data target, objectives, hazard.
**Done when:** seat 1 and seats 4 and 5 can read part stats from the data file.

### S3-02 Seeded part spawns (hour 6)
Use the seed to place parts on seat 2's spawn points, so every run differs and the same seed gives the same campus.
**Done when:** two tabs on the same seed see identical spawns, and a new seed changes them.

### S3-03 Pad, slots and swapping (hour 6)
Four slots at the pad. Mounting into a full slot swaps the old part out beside the pad. Logs `part_mounted` and `part_swapped`.
**Done when:** a part carried to the pad mounts, and a second one swaps.

### S3-04 Six meters (hour 6)
Mass against engine lift, power supply against draw, budget, data per reading, comms rate, time. Shown at the pad and updated live as parts mount.
**Done when:** all six meters change when a part is mounted or swapped.

### S3-05 Countdown, salvage, launch (hour 6)
Anyone at the pad starts a five-second countdown, anyone can cancel. When the build timer runs out, empty slots get a weak salvage part. Launch is never blocked: too heavy lifts off and fails. Logs `launch_started`, `launch_cancelled`, `salvage_filled`, `launch_failed`.
**Done when:** a run can launch early, on timeout with salvage, and fail when overweight.

### S3-06 Kiosk (hour 8, cut item 1)
Pay 20 credits for one seeded random part. Logs `kiosk_bought`.
**Done when:** buying deducts credits and spawns a part at the kiosk.

### S3-07 Surface objectives and mission panel (hour 8)
Mission Control's list per mission: scans at rich sites, a sample carried to the lander, a deployed instrument, an uplink target, a bonus. Scan time and data from the payload and `instrumentHealth`. Uplink rate from the antenna. Q flips the panel between the list and the suit readout.
**Done when:** each objective can be completed on the surface and ticks off in the panel.

### S3-08 Mission report and score (hour 8)
Read the event log, find the biggest loss, and walk it back to the part and the choice that caused it, in plain words. End with the real mission that made the same trade. Score: data uplinked against target first, then crew standing, unspent credits, build time left, fuel and hull on arrival.
**Done when:** a finished run shows a report that names the part behind the biggest loss, plus a score.

## Fallback load (if seat 5 is still open at hour 3)

- Engineer power bus (S5-02)
