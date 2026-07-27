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
  // Sampled at the CENTRE of the upper tile, and only for pairs where that centre falls
  // inside the lower tile's rect. Sampling the middle of the overlap region is unreliable:
  // screen rects are axis-aligned boxes around tilted 3D tiles, so they can overlap where
  // the tiles themselves do not — which made this test fail on a board whose footprint
  // changed shape.
  let checked = 0;
  for (const up of upper) {
    const a = tileBox(up);
    const cx = Math.round(up.screen.cx);
    const cy = Math.round(up.screen.cy);
    const beneath = lower.filter((low) => {
      const b = tileBox(low);
      return cx > b.x && cx < b.x + b.width && cy > b.y && cy < b.y + b.height && overlap(a, b, 8);
    });
    for (const low of beneath.slice(0, 2)) {
      const hit = await pickAt(page, cx, cy);
      expect(hit, `centre of upper tile ${up.id} resolved to covered tile ${low.id}`).not.toBe(low.id);
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
