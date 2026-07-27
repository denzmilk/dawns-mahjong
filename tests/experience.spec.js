import { test, expect } from '@playwright/test';
import { gotoGame, snapshot, samplePoints, tapTile } from './helpers.mjs';

// Milestones 04–09: the greeting, the type scale, the unmissable selection, dimmed
// unplayable tiles, the celebrations, saves, and the installable shell.
//
// Note on ordering: unlike milestones 01–03, these were built before their tests
// (Chris asked for a straight run through the ladder). The tests below were written
// afterwards and each one was checked to fail against the behaviour it guards —
// recorded in docs/STATE.md rather than glossed over.

const luminance = ([r, g, b]) => (r + g + b) / 3;
const px = (value) => Number.parseFloat(value);

/**
 * Load the plain URL: no ?layout / ?seed, so the greeting screen shows.
 * Storage is cleared ONCE and then reloaded — an addInitScript clear would run on
 * every navigation, wiping the very save the resume tests are trying to check.
 */
async function gotoFront(page) {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20_000 });
  return page;
}

test.describe('the greeting', () => {
  test('greets Dawn by name, with the right part of the day', async ({ page }) => {
    await gotoFront(page);
    await expect(page.locator('#greeting')).toBeVisible();

    const line = await page.textContent('#greeting-line');
    const hour = await page.evaluate(() => new Date().getHours());
    const expected = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    expect(line).toBe(`Good ${expected}, Dawn`);
  });

  test('the greeting hero photo actually loads', async ({ page }) => {
    await gotoFront(page);
    // A broken portrait is the first thing she would see, so this is worth asserting
    // rather than assuming: naturalWidth is 0 for an image that failed.
    const loaded = await page.evaluate(() => {
      const img = document.getElementById('greeting-hero');
      return img.complete && img.naturalWidth > 0;
    });
    expect(loaded).toBe(true);
  });

  test('type is at or above the ADR-0002 floors', async ({ page }) => {
    await gotoFront(page);
    const sizes = await page.evaluate(() => ({
      greeting: getComputedStyle(document.getElementById('greeting-line')).fontSize,
      button: getComputedStyle(document.getElementById('btn-play')).fontSize,
      body: getComputedStyle(document.documentElement).fontSize,
    }));
    expect(px(sizes.greeting)).toBeGreaterThanOrEqual(52);
    expect(px(sizes.button)).toBeGreaterThanOrEqual(32);
    expect(px(sizes.body)).toBeGreaterThanOrEqual(24);
  });

  test('every button meets the 64dp touch minimum', async ({ page }) => {
    await gotoFront(page);
    await page.click('#btn-play');
    await page.waitForFunction(() => window.render_game_to_text().screen === 'board');

    const buttons = page.locator('#hud button, .big-button, .choice-button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(3);
    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      if (!box) continue; // hidden on this screen
      expect(box.height, `button ${i} height`).toBeGreaterThanOrEqual(64);
      expect(box.width, `button ${i} width`).toBeGreaterThanOrEqual(64);
    }
  });

  test('choosing a board and starting shows the board and the bar', async ({ page }) => {
    await gotoFront(page);
    await page.click('.choice-button[data-layout="turtle-144"]');
    expect(await page.getAttribute('.choice-button[data-layout="turtle-144"]', 'aria-pressed')).toBe('true');

    await page.click('#btn-play');
    await page.waitForFunction(() => window.render_game_to_text().screen === 'board');
    await expect(page.locator('#greeting')).toBeHidden();
    await expect(page.locator('#hud')).toBeVisible();

    const state = await snapshot(page);
    expect(state.layout).toBe('turtle-144');
    expect(await page.textContent('#tiles-left-count')).toBe('144');
  });
});

test.describe('reading the board', () => {
  test('unplayable tiles are visibly dimmer than playable ones', async ({ page }) => {
    await gotoGame(page, { layout: 'easy-72', seed: 1234 });
    const state = await snapshot(page);

    // Averaged over several tiles of each kind rather than one of each: any single
    // tile can be sitting under a shadow or carrying a dark glyph, which says nothing
    // about the shading. "Visibly dimmer" is a claim about the board, not one tile.
    const pick = (wanted) => state.tiles.filter((t) => t.free === wanted && !t.cleared).slice(0, 8);
    const freeTiles = pick(true);
    const blockedTiles = pick(false);
    expect(freeTiles.length, 'need playable tiles to sample').toBeGreaterThan(3);
    expect(blockedTiles.length, 'need blocked tiles to sample').toBeGreaterThan(3);

    // Sampled off-centre, away from the printed glyphs.
    const point = (t) => [Math.round(t.screen.cx - t.screen.w * 0.32), Math.round(t.screen.cy)];
    const colours = await samplePoints(page, [...freeTiles, ...blockedTiles].map(point));
    const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
    const freeMean = mean(colours.slice(0, freeTiles.length).map(luminance));
    const blockedMean = mean(colours.slice(freeTiles.length).map(luminance));

    // ADR-0002 constraint 2: "what can I tap?" must be answered by the render itself.
    expect(blockedMean / freeMean).toBeLessThan(0.85);
  });

  test('a selected tile lifts and gains a gold rim', async ({ page }) => {
    await gotoGame(page, { layout: 'easy-72', seed: 1234 });
    let state = await snapshot(page);
    const target = state.tiles.filter((t) => t.free)[4];
    const before = target.screen.cy;

    state = await tapTile(page, state, target.id);
    expect(state.selection).toBe(target.id);
    const after = state.tiles.find((t) => t.id === target.id).screen.cy;
    // Channel 1: it lifts toward her (up the screen).
    expect(after).toBeLessThan(before);

    // Channel 2: gold appears at the tile's edge. Sampled just outside the tile's
    // own footprint, where the rim sticks out.
    const rim = await samplePoints(page, [
      [Math.round(after && target.screen.cx - target.screen.w * 0.58), Math.round(after)],
    ]);
    const [r, g, b] = rim[0];
    expect(r, 'rim should be gold: red high').toBeGreaterThan(120);
    expect(g, 'rim should be gold: green high').toBeGreaterThan(90);
    expect(b, 'rim should be gold: blue low').toBeLessThan(r - 30);
  });
});

