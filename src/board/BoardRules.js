// The rules, as pure functions. No Three.js, no DOM, no state — this is the most
// correctness-critical code in the project (a rules bug makes the game unplayable
// for someone who cannot work around it), so it stays testable without a renderer.
//
// Coordinates are half-tile steps: a tile at (x, y) occupies [x, x+2) × [y, y+2)
// on its layer.

const ELVIS_PREFIX = 'elvis-';

export const isElvisFace = (face) => face.startsWith(ELVIS_PREFIX);

const overlaps = (a, b) => a.x < b.x + 2 && b.x < a.x + 2 && a.y < b.y + 2 && b.y < a.y + 2;

/** Does `other` overlap the cell `dx` half-steps to the side of `tile`? */
const overlapsShifted = (tile, other, dx) =>
  overlaps({ x: tile.x + dx, y: tile.y }, other);

/**
 * Precomputes, for every tile, which tiles could ever cover it and which sit
 * against its left and right edges. Freeness then costs a handful of lookups
 * instead of a scan, which matters because board generation asks the question
 * tens of thousands of times.
 */
export function buildIndex(tiles) {
  const index = new Map();
  for (const t of tiles) index.set(t.id, { above: [], left: [], right: [] });

  for (const a of tiles) {
    const entry = index.get(a.id);
    for (const b of tiles) {
      if (a.id === b.id) continue;
      if (b.layer > a.layer) {
        // Any higher layer, not just the next one up. In the shipped layouts a
        // tile always rests on the layer below, which makes layer+1 sufficient —
        // but the rule shouldn't quietly depend on that.
        if (overlaps(a, b)) entry.above.push(b.id);
      } else if (b.layer === a.layer) {
        if (overlapsShifted(a, b, -2)) entry.left.push(b.id);
        if (overlapsShifted(a, b, 2)) entry.right.push(b.id);
      }
    }
  }
  return index;
}

/**
 * A tile can be played only if nothing rests on top of it AND its whole left edge
 * or whole right edge is clear of tiles on its own layer.
 */
export function isFree(tile, byId, index) {
  if (tile.cleared) return false;
  const entry = index.get(tile.id);
  if (!entry) return false;

  const live = (id) => {
    const other = byId.get(id);
    return other && !other.cleared;
  };

  if (entry.above.some(live)) return false;
  return !entry.left.some(live) || !entry.right.some(live);
}

/** Convenience for ad-hoc checks and tests — builds the index each call. */
export function isFreeIn(tiles, tileId) {
  const byId = new Map(tiles.map((t) => [t.id, t]));
  const tile = byId.get(tileId);
  if (!tile) return false;
  return isFree(tile, byId, buildIndex(tiles));
}

export function freeTiles(tiles, index = null) {
  const byId = new Map(tiles.map((t) => [t.id, t]));
  const idx = index || buildIndex(tiles);
  return tiles.filter((t) => isFree(t, byId, idx));
}

/** Two tiles match on identical faces — and any Elvis tile matches any other. */
export function matches(a, b) {
  if (!a || !b || a.id === b.id) return false;
  if (a.face === b.face) return true;
  return isElvisFace(a.face) && isElvisFace(b.face);
}

/** Every playable matching pair on the board, as [idA, idB]. */
export function availablePairs(tiles, index = null) {
  const free = freeTiles(tiles, index);
  const pairs = [];
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (matches(free[i], free[j])) pairs.push([free[i].id, free[j].id]);
    }
  }
  return pairs;
}

export const remainingCount = (tiles) => tiles.filter((t) => !t.cleared).length;
