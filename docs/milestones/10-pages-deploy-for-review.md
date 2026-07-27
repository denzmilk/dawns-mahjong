# Milestone 10: GitHub Pages deploy, early, for review

## Status

in-progress — deployed and verified live; only the on-tablet playtest AC remains

## Objective

Get the game onto a real URL now, so Chris reviews builds at
`https://denzmilk.github.io/dawns-mahjong/` — on Dawn's actual tablet, over her
actual wifi — instead of running a dev server locally. Pulled forward out of
milestone 09 at Chris's request on 2026-07-27: reviewing on the target device is
worth far more than reviewing on a desktop browser, and every remaining milestone
has acceptance criteria that only that device can honestly settle.

This is the **deploy half** of milestone 09 only. Milestone 09 keeps the PWA work:
web app manifest, service worker, offline play, and the "Install on this tablet"
button. Numbered 10 because it was created after 01–09 and the agreed ladder is
not renumbered; it runs out of order by design.

## Scope

- `.github/workflows/deploy.yml` — build on every push to `main`, plus
  `workflow_dispatch` for on-demand review builds.
- `npm run verify:build` (`scripts/verify-build.mjs`) — serves `dist/` from a
  `/dawns-mahjong` subpath in a real headless browser and fails on console
  errors, HTTP 4xx, assets requested outside the subpath, a missing font, or a
  board that didn't render. Runs in CI as a deploy gate.
- Enable Pages with `build_type=workflow` via the API.
- Confirm the live URL renders the board and loads the font.

## Out of scope

- Web app manifest, service worker, offline play, install button → milestone 09.
- A custom domain. `denzmilk.github.io/dawns-mahjong/` is fine for a gift.
- Any change to the game itself. This milestone only ships what already exists.
- Build-size work — Chris confirmed on 2026-07-27 that download size is not a
  concern, so the 535 KB bundle and 9 MB of photographs stay as they are.

## Dependencies

- **Depends on:** milestone 01 (something to deploy)
- **Blocks:** nothing. Milestone 09 later builds the PWA layer on this workflow.

## Acceptance criteria

- [x] `npm run verify:build` serves the production build from a project-site
      subpath and passes — no absolute asset URLs, font loads, 72 tiles render —
      test: `scripts/verify-build.mjs` (a script rather than a spec: it needs its
      own static server on a subpath, which the Playwright config's single dev
      server can't provide)
- [x] A push to `main` builds and deploys without manual steps — verified by
      workflow run 30250591845 (build, verify, deploy all green)
- [x] The workflow fails the deploy rather than publishing a build that breaks on
      the subpath — verified by the `verify:build` gate running in CI
- [x] `https://denzmilk.github.io/dawns-mahjong/` loads over HTTPS with a clean
      console and renders the full 72-tile board — verified at a 1024×640 tablet
      viewport: HTTP 200, 72 tiles, tiles 68.1 dp, font loaded, no console or
      network problems
- [x] `?layout=turtle-144` works on the live URL — 144 tiles, 47.2 dp, clean
- [ ] The live URL loads and plays acceptably **on Dawn's tablet** — verified by
      user playtest

## Exit condition

Chris opens `https://denzmilk.github.io/dawns-mahjong/` on the tablet → sees the
board, and every later review happens at that URL without a local dev server.

## Test plan

- `npm run verify:build` locally before pushing, and again in CI as the deploy gate.
- After the run completes, load the live URL headlessly and assert a clean console,
  no 4xx, and 72 tiles.
- Manual: Chris opens the URL on the tablet.

## Notes

- **Relative `base: './'` is what makes a project site work**, and Vite correctly
  rewrites even the `/assets/fonts/...` URLs inside bundled CSS to `../assets/…`.
  That was verified rather than assumed, because it is the single most common way
  a Pages project site breaks — and it breaks silently, resolving assets against
  `denzmilk.github.io/` instead of the repo path.
- The verify script filters exactly two headless-only console artifacts (the ANGLE
  readback warning and an intermittent `CONTEXT_LOST_WEBGL` that fires in about one
  run in four while the board still renders correctly). Everything else fails the
  build. In-app recovery from genuine context loss is a backlog item, and it matters
  for a tablet that sleeps mid-game.
- Milestone 09 will need the manifest and service-worker paths to be relative for
  exactly the same reason as the assets above, and `verify:build` is where that gets
  proven.
- The run logs a deprecation annotation: `actions/checkout@v4`, `setup-node@v4` and
  `upload-artifact@v4` target Node 20 and are being forced onto Node 24. Harmless
  today and the deploy is green; bump the action majors when one of them actually
  breaks rather than guessing at versions now.
- Live measurements at 1024×640 match the local ones exactly (68.1 dp for easy-72,
  47.2 dp for the turtle), so the local tablet-viewport tests are a trustworthy
  proxy and reviews don't need a device to catch layout regressions — only to
  settle how it *feels*.
