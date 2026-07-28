// How big is a tile, really, on the screen Dawn actually holds?
//
// Every board-sizing decision in this project has been settled by a measurement rather
// than an argument, and the numbers quoted in docs/STATE.md come from here. It drives
// the real game through a real browser — not a reimplementation of the camera fit — so
// a number it prints is a number her tablet would show.
//
//   npm run measure:boards                 every board, both ways up
//   npm run measure:boards -- cat-144      just one
//
// Needs the dev server up (npm run dev).
import { chromium } from '@playwright/test';
import { LAYOUT_IDS } from '../src/board/Layouts.js';

// Her Galaxy Tab A11+ presents about 960 × 600 dp at Android's default display size.
// Upright is how she plays; on its side is checked so a fix for one can't quietly
// wreck the other.
const VIEWPORTS = [
  { width: 600, height: 960, label: 'upright' },
  { width: 960, height: 600, label: 'on its side' },
];

const boards = process.argv.slice(2).length ? process.argv.slice(2) : LAYOUT_IDS;

const browser = await chromium.launch();
// deviceScaleFactor 1: everything here is measured in dp, which is what a touch target
// is specified in — physical resolution is not the constraint.
const page = await browser.newPage({ deviceScaleFactor: 1, hasTouch: true });

for (const board of boards) {
  const cells = [];
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    // A fixed seed so a re-run compares like with like — the surprise board is a
    // different shape every game otherwise.
    await page.goto(`http://localhost:3100/?layout=${board}&seed=7`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });
    const state = await page.evaluate(() => window.render_game_to_text());

    const smallest = state.tiles.reduce((min, t) => Math.min(min, t.screen.w, t.screen.h), Infinity);
    const span = (axis) =>
      (Math.max(...state.tiles.map((t) => t[axis])) - Math.min(...state.tiles.map((t) => t[axis]))) / 2 + 1;
    const layers = Math.max(...state.tiles.map((t) => t.layer)) + 1;
    // A tile under the frame or off the edge cannot be tapped at all, so it is worth
    // more than the tile-size number beside it.
    const clipped = state.tiles.filter(
      (t) =>
        t.screen.x < 0 ||
        t.screen.y < 0 ||
        t.screen.x + t.screen.w > viewport.width ||
        t.screen.y + t.screen.h > viewport.height
    ).length;

    cells.push(
      `${String(Math.round(smallest)).padStart(3)}dp ${`${span('x')}×${span('y')}×${layers}`.padEnd(9)}` +
        ` ${String(state.availablePairs).padStart(2)} pairs${clipped ? ` CLIPPED:${clipped}` : ''}`
    );
  }
  console.log(`${board.padEnd(14)} upright ${cells[0].padEnd(30)} | on its side ${cells[1]}`);
}

await browser.close();
