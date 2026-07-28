import { LAYOUTS, LAYOUT_IDS } from '../board/Layouts.js';
import { SURPRISE } from '../core/Constants.js';

// The surprise board has no fixed tile list — it is generated per game — so the menu
// needs a stand-in to label its button with.
const SURPRISE_BOARD = { id: SURPRISE.id, name: 'Surprise', tiles: { length: SURPRISE.tiles } };
import { Events, eventBus } from '../core/EventBus.js';
import { TIMING } from '../core/Constants.js';
import { gameState } from '../core/GameState.js';
import { borderBackgroundCss } from '../assets/TileSheet.js';

// The whole HTML overlay: greeting, in-game bar, win screen, no-moves screen.
//
// It only ever *asks* — every button emits a ui:* event and the game decides what to
// do (see EventBus). That keeps the DOM and the 3D scene from importing each other,
// and it means a button can never leave the board and the overlay disagreeing about
// what state the game is in.

const ELVIS_PORTRAITS = [
  'publicity-1956.jpg',
  'love-me-tender-1956.jpg',
  'jailhouse-rock.jpg',
  'colour-1970.jpg',
  'young-elvis.jpg',
  'harley-1956.jpg',
];

export class Ui {
  constructor({ playerName = 'Dawn' } = {}) {
    this.playerName = playerName;
    this.chosenLayout = gameState.layoutId;
    this.settleTimers = new Map();
    this.el = {
      frame: document.querySelectorAll('.frame-edge'),
      hud: document.getElementById('hud'),
      tilesLeft: document.getElementById('tiles-left-count'),
      hint: document.getElementById('btn-hint'),
      hintCount: document.getElementById('hint-count'),
      shuffle: document.getElementById('btn-shuffle'),
      shuffleCount: document.getElementById('shuffle-count'),
      sound: document.getElementById('btn-sound'),
      soundIcon: document.getElementById('sound-icon'),
      magnifier: document.getElementById('btn-magnifier'),
      home: document.getElementById('btn-home'),
      legendButton: document.getElementById('btn-legend'),
      legend: document.getElementById('legend'),
      legendClose: document.getElementById('btn-legend-close'),
      legendPair: document.getElementById('legend-pair'),
      legendElvis: document.getElementById('legend-elvis'),
      legendFree: document.getElementById('legend-free'),
      nudge: document.getElementById('stuck-nudge'),

      greeting: document.getElementById('greeting'),
      greetingLine: document.getElementById('greeting-line'),
      greetingSub: document.getElementById('greeting-sub'),
      hero: document.getElementById('greeting-hero'),
      resume: document.getElementById('btn-resume'),
      play: document.getElementById('btn-play'),
      boardButtons: document.getElementById('board-buttons'),
      boardsDone: document.getElementById('boards-done'),

      won: document.getElementById('won'),
      wonSub: document.getElementById('won-sub'),
      wonPortrait: document.getElementById('won-portrait'),
      playAgain: document.getElementById('btn-play-again'),
      wonHome: document.getElementById('btn-won-home'),

      noMoves: document.getElementById('no-moves'),
      stuckPortrait: document.getElementById('stuck-portrait'),
      freshBoard: document.getElementById('btn-fresh-board'),
      stuckHome: document.getElementById('btn-stuck-home'),
    };

    this.applyFrame();
    this.buildBoardChoices();
    this.setGreeting();
    this.wireButtons();
    this.subscribe();
    this.setLayoutChoice(this.chosenLayout);
  }

  /**
   * The gold Greek-key frame, cropped live out of the tile sheet.
   *
   * The whole sheet is scaled so that its border strip is exactly as wide as the
   * frame, then offset so the strip is what shows through. Done in pixels from the
   * edge's own measured thickness — a percentage background-size scales against the
   * element's length instead, which blew the pattern up to nothing.
   */
  applyFrame() {
    const border = borderBackgroundCss();
    document.documentElement.style.setProperty('--frame-image', `url("${border.url}")`);
    this.frameBorder = border;
    this.layoutFrame();
    window.addEventListener('resize', () => this.layoutFrame());
  }

