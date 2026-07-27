# Milestone 03: Real tile faces from the supplied sheet

## Status

planned

## Objective

Replace the placeholder faces with the actual mahjong art Chris supplied. The source is a single 1024×1024 *preview* sheet (`public/assets/tiles/mahjong-tiles-sheet.png`) containing all 42 faces laid out in labelled rows with drop shadows — not a clean sprite sheet. This milestone measures the 42 face rectangles out of that image, crops them into one runtime texture atlas, maps each tile's geometry to its face via baked UVs, and lifts the sheet's gold Greek-key border out as the table-edge texture so the board and the tiles are visibly one set. It comes after the rules because a playable ugly game is worth more than a beautiful dead one — but before the accessibility pass, because "can she tell a 3-bamboo from a 4-bamboo at arm's length" is a legibility question that can only be answered with the real art on screen.

## Scope

- A one-off measuring script (`scripts/measure-tile-sheet.mjs`, run manually, output committed) that detects the ivory tile rectangles in the sheet and emits the 42 crop rectangles plus the border crop as data for `Constants.js`. Detected, not hand-eyeballed, so a re-exported sheet can be re-measured in one command.
- `src/assets/TileSheet.js` — loads the PNG once, crops the 42 faces into an offscreen canvas atlas, uploads a single `THREE.Texture` (correct colour space, mipmaps, anisotropy).
- Face-id → atlas-cell mapping for all 42 faces: dots 1–9, bamboo 1–9, characters 1–9, winds E/S/W/N, dragons red/green/white, and the 8 bonus slots (which carry placeholder art here — the Elvis photos land in milestone 08).
- Baked per-tile UVs on the tile box geometry so all 144 tiles share **one** material.
- Ivory tile sides and top bevel colour matched to the sheet's tile art rather than guessed.
- Table: green felt surface plus the gold Greek-key border cropped from the sheet, tiled along the table edge.
- Drop shadow / contact shading under each tile tuned so layer separation reads at tablet size.

## Out of scope

- Elvis photos on the 8 bonus tiles → milestone 08 (the atlas leaves those cells addressable and filled with placeholder art).
- Selection highlight, dimming of blocked tiles, and the type scale → milestone 04. Faces here render at uniform full brightness.
- Match animations → milestone 05.
- Downscaling / optimising the Elvis photos → milestone 09 (first-load weight).
- Any change to the sheet image itself — no re-authoring the art, no hand-drawn faces. If a face is unreadable at tile size, that's a finding for Chris, not a redraw.

## Dependencies

- **Depends on:** milestone 01 (tile geometry and materials), milestone 02 (face ids exist and mean something)
- **Blocks:** milestone 04 (legibility can't be judged without real faces), milestone 08 (needs the atlas cell mapping)

## Acceptance criteria

- [ ] The measuring script finds exactly 42 tile rectangles in the sheet, of consistent size (±4 px), and none overlapping a row label — test: `tests/tile-sheet.spec.js::sheet measurement finds 42 faces`
- [ ] The built atlas contains 42 distinct non-blank cells — no cell is uniform-coloured, and no two cells are pixel-identical — test: `tests/tile-sheet.spec.js::atlas cells are distinct and non-blank`
- [ ] Each face id maps to the correct atlas cell, spot-checked by sampling a known distinctive pixel region per face family (bamboo green, characters orange, dots blue) — test: `tests/tile-sheet.spec.js::face ids map to the right art`
- [ ] All tiles render from a single shared material — `renderer.info.programs` and material count assert exactly one tile material — test: `tests/tile-sheet.spec.js::tiles share one material`
- [ ] Two tiles of different faces read as visibly different on canvas pixel readback at their rendered size — test: `tests/tile-sheet.spec.js::different faces render differently`
- [ ] The tile sheet is fetched exactly once per load — test: `tests/tile-sheet.spec.js::sheet loads once`
- [ ] Draw calls for a full 144-tile board stay under 200 — test: `tests/perf.spec.js::144-tile board draw call budget`
- [ ] Chris can tell every face apart at arm's length on the target tablet, specifically the near-identical pairs (3 vs 4 bamboo, 6 vs 7 dots, red vs green dragon) — verified by user playtest
- [ ] The gold border and felt read as the same set as the tiles, not as a mismatched frame — verified by user playtest

## Exit condition

Chris looks at a full board on the tablet → observes real mahjong tiles with the supplied artwork on a green felt table with a gold border, and can name any tile he points at from normal viewing distance.

## Test plan

- The measuring script's output is committed as data, so `tests/tile-sheet.spec.js` asserts against that committed data as well as re-deriving it from the image in-browser via canvas — this catches both a bad measurement and a swapped sheet file.
- Atlas assertions run in the browser (canvas `getImageData` on the atlas canvas) and are written before `TileSheet.js` exists, so they fail on a missing module first.
- Distinctness is checked by mean-colour plus a coarse hash per cell rather than exact equality, so JPEG-ish softness doesn't cause false failures.
- Regression command: `npx playwright test`.
- Manual playtest: full 144-tile turtle on the tablet, at reading distance and again at arm's length, checking the three confusable pairs named in the AC.

## Notes

- The sheet is a **preview** image: faces sit at roughly 90×110 px with drop shadows and section headers around them. The measurement must find the ivory rectangle and exclude the shadow, or every tile gets a grey stripe down one edge.
- Faces at ~90 px are adequate for tablet tile size but not generous. If they read soft, the fix is a higher-resolution sheet from Chris (the `-preview-` in the original filename suggests a full pack exists) — swap the file, re-run the measuring script, done. Do not upscale or redraw.
- The sheet's blank white tile next to the three dragons is the traditional White Dragon back; treat it as the White Dragon face and confirm with Chris if it looks odd on the board.
- One material for 144 tiles requires per-tile UVs baked into per-tile geometry. That means 144 small `BufferGeometry` instances — cheap at this size, and it keeps the door open for merging later if the tablet complains.
- Colour space matters: load the sheet as sRGB and let the renderer handle output encoding, or the greens and oranges come out washed against the felt.
