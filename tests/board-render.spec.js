import { test, expect } from '@playwright/test';
import { gotoGame, snapshot, pickAt, tileBox, overlap } from './helpers.mjs';

test('upper layers occlude lower layers', async ({ page }) => {
  await gotoGame(page, { layout: 'easy-72' });
  const state = await snapshot(page);

  const upper = state.tiles.filter((t) => t.layer === 1);
  const lower = state.tiles.filter((t) => t.layer === 0);
  expect(upper.length).toBeGreaterThan(0);

  // Find upper/lower pairs whose screen rects genuinely overlap — on a tilted
  // camera the upper layer always covers part of the tiles behind it.
  let checked = 0;
  for (const up of upper) {
    const covered = lower.filter((low) => overlap(tileBox(up), tileBox(low), 8));
    for (const low of covered.slice(0, 2)) {
      const a = tileBox(up);
      const b = tileBox(low);
      const x = Math.round((Math.max(a.x, b.x) + Math.min(a.x + a.width, b.x + b.width)) / 2);
      const y = Math.round((Math.max(a.y, b.y) + Math.min(a.y + a.height, b.y + b.height)) / 2);
      const hit = await pickAt(page, x, y);
      // Whatever is at an overlap point must not be the tile underneath.
      expect(hit, `point (${x},${y}) resolved to the covered tile ${low.id}`).not.toBe(low.id);
      checked++;
      if (checked >= 12) break;
    }
    if (checked >= 12) break;
  }
  expect(checked, 'expected overlapping tiles to test').toBeGreaterThan(0);
});

test('tapping the middle of a tile picks that tile', async ({ page }) => {
  await gotoGame(page, { layout: 'easy-72' });
  const state = await snapshot(page);

  // Top-layer tiles are never covered, so the centre of each must resolve to
  // itself. This is the accuracy guarantee milestone 02's input builds on.
  const top = state.tiles.filter((t) => t.layer === 1).slice(0, 10);
  for (const tile of top) {
    const hit = await pickAt(page, Math.round(tile.screen.cx), Math.round(tile.screen.cy));
    expect(hit, `centre of tile ${tile.id} should pick itself`).toBe(tile.id);
  }
});

test('tiles stack upward with visible layer separation', async ({ page }) => {
  await gotoGame(page, { layout: 'turtle-144' });
  const state = await snapshot(page);

  // Higher layers must sit higher on screen (the camera tilt is what makes
  // depth readable) and each layer must be lifted in world space.
  const meanY = (layer) => {
    const tiles = state.tiles.filter((t) => t.layer === layer);
    return tiles.reduce((s, t) => s + t.screen.cy, 0) / tiles.length;
  };
  for (let layer = 1; layer <= 4; layer++) {
    expect(meanY(layer), `layer ${layer} should sit higher than ${layer - 1}`).toBeLessThan(meanY(layer - 1));
  }
});
