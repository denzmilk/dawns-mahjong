# Milestone 09: Onto her tablet

## Status

in-progress — automated ACs green; installing on the real tablet awaits Chris

## Objective

Make it behave like a normal app: its own icon on her home screen, no browser chrome,
and it opens with the wifi off.

## Scope

- `public/manifest.webmanifest` — standalone display, landscape, felt theme colour, and
  192 / 512 / maskable-512 icons. Every path relative, for the project-site subpath.
- `scripts/build-icons.mjs` (`npm run build:icons`) — renders the icons from the single
  favicon SVG, so there is one source of truth. The maskable variant insets its artwork
  inside the safe circle, or Android's launcher shaves the tile's corners off.
- `scripts/build-sw.mjs` — runs as part of `npm run build`, writing `dist/sw.js` with
  every built file precached and a cache name hashed from their contents, so a new
  build always lands in a fresh cache and the old one is deleted.
- `src/systems/InstallSystem.js` — a big **"Put this on my tablet"** button driven by
  `beforeinstallprompt`, with written fallback steps for Samsung Internet (which often
  never fires it), hidden once running standalone.

## Out of scope

- A PWA build plugin. The whole requirement is "cache these 32 files and serve them
  offline", which is a short enough service worker to read in one sitting, and it keeps
  the dependency list at three packages.
- Push notifications, background sync, an app store listing.

## Dependencies

- **Depends on:** milestone 10 (the deploy pipeline this builds on)
- **Blocks:** nothing

## Acceptance criteria

- [x] The manifest is served, is named, and uses only relative paths — test: `tests/experience.spec.js::the manifest and icons are served`
- [x] Every declared icon actually exists and is served — test: `::the manifest and icons are served`
- [x] A maskable icon is declared — test: `::the manifest and icons are served`
- [x] The built site works from the project-site subpath, service worker included — `npm run verify:build`, which is also the CI deploy gate
- [x] The service worker is not registered in dev, so changes never appear cached — guarded in `registerServiceWorker()`
- [ ] The game installs from the live URL onto Dawn's tablet, opens from its own icon, and plays with the wifi off — verified by user playtest

## Exit condition

Chris opens the live URL on her tablet, presses *Put this on my tablet*, and the game
opens from the home screen in aeroplane mode.

## Test plan

- `npx playwright test` — 76 specs. `tests/experience.spec.js` covers this milestone.
- `npm run verify:build` before any deploy that touches assets or paths.
- Manual: Chris on the live URL, ideally on Dawn's tablet.
