import { BOARD, CAMERA, SURPRISE, TILE } from '../core/Constants.js';

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
 * Builds a board as a stepped mound, on the footprint that makes its tiles biggest.
 *
 * Two things drive this, both from Chris (2026-07-28). First: tile size comes from the
 * FOOTPRINT, not the tile count — 144 tiles laid flat across a portrait screen measure
 * 58 dp, and the same 144 gathered into a mound measure far more. Second: the 144-tile
 * boards should feel close to the 48-tile one, which means shrinking their footprint until
 * they do.
 *
 * So the footprint is searched rather than assumed. Every candidate is built and scored by
 * how big its tiles would come out (`tileScale`), and the best one wins. Smaller is *not*
 * always better: a tall stack leans toward the camera and eats screen height, so past a
 * point the tower costs more than the narrower footprint saved. The search finds that point
 * instead of guessing at it.
 *
 * The stack itself steps inward — the silhouette repeated a few layers, then eroded, then
 * repeated again — for two reasons. Support is automatic, because each level fits inside
 * the one below. And every step leaves a ledge of exposed tiles, which is what keeps a deep
 * board playable: a straight-sided tower only ever offers the two ends of its top row,
 * however many tiles are underneath.
 */
export function buildSteppedBoard(count, viewportAspect, {
  silhouette = null,
  tileAspect = TILE.depth / TILE.width,
  maxLayers = BOARD.maxLayers,
  minPlayable = BOARD.minPlayable,
} = {}) {
  if (count % 2 !== 0) throw new Error(`a board needs an even tile count, got ${count}`);

  // Rows and columns are searched independently rather than pinned to the screen's own
  // proportions. That was the mistake in the version before this one: a footprint shaped
  // like the screen leaves no room for the stack, and the stack reaches UP the screen. The
  // best footprint is always wider and shallower than the screen, by exactly the height
  // the mound is going to claim — and the only way to know that is to try both.
  let best = null;

  for (let rows = 2; rows <= MAX_ROWS; rows++) {
    for (let cols = 2; cols <= MAX_COLS; cols++) {
      // A footprint with far more cells than the board has tiles is only worth building
      // for a sparse silhouette, where most of those cells hold nothing.
      if (rows * cols > count * (silhouette ? 2 : 1)) break;

      const grid = silhouette ? resampleSilhouette(silhouette, rows, cols) : solidFootprint(rows, cols);
      const built = stackInward(grid, count, maxLayers);
      if (!built) continue;
      // However big the tiles, a board she can't get started on is not a board.
      if (countPlayable(built.tiles) < minPlayable) continue;

      const scale = tileScale(built, viewportAspect, tileAspect);
      if (!best || scale > best.scale) best = { ...built, scale };
    }
  }
  return best;
}

// Bounds on the search. Wide enough to cover the widest authored silhouette laid flat,
// small enough that the whole search is a few hundred cheap builds — it runs once, when a
// board is dealt.
const MAX_ROWS = 14;
const MAX_COLS = 18;

/**
 * How big one tile would come out, as a fraction of screen height, if this board were
 * fitted to a screen of the given aspect. Deliberately approximate — it ignores
 * perspective, and the real framing is measured from the tiles themselves in
 * CameraSystem — but it ranks candidates correctly, which is all it is for.
 *
 * The height term is the part that is easy to forget: at the fixed tilt a stack does not
 * only rise, it also reaches up the screen, so layers cost vertical space just as rows do.
 */
function tileScale({ cols, rows, layers }, viewportAspect, tileAspect) {
  const tilt = (CAMERA.tiltDegrees * Math.PI) / 180;
  const across = cols;
  const down =
    rows * tileAspect * Math.cos(tilt) + layers * (TILE.thickness / TILE.width) * Math.sin(tilt);
  // Screen height is 1 and screen width is its aspect, so both terms are in tile widths.
  return Math.min(viewportAspect / across, BOARD.usableHeight / down);
}

