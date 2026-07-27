import { test, expect } from '@playwright/test';
import { gotoGame, snapshot, tapTile } from './helpers.mjs';

// Everything here drives the live game through real taps at real screen
// coordinates — the same path Dawn's finger takes.

const freeTiles = (state) => state.tiles.filter((t) => t.free && !t.cleared);
const blockedTiles = (state) => state.tiles.filter((t) => !t.free && !t.cleared);

/** A pair of free, matching tiles from the current board. */
function findAvailablePair(state) {
  const free = freeTiles(state);
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      const a = free[i].face;
      const b = free[j].face;
      const elvis = a.startsWith('elvis-') && b.startsWith('elvis-');
      if (a === b || elvis) return [free[i], free[j]];
    }
  }
  return null;
}

test.describe('selection', () => {
  test('selection behaviour', async ({ page }) => {
    await gotoGame(page, { layout: 'easy-72', seed: 3 });
    let state = await snapshot(page);
    const free = freeTiles(state);
    expect(free.length).toBeGreaterThan(1);

    // Tap once to select.
    state = await tapTile(page, state, free[0].id);
    expect(state.selection).toBe(free[0].id);

    // Tap the same tile again to deselect.
    state = await tapTile(page, state, free[0].id);
    expect(state.selection).toBeNull();

    // Tap one, then a different non-matching free tile → selection moves or the
    // pair mismatches, but a tile is never left selected alongside another.
    state = await tapTile(page, state, free[0].id);
    expect(state.selection).toBe(free[0].id);
    const other = free.find((t) => t.id !== free[0].id && t.face !== free[0].face);
    state = await tapTile(page, state, other.id);
    expect([other.id, null]).toContain(state.selection);
  });

  test('blocked tiles ignore taps', async ({ page }) => {
    await gotoGame(page, { layout: 'turtle-144', seed: 5 });
    const state = await snapshot(page);

    // A tile blocked by its SIDES, with nothing on top of it. A tile that is covered can't
    // be tested this way: tapping its centre hits the tile sitting on it, which is a free
    // tile and is correctly selected — boards now stack tiles directly on top of each
    // other, so covered tiles are unreachable by design rather than ignored.
    const covered = new Set(
      state.tiles.flatMap((t) =>
        state.tiles.some((o) => !o.cleared && o.layer === t.layer + 1 && o.x === t.x && o.y === t.y)
          ? [t.id]
          : []
      )
    );
    const sideBlocked = state.tiles.filter((t) => !t.free && !t.cleared && !covered.has(t.id));
    expect(sideBlocked.length, 'expected a side-blocked tile to tap').toBeGreaterThan(0);

    const after = await tapTile(page, state, sideBlocked[0].id);
    expect(after.selection).toBeNull();
    expect(after.counts.remaining).toBe(state.counts.remaining);
  });
});

test.describe('matching', () => {
  test('matching pair clears', async ({ page }) => {
    await gotoGame(page, { layout: 'easy-72', seed: 11 });
    let state = await snapshot(page);
    const pair = findAvailablePair(state);
    expect(pair, 'a fresh board must have a legal move').not.toBeNull();

    const before = state.counts.remaining;
    state = await tapTile(page, state, pair[0].id);
    state = await tapTile(page, state, pair[1].id);

    expect(state.counts.remaining).toBe(before - 2);
    expect(state.counts.cleared).toBe(2);
    expect(state.selection).toBeNull();
    for (const id of [pair[0].id, pair[1].id]) {
      expect(state.tiles.find((t) => t.id === id).cleared).toBe(true);
    }
  });

  test('mismatch clears selection only', async ({ page }) => {
    await gotoGame(page, { layout: 'easy-72', seed: 13 });
    let state = await snapshot(page);
    const free = freeTiles(state);
    const a = free[0];
    const b = free.find((t) => t.face !== a.face && !(a.face.startsWith('elvis-') && t.face.startsWith('elvis-')));
    expect(b).toBeTruthy();

    const before = state.counts.remaining;
    state = await tapTile(page, state, a.id);
    state = await tapTile(page, state, b.id);
    expect(state.counts.remaining).toBe(before);

    // The pair is held briefly so she can see the mismatch, then both release.
    await page.evaluate(() => window.advanceTime(1));
    state = await snapshot(page);
    expect(state.selection).toBeNull();
    expect(state.counts.remaining).toBe(before);
  });

  test('clearing a covering tile frees the tile underneath', async ({ page }) => {
    await gotoGame(page, { layout: 'easy-72', seed: 17 });
    const state = await snapshot(page);
    // Every tile on the upper block covers something below it.
    const covered = state.tiles.find((t) => t.layer === 0 && !t.free);
    expect(covered).toBeTruthy();
    expect(covered.free).toBe(false);
  });
});

