import './style.css';
import { Game } from './core/Game.js';
import { LAYOUT_DEFAULT } from './core/Constants.js';
import { LAYOUT_IDS } from './board/Layouts.js';
import { atlasCell, loadTileAtlas } from './assets/TileSheet.js';
import { ATLAS, FACES } from './core/Constants.js';
import { Ui } from './ui/Ui.js';
import { Events, eventBus } from './core/EventBus.js';
import { gameState } from './core/GameState.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { SaveSystem } from './systems/SaveSystem.js';
import { registerServiceWorker, watchForInstallPrompt } from './systems/InstallSystem.js';

const container = document.getElementById('game-container');

// ?layout= and ?seed= are development and test affordances only. Dawn picks her
// board from the front screen (milestone 04); she never sees a URL. The seed makes
// a board reproducible, which is how a reported problem gets investigated.
const params = new URLSearchParams(window.location.search);
const requested = params.get('layout');
const layoutId = LAYOUT_IDS.includes(requested) ? requested : LAYOUT_DEFAULT;
const seed = params.has('seed') ? Number(params.get('seed')) : null;

boot();

async function boot() {
  // The tile sheet is cropped into its atlas before the first frame, so she never
  // sees a board of blank tiles pop into artwork.
  let atlasCanvas = null;
  try {
    atlasCanvas = await loadTileAtlas();
  } catch (error) {
    // Degrade to the placeholder atlas rather than a blank screen: an ugly board is
    // still a playable board.
    console.error('tile sheet failed to load, falling back to placeholder faces:', error);
  }

  // A layout or seed in the URL means a developer or a test asked for a specific
  // board, so the front screen is skipped and play starts immediately. Dawn opens
  // the plain URL and always gets greeted.
  const straightToBoard = params.has('layout') || params.has('seed');

  const game = new Game(container, {
    layoutId,
    seed: Number.isFinite(seed) ? seed : null,
    atlasCanvas,
  });

  const save = new SaveSystem();
  const audio = new AudioSystem({ muted: save.muted });
  gameState.boardsCompleted = save.boardsCompleted;

  const ui = new Ui({ playerName: 'Dawn' });
  ui.buildLegendArt(atlasCanvas, (face) => {
    const index = FACES.indexOf(face);
    if (index < 0) return null;
    const at = atlasCell(index);
    return { x: at.x, y: at.y, w: ATLAS.cellWidth, h: ATLAS.cellHeight };
  });
  wireUi(game, ui, save, audio);

  // The glass comes back out if she left it out (ADR-0004), on either path into the game.
  game.setMagnifier(save.magnifier);
  ui.setMagnifierOn(save.magnifier);

  if (straightToBoard) {
    ui.showScreen(gameState.screen);
  } else {
    // She always lands on the greeting, with "carry on" offered only when there is
    // genuinely a half-finished board to carry on with.
    if (save.preferredLayout) ui.setLayoutChoice(save.preferredLayout);
    ui.setResumeAvailable(save.hasResumableBoard, resumeLabel(save));
    ui.setBoardsCompleted(save.boardsCompleted);
    ui.setCompletedBoards(save.completedByBoard);
    ui.setMuted(save.muted);
    game.goHome();
    ui.showScreen(gameState.screen);
  }

  // Same reason: the very first board is dealt before the overlay exists. Routed through
  // onResize so anything listening for a reframe — the ?diag readout included — hears it
  // and can't report a stale number.
  requestAnimationFrame(() => game.onResize());

  if (params.has('diag')) showDiagnostics(game);

  suppressUnwantedGestures();
  installTestHooks(game, ui, save, audio);
  watchForInstallPrompt(ui);
  registerServiceWorker();

  // Fonts settle before anything measures text, so tests never race the layout.
  await (document.fonts ? document.fonts.ready : Promise.resolve());
  game.requestRender();

  // Ready means "the board has finished dealing itself and can be played", not
  // merely "a frame was drawn" — otherwise a tap (or a test) lands on tiles that
  // are still in flight.
  await new Promise((resolve) => {
    const check = () => (game.settled ? resolve() : requestAnimationFrame(check));
    check();
  });
  window.__ready = true;
}

/**
 * ?diag=1 — what this device actually reports, read on the device itself. The board sizes
 * are tuned to dp, and dp depends on the panel *and* on Android's display-size setting, so
 * this exists to stop those numbers resting on an assumption. Never shown to Dawn.
 */
