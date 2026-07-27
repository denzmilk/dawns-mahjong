import { test, expect } from '@playwright/test';
import { gotoGame, snapshot } from './helpers.mjs';

// ADR-0002 constraint 1: a single tap is the entire control scheme. A gesture
// she didn't mean to make must not be able to change the view, because she has
// no way to put it back. A browser can't be made to really pinch-zoom from a
// synthetic event, so these assert the mechanisms that suppress it — the
// gesture itself is on the milestone's playtest list.

test('only single taps reach the game', async ({ page }) => {
  await gotoGame(page);

  const viewportMeta = await page.getAttribute('meta[name="viewport"]', 'content');
  expect(viewportMeta).toContain('user-scalable=no');
  expect(viewportMeta).toContain('maximum-scale=1');

  const styles = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const canvas = getComputedStyle(document.querySelector('canvas'));
    const html = getComputedStyle(document.documentElement);
    return {
      bodyTouchAction: body.touchAction,
      canvasTouchAction: canvas.touchAction,
      userSelect: body.userSelect || body.webkitUserSelect,
      overscroll: html.overscrollBehavior || body.overscrollBehavior,
    };
  });
  expect(styles.bodyTouchAction).toBe('none');
  expect(styles.canvasTouchAction).toBe('none');
  expect(styles.userSelect).toBe('none');
  expect(styles.overscroll).toContain('none');

  // The events Android fires for long-press, double-tap-zoom and pinch are all
  // cancelled rather than left to the browser.
  const prevented = await page.evaluate(() => {
    const fire = (type, init = {}) => {
      const ev = new Event(type, { bubbles: true, cancelable: true, ...init });
      document.body.dispatchEvent(ev);
      return ev.defaultPrevented;
    };
    return {
      contextmenu: fire('contextmenu'),
      dblclick: fire('dblclick'),
      gesturestart: fire('gesturestart'),
    };
  });
  expect(prevented.contextmenu).toBe(true);
  expect(prevented.dblclick).toBe(true);
  expect(prevented.gesturestart).toBe(true);
});

test('the camera never moves in response to input', async ({ page }) => {
  await gotoGame(page, { layout: 'easy-72' });
  const before = await snapshot(page);

  const box = await page.locator('canvas').boundingBox();
  // A drag across the board and a wheel — everything that would orbit or zoom a
  // conventional 3D scene. Neither is a tap, so nothing at all should change.
  await page.mouse.move(box.x + 200, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 900, box.y + 600, { steps: 12 });
  await page.mouse.up();
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(200);

  let after = await snapshot(page);
  expect(after.camera).toEqual(before.camera);
  expect(after.selection, 'a drag must not select anything').toBeNull();
  // Tile screen positions are the real proof — the board did not move.
  expect(after.tiles.map((t) => [t.screen.cx, t.screen.cy])).toEqual(
    before.tiles.map((t) => [t.screen.cx, t.screen.cy])
  );

  // A tap does lift the tile it selects, so the camera is checked on its own here:
  // the board may respond to a tap, but the viewpoint never does.
  await page.touchscreen.tap(box.x + 300, box.y + 300);
  await page.waitForTimeout(200);
  after = await snapshot(page);
  expect(after.camera).toEqual(before.camera);
  const unselected = (state) =>
    state.tiles.filter((t) => t.id !== state.selection).map((t) => [t.screen.cx, t.screen.cy]);
  expect(unselected(after)).toEqual(unselected({ ...before, selection: after.selection }));
});
