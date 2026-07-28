# Session state

> Updated at the end of each session that made progress. Read first at the start of each session by the session-start sub-pipeline.

## Last updated

2026-07-28 by Claude (milestone 12: boards under 48 tiles cut, every board rebuilt as a stepped mound, and a draggable magnifying glass)

## Current phase

development

**All twelve milestones are implemented. 92 specs green. The game is complete enough to give to Dawn.**

Ten boards: 48-tile steps (the default), 72-tile easy, 96-tile pagoda, six 144-tile shapes
(turtle, dragon, cat, fortress, crab, spider), and a surprise board generated fresh every
game. A "How to play" legend on the bar. Green ticks on finished boards. A magnifying glass
she can drag about. Celebrations doubled.

Every milestone doc is `in-progress` rather than `done` for one reason: each has playtest
acceptance criteria that only Chris — and then Dawn — can close. Nothing is blocked on code.

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
| 12 | bigger tiles & a magnifying glass | green | mounds read as boards not chimneys; 4 opening pairs is enough; she finds and uses the glass |

## Bigger tiles, and a magnifying glass (2026-07-28)

Chris, after playing it: cut everything under 48 tiles ("too small and simple, gran won't
like those"), stack the 144-tile boards higher on a smaller footprint so their tiles come
out near the 48-tile board's, and add a big draggable magnifying glass.

**Measured on her tablet (600 × 960 dp upright / 960 × 600 on its side), before → after:**

| board | upright | on its side |
|---|---|---|
| steps-48 | 61 → **90** | 75 → **92** |
| easy-72 | 68 → **97** | 61 → **89** |
| pagoda-96 | 89 → **97** | 61 → **86** |
| turtle-144 | 58 → **82** | 58 → **70** |
| dragon / cat / fortress / crab / spider | 58–66 → **73–94** | 51–58 → **75–79** |
| surprise | 49 → **97** | 51 → **91** |

Every board now clears the 64 dp touch floor both ways up — a promise that used to belong
to the two smallest boards only, while the 144-tile ones missed it by 20 dp.

Four changes got there, and the order matters because each one unlocked the next:

1. **The footprint is searched, not derived.** Rows and columns are now tried
   independently and scored by the tile size they would produce. The old builder pinned the
   footprint's proportions to the *screen's*, which is wrong — the stack reaches up the
   screen, so the best footprint is wider and shallower than the screen by exactly the
   height the mound will claim. Most of the landscape gain is this one change.
2. **The mound steps inward** (`buildSteppedBoard`): each level an erosion of the one
   below, one layer per level, remainder on the base. Every step leaves a ledge of tappable
   tiles. A straight-sided tower only ever offers the two ends of its top row, however many
   tiles are underneath — that is why the previous flat-stack builder needed a wide
   footprint to stay playable.
3. **`BOARD.minOpeningPairs: 4`** — the generator deals the first few pairs onto tiles that
   are free before anything has been cleared, so a deep board cannot open as a wall. This is
   what let `minPlayable` drop 14 → 10, which is what let the footprints shrink. Free tiles
   were always a poor proxy for pairs: boards passing at 14 still opened with two.
4. **`BOARD.maxLayers: 8`**, measured. 6 → 8 lifted the 144-tile boards from 65–73 dp to
   74–82; 10 gained one more dp and nothing else, because past 8 the tower leans far enough
   toward the camera that perspective shrinks the far bottom row by as much as the narrower
   footprint gained.

**The bar-overlap fix from the backlog finally landed**, and none of the three approaches
recorded there was the answer. Moving the camera at all is what makes the frustum grow on
both sides. The board is fitted to the bar-free strip and then slid onto it by shearing the
*projection* (`camera.setViewOffset`) — same view, different landing spot. Free, and it also
removed two tiles that sat a pixel or two off the left edge on three of the 144-tile boards.

**The magnifying glass** is ADR-0004, which supersedes part of ADR-0002's no-drag rule —
narrowly, for the glass and nothing else. `InputSystem` asks once on pointer-down whether
the press landed on the glass; if not, the tap-only rules apply exactly as before, and a
test asserts it. It re-renders the scene through a zoomed camera rather than scaling pixels
already drawn, at 2× — which is both enough to fit three or four tiles in the lens and about
where the ~79 × 99 px source artwork gives out. Tapping through it plays the tile she can
see, so it never has to be moved out of the way.

**Two bugs this surfaced, both real:**

- **A tap that cleared the last pair skipped straight past the win screen.** A tap arrives
  twice — as a pointer event, then as the click the browser synthesises after it — and the
  second one pressed whichever button had appeared under her finger. A screen that has just
  appeared now ignores taps for `TIMING.screenSettle` (0.35 s).
- **The bar wrapped onto two rows in landscape** once it had a sixth button: 184 px of a
  600 dp screen, and 13 dp off every tile. Only the padding inside the buttons was cut —
  labels and the 64 dp minimum are untouched.

`npm run measure:boards` prints the table above by driving the real game in a real browser;
`npm run capture:boards -- <board>` saves PNGs to `output/iterate/`. Both exist so the next
session argues from numbers rather than from memory.

**Chris signed off the same day, on both halves.** The sizes: *"sizes are looking great
now."* And ADR-0004: *"still make the magnifying glass a drag, that rule can be broken"* —
so the ADR is **accepted**, not proposed, and the no-drag exception is a settled decision
rather than one waiting on him. What is still open is only what his hands and Dawn's can
tell us: milestone 12's playtest ACs.

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

## Boards build UP, not out (2026-07-28)

Chris asked why more tiles meant a wider board rather than a taller stack, and the
measurement settled it immediately: **144 tiles spread across a portrait screen give 43 dp
tiles; the same 144 stacked four deep on a small footprint give 103 dp.** Tile size is set
by the footprint, not the count — so height is nearly free.

`buildStackedBoard` (in `src/board/ShapeGenerator.js`) now lays every board this way: the
silhouette is resampled onto a footprint matching the screen, then repeated upward, with only
the top layer partial (filled centre-outwards). Support is automatic — every tile has one
directly beneath it. It replaced an erosion-based fit that capped what a small footprint
could hold and, once trimmed, had collapsed some boards to a single flat layer, which is why
tiles were so small.

Measured upright after the change: quick 105 dp, garden 126, easy 92, pagoda 121, turtle 79,
cat 80, spider 80 — every board between 72 and 131 dp, against 43–126 before.

Two things this cost, both recorded rather than hidden:

- **Fewer pairs on offer at once** (3–8 rather than 16–49), because a deep stack exposes
  fewer tiles. `minPlayable: 14` in the builder is the guard; at 10 some boards opened with
  only two pairs available, which is a game spent pressing Mix up.
- **Covered tiles are now genuinely unreachable** until the tile above them goes, since tiles
  sit directly on each other. That is normal mahjong, but it changed a test: tapping a
  covered tile's centre correctly selects the tile sitting *on* it.

The turtle was missing out entirely — it predates the mask format, so it had no silhouette to
resample and stayed at 43 dp while the cat reached 80. Masks are now derived from the base
layer when a board wasn't authored from one.

## Boards were fitted to the screen (2026-07-28)

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

**Milestone 12 is implemented and approved on the numbers, but uncommitted and unplayed.**
Stage, ask, push, and then Chris plays it on Dawn's tablet at
https://denzmilk.github.io/dawns-mahjong/ and works through milestone 12's playtest ACs.

Known things worth his hands, in priority order:

1. **Do the mounds read as boards?** A 144-tile board is now up to 8 layers deep on a 6 × 4
   footprint. Tiles are half again as big, but a mound that deep hides more of itself than a
   flat board does, and only his eyes on the real screen settle whether that is a fair
   trade. `output/iterate/turtle-144-upright.png` and `spider-144-upright.png` are the
   captures to look at first. The lever is `BOARD.maxLayers` — 6 gives shallower boards at
   65–73 dp instead of 74–82.
2. **Is four opening pairs enough?** It is the guaranteed floor, not the average, and the
   floor is what a bad board feels like. `BOARD.minOpeningPairs` raises it; every step up
   costs footprint, and therefore tile size.
3. **The magnifier at 2× is bigger but softer** than the board around it, because the source
   tile art is only ~79 × 99 px. If it looks soft to him, the full-resolution tile pack is
   the fix, not more zoom (`docs/backlog.md`).
4. **Whether the celebrations wear out.** Eight of them, no immediate repeats, escalation
   every 3rd match — but 24 matches a board is a lot, and only a real session tells.
5. **Whether the greeting hero crop is tight enough.** A sliver of AI-garbled poster text
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
- ADR-0002 (accessibility-first constraints) is the project's spine: single tap only, fixed camera, 64 dp targets, 24 px minimum text, nothing punishing. Most design questions are already answered there. **ADR-0004 narrows exactly one clause** — the magnifying glass may be dragged. Nothing else may; the next feature that wants a gesture argues its own case.
- **Board sizing is settled by measurement, never by argument.** `npm run measure:boards` drives the real game in a real browser and prints tile size, footprint, layers and opening pairs for every board both ways up. Every number quoted in this file came from it. `npm run capture:boards -- <board>` saves the render.
- **`tileScale` in `ShapeGenerator.js` is an approximation on purpose** — it ignores perspective and is only there to rank one candidate footprint against another. It over-values tall stacks, which is why `BOARD.maxLayers` is a measured cap rather than something the score works out for itself. Don't "fix" it into a full projection without re-measuring the caps.
