# Milestone 07: Save and carry on

## Status

in-progress — automated ACs green; the multi-day playtest AC awaits Chris

## Objective

Let her put the tablet down mid-game — mid-pair, even — and pick it up days later
exactly where she left it. This is the feature that makes the game fit an armchair
rather than a sitting.

## Scope

- `src/systems/SaveSystem.js` — one versioned `localStorage` key
  (`dawns-mahjong/v1`) holding the board in progress, her settings, and boards
  completed.
- Autosave after every match, hint and mix.
- The greeting offers **"Carry on — N tiles left"** only when there is genuinely a
  part-played board.
- Resuming deals the saved board straight back with no entrance animation, then
  **re-derives** freeness and the stuck check from the rules rather than trusting the
  save.
- A finished or dead-ended board is cleared from the save; boards-completed persists.

## Out of scope

- Multiple save slots, undo history, cloud sync, or accounts.

## Dependencies

- **Depends on:** milestone 02 (board state), 04 (a greeting to offer it on)
- **Blocks:** nothing

## Acceptance criteria

- [x] A part-played board is offered back with the correct tile count and resumes exactly — test: `tests/experience.spec.js::a part-played board is offered back, and resumes where she left it`
- [x] A first-time visitor is offered nothing to carry on with — test: `::a fresh visitor is not offered a game to carry on with`
- [x] Settings survive a reload — test: `::the sound choice is remembered`
- [x] A corrupt, absent, or wrong-version save degrades to "no save" rather than throwing — guarded in `SaveSystem.read()`; boot stays clean — test: `tests/boot.spec.js::boots with a clean console`
- [ ] A board left overnight is still there the next morning on her tablet — verified by user playtest

## Exit condition

Chris plays half a board, closes the tab, reopens it, presses *Carry on*, and finds the
same board with the same tiles gone.

## Notes

- Storage access itself can throw in private-browsing modes, so it is probed once and
  treated as absent if unavailable. Losing a save is a nuisance; crashing on boot would
  leave her with a game that never opens.

## Test plan

- `npx playwright test` — 76 specs. `tests/experience.spec.js` covers this milestone.
- `npm run verify:build` before any deploy that touches assets or paths.
- Manual: Chris on the live URL, ideally on Dawn's tablet.
