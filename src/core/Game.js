import * as THREE from 'three';
import {
  ASSISTS,
  CAMERA,
  CELEBRATION,
  COLORS,
  ENTRANCE,
  FACES,
  INPUT,
  LIGHTING,
  PARTICLES,
  RENDER,
  SELECTION,
  TABLE,
  TILE,
  TIME,
  TIMING,
} from './Constants.js';
import { Events, eventBus } from './EventBus.js';
import { gameState } from './GameState.js';
import { mulberry32, randomSeed } from './Rng.js';
import { getLayout } from '../board/Layouts.js';
import { generateBoard, shuffleRemaining } from '../board/BoardGenerator.js';
import { availablePairs, buildIndex, isFree, matches } from '../board/BoardRules.js';
import {
  buildPlaceholderAtlas,
  createAtlasTexture,
  createTileGeometry,
  createTileMaterial,
  latticeToWorld,
  setTileBrightness,
  setTileFace,
} from '../board/TileMeshes.js';
import { CameraSystem } from '../systems/CameraSystem.js';
import { InputSystem } from '../systems/InputSystem.js';
import { Particles } from '../fx/Particles.js';
import { buildShards, buildSpotlight, pickCelebration } from '../fx/Celebrations.js';

export class Game {
  constructor(container, { layoutId, seed, atlasCanvas = null } = {}) {
    this.container = container;
    this.tileMeshes = [];
    this.meshById = new Map();
    this.freeIds = new Set();
    this.index = null;
    this.pairCount = 0;
    this.mismatchHold = 0;
    this.hintHold = 0;
    this.pulseClock = 0;
    this.entranceClock = null;
    this.celebrations = [];
    this.lastCelebration = null;
    this.matchesThisBoard = 0;
    this.finaleClock = null;
    this.renderCount = 0;
    this.dirty = true;
    this.manualTime = false;
    this.lastFrameAt = null;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.renderer = new THREE.WebGLRenderer({ antialias: RENDER.antialias });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDER.maxPixelRatio));
    this.renderer.shadowMap.enabled = true;
    // PCFSoftShadowMap is deprecated in three r185 and falls back to PCF anyway.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // Shadows are re-rendered only when the board actually changes, not on every
    // animated frame. With 144 casters, re-shadowing per frame dominated the frame
    // cost — and the board is static for all but a second at a time, so almost every
    // one of those re-renders was identical to the last.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.background);

    this.cameraSystem = new CameraSystem();
    this.camera = this.cameraSystem.camera;

    // The real sheet is loaded before the game is constructed (see main.js). The
    // placeholder atlas is the fallback if that ever fails, so a missing sheet
    // degrades to an ugly-but-playable board rather than a blank screen.
    this.atlasTexture = createAtlasTexture(atlasCanvas || buildPlaceholderAtlas());
    this.tileMaterial = createTileMaterial(this.atlasTexture);

    this.buildLights();
    this.buildTable();
    this.buildSelectionMarkers();
    this.particles = new Particles(this.scene);
    this.spotlight = buildSpotlight();
    this.scene.add(this.spotlight);
    this.loadLayout(layoutId || gameState.layoutId, { seed });

    this.input = new InputSystem(this.renderer.domElement, (x, y) => this.handleTap(x, y));
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
    this.tick = this.tick.bind(this);
    requestAnimationFrame(this.tick);
  }

  buildLights() {
    this.scene.add(new THREE.AmbientLight(LIGHTING.ambient, LIGHTING.ambientIntensity));

    this.key = new THREE.DirectionalLight(LIGHTING.key, LIGHTING.keyIntensity);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(RENDER.shadowMapSize, RENDER.shadowMapSize);
    // Shadow acne on tile faces reads as dirt on the artwork, which matters more
    // here than anywhere else — every face has to stay clean and legible.
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.02;
    this.scene.add(this.key);
    this.scene.add(this.key.target);

    this.fill = new THREE.DirectionalLight(LIGHTING.fill, LIGHTING.fillIntensity);
    this.scene.add(this.fill);
  }

  /** Lights follow the board centre so every layout is lit and shadowed alike. */
  positionLights(centre) {
    this.key.position.set(
      centre.x + LIGHTING.keyOffset.x,
      centre.y + LIGHTING.keyOffset.y,
      centre.z + LIGHTING.keyOffset.z
    );
    this.key.target.position.copy(centre);
    this.key.target.updateMatrixWorld();
    this.fill.position.set(
      centre.x + LIGHTING.fillOffset.x,
      centre.y + LIGHTING.fillOffset.y,
      centre.z + LIGHTING.fillOffset.z
    );
  }

  buildTable() {
    // Deliberately much larger than the board so felt always reaches the screen
    // edges at any viewport. The proper table with its gold border is milestone 03.
    this.table = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshLambertMaterial({ color: COLORS.felt })
    );
    this.table.rotation.x = -Math.PI / 2;
    this.table.position.y = TABLE.y;
    this.table.receiveShadow = true;
    this.scene.add(this.table);
  }

  loadLayout(layoutId, { seed = null, animate = true } = {}) {
    const chosenSeed = seed ?? randomSeed();
    // Two independent streams from the one seed: one shapes the board (the surprise
    // board generates its silhouette here), one deals the faces. Sharing a single
    // stream would make the shape and the deal interfere, so a seed would no longer
    // reproduce a board once either changed.
    // Which way up the board is dealt is decided here, once, from the screen shape. A
    // rotation mid-game deliberately does NOT re-deal: it would replace the board she is
    // playing with a different one.
    const layout = getLayout(layoutId, {
      rng: mulberry32(chosenSeed),
      viewportAspect: window.innerWidth / window.innerHeight,
      tileAspect: TILE.depth / TILE.width,
    });
    if (!layout) throw new Error(`Unknown layout: ${layoutId}`);

    const { tiles } = generateBoard(layout, mulberry32((chosenSeed ^ 0x9e3779b9) >>> 0));

    this.buildBoard(layout.id, tiles, { animate });
    gameState.seed = chosenSeed;
    gameState.layoutName = layout.name;
    eventBus.emit(Events.BOARD_GENERATED, {
      layoutId: layout.id,
      seed: chosenSeed,
      tiles: tiles.length,
    });
  }

  /** Realises a set of tiles (already faced) into state and meshes. */
  buildBoard(layoutId, tiles, { animate = true } = {}) {
    this.disposeTiles();
    // Building a board must not change which screen is showing: the caller decides
    // that, through setScreen, which is the only path that tells the overlay. Setting
    // it here silently left the greeting on top of a live board, swallowing taps.
    const previousScreen = gameState.screen;
    gameState.reset(layoutId);
    gameState.screen = previousScreen;
    gameState.tiles = tiles.map((t) => ({ ...t, cleared: Boolean(t.cleared) }));

    this.boardGroup = new THREE.Group();
    for (const tile of gameState.tiles) {
      const mesh = new THREE.Mesh(createTileGeometry(FACES.indexOf(tile.face)), this.tileMaterial);
      const pos = latticeToWorld(tile);
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.visible = !tile.cleared;
      mesh.userData.tileId = tile.id;
      this.boardGroup.add(mesh);
      this.tileMeshes.push(mesh);
      this.meshById.set(tile.id, mesh);
    }
    this.scene.add(this.boardGroup);

    this.index = buildIndex(gameState.tiles);
    this.refreshBoardState();
    this.applyTileShading();
    this.invalidateShadows();
    this.updateSize();
    if (animate) this.startEntrance();
    else this.settleImmediately();
  }

  /** Places every tile at rest. Used by fixtures and by a resumed game. */
  settleImmediately() {
    this.entranceClock = null;
    this.celebrations = [];
    this.matchesThisBoard = 0;
    this.particles.clear();
    for (const mesh of this.tileMeshes) {
      delete mesh.userData.entrance;
      mesh.rotation.set(0, 0, 0);
      mesh.scale.setScalar(1);
    }
    this.applySelectionVisual();
    this.invalidateShadows();
  }

  /** True once the board has finished dealing itself and is ready to be played. */
  get settled() {
    return this.entranceClock === null;
  }

  /**
   * Tiles fly in and stack themselves at the start of a board. Costs half a second
   * and makes the board feel dealt rather than switched on.
   */
  startEntrance() {
    this.entranceClock = 0;
    this.celebrations = [];
    this.matchesThisBoard = 0;
    this.particles.clear();
    for (const mesh of this.tileMeshes) {
      const target = mesh.position.clone();
      mesh.userData.entrance = {
        target,
        // Fly in from above and out to the side, stacking bottom layers first so the
        // board assembles itself the way a person would build it.
        from: new THREE.Vector3(
          target.x + (Math.random() - 0.5) * ENTRANCE.spread,
          target.y + ENTRANCE.dropHeight,
          target.z + (Math.random() - 0.5) * ENTRANCE.spread
        ),
        delay: this.entranceDelayFor(mesh),
        spin: (Math.random() - 0.5) * 2.4,
      };
      mesh.position.copy(mesh.userData.entrance.from);
    }
    this.dirty = true;
  }

  entranceDelayFor(mesh) {
    const tile = gameState.tileById(mesh.userData.tileId);
    if (!tile) return 0;
    const order = tile.layer * 40 + tile.x + tile.y;
    return order * ENTRANCE.stagger;
  }

  updateEntrance(delta) {
    this.entranceClock += delta;
    let settling = false;

    for (const mesh of this.tileMeshes) {
      const entrance = mesh.userData.entrance;
      if (!entrance) continue;
      const t = (this.entranceClock - entrance.delay) / ENTRANCE.duration;
      if (t <= 0) {
        settling = true;
        mesh.position.copy(entrance.from);
        continue;
      }
      if (t >= 1) {
        mesh.position.copy(entrance.target);
        mesh.rotation.set(0, 0, 0);
        continue;
      }
      settling = true;
      const eased = 1 - Math.pow(1 - t, 3);
      mesh.position.lerpVectors(entrance.from, entrance.target, eased);
      mesh.rotation.y = entrance.spin * (1 - eased);
      mesh.rotation.z = entrance.spin * 0.4 * (1 - eased);
    }

    this.dirty = true;
    if (!settling) {
      this.entranceClock = null;
      for (const mesh of this.tileMeshes) delete mesh.userData.entrance;
      this.applySelectionVisual();
      // One shadow render once everything has landed, rather than 60 during the fly-in.
      this.invalidateShadows();
    }
  }

  /** Recomputes what's playable and whether the board is finished or stuck. */
  refreshBoardState() {
    const byId = new Map(gameState.tiles.map((t) => [t.id, t]));
    this.freeIds = new Set(
      gameState.tiles.filter((t) => isFree(t, byId, this.index)).map((t) => t.id)
    );
    this.pairCount = availablePairs(gameState.tiles, this.index).length;

    if (gameState.remaining === 0) {
      gameState.stuck = false;
      gameState.boardsCompleted += 1;
      this.setScreen('won');
      this.startFinale();
      eventBus.emit(Events.BOARD_CLEARED, {
        layoutId: gameState.layoutId,
        seed: gameState.seed,
      });
      return;
    }

    gameState.stuck = this.pairCount === 0;
    // A dead end is only a loss once the reshuffles are gone: a reshuffle always
    // produces a solvable board, so while she has one the board is recoverable.
    if (gameState.stuck && gameState.shufflesLeft === 0) {
      this.setScreen('no-moves');
      eventBus.emit(Events.GAME_NO_MOVES, { remaining: gameState.remaining });
    } else if (gameState.screen !== 'greeting') {
      this.setScreen('board');
    }
  }

  isTileFree(id) {
    return this.freeIds.has(id);
  }

  /** Every screen change goes through here, so the HTML overlay always agrees. */
  setScreen(screen) {
    if (gameState.screen === screen) return;
    gameState.screen = screen;
    eventBus.emit(Events.SCREEN_CHANGED, { screen });
    this.dirty = true;
  }

  /** Ask for one shadow re-render on the next frame. */
  invalidateShadows() {
    this.renderer.shadowMap.needsUpdate = true;
    this.dirty = true;
  }

  /**
   * The gold rim and the glow pool that mark the selected tile. Built once and moved
   * around, rather than created per selection.
   */
  buildSelectionMarkers() {
    const rimGeometry = new THREE.BoxGeometry(
      (TILE.width - TILE.gap) * SELECTION.rimScale,
      TILE.thickness * SELECTION.rimHeightFactor,
      (TILE.depth - TILE.gap) * SELECTION.rimScale
    );
    this.selectionRim = new THREE.Mesh(
      rimGeometry,
      new THREE.MeshBasicMaterial({ color: COLORS.gold })
    );
    this.selectionRim.visible = false;
    this.scene.add(this.selectionRim);

    const glowSize = TILE.width * SELECTION.glowScale;
    this.selectionGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(glowSize, glowSize * (TILE.depth / TILE.width)),
      new THREE.MeshBasicMaterial({
        map: glowTexture(),
        color: COLORS.gold,
        transparent: true,
        opacity: SELECTION.glowOpacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.selectionGlow.rotation.x = -Math.PI / 2;
    this.selectionGlow.visible = false;
    this.scene.add(this.selectionGlow);
  }

  /**
   * ADR-0002 constraint 3: a selected tile changes on four channels at once — it
   * lifts, gains a thick gold rim, pulses slowly, and casts a glow. Deliberately
   * redundant, so no single channel has to carry it.
   */
  applySelectionVisual() {
    const selected = gameState.selectedId;
    for (const tile of gameState.tiles) {
      const mesh = this.meshById.get(tile.id);
      if (!mesh || this.entranceClock !== null) continue;
      const base = latticeToWorld(tile).y;
      mesh.position.y = selected === tile.id ? base + TILE.selectionLift : base;
    }

    const mesh = selected === null ? null : this.meshById.get(selected);
    this.selectionRim.visible = Boolean(mesh);
    this.selectionGlow.visible = Boolean(mesh);
    if (mesh) {
      this.selectionRim.position.copy(mesh.position);
      this.selectionGlow.position.set(mesh.position.x, TABLE.y + 0.03, mesh.position.z);
      this.pulseClock = 0;
    }
    this.dirty = true;
  }

  /** The slow pulse on the rim, and the brighter breathing of a hinted pair. */
  updateSelectionPulse(delta) {
    if (!this.selectionRim.visible) return;
    this.pulseClock += delta;
    const phase = Math.sin((this.pulseClock / SELECTION.pulsePeriod) * Math.PI * 2);
    const scale = 1 + phase * SELECTION.pulseAmount;
    this.selectionRim.scale.set(scale, 1, scale);
    this.selectionGlow.material.opacity = SELECTION.glowOpacity * (0.65 + 0.35 * (phase + 1) / 2);
    this.dirty = true;
  }

  /**
   * Free tiles render bright, blocked tiles knocked back, hinted tiles brightest of
   * all — carried on a per-tile vertex colour so all 144 tiles keep sharing one
   * material (constraint 2: playability is visible without interaction).
   */
  applyTileShading() {
    const hint = gameState.hintPair || [];
    for (const tile of gameState.tiles) {
      const mesh = this.meshById.get(tile.id);
      if (!mesh) continue;
      let brightness = this.freeIds.has(tile.id)
        ? SELECTION.freeBrightness
        : SELECTION.blockedBrightness;
      if (hint.includes(tile.id)) brightness = SELECTION.hintBrightness;
      setTileBrightness(mesh, brightness);
    }
    this.dirty = true;
  }

  disposeTiles() {
    for (const mesh of this.tileMeshes) mesh.geometry.dispose();
    if (this.boardGroup) this.scene.remove(this.boardGroup);
    this.tileMeshes = [];
    this.meshById.clear();
    this.freeIds.clear();
    this.boardGroup = null;
  }

  // --- playing ------------------------------------------------------------

  handleTap(cssX, cssY) {
    if (gameState.screen !== 'board') return;
    // The board is still dealing itself; tiles are mid-flight and tapping one would
    // mean tapping a moving target.
    if (!this.settled) return;
    // Taps are ignored while a mismatched pair is still on show, so a quick double
    // tap can't skip past the feedback and land somewhere unexpected.
    if (this.mismatchHold > 0) return;

    const hit = this.pickAt(cssX, cssY) ?? this.forgiveTap(cssX, cssY);
    if (hit === null) return;

    const tile = gameState.tileById(hit);
    if (!tile || tile.cleared) return;
    // Tapping a blocked tile does nothing at all — no sound, no shake, no message
    // (ADR-0002 constraint 2).
    if (!this.isTileFree(hit)) return;

    this.selectTile(tile);
  }

  /**
   * A tap that hit no tile still counts if exactly one free tile is close enough.
   * Ambiguous near-misses do nothing rather than guessing which she meant.
   */
  forgiveTap(cssX, cssY) {
    const candidates = [];
    for (const id of this.freeIds) {
      const rect = this.tileScreenRect(this.meshById.get(id));
      const dx = Math.max(rect.x - cssX, 0, cssX - (rect.x + rect.w));
      const dy = Math.max(rect.y - cssY, 0, cssY - (rect.y + rect.h));
      const distance = Math.hypot(dx, dy);
      if (distance <= INPUT.tapForgivenessPx) candidates.push({ id, distance });
    }
    return candidates.length === 1 ? candidates[0].id : null;
  }

  selectTile(tile) {
    const selected = gameState.selectedId;

    if (selected === tile.id) {
      gameState.selectedId = null;
      eventBus.emit(Events.TILE_DESELECTED, { id: tile.id });
      this.applySelectionVisual();
      return;
    }

    if (selected === null) {
      gameState.selectedId = tile.id;
      gameState.hintPair = null;
      this.hintHold = 0;
      eventBus.emit(Events.TILE_SELECTED, { id: tile.id, face: tile.face });
      this.applySelectionVisual();
      return;
    }

    const first = gameState.tileById(selected);
    if (matches(first, tile)) this.clearPair(first, tile);
    else this.rejectPair(first, tile);
  }

  clearPair(a, b) {
    for (const tile of [a, b]) {
      tile.cleared = true;
      // A tile in flight through its celebration shouldn't drag a shadow around the
      // board behind it.
      const mesh = this.meshById.get(tile.id);
      if (mesh) mesh.castShadow = false;
    }
    this.invalidateShadows();
    gameState.selectedId = null;
    gameState.hintPair = null;
    this.hintHold = 0;
    this.matchesThisBoard += 1;

    this.startCelebration(a, b);
    this.applySelectionVisual();
    this.refreshBoardState();
    this.applyTileShading();

    eventBus.emit(Events.PAIR_MATCHED, {
      ids: [a.id, b.id],
      face: a.face,
      remaining: gameState.remaining,
      matchNumber: this.matchesThisBoard,
    });
    this.dirty = true;
  }

  /**
   * Kicks off one of the eight celebrations. The tiles are already logically cleared
   * — this is theatre over the top of a decision that has been made, so the board is
   * never waiting on an animation and a tap during one is never ambiguous.
   */
  startCelebration(a, b) {
    const meshes = [a, b].map((tile) => this.meshById.get(tile.id)).filter(Boolean);
    if (meshes.length < 2) return;

    const celebration = pickCelebration([a.face, b.face], this.lastCelebration);
    this.lastCelebration = celebration.name;

    const starts = meshes.map((mesh) => mesh.position.clone());
    const mid = starts[0].clone().add(starts[1]).multiplyScalar(0.5);
    const escalated = this.matchesThisBoard % CELEBRATION.escalateEvery === 0;

    const shards = celebration.name === 'crumble'
      ? meshes.flatMap((mesh) => buildShards(mesh, this.scene))
      : [];

    const fired = new Set();
    this.celebrations.push({
      celebration,
      meshes,
      starts,
      mid,
      shards,
      elapsed: 0,
      duration: CELEBRATION.duration,
      escalated,
      fired,
    });

    eventBus.emit(Events.FX_CELEBRATION, {
      name: celebration.name,
      escalated,
      remaining: gameState.remaining,
    });
  }

  updateCelebrations(delta) {
    for (const run of this.celebrations) {
      run.elapsed += delta;
      const t = Math.min(1, run.elapsed / run.duration);
      const ctx = {
        meshes: run.meshes,
        starts: run.starts,
        mid: run.mid,
        shards: run.shards,
        spotlight: this.spotlight,
        emit: (origin, options) => this.particles.emit(origin, options),
        // Lets an animation fire a one-shot (a burst, a bang) at a moment in its
        // timeline without it repeating every frame after that point.
        once: (at) => {
          if (t < at || run.fired.has(at)) return false;
          run.fired.add(at);
          return true;
        },
      };
      run.celebration.run(ctx, t);

      if (t >= 1) {
        for (const mesh of run.meshes) {
          mesh.visible = false;
          mesh.scale.setScalar(1);
          mesh.rotation.set(0, 0, 0);
          mesh.position.copy(mesh.userData.homePosition || mesh.position);
        }
        for (const shard of run.shards) {
          this.scene.remove(shard.mesh);
          shard.mesh.geometry.dispose();
        }
        if (run.celebration.name === 'elvis-spotlight') this.spotlight.visible = false;
        // An escalated match, or the last pair on the board, earns a bigger bang.
        if (run.escalated && gameState.remaining > 0) {
          this.particles.emit(run.mid, {
            count: PARTICLES.burst * 2,
            speed: 8,
            spread: 1.5,
            upward: 3,
            colour: COLORS.gold,
            lifespan: 1.9,
          });
        }
      }
    }
    this.celebrations = this.celebrations.filter((run) => run.elapsed < run.duration);
    this.dirty = true;
  }

  /** The board-clear finale: a long, loud, unmistakable well done. */
  startFinale() {
    this.finaleClock = 0;
    eventBus.emit(Events.FX_FINALE, { layoutId: gameState.layoutId });
  }

  updateFinale(delta) {
    const before = this.finaleClock;
    this.finaleClock += delta;
    const centre = this.cameraSystem.target.clone();

    // Rolling volleys rather than one burst, so the celebration lasts as long as it
    // takes to feel like a celebration.
    const volley = 0.32;
    const beforeCount = Math.floor(before / volley);
    const nowCount = Math.floor(this.finaleClock / volley);
    if (nowCount > beforeCount && this.finaleClock < CELEBRATION.finaleDuration) {
      const colours = [COLORS.gold, COLORS.elvisRed, 0x7fb6ff, 0x8fe1b0, 0xfff3c4];
      for (let n = 0; n < 3; n++) {
        const origin = centre.clone().add(
          new THREE.Vector3((Math.random() - 0.5) * 12, 2 + Math.random() * 5, (Math.random() - 0.5) * 8)
        );
        this.particles.emit(origin, {
          count: Math.round(PARTICLES.finaleBurst / 3),
          speed: 7 + Math.random() * 4,
          spread: 1.3,
          colour: colours[(nowCount + n) % colours.length],
          lifespan: 2.2,
          size: PARTICLES.size * 1.3,
        });
      }
    }
    if (this.finaleClock >= CELEBRATION.finaleDuration) this.finaleClock = null;
    this.dirty = true;
  }

  rejectPair(a, b) {
    // Nothing stays selected: the pair is held in mismatchPair for the duration of
    // the feedback, so "what is selected" is never ambiguous — she released both.
    gameState.selectedId = null;
    gameState.mismatchPair = [a.id, b.id];
    this.mismatchHold = TIMING.mismatchHold;
    this.applySelectionVisual();
    eventBus.emit(Events.PAIR_MISMATCHED, { ids: [a.id, b.id] });
    this.dirty = true;
  }

  // --- assists ------------------------------------------------------------

  /** Points at one playable pair. Returns the pair, or null if none is left to give. */
  hint() {
    if (gameState.screen !== 'board' || gameState.hintsLeft === 0) return null;
    const pairs = availablePairs(gameState.tiles, this.index);
    if (pairs.length === 0) return null;

    gameState.hintsLeft -= 1;
    gameState.hintPair = pairs[0];
    this.hintHold = TIMING.hintHold;
    eventBus.emit(Events.ASSIST_HINT, { pair: gameState.hintPair, left: gameState.hintsLeft });
    if (gameState.hintsLeft === 0) eventBus.emit(Events.ASSIST_EXHAUSTED, { assist: 'hint' });
    this.applyTileShading();
    this.dirty = true;
    return { pair: gameState.hintPair, left: gameState.hintsLeft };
  }

  /** Redeals the remaining tiles into the remaining positions, still solvable. */
  shuffle() {
    if (gameState.shufflesLeft === 0) return false;
    if (gameState.remaining === 0) return false;

    const { tiles } = shuffleRemaining(gameState.tiles, mulberry32(randomSeed()));
    for (const tile of tiles) {
      const existing = gameState.tileById(tile.id);
      if (!existing || existing.cleared) continue;
      existing.face = tile.face;
      setTileFace(this.meshById.get(tile.id), FACES.indexOf(tile.face));
    }

    gameState.shufflesLeft -= 1;
    gameState.selectedId = null;
    gameState.hintPair = null;
    gameState.mismatchPair = null;
    this.hintHold = 0;
    this.mismatchHold = 0;
    this.applySelectionVisual();

    this.refreshBoardState();
    this.applyTileShading();
    this.invalidateShadows();
    eventBus.emit(Events.ASSIST_SHUFFLE, { left: gameState.shufflesLeft });
    if (gameState.shufflesLeft === 0) eventBus.emit(Events.ASSIST_EXHAUSTED, { assist: 'shuffle' });
    this.dirty = true;
    return true;
  }

  /** Test/dev affordance: set the assists left and re-derive the board state. */
  setAssists({ hints, shuffles } = {}) {
    if (typeof hints === 'number') gameState.hintsLeft = hints;
    if (typeof shuffles === 'number') gameState.shufflesLeft = shuffles;
    this.refreshBoardState();
    this.dirty = true;
  }

  newBoard({ layoutId = gameState.layoutId, seed = null, screen = 'board' } = {}) {
    const completed = gameState.boardsCompleted;
    this.loadLayout(layoutId, { seed });
    gameState.boardsCompleted = completed;
    this.setScreen(screen);
    eventBus.emit(Events.GAME_RESTART, { layoutId });
    this.dirty = true;
  }

  /**
   * Deals a saved board back onto the table exactly as she left it. No entrance
   * animation: this is the board she was already looking at, not a new one.
   */
  resumeBoard(board) {
    const completed = gameState.boardsCompleted;
    this.buildBoard(board.layoutId, board.tiles, { animate: false });
    gameState.seed = board.seed ?? null;
    gameState.hintsLeft = Number.isFinite(board.hintsLeft) ? board.hintsLeft : gameState.hintsLeft;
    gameState.shufflesLeft = Number.isFinite(board.shufflesLeft)
      ? board.shufflesLeft
      : gameState.shufflesLeft;
    gameState.boardsCompleted = completed;
    // Re-derived rather than trusted from the save: freeness and the stuck check must
    // reflect the rules as they are now, not as they were when it was written.
    this.refreshBoardState();
    this.applyTileShading();
    this.invalidateShadows();
    eventBus.emit(Events.SAVE_RESUMED, { remaining: gameState.remaining });
    this.dirty = true;
  }

  /** Back to the front screen, leaving the board standing behind it. */
  goHome() {
    gameState.selectedId = null;
    this.applySelectionVisual();
    this.setScreen('greeting');
  }

  /**
   * World-space bounds of the tiles at REST, padded by the felt margin.
   *
   * Resting positions, not current ones: during the entrance animation the tiles are up
   * in the air and out to the sides, and measuring them there inflates the board enormously
   * — a refit mid-entrance framed for that phantom board and cut tile size by half.
   */
  boardBounds() {
    const bounds = new THREE.Box3();
    const halfW = (TILE.width - TILE.gap) / 2;
    const halfD = (TILE.depth - TILE.gap) / 2;
    for (const mesh of this.tileMeshes) {
      const home = mesh.userData.entrance ? mesh.userData.entrance.target : mesh.position;
      bounds.expandByPoint(new THREE.Vector3(home.x - halfW, TABLE.y, home.z - halfD));
      bounds.expandByPoint(
        new THREE.Vector3(home.x + halfW, home.y + TILE.thickness / 2, home.z + halfD)
      );
    }
    bounds.expandByVector(new THREE.Vector3(TABLE.padding, 0, TABLE.padding));
    return bounds;
  }

  /**
   * Every corner of every tile, plus the padded footprint at table level. Framing
   * against these rather than a bounding box stops the camera reserving space for
   * box corners that hold no tile — worth about 4% of tile size on a stacked board.
   */
  framingPoints(clearance = 0) {
    const halfW = (TILE.width - TILE.gap) / 2;
    const halfD = (TILE.depth - TILE.gap) / 2;
    const points = [];
    for (const mesh of this.tileMeshes) {
      const home = mesh.userData.entrance ? mesh.userData.entrance.target : mesh.position;
      for (const dx of [-halfW, halfW]) {
        for (const dz of [-halfD, halfD]) {
          points.push(new THREE.Vector3(home.x + dx, home.y + TILE.thickness / 2, home.z + dz));
          points.push(new THREE.Vector3(home.x + dx, TABLE.y, home.z + dz));
        }
      }
    }
    // The felt margin, at table level so it costs nothing in height.
    const bounds = this.boardBounds();
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        points.push(new THREE.Vector3(x, TABLE.y, z));
      }
    }

    // Reserve table for the bar on whichever side it sits, so no tile ends up under a
    // button. In world units, at table level, so it costs nothing in height.
    const barAtBottom = hudIsAtBottom();
    if (clearance > 0 && barAtBottom !== null) {
      const z = barAtBottom ? bounds.max.z + clearance : bounds.min.z - clearance;
      for (const x of [bounds.min.x, bounds.max.x]) {
        points.push(new THREE.Vector3(x, TABLE.y, z));
      }
    }

    return points;
  }

  updateSize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, true);
    const bounds = this.boardBounds();
    const centre = bounds.getCenter(new THREE.Vector3());

    this.cameraSystem.frame(this.framingPoints(), centre, width, height, measureHudInset());
    this.fitShadowCamera();
    this.invalidateShadows();
  }

  fitShadowCamera() {
    const bounds = this.boardBounds();
    const size = bounds.getSize(new THREE.Vector3());
    const centre = bounds.getCenter(new THREE.Vector3());
    this.positionLights(centre);

    const radius = Math.max(size.x, size.z) * 0.75;
    const shadow = this.key.shadow.camera;
    shadow.left = -radius;
    shadow.right = radius;
    shadow.top = radius;
    shadow.bottom = -radius;
    shadow.near = 0.5;
    shadow.far = 60;
    shadow.updateProjectionMatrix();
  }

  onResize() {
    this.updateSize();
    eventBus.emit(Events.VIEW_RESIZED, { w: window.innerWidth, h: window.innerHeight });
  }

  /** True while anything needs per-frame updates — otherwise the loop idles. */
  get animating() {
    return (
      this.mismatchHold > 0 ||
      this.hintHold > 0 ||
      this.entranceClock !== null ||
      this.finaleClock !== null ||
      this.celebrations.length > 0 ||
      this.particles.active > 0 ||
      gameState.selectedId !== null
    );
  }

  tick(now) {
    requestAnimationFrame(this.tick);
    if (this.manualTime) {
      if (this.dirty) this.renderNow();
      return;
    }

    const last = this.lastFrameAt ?? now;
    const delta = Math.min((now - last) / 1000, TIME.maxFrameDelta);
    this.lastFrameAt = now;

    if (this.animating) {
      this.update(delta);
      this.dirty = true;
    }
    gameState.elapsed += delta;
    if (this.dirty) this.renderNow();
  }

  update(delta) {
    if (this.entranceClock !== null) this.updateEntrance(delta);
    if (this.celebrations.length > 0) this.updateCelebrations(delta);
    if (this.finaleClock !== null) this.updateFinale(delta);
    if (this.particles.active > 0) {
      this.particles.update(delta);
      this.dirty = true;
    }
    this.updateSelectionPulse(delta);

    // Timed holds run off the game clock rather than setTimeout, so advanceTime()
    // steps them deterministically in tests.
    if (this.mismatchHold > 0) {
      this.mismatchHold = Math.max(0, this.mismatchHold - delta);
      if (this.mismatchHold === 0) {
        gameState.mismatchPair = null;
        this.dirty = true;
      }
    }
    if (this.hintHold > 0) {
      this.hintHold = Math.max(0, this.hintHold - delta);
      if (this.hintHold === 0) {
        gameState.hintPair = null;
        this.applyTileShading();
        this.dirty = true;
      }
    }
    // Animation systems hook in here from milestone 05.
  }

  renderNow() {
    this.renderer.render(this.scene, this.camera);
    this.renderCount++;
    this.dirty = false;
  }

  requestRender() {
    this.dirty = true;
  }

  /**
   * Deterministic stepping for tests and agent inspection. The first call takes
   * the game off wall-clock time for good — a human session never calls it.
   */
  advanceTime(seconds) {
    this.manualTime = true;
    let left = seconds;
    while (left > 1e-9) {
      const step = Math.min(TIME.fixedStep, left);
      this.update(step);
      left -= step;
    }
    gameState.elapsed = (this.manualElapsed = (this.manualElapsed || 0) + seconds);
    this.dirty = true;
    this.renderNow();
  }

  /** Topmost tile id under a CSS-pixel point, or null. Cleared tiles are ignored. */
  pickAt(cssX, cssY) {
    this.pointer.set((cssX / window.innerWidth) * 2 - 1, -(cssY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.tileMeshes, false);
    for (const hit of hits) {
      if (!hit.object.visible) continue;
      // A cleared tile may still be flying through its celebration. It must not
      // swallow a tap meant for whatever is underneath it.
      const tile = gameState.tileById(hit.object.userData.tileId);
      if (!tile || tile.cleared) continue;
      return hit.object.userData.tileId;
    }
    return null;
  }

  /** Screen-space rect of a tile's top face, in CSS pixels. */
  tileScreenRect(mesh) {
    const halfW = (TILE.width - TILE.gap) / 2;
    const halfD = (TILE.depth - TILE.gap) / 2;
    const top = TILE.thickness / 2;
    const width = window.innerWidth;
    const height = window.innerHeight;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const v = new THREE.Vector3();

    for (const dx of [-halfW, halfW]) {
      for (const dz of [-halfD, halfD]) {
        v.set(mesh.position.x + dx, mesh.position.y + top, mesh.position.z + dz);
        v.project(this.camera);
        const sx = (v.x * 0.5 + 0.5) * width;
        const sy = (1 - (v.y * 0.5 + 0.5)) * height;
        minX = Math.min(minX, sx);
        maxX = Math.max(maxX, sx);
        minY = Math.min(minY, sy);
        maxY = Math.max(maxY, sy);
      }
    }
    return {
      x: round(minX),
      y: round(minY),
      w: round(maxX - minX),
      h: round(maxY - minY),
      cx: round((minX + maxX) / 2),
      cy: round((minY + maxY) / 2),
    };
  }

  snapshot() {
    return {
      screen: gameState.screen,
      layout: gameState.layoutId,
      layoutName: gameState.layoutName,
      seed: gameState.seed,
      viewport: {
        w: window.innerWidth,
        h: window.innerHeight,
        dpr: this.renderer.getPixelRatio(),
      },
      camera: this.cameraSystem.snapshot(),
      boardsCompleted: gameState.boardsCompleted,
      counts: {
        total: gameState.tiles.length,
        remaining: gameState.remaining,
        cleared: gameState.clearedCount,
      },
      assists: { hintsLeft: gameState.hintsLeft, shufflesLeft: gameState.shufflesLeft },
      selection: gameState.selectedId,
      hintPair: gameState.hintPair,
      mismatchPair: gameState.mismatchPair,
      stuck: gameState.stuck,
      availablePairs: this.pairCount,
      time: {
        mode: this.manualTime ? 'manual' : 'auto',
        elapsed: round(gameState.elapsed),
      },
      renderCount: this.renderCount,
      tiles: gameState.tiles.map((t) => ({
        id: t.id,
        x: t.x,
        y: t.y,
        layer: t.layer,
        face: t.face,
        cleared: t.cleared,
        free: this.freeIds.has(t.id),
        screen: this.tileScreenRect(this.meshById.get(t.id)),
      })),
    };
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    this.input?.dispose();
    this.disposeTiles();
    this.tileMaterial.dispose();
    this.atlasTexture.dispose();
    this.renderer.dispose();
  }
}

const round = (n) => Math.round(n * 100) / 100;

/**
 * Which side of the screen the bar is on: true for the bottom (portrait), false for the
 * top (landscape), null when it isn't showing. Read from the DOM rather than assumed,
 * because a CSS media query is what moves it.
 */
/**
 * The strip of screen the in-game bar covers, top and bottom, in CSS pixels. Measured from
 * the DOM because a media query is what moves the bar to the bottom in portrait, and its
 * height depends on the type scale.
 */
function measureHudInset() {
  const hud = document.getElementById('hud');
  if (!hud || hud.classList.contains('hidden')) return { top: 0, bottom: 0 };
  const box = hud.getBoundingClientRect();
  if (!box.height) return { top: 0, bottom: 0 };
  const gap = 10;
  return box.top > window.innerHeight / 2
    ? { top: 0, bottom: window.innerHeight - box.top + gap }
    : { top: box.bottom + gap, bottom: 0 };
}

function hudIsAtBottom() {
  const hud = document.getElementById('hud');
  if (!hud || hud.classList.contains('hidden')) return null;
  const box = hud.getBoundingClientRect();
  if (!box.height) return null;
  return box.top > window.innerHeight / 2;
}

/** Soft radial glow for the pool of light under a selected tile. */
function glowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
