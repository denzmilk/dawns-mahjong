import { LAYOUTS } from '../board/Layouts.js';
import { Events, eventBus } from '../core/EventBus.js';
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
      home: document.getElementById('btn-home'),
      nudge: document.getElementById('stuck-nudge'),

      greeting: document.getElementById('greeting'),
      greetingLine: document.getElementById('greeting-line'),
      greetingSub: document.getElementById('greeting-sub'),
      hero: document.getElementById('greeting-hero'),
      resume: document.getElementById('btn-resume'),
      play: document.getElementById('btn-play'),
      choices: document.querySelectorAll('.choice-button'),
      install: document.getElementById('btn-install'),
      installHelp: document.getElementById('install-help'),
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
    this.el.home.addEventListener('click', () => eventBus.emit(Events.UI_HOME, {}));
    this.el.playAgain.addEventListener('click', () =>
      eventBus.emit(Events.UI_START_BOARD, { layoutId: gameState.layoutId })
    );
    this.el.freshBoard.addEventListener('click', () =>
      eventBus.emit(Events.UI_START_BOARD, { layoutId: gameState.layoutId })
    );
    this.el.wonHome.addEventListener('click', () => eventBus.emit(Events.UI_HOME, {}));
    this.el.stuckHome.addEventListener('click', () => eventBus.emit(Events.UI_HOME, {}));
    this.el.install.addEventListener('click', () => eventBus.emit(Events.UI_INSTALL, {}));

    for (const button of this.el.choices) {
      button.addEventListener('click', () => this.setLayoutChoice(button.dataset.layout));
    }
  }

  setLayoutChoice(layoutId) {
    this.chosenLayout = LAYOUTS[layoutId] ? layoutId : 'easy-72';
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
  }

  /** One screen visible at a time; the in-game bar only during play. */
  showScreen(screen) {
    this.el.greeting.classList.toggle('hidden', screen !== 'greeting');
    this.el.won.classList.toggle('hidden', screen !== 'won');
    this.el.noMoves.classList.toggle('hidden', screen !== 'no-moves');
    this.el.hud.classList.toggle('hidden', screen !== 'board');
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

  setBoardsCompleted(count) {
    const hasAny = count > 0;
    this.el.boardsDone.classList.toggle('hidden', !hasAny);
    if (hasAny) {
      this.el.boardsDone.textContent =
        count === 1 ? 'You have finished 1 board.' : `You have finished ${count} boards.`;
    }
  }

  setInstallAvailable(available) {
    this.el.install.classList.toggle('hidden', !available);
  }

  showInstallHelp() {
    this.el.installHelp.classList.remove('hidden');
  }

  setMuted(muted) {
    this.el.soundIcon.textContent = muted ? '🔇' : '🔊';
  }
}

const portraitUrl = (file) => new URL(`assets/elvis/${file}`, document.baseURI).href;

const pickPortrait = (n) => ELVIS_PORTRAITS[Math.abs(n) % ELVIS_PORTRAITS.length];
