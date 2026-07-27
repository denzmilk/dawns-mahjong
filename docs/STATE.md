# Session state

> Updated at the end of each session that made progress. Read first at the start of each session by the session-start sub-pipeline.

## Last updated

2026-07-27 by Claude (pivot from *Jimothy's Big Day Out* to *Dawn's Mahjong*; the whole milestone ladder 01–10 implemented)

## Current phase

development

**All eleven milestones are implemented. 83 specs green. The game is complete enough to give to Dawn.**

Eight boards: 72-tile easy, six 144-tile shapes (turtle, dragon, cat, fortress, crab,
spider), and a surprise board generated fresh every game. A "How to play" legend on the
bar. Green ticks on finished boards. Celebrations doubled.

Every milestone doc (01–10) is `in-progress` rather than `done` for one reason: each has
playtest acceptance criteria that only Chris — and then Dawn — can close. Nothing is
blocked on code.

**Live at https://denzmilk.github.io/dawns-mahjong/** — reviews happen there, not on localhost.

| # | Milestone | Automated | Awaiting |
|---|-----------|-----------|----------|
| 01 | clean slate & the board | 20 green | board reads as a solid stack; tilt legibility |
| 02 | matching rules & play | 18 green | tap accuracy on a real touchscreen |
| 03 | real tile faces | green | faces distinguishable at arm's length |
| 04 | built for a 90-year-old | green | she can use the bar unaided; selection unmissable |
| 05 | eight ways to clear a pair | green | delight on the 40th repetition |
| 06 | sound | green | pleasant at tablet volume; nothing startling |
| 07 | save & carry on | green | a board left overnight is still there |
| 08 | Elvis | green | faces recognisable at tile size; **Nan likes it** |
| 09 | onto her tablet | green | installs and plays with the wifi off |
| 10 | Pages deploy | green | opens on her tablet |
| 11 | more boards, legend, surprise board | green | recognises a shape; finds "How to play"; doubled celebrations not overwhelming |
| 11b | sized for the Tab A11+ (96-tile board, camera fit) | green | tiles feel big enough on her actual screen |

## Last action

Three things in one session.

**The pivot.** Ran the idea phase for *Dawn's Mahjong* — mahjong solitaire for Chris's 90-year-old grandmother Dawn, on a Samsung tablet, Elvis-themed. Agreed: classic dead-end rules plus 3 reshuffles and 10 hints, easy-72 as the default board with the classic 144-tile turtle as an option, fixed-tilt 3D presentation, procedural audio, installable offline PWA on GitHub Pages, fresh public repo. Deleted all Jimothy code, docs, tests, and the 40 MB GLB; kept `EventBus.js`, the Vite/Playwright config, and the architecture. Wrote `gameplan.md`, `tech.md`, ADRs 0001–0003, `backlog.md`, milestones 01–03. Consolidated assets under `public/assets/` (tile sheet, 18 Elvis images, self-hosted Atkinson Hyperlegible) and cropped `greeting-hero.jpg` from the Dawn-with-Elvis composite.

**Milestone 01**, red-then-green. Wrote 20 failing tests first, then built: `Constants.js`, `GameState.js`, a mahjong `Events` map, `Game.js` (render-on-demand loop, shadows, centre-relative lighting), `Layouts.js` (both layouts on the half-tile lattice), `TileMeshes.js` (one texture + one material, per-tile baked UVs, placeholder faces), `CameraSystem.js` (fixed 20° tilt, exact analytic board fit), `main.js` with the test hooks, `index.html`, `style.css`, and `scripts/sync-assets.mjs`. Suite is 20/20 green in ~30 s. Captures in `output/iterate/`.

