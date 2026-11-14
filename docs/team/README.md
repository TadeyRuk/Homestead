# Team and seats

Six seats, one owner each. Read this file first, then your seat file. Times are hours from kickoff, matching the proposal checkpoints.

## Roster

| Seat | Area | Owner | File |
| --- | --- | --- | --- |
| 1 | Core and network | Seedlign | [seat-1-core-network.md](seat-1-core-network.md) |
| 2 | Ground, maps and build logic | polsalarm | [seat-2-ground-build.md](seat-2-ground-build.md) |
| 3 | UI, data and report | TadeyRuk | [seat-3-ui-data-report.md](seat-3-ui-data-report.md) |
| 4 | Pilot and Comms | open | [seat-4-pilot-comms.md](seat-4-pilot-comms.md) |
| 5 | Engineer and Science | Emyol | [seat-5-engineer-science.md](seat-5-engineer-science.md) |
| 6 | Ship it | acmrsu | [seat-6-ship-it.md](seat-6-ship-it.md) |

## Claiming an open seat

1. Get added to the repo as a collaborator by TadeyRuk.
2. Put your GitHub login in the Owner column above and at the top of the seat file, in one PR.
3. Read the contract below, then start at your seat's first issue.

## Fallback at hour 3

Seat 5 is taken (Emyol). If seat 4 still has no owner at hour 3, its stations are split up:

| Station | Taken by |
| --- | --- |
| Pilot (seat 4) | seat 3, TadeyRuk |
| Comms (seat 4) | seat 1, Seedlign |

S4-07 and S4-08 are cut. Seat 4's event director, arrival and solo pacing go to seat 1. The flight shell itself (S4-01) is already seat 1's and on main.

## Who draws what

Seat 3 draws every HTML/CSS screen and the HUD from `GameState`. The seat that owns a piece of state writes it, and never builds its own panel for it. Agree field names with TadeyRuk before you add a field a screen needs.

## How code gets into main

- One branch per issue, named `seat-N/short-name`, for example `seat-2/campus-map`.
- Open a PR into `main`. Seedlign (seat 1) merges every one to two hours.
- After each merge, someone plays the game. Claude cannot see whether it plays right.
- Edit only your own folders. If you need something from another seat's folder, ask that owner or open an issue for them.
- Placeholder shapes until the feature freeze at hour 9.5.

## Folders

| Path | Owner |
| --- | --- |
| `src/core/` | seat 1: GameState, seeded RNG, phase switching, input map, timers |
| `src/net/` | seat 1: host, join by code, sync |
| `src/lobby/` | seat 1: the stopgap lobby form until seat 3's screens replace it (role and run-start logic is in `src/core/lobby.ts`) |
| `src/ground/` | seat 2: top-down player, carrying, camera, campus and surface maps, suit drain, extraction |
| `src/ground/hazards.ts` | seat 6: flares and dust storms |
| `src/build/pad.ts` | seat 2: pad slots and swapping |
| `src/build/spawns.ts`, `src/build/launch.ts` | seat 1: seeded spawns, countdown, salvage, launch |
| `src/build/meters.ts` | seat 3: meter math |
| `src/build/kiosk.ts` | seat 6: kiosk |
| `src/missions/` | seat 2: surface objective rules |
| `src/ui/` | seat 3: every HTML/CSS screen and the HUD |
| `src/report/` | seat 3: report logic and score |
| `src/data/` | seat 3: `parts.json`, `missions.json` |
| `src/flight/shell.register.ts`, `src/flight/stations.ts` | seat 1 (taken early from seat 4, since seat 5 needs it) |
| `src/flight/pilot/`, `src/flight/comms/`, `src/flight/events/` | seat 4 |
| `src/flight/engineer/`, `src/flight/science/` | seat 5 |
| `public/assets/` | seat 6: art and sound, file names agreed with each owner |
| `README.md`, `docs/` | seat 6 (this folder: anyone, for their own seat file) |
| `package.json`, `vite.config.ts`, `tsconfig.json` | seat 1 only |

## The contract

Seat 1 lands this in `src/core/` at hour 1.5. Until then, code against these names. Changing a name after hour 1.5 needs a message to everyone first.

### Rules

