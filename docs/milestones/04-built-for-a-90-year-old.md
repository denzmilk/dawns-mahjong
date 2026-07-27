# Milestone 04: Built for a 90-year-old

## Status

in-progress — automated ACs green; the on-tablet playtest ACs await Chris

## Objective

Turn a working board into something Dawn can sit down with unaided: a greeting that
knows her name and the time of day, type she can read from her armchair, a selection
state that cannot be missed, unplayable tiles visibly knocked back, and buttons sized
for a 90-year-old's finger. This is the milestone that makes ADR-0002 real rather than
aspirational.

## Scope

- `index.html` + `src/style.css` — the whole HTML overlay and the type scale.
- `src/ui/Ui.js` — greeting, in-game bar, win screen, no-moves screen. Buttons only
  ever *emit* `ui:*` events; the game decides. The DOM and the 3D scene never import
  each other.
- Greeting: "Good morning / afternoon / evening, Dawn" from the tablet's own clock,
  the Dawn-with-Elvis photo, one big primary button, and a two-button board choice.
- In-game bar: tiles left, **Help me** (hints left), **Mix up** (mixes left),
  **Sound**, **Menu**. Every one at least 64 dp.
- Selection on four channels at once (ADR-0002 constraint 3): the tile lifts, gains a
  thick gold rim, pulses slowly, and casts a glow on the felt.
- Free tiles bright, blocked tiles dimmed, hinted tiles brightest — carried on a
  per-tile vertex colour so all 144 tiles still share one material.
- The gold Greek-key frame, cropped live out of Chris's tile sheet.
- A gentle nudge ("press Mix up") when the board is stuck but rescuable.

## Out of scope

- Sound → milestone 06. Saves → 07. Elvis tile faces → 08. Install → 09.
- Any second font, or any text below 24 px.

## Dependencies

- **Depends on:** milestone 03 (legibility can't be judged without the real faces)
- **Blocks:** nothing

## Acceptance criteria

- [x] The greeting names her and matches the tablet clock's part of day — test: `tests/experience.spec.js::greets Dawn by name, with the right part of the day`
- [x] The greeting photo actually loads (a broken portrait would be the first thing she sees) — test: `::the greeting hero photo actually loads`
- [x] Greeting ≥ 52 px, buttons ≥ 32 px, body ≥ 24 px — test: `::type is at or above the ADR-0002 floors`
- [x] Every button on every screen is at least 64 × 64 dp — test: `::every button meets the 64dp touch minimum`
- [x] Choosing a board and starting it shows the board and the bar, and hides the greeting — test: `::choosing a board and starting shows the board and the bar`
- [x] Unplayable tiles measure visibly dimmer than playable ones on screen — test: `::unplayable tiles are visibly dimmer than playable ones`
- [x] A selected tile lifts up the screen and gold appears at its edge — test: `::a selected tile lifts and gains a gold rim`
- [ ] She can find and use the bar without being told what the buttons do — verified by user playtest
- [ ] The selection is unmissable at arm's length on her tablet, in a lit room — verified by user playtest

## Exit condition

Dawn opens the game unaided, sees herself greeted by name, presses one big button, and
plays — with Chris watching and not helping.

## Test plan

- `npx playwright test` — 76 specs. `tests/experience.spec.js` covers this milestone.
- `npm run verify:build` before any deploy that touches assets or paths.
- Manual: Chris on the live URL, ideally on Dawn's tablet.
