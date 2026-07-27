# Backlog

> Out-of-scope ideas, feature requests, and follow-ups captured during sessions but **not** worked on in the session that captured them. Read at the start of every milestone-creation conversation. Append-only — promoted items get a checkbox tick and a link to the milestone that absorbed them, not a deletion.
>
> If an item turns out to be wrong / no longer wanted, mark it `~~struck through~~` with a one-line reason rather than removing it; future sessions need to see that it was considered and rejected.

## How to write a backlog entry

```
- [ ] <short title> — <one-sentence description of the desired behavior or change>
  - Source: <session date or user message that introduced it>
  - Rough size: <S | M | L> · Rough value: <S | M | L>
  - Notes: <optional — constraints, dependencies, related milestones, references>
```

When an entry is **promoted into a milestone**, replace `[ ]` with `[x]` and append `→ milestone NN-<slug>.md`.
When an entry is **rejected**, wrap the title in `~~strikethrough~~` and add a one-line `Rejected: <reason>` note.

## Gameplay & features

- [ ] ~~**Single-level undo**~~ — one big "put that pair back" button so a regretted match can't strand the board.
  - Source: 2026-07-27 planning session (raised as an open question in the gameplan)
  - Rough size: S · Rough value: M
  - Rejected: 2026-07-27 by Chris. A mis-tap can't create a wrong match (two tiles must match to clear), so undo would only cover a legitimate move she later regrets, at the cost of a move history in the state model and another button on screen. The 10 hints and 3 reshuffles are the help.

- [ ] **"Dawn mode" — highlight every tile matching the selection** — optional toggle that shimmers all matches of the selected tile.
  - Source: 2026-07-27 planning session
  - Rough size: S · Rough value: M
  - Notes: Standard in modern mahjong apps and a real kindness, but it makes the 10-hint economy meaningless, so it stays off by default. Decided in ADR-0002's alternatives. Promote if she finds the game hard.

- [ ] **More layouts** — extra board shapes beyond easy-72 and turtle-144.
  - Source: 2026-07-27 planning session; raised again by Chris on 2026-07-27 ("she plays a lot of this style, she might be used to different shapes")
  - Rough size: M · Rough value: L
  - Notes: Pure data in `Layouts.js` — each shape is a list of `{x, y, layer}` on the half-tile lattice, and generation/solvability comes free. The shapes players actually know come from Windows **Mahjong Titans** (Turtle, Dragon, Cat, Fortress, Crab, Spider) and the older *Shanghai* games; all are 144 tiles. A 36-tile "quick game" is still the most valuable *easy* addition — a 2-minute board for a bad day. Awaiting Chris's choice of which shapes.

- [ ] **Gentle daily greeting variation** — rotate the greeting line under "Good morning, Dawn" so it isn't word-identical every day.
  - Source: 2026-07-27 planning session
  - Rough size: S · Rough value: S
  - Notes: Keep it warm and never cute-to-the-point-of-annoying. Birthday and Christmas special cases would be a nice touch.

