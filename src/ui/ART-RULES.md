# Homestead art rules

Seat 3 (UI) keeps these rules. Every screen, sprite and HUD piece follows them, and anyone adding art should too.

## Rule 1: more pixels, smaller chunks

The first pass used big chunks: art was drawn on a 640 x 360 grid, so one art pixel was a 2 x 2 block on a 1280-wide screen, and seat 2's map was stretched from 960 x 540. Small details disappeared: parts looked alike, astronauts had no faces, and labels had to do the work the art should do.

From now on:

1. **Draw on a 1280 x 720 art grid.** One art pixel is one screen pixel at 1280 wide. The canvas backing store follows the display size times `devicePixelRatio` (capped at 2), and art scales by whole numbers only, so pixels stay square and sharp. Never stretch a non-integer amount.
2. **Foreground detail is 1 x 1.** Characters, parts, tools, buttons and anything the player interacts with use single-pixel detail. Only far background (sky, distant hills, big floor fills) may use 2 x 2 chunks, and that difference also gives the scene depth.
3. **Minimum sprite sizes on the 1280 grid:**
   | Thing | Size |
   | --- | --- |
   | Astronaut (standing) | 24 x 32 or bigger |
   | Rocket part (loose) | 24 x 24 or bigger |
   | Small pickup (sample, data chip) | 16 x 16 |
   | Icons in the HUD | 16 x 16, on a whole-pixel grid |
   | The rocket on the pad | 48 x 160 or bigger |
4. **Every part reads without its label.** Each of the twelve parts gets its own silhouette (nozzle, panel grid, dish, lens...), not a recoloured diamond. Its slot colour goes on a small trim or stripe, so a player can tell propulsion, power, comms and payload apart from a distance.
5. **Readable at a glance:**
   - Every sprite has a 1 px dark outline (`#080e1a` or a darker shade of its own colour), so it never melts into the ground.
   - Use at least three shades per material (shadow, base, highlight) and one light direction for the whole game: top left.
   - Faces and visors show which way a character looks.
6. **Text is real text.** The UI uses Pixelify Sans for titles and IBM Plex Mono for everything else, drawn at whole-pixel sizes. Text is never part of a sprite image.
7. **Motion has detail too.** Idle loops get at least 2–4 frames (blink, breathe, antenna bob). Small effects such as sparks, dust, steam and blinking lights carry life at full resolution. Every animation respects `prefers-reduced-motion`.
8. **Palette:** use the tokens in `src/ui/tokens.ts`, plus shades derived from them. If a new colour is needed, add it there with a name, not inline.

## Checks before a PR

- Screenshot at 1280 x 720 and at 2560 x 1440. Nothing should look soft or stretched.
- Cover the labels: can you still tell the twelve parts apart?
- No sprite is smaller than the table above allows.

## Where the rules are applied

- **The title film** (`src/ui/liftoff`) draws into a 1280 x 720 buffer: crew at 24 x 32, the rocket on the pad at 48 x 168, every sprite with a 1 px outline. The hull camera's rocket is ray-traced at that full resolution. Only the far background is coarse: the sky and mesas are 2 x 2 chunks, and the planet below the hull camera is drawn at 640 x 360 and doubled. The buffer is shown with nearest-neighbour scaling, and all text is drawn afterwards at screen resolution, so it stays sharp at any size.
