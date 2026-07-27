import { SURPRISE } from '../core/Constants.js';

// The surprise board: a different shape every time, so there is always another one to
// play. Stars, rings, hearts, crosses, flowers, blobs — rasterised onto the same
// half-tile lattice as the hand-authored boards and stacked by erosion.
//
// Two properties matter and both are guaranteed by construction rather than hoped for:
//
//   * exactly SURPRISE.tiles tiles, always even, so the board can be cleared in pairs;
//   * every tile above the base rests on a tile below it — each layer is an *erosion*
//     of the one beneath (a cell survives only if it and all four of its neighbours
//     were there), so an upper tile always has its own footprint underneath.
//
// Solvability is not this file's problem: BoardGenerator deals faces by playing the
// board, so any supported arrangement of an even number of positions is completable.

const TAU = Math.PI * 2;

/**
 * Each silhouette answers "is this point inside me?" in normalised coordinates, where
 * u and v both run -1 → 1 across the board. Anisotropic on purpose: shapes stretch to
 * fill a wide board rather than sitting as a small circle in the middle.
 */
const SILHOUETTES = [
  {
    name: 'star',
    random: (rng) => ({ points: 5 + Math.floor(rng() * 4), waist: 0.42 + rng() * 0.2 }),
    inside: (u, v, { points, waist }) => {
      const r = Math.hypot(u, v);
      const angle = Math.atan2(v, u);
      const spike = (Math.cos(angle * points) + 1) / 2;
      return r <= waist + (1 - waist) * spike;
    },
  },
  {
    name: 'ring',
    random: (rng) => ({ inner: 0.3 + rng() * 0.18 }),
    inside: (u, v, { inner }) => {
      const r = Math.hypot(u, v);
      return r <= 1 && r >= inner;
    },
  },
  {
    name: 'flower',
    random: (rng) => ({ petals: 4 + Math.floor(rng() * 4) }),
    inside: (u, v, { petals }) => {
      const r = Math.hypot(u, v);
      const angle = Math.atan2(v, u);
      return r <= 0.55 + 0.45 * Math.abs(Math.sin((angle * petals) / 2));
    },
  },
  {
    name: 'heart',
    random: () => ({}),
    inside: (u, v) => {
      // The usual implicit heart, flipped so the point is at the bottom. Scaled to
      // nearly fill the board: at 1.25 the heart was too small to hold 144 tiles and
      // the generator skipped it every time, so hearts never actually appeared.
      const x = u * 1.04;
      const y = -v * 1.06;
      const a = x * x + y * y - 0.7;
      return a * a * a - x * x * y * y * y <= 0;
    },
  },
  {
    name: 'cross',
    random: (rng) => ({ arm: 0.3 + rng() * 0.16 }),
    inside: (u, v, { arm }) => Math.abs(u) <= arm || Math.abs(v) <= arm,
  },
  {
    name: 'diamond',
    random: (rng) => ({ pinch: 0.85 + rng() * 0.35 }),
    inside: (u, v, { pinch }) => Math.abs(u) ** pinch + Math.abs(v) ** pinch <= 1,
  },
  {
    name: 'butterfly',
    random: (rng) => ({ lobes: 2 + Math.floor(rng() * 2) }),
    inside: (u, v, { lobes }) => {
      const r = Math.hypot(u, v);
      const angle = Math.atan2(v, u);
      const wings = Math.abs(Math.cos(angle * lobes)) * 0.55 + 0.45;
      return r <= wings || Math.abs(u) <= 0.14;
    },
  },
  {
    name: 'blob',
    random: (rng) => ({
      wobble: rng() * TAU,
      lumps: 3 + Math.floor(rng() * 3),
      depth: 0.16 + rng() * 0.14,
    }),
    inside: (u, v, { wobble, lumps, depth }) => {
      const r = Math.hypot(u, v);
      const angle = Math.atan2(v, u);
      return r <= 1 - depth + depth * Math.sin(angle * lumps + wobble);
    },
  },
];

