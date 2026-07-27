# Milestone 02: Matching rules & a playable game

## Status

planned

## Objective

Make the board playable. This milestone delivers the complete rule set — free-tile detection, tap-to-select, pair matching, guaranteed-solvable board generation, the win state, the dead-end state, and the assist economy of 10 hints plus 3 reshuffles. After this milestone the game is winnable and losable by tapping alone, with placeholder tile faces and no polish. The rules live in pure functions with no Three.js or DOM imports, because a rules bug is the one class of defect the player could never work around and the one most worth testing exhaustively.

## Scope

- `src/board/BoardRules.js` (pure) — `isFree(tile, tiles)`, `matches(a, b)`, `availablePairs(tiles)`, `remainingCount(tiles)`.
- `src/board/BoardGenerator.js` (pure) — solvable face assignment for a given layout, plus `shuffleRemaining(tiles)` that redeals the remaining faces into the remaining positions and is likewise guaranteed solvable.
- `src/systems/InputSystem.js` — pointer/touch → raycast → tile pick. Rejects taps on blocked tiles silently; tap-again deselects; tap-elsewhere moves the selection.
- **Tap forgiveness** (promoted from the backlog, decided 2026-07-27): a tap that misses every tile still selects the nearest *free* tile within a forgiveness radius, but only when exactly one free tile qualifies — an ambiguous near-miss does nothing. This is what makes the 144-tile turtle usable at 47 dp per tile on a 10–11" tablet without altering the traditional layout, so it is load-bearing here, not polish.
- Match flow: select → match → both tiles marked cleared and removed from the scene (placeholder instant removal; the celebration animations arrive in milestone 05).
- Mismatch flow: both tiles deselect after a short beat. No penalty of any kind.
- Assists: `hint()` pulses one currently-available pair and decrements from 10; `shuffle()` redeals and decrements from 3. Both disabled at zero.
- End states: all tiles cleared → `board:cleared`; no available pair and zero reshuffles → `game:no-moves`. Both emit events and set `GameState.screen`; the actual screens are milestone 04's job — a placeholder text overlay is enough here.
- Elvis-group matching: the 8 bonus tiles all match each other (gameplan rule), implemented as a face group rather than eight special cases.
- Extend `render_game_to_text()` with the fields tests need: free-tile ids, available pair count, selection, assists remaining, cleared count.

## Out of scope

- Match celebration animations and particles → milestone 05. Cleared tiles just vanish here.
- Real tile faces → milestone 03.
- Styled win / no-moves screens, greeting screen, styled buttons → milestone 04.
- Audio feedback on select / match / mismatch → milestone 06.
- Persisting the in-progress board → milestone 07.
- Undo — **decided against** on 2026-07-27. A mis-tap cannot create a wrong match, so undo would only cover a legitimate move regretted later, at the cost of a move history in `GameState` and another button on screen. Do not add it without a new decision from Chris.
- Highlighting all tiles matching the selection (backlogged as an optional "Dawn mode").

## Dependencies

- **Depends on:** milestone 01 (lattice coordinates, tile meshes, state shape)
- **Blocks:** milestones 05, 07

## Acceptance criteria