- The host holds the one true `GameState`. Clients send inputs, never state.
- Scenes read from `GameState` and append to the event log. A scene never reaches into another seat's scene.
- All randomness goes through the seeded RNG in `src/core/rng.ts`. No `Math.random()` in game logic.
- Part and mission numbers live in `src/data/` only. No magic numbers for part stats in scene code.
- Read time through `timeLeft` and `isUp` in `src/core/timer.ts`; they handle a null `phaseEndsAt`.
- Game rules are registered from your own folder with `registerRule(phase, (state, inputs, now, dt) => ...)` from `src/core/step.ts`. They run on the host only, each tick of that phase.
- Put your `registerRule`, `registerScene` and `registerStation` calls in a file ending `.register.ts` inside your own folder, for example `src/flight/engineer/engineer.register.ts`. Every such file loads at startup, so nobody edits `src/main.ts` to plug in.
- Flight stations register with `registerStation(role, { draw })` from `src/flight/stations.ts`. The flight shell (`src/flight/shell.register.ts`) shows each player the station for `player.station` and moves it on Tab. Every player is seated at their first role the moment flight starts.
- Station state lives in `state.flight`, one plain-data entry per minigame (`state.flight.bus`, `state.flight.weld`, ...), created and stepped by your flight rule, so joiners see it in snapshots. Drive it with `stationInput(state, inputs, role)`, which returns only the keys of the player looking at that station: a solo player holds all four roles and must not drive all four at once. `whoIsAt(state, role)` gives that player.
- A role with two minigames registers one station that draws both, and one rule that steps both. Split the keys between them (for example arrows for one, E for the other) or show one at a time and flip with the panel key.
- Write your station's current problem to `state.trouble[role]` from a rule, and delete it when fixed.
- Registering the same scene, station or map twice logs a warning, and the dev console lists every `.register.ts` file that loaded; a file that isn't listed is misnamed.
- Maps: seat 2 registers the real campus and surface with `registerMap("campus", CampusLayout)` and `registerMap("surface", SurfaceLayout)` from `src/core/map.ts`. A campus needs `spawnPoints`, `pad` and `kiosk`; a surface needs `lander` and `sites`. All are required, so a missing pad is a type error. Until then a placeholder sized to the canvas is used. Use `nearest(points, player, reach)` for "is the player at the pad or next to a part".
- Loose parts live in `state.parts` and are cleared on every phase change. Put a piece down only with `placePart(state, part, at, source)` from `src/core/parts.ts`, which gives it an id no other piece has had this run. Seat 1 seeds pieces onto the spawn points at the start of campus (S1-09). Picking up (seat 2, S2-03) removes the piece and sets `player.carrying` to its part id; dropping or swapping calls `placePart` again. `buyFromKiosk` (seat 6) places its piece at `kiosk` itself. Mounting at the pad (S2-10) writes `ship.slots`, which launch (S1-10) reads.
- Part stats come from `src/core/catalog.ts`: `partInfo(id)`, `buildable()` (what can spawn or be rolled), `massOf(slots)` and `liftOf(slots)`. The placeholder is the proposal's parts table plus one weak salvage part per slot; seat 3 replaces it with `registerParts` (S3-01).
- One-off setup when a phase starts goes in `onEnterPhase(phase, (state, now) => ...)` from `src/core/phases.ts`, for example spawning the campus parts.
- At the pad, E while carrying a part mounts it (seat 2, S2-10); E with empty hands starts or cancels the 5 s launch countdown (seat 1, S1-10). When the build timer runs out, empty slots get salvage parts and the rocket launches. A rocket heavier than its engine's lift, or with no engine, logs `launch_failed` and the run goes to the report.
- A run's starting credits and data target come from `missionInfo(mission)` in `src/core/missions.ts`. Seat 3 registers the real numbers with `registerMissionInfo`; until then the Moon gets 60 credits and a 25-unit target, Mars 100 and 40.
- A run starts only through `startRun` in `src/core/lobby.ts`: it resolves the mission, resets the ship, data, objectives, trouble and log, and resets each player's suit, keeping the crew and their roles. Roles are dealt with `dealRoles` and swapped one-for-one with `takeRole`, so every role is held exactly once. Read a player's jobs from `player.roles`.
- Scenes register with `registerScene(phase, scene)` at startup. They get read-only state and draw it. A scene never changes state; that belongs in a rule.
- Rules read each player's keys from `inputs[player.id]`. Never call `createInput()` yourself or listen to `window`; `src/main.ts` owns the one keyboard listener.
- For timers, use `timeLeft(state, view.now)` in scenes and the `now` given to rules. Both are on the host's clock, so they read right on every tab.

