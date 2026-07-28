import { SURPRISE } from '../core/Constants.js';
import { buildSteppedBoard, generateShape } from './ShapeGenerator.js';

// Board shapes as pure data. No Three.js, no DOM — these are imported directly
// by tests.
//
// Coordinates are HALF-tile steps: a tile at (x, y) occupies [x, x+2) × [y, y+2)
// on its layer. Upper layers can therefore sit at odd coordinates and straddle
// four tiles below, which is what gives the turtle its shape.

const row = (y, fromX, toX, layer = 0) => {
  const tiles = [];
  for (let x = fromX; x <= toX; x += 2) tiles.push({ x, y, layer });
  return tiles;
};

const block = (fromX, fromY, cols, rows, layer, stepY = 2) => {
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) tiles.push({ x: fromX + c * 2, y: fromY + r * stepY, layer });
  }
  return tiles;
};

// ---------------------------------------------------------------------------
// easy-72 — the default board.
//
// Wide and shallow to suit a landscape tablet: 12 columns keeps tiles well over
// the 64 px minimum touch target (ADR-0002) at 1280×800, and only two layers
// means far fewer tiles are ever blocked, so she is rarely stuck. The upper
// block sits on odd rows so it straddles the base and the stack reads as 3D.
// ---------------------------------------------------------------------------
const easy72 = [
  ...block(0, 0, 12, 4, 0), // 48
  ...block(4, 1, 8, 3, 1), // 24
];

// ---------------------------------------------------------------------------
// turtle-144 — the classic Shanghai turtle.
//
// 87 + 36 + 16 + 4 + 1. The base is deliberately NOT left-right symmetric: one
// tile juts out left and two out right (the turtle's head and tail). That
// asymmetry is traditional and is what makes the shape recognisable.
// ---------------------------------------------------------------------------
const turtleBase = [
  ...row(0, 0, 22),
  ...row(2, 4, 18),
  ...row(4, 2, 20),
  ...row(6, 0, 22),
  ...row(8, 0, 22),
  ...row(10, 2, 20),
  ...row(12, 4, 18),
  ...row(14, 0, 22),
  // Head (left) and tail (right), at the vertical middle on the half-lattice.
  { x: -2, y: 7, layer: 0 },
  { x: 24, y: 7, layer: 0 },
  { x: 26, y: 7, layer: 0 },
];

const turtle144 = [
  ...turtleBase, // 87
  ...block(6, 2, 6, 6, 1), // 36
  ...block(8, 4, 4, 4, 2), // 16
  ...block(10, 6, 2, 2, 3), // 4
  { x: 11, y: 7, layer: 4 }, // 1 — centred on the 2×2 below
];

const withIds = (tiles) => tiles.map((t, i) => ({ ...t, id: i }));

/** The outline of a board's base layer, as a mask — so any layout can be re-laid. */
function baseMaskFrom(tiles) {
  const base = tiles.filter((t) => t.layer === 0);
  const minX = Math.min(...base.map((t) => t.x));
  const minY = Math.min(...base.map((t) => t.y));
  const cols = (Math.max(...base.map((t) => t.x)) - minX) / 2 + 1;
  const rows = (Math.max(...base.map((t) => t.y)) - minY) / 2 + 1;
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => '.'));
  for (const t of base) {
    const row = Math.round((t.y - minY) / 2);
    const col = Math.round((t.x - minX) / 2);
    if (grid[row]) grid[row][col] = '#';
  }
  return grid.map((line) => line.join(''));
}

export const LAYOUTS = {
  'easy-72': {
    id: 'easy-72',
    name: 'Easy',
    tiles: withIds(easy72),
  },
  'turtle-144': {
    id: 'turtle-144',
    name: 'Classic Turtle',
    tiles: withIds(turtle144),
  },
};

/**
 * Every board she can choose, in menu order. The surprise board is appended in
 * Layouts' tail (below) so it always comes last.
 */
export const LAYOUT_IDS = [];

/** Lattice-space extents of a layout, in half-tile units. */
export function layoutBounds(layout) {
  const xs = layout.tiles.map((t) => t.x);
  const ys = layout.tiles.map((t) => t.y);
  const layers = layout.tiles.map((t) => t.layer);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs) + 2,
    minY: Math.min(...ys),
    maxY: Math.max(...ys) + 2,
    maxLayer: Math.max(...layers),
  };
}

/**
 * Turns a board on its side. Dawn plays in PORTRAIT (2026-07-27), and every board here is
 * wide — a 12-column board fitted to a 600 dp-wide screen gives 45 dp tiles. Swapping the
 * lattice axes makes a wide board a tall one, which on her screen is the difference
 * between 45 dp and ~85 dp per tile.
 *
 * Only the coordinates swap: tile artwork stays upright, and the free-tile rule still
 * reads along the board's x axis — so a turned board plays a little differently (you work
 * in from the short sides), but it is still a legal board and still guaranteed solvable,
 * because faces are dealt by playing it.
 */
