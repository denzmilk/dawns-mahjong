import { test, expect } from '@playwright/test';
import { gotoGame, snapshot } from './helpers.mjs';

test('render_game_to_text shape', async ({ page }) => {
  await gotoGame(page, { layout: 'easy-72' });
  const state = await snapshot(page);

  expect(state.screen).toBe('board');
  expect(state.layout).toBe('easy-72');
  expect(state.viewport).toEqual({ w: 1280, h: 800, dpr: expect.any(Number) });
  expect(state.camera).toEqual({
    tiltDegrees: expect.any(Number),
    distance: expect.any(Number),
    target: { x: expect.any(Number), y: expect.any(Number), z: expect.any(Number) },
  });
  expect(state.counts).toEqual({ total: 72, remaining: 72, cleared: 0 });
  expect(state.assists).toEqual({ hintsLeft: 10, shufflesLeft: 3 });
  expect(state.selection).toBeNull();
  expect(state.time).toEqual({ mode: 'auto', elapsed: expect.any(Number) });
  expect(typeof state.renderCount).toBe('number');

  for (const tile of state.tiles) {
    expect(tile).toEqual({
      id: expect.any(Number),
      x: expect.any(Number),
      y: expect.any(Number),
      layer: expect.any(Number),
      face: expect.any(String),
      cleared: false,
      screen: {
        x: expect.any(Number),
        y: expect.any(Number),
        w: expect.any(Number),
        h: expect.any(Number),
        cx: expect.any(Number),
        cy: expect.any(Number),
      },
    });
  }

  // Ids are unique and stable — milestone 02 addresses tiles by id.
  const ids = state.tiles.map((t) => t.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test('advanceTime is deterministic', async ({ page }) => {
  const run = async () => {
    await gotoGame(page, { layout: 'turtle-144' });
    await page.evaluate(() => window.advanceTime(1));
    const state = await snapshot(page);
    // renderCount is wall-clock dependent before manual time takes over.
    delete state.renderCount;
    return state;
  };

  const first = await run();
  const second = await run();

  expect(second).toEqual(first);
  expect(first.time).toEqual({ mode: 'manual', elapsed: 1 });
});

test('render loop idles when static', async ({ page }) => {
  await gotoGame(page, { layout: 'easy-72' });
  // Let any first-frame settling finish.
  await page.waitForTimeout(600);

  const before = (await snapshot(page)).renderCount;
  await page.waitForTimeout(700);
  const after = (await snapshot(page)).renderCount;

  // Nothing is animating, so nothing should be redrawn — this is the tablet
  // battery decision in docs/tech.md, and it silently regresses if untested.
  expect(after).toBe(before);
});

test('a resize redraws and reframes the board', async ({ page }) => {
  await gotoGame(page, { layout: 'easy-72' });
  const before = await snapshot(page);

  await page.setViewportSize({ width: 1000, height: 700 });
  // window.innerWidth updates before the resize listener runs and before the next
  // frame draws, so wait on the redraw itself rather than the viewport size.
  await page.waitForFunction(
    (count) => window.render_game_to_text().renderCount > count,
    before.renderCount
  );
  const after = await snapshot(page);

  expect(after.viewport.w).toBe(1000);
  expect(after.tiles[0].screen.cx).not.toBe(before.tiles[0].screen.cx);
});
