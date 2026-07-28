import { AUDIO } from '../core/Constants.js';
import { Events, eventBus } from '../core/EventBus.js';

// Every sound in the game is synthesised here. No audio files: nothing to load,
// nothing to fail offline, and no Elvis recordings — the board-clear lick is an
// original rockabilly turnaround rather than a transcription of anything.
//
// The context is created on her first tap, because browsers refuse to start audio
// before a gesture and a blocked context that silently never recovers is worse than
// no sound at all.

export class AudioSystem {
  constructor({ muted = false } = {}) {
    this.muted = muted;
    this.ctx = null;
    this.master = null;
    this.subscribe();
  }

  ensureContext() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    this.ctx = new Context();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : AUDIO.masterVolume;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : AUDIO.masterVolume, this.ctx.currentTime, 0.02);
    }
    eventBus.emit(Events.AUDIO_MUTE_TOGGLED, { muted });
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    // Confirm unmuting with a sound — silence would be an ambiguous answer.
    if (!this.muted) this.chime(1);
    return this.muted;
  }

  subscribe() {
    eventBus.on(Events.TILE_SELECTED, () => this.click());
    eventBus.on(Events.TILE_DESELECTED, () => this.click(0.7));
    eventBus.on(Events.PAIR_MATCHED, ({ remaining }) => {
      const total = Math.max(1, remaining + 2);
      this.chime(1 - remaining / (total + remaining));
    });
    eventBus.on(Events.PAIR_MISMATCHED, () => this.thud());
    eventBus.on(Events.ASSIST_HINT, () => this.sparkle());
    eventBus.on(Events.ASSIST_SHUFFLE, () => this.riffle());
    eventBus.on(Events.BOARD_CLEARED, () => this.lick());
    eventBus.on(Events.GAME_NO_MOVES, () => this.sigh());
    eventBus.on(Events.FX_CELEBRATION, ({ name, escalated }) => {
      // The riff belongs to the dancing Elvis, so it fires instead of the escalation
      // sparkle rather than on top of it — two flourishes at once is noise.
      if (name === 'elvis-spotlight') this.riff();
      else if (escalated) this.sparkle(1.4);
    });
  }

  /** A short noise+sine transient: a mahjong tile set down on a table. */
  click(strength = 1) {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer();
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1800;
    bandpass.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5 * strength, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    noise.connect(bandpass).connect(gain).connect(this.master);
    noise.start(now);
    noise.stop(now + 0.1);

    // A little wooden body under the click.
    this.tone({ freq: 320, type: 'sine', attack: 0.002, decay: 0.12, gain: 0.16 * strength });
  }

  /**
   * The match chime. `progress` (0 → 1) walks the pair up a pentatonic scale as the
   * board empties, so the game quietly sounds like it is getting somewhere.
   */
  chime(progress = 0) {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    const scale = AUDIO.chimeScale;
    const index = Math.min(scale.length - 1, Math.floor(progress * scale.length));
    const root = scale[Math.max(0, index)];
    this.tone({ freq: root, type: 'triangle', attack: 0.004, decay: 0.5, gain: 0.22 });
    this.tone({ freq: root * 1.5, type: 'sine', attack: 0.004, decay: 0.42, gain: 0.14, delay: 0.075 });
  }

  /** Quiet, low, and short. Never a buzzer — a wrong pair costs nothing. */
  thud() {
    this.tone({ freq: 150, type: 'sine', attack: 0.004, decay: 0.22, gain: 0.22, bend: 0.6 });
  }

  sparkle(strength = 1) {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    [1568, 2093, 2637].forEach((freq, i) => {
      this.tone({
        freq,
        type: 'sine',
        attack: 0.003,
        decay: 0.3,
        gain: 0.09 * strength,
        delay: i * 0.055,
      });
    });
  }

  /** Tiles being pushed around the table. */
  riffle() {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    for (let i = 0; i < 9; i++) this.click(0.35 + Math.random() * 0.2), (this.riffleDelay = i);
  }

  /**
   * The guitar riff the dancing Elvis comes on to. Four notes up a blues scale with the
   * last one bent, over a sawtooth through a lowpass — which is as close to an electric
   * guitar as one oscillator gets, and closer than a clean tone would be.
   *
   * Original, like everything else here: no recordings and no borrowed melodies anywhere
   * in this game (docs/tech.md → Licensing).
   */
  riff() {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;

    AUDIO.riff.forEach(([freq, at, length], index) => {
      const last = index === AUDIO.riff.length - 1;
      this.tone({
        freq,
        type: 'sawtooth',
        attack: 0.005,
        decay: length,
        gain: 0.15,
        delay: at,
        // Only the last note bends — a bend on every note is a siren, not a guitar.
        bend: last ? AUDIO.riffBend : 1,
        filter: 2200,
      });
      // An octave below, quieter, for body.
      this.tone({
        freq: freq / 2,
        type: 'square',
        attack: 0.006,
        decay: length * 0.9,
        gain: 0.05,
        delay: at,
        bend: last ? AUDIO.riffBend : 1,
        filter: 1200,
      });
    });
  }

  /**
   * Board clear: an original rockabilly turnaround. Deliberately not a transcription
   * of an Elvis song — no recordings and no melodies are borrowed anywhere in this
   * game (docs/tech.md → Licensing).
   */
  lick() {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    AUDIO.lick.forEach(([freq, at, length]) => {
      this.tone({
        freq,
        type: 'triangle',
        attack: 0.006,
        decay: length,
        gain: 0.2,
        delay: at,
      });
      // A fifth below fattens it into something with a bit of swagger.
      this.tone({
        freq: freq / 2,
        type: 'sawtooth',
        attack: 0.008,
        decay: length * 0.8,
        gain: 0.06,
        delay: at,
      });
    });
  }

  /** Gentle, not a failure buzzer: bad luck rather than "you lose". */
  sigh() {
    this.tone({ freq: 392, type: 'sine', attack: 0.02, decay: 0.5, gain: 0.16, bend: 0.75 });
    this.tone({ freq: 294, type: 'sine', attack: 0.03, decay: 0.7, gain: 0.14, delay: 0.18 });
  }

  /**
   * One oscillator with an envelope. Every sound above is built from these.
   *
   * `filter` rolls the top off a harsh waveform: a raw sawtooth at tablet volume is
   * unpleasant, and ADR-0002 says nothing may startle her.
   */
  tone({
    freq,
    type = 'sine',
    attack = 0.005,
    decay = 0.3,
    gain = 0.2,
    delay = 0,
    bend = 1,
    filter = 0,
  }) {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    const start = ctx.currentTime + delay;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (bend !== 1) osc.frequency.exponentialRampToValueAtTime(freq * bend, start + decay);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);

    let node = osc;
    if (filter) {
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = filter;
      lowpass.Q.value = 0.8;
      node = osc.connect(lowpass);
    }
    node.connect(env).connect(this.master);
    osc.start(start);
    osc.stop(start + attack + decay + 0.02);
  }

  noiseBuffer() {
    if (this.noise) return this.noise;
    const ctx = this.ensureContext();
    const length = Math.floor(ctx.sampleRate * 0.12);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    this.noise = buffer;
    return buffer;
  }
}