function showDiagnostics(game) {
  const el = document.getElementById('diag');
  el.classList.remove('hidden');
  const update = () => {
    const state = game.snapshot();
    const smallest = state.tiles.length
      ? Math.min(...state.tiles.map((t) => t.screen.w))
      : 0;
    el.textContent = [
      `viewport   ${window.innerWidth} × ${window.innerHeight} dp`,
      `pixels     ${Math.round(window.innerWidth * window.devicePixelRatio)} × ${Math.round(
        window.innerHeight * window.devicePixelRatio
      )}`,
      `ratio      ${window.devicePixelRatio}`,
      `held       ${window.innerHeight > window.innerWidth ? 'upright' : 'on its side'}`,
      `board      ${state.layout} — ${state.counts.total} tiles`,
      `tile       ${smallest.toFixed(0)} dp ≈ ${((smallest * 25.4) / 160).toFixed(0)} mm`,
    ].join('\n');
  };
  update();
  window.addEventListener('resize', () => requestAnimationFrame(update));
  eventBus.on(Events.VIEW_RESIZED, () => requestAnimationFrame(update));
  eventBus.on(Events.SCREEN_CHANGED, () => requestAnimationFrame(update));
  eventBus.on(Events.BOARD_GENERATED, () => requestAnimationFrame(update));
}

/**
 * The overlay asks, the game answers. Buttons emit ui:* events and this is the only
 * place that turns them into game actions — so the DOM never reaches into the scene.
 */
function wireUi(game, ui, save, audio) {
  // The board is first fitted while the bar is still hidden, so nothing is reserved for
  // it and tiles end up underneath the buttons. Refit once the bar is actually on screen.
  eventBus.on(Events.SCREEN_CHANGED, ({ screen }) => {
    if (screen === 'board') requestAnimationFrame(() => game.onResize());
  });

  eventBus.on(Events.UI_START_BOARD, ({ layoutId: chosen }) => {
    game.newBoard({ layoutId: chosen });
    game.setScreen('board');
    save.saveBoard();
  });

  eventBus.on(Events.UI_RESUME, () => {
    const board = save.savedBoard;
    if (!board) return;
    game.resumeBoard(board);
    game.setScreen('board');
  });

  eventBus.on(Events.UI_HINT, () => game.hint());
  eventBus.on(Events.UI_SHUFFLE, () => game.shuffle());
  eventBus.on(Events.UI_HOME, () => {
    game.goHome();
    ui.setResumeAvailable(save.hasResumableBoard, resumeLabel(save));
  });
  eventBus.on(Events.UI_LAYOUT_CHOSEN, ({ layoutId: chosen }) => save.setPreferredLayout(chosen));
  eventBus.on(Events.UI_SOUND_TOGGLED, () => save.setMuted(audio.toggleMuted()));
  eventBus.on(Events.UI_MAGNIFIER_TOGGLED, () => save.setMagnifier(game.toggleMagnifier()));

  // Autosave after anything that changes the board. Cheap (one localStorage write of
  // a few KB) and it means the game survives the tablet being closed mid-pair.
  for (const event of [Events.PAIR_MATCHED, Events.ASSIST_HINT, Events.ASSIST_SHUFFLE]) {
    eventBus.on(event, () => save.saveBoard());
  }

  eventBus.on(Events.PAIR_MATCHED, () => ui.refreshHud());
  eventBus.on(Events.BOARD_CLEARED, ({ layoutId: finished }) => {
    const completed = save.recordBoardCompleted(finished);
    gameState.boardsCompleted = completed;
    ui.setBoardsCompleted(completed);
    ui.setCompletedBoards(save.completedByBoard);
  });
  eventBus.on(Events.GAME_NO_MOVES, () => save.clearBoard());
}

function resumeLabel(save) {
  const board = save.savedBoard;
  if (!board) return '';
  const left = board.tiles.filter((t) => !t.cleared).length;
  return `Carry on — ${left} tiles left`;
}

/**
 * ADR-0002 constraint 1: a single tap is the whole control scheme. These are the
 * gestures an unsteady hand produces by accident on Android — every one of them
 * can leave the view in a state she has no way to undo, so they are cancelled
 * rather than merely unused.
 */
function suppressUnwantedGestures() {
  const cancel = (e) => e.preventDefault();
  document.addEventListener('contextmenu', cancel);
  document.addEventListener('dblclick', cancel);
  document.addEventListener('gesturestart', cancel);
  document.addEventListener('gesturechange', cancel);
  document.addEventListener('gestureend', cancel);
  document.addEventListener('selectstart', cancel);
  document.addEventListener('touchmove', cancel, { passive: false });
  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false }
  );
  document.addEventListener('wheel', cancel, { passive: false });
}