**Milestone 10** (pulled forward out of 09 at Chris's request): GitHub Actions deploy to Pages, gated on `npm run verify:build`, which serves `dist/` from a `/dawns-mahjong` subpath in a real browser and fails on console errors, 4xx, leaked absolute asset paths, a missing font, or an unrendered board. **Live and verified at https://denzmilk.github.io/dawns-mahjong/.**

**Milestone 02**, red-then-green again (43 new specs → 63 total, all green). `BoardRules.js` (pure: precomputed adjacency index, freeness, matching with the Elvis group, available pairs), `BoardGenerator.js` (pure: boards built by *playing* them, so every board ships with a known clearing order; plus a reshuffle with the same guarantee), `Rng.js` (seedable, so any board is reproducible from `?seed=`), `InputSystem.js` (taps only — a drag isn't a tap, a long press isn't a tap, a second finger cancels), tap forgiveness for unambiguous near-misses, hints (10) and reshuffles (3), win and dead-end states, and a stopgap selection lift. Verified end to end: a full easy-72 board plays out in 70 taps to `won`, clean console, no reshuffles needed.

## Decided on 2026-07-27 (second round)

- **Any two Elvis tiles match** — confirmed, not changed. It is the classic flowers rule
  with flowers and seasons merged into one group of eight, and the legend now says so in
  her words.
- **The install button is gone from the greeting.** Chris installs it once from the
  browser menu; offline play and the home-screen icon come from the manifest and service
  worker, not the button.
- **Boards are named by tile count**, with the shape as a secondary hint.

## Boards are now built to fit the screen (2026-07-28)

Chris's observation, and it was the right one: turning a wide board upright just makes a
tall ribbon — a 12 × 4 board becomes 4 × 12, and both waste the screen. Tile size comes
from how much of the screen the board uses, so the *footprint itself* is now chosen from
the screen's proportions at deal time (`buildFittedBoard` in `src/board/ShapeGenerator.js`),
then stacked by the same erosion the surprise board uses. Traditional silhouettes are given
up for these boards on purpose — he asked for all the screen, and a turtle cannot also be
the shape of a tablet held upright. The six named 144-tile shapes keep their silhouettes.

The camera also now fits the board into the strip the bar leaves free **and** slides it
clear — both halves are needed, and the earlier attempts failed because the board bounds
were being measured mid-entrance-animation, not because the approach was wrong.

Measured at 800 × 1280 dp upright: **72 tiles at 81 dp** (was 51), 36 tiles at 107, 24 tiles
at 126. Nothing sits under the buttons any more. The ~15% the bar strip costs is a
deliberate trade: a tile under a button cannot be tapped at all.

Only the two small boards are promised 64 dp. The middle boards land at 48–62 dp depending
on orientation and display size, and the 144-tile shapes lower still — recorded in the tests
rather than smoothed over.

## She plays in portrait, and wanted bigger tiles (2026-07-28)

Both came from Dawn actually playing it, and both changed real decisions.

**Bigger tiles → smaller boards.** Tile size is set by a board's column count, so three
small boards were added — **24 (quick)**, **36 (garden, now the default)**, **48 (steps)**
— and the surprise board dropped to 48 tiles on a narrower grid. Upright on her tablet the
default now gives **94 dp (~15 mm)** tiles, against 51 dp for the old 72-tile default.

**Portrait, not landscape.** The manifest no longer locks orientation; boards now turn to
whichever orientation fits the screen better (lattice axes swap, artwork stays upright);
the bar moves to the bottom and wraps; the default board is squarer. Milestone 11 has the
full table of measurements and the three bugs this surfaced — including board bounds being
measured mid-entrance-animation, which halved tile size on any refit during a deal.

**Known, backlogged:** a few tiles can sit under the bar's buttons on some board and
orientation combinations. Three fixes were tried and each cost 30–60% of tile size;
the real fix (reserve the strip *and* shift the look-at target together) is in
`docs/backlog.md`. *Mix up* frees a stranded tile meanwhile.

## Her tablet is a Galaxy Tab A11+

Named on 2026-07-27, and it changed real decisions — dp, not inches, is what the touch
floor is measured in. At Android's default display size an 11" 1920×1200 panel presents
about **960 × 600 dp**, which is now the primary test viewport in
`playwright.config.js`-adjacent test data (`HER_TABLET` in `tests/layout.spec.js`).

Measured there: easy-72 and pagoda-96 both **68 dp**; the six 144-tile shapes **45–50 dp**;
surprise **53 dp**. See milestone 11 for what changed as a result (a new 96-tile board,
generalised face dealing, and a camera fit that stopped reserving space for bounding-box
corners that hold no tile).

**If tiles ever feel small to her:** Android's Settings → Display → Display size, moved
*larger*, gives fewer dp and therefore bigger tiles — about 15% per step. Cheaper than any
code change.

## Next step

**Chris plays the finished game on Dawn's tablet** at https://denzmilk.github.io/dawns-mahjong/,
installs it to the home screen, and works through the playtest column above. Then the
milestones can be marked `done` and the game handed over.

Known things worth his judgement, in priority order:

1. **The 144-tile turtle at 47 dp per tile** on a 10–11" screen. Tap forgiveness makes it
   usable, but it is under this project's own 64 dp rule and he may prefer to hide it on
   small screens.
2. **Whether the celebrations wear out.** Eight of them, no immediate repeats, escalation
   every 6th match — but 36 matches a board is a lot, and only a real session tells.
3. **Whether the greeting hero crop is tight enough.** A sliver of AI-garbled poster text
   remains top-left of `dawn-with-elvis-1.jpg`.

## What the last stretch built

Chris asked for a straight run through the ladder ("use the game design skills, over
animate, have fun with it"), so 03–09 landed in one session:

- **03** — `scripts/measure-tile-sheet.mjs` detects the 43 tile rectangles in the supplied
  preview sheet by flood-filling its cream blocks, and writes them to a committed module.
  Real faces on the board, one texture and one material for all 144 tiles.
- **04** — the HTML overlay: greeting with time-of-day and her name, in-game bar, win and
  no-moves screens, the gold Greek-key frame cropped live out of the sheet, four-channel
  selection (lift + gold rim + pulse + glow), and dimmed unplayable tiles.
- **05** — eight celebrations, a pooled particle system, an entrance that deals the board,
  and a rolling finale.
- **06** — every sound synthesised from one `tone()` primitive, including an original
  rockabilly turnaround on board clear.
- **07** — versioned `localStorage`, autosave after every move, "Carry on — N tiles left".
- **08** — eight Elvis photographs as the bonus tiles, portraits on the screens, the
  spotlight celebration reserved for Elvis pairs.
- **09** — manifest, generated icons, a hand-rolled precaching service worker, and a big
  "Put this on my tablet" button.

**On the design skills:** `design-game` and `game-designer` are written for Phaser games
aimed at someone scrolling a silent social feed. The craft transferred — pooled particles,
entrance animation, redundant feedback channels, easing vocabulary, constants-driven
tuning. The spectacle advice was rejected on purpose: screen shake, hue-cycling
backgrounds, combo-text slams, and hit-freeze frames would actively harm a 90-year-old in
an armchair, and they contradict ADR-0002. That is recorded in milestone 05.

## Decisions taken this session

- **No undo.** A mis-tap can't create a wrong match, so undo would only cover a legitimate regret, at the cost of a move history in `GameState`. Struck through in the backlog and marked out of scope in milestone 02 — don't reintroduce it without a fresh decision.
- **The turtle stays, with tap forgiveness.** Its 47 dp tiles are under the 64 dp rule, so milestone 02 gains a forgiveness radius: a near-miss selects the nearest free tile when exactly one qualifies. Promoted out of the backlog into milestone 02's scope with two ACs.

## Blockers

- **Milestone 01's two playtest ACs** need Chris's hands-on session: does the board read as a solid physical stack, and does the tilt give depth without hurting back-row legibility.
- **Which tablet is it?** Still unknown. `easy-72` clears 64 dp from 1024×640 up, so nothing is blocked today, but milestone 04 can't be signed off without a check on her actual screen.

## Notes for next session

- **Milestones 04–09 were built before their tests**, unlike 01–03. Chris asked for a run
  through the ladder rather than red-then-green on each. `tests/experience.spec.js` was
  written afterwards to cover them and each assertion was checked against the behaviour it
  guards. Worth knowing when trusting that file: it is a net, not a specification that
  drove the design.
- **Headless Chromium renders in software**, so the animated milestones were crawling at
  ~3 fps and timing out. Two fixes, both of which help the real tablet too: shadows are
  re-rendered only when the board changes (not per animated frame), and the shadow map
  dropped to 1024. The test config also renders at `deviceScaleFactor: 1` — everything
  asserted is measured in dp, so render resolution isn't part of what the tests check.
- **The overlay must never swallow a tap.** `#hud` is `pointer-events: none` with only its
  buttons interactive; a full-width bar over the board otherwise eats taps meant for tiles.
  The same class of bug hid twice — see also that every screen change must go through
  `Game.setScreen()`, or the overlay and the board disagree about what is showing.
- **Reviews happen on the live URL now**, not localhost — Chris asked for that on 2026-07-27. Push to `main` and the deploy runs itself (~1 min); `gh run watch` to follow it. `npm run verify:build` locally first if the change touches assets, paths, or the build, since that is the CI gate.
- **Live measurements match local ones exactly** (68.1 dp easy-72, 47.2 dp turtle at 1024×640), so the tablet-viewport tests catch layout regressions without a device. A device is only needed for how it *feels*.
- **Port 3100, `strictPort: true`.** Another of Chris's projects (`~/Projects/Jimothy`) holds 3000 and Vite silently slid to 3001 — the entire browser suite spent a run asserting against a different app while producing plausible-looking failures. If the dev server won't start, something else took 3100; don't "fix" it by changing the port back.
- **Git history starts fresh here.** This directory's Jimothy commits were discarded when the repo was re-initialised for `denzmilk/dawns-mahjong`; they remain on the `denzmilk/jimothys-big-day-out` remote, which was fully up to date.
- **Jimothy's uncommitted milestone 05 + 06 work is saved at `~/jimothy-m05-m06.patch`** (66 KB, outside this repo). It was staged-but-never-committed, so it is *not* in the Jimothy remote — that remote is at milestone 02. Chris knows; bin the patch whenever he says.
- Chris drops new Elvis photos into `Assets/` as he finds them — `npm run assets:sync` normalises the names into `public/assets/elvis/`. Sweep for strays at the start of each session.
- **Android reports CSS pixels as dp**, so a 10.9" Tab A9+ presents ~1024×640 in landscape, not 1920×1200. Test legibility at *dp* viewports; desktop-sized runs pass while the real board is unusable. `tests/layout.spec.js` has the four realistic tablet sizes.
- **Constants were tuned against measurements** and the reasoning is in each comment — don't "tidy" them. Notably: `CAMERA.margin` at 1.1 put `easy-72` at 63.5 dp against a 64 dp floor, and `TILE.thickness` at 0.4 made the turtle's five layers read as a flat mosaic.
- The atlas machinery is already in place with placeholder art, so **milestone 03 swaps the atlas pixels only** and inherits the single-material draw-call budget. Cell rects come from a measuring script, not hand-tuning.
- `window.__debug` holds the test hooks: `pickAt`, `readPixels`, `samplePoints`, `capture()`. Use `capture()` for `output/iterate/` PNGs; use `samplePoints` rather than reading a whole buffer back (four million values at dpr 2).
- Headless Chromium's canvas compositing makes the ANGLE driver log `GPU stall due to ReadPixels`. It is browser noise, filtered by pattern in `tests/boot.spec.js` only — every warning the app itself logs still fails that test.
- `three` r185 deprecates `PCFSoftShadowMap`; use `PCFShadowMap`.
- ADR-0002 (accessibility-first constraints) is the project's spine: single tap only, fixed camera, 64 dp targets, 24 px minimum text, nothing punishing. Most design questions are already answered there.