  layoutFrame() {
    const border = this.frameBorder;
    if (!border) return;
    const top = document.querySelector('.frame-top');
    const thickness = top ? top.offsetHeight : 16;
    if (!thickness) return;

    for (const edge of this.el.frame) {
      const vertical = edge.classList.contains('frame-left') || edge.classList.contains('frame-right');
      // The sheet's border is symmetric, so the horizontal run of it is the vertical
      // strip's rectangle with its axes swapped.
      const cell = vertical
        ? { x: border.offsetX, y: border.offsetY, thicknessPx: border.width }
        : { x: border.offsetY, y: border.offsetX, thicknessPx: border.width };
      const scale = thickness / cell.thicknessPx;
      edge.style.backgroundSize = `${border.sheetWidth * scale}px ${border.sheetHeight * scale}px`;
      edge.style.backgroundPosition = `${cell.x * scale}px ${cell.y * scale}px`;
      edge.style.backgroundRepeat = vertical ? 'repeat-y' : 'repeat-x';
    }
  }

  /**
   * One button per board, built from LAYOUTS so adding a shape to that file is all it
   * takes. The tile count leads because that is what tells her how long a game will
   * take; the shape name is a hint for someone who already knows these boards.
   */
  buildBoardChoices() {
    this.el.boardButtons.replaceChildren();
    // Smallest board first: tile size is what she cares about, and the count is the label,
    // so the menu should read in order rather than in the order the file happens to define.
    const ordered = [...LAYOUT_IDS].sort((a, b) => {
      const size = (id) => (LAYOUTS[id] ? LAYOUTS[id].tiles.length : SURPRISE.tiles);
      return size(a) - size(b) || a.localeCompare(b);
    });
    for (const id of ordered) {
      const layout = LAYOUTS[id] || SURPRISE_BOARD;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice-button';
      button.dataset.layout = id;
      const count = document.createElement('span');
      count.className = 'choice-count';
      count.textContent = String(layout.tiles.length);
      const name = document.createElement('span');
      name.className = 'choice-name';
      name.textContent = layout.id === 'easy-72' ? 'tiles · easy' : `tiles · ${layout.name.toLowerCase()}`;
      const tick = document.createElement('span');
      tick.className = 'choice-tick hidden';
      tick.textContent = '✓';
      button.append(tick, count, name);
      this.el.boardButtons.append(button);
    }
    this.el.choices = this.el.boardButtons.querySelectorAll('.choice-button');
  }

  /**
   * Fills the how-to-play pictures from the real tile atlas, so the legend can never
   * drift from what the board actually looks like.
   */
  buildLegendArt(atlasCanvas, faceCell) {
    if (!atlasCanvas) return;
    const draw = (host, faces, dim = []) => {
      if (!host) return;
      host.replaceChildren();
      faces.forEach((face, i) => {
        const cell = faceCell(face);
        if (!cell) return;
        const canvas = document.createElement('canvas');
        canvas.width = cell.w;
        canvas.height = cell.h;
        canvas.getContext('2d').drawImage(atlasCanvas, cell.x, cell.y, cell.w, cell.h, 0, 0, cell.w, cell.h);
        if (dim.includes(i)) canvas.classList.add('is-dim');
        host.append(canvas);
      });
    };
    draw(this.el.legendPair, ['dragon-red', 'dragon-red']);
    draw(this.el.legendElvis, ['elvis-1', 'elvis-4']);
    // The third row shows the difference itself: one bright, one knocked back.
    draw(this.el.legendFree, ['bamboo-3', 'bamboo-7'], [1]);
  }

