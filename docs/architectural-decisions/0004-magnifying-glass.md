# ADR-0004: A draggable magnifying glass

- **Status:** accepted — Chris, 2026-07-28: *"still make the magnifying glass a drag, that
  rule can be broken."* Implemented; the playtest ACs in milestone 12 remain open.
- **Date:** 2026-07-28
- **Supersedes:** part of [ADR-0002](0002-accessibility-first-constraints.md) constraint 1
  ("no drag") — narrowly, and only for the glass itself.

## Context

Dawn is 90. Tile faces are the whole game: a pair is two tiles with the same picture on
them, and if she cannot tell a five-of-circles from a six at a glance, nothing else about
the game matters.

Two things bound how big a tile can be, and both are now at their limit:

- **The board's footprint.** Boards are built into a mound on the footprint that measures
  biggest, and after the 2026-07-28 rebuild the 144-tile boards reach 73–94 dp upright on
  her tablet. There is no more to win there without cutting the tile count.
- **The source artwork.** Chris's tile sheet holds faces at roughly 79 × 99 px. Beyond about
  2× they stop gaining detail and start gaining blur.

So a permanent zoom is not available. What is available is a temporary one, over the part
of the board she is looking at.

Chris asked for it in these words: *"add a toggle for a magnifying glass — make it a big
draggable magnifying glass that can be used to increase the size of an area for
visibility."*

## Decision

**A magnifying glass she turns on from the bar and moves about the board with one finger.**

- **Off by default, remembered between sessions.** If she never needs it she never sees it;
  if she needs it once she needs it always, and hunting for the button every session would
  be its own small insult.
- **It re-renders, it does not zoom pixels.** The scene is drawn a second time through a
  camera aimed at the patch under the glass. A pixel zoom of a 75 dp tile is a bigger
  blurry tile; a re-render is a bigger tile.
- **2×.** Enough that three or four tiles fit inside the lens, which is what lets her
  compare a tile with its neighbours rather than peer at one in isolation. Also about where
  the source artwork gives out.
- **It has a handle.** A circle is a UI element; a magnifying glass is an object. She has
  held one.
- **A tap passes through it.** Tapping the magnified image of a tile plays that tile. The
  alternative — dragging the glass out of the way before every move — would make it a
  hindrance rather than a help.
- **It cannot be dragged off the screen.** It stops at the edge, because there would be no
  way to fetch it back.

## Why this needs an ADR

ADR-0002 constraint 1 says a single tap is the entire control scheme: *no drag, swipe,
pinch, double-tap, long-press, or multi-touch.* A draggable magnifying glass is a drag.

That constraint exists to stop her reaching a state she cannot get out of — a pinch-zoomed
page, a rotated camera, a selection highlight she cannot clear. The glass does not create
any such state:

- it changes nothing about the board or the game, only what is drawn over it;
- it cannot leave the screen, so it can always be moved or switched off;
- one press of the bar button puts it away, and the button is lit while it is out;
- and it does not exist at all unless she asks for it.

The exception is also **scoped to the glass**, not to the game. `InputSystem` asks once, on
pointer-down, whether the press landed on the glass. If it did not — anywhere else on the
board, which is nearly everywhere — the old rules apply exactly: a drag is not a tap, a long
press is not a tap, a second finger cancels. `tests/magnifier.spec.js` asserts that a drag
on the board with the glass out still selects nothing and moves nothing.

Every other clause of ADR-0002 stands unchanged. The camera still never responds to input;
the glass moves, the viewpoint does not.

## Consequences

- **A second render pass while the glass is out.** Two draws of the board per frame instead
  of one, and only when she has it on. Render-on-demand means a still board is still drawn
  once and then left alone.
- **The bar gained a sixth button**, which pushed it onto two rows in landscape and cost
  13 dp of tile size until the padding was tightened. Recorded because it is the kind of
  cost that is invisible until measured.
- **Tile art resolution is now the visible limit.** At 2× the faces are legibly bigger but
  soft. The full-resolution tile pack, if Chris has it, is worth more than it was
  (`docs/backlog.md`).
- **A precedent to be careful with.** The next feature that wants a drag must argue its own
  case here; this ADR licenses one magnifying glass, not a gesture vocabulary.

## Alternatives considered

- **A permanent zoom with the board scrolled.** Rejected: scrolling is a drag with state,
  and a board she can lose the edges of is exactly what ADR-0002 forbids.
- **A fixed magnifier that follows the selected tile.** Rejected: it helps after she has
  chosen a tile, and the hard part is choosing one.
- **Bigger tiles by cutting the 144-tile boards.** Rejected by Chris on the same day — he
  wants the big boards kept and made bigger, which is what the mound rebuild did.
- **Tap-and-hold to magnify.** Rejected: a long press is not a tap (ADR-0002) and a
  90-year-old's press is not reliably short.
- **A DOM element over the canvas with a CSS transform.** Rejected: it can only scale pixels
  already drawn, which is the one thing the glass must not do.
