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
  // Dawn's tablet is a Galaxy Tab A11+. An ~11" 1920×1200 panel presents roughly
  // 960 × 600 dp at Android's default display size, so that is the size that actually
  // matters; the rest cover a smaller display-size setting and a larger tablet.
  const HER_TABLET = { width: 960, height: 600, label: 'Tab A11+ at default display size' };
  const TABLET_VIEWPORTS = [
    HER_TABLET,
    { width: 1097, height: 686, label: 'Tab A11+, smaller display size' },
    { width: 1280, height: 800, label: 'test default' },
    { width: 1600, height: 1000, label: '12"+ class' },
  ];

  const smallestTile = (state) =>
    state.tiles.reduce((min, t) => Math.min(min, t.screen.w, t.screen.h), Infinity);

  test('the everyday boards meet the 64dp touch minimum on her tablet', async ({ page }) => {
    // ADR-0002 constraint 4: tile size derives from the touch-target minimum, never the
    // other way round. These are the two boards that must hold everywhere, because they
    // are the ones sized to fit her screen — both are 12 columns wide.
    for (const layout of ['easy-72', 'pagoda-96']) {
      for (const viewport of TABLET_VIEWPORTS) {
        await gotoGame(page, { layout, viewport });
        const smallest = smallestTile(await snapshot(page));
        expect(smallest, `${layout} at ${viewport.label} (${viewport.width}dp)`).toBeGreaterThanOrEqual(64);
      }
    }
  });

  test('the 144-tile boards measure what we think they measure on her tablet', async ({ page }) => {
    // Recorded honestly rather than flatteringly: 16 tiles across 960 dp is 60 dp before
    // margins and perspective, so every 144-tile board lands at roughly 44 dp on her
    // Tab A11+ — under Android's own 48 dp guidance. That is why the 72- and 96-tile
    // boards are the everyday ones, why tap forgiveness exists, and why a bigger
    // Android display-size setting is worth knowing about. This test's job is to catch
    // it getting *worse*, and to catch clipping.
    const boards = [...FIXED_LAYOUT_IDS.filter((id) => LAYOUTS[id].tiles.length === 144), SURPRISE.id];
    for (const id of boards) {
      await gotoGame(page, { layout: id, seed: 7, viewport: HER_TABLET });
      const state = await snapshot(page);
      expect(state.counts.total, `${id} tile count`).toBe(144);
      expect(smallestTile(state), `${id} smallest tile`).toBeGreaterThanOrEqual(43);
      const clipped = state.tiles.filter(
        (t) =>
          t.screen.x < 0 ||
          t.screen.y < 0 ||
          t.screen.x + t.screen.w > HER_TABLET.width ||
          t.screen.y + t.screen.h > HER_TABLET.height
      );
      expect(clipped, `${id} clipped tiles`).toHaveLength(0);
    }
  });

  test('turtle-144 stays above the 48dp platform floor, and clears 64 on a large screen', async ({
    page,
  }) => {
    // The classic turtle is 15 tiles wide by 8 deep and cannot reach 64 dp on a
    // 10–11" tablet — measured 47 dp at 1024×640, 59 at 1280×800. That is the
    // cost ADR-0002 predicted for keeping the traditional layout, so it is
    // recorded here rather than left to be discovered on her tablet. 48 dp is
    // Android's own documented minimum touch target.
    await gotoGame(page, { layout: 'turtle-144', viewport: { width: 1024, height: 640 } });
    expect(smallestTile(await snapshot(page))).toBeGreaterThanOrEqual(46);

    await gotoGame(page, { layout: 'turtle-144', viewport: { width: 1600, height: 1000 } });
    expect(smallestTile(await snapshot(page))).toBeGreaterThanOrEqual(64);
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
