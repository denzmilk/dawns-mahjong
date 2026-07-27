import { ATLAS, COLORS, ELVIS_FACES, ELVIS_TILE_PHOTOS, FACES } from '../core/Constants.js';
import { BORDER_CELL, FACE_CELLS, SHEET_SIZE } from '../board/TileSheetCells.js';

// Chris's tile artwork arrives as one 1024×1024 preview sheet with all 42 faces on
// it, labelled and drop-shadowed. This crops the faces out of it into a single
// texture atlas at boot: one texture and one material for all 144 tiles, which keeps
// the draw calls cheap on a tablet GPU.
//
// The crop rectangles come from scripts/measure-tile-sheet.mjs (npm run
// measure:tiles), so re-exporting the sheet is one command rather than an
// afternoon of nudging coordinates.

export const sheetUrl = () =>
  new URL('assets/tiles/mahjong-tiles-sheet.png', document.baseURI).href;

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load ${url}`));
    image.src = url;
  });
}

/** Where a face sits in the atlas canvas, in pixels. */
export function atlasCell(index) {
  const { columns, cellWidth, cellHeight } = ATLAS;
  return {
    x: (index % columns) * cellWidth,
    y: Math.floor(index / columns) * cellHeight,
  };
}

export function atlasSize() {
  const { columns, cellWidth, cellHeight } = ATLAS;
  const slots = FACES.length + 1; // + the flat cell every tile's sides point at
  const rows = Math.ceil(slots / columns);
  return { width: columns * cellWidth, height: rows * cellHeight, rows };
}

/**
 * Builds the atlas canvas from the sheet. Faces are drawn inset inside their cell,
 * on a bed of tile cream: the padding stops neighbouring faces bleeding into each
 * other once the texture is mipmapped and viewed at an angle.
 */
export function buildAtlasCanvas(sheet) {
  const { columns, cellWidth, cellHeight, padding } = ATLAS;
  const { width, height } = atlasSize();

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.fillStyle = hexCss(COLORS.ivory);
  ctx.fillRect(0, 0, width, height);

  FACES.forEach((face, index) => {
    const cell = FACE_CELLS[face];
    const at = atlasCell(index);
    if (!cell) return;
    ctx.drawImage(
      sheet,
      cell.x,
      cell.y,
      cell.w,
      cell.h,
      at.x + padding,
      at.y + padding,
      cellWidth - padding * 2,
      cellHeight - padding * 2
    );
  });

  // The flat cell used by every tile's sides and back.
  const sideAt = atlasCell(ATLAS.sideCellIndex);
  ctx.fillStyle = hexCss(COLORS.tileSide);
  ctx.fillRect(sideAt.x, sideAt.y, cellWidth, cellHeight);

  return canvas;
}

/**
 * Draws the Elvis photographs over the eight bonus cells, in place of the sheet's
 * flowers and seasons. Each gets a cream matte and a gold hairline so it still reads
 * as a mahjong tile rather than a photo floating on the felt.
 */
export function drawElvisFaces(canvas, photos) {
  const { cellWidth, cellHeight, padding } = ATLAS;
  const ctx = canvas.getContext('2d');

  ELVIS_FACES.forEach((face, i) => {
    const photo = photos[i];
    if (!photo) return;
    const at = atlasCell(FACES.indexOf(face));
    const inner = {
      x: at.x + padding,
      y: at.y + padding,
      w: cellWidth - padding * 2,
      h: cellHeight - padding * 2,
    };

    ctx.save();
    ctx.fillStyle = hexCss(COLORS.ivory);
    ctx.fillRect(at.x, at.y, cellWidth, cellHeight);

    // Crop tight around his face, in the tile's portrait aspect. A full-frame
    // cover-crop of a publicity still puts a jacket on the tile, and a jacket is not
    // recognisable as Elvis at 80 px.
    const entry = ELVIS_TILE_PHOTOS[i] || {};
    const target = inner.w / inner.h;
    const zoom = entry.zoom ?? 0.5;
    let sh = photo.naturalHeight * zoom;
    let sw = sh * target;
    if (sw > photo.naturalWidth) {
      sw = photo.naturalWidth;
      sh = sw / target;
    }
    const clamp = (value, max) => Math.max(0, Math.min(max, value));
    const sx = clamp(photo.naturalWidth * (entry.focusX ?? 0.5) - sw / 2, photo.naturalWidth - sw);
    const sy = clamp(photo.naturalHeight * (entry.focusY ?? 0.3) - sh / 2, photo.naturalHeight - sh);

    ctx.beginPath();
    ctx.rect(inner.x, inner.y, inner.w, inner.h);
    ctx.clip();
    ctx.drawImage(photo, sx, sy, sw, sh, inner.x, inner.y, inner.w, inner.h);
    ctx.restore();

    ctx.strokeStyle = hexCss(COLORS.gold);
    ctx.lineWidth = 4;
    ctx.strokeRect(inner.x + 2, inner.y + 2, inner.w - 4, inner.h - 4);
  });

  return canvas;
}

const elvisPhotoUrl = (file) => new URL(`assets/elvis/${file}`, document.baseURI).href;

/** Loads the sheet and returns the atlas canvas ready for upload. */
export async function loadTileAtlas() {
  const sheet = await loadImage(sheetUrl());
  if (sheet.naturalWidth !== SHEET_SIZE.width || sheet.naturalHeight !== SHEET_SIZE.height) {
    // The measured crop rectangles only mean anything against the sheet they were
    // measured from, so a swapped sheet has to be loud rather than subtly wrong.
    throw new Error(
      `tile sheet is ${sheet.naturalWidth}×${sheet.naturalHeight}, expected ` +
        `${SHEET_SIZE.width}×${SHEET_SIZE.height} — re-run "npm run measure:tiles"`
    );
  }
  const canvas = buildAtlasCanvas(sheet);

  // The photographs are a bonus: if any of them fail to load, the board keeps the
  // sheet's flowers and seasons on those eight tiles and remains perfectly playable.
  try {
    const photos = await Promise.all(
      ELVIS_TILE_PHOTOS.map((entry) => loadImage(elvisPhotoUrl(entry.file)))
    );
    drawElvisFaces(canvas, photos);
  } catch (error) {
    console.warn('Elvis tile faces unavailable, keeping the flowers and seasons:', error);
  }

  return canvas;
}

/**
 * The sheet's gold Greek-key border, as a CSS background shorthand. Lifting the
 * frame out of the same artwork as the tiles means the two match by construction
 * rather than by a colour someone picked to be close.
 */
export function borderBackgroundCss() {
  return {
    url: sheetUrl(),
    offsetX: -BORDER_CELL.x,
    offsetY: -BORDER_CELL.y,
    width: BORDER_CELL.w,
    height: BORDER_CELL.h,
    sheetWidth: SHEET_SIZE.width,
    sheetHeight: SHEET_SIZE.height,
  };
}

// Local helper so this module doesn't need to import three just to turn a hex
// number into a CSS colour string.
function hexCss(value) {
  return `#${value.toString(16).padStart(6, '0')}`;
}
