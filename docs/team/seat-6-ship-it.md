# Seat 6: Ship it

**Owner:** acmrsu
**Folders:** `README.md`, `public/assets/`, `src/build/kiosk.ts`, `src/ground/hazards.ts`, the itch.io page, the submission

Everything the judges see outside the game, plus the outside eyes on the game itself. Most of this lands late, so start the research issues at hour 0. The kiosk and hazards are your two game features; both are on the cut list, so if they slip they get cut, not rescued.

## Needs from others

- Seat 1: an itch.io build that runs (S1-08).
- Seat 3: the twelve parts and two missions, to match NASA links against (S3-01).
- Everyone: asset file names agreed before you generate art.
- Seat 2: the campus map, suit drain and spawn helpers the kiosk and hazards use (S2-04, S2-05, S2-06).

## Issues

### S6-01 NASA sources list (hour 1.5)
Exact links for every NASA source in proposal section 09, including the mission pages for Dawn, Juno, InSight, Curiosity, Perseverance, Mars Reconnaissance Orbiter and Psyche. Check every number on the mission cards against them.
**Done when:** a list in `README.md` that seat 3 and the project page can use as is.

### S6-02 Rules checklist (hour 6)
Walk proposal section 02 line by line. Confirm all six team members are registered at the same Local Event. Track each rule to a person and a yes or no.
**Done when:** every rule has an owner and a status in `README.md`.

### S6-03 Asset list and art pass (hour 9.5)
List every sprite and sound the game needs, agree file names with each seat, then replace placeholders file for file after the feature freeze. Generated art gets a visible watermark. No NASA logos, flags or mission patches.
**Done when:** all placeholders replaced, every generated image watermarked.

### S6-04 Sound (hour 10.5)
Free-licence sounds for pickup, mount, launch, hits, alarms and the report. Every source and licence written down.
**Done when:** sounds play in game and each is listed in the credits.

### S6-05 README: AI use and credits (hour 10.5)
Fill in the AI-use section (where AI was used for code, art and data) and the credits and licences section (fonts, sounds).
**Done when:** no "to be filled in" text left in `README.md`.

### S6-06 Playtest and balance (hour 10.5)
Balance runs on the part numbers in `src/data/parts.json` with seat 3. Get someone outside the team to play solo on the itch.io build without help, and note where they got stuck.
**Done when:** one outside playtest done, issues filed for what broke.

### S6-07 Video (hour 11.5)
28 seconds: team and challenge, title and tagline, find and mount a part, its consequence in flight or on the surface, the report naming it. English voice-over with burned-in subtitles. Watermarked. Nobody under 18 in it. Unlisted on YouTube.
**Done when:** the link plays in a private browser window with no login.

### S6-08 Submit (hour 12.5)
Project page with the repo, the itch.io link, the video, the NASA data list and the AI-use notes. Tick the terms and original-work boxes, press Submit for Judging. Resubmit if anything changes before 11:59 PM.
**Done when:** submitted, and all links tested in a private window.

### S6-09 Kiosk (hour 8, cut list item 1)
Lives in `src/build/kiosk.ts`. Pay 20 credits for one seeded random part, which appears at the kiosk. Logs `kiosk_bought`.
**Done when:** buying deducts credits and spawns a part at the kiosk.

### S6-10 Hazards (hour 8, cut list item 4)
Moon solar flare: warning, then radiation on open ground, safe at the lander or behind rock. Mars dust storm: a wall crossing the map that cuts sight and drains suits. Lives in `src/ground/hazards.ts`; uses seat 2's map and suit drain (S2-06). Logs `hazard_hit`.
**Done when:** each mission's hazard fires on the seeded schedule and hurts players in the open.

## Fallback load (if seat 5 is still open at hour 3)

- Engineer power bus (S5-02). A small switch panel: loads against supply, switch them off before the breaker trips. Ask Seedlign or TadeyRuk to pair on it if it's your first game code.
