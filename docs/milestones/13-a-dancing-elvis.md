# Milestone 13: A dancing Elvis, and a riff

## Status

in-progress — automated ACs green (97 specs); the playtest ACs await Chris, then Dawn

Depends on: milestone 05 (the celebration pool this extends) and milestone 08 (the Elvis
tiles that trigger it).

## Objective

Chris, 2026-07-28: *"add a little dancing animation of elvis — just create a 2D version of
him doing a dance with a mic in the spotlight, then have a sound effect go off like a
guitar riff."*

Placed on the **Elvis-pair celebration**, confirmed with him rather than assumed. That
celebration already drops a cone of light and a shower of rhinestones and is reserved for
pairs of Elvis tiles, so the spotlight he asked for was already standing empty. It fires
once or twice on a 48-tile board and four times on a 144-tile one — often enough that she
will see it most games, rare enough that it stays a treat.

## Scope

### A 2D Elvis, drawn (`src/assets/ElvisSprite.js`)

Everything else showing Elvis in this game uses Chris's photographs. This can't: a dancing
figure needs poses no still has, and there is no Elvis footage or audio anywhere in this
project by design. So he is drawn — white jumpsuit, upturned collar, gold belt, flares,
quiff, sideburns, mic and cord — as an obvious cartoon that sits beside the photographs
rather than competing with them.

- **Built from a skeleton, not eight hand-drawn pictures.** Joint positions come from a
  pose function of the cycle position, so the motion is smooth and his proportions are one
  number rather than eight redraws.
- **The move is the knee-wobble**: feet planted, knees swinging together and apart, hips
  opposing the shoulders, free arm coming up to point on the outward swing.
- **Drawn once into a sprite sheet at boot** (8 frames, 256 × 320 each). A canvas redrawn
  per frame means a texture upload per frame, which is what drops frames on a tablet GPU.

### On the board (`ElvisDancer` in `src/fx/Celebrations.js`)

One camera-facing quad showing one cell of the strip at a time, built once and reused.

- **Sized against the view, not the world.** A fixed world height makes him three quarters
  of a 4-column board and a quarter of a 12-column one, because the camera pulls back to
  fit whichever board it is showing. `heightOfView` keeps him the same share of the screen
  on all of them.
- **Clamped to the board**, so a pair cleared in a corner doesn't put half of him off the
  edge of the screen.
- **Drawn over the board** (`depthTest: false`). Elvis buried to the waist in a stack of
  tiles is worse than the depth being wrong.
- **Stepped by the celebration's own clock**, so he is deterministic under `advanceTime()`
  like every other animation (ADR-0003).

### Changes to the celebration around him

- **The spotlight was lowered** from `mid.y + 7` to `mid.y + 3.4`. It used to hang entirely
  above the board, lighting nothing in particular; now its pool lands where he is standing.
- **Narrower and dimmer** with it — cone radius 2.4 → 1.7, peak opacity 0.5 → 0.34. Once
  the pool actually reached the board, the old numbers blew out most of a small board, and
  the point of a spotlight is to pick one man out of the dark.
- **The two tiles now fly out to the sides** instead of strutting through the middle, so
  they are not crossing in front of him.

### The riff (`AudioSystem.riff`)

Four notes up a blues scale in G with the last one bent a whole tone, sawtooth through a
lowpass — as close to an electric guitar as one oscillator gets, and closer than a clean
tone would be. Synthesised like everything else: nothing to load, nothing to fail offline.

- **Fires instead of the escalation sparkle**, not on top of it. Two flourishes at once is
  noise.
- **Deliberately a different shape from the board-clear lick.** That one turns around and
  resolves; this one rises and stops. They would flatten each other if they sounded alike.
- Original, like every sound here — no recordings and no borrowed melodies (`docs/tech.md`
  → Licensing).
- `tone()` gained an optional lowpass, because a raw sawtooth at tablet volume is
  unpleasant and ADR-0002 says nothing may startle her.

## Out of scope

- **A dance on the win screen.** Considered and set aside with Chris — the board-clear
  finale already has fireworks, a portrait and the rockabilly lick, and a fourth thing
  would crowd it.
- **Sound on the greeting screen.** Browsers refuse audio before a gesture, and a greeting
  that is silent for some players and not others is worse than one that is always silent.
- **More than one dance.** Eight frames, one cycle. If it wears out, that is what the
  backlog is for.

## Acceptance criteria

- [x] The sprite sheet holds **eight distinct poses**, and no pose reaches outside its own
      cell. (Both were real bugs the test caught: the pointing hand was being sliced off by
      the frame edge, and a symmetric pose function collapsed eight frames into five.)
- [x] He appears for an Elvis pair, cycles frames as the celebration runs, and is gone
      before it ends.
- [x] He does **not** appear for any of the other seven celebrations.
- [x] A pair cleared in the corner of a board still puts him on screen.
- [x] The riff plays for his celebration and for no other.
- [x] He steps deterministically under `advanceTime()`.
- [x] Console clean; `npm run verify:build` green; 97 specs passing.
- [ ] **Playtest — Chris:** he reads as Elvis at tile scale on the real screen, and the
      dance reads as dancing rather than as a figure twitching.
- [ ] **Playtest — Chris:** the riff is pleasant at tablet volume and doesn't startle
      (ADR-0002). It is the only new sound since the game was declared finished.
- [ ] **Playtest — Chris:** he doesn't hide the board at the moment she most wants to see
      it. He is drawn over the tiles for 1.15 s, four times on a 144-tile board.
- [ ] **Playtest — Dawn:** she smiles the first time, and still doesn't mind the fourth.

## Exit condition

Chris clears a pair of Elvis tiles on Dawn's tablet at
<https://denzmilk.github.io/dawns-mahjong/> with the sound on, watches the dance through to
the end, and then does it three more times in one board without wanting it gone.
