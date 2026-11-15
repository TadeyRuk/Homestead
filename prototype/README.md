# Homestead: the game

The whole game (menu, build, flight, surface, report) in plain JavaScript. This is what ships to itch.io.
Online play is `js/net.js`, the network layer from `src/net` bundled by `npm run build:proto`, and
`js/net-game.js`, which wires it in: the host runs the game and sends snapshots, joiners send their keys and
only draw. `js/net.js` is not committed; without it the game plays solo and the online button stays hidden.

From the repo root:

    npm run proto

or, solo only, any static server from this folder (`python3 -m http.server 8080`).

## Title film

The title screen plays the main game's liftoff film (`src/ui/liftoff` in `main`), ported to plain
JavaScript in `js/liftoff/`. Only the TypeScript types were removed; the drawing code is unchanged. The film
draws on its own 1280 x 720 art canvas, which is copied to the screen canvas at its full backing
resolution with nearest-neighbour scaling, and its text is drawn on top at that resolution.
`window.__hsTitle.seek(seconds)` jumps the film to any moment (handy for screenshots).
