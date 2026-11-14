# Homestead

**Finish the Mission Given by Mission Control So We Can Go Home to Our Families.**

A co-op space-mission game for the NASA Space Apps Challenge 2026
([Space Mission Design Game](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/)).

Mission Control hands four astronauts a job on the Moon or Mars, and no rocket. They have three
minutes to scavenge parts across a launch campus and bolt a spacecraft together. Then they fly
whatever they built, each person working their own station, and land to do the job. When the clock
runs out a ship from Earth picks them up, finished or not, and a mission report explains which
design choice made the run go the way it did.

One run takes about ten minutes. It plays solo or with up to four people online.

## The three phases

1. **Explore and build** (up to 3 min). Search the campus for rocket parts or gamble credits at the
   kiosk. Four slots: propulsion, power, comms, payload. Every part changes mass, power, budget,
   data, comms and time.
2. **Travel and maintain** (about 3 min). Each role plays its own minigame, and the mounted parts
   set the difficulty.
   - Pilot: steer through debris, manage fuel and hull.
   - Rocket Engineer: power bus and hull welding.
   - Comms Engineer: keep the dish pointed at Earth.
   - Science Officer: energy core temperature and oxygen converter.
3. **Sortie and homestead** (3 min). Split up on the surface and work through Mission Control's list
   before extraction. Solar flares (Moon) and dust storms (Mars) punish anyone who strays.

Then a one-minute **mission report** traces the biggest loss back to a design choice and names the
real mission that made the same trade-off.

## Tech

Browser game, no install. Plays on itch.io.

| Part | Choice |
| --- | --- |
| Rendering | HTML5 Canvas 2D |
| Language | TypeScript |
| Dev server and build | Vite |
| UI (menus, meters, report) | HTML and CSS over the canvas |
| Audio | Web Audio API |
| Online play | WebRTC data channels via PeerJS, host-authoritative |
| Publishing | itch.io (HTML5 upload of `dist/`) |

- Top-down pixel art.
- One player hosts, others join with a six-character code. No server of our own.
- Seeded runs: one seed decides the mission, part spawns and events.

## Run it

Needs Node 22.

```sh
npm install
npm run dev      # local dev server
npm run build    # typecheck and build to dist/
npm run preview  # serve the built dist/
```

To publish, zip the contents of `dist/` and upload it to itch.io as an HTML5 game.

## Status

Scaffold only: a canvas with one square that moves with WASD.

## Rules checklist (Space Apps 2026)

- Demo video of 30 seconds or less (or at most 7 slides), English, public link with no login.
- At least one NASA data source, listed on the project page.
- AI-made images and video are watermarked; AI use is documented in this README.
- No NASA logos, flags or mission patches in any art.
- Every outside resource (fonts, sounds) is listed with its licence.
- Submit before 11:59 PM local time on 15 Nov 2026.

## AI use

_To be filled in by the team: where AI tools were used for code, art or data._

## Credits and licences

_To be filled in: fonts, sounds and other outside resources._
