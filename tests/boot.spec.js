import { test, expect } from '@playwright/test';
import {
  gotoGame,
  snapshot,
  averageColour,
  distinctColourCount,
  isGreenish,
  isBright,
} from './helpers.mjs';

// Headless Chromium composites the WebGL canvas by reading it back, and the
// ANGLE driver logs a performance warning when it does. That message comes from
// the browser, not from the game, and never appears on a real tablet — it is the
// only thing filtered here. Everything the app itself logs must be silent.
const isDriverNoise = (text) => /GL Driver Message|GPU stall due to ReadPixels/.test(text);

test('boots with a clean console', async ({ page }) => {
  const problems = [];
  page.on('console', (msg) => {
    const ignorable = msg.type() !== 'error' && msg.type() !== 'warning';
    if (ignorable || isDriverNoise(msg.text())) return;
    problems.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));

  await gotoGame(page);
  await page.waitForTimeout(500);

  expect(problems).toEqual([]);
});

test('canvas renders the board', async ({ page }) => {
  await gotoGame(page, { layout: 'easy-72' });
  const state = await snapshot(page);

  // Something is actually drawn, not a flat clear colour.
  const whole = { x: 0, y: 0, w: state.viewport.w, h: state.viewport.h };
  expect(await distinctColourCount(page, whole)).toBeGreaterThan(8);

  // Felt shows at a corner of the table, well away from the tiles.
  const corner = await averageColour(page, { x: 8, y: state.viewport.h - 40, w: 32, h: 32 });
  expect(isGreenish(corner), `corner should be felt green, got ${corner}`).toBe(true);

  // A tile face is ivory-bright. Sampled off to one side of the face: the
  // placeholder art puts big black glyphs down the middle, which would drag the
  // average down and tell us nothing about the lighting.
  const centre = state.tiles.find((t) => t.layer === Math.max(...state.tiles.map((x) => x.layer)));
  const face = await averageColour(page, {
    x: Math.round(centre.screen.cx - centre.screen.w * 0.34),
    y: Math.round(centre.screen.cy - 5),
    w: 10,
    h: 10,
  });
  expect(isBright(face), `tile face should be bright, got ${face}`).toBe(true);
});

test('renders every tile of both layouts', async ({ page }) => {
  for (const [layout, count] of [['easy-72', 72], ['turtle-144', 144]]) {
    await gotoGame(page, { layout });
    const state = await snapshot(page);
    expect(state.layout).toBe(layout);
    expect(state.tiles).toHaveLength(count);
    expect(state.counts.remaining).toBe(count);
  }
});
