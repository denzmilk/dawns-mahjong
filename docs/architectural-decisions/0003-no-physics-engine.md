# ADR 0003: No physics engine — match celebrations are scripted, not simulated

## Status

accepted

## Date

2026-07-27

## Context

The scaffold inherited in this directory carries `cannon-es` as a dependency, because the previous game (a physics comedy about tipping over bins) was built on it. Dawn's Mahjong keeps the Three.js half of that scaffold and has to decide the physics half deliberately rather than by inertia.

The game's brief does include energetic 3D motion: eight different match celebrations, explicitly including *"rocket up and collide"*, *"crumble away"*, and *"fireworks"*. Those read like physics. But the gameplay itself has none: tiles sit on an integer lattice, never collide, never fall, and are removed in pairs by a rule check.

Relevant forces:

- The celebrations must be **reliable and repeatable**. Each one plays potentially hundreds of times per session, always finishing with the two tiles gone and the board in a consistent state. A simulation that occasionally flings a shard across the board, or ends with a tile resting where it shouldn't, is a bug in front of the one person who can't work around it.
- They must be **deterministic under test**. Verification depends on `advanceTime(seconds)` stepping the game reproducibly.
- The target is a **mid-range Android tablet GPU and battery**. A physics world stepping every frame — including while nothing is happening — is a real cost for a game that is static most of the time.
- The animations are short (0.5–1.5 s), highly art-directed, and every one of them wants a *specific* look. "Whatever the solver produces" is not the goal; "rockets up, meets its partner dead centre, bursts" is.

## Decision

Remove `cannon-es`. Implement all match celebrations and UI motion as **scripted, eased interpolation** driven off the existing render loop, with particle bursts as pooled `THREE.Points` systems using simple hand-integrated velocity and gravity. No physics engine, no collision detection, no rigid bodies. "Crumble" is a fixed set of pre-cut shard meshes with per-shard scripted trajectories; "rocket and collide" is two tweened paths that meet at a known point at a known time.

## Consequences

### Positive

- Every celebration ends in exactly the same state at exactly the same time, every time — no stray geometry, no non-deterministic finish, no cleanup ambiguity.
- Fully deterministic under `advanceTime()`, so animation behaviour is testable rather than eyeballed.
- Enables **render-on-demand**: with no world to step, a static board renders one frame and stops, which matters for a tablet left mid-game on the arm of a chair.
- Drops a dependency and its bundle weight from a game whose entire mechanic is a lattice and a rule check.
- Art direction is exact — the timing and shape of each of the eight celebrations is authored, not negotiated with a solver.

### Negative

- Each celebration must be hand-authored; there is no "throw the tiles at the wall and let physics be interesting" shortcut. Eight animations is eight animations of work.
- Secondary motion that physics gives free (shards tumbling and settling against each other, believable bounce) has to be faked with rotation curves and easing, and will look slightly less organic on close inspection.
- If a future feature genuinely needs simulation — a tile avalanche, a board that collapses on itself — this decision has to be revisited with a superseding ADR rather than an `npm install`.

## Alternatives considered

- **Keep cannon-es because it's already installed:** the weakest possible reason to carry a dependency, and it would make the celebrations non-deterministic, untestable, and battery-hungry to no benefit.
- **A lighter physics library (rapier, p2, a hand-rolled verlet solver):** same objections at smaller scale. The problem is not the size of the engine, it's that simulation is the wrong tool for authored 0.8-second flourishes.
- **CSS animations for the celebrations:** can't reach into the 3D scene where the tiles live, and can't do fireworks or shard fields convincingly.
- **A tween library (GSAP, tween.js):** genuinely tempting and would save a little code. Rejected as unnecessary — the requirement is a handful of easing functions and a per-animation update callback, which is a few dozen lines against the existing render loop, and it keeps the dependency list at "Three.js and the build tools."

## Related

- ADR-0001 — engine and stack (this removes the physics half of the inherited scaffold)
- `docs/tech.md` — out-of-scope dependencies
- Milestone 05 — eight ways to clear a pair (the milestone this governs)
- Previous project's physics decision: `denzmilk/jimothys-big-day-out`, `docs/architectural-decisions/0002-physics-approach.md`