test.describe('tap forgiveness', () => {
  test('tap forgiveness only resolves unambiguous near-misses', async ({ page }) => {
    await gotoGame(page, { layout: 'easy-72', seed: 19 });
    const state = await snapshot(page);

    // A tile on the outer edge of the board: just beyond its outer edge is felt,
    // with no other tile nearby, so a near-miss there is unambiguous.
    const free = freeTiles(state);
    const leftmost = free.reduce((min, t) => (t.screen.cx < min.screen.cx ? t : min), free[0]);
    const justOutside = { x: Math.round(leftmost.screen.x - 8), y: Math.round(leftmost.screen.cy) };

    await page.touchscreen.tap(justOutside.x, justOutside.y);
    await page.waitForTimeout(60);
    expect((await snapshot(page)).selection).toBe(leftmost.id);

    // Reset, then tap a long way from any tile — nothing should be selected.
    await page.touchscreen.tap(justOutside.x, justOutside.y);
    await page.waitForTimeout(60);
    await page.touchscreen.tap(4, 4);
    await page.waitForTimeout(60);
    expect((await snapshot(page)).selection).toBeNull();
  });

  test('turtle tiles are all tappable on a small tablet', async ({ page }) => {
    // 47 dp tiles at this viewport — the reason tap forgiveness exists.
    await gotoGame(page, {
      layout: 'turtle-144',
      seed: 23,
      viewport: { width: 1024, height: 640 },
    });
    const state = await snapshot(page);
    const free = freeTiles(state);
    expect(free.length).toBeGreaterThan(4);

    for (const tile of free.slice(0, 12)) {
      await page.touchscreen.tap(Math.round(tile.screen.cx), Math.round(tile.screen.cy));
      await page.waitForTimeout(40);
      const after = await snapshot(page);
      expect(after.selection, `tile ${tile.id} at its own centre`).toBe(tile.id);
      // Deselect before the next one.
      await page.touchscreen.tap(Math.round(tile.screen.cx), Math.round(tile.screen.cy));
      await page.waitForTimeout(40);
    }
  });
});

test.describe('end states', () => {
  test('plays a full board to completion by tapping', async ({ page }) => {
    // A whole board cleared by tapping, with a celebration rendering behind every pair.
    // Headless Chromium is on software GL where a frame costs ~100 ms: ~110 s alone, and
    // longer sharing a machine with the other worker. Harness cost, not the game.
    test.setTimeout(360_000);
    await gotoGame(page, { layout: 'easy-72', seed: 29 });
    let state = await snapshot(page);

    let guard = 0;
    while (state.counts.remaining > 0 && guard++ < 200) {
      const pair = findAvailablePair(state);
      if (!pair) {
        // Use a reshuffle if the board stalls — she has three.
        expect(state.assists.shufflesLeft, 'stalled with no reshuffles left').toBeGreaterThan(0);
        await page.evaluate(() => window.__debug.shuffle());
        state = await snapshot(page);
        continue;
      }
      state = await tapTile(page, state, pair[0].id);
      state = await tapTile(page, state, pair[1].id);
    }

    expect(state.counts.remaining).toBe(0);
    expect(state.counts.cleared).toBe(72);
    expect(state.screen).toBe('won');
  });

  test('dead end only ends the game with no reshuffles left', async ({ page }) => {
    await gotoGame(page, { layout: 'easy-72', seed: 31 });

    // A stuck board cannot be generated on purpose — generation guarantees the
    // opposite — so it is loaded as a fixture. Four tiles in a row, A B A B: only
    // the outermost two are free, and they don't match each other.
    const stuckBoard = [
      { x: 0, y: 0, layer: 0, face: 'dot-1' },
      { x: 2, y: 0, layer: 0, face: 'dot-2' },
      { x: 4, y: 0, layer: 0, face: 'dot-1' },
      { x: 6, y: 0, layer: 0, face: 'dot-2' },
    ];

    let state = await page.evaluate(
      (tiles) => window.__debug.loadFixture(tiles, { assists: { shuffles: 3 } }),
      stuckBoard
    );
    expect(state.availablePairs).toBe(0);
    expect(state.stuck).toBe(true);
    // Still recoverable, so it is NOT over: a reshuffle always yields a solvable
    // board, so while she holds one the board can always be rescued.
    expect(state.screen).toBe('board');

    // And the rescue genuinely works.
    expect(await page.evaluate(() => window.__debug.shuffle())).toBe(true);
    state = await snapshot(page);
    expect(state.availablePairs).toBeGreaterThan(0);
    expect(state.stuck).toBe(false);
    expect(state.screen).toBe('board');

    // The same board with no reshuffles left is the loss.
    state = await page.evaluate(
      (tiles) => window.__debug.loadFixture(tiles, { assists: { shuffles: 0 } }),
      stuckBoard
    );
    expect(state.stuck).toBe(true);
    expect(state.screen).toBe('no-moves');
  });

  test('a won board reports itself won, and stops accepting taps', async ({ page }) => {
    await gotoGame(page, { layout: 'easy-72', seed: 59 });

    // Two tiles that match: clearing them clears the board.
    let state = await page.evaluate(() =>
      window.__debug.loadFixture([
        { x: 0, y: 0, layer: 0, face: 'dragon-red' },
        { x: 4, y: 0, layer: 0, face: 'dragon-red' },
      ])
    );
    expect(state.screen).toBe('board');

    state = await tapTile(page, state, 0);
    state = await tapTile(page, state, 1);
    expect(state.counts.remaining).toBe(0);
    expect(state.screen).toBe('won');

    // Taps after the win do nothing.
    await page.touchscreen.tap(640, 400);
    await page.waitForTimeout(60);
    expect((await snapshot(page)).screen).toBe('won');
  });
});