function rasterise(silhouette, params, width, height) {
  const grid = [];
  for (let row = 0; row < height; row++) {
    const line = [];
    for (let col = 0; col < width; col++) {
      // Cell centres, so a shape can't be missed by sampling its edge.
      const u = (col + 0.5) / (width / 2) - 1;
      const v = (row + 0.5) / (height / 2) - 1;
      line.push(silhouette.inside(u, v, params) ? 1 : 0);
    }
    grid.push(line);
  }
  return grid;
}

/** A cell survives to the next layer only if it and its four neighbours are present. */
function erode(grid) {
  const height = grid.length;
  const width = grid[0].length;
  const next = [];
  for (let row = 0; row < height; row++) {
    const line = [];
    for (let col = 0; col < width; col++) {
      const at = (r, c) => (r >= 0 && r < height && c >= 0 && c < width ? grid[r][c] : 0);
      const solid =
        at(row, col) && at(row - 1, col) && at(row + 1, col) && at(row, col - 1) && at(row, col + 1);
      line.push(solid ? 1 : 0);
    }
    next.push(line);
  }
  return next;
}

const countGrid = (grid) => grid.reduce((sum, line) => sum + line.reduce((a, b) => a + b, 0), 0);

function buildStack(silhouette, params, width, height) {
  const layers = [rasterise(silhouette, params, width, height)];
  while (layers.length < SURPRISE.maxLayers) {
    const next = erode(layers[layers.length - 1]);
    if (countGrid(next) === 0) break;
    layers.push(next);
  }
  return layers;
}

/**
 * Trims down to exactly `target` tiles by removing from the TOP layer first, outermost
 * cells before inner ones. Removing an upper tile can never leave another unsupported,
 * so support survives the trim — which is why it only ever cuts downward.
 */
function trimTo(layers, target) {
  let total = layers.reduce((sum, layer) => sum + countGrid(layer), 0);
  const height = layers[0].length;
  const width = layers[0][0].length;
  const centreRow = (height - 1) / 2;
  const centreCol = (width - 1) / 2;

  for (let layer = layers.length - 1; layer >= 0 && total > target; layer--) {
    const cells = [];
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        if (layers[layer][row][col]) {
          cells.push({ row, col, distance: Math.hypot(row - centreRow, (col - centreCol) / 2) });
        }
      }
    }
    // Outermost first, so what is left stays a centred, plausible peak.
    cells.sort((a, b) => b.distance - a.distance || b.col - a.col || b.row - a.row);
    for (const cell of cells) {
      if (total <= target) break;
      layers[layer][cell.row][cell.col] = 0;
      total--;
    }
  }
  return layers.filter((layer) => countGrid(layer) > 0);
}

/**
 * A fresh shape. Returns { name, tiles } with exactly SURPRISE.tiles positions.
 * Deterministic for a given rng, so a surprise board is reproducible from its seed.
 */
export function generateShape(rng = Math.random) {
  const { tiles: target, width, height, attempts } = SURPRISE;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const silhouette = SILHOUETTES[Math.floor(rng() * SILHOUETTES.length)];
    const params = silhouette.random(rng);
    const layers = buildStack(silhouette, params, width, height);
    const total = layers.reduce((sum, layer) => sum + countGrid(layer), 0);
    // Too small to make a full board — try another shape rather than padding this one
    // out into something that no longer looks like anything.
    if (total < target) continue;

    const trimmed = trimTo(layers, target);
    const tiles = [];
    trimmed.forEach((layer, index) => {
      layer.forEach((line, row) => {
        line.forEach((cell, col) => {
          if (cell) tiles.push({ x: col * 2, y: row * 2, layer: index });
        });
      });
    });
    if (tiles.length !== target) continue;
    return { name: silhouette.name, tiles };
  }

  return null;
}

/**
 * A board built to fit the screen it will be played on.
 *
 * Chris's point (2026-07-28): a board authored 12 wide by 4 deep wastes most of a portrait
 * screen, and turning it makes a 4 × 12 ribbon that wastes it the other way. Neither uses
 * the space, and tile size is set by how much space is used. So rather than turning a
 * fixed shape, the footprint is *chosen* from the screen's own proportions, then stacked
 * by the same erosion the surprise board uses — which is what guarantees every tile above
 * the base has one beneath it.
 *
 * Traditional silhouettes are given up here on purpose: he asked for all the screen, and a
 * turtle cannot be both a turtle and the shape of a tablet held upright.
 */
