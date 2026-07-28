import { test, expect } from '@playwright/test';
import { gotoGame, snapshot, samplePoints } from './helpers.mjs';

// The magnifying glass (ADR-0004). It is the one thing in this game that can be dragged,
// and ADR-0002 forbids dragging everywhere else, so most of what these check is that the
// exception stays inside its own edges.

const HER_TABLET = { width: 600, height: 960 };

const magnifier = (page) => page.evaluate(() => window.render_game_to_text().magnifier);

async function openBoardWithGlass(page, { layout = 'turtle-144', seed = 7 } = {}) {
  await gotoGame(page, { layout, seed, viewport: HER_TABLET });
  await page.evaluate(() => window.__debug.magnifier.set(true));
  return magnifier(page);
}

test('the glass is off until she asks for it, and the bar says so', async ({ page }) => {
  await gotoGame(page, { layout: 'steps-48', viewport: HER_TABLET });
  expect((await magnifier(page)).on).toBe(false);
  expect(await page.getAttribute('#btn-magnifier', 'aria-pressed')).toBe('false');

  await page.click('#btn-magnifier');
  expect((await magnifier(page)).on).toBe(true);
  expect(await page.getAttribute('#btn-magnifier', 'aria-pressed')).toBe('true');

  await page.click('#btn-magnifier');
  expect((await magnifier(page)).on).toBe(false);
});

test('she gets the glass back next time if she left it out', async ({ page }) => {
  await gotoGame(page, { layout: 'steps-48', viewport: HER_TABLET });
  await page.click('#btn-magnifier');
  expect((await magnifier(page)).on).toBe(true);

  await page.reload();
  await page.waitForFunction(() => window.__ready === true);
  expect((await magnifier(page)).on).toBe(true);
  expect(await page.getAttribute('#btn-magnifier', 'aria-pressed')).toBe('true');
});

test('a finger drags the glass, and it cannot be dragged off the screen', async ({ page }) => {
  const start = await openBoardWithGlass(page);
  expect(start.on).toBe(true);

  // Picked up by the glass and carried. This is the ADR-0004 exception in action: the same
  // gesture anywhere else on the board does nothing at all (see gestures.spec.js).
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x - 120, start.y + 160, { steps: 8 });
  await page.mouse.up();

  const moved = await magnifier(page);
  expect(moved.x).toBeCloseTo(start.x - 120, 0);
  expect(moved.y).toBeCloseTo(start.y + 160, 0);

  // Dragged hard at the corner, it stops at the edge rather than leaving with no way back.
  await page.mouse.move(moved.x, moved.y);
  await page.mouse.down();
  await page.mouse.move(-500, -500, { steps: 8 });
  await page.mouse.up();

  const cornered = await magnifier(page);
  expect(cornered.x).toBeGreaterThanOrEqual(cornered.radius);
  expect(cornered.y).toBeGreaterThanOrEqual(cornered.radius);
  expect(cornered.x).toBeLessThanOrEqual(HER_TABLET.width - cornered.radius);
  expect(cornered.y).toBeLessThanOrEqual(HER_TABLET.height - cornered.radius);
});

test('a drag on the board is still not a tap, with the glass out', async ({ page }) => {
  // ADR-0002 constraint 1 is unchanged everywhere except on the glass itself. If turning
  // the magnifier on quietly made the whole board draggable, the exception would have
  // eaten the rule.
  const lens = await openBoardWithGlass(page, { layout: 'steps-48' });
  const before = await snapshot(page);

  const away = { x: lens.radius / 3, y: lens.radius / 3 };
  await page.mouse.move(away.x, away.y);
  await page.mouse.down();
  await page.mouse.move(away.x + 200, away.y + 260, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(120);

  const after = await snapshot(page);
  expect(after.selection, 'a drag off the glass must not select anything').toBeNull();
  expect(after.magnifier.x, 'a drag off the glass must not move the glass').toBe(lens.x);
  expect(after.magnifier.y).toBe(lens.y);
  expect(after.camera).toEqual(before.camera);
});

test('a tap through the glass plays the tile she can see, not the one underneath', async ({
  page,
}) => {
  const state = await gotoGame(page, { layout: 'steps-48', seed: 7, viewport: HER_TABLET }).then(() =>
    snapshot(page)
  );

  // A free tile away from the middle, so magnifying about the lens centre genuinely moves
  // where the tap lands — a tile at the exact centre would pass either way.
  const free = state.tiles.filter((t) => t.free && !t.cleared);
  const target = free.reduce((best, t) =>
    Math.hypot(t.screen.cx - 300, t.screen.cy - 480) > Math.hypot(best.screen.cx - 300, best.screen.cy - 480)
      ? t
      : best
  );

  // Park the glass so the tile shows near its edge, then work out where on screen that
  // tile now appears through it.
  const lensX = target.screen.cx - 60;
  const lensY = target.screen.cy - 60;
  await page.evaluate(
    ([on, x, y]) => {
      window.__debug.magnifier.set(on);
      window.__debug.magnifier.moveTo(x, y);
    },
    [true, lensX, lensY]
  );
  const lens = await magnifier(page);
  const through = {
    x: lens.x + (target.screen.cx - lens.x) * lens.zoom,
    y: lens.y + (target.screen.cy - lens.y) * lens.zoom,
  };
  // The magnified image of the tile has to actually be on the glass for this to mean
  // anything.
  expect(Math.hypot(through.x - lens.x, through.y - lens.y)).toBeLessThan(lens.radius);

  await page.touchscreen.tap(Math.round(through.x), Math.round(through.y));
  await page.waitForTimeout(120);
  expect((await snapshot(page)).selection).toBe(target.id);
});

test('the glass actually magnifies — the same board, drawn bigger', async ({ page }) => {
  // The lens re-renders the scene rather than blowing up pixels, so the proof is that the
  // patch under the glass changes when the glass appears, and changes back when it goes.
  // Pixel readback, because headless WebGL screenshots composite black (docs/tech.md).
  await gotoGame(page, { layout: 'steps-48', seed: 7, viewport: HER_TABLET });
  const lens = await page.evaluate(() => {
    window.__debug.magnifier.moveTo(300, 480);
    return window.render_game_to_text().magnifier;
  });

  // A ring of points just inside the rim, where a 2× zoom moves the board the most.
  const points = [0, 1, 2, 3, 4, 5].map((n) => {
    const angle = (n / 6) * Math.PI * 2;
    return [
      Math.round(lens.x + Math.cos(angle) * lens.radius * 0.7),
      Math.round(lens.y + Math.sin(angle) * lens.radius * 0.7),
    ];
  });
  const plain = await samplePoints(page, points);

  await page.evaluate(() => window.__debug.magnifier.set(true));
  const magnified = await samplePoints(page, points);

  const changed = points.filter((_, i) =>
    plain[i].some((channel, c) => Math.abs(channel - magnified[i][c]) > 12)
  );
  expect(changed.length, 'the glass drew the same thing it covered').toBeGreaterThan(0);

  // And the gold rim is on screen where the lens says it is.
  const [rim] = await samplePoints(page, [[Math.round(lens.x + lens.radius + 4), Math.round(lens.y)]]);
  expect(rim[0], `rim red channel, got ${rim}`).toBeGreaterThan(140);
  expect(rim[2], 'the rim should be gold, not grey').toBeLessThan(rim[0] - 40);
});
