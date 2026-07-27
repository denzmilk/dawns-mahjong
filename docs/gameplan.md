# Dawn's Mahjong

## Pitch

A mahjong solitaire game built for one specific player: Dawn, 90, Elvis fan, playing on a Samsung tablet from her armchair. Classic tile-matching with none of the usual hostility — no timers, no tiny type, no menus to get lost in — that greets her by name every time she opens it and celebrates every single match with a different bit of 3D showmanship.

## Core gameplay loop

1. **Open** — the game greets her: "Good afternoon, Dawn" in huge type over an Elvis portrait. One or two big buttons: *Carry on* (if a game is saved) and *New game*.
2. **Look** — a gently tilted 3D board of stacked mahjong tiles. Tiles she can play are bright and crisp; tiles that are trapped underneath or wedged between others are visibly dimmed, so "what can I tap?" is answered without thinking.
3. **Tap** a playable tile — it lifts up off the board toward her, gains a thick gold outline, and pulses slowly. Impossible to miss.
4. **Tap its match** — the pair is cleared with one of eight randomised 3D celebrations (they rocket up and collide, crumble into shards, launch fireworks, spin away in a puff of dust, flip end-over-end, swirl into a vortex, burst into confetti, or — for the Elvis tiles — get a spotlight and a shower of rhinestones).
5. **Repeat** until the board is clear. Progress saves after every pair, so she can put the tablet down mid-game, at any point, and pick up exactly where she left off days later.
6. **Finish** — board cleared: a full Elvis finale, "Well done, Dawn!", and a running count of boards she's completed.

Session length: ~8 minutes for the 72-tile board, ~20 for the classic 144-tile turtle. Interruptible at any moment.

## Game rules

**The set — 144 tiles**
- 4 copies each of 34 faces: Dots 1–9, Bamboo 1–9, Characters 1–9, four Winds (E/S/W/N), three Dragons (Red/Green/White) = 136 tiles.
- Plus 8 **Elvis tiles** (these take the place of the traditional Flowers and Seasons).

**Matching**
- Two tiles match if they show the **same face**.
- **Any Elvis tile matches any other Elvis tile.** This is a deliberate simplification of the classic Flowers/Seasons rule (where flowers only match flowers and seasons only match seasons) — one rule is easier to hold in your head at 90 than two, and it makes the Elvis tiles the friendly wildcards of the board.

**Which tiles can be played (the "free tile" rule)**
A tile can be selected only if **both** are true:
- No tile rests on top of it (nothing on the layer above overlaps it), **and**
- its whole left edge **or** its whole right edge is clear of tiles on its own layer.

Tiles that fail either test are dimmed and cannot be tapped at all — tapping one does nothing rather than beeping an error.

**Selecting**
- Tap a free tile to select it. Tap it again to deselect. Tap a different free tile to move the selection.
- Tap a matching free tile to clear the pair.
- Tap a non-matching free tile: both tiles shake, flash, and deselect with a soft thud. No penalty, no counter, nothing lost.

**Layouts (v1)**
- **Easy (72 tiles)** — the default. Two copies of each of the 34 faces plus 4 Elvis tiles, on a roomy layout with big finger-sized tiles.
- **Classic Turtle (144 tiles)** — the traditional pyramid, chosen from the main screen.

**Help**
- **10 hints** per game. A hint pulses one playable pair.
- **3 reshuffles** per game. Reshuffling redeals the *remaining* tiles into the *remaining* positions, and the new arrangement is always solvable.
- Boards are generated solvable from the start (built backwards from a solution, so a valid clearing order always exists).

## Win / lose conditions

- **Win** — the board is cleared. Finale animation, "Well done, Dawn!", boards-completed count ticks up.
- **Lose** — no matching pair is available *and* all 3 reshuffles are spent. Classic mahjong rules, as chosen. The screen is gentle about it: "No more moves this time, Dawn. Shall we try a fresh board?" with one big button. No score, no rank, no "you failed."

Nothing carries between sessions except the saved in-progress board, her settings, and a count of boards completed.

## Art style

- **Dimensionality / perspective:** real 3D (Three.js), **fixed camera** at roughly a 20° tilt — enough perspective for stacked layers to read clearly and for the match animations to have somewhere to fly, with no orbiting, panning, or pinch-zoom. The board never moves under her hands.
- **Tiles:** 3D ivory tiles with soft contact shadows. Faces come from the tile sheet Chris supplied (`public/assets/tiles/mahjong-tiles-sheet.png`) — clean flat-vector mahjong art in green/blue/orange on cream.
- **Table:** deep green felt with the gold Greek-key border lifted from that same sheet, so the frame and the tiles are unmistakably one set.
- **Elvis:** the greeting screen leads with the photo of **Dawn standing arm-in-arm with Elvis backstage** — that image is the whole personalisation in one picture. Portraits on the win screen, 8 photographs as the Elvis tile faces, and Graceland-ish accents (gold, deep red, a little 50s pink) in the UI chrome.
- **Palette:** dark green felt `#12301F`, gold `#E8C547`, ivory tile `#F7F2E4`, cream text `#FAF6EA`, Elvis red `#C1272D`. Selection gold is the single brightest thing on screen at any time.
- **Type:** huge. Greeting 72–96px, buttons 32px+, body never below 24px. High contrast throughout (cream on dark green, targeting WCAG AAA for text).
- **Asset sourcing:** the tile sheet Chris provided (sliced at runtime — see `docs/tech.md`), Elvis photographs Chris dropped into `Assets/`, and code-generated everything else. No AI generation, no model libraries, no fonts to download.

