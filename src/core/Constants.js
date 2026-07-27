// Every tuned value in the game lives in this file (house rule 6). "It feels
// wrong" bugs trace back to a drifted constant, and they are only findable if
// there is exactly one place to look.

export const LAYOUT_DEFAULT = 'easy-72';

// Real mahjong tiles are taller than they are wide (~26 × 34 mm). Keeping that
// ratio is most of what makes a board read as a physical set rather than a grid
// of squares.
export const TILE = {
  width: 1.0,
  depth: 1.32,
  // Thick enough that the lift between layers is unmistakable from a near
  // top-down camera. At 0.4 the five turtle layers read as a flat mosaic.
  thickness: 0.52,
  // Each mesh is shrunk inside its lattice cell so neighbouring tiles show a
  // seam. Without it, a row of touching tiles reads as one solid slab.
  gap: 0.055,
};

// Layout coordinates are in HALF-tile steps: a tile at (x, y) occupies
// [x, x+2) × [y, y+2). That is what lets an upper-layer tile straddle four
// tiles below it, and the free-tile rule in milestone 02 is written against it.
export const LATTICE = {
  stepX: TILE.width / 2,
  stepZ: TILE.depth / 2,
};

export const CAMERA = {
  // Degrees off vertical. Shallow enough that every face stays readable,
  // steep enough that stacked layers separate and the milestone 05
  // celebrations have somewhere to fly. Fixed forever — ADR-0002.
  tiltDegrees: 20,
  // A long lens. A wide one makes near tiles much larger than far ones, and on
  // the 144-tile turtle the far row shrank to 52 px — under the 64 px touch
  // floor — while near tiles had room to spare. Narrow keeps tiles near-uniform,
  // which matters more here than a dramatic sense of perspective.
  fov: 22,
  // Extra breathing room around the board once it has been fitted. Kept tight:
  // every percent of margin comes straight off tile size, and tiles have a hard
  // 64 px floor to clear (ADR-0002 constraint 4) — at 1.1 the far row of
  // easy-72 measured 63.5 px at 1280×800.
  margin: 1.01,
  near: 0.1,
  far: 200,
};

export const TABLE = {
  // Felt visible around the outermost tiles, in world units. Kept small: the fit
  // is vertical-space-limited on the 144-tile turtle, so padding here comes
  // straight off tile width, which has a hard 64 px floor to clear.
  padding: 0.45,
  borderWidth: 0.55,
  y: -0.02,
};

export const COLORS = {
  background: 0x0a1a11,
  felt: 0x12301f,
  feltRim: 0x0d2417,
  gold: 0xe8c547,
  ivory: 0xf7f2e4,
  tileSide: 0xe4d9be,
  tileEdgeShadow: 0x9c8f6f,
  cream: 0xfaf6ea,
  elvisRed: 0xc1272d,
};

export const LIGHTING = {
  ambient: 0xf3ead8,
  // Three's lighting is physical since r155, so these read higher than the old
  // legacy-lights numbers would. Tuned so ivory faces sit bright and clean
  // without blowing out — tile art has to stay readable, which is the whole game.
  // Ambient deliberately low against a strong key: the shadow each tile casts on
  // the layer below is the main cue that tells a stacked board apart from a flat
  // mosaic, and lifting ambient washes it out.
  ambientIntensity: 0.66,
  key: 0xfff6e2,
  keyIntensity: 2.5,
  // Offset from the BOARD CENTRE, not absolute world space: the turtle's centre
  // sits a long way from easy-72's, and a fixed light left half its upper tiles
  // casting no visible shadow at all. Shadows are the depth cue that makes a
  // stacked board readable, so they have to behave the same on every layout.
  keyOffset: { x: -5, y: 13, z: 4.5 },
  // A dim, non-shadowing fill from the opposite side stops the shadowed sides of
  // tiles going flat black without washing the shadows out.
  fill: 0xdfe8ff,
  fillIntensity: 0.5,
  fillOffset: { x: 7, y: 6, z: -6 },
};

export const RENDER = {
  // Retina tablets would otherwise render 3× the pixels for no visible gain.
  maxPixelRatio: 2,
  shadowMapSize: 2048,
  antialias: true,
};

export const TIME = {
  // Manual stepping granularity for advanceTime() — deterministic tests.
  fixedStep: 1 / 60,
  maxFrameDelta: 0.1,
};

export const ASSISTS = {
  hints: 10,
  shuffles: 3,
};

// The 42 faces on Chris's tile sheet. Order matters: it is the atlas cell order
// and the placeholder labels are derived from it. The 8 Elvis faces replace the
// traditional flowers and seasons and all match each other (see gameplan).
const suit = (prefix, count) => Array.from({ length: count }, (_, i) => `${prefix}-${i + 1}`);

export const FACES = [
  ...suit('dot', 9),
  ...suit('bamboo', 9),
  ...suit('character', 9),
  'wind-east',
  'wind-south',
  'wind-west',
  'wind-north',
  'dragon-red',
  'dragon-green',
  'dragon-white',
  ...suit('elvis', 8),
];

export const ELVIS_FACES = FACES.filter((f) => f.startsWith('elvis-'));

// Short labels for the milestone 01 placeholder faces. Deliberately ugly — big
// black text on white, so nobody mistakes placeholder output for the real art.
export const FACE_LABELS = {
  dot: 'O',
  bamboo: 'B',
  character: 'C',
  wind: 'W',
  dragon: 'D',
  elvis: 'E',
};

export const ATLAS = {
  columns: 7,
  cellSize: 128,
  // One extra cell of flat ivory that every tile's sides and back point at, so
  // all 144 tiles can share a single material and a single texture.
  sideCellIndex: FACES.length,
};
