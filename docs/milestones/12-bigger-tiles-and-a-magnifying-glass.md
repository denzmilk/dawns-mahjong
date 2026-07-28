# Milestone 12: Bigger tiles, and a magnifying glass

## Status

in-progress — automated ACs green (92 specs); the playtest ACs await Chris, then Dawn.
Chris approved the sizing and accepted ADR-0004 on 2026-07-28 without playing it yet.

Depends on: milestone 11 (the boards this reshapes) and ADR-0004 (the magnifier, accepted).

## Objective

Two asks from Chris on 2026-07-28, both about the same thing — she has to be able to see
the tiles.

1. **Cut the boards under 48 tiles.** "Too small and simple, gran won't like those." The
   24- and 36-tile boards were added a day earlier to buy tile size; they bought it by
   ending the game before it started.
2. **Make the 144-tile boards' tiles nearly as big as the 48-tile board's**, by stacking
   them higher on a smaller footprint. "Keep the design loosely, but make its overall
   horizontal and vertical footprint lessened."
3. **A big draggable magnifying glass**, on a toggle, for anything still too small.

## Scope

### The boards under 48 tiles are gone

`quick-24` and `garden-36` deleted. **`steps-48` is the new default** (`LAYOUT_DEFAULT`).
Ten boards remain: nine fixed plus the surprise board. A stored preference for a deleted
board falls back to the easy board, which `Ui.setLayoutChoice` already handled.

### Boards are built as a stepped mound, on a searched footprint

`buildSteppedBoard` in `src/board/ShapeGenerator.js` replaces `buildStackedBoard`, and
takes over the two dead builders beside it (`buildFittedBoard`, `fitShapeToScreen`).

- **The footprint is searched, not derived.** Rows and columns are tried independently and
  each candidate is scored by how big its tiles would come out (`tileScale`). The previous
  builder pinned the footprint's proportions to the screen's, which is wrong: the stack
  reaches *up* the screen, so the best footprint is wider and shallower than the screen by
  exactly the height the mound is about to claim. This single change is most of the gain in
  landscape (58 → 79 dp on the 144-tile boards).
- **The mound steps inward as it rises.** Each level is an erosion of the one below, so
  support is automatic; one layer per level, with the remainder stacked on the base because
  the widest level is the cheapest place to buy capacity in screen height. Every step
  leaves a ledge of tappable tiles — a straight-sided tower only ever offers the two ends
  of its top row, however many tiles are underneath it.
- **`BOARD.maxLayers: 8`**, measured: 6 → 8 lifted the 144-tile boards from 65–73 dp to
  74–82. Ten gained one more dp and nothing else, because past 8 the tower leans far enough
  toward the camera that perspective shrinks the far bottom row by as much as the narrower
  footprint gained.
- **The surprise board goes through the same builder.** It used to skip it and came out
  smallest of all at 49 dp; now only its silhouette is generated and the mound is built like
  any other board's.

### The opening of a board is guaranteed

`BOARD.minOpeningPairs: 4`. `assignPairs` places the first few pairs on tiles that are free
*before anything has been cleared*, so a deep mound cannot open as a wall with one legal
move on it. A reshuffle gets the same guarantee — a *Mix up* she has to spend a hint on
afterwards is not a rescue.

This is what let `BOARD.minPlayable` come down from 14 to 10, which is what let the
footprints shrink. Free tiles were always a poor proxy for pairs on offer: boards passing at
14 still opened with two.

### The camera fit slides by shearing, not by moving

`CameraSystem.frame` now offsets the *projection* to slide the fitted board onto the strip
the bar leaves free, instead of moving the look-at target. Moving the camera off-centres the
board relative to the view axis, so the frustum grows on both sides to keep it in — a bar on
one side cost tile size on both. This is the fix
[`docs/backlog.md`](../backlog.md) has been describing since 2026-07-27, and it also
removed two tiles that sat a couple of pixels off the left edge on three of the 144-tile
boards, where they could not be tapped at all.