export function buildFittedBoard(count, viewportAspect, tileAspect = 1.32) {
  if (count % 2 !== 0) throw new Error(`a board needs an even tile count, got ${count}`);

  // Tiles are taller than they are wide, so a square-looking board needs more columns
  // than rows: this is the column:row ratio that makes the board's shape match the
  // screen's.
  const ratio = Math.max(0.25, viewportAspect * tileAspect);

  // Start from a footprint big enough to hold most of the tiles on the base, then grow it
  // until the whole stack can hold the full count.
  for (let base = Math.max(6, Math.round(count * 0.55)); base <= count * 2; base += 2) {
    const rows = Math.max(2, Math.round(Math.sqrt(base / ratio)));
    const cols = Math.max(2, Math.round(rows * ratio));

    const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 1));
    const layers = [grid];
    while (layers.length < SURPRISE.maxLayers) {
      const next = erode(layers[layers.length - 1]);
      if (countGrid(next) === 0) break;
      layers.push(next);
    }
    const total = layers.reduce((sum, layer) => sum + countGrid(layer), 0);
    if (total < count) continue;

    const trimmed = trimTo(layers, count);
    const tiles = [];
    trimmed.forEach((layer, index) => {
      layer.forEach((line, row) => {
        line.forEach((cell, col) => {
          if (cell) tiles.push({ x: col * 2, y: row * 2, layer: index });
        });
      });
    });
    if (tiles.length === count) return { cols, rows, tiles };
  }
  return null;
}

/**
 * Re-lays an authored silhouette onto a footprint that matches the screen.
 *
 * The turtle, dragon, cat, fortress, crab and spider are drawn 15–17 columns wide, which
 * is a landscape shape: upright they shrink to 6 mm tiles. Rather than abandoning the
 * silhouettes, the base mask is resampled into a grid whose proportions come from the
 * screen, then stacked by erosion and trimmed to the count. A cat re-laid onto a tall grid
 * is still recognisably a cat — it is simply a taller cat.
 */
export function fitShapeToScreen(baseMask, count, viewportAspect, tileAspect = 1.32) {
  const srcRows = baseMask.length;
  const srcCols = baseMask[0].length;
  const filled = baseMask.reduce((sum, line) => sum + [...line].filter((c) => c === '#').length, 0);
  const density = filled / (srcRows * srcCols);
  const ratio = Math.max(0.25, viewportAspect * tileAspect);

  // Grow the footprint until the silhouette, stacked, can hold the whole count.
  for (let cells = Math.max(12, Math.round(count / Math.max(0.35, density))); cells <= count * 6; cells += 4) {
    const rows = Math.max(3, Math.round(Math.sqrt(cells / ratio)));
    const cols = Math.max(3, Math.round(rows * ratio));

    // Nearest-neighbour resample of the authored silhouette into the new grid.
    const grid = [];
    for (let r = 0; r < rows; r++) {
      const sr = Math.min(srcRows - 1, Math.floor(((r + 0.5) / rows) * srcRows));
      const line = [];
      for (let c = 0; c < cols; c++) {
        const sc = Math.min(srcCols - 1, Math.floor(((c + 0.5) / cols) * srcCols));
        line.push(baseMask[sr][sc] === '#' ? 1 : 0);
      }
      grid.push(line);
    }

    const layers = [grid];
    while (layers.length < SURPRISE.maxLayers) {
      const next = erode(layers[layers.length - 1]);
      if (countGrid(next) === 0) break;
      layers.push(next);
    }
    const total = layers.reduce((sum, layer) => sum + countGrid(layer), 0);
    if (total < count) continue;

    const trimmed = trimTo(layers, count);
    const tiles = [];
    trimmed.forEach((layer, index) => {
      layer.forEach((line, row) => {
        line.forEach((cell, col) => {
          if (cell) tiles.push({ x: col * 2, y: row * 2, layer: index });
        });
      });
    });
    if (tiles.length === count) return { cols, rows, tiles };
  }
  return null;
}
