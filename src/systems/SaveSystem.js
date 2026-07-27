import { SAVE } from '../core/Constants.js';
import { Events, eventBus } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';

// Progress is written after every move, because the whole point is that she can put
// the tablet down mid-game — mid-*pair*, even — and pick it up days later exactly
// where she left it.
//
// Everything about reading is defensive: a corrupt or older save must degrade to "no
// save" rather than throwing, because a crash on boot would leave her with a game
// that simply never opens and no way to clear it.

export class SaveSystem {
  constructor(storage = safeStorage()) {
    this.storage = storage;
    this.data = this.read();
  }

  read() {
    const fallback = { version: SAVE.version, board: null, settings: {}, stats: {} };
    if (!this.storage) return fallback;
    try {
      const raw = this.storage.getItem(SAVE.key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== SAVE.version) {
        // A save from an older shape is discarded rather than migrated: there is one
        // player and one device, and guessing at an old format risks dealing her a
        // broken board.
        return fallback;
      }
      return {
        version: SAVE.version,
        board: validBoard(parsed.board) ? parsed.board : null,
        settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {},
        stats: parsed.stats && typeof parsed.stats === 'object' ? parsed.stats : {},
      };
    } catch {
      return fallback;
    }
  }

  write() {
    if (!this.storage) return;
    try {
      this.storage.setItem(SAVE.key, JSON.stringify(this.data));
      eventBus.emit(Events.SAVE_WRITTEN, {});
    } catch {
      // Storage full or blocked (private browsing). Losing the save is a nuisance;
      // crashing mid-game is not acceptable.
    }
  }

  // --- the board in progress ---------------------------------------------

  get savedBoard() {
    return this.data.board;
  }

  /** Is there a game worth offering to carry on with? */
  get hasResumableBoard() {
    const board = this.data.board;
    if (!board) return false;
    const left = board.tiles.filter((t) => !t.cleared).length;
    return left > 0 && left < board.tiles.length;
  }

  saveBoard() {
    // Only mid-game boards are worth keeping: a finished or untouched one has
    // nothing to carry on with.
    if (gameState.screen === 'won' || gameState.screen === 'no-moves') {
      this.data.board = null;
    } else {
      this.data.board = {
        layoutId: gameState.layoutId,
        seed: gameState.seed,
        hintsLeft: gameState.hintsLeft,
        shufflesLeft: gameState.shufflesLeft,
        // Positions come from the layout; only the faces and what has gone need
        // storing, which keeps the save small and readable.
        tiles: gameState.tiles.map((t) => ({
          id: t.id,
          x: t.x,
          y: t.y,
          layer: t.layer,
          face: t.face,
          cleared: t.cleared,
        })),
      };
    }
    this.write();
  }

  clearBoard() {
    this.data.board = null;
    this.write();
  }

  // --- settings and stats -------------------------------------------------

  get muted() {
    return this.data.settings.muted === true;
  }

  setMuted(muted) {
    this.data.settings.muted = Boolean(muted);
    this.write();
  }

  get preferredLayout() {
    return this.data.settings.layoutId || null;
  }

  setPreferredLayout(layoutId) {
    this.data.settings.layoutId = layoutId;
    this.write();
  }

  get boardsCompleted() {
    const value = Number(this.data.stats.boardsCompleted);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }

  /** How many times she has finished each board, keyed by layout id. */
  get completedByBoard() {
    const raw = this.data.stats.completedByBoard;
    return raw && typeof raw === 'object' ? raw : {};
  }

  completedCount(layoutId) {
    const value = Number(this.completedByBoard[layoutId]);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }

  recordBoardCompleted(layoutId = null) {
    this.data.stats.boardsCompleted = this.boardsCompleted + 1;
    if (layoutId) {
      const byBoard = { ...this.completedByBoard };
      byBoard[layoutId] = this.completedCount(layoutId) + 1;
      this.data.stats.completedByBoard = byBoard;
    }
    this.data.board = null;
    this.write();
    return this.data.stats.boardsCompleted;
  }
}

/** A tile list that could plausibly be dealt back onto a board. */
function validBoard(board) {
  if (!board || !Array.isArray(board.tiles) || board.tiles.length < 2) return false;
  if (board.tiles.length % 2 !== 0) return false;
  return board.tiles.every(
    (t) =>
      Number.isFinite(t.id) &&
      Number.isFinite(t.x) &&
      Number.isFinite(t.y) &&
      Number.isFinite(t.layer) &&
      typeof t.face === 'string'
  );
}

/** localStorage can throw on access alone in some privacy modes. */
function safeStorage() {
  try {
    const probe = '__dawns_mahjong_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}
