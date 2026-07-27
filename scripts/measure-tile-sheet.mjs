#!/usr/bin/env node
// Finds the 43 tile rectangles in Chris's supplied sheet and writes them out as
// data. Run manually; the output is committed.
//
//   npm run measure:tiles
//
// The sheet is a PREVIEW image, not a clean sprite sheet: labelled section
// headings, drop shadows, and a decorative border. Hand-tuning 43 rectangles out of
// that would be tedious and would need redoing the moment Chris re-exports the
// sheet, so they are detected instead — the tile bodies are the only large blocks
// of cream in the image, which makes them easy to isolate.

import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SHEET = resolve('public/assets/tiles/mahjong-tiles-sheet.png');
const OUTPUT = resolve('src/board/TileSheetCells.js');

const browser = await chromium.launch();
const page = await browser.newPage();

// Handed to the page as a data URL: a blank page can't load file:// images, and
// standing up a static server just to read one PNG isn't worth it.
const sheetDataUrl = `data:image/png;base64,${readFileSync(SHEET).toString('base64')}`;

const result = await page.evaluate(async (sheetUrl) => {
  const image = new Image();
  image.src = sheetUrl;
  await image.decode();

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const W = canvas.width;
  const H = canvas.height;

  // Tile bodies are large, bright, nearly-neutral cream. The coloured glyphs
  // printed on them are holes in the mask, but the cream wraps around them so each
  // tile stays one connected blob.
  const isTileBody = (i) => {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < 200 || g < 195 || b < 170) return false;
    return Math.max(r, g, b) - Math.min(r, g, b) < 70;
  };

  const mask = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) mask[p] = isTileBody(p * 4) ? 1 : 0;

  // Flood fill each blob, recording its bounding box.
  const seen = new Uint8Array(W * H);
  const boxes = [];
  const stack = new Int32Array(W * H);

  for (let start = 0; start < W * H; start++) {
    if (!mask[start] || seen[start]) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let minX = W, maxX = 0, minY = H, maxY = 0, area = 0;

    while (top > 0) {
      const p = stack[--top];
      const x = p % W;
      const y = (p - x) / W;
      area++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[top++] = p - 1; }
      if (x < W - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[top++] = p + 1; }
      if (y > 0 && mask[p - W] && !seen[p - W]) { seen[p - W] = 1; stack[top++] = p - W; }
      if (y < H - 1 && mask[p + W] && !seen[p + W]) { seen[p + W] = 1; stack[top++] = p + W; }
    }

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    // Section headings are set in white type: plenty of blobs, all tiny.
    if (width < 55 || height < 65 || area < 2500) continue;
    if (width > 180 || height > 200) continue;
    boxes.push({ x: minX, y: minY, w: width, h: height, area });
  }

  // Group into visual rows, then read each row left to right.
  boxes.sort((a, b) => a.y - b.y);
  const rows = [];
  for (const box of boxes) {
    const row = rows.find((r) => Math.abs(r.y - box.y) < 40);
    if (row) row.boxes.push(box);
    else rows.push({ y: box.y, boxes: [box] });
  }
  for (const row of rows) row.boxes.sort((a, b) => a.x - b.x);

  return {
    sheet: { width: W, height: H },
    rows: rows.map((r) => ({ y: r.y, boxes: r.boxes })),
  };
}, sheetDataUrl);

await browser.close();

const rows = result.rows;
const counts = rows.map((r) => r.boxes.length);
console.log(`Sheet ${result.sheet.width}×${result.sheet.height}`);
console.log(`Rows detected: ${counts.join(', ')} (${counts.reduce((a, b) => a + b, 0)} tiles)`);

// The sheet's layout: three suits of nine, then winds+dragons, then flowers+seasons.
// The dragons group carries a fourth, blank tile which is not a face.
const EXPECTED = [9, 9, 9, 8, 8];
if (counts.length !== EXPECTED.length || counts.some((n, i) => n !== EXPECTED[i])) {
  console.error(`\n✗ expected rows of ${EXPECTED.join(', ')} — the sheet layout has changed.`);
  console.error('  Re-check the detection thresholds in this script before trusting the output.');
  process.exit(1);
}

const suit = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}-${i + 1}`);
const FACE_ORDER = [
  suit('dot', 9),
  suit('bamboo', 9),
  suit('character', 9),
  // Winds left to right, then the three dragons; the trailing blank is skipped.
  ['wind-east', 'wind-south', 'wind-west', 'wind-north', 'dragon-red', 'dragon-green', 'dragon-white', null],
  // Flowers and seasons stand in for the Elvis tiles until milestone 08 replaces
  // them with photographs.
  suit('elvis', 8),
];

const cells = {};
rows.forEach((row, rowIndex) => {
  row.boxes.forEach((box, columnIndex) => {
    const face = FACE_ORDER[rowIndex][columnIndex];
    if (!face) return;
    cells[face] = { x: box.x, y: box.y, w: box.w, h: box.h };
  });
});

const faceCount = Object.keys(cells).length;
if (faceCount !== 42) {
  console.error(`\n✗ mapped ${faceCount} faces, expected 42.`);
  process.exit(1);
}

// The decorative gold border runs down the left edge of the sheet. A tall slice of
// it tiles cleanly along the table rim, so the frame and the tiles come from the
// same artwork by construction.
const border = { x: 6, y: 120, w: 44, h: 480 };

const widths = Object.values(cells).map((c) => c.w);
const heights = Object.values(cells).map((c) => c.h);
console.log(
  `Face size: ${Math.min(...widths)}–${Math.max(...widths)} × ${Math.min(...heights)}–${Math.max(...heights)} px`
);

writeFileSync(
  OUTPUT,
  `// GENERATED by scripts/measure-tile-sheet.mjs — do not edit by hand.
//
// Pixel rectangles of each face in public/assets/tiles/mahjong-tiles-sheet.png,
// detected rather than eyeballed so a re-exported sheet is one command to re-measure
// (npm run measure:tiles). The 8 elvis-* entries currently point at the sheet's
// flowers and seasons; milestone 08 replaces them with photographs.

export const SHEET_SIZE = ${JSON.stringify(result.sheet)};

export const BORDER_CELL = ${JSON.stringify(border)};

export const FACE_CELLS = ${JSON.stringify(cells, null, 2)};
`
);

console.log(`\n✓ wrote ${OUTPUT} (${faceCount} faces)`);
