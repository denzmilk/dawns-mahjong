# AGENTS.md

> Lean enforcement file for any AI agent working in this repository. Read this file **first**, every session, before any other action. Cross-tool standard (Cursor, Aider, Codex, Claude, etc.). Claude users: `CLAUDE.md` points here.

This project follows the [`make-game`](https://github.com/OpusGameLabs/game-creator) pipeline. Do not improvise process — follow the rules below.

## Project overview

- **Title:** Dawn's Mahjong
- **Pitch:** Mahjong solitaire built for one specific player — Chris's 90-year-old grandmother Dawn, Elvis fan, playing on a Samsung tablet. Classic tile-matching with none of the usual hostility: no timers, no scores, no tiny type, a greeting by name every time she opens it, and a different 3D celebration for every pair she clears.
- **Genre / type:** Tile-matching solitaire (Shanghai rules), one board per session
- **Engine:** Three.js (`three@^0.185.1`), no physics engine (ADR-0003)
- **Language:** JavaScript (ES modules), Vite build
- **Target platform:** Android tablet browser, touch only, landscape — installable PWA, playable offline, hosted on GitHub Pages

**The player is 90 and non-technical. That is the primary engineering constraint, not a footnote.** See ADR-0002.

## Mandatory: run the make-game skill

Every session in this directory **must** run the `make-game` skill's session-start sub-pipeline before any other work. The skill enforces phase awareness, doc continuity, milestone discipline, and the live-iterate verification loop.

If the skill is not installed in your environment:

```
npx skills add opusgamelabs/game-creator --skill make-game -p -y
```

If the skill cannot be installed (e.g. unsupported agent tool), apply the rules in this file manually and tell the user the skill is missing.

## Source-of-truth files

These docs are the agreed state of the project. Read them at session start; do **not** unilaterally edit them — propose changes and get user confirmation first.

- `docs/STATE.md` — last session handoff. Read first, every session.
- `docs/gameplan.md` — game definition (loop, rules, layouts, assists, art, anti-goals).
- `docs/tech.md` — stack, tooling, asset pipeline, conventions.
- `docs/milestones/` — feature work breakdown with acceptance criteria.
- `docs/architectural-decisions/` — locked decisions (0001 engine/stack, 0002 accessibility constraints, 0003 no physics).
- `docs/backlog.md` — every deferred idea. Nothing the user mentions gets silently dropped.

## House rules (Chris's cross-repo conventions — non-negotiable)

1. **Commit/push only on explicit user confirmation.** Never `git commit` or `git push` on your own initiative, even when work looks done. Stage and ask.
2. **Comments explain WHY, not what.** The constraint, trade-off, or bug avoided — link the ADR/milestone it came from. Never narrate what a line does.
3. **Never commit secrets.** API keys and tokens live in env/CI secrets, never in the repo. Scan the diff before every commit.
4. **Chris playtests before anything is "done."** Anything he can see or feel — legibility, tap accuracy, animation feel, greeting warmth — needs his hands-on sign-off, ideally on the actual tablet. Automated tests and screenshots are necessary but never sufficient. Report status honestly: "implemented, awaiting playtest" is the ceiling until he's played it.
5. **Surgical scope.** Do what the milestone says, no more. New ideas mid-session go to `docs/backlog.md`, not into the diff.
6. **Tuned values live only in `src/core/Constants.js`.** "Feels wrong" bugs trace to drifted constants — never retune inline, never scatter magic numbers.

## Accessibility rules (ADR-0002 — hard constraints, not preferences)

Any feature violating one of these is rejected or redesigned. Exceptions need a superseding ADR.

- **A single tap is the entire control scheme.** No drag, swipe, pinch, double-tap, long-press, or multi-touch. The camera is fixed and never moves in response to input. Browser gestures (pinch-zoom, double-tap-zoom, text selection, overscroll, context menu) are actively suppressed.
- **Playability is visible without interaction.** Free tiles bright, blocked tiles dimmed. Tapping a blocked tile does nothing at all.
- **Selection is the loudest thing on screen** — lift, thick gold outline, slow pulse, and glow, all at once. Redundant on purpose.
- **Minimum 64 dp touch targets, 24 px body text, 72 px+ greeting.** Tile size derives from these minimums, never the reverse. Android reports CSS pixels as dp, so a 10.9" tablet is ~1024×640 — test at that size, not at desktop resolutions.
- **Atkinson Hyperlegible is the only font**, self-hosted in `public/assets/fonts/`. Never add a second font or load one from a CDN.
- **Nothing punishes, times, or scores.** Tiles-remaining is the only number on screen. A dead-end board is phrased as luck, not failure.
- **No modal that can trap her.** One obvious way forward on every screen.
- **No network dependency, sign-in, permission prompt, ad, or analytics.** It works with the wifi off.

## Architecture rules

- **EventBus singleton** (`src/core/EventBus.js`) — all cross-module communication via pub/sub. Modules never import each other directly. Events use `domain:action` naming and are declared in the `Events` map.
- **GameState singleton** (`src/core/GameState.js`) — single centralized state object with `reset()` for restart safety. Systems read; events trigger mutations.
- **Constants.js** — every magic number, colour, timing, and layout dimension lives here. Zero hardcoded values in game logic.
- **Rules are pure functions.** `src/board/BoardRules.js` and `BoardGenerator.js` take state and return values — no Three.js, no DOM. They are the most correctness-critical code in the project and must be testable without a renderer.
- **No physics engine** (ADR-0003) — match celebrations are scripted eased interpolation plus pooled `THREE.Points` particles. Deterministic under `advanceTime()`.
- **Render on demand** — the loop only runs continuously while something animates. A static board draws one frame and stops. This is a tablet battery decision.
- **Boards are generated solvable**, built backwards from a known solution. Never shuffle-and-hope.
- **`window.render_game_to_text()`** — JSON snapshot of game state for agent inspection without screenshots.
- **`window.advanceTime(seconds)`** — steps the simulation deterministically for verification.
- Resources are disposed on removal; starting a new board must leak nothing.

## Stack-specific commands

- **Dev server:** `npm run dev` (port **3100**, `strictPort` — 3000 belongs to another of Chris's projects). Add `--host` to load it on the tablet over the LAN.
- **Tests:** `npx playwright test` (auto-starts the dev server, reuses a running one). Tablet viewports, not desktop. Headless WebGL screenshots composite black under SwiftShader — assert via canvas pixel readback, not screenshots.
- **Build:** `npm run build` · **Preview:** `npm run preview`
- **Asset sync:** `npm run assets:sync` — normalises Chris's drops in `Assets/` into `public/assets/elvis/`
- **Lint / format:** n/a (deliberate — see `docs/tech.md`)

## Live iterate (after every code change)

After any meaningful code change in the development phase:

1. Confirm dev server is live; check console — must be error-free.
2. Call `render_game_to_text()` and verify state matches the change.
3. For time-dependent changes, step with `advanceTime(seconds)` and re-read.
4. If visual, verify via canvas pixel readback; save any captures under `output/iterate/`.
5. Smoke-check adjacent state for regressions.
6. Hand back to the user with a one-line verdict and one focused question.

A change is **not done** until this loop has run — and not *signed off* until Chris has played it (house rule 4).

## Append vs spawn a new milestone

When new work surfaces:

- **Append** an AC to the current milestone if the work is in-scope refinement.
- **Spawn** a new milestone if the work is out of scope but related; use `Depends on:` to capture ordering.
- **Inline** trivial fixes (typos, one-liners) on the current milestone.

When in doubt, prefer spawning. Do not bloat milestones.

## Minimum-viable doc mode

If the user pushes back on documentation overhead, downgrade — do **not** skip:

- One-line milestone entry (title + AC) is acceptable.
- `docs/STATE.md` updates remain mandatory.
- `docs/gameplan.md` and `docs/tech.md` must exist.
- Engine / language / stack ADRs cannot be skipped.

## What to do if `make-game` isn't loaded

1. Stop. Do not start coding.
2. Read this file in full.
3. Read `docs/STATE.md`, then `docs/gameplan.md`, then `docs/tech.md`.
4. Identify the current phase and the open milestone.
5. Tell the user the skill isn't loaded and recommend they install it.
6. If proceeding without the skill, apply the rules above manually and update `docs/STATE.md` at the end of the session.

## Last regenerated

2026-07-27 by Claude — regenerated for the *Dawn's Mahjong* pivot (previous game: *Jimothy's Big Day Out*, now at `denzmilk/jimothys-big-day-out`). Regenerate when the engine, primary commands, or architecture rules change. The doc-drift audit will flag staleness.