  /** "Good morning, Dawn" — from the tablet's own clock. */
  setGreeting(now = new Date()) {
    const hour = now.getHours();
    const partOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    this.el.greetingLine.textContent = `Good ${partOfDay}, ${this.playerName}`;
    this.el.greetingSub.textContent =
      partOfDay === 'evening' ? 'Time for a quiet game?' : 'Fancy a game of mahjong?';

    this.el.hero.src = portraitUrl('greeting-hero.jpg');
    // A different Elvis each time she finishes a board, so the win screen doesn't
    // become wallpaper either.
    this.el.wonPortrait.src = portraitUrl(pickPortrait(0));
    this.el.stuckPortrait.src = portraitUrl(pickPortrait(1));
  }

  wireButtons() {
    this.el.play.addEventListener('click', () =>
      eventBus.emit(Events.UI_START_BOARD, { layoutId: this.chosenLayout })
    );
    this.el.resume.addEventListener('click', () => eventBus.emit(Events.UI_RESUME, {}));
    this.el.hint.addEventListener('click', () => eventBus.emit(Events.UI_HINT, {}));
    this.el.shuffle.addEventListener('click', () => eventBus.emit(Events.UI_SHUFFLE, {}));
    this.el.sound.addEventListener('click', () => eventBus.emit(Events.UI_SOUND_TOGGLED, {}));
    this.el.magnifier.addEventListener('click', () => eventBus.emit(Events.UI_MAGNIFIER_TOGGLED, {}));
    this.el.home.addEventListener('click', () => eventBus.emit(Events.UI_HOME, {}));
    this.el.playAgain.addEventListener('click', () =>
      eventBus.emit(Events.UI_START_BOARD, { layoutId: gameState.layoutId })
    );
    this.el.freshBoard.addEventListener('click', () =>
      eventBus.emit(Events.UI_START_BOARD, { layoutId: gameState.layoutId })
    );
    this.el.wonHome.addEventListener('click', () => eventBus.emit(Events.UI_HOME, {}));
    this.el.stuckHome.addEventListener('click', () => eventBus.emit(Events.UI_HOME, {}));

    for (const button of this.el.choices) {
      button.addEventListener('click', () => this.setLayoutChoice(button.dataset.layout));
    }

    // How to play: one way in, one way out. It sits over the board rather than
    // replacing it, so pressing Back always returns her to the game she was playing.
    this.el.legendButton.addEventListener('click', () => this.setLegendOpen(true));
    this.el.legendClose.addEventListener('click', () => this.setLegendOpen(false));
  }

  setLegendOpen(open) {
    this.el.legend.classList.toggle('hidden', !open);
    // The bar stays out of the way while it is up: nothing behind it is tappable.
    this.el.hud.classList.toggle('hidden', open);
  }

  setLayoutChoice(layoutId) {
    // Validated against LAYOUT_IDS, not LAYOUTS: the surprise board has no entry in
    // LAYOUTS because it is generated per game, and checking the wrong list silently
    // fell back to the easy board every time she picked it.
    this.chosenLayout = LAYOUT_IDS.includes(layoutId) ? layoutId : 'easy-72';
    for (const button of this.el.choices) {
      button.setAttribute('aria-pressed', String(button.dataset.layout === this.chosenLayout));
    }
    eventBus.emit(Events.UI_LAYOUT_CHOSEN, { layoutId: this.chosenLayout });
  }

  subscribe() {
    eventBus.on(Events.SCREEN_CHANGED, ({ screen }) => this.showScreen(screen));
    eventBus.on(Events.PAIR_MATCHED, () => this.refreshHud());
    eventBus.on(Events.ASSIST_HINT, () => this.refreshHud());
    eventBus.on(Events.ASSIST_SHUFFLE, () => this.refreshHud());
    eventBus.on(Events.BOARD_GENERATED, () => this.refreshHud());
    eventBus.on(Events.AUDIO_MUTE_TOGGLED, ({ muted }) => {
      this.el.soundIcon.textContent = muted ? '🔇' : '🔊';
    });
    eventBus.on(Events.MAGNIFIER_TOGGLED, ({ on }) => this.setMagnifierOn(on));
  }

