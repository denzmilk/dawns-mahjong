class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  once(event, callback) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      callback(...args);
    };
    this.on(event, wrapper);
  }

  off(event, callback) {
    const cbs = this.listeners.get(event);
    if (cbs) {
      cbs.delete(callback);
      if (cbs.size === 0) this.listeners.delete(event);
    }
  }

  emit(event, data) {
    const cbs = this.listeners.get(event);
    if (cbs) cbs.forEach(cb => {
      try { cb(data); } catch (e) { console.error(`EventBus error [${event}]:`, e); }
    });
  }

  clear(event) {
    event ? this.listeners.delete(event) : this.listeners.clear();
  }
}

export const eventBus = new EventBus();

// Define ALL events as constants — use domain:action naming
export const Events = {
  // board:*
  BOARD_GENERATED: 'board:generated',
  BOARD_CLEARED: 'board:cleared',
  BOARD_RESHUFFLED: 'board:reshuffled',
  // tile:*
  TILE_SELECTED: 'tile:selected',
  TILE_DESELECTED: 'tile:deselected',
  // pair:*
  PAIR_MATCHED: 'pair:matched',
  PAIR_MISMATCHED: 'pair:mismatched',
  // assist:*
  ASSIST_HINT: 'assist:hint',
  ASSIST_SHUFFLE: 'assist:shuffle',
  ASSIST_EXHAUSTED: 'assist:exhausted',
  // game:*
  GAME_START: 'game:start',
  GAME_NO_MOVES: 'game:no-moves',
  GAME_RESTART: 'game:restart',
  // view:*
  VIEW_RESIZED: 'view:resized',
  VIEW_RENDER_REQUESTED: 'view:render-requested',
  // audio:* (milestone 06)
  AUDIO_MUTE_TOGGLED: 'audio:mute-toggled',
  // save:* (milestone 07)
  SAVE_WRITTEN: 'save:written',
  SAVE_RESUMED: 'save:resumed',
};