### The magnifying glass (ADR-0004)

`src/systems/MagnifierSystem.js`, a bar toggle, and one drag path in `InputSystem`.

- Off by default, remembered between sessions.
- 2× — enough that three or four tiles fit inside it, and about where the ~79 × 99 px source
  artwork gives out.
- It **re-renders** the scene through a zoomed camera into a render target rather than
  scaling pixels already drawn.
- Dragged by the glass or its handle; clamped so it can never leave the screen.
- **Tapping through it plays the tile she can see**, so it never has to be moved out of the
  way to make a move.
- The drag is scoped to the glass: `InputSystem` asks once, on pointer-down. Everywhere else
  a drag is still not a tap.

### Two bugs this surfaced

- **A tap that cleared the last pair skipped the win screen.** A tap arrives twice — as a
  pointer event and again as the click the browser synthesises after it — and the second one
  pressed whichever button had appeared under her finger. A screen that has just appeared
  now ignores taps for `TIMING.screenSettle` (0.35 s).
- **The bar wrapped onto two rows in landscape** once it had six buttons, taking 184 px of a
  600 dp screen and 13 dp off every tile. Only the padding inside the buttons was cut; the
  labels and the 64 dp minimum are untouched.

## Out of scope

- **Re-dealing on rotation.** A board turned mid-game keeps the mound it was dealt with, so
  its tiles measure smaller until the next board. Replacing the board she is playing because
  she moved the tablet would be worse.
- **Higher-resolution tile art.** The magnifier makes it worth more than it was, but the
  source sheet is what it is — `docs/backlog.md`.
- **A drop shadow under the glass.** Polish; it reads clearly enough without one.

## Acceptance criteria

- [x] No board under 48 tiles is offered; the menu holds ten buttons and the default is
      `steps-48`.
- [x] Every fixed board clears **64 dp** per tile on her tablet, upright *and* on its side —
      a promise only the two smallest boards used to make. (`tests/layout.spec.js`)
- [x] Each 144-tile board measures at least 80% of the 48-tile board's tiles upright.
      Measured: 73–94 dp against 90, from 58 dp before.
- [x] No tile is ever clipped by the screen edge, at four tablet viewports.
- [x] Every board — the surprise board included — opens with at least four pairs showing,
      both ways up.
- [x] The magnifier is off until she presses the button, and the button is lit while it is
      out.
- [x] It comes back next session if she left it out.
- [x] It follows her finger and stops at the edge of the screen.
- [x] A drag anywhere off the glass still selects nothing and moves nothing (ADR-0002).
- [x] A tap through the glass selects the tile she can see through it.
- [x] The glass draws something different from what it covers — it is magnifying, not
      decorating — and its gold rim is where the game says it is.
- [x] Clearing the last pair leaves the win screen up.
- [x] Console clean; `npm run verify:build` green; 92 specs passing.
- [ ] **Playtest — Chris:** the 144-tile boards read as a board, not a stack of chimneys.
      A mound eight deep hides more of itself than a flat board does, and only his eyes on
      the real screen settle whether that is a fair trade for tiles half again as big.
- [ ] **Playtest — Chris:** four pairs showing on a fresh 144-tile board is enough to get
      going with. It is the floor, not the average, and the floor is what a bad board feels
      like.
- [ ] **Playtest — Chris:** the glass is obviously a magnifying glass, obviously draggable,
      and 2× is worth having.
- [ ] **Playtest — Dawn:** she can find the magnifier button, move the glass, and play
      through it — without being shown twice.
- [ ] **Playtest — Dawn:** 48 tiles is a game, not a warm-up.

## Exit condition

Chris plays every board on Dawn's tablet at
<https://denzmilk.github.io/dawns-mahjong/>, turns the magnifier on, drags it about, and
clears a pair through it — then gives it to Dawn and watches her do the same unprompted.