/** Swaps the lattice axes: a wide board becomes a tall one. Artwork stays upright. */
export function transposeTiles(tiles) {
  return tiles.map((t) => ({ ...t, x: t.y, y: t.x }));
}

export function bestOrientation(tiles, viewportAspect, tileAspect) {
  // Turn the board only if doing so brings its shape CLOSER to the screen's shape — the
  // board is fitted to the screen, so the closer the two aspects, the less space is
  // wasted and the bigger the tiles. Compared in log space so "twice as wide" and "half
  // as wide" count as equally wrong.
  //
  // An earlier hand-rolled score got this backwards and turned boards in landscape too,
  // halving tile size there while looking fine in portrait.
  const span = (axis) => Math.max(...tiles.map((t) => t[axis])) + 2 - Math.min(...tiles.map((t) => t[axis]));
  const cols = span('x') / 2;
  const rows = span('y') / 2;

  const mismatch = (wide, deep) => Math.abs(Math.log(wide / (deep * tileAspect) / viewportAspect));
  return mismatch(rows, cols) < mismatch(cols, rows) ? 'turned' : 'as-authored';
}

export function getLayout(id, { rng = Math.random, portrait = false, viewportAspect = null, tileAspect = 1.32 } = {}) {
  const shouldTurn = (tiles) => {
    if (viewportAspect === null) return portrait;
    return bestOrientation(tiles, viewportAspect, tileAspect) === 'turned';
  };

  // The surprise board has no fixed shape: it is generated per game, which is the
  // whole point of it. Only its silhouette is generated, though — the mound is then
  // built by the same code as every other board, so a surprise board is sized for her
  // screen exactly like a named one. It used to skip that and came out smallest of all
  // at 49 dp.
  const surprise = id === SURPRISE.id ? generateShape(rng) : null;
  if (id === SURPRISE.id && !surprise) return null;

  const layout = surprise
    ? { id: SURPRISE.id, name: `Surprise (${surprise.name})`, shape: surprise.name, tiles: surprise.tiles }
    : LAYOUTS[id];
  if (!layout) return null;

  // Every board gets the same treatment: its silhouette re-laid onto the footprint that
  // makes its tiles biggest, then stacked into a mound. The mask is derived from the base
  // layer when the board wasn't authored from one — the turtle predates the mask format
  // and was silently missing out, which is why it stayed at 43 dp while the cat reached 80.
  if (viewportAspect !== null) {
    const fitted = buildSteppedBoard(layout.tiles.length, viewportAspect, {
      silhouette: layout.masks ? layout.masks[0] : baseMaskFrom(layout.tiles),
      tileAspect,
    });
    if (fitted) {
      return {
        ...layout,
        tiles: withIds(fitted.tiles),
        fitted: `${fitted.cols}×${fitted.rows}×${fitted.layers}`,
      };
    }
  }

  if (!shouldTurn(layout.tiles)) return { ...layout, tiles: withIds(layout.tiles) };
  return { ...layout, tiles: withIds(transposeTiles(layout.tiles)) };
}

// ---------------------------------------------------------------------------
// The familiar six.
//
// Chris asked for the shapes Dawn is most likely to already know — the set from
// Windows' Mahjong Titans (turtle, dragon, cat, fortress, crab, spider). These are
// authored in that spirit and at the traditional 144 tiles each; they are not
// pixel-exact copies of Microsoft's geometry.
//
// Each shape is drawn as ASCII masks, one per layer, because a layout is a picture
// and picking it out of a list of coordinates is impossible. '#' is a tile.
// Layers here are ALIGNED (no half-tile straddle, unlike the turtle), which makes
// support trivially checkable: every '#' on a layer must have a '#' directly beneath
// it. `npm run check:layouts` proves it, along with the 144-tile count.
// ---------------------------------------------------------------------------

function fromMasks(masks) {
  const tiles = [];
  masks.forEach((mask, layer) => {
    mask.forEach((line, row) => {
      [...line].forEach((cell, col) => {
        if (cell === '#') tiles.push({ x: col * 2, y: row * 2, layer });
      });
    });
  });
  return tiles;
}

const DRAGON = [
  [
    '....########....',
    '..############..',
    '################',
    '################',
    '################',
    '..############..',
    '....########....',
  ],
  [
    '................',
    '................',
    '...##########...',
    '.##############.',
    '...##########...',
    '................',
    '................',
  ],
  [
    '................',
    '................',
    '................',
    '.##############.',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '................',
    '................',
    '......######....',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '................',
    '................',
    '........##......',
    '................',
    '................',
    '................',
  ],
];

