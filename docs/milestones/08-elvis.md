# Milestone 08: Elvis

## Status

in-progress — implemented; the "does Nan like it" playtest AC awaits Chris

## Objective

Make the game unmistakably hers. Elvis on the greeting and win screens, and eight
photographs in place of the traditional flowers and seasons.

## Scope

- The 8 bonus tiles carry Elvis photographs, drawn over their atlas cells with a cream
  matte and a gold hairline so they still read as mahjong tiles. Chosen for faces and
  strong silhouettes, with a per-photo `focusY` so the square crop lands on him rather
  than a microphone stand.
- Greeting hero: the cropped Dawn-with-Elvis composite.
- Win and no-moves screens: a rotating portrait, so neither becomes wallpaper.
- The **elvis-spotlight** celebration (milestone 05) is reserved for Elvis pairs.
- Graceland palette accents throughout the overlay: gold, deep green, Elvis red.

## Out of scope

- Elvis audio of any kind — see milestone 06.
- An all-Elvis deck. 34 photo faces would be much harder to tell apart than tile art.

## Dependencies

- **Depends on:** milestone 03 (the atlas), 04 (screens to put portraits on)
- **Blocks:** nothing

## Acceptance criteria

- [x] The eight bonus tiles render photographs and any two of them match each other — test: `tests/rules.spec.js::any Elvis tile matches any other Elvis tile`
- [x] A failed photo load leaves the sheet's flowers and seasons in place and the board playable — guarded in `loadTileAtlas()`
- [x] The greeting hero loads — test: `tests/experience.spec.js::the greeting hero photo actually loads`
- [ ] The Elvis faces are recognisable at tile size on her tablet — verified by user playtest
- [ ] Nan likes it — verified by user playtest, and the only acceptance criterion that really counts

## Exit condition

Dawn opens the game, sees herself standing next to Elvis, and finds him again on the
tiles.

## Notes

- The photographs are third-party publicity images on a public URL — fine for a family
  gift, noted in `docs/tech.md`. The two `dawn-with-elvis-*` images are generated
  composites; the greeting crop is framed tight on the two faces because their
  backgrounds contain AI-garbled poster text.

## Test plan

- `npx playwright test` — 76 specs. `tests/experience.spec.js` covers this milestone.
- `npm run verify:build` before any deploy that touches assets or paths.
- Manual: Chris on the live URL, ideally on Dawn's tablet.