### State shape (first pass)

```ts
type Phase = "lobby" | "brief" | "campus" | "flight" | "surface" | "report";
type Role = "pilot" | "engineer" | "comms" | "science";
type Slot = "propulsion" | "power" | "comms" | "payload";
type MissionId = "moon" | "mars";

interface Player {
  id: string;
  name: string;
  roles: Role[];            // solo holds all four
  station: Role | null;     // flight station this player is looking at; Tab moves it
  x: number; y: number;
  carrying: string | null;  // part id
  oxygen: number;           // suit, 0..1, surface phase
  power: number;            // suit, 0..1, surface phase
  down: boolean;
}

interface Ship {
  slots: Record<Slot, string | null>;  // part ids
  salvaged: Slot[];
  fuel: number; hull: number;          // 0..1
  cabinOxygen: number;                 // 0..1
  coreTemp: number;                    // 0..1, safe band set in data
  instrumentHealth: number;            // 0..1
  linkLocked: boolean;
}

interface GameEvent {
  t: number;            // seconds since run start
  phase: Phase;
  kind: EventKind;
  part?: string;        // the part that caused it, if any
  player?: string;
  value?: number;
}

interface GameState {
  seed: number;
  mission: MissionId;
  phase: Phase;
  phaseEndsAt: number | null; // ms on the host clock; null = no deadline (lobby)
  runStartedAt: number;       // ms on the host clock; event times count from here
  credits: number;
  players: Player[];
  launchAt: number | null;  // host ms of liftoff while the countdown runs
  parts: LoosePart[];       // parts lying on the map: { id, part, x, y }
  partSeq: number;          // behind loose-part ids; use placePart, not this
  ship: Ship;
  data: { collected: number; uplinked: number; target: number };
  objectives: Record<string, boolean>;
  flight: Record<string, unknown>;       // one plain-data entry per flight minigame, written by rules
  trouble: Partial<Record<Role, string>>; // each flight station's current problem, for the crew strip
  log: GameEvent[];
}
```

### Event kinds

The report reads these. Add a new kind by PR to `src/core/events.ts`, owned by seat 1.

```
part_picked  part_dropped  part_mounted  part_swapped  kiosk_bought
salvage_filled  launch_started  launch_cancelled  launch_failed
debris_hit  fuel_low  hull_breach  breach_sealed
breaker_tripped  load_shed  link_lost  link_locked
core_overheated  core_too_cold  oxygen_low  converter_jammed
site_scanned  sample_collected  data_uplinked  objective_done
hazard_hit  player_down  extraction
```

## Checkpoints

| Hour | Checkpoint | What has to be true |
| --- | --- | --- |
| 1.5 | Scaffold | Contract in `src/core/`. Two tabs join by code over WebRTC and see each other walk. |
| 3 | Seat check | Seat 4 filled, or the fallback above applies. |
| 6 | Whole loop | One player gets through brief, campus, flight, surface and report with placeholder shapes. Each minigame exists in its simplest form. |
| 8 | Online run, bare UI | Two players on two machines finish a run. All meters and panels readable. |
| 9.5 | Feature freeze, art in | No new mechanics. Generated art replaces placeholders. |
| 10.5 | Sound, effects, test | The itch.io build runs in a fresh browser. Someone outside the team plays solo without help. |
| 11.5 | Video | Under 30 seconds. |
| 12.5 | Submit | Project page, repo, video, NASA data list, AI-use notes. The rest is buffer before 11:59 PM. |

## Cut order when a checkpoint slips

1. The kiosk. Found parts only, unspent credits become a flat bonus.
2. The second minigame for the Engineer and Science Officer.
3. The Moon. Mars only.
4. Surface hazards.
5. Online play. If two machines cannot finish a run by hour 8, submit and record solo.

The campus build, the six meters and the report are never cut.
