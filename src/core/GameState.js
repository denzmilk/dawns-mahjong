import { ASSISTS, LAYOUT_DEFAULT } from './Constants.js';

// One centralized state object. Systems read from it; events mutate it. reset()
// exists so starting a fresh board can never leak state from the last one.

class GameState {
  constructor() {
    this.reset();
  }

  reset(layoutId = LAYOUT_DEFAULT) {
    this.screen = 'board'; // board | won | no-moves (greeting lands in milestone 04)
    this.layoutId = layoutId;
    this.seed = null;
    /**
     * One entry per tile: { id, x, y, layer, face, cleared }.
     * x/y are half-tile lattice coordinates — see src/board/Layouts.js.
     */
    this.tiles = [];
    this.selectedId = null;
    /** Held briefly so a wrong pair is visible before it releases. */
    this.mismatchPair = null;
    /** The pair a hint is currently pointing at. */
    this.hintPair = null;
    this.hintsLeft = ASSISTS.hints;
    this.shufflesLeft = ASSISTS.shuffles;
    /** No legal move available. Only a loss once the reshuffles are gone too. */
    this.stuck = false;
    this.elapsed = 0;
  }

  get remaining() {
    return this.tiles.filter((t) => !t.cleared).length;
  }

  get clearedCount() {
    return this.tiles.filter((t) => t.cleared).length;
  }

  tileById(id) {
    return this.tiles.find((t) => t.id === id) || null;
  }
}

export const gameState = new GameState();
