# ADR 0001: Engine and stack — Three.js + Vite, plain JavaScript

## Status

accepted

## Date

2026-07-27

## Context

This directory previously held *Jimothy's Big Day Out*, a Three.js + cannon-es physics comedy game. That project has been retired here (its code and history live on at `denzmilk/jimothys-big-day-out`) and the directory is being repurposed for a completely different game: **Dawn's Mahjong**, a tile-matching mahjong solitaire game built as a gift for Chris's 90-year-old grandmother to play on a Samsung tablet.

Because the game changed entirely, the previous project's ADRs are not carried forward — this ADR set starts fresh at 0001. The prior decisions remain readable in the Jimothy repository.

Forces in play for the new game:

- **The player is 90 and non-technical.** Anything that can fail, confuse, or need explaining is a defect. This dominates every other consideration.
- **The target device is an Android tablet**, touch only, possibly on patchy wifi, and the game must work with the wifi off entirely.
- **The visual brief needs real 3D**: tiles with thickness and shadow so stacked layers read clearly, plus eight varied 3D match celebrations (tiles rocketing and colliding, crumbling, fireworks).
- **A Three.js + Vite + Playwright scaffold already exists in this directory** and is known to work, including the `render_game_to_text()` / `advanceTime()` agent-inspection hooks and the EventBus/GameState/Constants architecture.
- **Hosting is GitHub Pages**, free and already familiar, which rules out anything needing a server.
- Chris works in JavaScript and iterates fast; the project is a gift with a real recipient waiting, not a long-lived codebase.

## Decision

Build Dawn's Mahjong in **Three.js** with **plain JavaScript (ES modules)**, bundled by **Vite**, tested with **Playwright**, and deployed as a **static installable PWA to GitHub Pages**. Retain the existing scaffold's architecture — EventBus pub/sub, a single GameState with `reset()`, all tuned values in `Constants.js`, and the `render_game_to_text()` / `advanceTime()` test hooks — and retain the `EventBus.js` implementation itself. Everything else from the previous game is deleted.

## Consequences

### Positive

- Real 3D tiles, depth, shadows, and physically flying match animations — the core of the visual brief — with no engine to learn.
- Zero-install for the player: a URL that also installs to her home screen and runs offline. No app store, no updates for her to approve, no account.
- The retained architecture means the agent-inspection hooks and test harness work from day one; the first milestone starts with a known-good boot.
- Plain JS keeps the whole game readable in one sitting, which matters for a project that will be picked up months apart.
- Static hosting has no running costs and nothing that can go down or expire.

### Negative

- Three.js is a large dependency for what is, mechanically, a 2D grid puzzle — first load is heavier than a canvas or DOM implementation would be. Mitigated by the PWA precache: the weight is paid once per install, then never again.
- WebGL on a mid-range Android tablet needs discipline (one shared material, pooled particles, capped device pixel ratio, render-on-demand). Performance has to be checked on the real device, not assumed.
- No TypeScript means rule bugs (the free-tile test, solvable generation) aren't caught by a compiler. Countered by keeping the rules as pure functions with a dedicated test suite.
- Headless WebGL screenshots composite black, so visual verification needs pixel readback rather than plain screenshots — a known cost carried over from the previous project.

## Alternatives considered

- **DOM / CSS 3D transforms, no WebGL:** genuinely viable for a tile grid, far lighter, and text-crisp. Rejected because the eight varied particle-driven celebrations are the emotional payload of the game, and CSS gets awkward fast at fireworks and crumbling shards.
- **2D canvas or Phaser:** simplest and fastest to ship, but loses the layer-depth readability that makes a stacked mahjong board comprehensible at a glance, which is an accessibility feature here rather than a cosmetic one.
- **Native Android app (Kotlin / Flutter / Capacitor wrapper):** a real home-screen app with no browser chrome. Rejected as disproportionate: it needs a build toolchain, signing, and either sideloading or a Play Store listing, and a PWA delivers the same home-screen icon and offline behaviour with a git push.
- **Unity / Godot:** vastly more than this game needs, with a heavier web export than the entire Three.js build.
- **A ready-made mahjong library or template:** none found that could take the supplied tile art, the personalisation, and the accessibility constraints without being fought the whole way. The rules are a weekend's work and are the part most worth owning.

## Related

- ADR-0002 — accessibility-first interaction constraints (the constraints this stack must serve)
- ADR-0003 — no physics engine (removes cannon-es from the retained scaffold)
- `docs/gameplan.md`, `docs/tech.md`
- Milestone 01 — clean slate & the board
- Previous project's decisions: `denzmilk/jimothys-big-day-out` (`docs/architectural-decisions/`)
