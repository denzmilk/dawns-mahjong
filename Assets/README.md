# Drop zone

Chris's raw art drops go here — download straight into this folder with whatever filename it came with.

`npm run assets:sync` normalises the names (kebab-case, no spaces, no brackets) and moves them into
`public/assets/elvis/`, which is where Vite can actually serve them from at runtime. Nothing in this
folder is loaded by the game directly.

The mahjong tile sheet already lives at `public/assets/tiles/mahjong-tiles-sheet.png`.
