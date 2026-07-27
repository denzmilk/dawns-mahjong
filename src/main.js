import './style.css';
import { Game } from './core/Game.js';
import { LAYOUT_DEFAULT } from './core/Constants.js';
import { LAYOUT_IDS } from './board/Layouts.js';

const container = document.getElementById('game-container');

// ?layout= and ?seed= are development and test affordances only. Dawn picks her
// board from the front screen (milestone 04); she never sees a URL. The seed makes
// a board reproducible, which is how a reported problem gets investigated.
const params = new URLSearchParams(window.location.search);
const requested = params.get('layout');
const layoutId = LAYOUT_IDS.includes(requested) ? requested : LAYOUT_DEFAULT;
const seed = params.has('seed') ? Number(params.get('seed')) : null;

const game = new Game(container, { layoutId, seed: Number.isFinite(seed) ? seed : null });

suppressUnwantedGestures();
installTestHooks(game);

// Fonts settle before anything measures text, so tests never race the layout.
Promise.resolve(document.fonts ? document.fonts.ready : null).then(() => {
  game.requestRender();
  requestAnimationFrame(() => {
    window.__ready = true;
  });
});

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

function installTestHooks(game) {
  window.render_game_to_text = () => game.snapshot();
  window.advanceTime = (seconds) => game.advanceTime(seconds);

  window.__debug = {
    game,

    pickAt: (x, y) => game.pickAt(x, y),

    // The player-facing buttons for these arrive in milestone 04; until then this
    // is how the assists get exercised.
    hint: () => game.hint(),
    shuffle: () => game.shuffle(),
    newBoard: (options) => game.newBoard(options),
    tap: (x, y) => game.handleTap(x, y),

    /**
     * Loads an arbitrary board, bypassing generation. Tests use it to set up
     * positions that are hard to reach by playing — a stuck board, most of all,
     * which cannot be generated on purpose because generation guarantees the
     * opposite.
     */
    loadFixture(tiles, { layoutId = 'easy-72', assists = null } = {}) {
      const withIds = tiles.map((t, i) => ({ id: i, cleared: false, ...t }));
      game.buildBoard(layoutId, withIds);
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
