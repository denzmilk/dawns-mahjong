# Dawn's Mahjong

Mahjong solitaire built for one person: my nan Dawn, 90, Elvis fan, playing on a Samsung tablet from her armchair.

Classic tile-matching with none of the usual hostility — no timers, no scores, no adverts, no tiny type, nothing to sign into. It greets her by name, saves after every pair so she can put the tablet down mid-game, works with the wifi off, and celebrates every match with a different bit of 3D showmanship.

## Playing it

Once it's deployed, open the link on the tablet and tap **Install on this tablet** on the front screen — it then behaves like a normal app with its own icon, and works offline.

Tap a tile, tap its match, they clear. Tiles you can't play are dimmed. 10 hints and 3 reshuffles per board.

## Running it locally

```bash
npm install
npm run dev            # http://localhost:3100
npm run dev -- --host  # also reachable from a tablet on the same wifi
npm test               # Playwright suite
npm run build          # production build into dist/
```

Add `?layout=turtle-144` to load the classic 144-tile turtle instead of the default 72-tile board. That's a development shortcut — in the finished game she picks her board from the front screen.

## How it's built

Three.js and Vite, plain JavaScript, no framework and no physics engine. Rules live in pure functions so they can be tested without a renderer; all tuned values live in one constants file; modules talk through an event bus. Audio is synthesised in the browser, so there are no sound files. The only font is [Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont/), self-hosted — it was designed for low-vision readers.

The design constraints are written down and deliberately hard to erode:

- [`docs/gameplan.md`](docs/gameplan.md) — what the game is, and what it deliberately isn't
- [`docs/tech.md`](docs/tech.md) — stack, asset pipeline, testing
- [`docs/architectural-decisions/`](docs/architectural-decisions/) — the locked decisions, including [the accessibility constraints](docs/architectural-decisions/0002-accessibility-first-constraints.md) that drive everything else
- [`docs/milestones/`](docs/milestones/) — the work, with acceptance criteria

Built with the [make-game](https://github.com/OpusGameLabs/game-creator) pipeline.

## Credits and licensing

Mahjong tile artwork supplied for this project. The Elvis photographs are third-party publicity images used here for a personal family gift, not owned by me. No Elvis recordings are used anywhere — every sound in the game is synthesised. Atkinson Hyperlegible is used under the SIL Open Font License 1.1 (licence shipped in `public/assets/fonts/`).
