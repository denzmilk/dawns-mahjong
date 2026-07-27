import { test, expect } from '@playwright/test';
import { LAYOUTS } from '../src/board/Layouts.js';
import { generateBoard, shuffleRemaining } from '../src/board/BoardGenerator.js';
import { availablePairs, matches, isFreeIn } from '../src/board/BoardRules.js';
import { seededRng } from './helpers.mjs';

// Boards must be solvable by construction. Shuffle-and-hope produces boards that
// dead-end through no fault of the player, which for this player is
// indistinguishable from the game being broken.

// 200 per layout, as the milestone AC states. Cheap enough to keep in the default
// run: generation uses a precomputed adjacency index, so freeness is a handful of
// lookups rather than a scan of the board.
const BOARDS = 200;

/** Replay a clearing order against a fresh board, checking every step is legal. */
function replaySolution(tiles, solution) {
  const byId = new Map(tiles.map((t) => [t.id, t]));
  for (const [idA, idB] of solution) {
    const a = byId.get(idA);
    const b = byId.get(idB);
    if (!a || !b) return { ok: false, why: `unknown tile in solution: ${idA}/${idB}` };
    if (!matches(a, b)) return { ok: false, why: `${a.face} does not match ${b.face}` };
    const live = tiles.filter((t) => !t.cleared);
    if (!isFreeIn(live, a.id)) return { ok: false, why: `tile ${a.id} was not free when played` };
    if (!isFreeIn(live, b.id)) return { ok: false, why: `tile ${b.id} was not free when played` };
    a.cleared = true;
    b.cleared = true;
  }
  const left = tiles.filter((t) => !t.cleared).length;
  return left === 0 ? { ok: true } : { ok: false, why: `${left} tiles left over` };
}

function faceCounts(tiles) {
  const counts = {};
  for (const t of tiles) counts[t.face] = (counts[t.face] || 0) + 1;
  return counts;
}

for (const [layoutId, expectedCopies, expectedElvis] of [
  ['easy-72', 2, 4],
  ['turtle-144', 4, 8],
]) {
  test(`${layoutId} boards are always solvable`, () => {
    for (let seed = 1; seed <= BOARDS; seed++) {
      const { tiles, solution } = generateBoard(LAYOUTS[layoutId], seededRng(seed));
      expect(tiles).toHaveLength(LAYOUTS[layoutId].tiles.length);
      expect(solution).toHaveLength(tiles.length / 2);
      const result = replaySolution(tiles, solution);
      expect(result.ok, `seed ${seed}: ${result.why}`).toBe(true);
    }
  });

  test(`${layoutId} face multiset is legal`, () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { tiles } = generateBoard(LAYOUTS[layoutId], seededRng(seed));
      const counts = faceCounts(tiles);
      const elvis = Object.entries(counts).filter(([f]) => f.startsWith('elvis-'));
      const suits = Object.entries(counts).filter(([f]) => !f.startsWith('elvis-'));

      expect(suits, `seed ${seed}: expected all 34 suit/honour faces`).toHaveLength(34);
      for (const [face, n] of suits) {
        expect(n, `seed ${seed}: ${face}`).toBe(expectedCopies);
      }
      expect(elvis.reduce((sum, [, n]) => sum + n, 0), `seed ${seed}: elvis total`).toBe(expectedElvis);
      // Each Elvis photograph appears at most once — they are distinct pictures,
      // and they all match each other anyway.
      for (const [face, n] of elvis) expect(n, `seed ${seed}: ${face}`).toBe(1);
    }
  });

  test(`${layoutId} boards always open with at least one legal move`, () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { tiles } = generateBoard(LAYOUTS[layoutId], seededRng(seed));
      expect(availablePairs(tiles).length, `seed ${seed}`).toBeGreaterThan(0);
    }
  });
}

test('shuffle preserves the remaining tiles and stays solvable', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const rng = seededRng(seed);
    const { tiles, solution } = generateBoard(LAYOUTS['easy-72'], rng);

    // Play a third of the board, then shuffle what is left.
    for (const [idA, idB] of solution.slice(0, 12)) {
      tiles.find((t) => t.id === idA).cleared = true;
      tiles.find((t) => t.id === idB).cleared = true;
    }
    const before = faceCounts(tiles.filter((t) => !t.cleared));
    const positionsBefore = tiles.filter((t) => !t.cleared).map((t) => t.id).sort();

    const reshuffled = shuffleRemaining(tiles, rng);

    const after = faceCounts(reshuffled.tiles.filter((t) => !t.cleared));
    expect(after, `seed ${seed}: shuffle must not invent or lose tiles`).toEqual(before);
    expect(reshuffled.tiles.filter((t) => !t.cleared).map((t) => t.id).sort()).toEqual(positionsBefore);
    expect(reshuffled.tiles.filter((t) => t.cleared)).toHaveLength(24);

    // And the new arrangement must itself be completable.
    const result = replaySolution(reshuffled.tiles, reshuffled.solution);
    expect(result.ok, `seed ${seed}: ${result.why}`).toBe(true);
  }
});

test('shuffle actually rearranges the board', () => {
  const rng = seededRng(42);
  const { tiles } = generateBoard(LAYOUTS['easy-72'], rng);
  const before = tiles.map((t) => `${t.id}:${t.face}`).join(',');
  const after = shuffleRemaining(tiles, rng).tiles.map((t) => `${t.id}:${t.face}`).join(',');
  expect(after).not.toBe(before);
});

test('generation is deterministic for a given seed', () => {
  const first = generateBoard(LAYOUTS['turtle-144'], seededRng(7));
  const second = generateBoard(LAYOUTS['turtle-144'], seededRng(7));
  expect(second.tiles).toEqual(first.tiles);
  expect(second.solution).toEqual(first.solution);
});
