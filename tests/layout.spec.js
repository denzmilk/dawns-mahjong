import { test, expect } from '@playwright/test';
import { FIXED_LAYOUT_IDS, LAYOUTS, layoutBounds } from '../src/board/Layouts.js';
import { generateShape } from '../src/board/ShapeGenerator.js';
import { SURPRISE } from '../src/core/Constants.js';
import { seededRng } from './helpers.mjs';
import { gotoGame, snapshot } from './helpers.mjs';

// Layouts are pure data on a half-tile lattice: a tile at (x, y) occupies
// [x, x+2) × [y, y+2) on its layer, so an upper tile can straddle four below it.
// Everything about the free-tile rule in milestone 02 depends on this holding.

const occupies = (t) => ({ x0: t.x, x1: t.x + 2, y0: t.y, y1: t.y + 2 });
const rectsOverlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

test.describe('layout data', () => {
  // Board sizes are chosen for what her tablet can show at a tappable size, not for
  // tradition alone — see the note on dp in 'layout on screen' below.
  const EXPECTED_SIZES = {
    // 48 is the floor: Chris cut the 24- and 36-tile boards on 2026-07-28 because they
    // were over before she had settled into them.
    'steps-48': 48,
    'easy-72': 72,
    'pagoda-96': 96,
    'turtle-144': 144,
    'dragon-144': 144,
    'cat-144': 144,
    'fortress-144': 144,
    'crab-144': 144,
    'spider-144': 144,
  };

  test('layout tile counts', () => {
    for (const [id, size] of Object.entries(EXPECTED_SIZES)) {
      expect(LAYOUTS[id]?.tiles, `${id}`).toHaveLength(size);
    }
    // Every fixed board is accounted for, so a new one can't slip in untested.
    expect(FIXED_LAYOUT_IDS.sort()).toEqual(Object.keys(EXPECTED_SIZES).sort());
  });

  test('the surprise board always produces a playable shape', () => {
    const shapes = new Set();
    for (let seed = 1; seed <= 60; seed++) {
      const shape = generateShape(seededRng(seed));
      expect(shape, `seed ${seed} produced no shape`).not.toBeNull();
      shapes.add(shape.name);
      expect(shape.tiles, `seed ${seed}`).toHaveLength(SURPRISE.tiles);

      // Every tile above the base must rest on one below it, or the board contains a
      // tile that can never be freed.
      const cells = new Set(shape.tiles.map((t) => `${t.x},${t.y},${t.layer}`));
      expect(cells.size, `seed ${seed} has duplicate cells`).toBe(shape.tiles.length);
      for (const t of shape.tiles) {
        if (t.layer === 0) continue;
        expect(cells.has(`${t.x},${t.y},${t.layer - 1}`), `seed ${seed}: floating tile`).toBe(true);
      }

      // And it has to fit the board it is drawn on.
      expect(Math.max(...shape.tiles.map((t) => t.x)) / 2 + 1).toBeLessThanOrEqual(SURPRISE.width);
      expect(Math.max(...shape.tiles.map((t) => t.y)) / 2 + 1).toBeLessThanOrEqual(SURPRISE.height);
    }
    // Infinite replayability is the point, so it must not keep dealing one shape.
    expect(shapes.size).toBeGreaterThan(3);
  });

  test('layouts are structurally valid', () => {
    for (const [name, layout] of Object.entries(LAYOUTS)) {
      const byLayer = new Map();
      for (const t of layout.tiles) {
        if (!byLayer.has(t.layer)) byLayer.set(t.layer, []);
        byLayer.get(t.layer).push(t);
      }

      // No two tiles may overlap on the same layer.
      for (const [layer, tiles] of byLayer) {
        for (let i = 0; i < tiles.length; i++) {
          for (let j = i + 1; j < tiles.length; j++) {
            expect(
              rectsOverlap(occupies(tiles[i]), occupies(tiles[j])),
              `${name} layer ${layer}: ${JSON.stringify(tiles[i])} overlaps ${JSON.stringify(tiles[j])}`
            ).toBe(false);
          }
        }
      }

      // Layers are contiguous from 0 up — a floating layer would mean a tile
      // resting on nothing.
      const layers = [...byLayer.keys()].sort((a, b) => a - b);
      expect(layers[0], `${name} must have a base layer`).toBe(0);
      layers.forEach((l, i) => expect(l, `${name} layer numbering`).toBe(i));

      // Every tile above the base rests on at least one tile below it.
      for (const t of layout.tiles) {
        if (t.layer === 0) continue;
        const supports = (byLayer.get(t.layer - 1) || []).filter((below) =>
          rectsOverlap(occupies(t), occupies(below))
        );
        expect(
          supports.length,
          `${name}: tile ${JSON.stringify(t)} floats with nothing beneath it`
        ).toBeGreaterThan(0);
      }
    }
  });

  test('easy-72 is symmetric about the vertical centre line', () => {
    const layout = LAYOUTS['easy-72'];
    const { minX, maxX } = layoutBounds(layout);
    const key = (t) => `${t.x}|${t.y}|${t.layer}`;
    const present = new Set(layout.tiles.map(key));
    for (const t of layout.tiles) {
      // Mirror the occupied span, not the origin: a tile spans x..x+2.
      const mirrored = { x: minX + maxX - t.x - 2, y: t.y, layer: t.layer };
      expect(present.has(key(mirrored)), `no mirror for ${JSON.stringify(t)}`).toBe(true);
    }
  });

  test('turtle-144 matches the traditional layer distribution', () => {
    // The classic turtle is deliberately NOT left-right symmetric: it has one
    // tile out to the left and two out to the right (the head and tail). Layer
    // counts are the thing that makes it recognisably a turtle.
    const counts = {};
    for (const t of LAYOUTS['turtle-144'].tiles) counts[t.layer] = (counts[t.layer] || 0) + 1;
    expect(counts).toEqual({ 0: 87, 1: 36, 2: 16, 3: 4, 4: 1 });
  });

  test('every layout holds an even number of tiles', () => {
    // An odd count could never be cleared in pairs.
    for (const [name, layout] of Object.entries(LAYOUTS)) {
      expect(layout.tiles.length % 2, `${name} must be even`).toBe(0);
    }
  });
});

