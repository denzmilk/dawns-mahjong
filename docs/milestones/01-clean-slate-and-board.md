# Milestone 01: Clean slate & the board

## Status

in-progress — all 20 automated ACs green; the two playtest ACs await Chris

## Objective

Turn the emptied Jimothy scaffold into a booting mahjong runtime that renders a real, layered, tilted 3D board. This milestone delivers no gameplay — no selecting, no matching — but it stands up every structural piece the rest of the game hangs off: the `Constants` / `GameState` / `EventBus` core rewritten for mahjong, the two layout definitions as position data, tile meshes stacked in the right places with placeholder faces, a fixed tilted camera that frames the board responsively, and the `render_game_to_text()` / `advanceTime()` hooks. It exists as its own milestone because getting the coordinate system, layer ordering, and responsive framing right is the thing everything else assumes, and it is much cheaper to fix now than after the rules are built on top of it.

## Scope

- Strip the remaining Jimothy config: `package.json` name/description, remove the `cannon-es` dependency (ADR-0003), rewrite `index.html` and `src/style.css` for the mahjong overlay.
- `src/core/Constants.js` — tile dimensions, board geometry, camera tilt/framing, colours from the gameplan palette, animation durations, assist counts.
- `src/core/GameState.js` — tiles array (position, layer, face id, cleared flag), selection, assists remaining, current layout, screen. Plus `reset()`.
- `src/core/EventBus.js` — replace the Jimothy `Events` map with mahjong events (`tile:selected`, `tile:deselected`, `pair:matched`, `pair:mismatched`, `board:generated`, `board:cleared`, `game:no-moves`, `assist:hint`, `assist:shuffle`, …).
- `src/core/Game.js` — scene, renderer, render-on-demand loop, resize handling.
- `src/board/Layouts.js` — position data for **easy-72** and **turtle-144** as `{x, y, layer}` grid coordinates on a half-tile lattice (the standard mahjong convention that lets tiles half-overlap their neighbours below).
- `src/board/TileMeshes.js` — one tile geometry, ivory sides, placeholder canvas-drawn faces (readable digits/letters per face id), correct draw order and per-layer vertical offset, soft contact shadow.
- `src/systems/CameraSystem.js` — fixed ~20° tilt, no input response, frames the whole board with margin at any viewport aspect from 4:3 to 16:9.
- Suppress every non-tap gesture at the page level (ADR-0002 constraint 1): pinch-zoom, double-tap-zoom, text selection, overscroll, long-press context menu.
- `window.render_game_to_text()` and `window.advanceTime(seconds)`.
- `npm run assets:sync` — normalises new drops in `Assets/` into `public/assets/elvis/` (Chris keeps dropping photos there).

## Out of scope

- Tile picking, selection, matching, any rule logic → milestone 02.
- Real tile faces from the supplied sheet → milestone 03. Placeholders here are deliberately ugly and unambiguous.
- Greeting screen, HUD, buttons, fonts → milestone 04.
- Match animations, particles → milestone 05. Nothing animates in this milestone except the camera framing on resize.
- Audio, saves, Elvis, PWA → milestones 06–09.
- A dev-tools panel for tuning layouts (backlogged; add it only if layout work proves fiddly).

## Dependencies

- **Depends on:** ADR-0001 (stack), ADR-0002 (constraint 1 — fixed camera, tap only), ADR-0003 (no physics)
- **Blocks:** milestones 02, 03, 04

## Acceptance criteria

