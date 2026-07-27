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
    const free = state.tiles.find((t) => t.free && t.layer === 1);
    const blocked = state.tiles.find((t) => !t.free && t.layer === 0);
    expect(free && blocked).toBeTruthy();

    // Sampled off-centre, away from the printed glyphs.
    const [freeColour, blockedColour] = await samplePoints(page, [
      [Math.round(free.screen.cx - free.screen.w * 0.32), Math.round(free.screen.cy)],
      [Math.round(blocked.screen.cx - blocked.screen.w * 0.32), Math.round(blocked.screen.cy)],
    ]);

    // ADR-0002 constraint 2: "what can I tap?" must be answered by the render itself.
    expect(luminance(blockedColour) / luminance(freeColour)).toBeLessThan(0.85);
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

    // Clear two pairs.
    for (let n = 0; n < 2; n++) {
      const hint = await page.evaluate(() => window.__debug.hint());
      let state = await snapshot(page);
      for (const id of hint.pair) state = await tapTile(page, state, id);
    }
    const remaining = (await snapshot(page)).counts.remaining;
    expect(remaining).toBe(68);

    // Close the tablet and come back.
    await page.reload();
    await page.waitForFunction(() => window.__ready === true);
    await expect(page.locator('#btn-resume')).toBeVisible();
    expect(await page.textContent('#btn-resume')).toContain('68');

    await page.click('#btn-resume');
    await page.waitForFunction(() => window.render_game_to_text().screen === 'board');
    const resumed = await snapshot(page);
    expect(resumed.counts.remaining).toBe(68);
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

test.describe('installable', () => {
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
