import { test, expect } from '@playwright/test';
import { isFreeIn, matches, availablePairs, freeTiles } from '../src/board/BoardRules.js';

// The free-tile rule is the single most correctness-critical thing in the game: a
// bug here makes the board unplayable for someone who cannot debug it, so it is
// tested against hand-built fixtures rather than through the renderer.
//
// Coordinates are half-tile steps — a tile at (x, y) occupies [x, x+2) × [y, y+2).

let nextId = 0;
const tile = (x, y, layer = 0, face = 'dot-1') => ({ id: nextId++, x, y, layer, face, cleared: false });

test.beforeEach(() => {
  nextId = 0;
});

test.describe('isFree truth table', () => {
  test('a lone tile is free', () => {
    const tiles = [tile(0, 0)];
    expect(isFreeIn(tiles, tiles[0].id)).toBe(true);
  });

  test('free on the left only, and on the right only', () => {
    // [target][right neighbour] — left edge is open.
    const openLeft = [tile(0, 0), tile(2, 0)];
    expect(isFreeIn(openLeft, openLeft[0].id)).toBe(true);

    // [left neighbour][target] — right edge is open.
    const openRight = [tile(0, 0), tile(2, 0)];
    expect(isFreeIn(openRight, openRight[1].id)).toBe(true);
  });

  test('blocked on both sides is not free', () => {
    const tiles = [tile(0, 0), tile(2, 0), tile(4, 0)];
    expect(isFreeIn(tiles, tiles[1].id)).toBe(false);
  });

  test('a neighbour that does not overlap vertically does not block', () => {
    // Same layer, immediately left in x, but two rows away in y.
    const tiles = [tile(2, 0), tile(0, 4)];
    expect(isFreeIn(tiles, tiles[0].id)).toBe(true);
  });

  test('a half-offset neighbour blocks its side of a tile', () => {
    // A straddling neighbour overlaps our left edge across only half its depth,
    // and that still counts as blocking the left — which only matters when the
    // other side is blocked too, since one open side is enough to be free.
    const halfLeftOnly = [tile(2, 0), tile(0, 1)];
    expect(isFreeIn(halfLeftOnly, halfLeftOnly[0].id)).toBe(true);

    const halfLeftAndFullRight = [tile(2, 0), tile(0, 1), tile(4, 0)];
    expect(isFreeIn(halfLeftAndFullRight, halfLeftAndFullRight[0].id)).toBe(false);

    const halfBothSides = [tile(2, 0), tile(0, 1), tile(4, 1)];
    expect(isFreeIn(halfBothSides, halfBothSides[0].id)).toBe(false);
  });

  test('a gap of a full tile width does not block', () => {
    const tiles = [tile(0, 0), tile(4, 0)];
    expect(isFreeIn(tiles, tiles[0].id)).toBe(true);
    expect(isFreeIn(tiles, tiles[1].id)).toBe(true);
  });

  test('a tile covered from above is not free, however it is boxed in', () => {
    const tiles = [tile(0, 0), tile(0, 0, 1)];
    expect(isFreeIn(tiles, tiles[0].id)).toBe(false);
    expect(isFreeIn(tiles, tiles[1].id)).toBe(true);
  });

  test('partial cover blocks a tile', () => {
    // The upper tile clips one corner only — a quarter of the footprint.
    const tiles = [tile(0, 0), tile(1, 1, 1)];
    expect(isFreeIn(tiles, tiles[0].id)).toBe(false);
  });

  test('a tile on the layer above that does not overlap does not block', () => {
    const tiles = [tile(0, 0), tile(2, 0, 1)];
    expect(isFreeIn(tiles, tiles[0].id)).toBe(true);
  });

  test('clearing the tile above frees the tile below', () => {
    const tiles = [tile(0, 0), tile(0, 0, 1)];
    tiles[1].cleared = true;
    expect(isFreeIn(tiles, tiles[0].id)).toBe(true);
  });

  test('clearing a side neighbour frees a boxed-in tile', () => {
    const tiles = [tile(0, 0), tile(2, 0), tile(4, 0)];
    expect(isFreeIn(tiles, tiles[1].id)).toBe(false);
    tiles[0].cleared = true;
    expect(isFreeIn(tiles, tiles[1].id)).toBe(true);
  });

  test('a cleared tile is never free', () => {
    const tiles = [tile(0, 0)];
    tiles[0].cleared = true;
    expect(isFreeIn(tiles, tiles[0].id)).toBe(false);
  });

  test('a tile two layers up still blocks, even with the middle layer cleared', () => {
    // Cannot arise in the shipped layouts, but the rule must not depend on that.
    const tiles = [tile(0, 0), tile(0, 0, 1), tile(0, 0, 2)];
    tiles[1].cleared = true;
    expect(isFreeIn(tiles, tiles[0].id)).toBe(false);
  });
});

test.describe('matching', () => {
  test('identical faces match, different faces do not', () => {
    expect(matches(tile(0, 0, 0, 'dot-5'), tile(4, 0, 0, 'dot-5'))).toBe(true);
    expect(matches(tile(0, 0, 0, 'dot-5'), tile(4, 0, 0, 'dot-6'))).toBe(false);
    expect(matches(tile(0, 0, 0, 'bamboo-1'), tile(4, 0, 0, 'character-1'))).toBe(false);
    expect(matches(tile(0, 0, 0, 'wind-east'), tile(4, 0, 0, 'wind-west'))).toBe(false);
    expect(matches(tile(0, 0, 0, 'dragon-red'), tile(4, 0, 0, 'dragon-green'))).toBe(false);
  });

  test('any Elvis tile matches any other Elvis tile', () => {
    // The deliberate simplification of the flowers/seasons rule — one rule is
    // easier to hold in your head at 90 than two (see docs/gameplan.md).
    expect(matches(tile(0, 0, 0, 'elvis-1'), tile(4, 0, 0, 'elvis-7'))).toBe(true);
    expect(matches(tile(0, 0, 0, 'elvis-3'), tile(4, 0, 0, 'elvis-3'))).toBe(true);
    expect(matches(tile(0, 0, 0, 'elvis-2'), tile(4, 0, 0, 'dot-2'))).toBe(false);
  });

  test('a tile never matches itself', () => {
    const a = tile(0, 0, 0, 'dot-5');
    expect(matches(a, a)).toBe(false);
  });
});

test.describe('board queries', () => {
  test('freeTiles returns only playable tiles', () => {
    const tiles = [tile(0, 0), tile(2, 0), tile(4, 0), tile(0, 0, 1)];
    const free = freeTiles(tiles).map((t) => t.id);
    expect(free).toEqual([tiles[2].id, tiles[3].id]);
  });

  test('availablePairs finds matching pairs of free tiles only', () => {
    const tiles = [
      tile(0, 0, 0, 'dot-1'),
      tile(4, 0, 0, 'dot-1'),
      tile(8, 0, 0, 'bamboo-2'),
      tile(8, 0, 1, 'bamboo-2'), // covers the bamboo below it
    ];
    const pairs = availablePairs(tiles);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].sort()).toEqual([tiles[0].id, tiles[1].id].sort());
  });

  test('availablePairs is empty on a board with no legal move', () => {
    const tiles = [
      tile(0, 0, 0, 'dot-1'),
      tile(2, 0, 0, 'dot-2'),
      tile(4, 0, 0, 'dot-1'),
      tile(6, 0, 0, 'dot-2'),
    ];
    // Only the outermost tiles are free, and they do not match each other.
    expect(availablePairs(tiles)).toHaveLength(0);
  });
});
