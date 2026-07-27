# ADR 0002: Accessibility-first interaction constraints

## Status

accepted

## Date

2026-07-27

## Context

Dawn's Mahjong has exactly one player: Dawn, 90 years old, playing on a Samsung tablet. This is not a game with an accessibility mode bolted on — the accessibility requirements *are* the design requirements, and they conflict with almost every convention of modern mobile game UI.

The specific risks, in the order they are likely to ruin the game:

1. **A gesture she didn't mean to make leaves the game in a state she can't recover from.** An accidental drag rotates the board to an unreadable angle; a pinch zooms in on nothing; a long-press opens the browser's image menu. She has no mental model for "undo the view," and nobody is in the room to fix it.
2. **She can't tell which tiles are playable.** A stacked mahjong board is visually dense. If free and blocked tiles look alike, the game becomes trial-and-error tapping.
3. **She can't tell that her tap registered.** Standard selection styling (a thin border, a slight tint) is invisible to 90-year-old eyes at arm's length on a glossy screen in a lit room.
4. **Text is too small, or contrast too low, to read comfortably.**
5. **Something scolds her.** Error beeps, fail screens, timers, and score penalties turn a pleasant hour into a test she's failing.

Left to per-feature judgement, these get eroded one reasonable-sounding decision at a time ("just a little pinch-zoom", "the selection glow looks cleaner subtle"). They need to be locked.

## Decision

The following are **hard architectural constraints**, not preferences. Any feature that violates one is rejected or redesigned; any exception requires a new ADR superseding this one.

1. **A single tap is the entire control scheme.** No drag, no swipe, no pinch, no double-tap, no long-press, no multi-touch, no keyboard requirement. The camera is fixed at a constant tilt and never moves in response to input. Browser-level gestures (pinch-zoom, double-tap-zoom, text selection, overscroll, long-press menus, context menus) are actively suppressed in CSS and JS rather than merely unused.
2. **Playability is visible without interaction.** Free tiles render at full brightness and contrast; blocked tiles are visibly dimmed and desaturated. Tapping a blocked tile does nothing at all — no sound, no shake, no message.
3. **Selection is the loudest thing on screen.** A selected tile changes on at least four channels simultaneously: it lifts toward the camera, gains a thick high-contrast gold outline, pulses slowly, and casts a glow beneath it. Redundant by design — no single channel has to carry it.
4. **Minimum touch target 64 CSS px, minimum body text 24 px, greeting text 72 px+.** Tile size is a function of these minimums, not of how many tiles the layout would like to fit. If a layout can't fit at legible size on the target viewport, the layout is wrong.
5. **Nothing punishes, times, or scores.** No timer, no points, no stars, no streaks, no penalty for a mismatch. Tiles-remaining is the only number displayed. The dead-end screen is phrased as luck, not failure.
6. **No modal that can trap her.** Every screen has exactly one obvious way forward, reachable by one big button. No nested menus, no settings tree, no dialog without a visible dismissal.
7. **It works offline and never asks for anything.** No sign-in, no permissions prompts, no network dependency, no notifications, no ads, no cookie banner.

## Consequences

### Positive

- The game cannot be put into a broken visual state by touch, which eliminates the single most likely support call.
- "Which tile can I play?" and "did my tap land?" are answered by the render itself, not by the player's memory of the rules.
- The constraints resolve most future design arguments before they happen — legibility beats aesthetics, by written rule.
- Suppressing browser gestures also fixes the accidental page-scroll and rubber-band effects that make a full-screen canvas feel broken on Android.
- Testable: minimum type size, minimum touch target, and free/blocked contrast are all assertable in Playwright at a tablet viewport, so drift breaks the suite.

### Negative

- Rules out genuinely nice features: orbiting the board to peek under a stack, pinch-to-zoom on a dense turtle layout, drag-to-match, and a compact HUD.
- Big type and 64 px minimum targets cost screen area, which caps how many tiles a layout can hold — the reason the 72-tile board is the default rather than the 144-tile turtle.
- The 144-tile turtle is under real pressure on a small (8") tablet. It may need to be either scrollable (which breaks constraint 1) or simply unavailable at that screen size. To be resolved when the actual device is known.
- Fully redundant selection feedback risks looking gaudy to a younger eye. Accepted: the audience is one person, and it is not her.

## Alternatives considered

- **Ship conventional touch controls plus an accessibility settings screen:** rejected — a settings screen she has to find and configure is itself a barrier, and the defaults are what she will actually play with.
- **Let her rotate the board but add a "reset view" button:** rejected — it assumes she'll recognise the broken state as fixable and locate the fix. Removing the failure mode is cheaper than recovering from it.
- **Highlight every tile matching the selected one:** genuinely helpful and standard in modern mahjong apps, but it makes the chosen 10-hint economy meaningless. Deferred to the backlog as an optional toggle, default off, so it stays available if she finds the game hard.
- **Voice or audio guidance:** out of scope for v1 and possibly unwelcome; noise is not the same as help.

## Related

- ADR-0001 — engine and stack
- `docs/gameplan.md` — anti-goals section restates these constraints in player-facing terms
- Milestone 04 — built for a 90-year-old (implements constraints 3, 4, and 6)
- Milestone 09 — installable PWA (implements constraint 7)
