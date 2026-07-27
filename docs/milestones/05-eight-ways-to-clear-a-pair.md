# Milestone 05: Eight ways to clear a pair

## Status

in-progress — automated ACs green; the "does it delight" playtest AC awaits Chris

## Objective

Make clearing a pair worth doing 36 times a board. Eight different 3D celebrations,
picked at random with no immediate repeat, plus an entrance animation that deals the
board and a finale when the last pair goes. All scripted interpolation, not simulation
(ADR-0003), so every one ends in the same state at the same time and steps
deterministically under `advanceTime()`.

## Scope

- `src/fx/Celebrations.js` — the eight: **rocket-collide** (both tiles fly up, meet
  dead centre, burst), **crumble** (fracture into a 3×3 shard grid that tumbles),
  **fireworks** (climb, then a two-ring burst each), **spin-shrink**, **flip-away**
  (end over end, thinning to an edge), **vortex** (swirl up and in), **confetti-pop**,
  and **elvis-spotlight** (a sweeping cone of light and a shower of rhinestones,
  reserved for Elvis pairs).
- `src/fx/Particles.js` — one pooled `THREE.Points` system for every burst in the
  game. Pooled because create/destroy churn per celebration is what drops frames on a
  tablet GPU, and this fires on every match.
- Entrance: tiles fly in and stack themselves, bottom layers first.
- Escalation every 6th match, and a rolling multi-volley finale on board clear.

## Out of scope

- Sound for the celebrations → milestone 06.
- Screen shake, hue-cycling backgrounds, and combo text. The design skills recommend
  all three for social-clip appeal; they are rejected here because the audience is one
  90-year-old in an armchair, not a scrolling feed.

## Dependencies

- **Depends on:** milestone 02 (something to celebrate)
- **Blocks:** nothing

## Acceptance criteria

- [x] A match plays a celebration which finishes, hides its tiles, and leaves no stray shard meshes behind — test: `tests/experience.spec.js::a match plays a celebration that finishes and cleans up`
- [x] Consecutive matches never play the same celebration twice in a row, and several different ones appear across eight matches — test: `::celebrations vary from match to match`
- [x] Particles all die: none left alive after the animation — test: `::a match plays a celebration that finishes and cleans up`
- [x] The board is playable throughout — a tile in flight never swallows a tap meant for what is underneath — test: `tests/play.spec.js::plays a full board to completion by tapping`
- [x] The render loop still idles when nothing is animating — test: `tests/hooks.spec.js::render loop idles when static`
- [ ] The celebrations delight rather than annoy on the 40th repetition — verified by user playtest

## Exit condition

Chris clears ten pairs and sees several different celebrations, none repeating
back-to-back, with the board still instantly playable throughout.

## Notes

- Shadows are re-rendered only when the board changes, not per animated frame. With
  144 casters, re-shadowing every frame dominated the frame cost.
- The tiles are logically cleared *before* the celebration plays: the animation is
  theatre over a decision already made, so the board never waits on it.

## Test plan

- `npx playwright test` — 76 specs. `tests/experience.spec.js` covers this milestone.
- `npm run verify:build` before any deploy that touches assets or paths.
- Manual: Chris on the live URL, ideally on Dawn's tablet.
