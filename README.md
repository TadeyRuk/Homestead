# Homestead: full-game UI prototype

A standalone, plain-JavaScript prototype of the whole game (menu, build, flight, surface, report).
It is **not** the TypeScript/Vite game in `main` and shares no history with it; it is published as its own branch so it is backed up and can be run on other machines.

Run it with any static server from this folder, for example:

    python3 -m http.server 8080

then open http://localhost:8080/. No build step and no install.

## Title film

The title screen plays the main game's liftoff film (`src/ui/liftoff` in `main`), ported to plain
JavaScript in `js/liftoff/`. Only the TypeScript types were removed; the drawing code is unchanged. The film
draws on its own 1280 x 720 art canvas, which is copied to the screen canvas at its full backing
resolution with nearest-neighbour scaling, and its text is drawn on top at that resolution.
`window.__hsTitle.seek(seconds)` jumps the film to any moment (handy for screenshots).