test.describe('layout on screen', () => {
  // Android reports CSS pixels as density-independent pixels, so these viewports
  // are what real tablets actually present: a 10.9" Tab A9+ is 1920×1200 physical
  // but only ~1024×640 dp in landscape. Physical resolution is not the constraint;
  // dp is, because a finger is a fixed size.
  // Dawn's tablet is a Galaxy Tab A11+, and she plays it UPRIGHT (2026-07-27). An ~11"
  // 1920×1200 panel presents roughly 960 × 600 dp at Android's default display size, so
  // held in portrait that is 600 × 960 — and portrait is what has to be right first.
  const HER_TABLET = { width: 600, height: 960, label: 'Tab A11+ held upright' };
  const HER_TABLET_LANDSCAPE = { width: 960, height: 600, label: 'Tab A11+ on its side' };
  const TABLET_VIEWPORTS = [
    HER_TABLET,
    HER_TABLET_LANDSCAPE,
    { width: 686, height: 1097, label: 'smaller display size, upright' },
    { width: 1280, height: 800, label: 'test default' },
  ];

  const smallestTile = (state) =>
    state.tiles.reduce((min, t) => Math.min(min, t.screen.w, t.screen.h), Infinity);

  const clippedTiles = (state, viewport) =>
    state.tiles.filter(
      (t) =>
        t.screen.x < 0 ||
        t.screen.y < 0 ||
        t.screen.x + t.screen.w > viewport.width ||
        t.screen.y + t.screen.h > viewport.height
    );

  test('the default board gives her big tiles the way she holds the tablet', async ({ page }) => {
    // Dawn said the tiles were too small, so the default has to be the roomiest board she
    // can pick — measured upright, because that is how she plays. 48 tiles is the smallest
    // board there is since Chris cut the two below it (2026-07-28).
    await gotoGame(page, { viewport: HER_TABLET });
    const state = await snapshot(page);
    expect(state.layout).toBe('steps-48');
    expect(smallestTile(state)).toBeGreaterThanOrEqual(85);
  });

  // These sweeps deal a board per viewport per layout. Headless Chromium is on software
  // GL, where dealing 144 tiles takes seconds, so the default per-test timeout is harness
  // cost rather than anything about the game.
  const SWEEP_TIMEOUT = 240_000;

  test('every board clears the 64dp touch minimum, however she holds it', async ({ page }) => {
    test.setTimeout(SWEEP_TIMEOUT);
    // ADR-0002 constraint 4: tile size derives from the touch-target minimum, never the
    // other way round. This used to be a promise the two smallest boards made and the
    // 144-tile ones broke by 20 dp. Boards are now built into a mound on the footprint
    // that measures biggest (2026-07-28), which is what let the promise cover all of them.
    for (const id of FIXED_LAYOUT_IDS) {
      for (const viewport of [HER_TABLET, HER_TABLET_LANDSCAPE]) {
        await gotoGame(page, { layout: id, seed: 7, viewport });
        const state = await snapshot(page);
        expect(state.counts.total, `${id} tile count`).toBe(LAYOUTS[id].tiles.length);
        expect(smallestTile(state), `${id} at ${viewport.label}`).toBeGreaterThanOrEqual(64);
        expect(clippedTiles(state, viewport), `${id} clipped at ${viewport.label}`).toHaveLength(0);
      }
    }
  });

  test('the 144-tile boards come out close to the smallest board, not half its size', async ({
    page,
  }) => {
    test.setTimeout(SWEEP_TIMEOUT);
    // Chris's ask on 2026-07-28, in his words: stack the big boards higher so each tile is
    // "the 48 tile design tile size — or a tiny bit smaller". Before the change they were
    // 58 dp against the 48-tile board's 91. This is the test that stops them drifting back:
    // three times the tiles may cost some size, but not a third of it.
    await gotoGame(page, { layout: 'steps-48', seed: 7, viewport: HER_TABLET });
    const reference = smallestTile(await snapshot(page));

    const boards = FIXED_LAYOUT_IDS.filter((id) => LAYOUTS[id].tiles.length === 144);
    for (const id of boards) {
      await gotoGame(page, { layout: id, seed: 7, viewport: HER_TABLET });
      expect(smallestTile(await snapshot(page)), `${id} against steps-48's ${reference} dp`)
        .toBeGreaterThanOrEqual(reference * 0.8);
    }
  });

  test('every board opens with several pairs showing', async ({ page }) => {
    test.setTimeout(SWEEP_TIMEOUT);
    // A mound exposes far fewer tiles than a flat board does, so this is the guarantee
    // that stops the taller stacking turning a board into a wall with one legal move on
    // it. BOARD.minOpeningPairs is what makes it true, by dealing the first few pairs onto
    // tiles that are free before anything has been cleared.
    for (const id of [...FIXED_LAYOUT_IDS, SURPRISE.id]) {
      for (const viewport of [HER_TABLET, HER_TABLET_LANDSCAPE]) {
        await gotoGame(page, { layout: id, seed: 7, viewport });
        const state = await snapshot(page);
        expect(state.availablePairs, `${id} at ${viewport.label}`).toBeGreaterThanOrEqual(4);
      }
    }
  });

  test('the surprise board is sized for her screen too', async ({ page }) => {
    // It used to skip the mound builder entirely and came out smallest of all, at 49 dp.
    await gotoGame(page, { layout: SURPRISE.id, seed: 7, viewport: HER_TABLET });
    const state = await snapshot(page);
    expect(state.counts.total).toBe(SURPRISE.tiles);
    expect(smallestTile(state)).toBeGreaterThanOrEqual(64);
  });

  test('boards stay inside the screen at every tablet size', async ({ page }) => {
    test.setTimeout(SWEEP_TIMEOUT);
    for (const viewport of TABLET_VIEWPORTS) {
      for (const id of ['steps-48', 'turtle-144']) {
        await gotoGame(page, { layout: id, seed: 7, viewport });
        expect(
          clippedTiles(await snapshot(page), viewport),
          `${id} clipped at ${viewport.label}`
        ).toHaveLength(0);
      }
    }
  });

  test('board frames at tablet viewports', async ({ page }) => {
    const viewports = [
      { width: 1280, height: 800 },
      { width: 800, height: 1340 },
      { width: 2560, height: 1600 },
    ];
    for (const viewport of viewports) {
      await gotoGame(page, { layout: 'turtle-144', viewport });
      const state = await snapshot(page);
      for (const t of state.tiles) {
        const label = `${viewport.width}x${viewport.height} tile ${t.id}`;
        expect(t.screen.x, `${label} clipped left`).toBeGreaterThanOrEqual(0);
        expect(t.screen.y, `${label} clipped top`).toBeGreaterThanOrEqual(0);
        expect(t.screen.x + t.screen.w, `${label} clipped right`).toBeLessThanOrEqual(viewport.width);
        expect(t.screen.y + t.screen.h, `${label} clipped bottom`).toBeLessThanOrEqual(viewport.height);
      }
    }
  });
});