- [ ] `isFree()` is correct across a hand-built truth table: covered above, covered partially above, blocked both sides, free left only, free right only, free both, board edge cases, and top-of-stack — test: `tests/rules.spec.js::isFree truth table`
- [ ] A tile covered by *any* overlapping tile on the layer above is not free, including a half-overlap that only clips one corner — test: `tests/rules.spec.js::partial cover blocks a tile`
- [ ] `matches()` is true for identical faces, false for different faces, and true for any two Elvis tiles — test: `tests/rules.spec.js::matching including the Elvis group`
- [ ] A generated `easy-72` board is solvable: a greedy solver following the generator's own order clears all 72 tiles, over 200 seeded generations — test: `tests/generator.spec.js::easy-72 boards are always solvable`
- [ ] A generated `turtle-144` board is solvable over 200 seeded generations — test: `tests/generator.spec.js::turtle-144 boards are always solvable`
- [ ] Every generated board contains a legal multiset: 4 of each of the 34 faces + 8 Elvis for turtle-144; 2 of each + 4 Elvis for easy-72 — test: `tests/generator.spec.js::face multiset is legal`
- [ ] `shuffleRemaining()` preserves the exact multiset of remaining faces, changes at least one position, and yields a solvable arrangement — test: `tests/generator.spec.js::shuffle preserves tiles and stays solvable`
- [ ] Tapping a free tile selects it; tapping it again deselects; tapping another free tile moves the selection — test: `tests/play.spec.js::selection behaviour`
- [ ] Tapping a blocked tile does nothing — no selection change, no event emitted — test: `tests/play.spec.js::blocked tiles ignore taps`
- [ ] A tap in the felt just outside a single free tile selects that tile; a tap in a gap that is near two or more free tiles selects nothing; a tap well away from any tile selects nothing — test: `tests/play.spec.js::tap forgiveness only resolves unambiguous near-misses`
- [ ] Every tile of a `turtle-144` board at a 1024×640 tablet viewport is reachable by a tap at its centre despite 47 dp tiles — test: `tests/play.spec.js::turtle tiles are all tappable on a small tablet`
- [ ] Tapping a matching free tile clears both and drops the remaining count by 2 — test: `tests/play.spec.js::matching pair clears`
- [ ] Tapping a non-matching free tile clears the selection and removes no tiles — test: `tests/play.spec.js::mismatch clears selection only`
- [ ] `hint()` returns a pair that is genuinely available and decrements 10 → 0, then becomes a no-op — test: `tests/assists.spec.js::hints are valid and finite`
- [ ] `shuffle()` decrements 3 → 0, then becomes a no-op — test: `tests/assists.spec.js::reshuffles are finite`
- [ ] Clearing the final pair emits `board:cleared` and sets the win screen — test: `tests/play.spec.js::clearing the board wins`
- [ ] A board with no available pair and zero reshuffles emits `game:no-moves`; with reshuffles remaining it does **not** — test: `tests/play.spec.js::dead end only ends the game with no reshuffles left`
- [ ] A full 72-tile game can be played to a win entirely through synthesised taps — test: `tests/play.spec.js::plays a full board to completion by tapping`
- [ ] Tapping tiles feels immediate and accurate on a real touchscreen — no missed taps, no wrong tile picked at the edges — verified by user playtest

## Exit condition

Chris plays an `easy-72` board from first tap to last using only taps → observes the board clear completely and the win state appear, having used a hint and a reshuffle along the way.

## Test plan

Red-then-green, rules first since they're pure and fastest to iterate:

1. `tests/rules.spec.js` — hand-built fixtures, no renderer. The `isFree` truth table is the single most important test in the project.
2. `tests/generator.spec.js` — seeded generation (inject the RNG so runs are reproducible) then programmatic solving. 200 iterations each; if that's slow, drop to 50 in the default run and keep 200 behind a flag.
3. `tests/play.spec.js` and `tests/assists.spec.js` — drive the live game via Playwright taps at projected tile screen positions, asserting through `render_game_to_text()`.
- Regression command: `npx playwright test`.
- Manual playtest: on the actual tablet if it's to hand, otherwise Chris's phone or a touchscreen — tap accuracy is the one AC that a mouse cannot honestly verify.

## Notes

- **Solvable generation works backwards.** Don't shuffle faces onto positions and hope. Instead: with all positions occupied by blank tiles, repeatedly find two positions that are currently free, assign them a matching pair, and mark them removed for the purposes of the simulation; continue until every position has a face. The reverse of the assignment order is a guaranteed valid clearing order. This is also exactly what `shuffleRemaining()` does over the surviving positions.
- Seed the RNG through an injected function rather than calling `Math.random()` inside the generator, or the solvability tests can't reproduce a failure.
- The greedy solver used in tests is a test fixture, not gameplay code — it may follow the generator's known-good order rather than solving from scratch. A general solver is a much harder problem and not what these ACs need.
- `availablePairs()` is called on every hint and on every clear (to detect dead ends), on up to 144 tiles. Naive O(n²) is fine at this size; do not optimise it before measuring.
- The free-tile test reads directly off the milestone 01 half-tile lattice: a tile's left side is blocked if any same-layer tile occupies the cell immediately left and overlaps it vertically. Keep that logic in one function.