test.describe('celebrations', () => {
  test('a match plays a celebration that finishes and cleans up', async ({ page }) => {
    await gotoGame(page, { layout: 'easy-72', seed: 1234 });
    const hint = await page.evaluate(() => window.__debug.hint());
    let state = await snapshot(page);

    for (const id of hint.pair) state = await tapTile(page, state, id);
    expect(state.counts.remaining).toBe(70);

    // Mid-flight: a celebration is running and particles are alive.
    const during = await page.evaluate(() => ({
      running: window.__debug.game.celebrations.length,
      particles: window.__debug.game.particles.active,
    }));
    expect(during.running).toBeGreaterThan(0);

    // And it ends: nothing left running, no stray shard meshes in the scene.
    await page.evaluate(() => window.advanceTime(3));
    const after = await page.evaluate(() => ({
      running: window.__debug.game.celebrations.length,
      particles: window.__debug.game.particles.active,
      strayMeshes: window.__debug.game.scene.children.filter(
        (child) => child.isMesh && child.geometry?.type === 'BoxGeometry' && child.parent === window.__debug.game.scene
      ).length,
    }));
    expect(after.running).toBe(0);
    expect(after.particles).toBe(0);
    // Only the selection rim is a scene-level box; crumble shards must be gone.
    expect(after.strayMeshes).toBeLessThanOrEqual(1);
  });

  test('celebrations vary from match to match', async ({ page }) => {
    await gotoGame(page, { layout: 'easy-72', seed: 4242 });
    const seen = await page.evaluate(() => {
      const names = [];
      const game = window.__debug.game;
      for (let n = 0; n < 8; n++) {
        const hint = game.hint();
        if (!hint) break;
        for (const id of hint.pair) window.__debug.selectById(id);
        window.advanceTime(1.5);
        names.push(game.lastCelebration);
      }
      return names;
    });
    // No immediate repeats, and genuine variety across a handful of matches.
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
    expect(new Set(seen).size).toBeGreaterThan(2);
  });
});

test.describe('carrying on', () => {
  test('a part-played board is offered back, and resumes where she left it', async ({ page }) => {
    await gotoFront(page);
    await page.click('#btn-play');
    await page.waitForFunction(() => window.render_game_to_text().screen === 'board');

    // Clear two pairs, checking each one actually went rather than assuming the taps
    // landed — a celebration is playing over the board while this runs.
    const before = (await snapshot(page)).counts.total;
    for (let n = 0; n < 6 && (await snapshot(page)).counts.cleared < 4; n++) {
      const hint = await page.evaluate(() => window.__debug.hint());
      if (!hint) break;
      let state = await snapshot(page);
      for (const id of hint.pair) state = await tapTile(page, state, id);
    }
    const remaining = (await snapshot(page)).counts.remaining;
    expect(remaining).toBe(before - 4);

    // Close the tablet and come back.
    await page.reload();
    await page.waitForFunction(() => window.__ready === true);
    await expect(page.locator('#btn-resume')).toBeVisible();
    expect(await page.textContent('#btn-resume')).toContain(String(remaining));

    await page.click('#btn-resume');
    await page.waitForFunction(() => window.render_game_to_text().screen === 'board');
    const resumed = await snapshot(page);
    expect(resumed.counts.remaining).toBe(remaining);
    expect(resumed.counts.cleared).toBe(4);
  });

  test('a fresh visitor is not offered a game to carry on with', async ({ page }) => {
    await gotoFront(page);
    await expect(page.locator('#btn-resume')).toBeHidden();
  });

  test('the sound choice is remembered', async ({ page }) => {
    await gotoFront(page);
    await page.click('#btn-play');
    await page.waitForFunction(() => window.render_game_to_text().screen === 'board');

    await page.click('#btn-sound');
    expect(await page.evaluate(() => window.__debug.save.muted)).toBe(true);

    await page.reload();
    await page.waitForFunction(() => window.__ready === true);
    expect(await page.evaluate(() => window.__debug.audio.muted)).toBe(true);
    expect(await page.textContent('#sound-icon')).toBe('🔇');
  });
});

