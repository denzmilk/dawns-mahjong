import { test, expect } from '@playwright/test';
import { gotoGame, snapshot } from './helpers.mjs';

// The dancing Elvis in the spotlight celebration, and the riff he comes on to.
//
// He is drawn from a skeleton into a sprite sheet at boot, so most of what can go wrong is
// geometry: a pose that reaches outside its own cell comes out sliced, and a cycle whose
// frames are too alike reads as a man standing still.

const HER_TABLET = { width: 600, height: 960 };

/**
 * Deals a fixture of the given layout's own shape with one matching pair placed on tiles
 * that are genuinely free, and clears it. `face` decides whether the Elvis celebration
 * fires or one of the other seven does.
 */
async function clearAPair(page, { face = 'elvis-1', corner = false } = {}) {
  const cells = await page.evaluate(() =>
    window.render_game_to_text().tiles.map((t) => ({ x: t.x, y: t.y, layer: t.layer }))
  );

  // Which cells are free has to be asked of the board, not guessed: on a mound the free
  // tiles are the ledges, and where those are depends on the footprint it was built on.
  const free = await page.evaluate(
    (shape) => {
      window.__debug.loadFixture(
        shape.map((c) => ({ ...c, face: 'dot-1' })),
        { layoutId: 'turtle-144' }
      );
      return window.render_game_to_text().tiles.filter((t) => t.free).map((t) => ({
        x: t.x,
        y: t.y,
        layer: t.layer,
      }));
    },
    cells
  );

  await page.evaluate(
    ([shape, freeCells, wanted, wantCorner]) => {
      const xs = shape.map((c) => c.x);
      const ys = shape.map((c) => c.y);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const from = (c) => Math.hypot(c.x - cx, c.y - cy);
      const sorted = [...freeCells].sort((a, b) => (wantCorner ? from(b) - from(a) : from(a) - from(b)));
      const pair = [sorted[0], sorted[1]];
      const same = (a, b) => a.x === b.x && a.y === b.y && a.layer === b.layer;
      window.__debug.loadFixture(
        shape.map((c) => ({ ...c, face: pair.some((p) => same(p, c)) ? wanted : 'dot-1' })),
        { layoutId: 'turtle-144' }
      );
      window.__debug.setScreen('board');
      window.__debug.game.onResize();
    },
    [cells, free, face, corner]
  );

  const ids = await page.evaluate(
    (wanted) =>
      window.render_game_to_text().tiles.filter((t) => t.face === wanted && t.free).map((t) => t.id),
    face
  );
  expect(ids.length, `expected two free ${face} tiles to clear`).toBe(2);
  await page.evaluate((pair) => pair.forEach((id) => window.__debug.selectById(id)), ids);
}

test('the sprite sheet holds a whole cycle of distinct poses', async ({ page }) => {
  await gotoGame(page, { layout: 'steps-48', viewport: HER_TABLET });

  const report = await page.evaluate(() => {
    const canvas = window.__debug.game.dancer.texture.image;
    const ctx = canvas.getContext('2d');
    const frames = window.render_game_to_text().dancer.frames;
    const cell = canvas.width / frames;

    // A cheap signature per frame: how much ink, and where its centre of mass is. Two
    // poses that differ anywhere differ in at least one of the three.
    const signatures = [];
    const clipped = [];
    for (let i = 0; i < frames; i++) {
      const { data } = ctx.getImageData(i * cell, 0, cell, canvas.height);
      let ink = 0;
      let sumX = 0;
      let sumY = 0;
      for (let p = 0; p < data.length; p += 4) {
        if (data[p + 3] <= 8) continue;
        const pixel = p / 4;
        ink++;
        sumX += pixel % cell;
        sumY += Math.floor(pixel / cell);
      }
      signatures.push([ink, Math.round(sumX / ink), Math.round(sumY / ink)].join(':'));

      // Ink on a cell's own edge means a pose is reaching outside its frame, and the
      // frame is where it gets cut off.
      const edges = [
        ctx.getImageData(i * cell, 0, cell, 2),
        ctx.getImageData(i * cell, canvas.height - 2, cell, 2),
        ctx.getImageData(i * cell, 0, 2, canvas.height),
        ctx.getImageData(i * cell + cell - 2, 0, 2, canvas.height),
      ];
      const sides = ['top', 'bottom', 'left', 'right'];
      edges.forEach((edge, n) => {
        for (let p = 3; p < edge.data.length; p += 4) {
          if (edge.data[p] > 8) {
            clipped.push(`frame ${i} ${sides[n]}`);
            return;
          }
        }
      });
    }
    return { frames, signatures, clipped, width: canvas.width, height: canvas.height };
  });

  expect(report.frames).toBe(8);
  expect(report.clipped, 'a pose is reaching outside its own cell').toEqual([]);
  // Every frame a different pose — the first attempt at the dance was so polite that all
  // eight came out nearly identical, which reads as a man standing still.
  expect(new Set(report.signatures).size, `poses: ${report.signatures.join(' | ')}`).toBe(8);
});

