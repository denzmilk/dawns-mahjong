import { SURPRISE } from '../core/Constants.js';
import { generateShape } from './ShapeGenerator.js';

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

export function getLayout(id, { rng = Math.random } = {}) {
  // The surprise board has no fixed shape: it is generated per game, which is the
  // whole point of it.
  if (id === SURPRISE.id) {
    const shape = generateShape(rng);
    if (!shape) return null;
    return {
      id: SURPRISE.id,
      name: `Surprise (${shape.name})`,
      shape: shape.name,
      tiles: withIds(shape.tiles),
    };
  }
  return LAYOUTS[id] || null;
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

export const SHAPE_LAYOUTS = {
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