function installTestHooks(game, ui, save, audio) {
  window.render_game_to_text = () => game.snapshot();
  window.advanceTime = (seconds) => game.advanceTime(seconds);

  window.__debug = {
    game,
    ui,
    save,
    audio,

    pickAt: (x, y) => game.pickAt(x, y),

    // The player-facing buttons for these arrive in milestone 04; until then this
    // is how the assists get exercised.
    hint: () => game.hint(),
    shuffle: () => game.shuffle(),
    newBoard: (options) => game.newBoard(options),
    tap: (x, y) => game.handleTap(x, y),
    /** Select by tile id, for tests that don't care about screen coordinates. */
    selectById: (id) => {
      const tile = gameState.tileById(id);
      if (tile) game.selectTile(tile);
      return game.snapshot();
    },
    setScreen: (screen) => game.setScreen(screen),
    home: () => game.goHome(),

    /** The magnifying glass, without going through the bar (ADR-0004). */
    magnifier: {
      set: (on) => game.setMagnifier(on),
      toggle: () => game.toggleMagnifier(),
      moveTo: (x, y) => game.moveMagnifier(x, y),
      /** Where a tap at this point would actually land on the board. */
      sourcePoint: (x, y) =>
        game.magnifier.contains(x, y) ? game.magnifier.sourcePoint(x, y) : { x, y },
    },

    /**
     * Loads an arbitrary board, bypassing generation. Tests use it to set up
     * positions that are hard to reach by playing — a stuck board, most of all,
     * which cannot be generated on purpose because generation guarantees the
     * opposite.
     */
    loadFixture(tiles, { layoutId = 'easy-72', assists = null } = {}) {
      const withIds = tiles.map((t, i) => ({ id: i, cleared: false, ...t }));
      // No entrance animation: a fixture is a board a test wants to act on now.
      game.buildBoard(layoutId, withIds, { animate: false });
      // Assists are reset by building a board, so they are applied afterwards —
      // and the board state is re-derived, because whether a stuck board is a loss
      // depends on how many reshuffles are left.
      if (assists) game.setAssists(assists);
      game.requestRender();
      return game.snapshot();
    },

    /**
     * Pixel readback. Headless WebGL screenshots composite black, so visual
     * assertions read the drawing buffer instead — and it has to happen in the
     * same task as the draw, before the buffer is presented.
     */
    readPixels({ x, y, w, h }) {
      game.renderNow();
      const gl = game.renderer.getContext();
      const dpr = game.renderer.getPixelRatio();
      const bufferHeight = gl.drawingBufferHeight;
      const px = Math.max(0, Math.round(x * dpr));
      const pw = Math.max(1, Math.round(w * dpr));
      const ph = Math.max(1, Math.round(h * dpr));
      const py = Math.max(0, Math.round(bufferHeight - (y + h) * dpr));
      const raw = new Uint8Array(pw * ph * 4);
      gl.readPixels(px, py, pw, ph, gl.RGBA, gl.UNSIGNED_BYTE, raw);

      // Flip to a top-left origin so callers can reason in screen terms.
      const pixels = new Array(raw.length);
      for (let row = 0; row < ph; row++) {
        const from = (ph - 1 - row) * pw * 4;
        for (let i = 0; i < pw * 4; i++) pixels[row * pw * 4 + i] = raw[from + i];
      }
      return { width: pw, height: ph, pixels };
    },

    /** Colours at a list of CSS-pixel points — one buffer read, many samples. */
    samplePoints(points) {
      game.renderNow();
      const gl = game.renderer.getContext();
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const buf = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      const dpr = game.renderer.getPixelRatio();
      return points.map(([cx, cy]) => {
        const px = Math.min(w - 1, Math.max(0, Math.round(cx * dpr)));
        const top = Math.min(h - 1, Math.max(0, Math.round(cy * dpr)));
        const offset = ((h - 1 - top) * w + px) * 4;
        return [buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]];
      });
    },

    /** Full frame as a PNG data URL, for saving iterate captures. */
    capture() {
      game.renderNow();
      const gl = game.renderer.getContext();
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const buf = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      const image = ctx.createImageData(w, h);
      for (let row = 0; row < h; row++) {
        const from = (h - 1 - row) * w * 4;
        for (let i = 0; i < w * 4; i++) image.data[row * w * 4 + i] = buf[from + i];
      }
      ctx.putImageData(image, 0, 0);
      return canvas.toDataURL('image/png');
    },
  };
}