## Audio direction

Procedural Web Audio only — no audio files, nothing to load, works offline.

- Warm wooden **click** when a tile is selected.
- Soft two-note **chime** when a pair matches, pitched up slightly as the board empties.
- Low **thud** on a mismatch — quiet and unstartling, never a buzzer.
- A short **rockabilly-flavoured lick** on board clear (original, synthesised — no Elvis recordings; see licensing note in `docs/tech.md`).
- No background music. One big mute toggle, remembered between sessions.

## Player goals

- **Per session:** clear the board. That's it.
- **Across sessions:** pick up an unfinished board exactly where she left it; watch the boards-completed count grow. No levels to unlock, no streaks to break, no daily anything.

## Anti-goals

This game is deliberately **not**:

- **Timed or scored.** No clock, no points, no leaderboard, no stars. Tiles-remaining is the only number on screen.
- **A menu system.** Two buttons on the front screen, five in-game (hint, shuffle, sound, new game, back). No settings tree, no tutorial to sit through, no pop-ups.
- **Rotatable or zoomable.** Every gesture beyond a single tap is disabled — including pinch, drag, double-tap-to-zoom, and long-press — because every one of them is a way to break the view and not know how to fix it.
- **Online.** No accounts, no sign-in, no network calls, no ads, no analytics. It works with the wifi off.
- **Punishing.** A wrong tap costs nothing. A dead-end board is phrased as bad luck, not failure.
- **A general-purpose mahjong app.** It is built for Dawn's tablet and Dawn's eyes. Anyone else who enjoys it is a bonus, not a design input.

## References

- *Shanghai* (Activision, 1986) — the original tile-matching solitaire and the free-tile rule this follows.
- Modern mahjong solitaire mobile apps — mostly as anti-references: ad-riddled, timer-driven, and typeset for 25-year-olds.
- The tile sheet Chris supplied — sets the whole visual palette.
- Physical mahjong sets — the reason tiles get real thickness, ivory sides, and a soft shadow rather than being flat cards.

## Delivery order

Detailed milestone docs exist for the first three. The rest are listed here as the agreed order and get written as they come up (per the milestone-planning rule — later milestones are planned once the earlier ones land).

1. **01 — Clean slate & the board** *(planned)* — mahjong runtime skeleton, fixed tilted camera, both layouts rendering as stacked 3D tiles with placeholder faces.
2. **02 — Matching rules & a playable game** *(planned)* — free-tile logic, tap-to-match, solvable generation, win, dead-end, 10 hints + 3 reshuffles.
3. **03 — Real tile faces** *(planned)* — slice the supplied sheet into an atlas, real faces on the tiles, felt-and-gold table.
4. **04 — Built for a 90-year-old** — greeting screen with time-of-day + her name, huge type, unmissable selection state, dimmed unplayable tiles, big buttons, responsive from 8" to 12"+.
5. **05 — Eight ways to clear a pair** — the randomised 3D celebration pool, particles, and the board-clear finale.
6. **06 — Sound** — procedural click/chime/thud/lick and the mute toggle.
7. **07 — Save & carry on** — versioned localStorage save, autosave after every move, resume prompt, boards-completed count.
8. **08 — Elvis** — portraits on greeting/win, the 8 Elvis tile faces, the spotlight-and-rhinestones animation, palette accents.
9. **09 — Onto her tablet** — installable PWA (offline, home-screen icon, "Install" button), public GitHub repo, GitHub Pages deploy.

## Resolved decisions

- **No undo** (decided 2026-07-27). A mis-tap can't create a wrong match — two tiles must match to clear — so undo would only protect against a legitimate move she later regrets, and it would add a move history to the state model. The 10 hints and 3 reshuffles are the only help.
- **The 144-tile turtle stays, with tap forgiveness** (decided 2026-07-27). Its tiles measure 47 dp on a 10–11" tablet, under this project's 64 dp rule, so a tap landing just outside a free tile counts as a tap on it when only one tile qualifies. The traditional layout is not altered.

## Open questions

- **Highlight all matches for the selected tile?** Standard in modern mahjong apps and a big kindness, but it makes the 10-hint economy meaningless. Deferred to the backlog as an optional "Dawn mode" toggle, default off.
- **Tablet model unknown.** Building fully responsive with a hard 64 dp minimum tile size for the default board; needs a check on her actual tablet before milestone 04 is signed off.
- **Elvis photo licensing.** These are publicity photographs, fine for a family gift but going onto a public URL. Noted in `docs/tech.md`; Chris's call whether to narrow to public-domain-only images.
