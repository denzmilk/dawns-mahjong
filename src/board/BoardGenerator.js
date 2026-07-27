// Board generation, as pure functions.
//
// Boards are built by PLAYING them, not by dealing them: starting from a full board
// of blank positions, repeatedly take two positions that are free right now, give
// them a matching pair of faces, and set them aside. The order the pairs were
// assigned in is, by construction, a legal clearing order — so every board ships
// with a proof that it can be finished. Dealing faces at random and hoping produces
// boards that dead-end through no fault of the player, which for this player is
// indistinguishable from the game being broken.

import { ELVIS_FACES, FACES } from '../core/Constants.js';
import { buildIndex, isElvisFace, isFree } from './BoardRules.js';

const SUIT_FACES = FACES.filter((f) => !isElvisFace(f));
const MAX_ATTEMPTS = 40;

function shuffleInPlace(items, rng) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * The face pairs for a board of `count` tiles.
 *
 * A full set is 4 copies of each of the 34 suit and honour faces (136) plus 8 Elvis
 * tiles = 144. The 72-tile board halves that: 2 copies each plus 4 Elvis. Both fall
 * out of `count / 36` copies, which is checked rather than assumed.
 */
export function buildFacePairs(count, rng) {
  if (count % 2 !== 0) throw new Error(`a board needs an even tile count, got ${count}`);
  const copies = Math.floor(count / 36);
  if (copies < 2 || copies % 2 !== 0) {
    throw new Error(`unsupported board size ${count}: needs an even number of copies per face`);
  }
  const elvisCount = count - SUIT_FACES.length * copies;
  if (elvisCount < 0 || elvisCount % 2 !== 0 || elvisCount > ELVIS_FACES.length) {
    throw new Error(`unsupported board size ${count}: cannot place ${elvisCount} Elvis tiles`);
  }

  const pairs = [];
  for (const face of SUIT_FACES) {
    for (let n = 0; n < copies / 2; n++) pairs.push([face, face]);
  }
  // Elvis photographs are distinct pictures used once each; they all match one
  // another, so any pairing of them is legal.
  const elvis = ELVIS_FACES.slice(0, elvisCount);
  for (let i = 0; i < elvis.length; i += 2) pairs.push([elvis[i], elvis[i + 1]]);

  return shuffleInPlace(pairs, rng);
}

/**
 * Assigns face pairs to positions by simulating a complete play-through.
 * Returns null if it paints itself into a corner, so the caller can retry.
 */
function assignPairs(positions, pairs, rng) {
  const working = positions.map((p) => ({ ...p, cleared: false }));
  const byId = new Map(working.map((t) => [t.id, t]));
  const index = buildIndex(working);
  const faces = new Map();
  const solution = [];

  for (const [faceA, faceB] of pairs) {
    const free = working.filter((t) => !t.cleared && isFree(t, byId, index));
    if (free.length < 2) return null;

    const first = free[Math.floor(rng() * free.length)];
    let second = first;
    while (second === first) second = free[Math.floor(rng() * free.length)];

    faces.set(first.id, faceA);
    faces.set(second.id, faceB);
    first.cleared = true;
    second.cleared = true;
    solution.push([first.id, second.id]);
  }

  if (working.some((t) => !t.cleared)) return null;
  return { faces, solution };
}

/**
 * A solvable board for a layout.
 * Returns the tiles (with faces) and one known clearing order.
 */
export function generateBoard(layout, rng = Math.random) {
  const positions = layout.tiles.map((t) => ({ id: t.id, x: t.x, y: t.y, layer: t.layer }));

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const assigned = assignPairs(positions, buildFacePairs(positions.length, rng), rng);
    if (!assigned) continue;
    return {
      tiles: positions.map((p) => ({ ...p, face: assigned.faces.get(p.id), cleared: false })),
      solution: assigned.solution,
    };
  }
  throw new Error(`could not generate a solvable ${layout.id} board in ${MAX_ATTEMPTS} attempts`);
}

/**
 * Redeals the faces of the tiles still on the board into the positions still on the
 * board, guaranteed solvable again. Cleared tiles are left exactly as they are.
 */
export function shuffleRemaining(tiles, rng = Math.random) {
  const remaining = tiles.filter((t) => !t.cleared);
  if (remaining.length === 0) return { tiles: tiles.map((t) => ({ ...t })), solution: [] };

  const pairs = pairUpFaces(remaining.map((t) => t.face));
  const positions = remaining.map((t) => ({ id: t.id, x: t.x, y: t.y, layer: t.layer }));

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const assigned = assignPairs(positions, shuffleInPlace(pairs.slice(), rng), rng);
    if (!assigned) continue;
    return {
      tiles: tiles.map((t) =>
        t.cleared ? { ...t } : { ...t, face: assigned.faces.get(t.id) }
      ),
      solution: assigned.solution,
    };
  }
  throw new Error(`could not reshuffle ${remaining.length} tiles into a solvable board`);
}

/**
 * Groups a list of faces back into matching pairs. Suit faces pair with their own
 * kind; Elvis faces pair with each other, which is why an individual Elvis face can
 * legitimately be left on the board an odd number of times while the total is even.
 */
function pairUpFaces(faces) {
  const bySuit = new Map();
  const elvis = [];
  for (const face of faces) {
    if (isElvisFace(face)) {
      elvis.push(face);
      continue;
    }
    bySuit.set(face, (bySuit.get(face) || 0) + 1);
  }

  const pairs = [];
  for (const [face, count] of bySuit) {
    if (count % 2 !== 0) {
      throw new Error(`cannot pair up an odd number of ${face} (${count}) — board is corrupt`);
    }
    for (let n = 0; n < count / 2; n++) pairs.push([face, face]);
  }
  if (elvis.length % 2 !== 0) {
    throw new Error(`cannot pair up an odd number of Elvis tiles (${elvis.length}) — board is corrupt`);
  }
  for (let i = 0; i < elvis.length; i += 2) pairs.push([elvis[i], elvis[i + 1]]);

  return pairs;
}
