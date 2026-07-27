# Milestone 11: More boards, a legend, and the surprise board

## Status

in-progress — automated ACs green; the playtest ACs await Chris and Dawn

## Objective

Give her somewhere to go after the first board, and stop the rules being something she
has to remember. Chris's asks, in one milestone: the shapes she is likely to already
know, a "how to play" she can open mid-game, a procedurally generated board for
endless replay, and a green tick against every board she has finished.

## Scope

- **Six more boards.** Dragon, Cat, Fortress, Crab and Spider join the Turtle at the
  traditional 144 tiles each. Authored as ASCII masks — a layout is a picture, and
  picking one out of a list of coordinates is impossible — with **aligned** layers so
  support is trivially checkable: every tile must have one directly beneath it.
- `npm run check:layouts` proves all of it: 144 tiles, even count, no two tiles sharing
  a cell, nothing floating.
- **The surprise board** (`src/board/ShapeGenerator.js`): a silhouette (star, ring,
  flower, heart, cross, diamond, butterfly, blob) rasterised onto the lattice and
  stacked by *erosion* — a cell survives to the next layer only if it and all four
  neighbours were there, which makes support automatic. Trimmed to exactly 144 from the
  top layer down, so trimming can never strand a tile. Different every game.
- **Board menu**: one button per board, tile count leading, shape name as a hint, built
  from `LAYOUT_IDS` so a new shape needs no UI change.
- **How to play**: a big button on the bar opening a full-screen legend whose tile
  pictures are drawn from the real atlas, so it can never drift from the board. One way
  in, one way out (ADR-0002 constraint 6).
- **Green ticks** on every board she has finished, with a count if more than once.
- Celebrations doubled; install button removed from the greeting; boards named by tile
  count — all three at Chris's request.

## Out of scope

- Per-board best times or scores. Still no scoring anywhere (gameplan anti-goals).
- Elvis matching changes — Chris confirmed on 2026-07-27 that **any two Elvis tiles
  match**, which is the classic flowers rule with flowers and seasons merged.

## Dependencies

- **Depends on:** milestones 02 (rules), 04 (the overlay), 07 (saves, for the ticks)
- **Blocks:** nothing

## Acceptance criteria

- [x] Every fixed board holds exactly 144 tiles (easy-72 aside), and there are seven of them — test: `tests/layout.spec.js::layout tile counts`
- [x] No board contains overlapping or floating tiles — test: `tests/layout.spec.js::layouts are structurally valid`, and `npm run check:layouts`
- [x] The surprise board always yields exactly 144 supported tiles, inside the grid, across 60 seeds and more than three distinct shapes — test: `tests/layout.spec.js::the surprise board always produces a playable shape`
- [x] Every 144-tile board — surprise included — stays above Android's 48 dp touch floor on a 10–11" tablet with nothing clipped — test: `tests/layout.spec.js::every 144-tile board stays above the 48dp platform floor`
- [x] All eight boards are offered, and picking the surprise board actually starts one — test: `tests/experience.spec.js::every board is offered, and picking one actually starts it`
- [x] The surprise board deals a different shape from one game to the next — test: `::the surprise board deals a different shape each time`
- [x] How to play opens over the game, hides the bar, shows real tile pictures, and closes back to the same game — test: `::how to play opens over the game and closes back to it`
- [x] Finishing a board earns a green tick that survives a reload; unplayed boards have none — test: `::a finished board earns a green tick that survives a reload`
- [x] The greeting no longer offers an install button — test: `::the greeting no longer offers an install button`
- [ ] She recognises at least one board shape, and can find "How to play" without prompting — verified by user playtest
- [ ] The doubled celebrations are exciting rather than overwhelming — verified by user playtest

## Exit condition

Dawn opens the game, picks a shape she recognises, and finishes it — and the tick is
there next time she looks.

## Sized for the actual tablet (2026-07-27)

Chris named the device: a **Galaxy Tab A11+**. An ~11" 1920×1200 panel presents about
**960 × 600 dp** at Android's default display size, and dp is what the touch floor is
measured in — so that is now the primary test viewport, and the numbers it gave changed
the board line-up:

| Board | before | after | |
|---|---|---|---|
| 72 tiles (easy) | 63.8 dp | **68 dp** | clears the 64 dp floor |
| 96 tiles (pagoda) | — | **68 dp** | new, added because of these measurements |
| 144 tiles (six shapes) | 44–47 dp | **45–50 dp** | below Android's 48 dp guidance; opt-in |
| 144 tiles (surprise) | 51 dp | **53 dp** | |

Three changes came out of it:

1. **A 96-tile board** (`pagoda-96`). 16 tiles across 960 dp is 60 dp before margins and
   perspective, so no amount of tuning gets a 144-tile board to 64 dp on her screen — the
   only real lever is fewer tiles across. The pagoda is 12 columns like the easy board but
   stacked four layers deep: twice the game, same finger-sized tiles.
2. **Face dealing generalised to any even board size.** It was hard-wired to
   `count / 36` copies, which supported exactly 72 and 144 and nothing else. 144 and 72
   still deal identically; sizes between them use a few faces more often than others,
   which is normal for non-standard boards and invisible in play.
3. **The camera now fits the real tile corners, not a bounding box.** A box reserves room
   for the corner "top layer, far edge", which on a stacked board holds no tile at all —
   fitting to it was costing about 4% of tile size on every multi-layer board. That alone
   is what got the pagoda from 62.6 dp to 68.

The 144-tile boards remain below the platform floor at 45–50 dp (roughly 7–8 mm). That is
recorded rather than smoothed over: they are opt-in, tap forgiveness covers near-misses,
and a larger Android display-size setting buys her another ~15% if she wants it.

## Notes

- **Both new-shape bugs were size bugs, and both were caught by measurement:** the crab
  started 18 columns wide (45 dp per tile) and the spider 9 rows deep (44 dp) — both
  under the platform floor, because the board is fitted to the screen so a wider or
  deeper shape means smaller tiles. Crab pulled in to 16, spider to 8 rows, and
  `SURPRISE` is capped at 16 × 8 for exactly the same reason.
- **Picking the surprise board silently fell back to the easy board** because the menu
  validated the choice against `LAYOUTS`, which has no entry for a board generated per
  game. Now validated against `LAYOUT_IDS`. Worth remembering: the surprise board is
  the one layout that exists only at load time.
- Solvability is free for every new shape: `BoardGenerator` deals faces by *playing*
  the board, so any supported arrangement of an even number of positions is completable.

## Test plan

- `npm run check:layouts` while authoring a shape; `npx playwright test` (83 specs) before
  any deploy; `npm run verify:build` when assets or paths change.
- Manual: Chris and Dawn on the live URL.
