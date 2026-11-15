# AI use record

Where and how AI tools were used to make Homestead. This is the project's AI metadata, as the 2026 Space Apps rules ask for code and data ("acknowledge SI generation in descriptive text and metadata"). The README's "AI use" section is the short version.

The game concept, its design and the proposal plan are the team's own. AI was not used to come up with the idea.

## Tools

| Tool | Maker | Used for |
| --- | --- | --- |
| Claude, through Claude Code | Anthropic | Writing and testing code, researching and checking sources, drafting docs |
| Claude, through the Claude Code GitHub Action | Anthropic | Reviewing pull requests (`.github/workflows/claude-review.yml`) |

## Where it was used

The team plan (proposal section 10) was six people each working with Claude Code. Every change went through a pull request, a team member merged it, and a person played the game after each merge.

| Area | Paths | How AI helped | Confirmed by |
| --- | --- | --- | --- |
| Core, networking, lobby, spawns, launch, flight shell | `src/core/`, `src/net/`, `src/lobby/`, `src/build/spawns.ts`, `src/build/launch.ts`, `src/flight/` (shell, events, comms) | To confirm | Seat 1 |
| Ground, maps, carrying, pad, suits, objectives | `src/ground/`, `src/build/pad.ts`, `src/missions/` | To confirm | Seat 2 |
| UI, HUD, data, report, Pilot station, sounds | `src/ui/`, `src/data/`, `src/report/`, `src/flight/pilot/` | To confirm | Seat 3 |
| Engineer and Science stations | `src/flight/engineer/`, `src/flight/science/` | To confirm | Seat 5 |
| Kiosk and hazards | `src/build/kiosk.ts`, `src/build/kiosk.register.ts`, `src/ground/hazards.ts`, `src/ground/hazards.register.ts` | Claude Code wrote the code and its tests. A team member reviewed and tested them | Seat 6 |
| README sections and NASA sources | `README.md` (NASA data and resources, rules checklist, this AI section), `docs/ai-use.md` | Claude Code found and opened the NASA pages, checked each mission card number and drafted the text. A team member reviewed it | Seat 6 |
| Pull request reviews | `.github/workflows/claude-review.yml` | Claude reviews each pull request and comments. People decide what to change and merge. The comments are posted under a team member's account | Seat 2 |
| Proposal mocks and walkthrough | `proposal/refs/`, `proposal/walkthrough.html` | AI-assisted mock images, each labelled "AI-assisted mock, not final art" | To confirm |

Each seat: replace "To confirm" in your row with how AI helped, or "Not used".

## Art and video

- **Game art** is drawn in code and is labelled as made with AI. The game will show a visible "Made with AI assistance" label in a corner of the screen.
- **The demo video:** any AI-made frames carry a visible watermark.
- No AI-made content uses NASA logos, flags or mission identifiers.
