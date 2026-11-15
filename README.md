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
npm test         # unit tests (vitest)
npm run proto    # the game: builds prototype/js/net.js, then serves prototype/
```

The game is `prototype/`, plain scripts with no build step. Online play comes from `src/net`, bundled into `prototype/js/net.js` by `npm run build:proto` (the file is not committed). Without it the game still plays solo and hides the online button. The TypeScript game at the root (`npm run dev`, `npm run build`) is the first version and is no longer what ships.

To publish on itch.io:

```sh
npm run package   # typecheck, build net.js, and zip prototype/ into homestead.zip
```

Then on itch.io: create a project, set the kind to HTML, upload `homestead.zip`, tick "This file will be played in the browser", set the viewport to 960 x 540, and open the page to check that solo starts and that [O] Play online gets a code. Re-run `npm run package` and upload again whenever main changes before the deadline. The zip is built by `scripts/zip.mjs` on Node's own zlib, with forward-slash paths; PowerShell 5.1's `Compress-Archive` writes backslash paths that itch.io can't serve.

## Status

Online lobby with roles and a mission pick, host-authoritative play over PeerJS, phase switching from brief to report, and a flight shell with stub stations. Maps, parts, minigames and the report are being built by each seat; see `docs/team/`.

## Rules checklist (Space Apps 2026)

From proposal section 02, which follows the 2026 Project Submission Guide and the Judging and Awards Guide. Every rule has one owner. Status is yes once it is true for the submitted project, and not yet until then.

| # | Rule | What we do | Owner | Status |
| --- | --- | --- | --- | --- |
| 1 | The demo is a video of 30 seconds or less, or at most 7 slides. Going over makes us ineligible for global judging. | A video cut to 28 seconds (S6-07). | acmrsu | Not yet |
| 2 | Everything is in English. A video in another language needs English subtitles. | English voice-over with burned-in English subtitles. | acmrsu | Not yet |
| 3 | Videos and files are hosted elsewhere, on a public link that needs no login. | Video unlisted on YouTube, game on itch.io, code on this public repo. Every link opened in a private window before submitting. | acmrsu | Not yet |
| 4 | At least one NASA data source or resource. Relevance rewards NASA data that is central to the project. | The "NASA data and resources" section of this README, copied into the project page's NASA Data field. | acmrsu | Not yet |
| 5 | AI may not be used to come up with the idea. AI-made images and video carry a visible watermark. AI-written code and data are noted in text and metadata. | The concept is the team's. Every AI-made image and the video carry a watermark. The "AI use" section below says where AI was used (S6-05). | acmrsu, with every seat reporting its AI use | Not yet |
| 6 | AI-made content may not contain NASA logos, flags or mission identifiers. | No NASA logos, flags or mission patches in any art. Real mission names appear only as plain text in the report. | acmrsu (art pass, S6-03) | Not yet |
| 7 | List every outside resource, even free ones. No copyrighted material without permission. | Fonts, sounds and libraries come from free licences and are listed under "Credits and licences". The game screenshots used as style references stay out of the build, video and repo. | acmrsu | Not yet |
| 8 | At most six members, all registered at the same Local Event. | Team "Project Hail Marcus". All six members are on the team and registered at our Local Event (table below). Six is the limit, so nobody else can join. | acmrsu | Yes |
| 9 | No images, video or voices of anyone under 18. | Checked before the video is recorded. | acmrsu | Not yet |
| 10 | Press "Submit for Judging" before 11:59 PM local time on 15 November, after ticking the terms and original-work boxes. | Submit at hour 12.5 and keep the rest as buffer. Resubmit if anything changes before the deadline (S6-08). | acmrsu | Not yet |

### Team and Local Event registration

Space Apps team: **Project Hail Marcus**.

| Seat | Member | On the team, registered at our Local Event |
| --- | --- | --- |
| 1 | Seedlign | Yes |
| 2 | polsalarm | Yes |
| 3 | TadeyRuk | Yes |
| 4 | Romeo-04 | Yes |
| 5 | Emyol | Yes |
| 6 | acmrsu | Yes |

Confirmed by acmrsu on 15 Nov 2026. That's six members, the most the rules allow, so the team is full.

## NASA data and resources

The mission cards, part stats, hazards and report lines come from these sources. This list goes into the project page's NASA Data field as it stands.

### Facts behind the missions

| Resource | What the game takes from it |
| --- | --- |
| [Rocket Parts, Beginner's Guide to Aeronautics (NASA Glenn)](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/rocket-parts/) | The idea of grouping a rocket into systems, behind the four part slots, and plain-language part descriptions. Index: [Guide to Rockets](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/guide-to-rockets/). |
| [Moon Facts (NASA Science)](https://science.nasa.gov/moon/facts/) | Lunar card distance and gravity, and the solar radiation hazard. |
| [Mars Facts (NASA Science)](https://science.nasa.gov/mars/facts/) | Mars card sunlight and the dust storm hazard. |
| [Mars Fact Sheet (NASA NSSDC)](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) | Earth to Mars distance range, behind the radio delay on the Mars card. |
| [Opportunity (NASA Science)](https://science.nasa.gov/mission/mer-opportunity/) | The 2018 dust storm that ended the rover's mission, used by the Mars hazard and the report. |
| [Apollo 11 (NASA)](https://www.nasa.gov/mission/apollo-11/) | Transit time on the Lunar card. |
| [Mars 2020: Perseverance (NASA Science)](https://science.nasa.gov/mission/mars-2020-perseverance/) | Transit time on the Mars card. |
| [Phoenix (NASA Science)](https://science.nasa.gov/mission/phoenix/) and its [data archive at the PDS Geosciences Node](https://pds-geosciences.wustl.edu/missions/phoenix/index.htm) | The ice drill surface game: Phoenix dug down to water ice just under the Martian soil near the north pole. |
| [JPL Horizons (NASA JPL Solar System Dynamics)](https://ssd.jpl.nasa.gov/horizons/) | Orbiter positions over a landing site, behind the relay link surface game. A real relay pass lasts about 8 to 10 minutes; the game shortens it to 14 seconds. |

### Real hardware behind each part

| Part | Based on | Source |
| --- | --- | --- |
| Solid motor | SLS solid rocket boosters | [Space Launch System Solid Rocket Booster](https://www.nasa.gov/reference/space-launch-system-solid-rocket-booster/) |
| Chemical engine | RL10 upper-stage engine | [Space Launch System RL10 Engine](https://www.nasa.gov/reference/space-launch-system-rl10-engine/) |
| Ion drive | Dawn's ion propulsion | [Dawn: Ion Propulsion](https://science.nasa.gov/mission/dawn/technology/ion-propulsion/) |
| Small solar array | InSight lander arrays | [InSight Lander](https://science.nasa.gov/mission/insight/) |
| Large solar array | Juno's arrays | [Juno](https://science.nasa.gov/mission/juno/) |
| Radioisotope generator | MMRTG on Curiosity and Perseverance | [Radioisotope Power Systems](https://rps.nasa.gov/power-and-thermal-systems/power-systems/current/), [Curiosity](https://science.nasa.gov/mission/msl-curiosity/) |
| Low-gain antenna | Rover low-gain antennas | [Curiosity](https://science.nasa.gov/mission/msl-curiosity/) |
| High-gain dish | Mars Reconnaissance Orbiter's 3 m dish | [Mars Reconnaissance Orbiter](https://science.nasa.gov/mission/mars-reconnaissance-orbiter/) |
| Laser terminal | Deep Space Optical Communications on Psyche | [DSOC](https://www.nasa.gov/mission/deep-space-optical-communications-dsoc/), [Psyche](https://science.nasa.gov/mission/psyche/) |
| Camera | HiRISE on Mars Reconnaissance Orbiter | [MRO Science Instruments](https://science.nasa.gov/mission/mars-reconnaissance-orbiter/science-instruments/) |
| Spectrometer | SuperCam on Perseverance | [Perseverance Science Instruments](https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/) |
| Radar sounder | SHARAD on Mars Reconnaissance Orbiter | [MRO Science Instruments](https://science.nasa.gov/mission/mars-reconnaissance-orbiter/science-instruments/) |
| Hall thruster | Hall-effect thrusters on Psyche | [Psyche](https://science.nasa.gov/mission/psyche/) |
| Storable engine | Orion's service module engine | [Orion Spacecraft](https://www.nasa.gov/humans-in-space/orion-spacecraft/) |
| Fission reactor | Kilopower (the KRUSTY test) | [Kilopower](https://www.nasa.gov/directorates/spacetech/kilopower) |
| Roll-out solar array | ROSA on the ISS and DART | [DART](https://science.nasa.gov/mission/dart/) |
| UHF relay radio | Electra UHF radios on MRO and the rovers | [Mars Reconnaissance Orbiter](https://science.nasa.gov/mission/mars-reconnaissance-orbiter/) |
| CubeSat reflectarray | MarCO CubeSats | [MarCO](https://science.nasa.gov/mission/marco/) |
| Neutron spectrometer | Lunar Prospector and LEND on LRO | [Lunar Prospector](https://science.nasa.gov/mission/lunar-prospector/), [LRO](https://science.nasa.gov/mission/lro/) |
| Sample lab | SAM on Curiosity | [Curiosity Science Instruments](https://science.nasa.gov/mission/msl-curiosity/science-instruments/) |

Part costs (in credits, shown in the inspector, the blueprint and the kiosk catalog) are game estimates scaled from public cost ratios, for example an MMRTG costing far more than a small solar array. They are not taken from a NASA cost source.

### Mission card numbers, checked

| On the card | Checked against | Result |
| --- | --- | --- |
| Moon: gravity one sixth of Earth's | Moon Facts: "one-sixth of Earth's" | Matches. |
| Moon: radio delay about 1.3 seconds | Moon Facts: average distance 384,400 km. Divided by the speed of light, that is 1.28 s. | Matches, computed. |
| Moon: about 3 days away | Apollo flights took about three days to reach the Moon. The Apollo 11 page lists launch and splashdown dates, not the transit time. | Fine for a game card. A page that states the transit time directly would be stronger. |
| Moon: solar particles reach the surface | Moon Facts: the atmosphere gives no protection from the Sun's radiation, and the magnetic field is very weak. | Matches. |
| Mars: about 7 months away | Perseverance launched 30 July 2020 and landed 18 Feb 2021, about 6.7 months. | Matches. |
| Mars: sunlight about 43% of Earth's | Mars Facts: Mars is 1.5 AU from the Sun. Sunlight falls with distance squared, so 1 / 1.52² is about 43%. | Matches, computed. |
| Mars: radio delay 3 to 22 minutes | Mars Fact Sheet: Earth and Mars are 54.6 to 401.4 million km apart. Divided by the speed of light, that is 3.0 to 22.3 minutes. | Matches, computed. |
| Mars: a planet-wide dust storm ended Opportunity in 2018 | Opportunity page: it stopped talking to Earth after a Mars-wide dust storm in June 2018. | Matches. |
| High-gain dish: MRO carries a 3 m dish | MRO's dish is 3 m (10 ft) across, per the [MRO launch press kit (JPL)](https://www.jpl.nasa.gov/news/press_kits/mro-launch-Aug05.pdf). | Matches. The MRO page above does not state the size. |

### Challenge resources

| Resource | What we take from it |
| --- | --- |
| [Mission Design Lab (NASA Goddard)](https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/) | The idea of a trade study, which is how the report explains what was traded for what. Its point design ends in a cost estimate, which is behind the cost cap: each mission's credits are its cap, found parts count half their cost and kiosk parts their full cost. |
| [Concept Maturity Levels (NASA Science)](https://science.nasa.gov/wp-content/uploads/2023/11/03-ziemer-mission-development-101-cmls.pdf) | Same as above: cost and schedule realism is one of the things a concept is judged on, which is why going over the cap costs score. |
| [CubeSat 101 (NASA CubeSat Launch Initiative)](https://www.nasa.gov/wp-content/uploads/2017/03/nasa_csli_cubesat_101_508.pdf) | A check on how we describe power, comms and payload to beginners. |
| [GMAT, General Mission Analysis Tool (NASA Goddard)](https://etd.gsfc.nasa.gov/capabilities/capabilities-listing/general-mission-analysis-tool-gmat/) | Reference for transit times and, with JPL Horizons, for how long a relay orbiter stays in view. Not built into the game. |
| [Design and Develop Science Missions (NASA SmallSat Institute)](https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf) | The four mission segments. Launch and space segments are the build, operations are the flight and surface, and the user segment is the report. The ground and user segments are also behind the relay link: data only counts once it reaches the ground through a relay. |
| [A Learning Game About Telescopes (NASA Webb)](https://science.nasa.gov/mission/webb/game-build-it-yourself/) | Ending the report on a real mission that made the same choice as the player, and the objective pool: science goals are drawn each run and drive what the crew has to build and do. |
| [NASA Mission Viz](https://nasa.github.io/mission-viz/) | Reference for transit times only. |

Challenge page: [Space Mission Design Game](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/).

## AI use

Homestead was made with AI assistance. The concept and design are the team's own, and AI was not used to come up with the idea.

- **Code:** written with Claude Code (Anthropic) as an assistant. Every change went through a pull request that a team member merged, and a person played the game after each merge.
- **Reviews:** a GitHub Action runs Claude on each pull request to point out bugs and missing tests (`.github/workflows/claude-review.yml`).
- **Research and docs:** Claude helped find and check the NASA sources above and drafted parts of this README.
- **Art:** drawn in code and labelled as made with AI. The game will show a "Made with AI assistance" label in a corner of the screen.
- **No NASA branding:** no AI-made content uses NASA logos, flags or mission identifiers.

The full record, area by area, is in [`docs/ai-use.md`](docs/ai-use.md).

## Credits and licences

- [PeerJS](https://peerjs.com/) (MIT), and its free public signalling server for pairing players by code.
- [Pixelify Sans](https://github.com/eifetx/Pixelify-Sans), © 2021 The Pixelify Sans Project Authors, [SIL Open Font License 1.1](src/ui/fonts/OFL-PixelifySans.txt). Used for titles.
- [IBM Plex Mono](https://github.com/IBM/plex), © 2017 IBM Corp., [SIL Open Font License 1.1](src/ui/fonts/OFL-IBMPlexMono.txt). Used for the HUD, brief and report text.

_Still to add: sounds and any other outside resources._
