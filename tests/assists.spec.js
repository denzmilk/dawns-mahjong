import { test, expect } from '@playwright/test';
import { gotoGame, snapshot, tapTile } from './helpers.mjs';

// 10 hints and 3 reshuffles per board, chosen by Chris. Finite, so they have to be
// spendable and then genuinely spent — a hint button that silently does nothing
// once exhausted would be worse than one that visibly greys out (milestone 04).

test('hints are valid and finite', async ({ page }) => {
  await gotoGame(page, { layout: 'easy-72', seed: 37 });
  let state = await snapshot(page);
  expect(state.assists.hintsLeft).toBe(10);

  for (let used = 1; used <= 10; used++) {
    const hint = await page.evaluate(() => window.__debug.hint());
    expect(hint, `hint ${used} should return a pair`).not.toBeNull();
    expect(hint.pair).toHaveLength(2);

    // The suggested pair must actually be playable and matching.
    state = await snapshot(page);
    const [a, b] = hint.pair.map((id) => state.tiles.find((t) => t.id === id));
    expect(a.free && b.free, `hint ${used} suggested a blocked tile`).toBe(true);
    const elvis = a.face.startsWith('elvis-') && b.face.startsWith('elvis-');
    expect(a.face === b.face || elvis, `hint ${used}: ${a.face} vs ${b.face}`).toBe(true);
    expect(state.assists.hintsLeft).toBe(10 - used);
  }

  // Exhausted: no more hints, and no crash.
  expect(await page.evaluate(() => window.__debug.hint())).toBeNull();
  expect((await snapshot(page)).assists.hintsLeft).toBe(0);
});

test('a hint highlights the pair, then releases', async ({ page }) => {
  await gotoGame(page, { layout: 'easy-72', seed: 41 });
  const hint = await page.evaluate(() => window.__debug.hint());
  let state = await snapshot(page);
  expect(state.hintPair).toEqual(hint.pair);

  await page.evaluate(() => window.advanceTime(6));
  state = await snapshot(page);
  expect(state.hintPair).toBeNull();
});

test('reshuffles are finite', async ({ page }) => {
  await gotoGame(page, { layout: 'easy-72', seed: 43 });
  expect((await snapshot(page)).assists.shufflesLeft).toBe(3);

  for (let used = 1; used <= 3; used++) {
    const before = (await snapshot(page)).tiles.map((t) => t.face).join(',');
    const result = await page.evaluate(() => window.__debug.shuffle());
    expect(result, `shuffle ${used} should succeed`).toBe(true);
    const state = await snapshot(page);
    expect(state.assists.shufflesLeft).toBe(3 - used);
    expect(state.tiles.map((t) => t.face).join(',')).not.toBe(before);
    // A shuffled board must still be winnable and have a move available.
    expect(state.availablePairs).toBeGreaterThan(0);
  }

  expect(await page.evaluate(() => window.__debug.shuffle())).toBe(false);
  expect((await snapshot(page)).assists.shufflesLeft).toBe(0);
});

test('a reshuffle keeps the tiles already cleared cleared', async ({ page }) => {
  await gotoGame(page, { layout: 'easy-72', seed: 47 });
  let state = await snapshot(page);

  const hint = await page.evaluate(() => window.__debug.hint());
  state = await tapTile(page, state, hint.pair[0]);
  state = await tapTile(page, state, hint.pair[1]);
  expect(state.counts.remaining).toBe(70);

  await page.evaluate(() => window.__debug.shuffle());
  state = await snapshot(page);
  expect(state.counts.remaining).toBe(70);
  expect(state.counts.cleared).toBe(2);
  for (const id of hint.pair) {
    expect(state.tiles.find((t) => t.id === id).cleared).toBe(true);
  }
});

test('assists survive a new board', async ({ page }) => {
  await gotoGame(page, { layout: 'easy-72', seed: 53 });
  await page.evaluate(() => window.__debug.hint());
  await page.evaluate(() => window.__debug.shuffle());
  let state = await snapshot(page);
  expect(state.assists).toEqual({ hintsLeft: 9, shufflesLeft: 2 });

  await page.evaluate(() => window.__debug.newBoard());
  state = await snapshot(page);
  expect(state.assists).toEqual({ hintsLeft: 10, shufflesLeft: 3 });
  expect(state.counts).toEqual({ total: 72, remaining: 72, cleared: 0 });
  expect(state.selection).toBeNull();
  expect(state.screen).toBe('board');
});