  /** Lights the magnifier button while the glass is out, so its state is never a guess. */
  setMagnifierOn(on) {
    this.el.magnifier.setAttribute('aria-pressed', String(Boolean(on)));
  }

  /**
   * Shows or hides one element, and — when it has just appeared — makes it ignore taps for
   * a moment (TIMING.screenSettle). The tap that put the screen up must not go on to press
   * a button on it.
   */
  reveal(el, visible) {
    const appearing = visible && el.classList.contains('hidden');
    el.classList.toggle('hidden', !visible);
    if (!appearing) return;
    el.classList.add('is-settling');
    clearTimeout(this.settleTimers.get(el));
    this.settleTimers.set(
      el,
      setTimeout(() => el.classList.remove('is-settling'), TIMING.screenSettle * 1000)
    );
  }

  /** One screen visible at a time; the in-game bar only during play. */
  showScreen(screen) {
    // Any screen change closes the legend, so it can never be left hanging over a
    // greeting or a win screen.
    if (screen !== 'board') this.el.legend.classList.add('hidden');
    this.reveal(this.el.greeting, screen === 'greeting');
    this.reveal(this.el.won, screen === 'won');
    this.reveal(this.el.noMoves, screen === 'no-moves');
    this.reveal(this.el.hud, screen === 'board');
    if (screen !== 'board') this.el.nudge.classList.add('hidden');
    if (screen === 'board') this.refreshHud();
    if (screen === 'won') {
      this.el.wonPortrait.src = portraitUrl(pickPortrait(gameState.boardsCompleted || 0));
      const layout = LAYOUTS[gameState.layoutId];
      this.el.wonSub.textContent = `You cleared the whole ${layout ? layout.name.toLowerCase() : ''} board.`;
    }
  }

  refreshHud() {
    this.el.tilesLeft.textContent = String(gameState.remaining);
    this.el.hintCount.textContent = String(gameState.hintsLeft);
    this.el.shuffleCount.textContent = String(gameState.shufflesLeft);
    this.el.hint.disabled = gameState.hintsLeft === 0;
    this.el.shuffle.disabled = gameState.shufflesLeft === 0;
    // Only nudge when she is actually stuck and a mix would rescue her.
    const rescueable = gameState.stuck && gameState.shufflesLeft > 0;
    this.el.nudge.classList.toggle('hidden', !rescueable);
  }

  /** Shows or hides the "carry on" button depending on whether a save exists. */
  setResumeAvailable(available, description = '') {
    this.el.resume.classList.toggle('hidden', !available);
    if (available && description) this.el.resume.textContent = description;
  }

  /** A green tick on every board she has finished at least once. */
  setCompletedBoards(completedByBoard = {}) {
    for (const button of this.el.choices) {
      const times = Number(completedByBoard[button.dataset.layout]) || 0;
      const tick = button.querySelector('.choice-tick');
      if (!tick) continue;
      tick.classList.toggle('hidden', times === 0);
      tick.textContent = times > 1 ? `✓${times}` : '✓';
      button.classList.toggle('is-completed', times > 0);
    }
  }

  setBoardsCompleted(count) {
    const hasAny = count > 0;
    this.el.boardsDone.classList.toggle('hidden', !hasAny);
    if (hasAny) {
      this.el.boardsDone.textContent =
        count === 1 ? 'You have finished 1 board.' : `You have finished ${count} boards.`;
    }
  }

  /**
   * Chris removed the install button from the greeting (2026-07-27): one less thing on
   * the front screen. Installing still works from the browser's own menu, and the
   * service worker still caches everything for offline play — these remain so
   * InstallSystem has something to talk to if a button ever comes back.
   */
  setInstallAvailable() {}

  showInstallHelp() {}

  setMuted(muted) {
    this.el.soundIcon.textContent = muted ? '🔇' : '🔊';
  }
}

const portraitUrl = (file) => new URL(`assets/elvis/${file}`, document.baseURI).href;

const pickPortrait = (n) => ELVIS_PORTRAITS[Math.abs(n) % ELVIS_PORTRAITS.length];
