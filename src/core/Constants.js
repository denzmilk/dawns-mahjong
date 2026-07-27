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
  // How far a selected tile lifts toward the camera. A deliberate stopgap: without
  // *some* feedback a tap looks like nothing happened, which would make a review
  // build worthless. Milestone 04 owns the real treatment — lift plus a thick gold
  // outline, a slow pulse, and a glow, all at once (ADR-0002 constraint 3).
  selectionLift: 0.3,
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
  // 1024 rather than 2048: the shadow map is re-rendered with every board change and
  // 144 casters at 2048 was the single most expensive thing in the frame. At this
  // size the layer-separation shadows still read cleanly.
  shadowMapSize: 1024,
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

export const INPUT = {
  // A tap is a tap: anything with travel is a drag, anything held is a long press,
  // and neither should select a tile (ADR-0002 constraint 1).
  tapMaxMovePx: 14,
  tapMaxHoldMs: 900,
  // How far outside a tile a tap still counts, in CSS pixels. Only ever applied
  // when the tap hit no tile at all, and only when exactly one free tile is within
  // range — an ambiguous near-miss does nothing rather than guessing. This is what
  // makes the 144-tile turtle usable at 47 dp per tile on a 10–11" tablet.
  tapForgivenessPx: 16,
};

export const SELECTION = {
  // ADR-0002 constraint 3: the selected tile changes on four channels at once —
  // lift, a thick gold rim, a slow pulse, and a glow beneath. Redundant on
  // purpose: no single channel has to carry it for 90-year-old eyes on a glossy
  // screen in a lit room.
  rimScale: 1.18,
  // The rim box is deliberately SHORTER than the tile so its top sits just below the
  // tile's face: it reads as a thick gold ledge around the tile, instead of a gold
  // slab covering the artwork.
  rimHeightFactor: 0.92,
  glowScale: 2.2,
  glowOpacity: 0.5,
  pulsePeriod: 1.5,
  pulseAmount: 0.06,
  // Unplayable tiles are visibly knocked back so "what can I tap?" is answered by
  // the render itself (constraint 2). Not so dark that the artwork is lost.
  // 0.48, not 0.62: at 0.62 the difference measured only 19% on screen once lighting
  // was applied, which is not the "answered at a glance" the ADR asks for.
  blockedBrightness: 0.48,
  freeBrightness: 1,
  hintBrightness: 1.25,
};

export const ENTRANCE = {
  // Tiles fly in and stack themselves at the start of a board. Kept brief — she
  // should never be made to wait to play, and the 144-tile turtle has to finish
  // dealing in about a second too.
  duration: 0.45,
  stagger: 0.004,
  dropHeight: 9,
  spread: 3.5,
};

export const CELEBRATION = {
  // Eight of them, picked at random with no immediate repeat, because clearing a
  // pair is the whole reward loop and the same flourish 36 times is wallpaper.
  duration: 1.05,
  finaleDuration: 2.6,
  // Every Nth match gets the bigger treatment.
  escalateEvery: 6,
  liftHeight: 5.5,
  shardGrid: 3,
  spinTurns: 2.5,
};

export const PARTICLES = {
  // Pooled and capped: create/destroy churn per burst is what drops frames on a
  // mid-range tablet GPU.
  poolSize: 900,
  burst: 46,
  finaleBurst: 240,
  size: 0.3,
  gravity: -7.5,
  drag: 0.86,
  lifespan: 1.5,
};

export const AUDIO = {
  masterVolume: 0.55,
  // A pentatonic run, so the match chime rising as the board empties can never land
  // on a sour interval.
  chimeScale: [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51],
  // An original rockabilly turnaround for the board clear: [frequency, start, decay].
  // Deliberately not a transcription of any Elvis song — see docs/tech.md.
  lick: [
    [392, 0, 0.16],
    [493.88, 0.11, 0.16],
    [587.33, 0.22, 0.16],
    [659.25, 0.33, 0.22],
    [587.33, 0.5, 0.14],
    [493.88, 0.61, 0.14],
    [392, 0.72, 0.3],
    [783.99, 0.95, 0.5],
  ],
};

export const SAVE = {
  key: 'dawns-mahjong/v1',
  // Bump only for a breaking change to the shape. An unrecognised version is
  // discarded rather than migrated — one player, one device, and a mis-migrated board
  // would be worse than a fresh one.
  version: 1,
};

export const TIMING = {
  // How long a mismatched pair is held before it releases. Long enough to register
  // as "those two don't go together", short enough not to feel like a punishment.
  mismatchHold: 0.65,
  // How long a hint stays lit. Generous: she may need to look away and back.
  hintHold: 5,
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

// The eight Elvis photographs that replace the traditional flowers and seasons.
// Chosen for faces and strong silhouettes: at ~80 px on a tile, a busy full-length
// shot is a grey smudge. focusY biases the square crop up or down the photo so the
// crop lands on him rather than on a microphone stand.
export const ELVIS_TILE_PHOTOS = [
  { file: 'publicity-1956.jpg', focusY: 0.36 },
  { file: 'love-me-tender-1956.jpg', focusY: 0.32 },
  { file: 'young-elvis.jpg', focusY: 0.34 },
  { file: 'colour-1970.jpg', focusY: 0.3 },
  { file: 'jailhouse-rock.jpg', focusY: 0.28 },
  { file: 'publicity-still-1956.jpg', focusY: 0.3 },
  { file: 'harley-1956.jpg', focusY: 0.34 },
  { file: 'tv-debut-1956.jpg', focusY: 0.3 },
];

export const ATLAS = {
  columns: 7,
  // Cells follow the tile's own proportions (the sheet's faces are ~79 × 99), so a
  // face is never stretched onto the tile top.
  cellWidth: 128,
  cellHeight: 160,
  // Faces are drawn inset by this much, on a bed of tile cream, so neighbouring
  // cells can't bleed into each other once the texture is mipmapped and viewed at
  // an angle.
  padding: 5,
  // One extra cell of flat ivory that every tile's sides and back point at, so
  // all 144 tiles can share a single material and a single texture.
  sideCellIndex: FACES.length,
};