test.describe('boards and the legend', () => {
  test('every board is offered, and picking one actually starts it', async ({ page }) => {
    await gotoFront(page);
    const buttons = page.locator('#board-buttons .choice-button');
    // Eleven fixed boards plus the surprise board.
    expect(await buttons.count()).toBe(12);

    // The surprise board is the one that used to silently fall back to the easy board,
    // because it has no entry in LAYOUTS — it is generated per game.
    await page.click('.choice-button[data-layout="surprise-144"]');
    await page.click('#btn-play');
    await page.waitForFunction(() => window.render_game_to_text().screen === 'board');

    const state = await snapshot(page);
    expect(state.layout).toBe('surprise-144');
    expect(state.counts.total).toBe(48);
    expect(state.availablePairs).toBeGreaterThan(0);
  });

  test('the surprise board deals a different shape each time', async ({ page }) => {
    await gotoFront(page);
    const shapes = new Set();
    for (let n = 0; n < 5; n++) {
      await page.evaluate(() => window.__debug.newBoard({ layoutId: 'surprise-144' }));
      shapes.add((await snapshot(page)).layoutName);
    }
    expect(shapes.size, `got ${[...shapes].join(', ')}`).toBeGreaterThan(1);
  });

  test('how to play opens over the game and closes back to it', async ({ page }) => {
    await gotoFront(page);
    await page.click('#btn-play');
    await page.waitForFunction(() => window.render_game_to_text().screen === 'board');

    await page.click('#btn-legend');
    await expect(page.locator('#legend')).toBeVisible();
    // The bar is hidden while it is up, so nothing behind it can be tapped by mistake.
    await expect(page.locator('#hud')).toBeHidden();
    // The tile pictures come from the real atlas, not from separate artwork.
    expect(await page.locator('#legend-pair canvas').count()).toBe(2);
    expect(await page.locator('#legend-elvis canvas').count()).toBe(2);
    expect(await page.locator('#legend-free canvas.is-dim').count()).toBe(1);

    await page.click('#btn-legend-close');
    await expect(page.locator('#legend')).toBeHidden();
    await expect(page.locator('#hud')).toBeVisible();
    // Still the same game, not a new one.
    expect((await snapshot(page)).screen).toBe('board');
  });

  test('a finished board earns a green tick that survives a reload', async ({ page }) => {
    await gotoFront(page);
    // Get onto the board first: taps are ignored on any other screen, so a fixture
    // loaded behind the greeting would sit there untouchable.
    await page.click('#btn-play');
    await page.waitForFunction(() => window.render_game_to_text().screen === 'board');

    // Two matching tiles: clearing them finishes the board.
    let state = await page.evaluate(() =>
      window.__debug.loadFixture(
        [
          { x: 0, y: 0, layer: 0, face: 'dragon-red' },
          { x: 4, y: 0, layer: 0, face: 'dragon-red' },
        ],
        { layoutId: 'cat-144' }
      )
    );
    for (const id of [0, 1]) state = await tapTile(page, state, id);
    expect(state.screen).toBe('won');
    expect(await page.evaluate(() => window.__debug.save.completedCount('cat-144'))).toBe(1);

    await page.reload();
    await page.waitForFunction(() => window.__ready === true);
    await expect(page.locator('.choice-button[data-layout="cat-144"] .choice-tick')).toBeVisible();
    await expect(page.locator('.choice-button[data-layout="spider-144"] .choice-tick')).toBeHidden();
  });
});

test.describe('installable', () => {
  test('the greeting no longer offers an install button', async ({ page }) => {
    // Removed on Chris's instruction: he installs it once from the browser menu, so it
    // is one less thing on the front screen. Offline play is unaffected.
    await gotoFront(page);
    expect(await page.locator('#btn-install').count()).toBe(0);
  });

  test('the manifest and icons are served', async ({ page, request }) => {
    await gotoFront(page);
    const href = await page.getAttribute('link[rel="manifest"]', 'href');
    expect(href).toBeTruthy();

    const manifest = await request.get(new URL(href, page.url()).href);
    expect(manifest.ok()).toBe(true);
    const body = await manifest.json();
    expect(body.name).toBe("Dawn's Mahjong");
    // Relative paths only: an absolute one resolves against the domain root, not the
    // GitHub Pages project path.
    expect(body.start_url.startsWith('./')).toBe(true);
    for (const icon of body.icons) {
      expect(icon.src.startsWith('./')).toBe(true);
      const response = await request.get(new URL(icon.src, page.url()).href);
      expect(response.ok(), `${icon.src} should be served`).toBe(true);
    }
    expect(body.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });
});
