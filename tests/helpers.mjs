// Shared test plumbing. Two things every spec needs: a reliable "the board is
// up" wait, and pixel readback — headless WebGL screenshots composite black
// under SwiftShader, so visual assertions read the drawing buffer directly
// (see docs/tech.md → Testing).

/** Load the game and wait until the first frame has been drawn. */
export async function gotoGame(page, { layout = null, viewport = null } = {}) {
  if (viewport) await page.setViewportSize(viewport);
  const query = layout ? `/?layout=${layout}` : '/';
  await page.goto(query);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20_000 });
  return page;
}

/** The game's own state snapshot — the documented agent/test inspection hook. */
export async function snapshot(page) {
  return await page.evaluate(() => window.render_game_to_text());
}

/**
 * Read a rectangle of pixels back out of the WebGL drawing buffer.
 * Rect is in CSS pixels with a top-left origin; returns { width, height, pixels }
 * where pixels is a flat RGBA array in the same orientation.
 */
export async function readPixels(page, rect) {
  return await page.evaluate((r) => window.__debug.readPixels(r), rect);
}

/** Average colour of a CSS-pixel rectangle, as [r, g, b]. */
export async function averageColour(page, rect) {
  const { pixels } = await readPixels(page, rect);
  let r = 0, g = 0, b = 0;
  const n = pixels.length / 4;
  for (let i = 0; i < pixels.length; i += 4) {
    r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2];
  }
  return [r / n, g / n, b / n];
}

/** Which tile (if any) is topmost under a CSS-pixel point. Returns a tile id or null. */
export async function pickAt(page, x, y) {
  return await page.evaluate(([px, py]) => window.__debug.pickAt(px, py), [x, y]);
}

/** Colours at a list of CSS-pixel points, as [r, g, b, a] each. */
export async function samplePoints(page, points) {
  return await page.evaluate((pts) => window.__debug.samplePoints(pts), points);
}

/**
 * Count roughly-distinct colours over a grid of sample points. Sampling rather
 * than reading the whole viewport back — a 1280×800 buffer at dpr 2 is four
 * million values to serialise out of the browser.
 */
export async function distinctColourCount(page, rect, { cols = 48, rows = 30, bucket = 24 } = {}) {
  const points = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      points.push([
        Math.round(rect.x + ((c + 0.5) / cols) * rect.w),
        Math.round(rect.y + ((r + 0.5) / rows) * rect.h),
      ]);
    }
  }
  const colours = await samplePoints(page, points);
  const seen = new Set();
  for (const [r, g, b] of colours) {
    seen.add([r, g, b].map((c) => Math.floor(c / bucket)).join(','));
  }
  return seen.size;
}

export const isGreenish = ([r, g, b]) => g > r + 8 && g > b + 8;
export const isBright = ([r, g, b]) => (r + g + b) / 3 > 140;

/** Screen-space rect of a tile from the snapshot, as a Playwright-friendly box. */
export function tileBox(tile) {
  return { x: tile.screen.x, y: tile.screen.y, width: tile.screen.w, height: tile.screen.h };
}

/** Do two axis-aligned rects overlap by at least `min` px in both axes? */
export function overlap(a, b, min = 4) {
  const x = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const y = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return x >= min && y >= min;
}