- [x] Game boots at `npm run dev` with an error-free and warning-free console — test: `tests/boot.spec.js::boots with a clean console`
- [x] The canvas renders a non-blank board (pixel readback finds tile ivory, felt green, and shadow tones) — test: `tests/boot.spec.js::canvas renders the board`
- [x] Both layouts render every tile they declare — test: `tests/boot.spec.js::renders every tile of both layouts`
- [x] `easy-72` layout contains exactly 72 positions; `turtle-144` contains exactly 144 — test: `tests/layout.spec.js::layout tile counts`
- [x] No two positions in a layout occupy the same lattice cell on the same layer, and every tile above layer 0 rests on at least one tile below it — test: `tests/layout.spec.js::layouts are structurally valid`
- [x] Every layout holds an even number of tiles (an odd count could never be cleared in pairs) — test: `tests/layout.spec.js::every layout holds an even number of tiles`
- [x] **(amended)** `easy-72` is symmetric about the vertical centre line — test: `tests/layout.spec.js::easy-72 is symmetric about the vertical centre line`
- [x] **(amended)** `turtle-144` matches the traditional 87/36/16/4/1 layer distribution, including its deliberate head/tail asymmetry — test: `tests/layout.spec.js::turtle-144 matches the traditional layer distribution`
- [x] **(amended)** `easy-72` tiles are at least 64×64 dp at every tablet viewport from 1024×640 up — test: `tests/layout.spec.js::easy-72 tiles meet the 64px minimum touch target on every tablet size`
- [x] **(amended)** `turtle-144` tiles stay above Android's 48 dp platform floor on a 10–11" tablet and clear 64 dp on a 12"+ one — test: `tests/layout.spec.js::turtle-144 stays above the 48dp platform floor, and clears 64 on a large screen`
- [x] The whole board is inside the viewport with margin at 1280×800, 800×1340, and 2560×1600 — no tile clipped at any of them — test: `tests/layout.spec.js::board frames at tablet viewports`
- [x] Higher layers render in front of lower layers with no z-fighting or wrong-order overlap — test: `tests/board-render.spec.js::upper layers occlude lower layers`
- [x] The centre of an uncovered tile always resolves to that tile (the accuracy guarantee milestone 02's input builds on) — test: `tests/board-render.spec.js::tapping the middle of a tile picks that tile`
- [x] Higher layers sit visibly higher on screen than the layers below them — test: `tests/board-render.spec.js::tiles stack upward with visible layer separation`
- [x] Pinch-zoom, double-tap-zoom, text selection, and long-press context menu are all suppressed — test: `tests/gestures.spec.js::only single taps reach the game`
- [x] Dragging, scrolling, and tapping never move the camera or shift a single tile on screen — test: `tests/gestures.spec.js::the camera never moves in response to input`
- [x] `render_game_to_text()` returns the documented JSON shape (layout id, tile counts, per-tile position/layer/face/cleared/screen rect, selection, assists, camera, time) — test: `tests/hooks.spec.js::render_game_to_text shape`
- [x] `advanceTime(1)` steps deterministically — two identical runs produce identical snapshots — test: `tests/hooks.spec.js::advanceTime is deterministic`
- [x] The render loop idles: with nothing animating, no new frames are drawn — test: `tests/hooks.spec.js::render loop idles when static`
- [x] A viewport change redraws and reframes the board — test: `tests/hooks.spec.js::a resize redraws and reframes the board`
- [ ] The board looks like a solid, physical, readable stack of tiles on a felt table — not a flat grid of rectangles — verified by user playtest
- [ ] The camera tilt reads as 3D depth without making back-row tiles hard to see — verified by user playtest

## Exit condition

Chris opens the game in a tablet-sized window → observes a gently tilted, clearly layered mahjong board of 72 tiles sitting on green felt, every tile individually readable, nothing clipped, console clean.

## Test plan

Written red-then-green, in this order: `tests/layout.spec.js` first (pure position data — fastest to make fail meaningfully), then `tests/boot.spec.js`, `tests/board-render.spec.js`, `tests/gestures.spec.js`, `tests/hooks.spec.js`.

- Layout tests import `Layouts.js` directly and assert on data — no renderer needed.
- Occlusion is asserted by pixel readback at a known screen point where an upper-layer tile overlaps a lower one, comparing against the lower tile's expected colour.
- Touch-target and framing checks project tile world positions to screen space via the live camera and measure the resulting footprint.
- Gesture suppression is driven with Playwright touch emulation (two-finger pinch, double tap, long press) asserting no viewport scale change, no selection, no context menu.
- Regression command for the next session: `npx playwright test` (auto-starts the dev server).
- Manual playtest steps for the two feel ACs: open at tablet width, look at the board from arm's length, confirm layers read as stacked and back tiles are legible.

## AC amendments made during implementation

Recorded rather than quietly rewritten, per the red-then-green rule — each of these
changed because reality contradicted the AC as written, not to make a test pass:

1. **"Both layouts are symmetric" → split in two.** The classic turtle is
   deliberately *not* left-right symmetric: 84 base tiles plus one head tile left
   and two tail tiles right. A symmetric base can't total 87, and 87 is what makes
   the layer counts add to 144. Symmetry is now asserted for `easy-72`; the turtle
   is asserted against its traditional layer distribution instead.
2. **The 64 dp touch-target AC → split, with a documented turtle limit.** Android
   reports CSS pixels as dp, so a 10.9" Tab A9+ presents roughly 1024×640 dp in
   landscape — not 1920×1200. At that size `easy-72` tiles measure 68 dp (passes),
   but the 15×8 turtle measures **47 dp** and cannot reach 64 dp without clipping.
   Rather than delete the check, the turtle now asserts Android's own 48 dp
   platform floor plus 64 dp on a 12"+ screen, so the constraint is visible and
   regression-proof. **This needs Chris's decision** — see Blockers in `docs/STATE.md`.
3. **Console cleanliness ignores GL driver messages.** Headless Chromium
   composites the WebGL canvas by reading it back and the ANGLE driver logs a
   `GPU stall due to ReadPixels` performance warning. It comes from the browser,
   not the game, and never appears on a real tablet. Only that pattern is
   filtered; everything the app logs still fails the test.

## Notes

- Layouts use the standard mahjong **half-tile lattice**: positions are on a grid of half-tile steps so a tile on an upper layer can straddle four tiles below it, which is what makes the turtle look like a turtle. Store positions as integer half-steps in `Layouts.js` and convert to world units in one place.
- The free-tile rule in milestone 02 depends entirely on this coordinate convention (left/right neighbour tests are "is there a tile overlapping my left edge on my layer"). Get the lattice right here or milestone 02 fights it.
- Placeholder faces should be *deliberately* unlike the final art — big black digits on white — so nobody mistakes milestone 01 output for finished work.
- Retained from the previous project and known to be true: headless WebGL screenshots composite black, so assert via canvas pixel readback; the first `advanceTime()` call switching to manual time is the intended deterministic-test behaviour.

### Implementation notes (2026-07-27)

- **The dev server runs on port 3100, not 3000, with `strictPort: true`.** Another
  of Chris's projects (`~/Projects/Jimothy`) holds 3000, and Vite's default is to
  slide silently to the next free port — which had the entire browser suite
  asserting against a different app while reporting sensible-looking failures.
  `strictPort` makes a future clash fail loudly instead.
- **Constants tuned against measurements, not taste:** `CAMERA.fov` 34 → 22 (a wide
  lens made near tiles much bigger than far ones), `TABLE.padding` 1.6 → 0.45 and
  `CAMERA.margin` 1.1 → 1.01 (the fit is vertical-space-limited, so padding came
  straight off tile width — at 1.1 the far row of `easy-72` measured 63.5 dp against
  a 64 dp floor), `TILE.thickness` 0.4 → 0.52 (at 0.4 the five turtle layers read as
  a flat mosaic), and ambient down / key up so each tile's shadow on the layer below
  actually reads.
- **The key and fill lights are positioned relative to the board centre**, not in
  absolute world space. A fixed light left half the turtle's upper tiles casting no
  visible shadow, because the turtle's centre sits far from `easy-72`'s.
- `three` r185 deprecates `PCFSoftShadowMap` (it silently falls back to `PCFShadowMap`
  and logs a warning) — use `PCFShadowMap`.
- The atlas machinery (single texture, single material, per-tile baked UVs) is
  already in place with placeholder art, so milestone 03 replaces the atlas *pixels*
  only and inherits the one-material draw-call budget.
- `window.__debug` carries the test-support hooks: `pickAt`, `readPixels`,
  `samplePoints`, and `capture()` (a PNG data URL, which is how `output/iterate/`
  captures are made). `samplePoints` exists because reading a whole 1280×800 buffer
  at dpr 2 means serialising four million values out of the browser.