- [x] **Tap forgiveness radius** — treat a tap that lands just outside a free tile as a tap on it, when unambiguous. → milestone 02-matching-rules-and-play.md
  - Source: 2026-07-27, milestone 01 implementation (turtle tiles measure 47 dp on a 10.9" tablet)
  - Rough size: S · Rough value: L
  - Notes: Promoted the same day — Chris chose "keep the turtle, add tap forgiveness" over hiding or dropping it, which makes this load-bearing rather than polish. Picking is an exact raycast today; the margin picks the nearest free tile within ~12 dp, and only when exactly one candidate qualifies.

## Polish & juice

- [ ] **Board-clear finale escalation** — every Nth match escalates the celebration, and the final pair always gets the biggest one.
  - Source: 2026-07-27 planning session
  - Rough size: S · Rough value: M
  - Notes: Folded into milestone 05's plan; listed here so it isn't lost if 05 gets trimmed.

- [ ] **Tile-lay animation on new board** — tiles fly in and stack themselves at the start of a game rather than appearing.
  - Source: 2026-07-27 planning session
  - Rough size: S · Rough value: M
  - Notes: Lovely, and it also buys cover for board generation. Must stay short — she shouldn't wait to play.

- [ ] **Stronger layer-depth cues on the 5-layer turtle** — the stack reads well on easy-72's two layers but the turtle's middle still reads flatter than it should.
  - Source: 2026-07-27, milestone 01 visual check (`output/iterate/m01-turtle-144.png`)
  - Rough size: S · Rough value: M
  - Notes: Shadow contrast, tile thickness, and centre-relative lighting all helped. Remaining options: a faint per-layer brightness ramp (upper layers slightly lighter), a cheap fake ambient-occlusion darkening in the crevices, or a subtle outline on upper-layer tiles. Milestone 04 owns legibility, so it lands there — and it partly solves itself once blocked tiles are dimmed.

- [ ] **Elvis reaction on a long match streak** — a small portrait wink / hip-swivel flourish after several quick matches.
  - Source: 2026-07-27 planning session (Elvis theming)
  - Rough size: M · Rough value: S
  - Notes: Only if it can't be mistaken for something needing a response.

## Tech & refactors

- [ ] ~~**Downscale the Elvis photos**~~ — 9 MB across 18 images is a slow first load on tablet wifi.
  - Source: 2026-07-27 planning session
  - Rough size: S · Rough value: L
  - Rejected: 2026-07-27 by Chris — "size is not a problem at all". Home wifi, one install, and the service worker caches it after the first load. Reopen only if the first load turns out to be genuinely slow on her tablet. The tile-face crops will still be resized as part of milestone 08, because a 2752 px photograph on a 256 px tile face is a rendering concern rather than a bandwidth one.

- [ ] **Crop the greeting hero tight to the two figures** — the background of `dawn-with-elvis-1.jpg` contains AI-generated poster text that reads as gibberish ("ELVIS FIGN", "MALY APRIL 19").
  - Source: 2026-07-27 planning session, on inspecting the supplied image
  - Rough size: S · Rough value: M
  - Notes: Cropping to Dawn and Elvis from the shoulders up removes almost all of it, and a soft vignette or blur handles the rest. Worth doing before milestone 04 ships, because garbled text is exactly the kind of thing that reads as "the game is broken" to a non-technical player.

- [ ] **Higher-resolution tile art** — swap the preview sheet for the full-resolution pack if Chris has it.
  - Source: 2026-07-27 planning session
  - Rough size: S · Rough value: M
  - Notes: Faces are ~90×110 px in the preview sheet. Milestone 03's measuring script makes a swap a one-command re-measure. Only needed if faces read soft on the tablet.

- [ ] **Survive WebGL context loss** — listen for `webglcontextlost` / `webglcontextrestored` and rebuild the scene instead of leaving a blank canvas.
  - Source: 2026-07-27, noticed while verifying the production build (headless Chromium raised `CONTEXT_LOST_WEBGL` intermittently)
  - Rough size: S · Rough value: L
  - Notes: The headless occurrence was software-GL noise, but the underlying risk is real and specific to this player: an Android tablet that sleeps or backgrounds the tab mid-game can genuinely lose the GL context, and today nothing restores it — she would come back to a blank green screen with no idea why. Needs the board state (already in `GameState`) re-realised into fresh meshes. Pairs naturally with milestone 07's save work.

- [ ] **Merge tile geometry / instancing** — if 144 individual meshes strain the tablet GPU.
  - Source: 2026-07-27 planning session
  - Rough size: M · Rough value: S
  - Notes: Do not do this before measuring on the real device. Complicates per-tile animation considerably; see `threejs-perf` guidance.

## Tooling & QA

- [ ] **Dev panel for layout and animation tuning** — sliders for camera tilt, tile spacing, and a way to trigger each of the eight celebrations on demand.
  - Source: 2026-07-27 planning session
  - Rough size: M · Rough value: M
  - Notes: The previous project's `Tunables` / `DevOverrides` / `DevTools` trio did this well and was deleted in the pivot; it can be lifted from `denzmilk/jimothys-big-day-out` if wanted. Most valuable during milestone 05 — testing eight animations by playing until they randomly appear is miserable.

- [ ] **Real-device testing loop** — a documented way to load the dev build on the tablet over the LAN.
  - Source: 2026-07-27 planning session
  - Rough size: S · Rough value: L
  - Notes: `vite --host` plus the machine's LAN IP. High value because half the acceptance criteria in this project can only be honestly verified on the actual device.

## Open questions

- **Which Samsung tablet?** Answered "not sure yet" — building fully responsive with a hard 64 dp minimum touch target. Needs an answer (or a real-device check) before milestone 04 can be signed off. **Now measured, so this is a concrete decision rather than a worry:** Android presents CSS pixels as dp, so a 10.9" Tab A9+ is about 1024×640 dp in landscape. At that size `easy-72` tiles are 68 dp (fine) but the 144-tile turtle is **47 dp** — above Android's 48 dp floor only by rounding, and below this project's own 64 dp rule. Three ways out: accept smaller tiles on the turtle and add the tap-forgiveness radius above; hide the turtle on screens too small for it; or drop the turtle and add more 72-tile layouts instead.
- **Undo — yes or no?** See the gameplay entry above. Decision needed before milestone 02 ships.
- **Elvis photo licensing.** These are third-party publicity photographs going onto a public GitHub Pages URL. Fine for a family gift; Chris's call whether to narrow the set to public-domain-only images. No Elvis audio is used anywhere, so music is not a question.
- **Does she want the 144-tile turtle at all?** The 72-tile board is the default. If the turtle turns out to be too much, it's worth knowing before spending polish effort on it.
