# Milestone 06: Sound

## Status

in-progress — implemented; the "is it pleasant" playtest AC awaits Chris

## Objective

Give every action an audible reaction, synthesised in the browser. No audio files:
nothing to load, nothing to fail offline, and no licensing question.

## Scope

- `src/systems/AudioSystem.js` — Web Audio, built from one `tone()` primitive:
  - a warm wooden **click** (filtered noise plus a low sine body) on select,
  - a two-note **chime** on a match, walking up a pentatonic scale as the board
    empties so the game quietly sounds like it is getting somewhere,
  - a low, quiet **thud** on a mismatch — never a buzzer,
  - a **sparkle** on a hint, a **riffle** on a mix,
  - an original rockabilly **turnaround** on board clear,
  - a gentle **sigh** on no-moves: bad luck, not failure.
- Mute toggle in the bar, remembered between sessions (milestone 07 stores it).
- The context is created on her first tap, because browsers refuse to start audio
  before a gesture.

## Out of scope

- Background music. Deliberate: soothing for twenty minutes, maddening for forty.
- Any Elvis recording or melody. Every sound here is synthesised and original.

## Dependencies

- **Depends on:** milestone 02 (events to hang sounds on)
- **Blocks:** nothing

## Acceptance criteria

- [x] The mute choice survives a reload — test: `tests/experience.spec.js::the sound choice is remembered`
- [x] Muting is reflected in the bar's icon — test: `::the sound choice is remembered`
- [x] No audio file is fetched, and boot stays clean when audio is unavailable — test: `tests/boot.spec.js::boots with a clean console`
- [ ] The click, chime and thud are pleasant at tablet volume, and the board-clear lick raises a smile — verified by user playtest
- [ ] Nothing is startling — verified by user playtest

## Exit condition

Chris plays with the sound on and finds it warm rather than irritating; muting works
and stays muted.

## Test plan

- `npx playwright test` — 76 specs. `tests/experience.spec.js` covers this milestone.
- `npm run verify:build` before any deploy that touches assets or paths.
- Manual: Chris on the live URL, ideally on Dawn's tablet.
