import { ASSISTS, LAYOUT_DEFAULT } from './Constants.js';

// One centralized state object. Systems read from it; events mutate it. reset()
// exists so starting a fresh board can never leak state from the last one.

class GameState {
  constructor() {
    this.reset();
  }

  reset(layoutId = LAYOUT_DEFAULT) {
    this.screen = 'board'; // greeting | board | won | no-moves (screens land in milestone 04)
    this.layoutId = layoutId;
    /**
     * One entry per tile: { id, x, y, layer, face, cleared }.
     * x/y are half-tile lattice coordinates — see src/board/Layouts.js.
     */
    this.tiles = [];
    this.selectedId = null;
    this.hintsLeft = ASSISTS.hints;
    this.shufflesLeft = ASSISTS.shuffles;
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
