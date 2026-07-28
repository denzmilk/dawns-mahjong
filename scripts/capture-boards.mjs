// Saves a PNG of a board as it actually renders, into output/iterate/.
//
// Headless WebGL screenshots composite black under software GL, so this goes through the
// game's own readback hook (window.__debug.capture) rather than Playwright's screenshot.
//
//   npm run capture:boards -- turtle-144 steps-48
import { writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const VIEWPORTS = [
  { width: 600, height: 960, label: 'upright' },
  { width: 960, height: 600, label: 'side' },
];

const boards = process.argv.slice(2);
if (!boards.length) throw new Error('name at least one board');

mkdirSync('output/iterate', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1, hasTouch: true });

for (const board of boards) {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.goto(`http://localhost:3100/?layout=${board}&seed=7`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });
    const url = await page.evaluate(() => window.__debug.capture());
    const file = `output/iterate/${board}-${viewport.label}.png`;
    writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log(file);
  }
}

await browser.close();