test('he dances for an Elvis pair, and is gone by the end of it', async ({ page }) => {
  await gotoGame(page, { layout: 'turtle-144', seed: 7, viewport: HER_TABLET });
  await clearAPair(page);

  expect((await snapshot(page)).dancer.visible, 'not on stage yet at t=0').toBe(false);

  await page.evaluate(() => window.advanceTime(0.5));
  const dancing = (await snapshot(page)).dancer;
  expect(dancing.visible).toBe(true);

  // The frame advances with the celebration's own clock, so it steps deterministically
  // under advanceTime() like every other animation (ADR-0003).
  await page.evaluate(() => window.advanceTime(0.1));
  expect((await snapshot(page)).dancer.frame).not.toBe(dancing.frame);

  // Off before the celebration ends, so he is never the thing she is waiting for.
  await page.evaluate(() => window.advanceTime(1.2));
  expect((await snapshot(page)).dancer.visible).toBe(false);
});

test('he stays out of it for an ordinary pair', async ({ page }) => {
  // Seven of the eight celebrations are not his. If he turned up for all of them he would
  // stop being the reward for finding the Elvis tiles.
  await gotoGame(page, { layout: 'turtle-144', seed: 7, viewport: HER_TABLET });
  await clearAPair(page, { face: 'bamboo-3' });

  for (const step of [0.3, 0.3, 0.3]) {
    await page.evaluate((s) => window.advanceTime(s), step);
    expect((await snapshot(page)).dancer.visible).toBe(false);
  }
});

test('a pair in the corner still puts him on the board', async ({ page }) => {
  // He dances where the pair was, which is what connects the flourish to what she did —
  // but the two hardest tiles on a board are often in a corner, and half an Elvis off the
  // edge of the screen is a poor reward for finding them.
  await gotoGame(page, { layout: 'turtle-144', seed: 7, viewport: HER_TABLET });
  await clearAPair(page, { corner: true });
  await page.evaluate(() => window.advanceTime(0.5));

  const onScreen = await page.evaluate(() => {
    const { game } = window.__debug;
    const point = game.dancer.mesh.position.clone().project(game.camera);
    return { x: point.x, y: point.y, visible: game.dancer.mesh.visible };
  });
  expect(onScreen.visible).toBe(true);
  // Normalised device coordinates: inside ±1 is inside the screen.
  expect(Math.abs(onScreen.x), `x ${onScreen.x}`).toBeLessThan(0.75);
  expect(Math.abs(onScreen.y), `y ${onScreen.y}`).toBeLessThan(0.9);
});

test('the guitar riff plays for his celebration and no other', async ({ page }) => {
  await gotoGame(page, { layout: 'turtle-144', seed: 7, viewport: HER_TABLET });
  await page.evaluate(() => {
    const { audio } = window.__debug;
    window.__riffs = 0;
    window.__sparkles = 0;
    const riff = audio.riff.bind(audio);
    const sparkle = audio.sparkle.bind(audio);
    audio.riff = (...args) => (window.__riffs++, riff(...args));
    audio.sparkle = (...args) => (window.__sparkles++, sparkle(...args));
  });

  await clearAPair(page, { face: 'bamboo-3' });
  expect(await page.evaluate(() => window.__riffs), 'an ordinary pair must not riff').toBe(0);

  await clearAPair(page);
  expect(await page.evaluate(() => window.__riffs)).toBe(1);
});