const CAT = [
  [
    '..##........##....',
    '.####......####...',
    '.##############...',
    '.##############.##',
    '.##############.##',
    '..############....',
    '...##########.....',
  ],
  [
    '..................',
    '..................',
    '...##########.....',
    '..############....',
    '..############....',
    '...##########.....',
    '..................',
  ],
  [
    '..................',
    '..................',
    '..................',
    '....########......',
    '....########......',
    '..................',
    '..................',
  ],
  [
    '..................',
    '..................',
    '..................',
    '..................',
    '......####........',
    '..................',
    '..................',
  ],
];

const FORTRESS = [
  [
    '##...######...##',
    '##...######...##',
    '################',
    '################',
    '################',
    '##...######...##',
    '##...######...##',
  ],
  [
    '................',
    '................',
    '..############..',
    '..############..',
    '..############..',
    '................',
    '................',
  ],
  [
    '................',
    '................',
    '................',
    '....########....',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '................',
    '................',
    '....########....',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '................',
    '................',
    '......####......',
    '................',
    '................',
    '................',
  ],
];

const CRAB = [
  [
    '##..########..##',
    '##..########..##',
    '.##############.',
    '..############..',
    '.##############.',
    '##..########..##',
    '##..########..##',
  ],
  [
    '................',
    '................',
    '...##########...',
    '..############..',
    '...##########...',
    '................',
    '................',
  ],
  [
    '................',
    '................',
    '...##########...',
    '..############..',
    '.......##.......',
    '................',
    '................',
  ],
];

const SPIDER = [
  [
    '##...........##',
    '.##.#######.##.',
    '..###########..',
    '.#############.',
    '.#############.',
    '..###########..',
    '.##.#######.##.',
    '##...........##',
  ],
  [
    '...............',
    '....######.....',
    '...########....',
    '..##########...',
    '..##########...',
    '...########....',
    '....######.....',
    '...............',
  ],
  [
    '...............',
    '...............',
    '...............',
    '...########....',
    '..##########...',
    '...............',
    '...............',
    '...............',
  ],
];

// ---------------------------------------------------------------------------
// The small boards.
//
// Dawn played it and said the tiles were too small (2026-07-27), so boards were added
// below the classic sizes. Chris then played them and cut everything under 48 tiles
// (2026-07-28): a 24- or 36-tile board is over in a couple of minutes, and she wants a
// game, not a warm-up. Tile size now comes from the mound the builder chooses rather than
// from the tile count, so a 48-tile board is no longer the price of big tiles.
//
// 48 is the floor and the default.
// ---------------------------------------------------------------------------

const STEPS = [
  [
    '##########',
    '##########',
    '##########',
  ],
  [
    '..........',
    '.########.',
    '..........',
  ],
  [
    '..........',
    '..######..',
    '..........',
  ],
  [
    '..........',
    '...####...',
    '..........',
  ],
];

// Sized for Dawn's actual tablet. A Tab A11+ presents about 960 dp across, and 12
// columns is the widest board that still clears the 64 dp touch floor there — the
// 144-tile boards are 16 columns and land at 44 dp, which is below Android's own
// minimum. Twice the game of the easy board, still comfortable to tap.
const PAGODA = [
  [
    '############',
    '############',
    '############',
    '############',
  ],
  [
    '............',
    '############',
    '############',
    '............',
  ],
  [
    '............',
    '.##########.',
    '.##########.',
    '............',
  ],
  [
    '............',
    '............',
    '....####....',
    '............',
  ],
];

// Menu order: smallest board (biggest tiles) first, because that is what she asked for.
export const SHAPE_LAYOUTS = {
  'steps-48': { name: 'Steps', masks: STEPS },
  'pagoda-96': { name: 'Pagoda', masks: PAGODA },
  'dragon-144': { name: 'Dragon', masks: DRAGON },
  'cat-144': { name: 'Cat', masks: CAT },
  'fortress-144': { name: 'Fortress', masks: FORTRESS },
  'crab-144': { name: 'Crab', masks: CRAB },
  'spider-144': { name: 'Spider', masks: SPIDER },
};

for (const [id, shape] of Object.entries(SHAPE_LAYOUTS)) {
  LAYOUTS[id] = { id, name: shape.name, tiles: withIds(fromMasks(shape.masks)), masks: shape.masks };
}

LAYOUT_IDS.push(...Object.keys(LAYOUTS), SURPRISE.id);

/** Boards with a fixed shape — the ones the layout tests can assert against. */
export const FIXED_LAYOUT_IDS = Object.keys(LAYOUTS);