/**
 * Stacks a footprint into a mound of exactly `count` tiles, stepping inward as it rises.
 * Returns null if it cannot be done inside `maxLayers`.
 */
function stackInward(grid, count, maxLayers) {
  // Each level is an erosion of the one below — a cell survives only if it and all four
  // of its neighbours did — so a level always fits inside the level under it.
  const ladder = [grid];
  for (;;) {
    const next = erode(ladder[ladder.length - 1]);
    if (countGrid(next) === 0) break;
    ladder.push(next);
  }

  if (ladder.length > maxLayers) return null;

  // One layer per level is the classic single-erosion pyramid, and it is what puts a ledge
  // of tappable tiles at every step. It rarely holds a whole board, so the remainder goes
  // on the BASE: the widest level holds the most tiles per layer, which is the same as
  // saying it is the cheapest place to buy capacity in screen height.
  const sizes = ladder.map(countGrid);
  const heights = sizes.map(() => 1);
  let capacity = sizes.reduce((sum, size) => sum + size, 0);
  while (capacity < count) {
    if (heights.reduce((sum, h) => sum + h, 0) >= maxLayers) return null;
    heights[0] += 1;
    capacity += sizes[0];
  }

  const layers = [];
  ladder.forEach((level, index) => {
    for (let i = 0; i < heights[index]; i++) layers.push(level.map((line) => [...line]));
  });

  const trimmed = trimTo(layers, count);
  if (trimmed.length > maxLayers) return null;

  const tiles = [];
  trimmed.forEach((layer, index) => {
    layer.forEach((line, row) => {
      line.forEach((cell, col) => {
        if (cell) tiles.push({ x: col * 2, y: row * 2, layer: index });
      });
    });
  });
  if (tiles.length !== count) return null;

  // A silhouette can leave empty rows or columns around its edge; shift them off so the
  // board's own extents are what the camera ends up framing.
  const minX = Math.min(...tiles.map((t) => t.x));
  const minY = Math.min(...tiles.map((t) => t.y));
  for (const t of tiles) {
    t.x -= minX;
    t.y -= minY;
  }
  return {
    cols: Math.max(...tiles.map((t) => t.x)) / 2 + 1,
    rows: Math.max(...tiles.map((t) => t.y)) / 2 + 1,
    layers: trimmed.length,
    tiles,
  };
}

const solidFootprint = (rows, cols) =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => 1));

/**
 * Nearest-neighbour resample of an authored silhouette onto a different grid.
 *
 * The turtle, dragon, cat, fortress, crab and spider are drawn 15–17 columns wide, which
 * is a landscape shape — upright they shrink to 6 mm tiles. Rather than abandoning the
 * silhouettes, each is re-laid onto whatever footprint measures best. A cat squeezed onto
 * a 6 × 7 grid is still recognisably a cat; it is simply a stockier cat.
 */
function resampleSilhouette(mask, rows, cols) {
  const srcRows = mask.length;
  const srcCols = mask[0].length;
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const sr = Math.min(srcRows - 1, Math.floor(((r + 0.5) / rows) * srcRows));
    const line = [];
    for (let c = 0; c < cols; c++) {
      const sc = Math.min(srcCols - 1, Math.floor(((c + 0.5) / cols) * srcCols));
      line.push(mask[sr][sc] === '#' ? 1 : 0);
    }
    grid.push(line);
  }
  return grid;
}

/** Tiles with nothing on top and a clear left or right edge — what she can tap right now. */
export function countPlayable(tiles) {
  const key = (x, y, layer) => `${x},${y},${layer}`;
  const at = new Set(tiles.map((t) => key(t.x, t.y, t.layer)));
  let playable = 0;
  for (const t of tiles) {
    if (at.has(key(t.x, t.y, t.layer + 1))) continue;
    const left = at.has(key(t.x - 2, t.y, t.layer));
    const right = at.has(key(t.x + 2, t.y, t.layer));
    if (!left || !right) playable++;
  }
  return playable;
}
