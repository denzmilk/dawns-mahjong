# Session state

> Updated at the end of each session that made progress. Read first at the start of each session by the session-start sub-pipeline.

## Last updated

2026-07-27 by Claude (pivot from *Jimothy's Big Day Out* to *Dawn's Mahjong*, then milestone 01 implemented)

## Current phase

development

## Current milestone

Milestone 01 — [clean slate & the board](milestones/01-clean-slate-and-board.md) · **in-progress**: all 20 automated ACs green, the two playtest ACs await Chris.

## Last action

Two things in one session.

**The pivot.** Ran the idea phase for *Dawn's Mahjong* — mahjong solitaire for Chris's 90-year-old grandmother Dawn, on a Samsung tablet, Elvis-themed. Agreed: classic dead-end rules plus 3 reshuffles and 10 hints, easy-72 as the default board with the classic 144-tile turtle as an option, fixed-tilt 3D presentation, procedural audio, installable offline PWA on GitHub Pages, fresh public repo. Deleted all Jimothy code, docs, tests, and the 40 MB GLB; kept `EventBus.js`, the Vite/Playwright config, and the architecture. Wrote `gameplan.md`, `tech.md`, ADRs 0001–0003, `backlog.md`, milestones 01–03. Consolidated assets under `public/assets/` (tile sheet, 18 Elvis images, self-hosted Atkinson Hyperlegible) and cropped `greeting-hero.jpg` from the Dawn-with-Elvis composite.

**Milestone 01**, red-then-green. Wrote 20 failing tests first, then built: `Constants.js`, `GameState.js`, a mahjong `Events` map, `Game.js` (render-on-demand loop, shadows, centre-relative lighting), `Layouts.js` (both layouts on the half-tile lattice), `TileMeshes.js` (one texture + one material, per-tile baked UVs, placeholder faces), `CameraSystem.js` (fixed 20° tilt, exact analytic board fit), `main.js` with the test hooks, `index.html`, `style.css`, and `scripts/sync-assets.mjs`. Suite is 20/20 green in ~30 s. Captures in `output/iterate/`.

## Next step

**Chris playtests the board** — `npm run dev` (port 3100), ideally loaded on Dawn's tablet over the LAN with `npm run dev -- --host`. Two open playtest ACs: does the board read as a solid physical stack of tiles, and does the tilt give depth without hurting back-row legibility? Add `?layout=turtle-144` to see the 144-tile turtle. Then answer the turtle touch-target question below → milestone 02 (matching rules and a playable game).

## Decisions taken this session

- **No undo.** A mis-tap can't create a wrong match, so undo would only cover a legitimate regret, at the cost of a move history in `GameState`. Struck through in the backlog and marked out of scope in milestone 02 — don't reintroduce it without a fresh decision.
- **The turtle stays, with tap forgiveness.** Its 47 dp tiles are under the 64 dp rule, so milestone 02 gains a forgiveness radius: a near-miss selects the nearest free tile when exactly one qualifies. Promoted out of the backlog into milestone 02's scope with two ACs.

## Blockers

- **Milestone 01's two playtest ACs** need Chris's hands-on session: does the board read as a solid physical stack, and does the tilt give depth without hurting back-row legibility.
- **Which tablet is it?** Still unknown. `easy-72` clears 64 dp from 1024×640 up, so nothing is blocked today, but milestone 04 can't be signed off without a check on her actual screen.

## Notes for next session

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
