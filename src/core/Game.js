import * as THREE from 'three';
import {
  ASSISTS,
  CAMERA,
  COLORS,
  FACES,
  INPUT,
  LIGHTING,
  RENDER,
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
  setTileFace,
} from '../board/TileMeshes.js';
import { CameraSystem } from '../systems/CameraSystem.js';
import { InputSystem } from '../systems/InputSystem.js';

export class Game {
  constructor(container, { layoutId, seed } = {}) {
    this.container = container;
    this.tileMeshes = [];
    this.meshById = new Map();
    this.freeIds = new Set();
    this.index = null;
    this.pairCount = 0;
    this.mismatchHold = 0;
    this.hintHold = 0;
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
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.background);

    this.cameraSystem = new CameraSystem();
    this.camera = this.cameraSystem.camera;

    this.atlasTexture = createAtlasTexture(buildPlaceholderAtlas());
    this.tileMaterial = createTileMaterial(this.atlasTexture);

    this.buildLights();
    this.buildTable();
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

  loadLayout(layoutId, { seed = null } = {}) {
    const layout = getLayout(layoutId);
    if (!layout) throw new Error(`Unknown layout: ${layoutId}`);

    const chosenSeed = seed ?? randomSeed();
    const { tiles } = generateBoard(layout, mulberry32(chosenSeed));

    this.buildBoard(layout.id, tiles);
    gameState.seed = chosenSeed;
    eventBus.emit(Events.BOARD_GENERATED, {
      layoutId: layout.id,
      seed: chosenSeed,
      tiles: tiles.length,
    });
  }

  /** Realises a set of tiles (already faced) into state and meshes. */
  buildBoard(layoutId, tiles) {
    this.disposeTiles();
    gameState.reset(layoutId);
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
    this.updateSize();
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
      gameState.screen = 'won';
      eventBus.emit(Events.BOARD_CLEARED, { layoutId: gameState.layoutId });
      return;
    }

    gameState.stuck = this.pairCount === 0;
    // A dead end is only a loss once the reshuffles are gone: a reshuffle always
    // produces a solvable board, so while she has one the board is recoverable.
    if (gameState.stuck && gameState.shufflesLeft === 0) {
      gameState.screen = 'no-moves';
      eventBus.emit(Events.GAME_NO_MOVES, { remaining: gameState.remaining });
    } else {
      gameState.screen = 'board';
    }
  }

  isTileFree(id) {
    return this.freeIds.has(id);
  }

  /**
   * Lifts the selected tile clear of the board. Stopgap feedback so a tap visibly
   * does something before milestone 04 builds the real, unmissable treatment.
   */
  applySelectionVisual() {
    for (const tile of gameState.tiles) {
      const mesh = this.meshById.get(tile.id);
      if (!mesh) continue;
      const lifted = gameState.selectedId === tile.id;
      const base = latticeToWorld(tile).y;
      mesh.position.y = lifted ? base + TILE.selectionLift : base;
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
      const mesh = this.meshById.get(tile.id);
      if (mesh) mesh.visible = false;
    }
    gameState.selectedId = null;
    gameState.hintPair = null;
    this.hintHold = 0;
    this.applySelectionVisual();

    this.refreshBoardState();
    eventBus.emit(Events.PAIR_MATCHED, {
      ids: [a.id, b.id],
      face: a.face,
      remaining: gameState.remaining,
    });
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

  newBoard({ layoutId = gameState.layoutId, seed = null } = {}) {
    this.loadLayout(layoutId, { seed });
    eventBus.emit(Events.GAME_RESTART, { layoutId });
    this.dirty = true;
  }

  /** World-space bounds of the tiles, padded by the felt margin. */
  boardBounds() {
    const bounds = new THREE.Box3();
    for (const mesh of this.tileMeshes) bounds.expandByObject(mesh);
    bounds.expandByVector(new THREE.Vector3(TABLE.padding, 0, TABLE.padding));
    return bounds;
  }

  updateSize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, true);
    this.cameraSystem.frame(this.boardBounds(), width, height);
    this.fitShadowCamera();
    this.dirty = true;
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
    return this.mismatchHold > 0 || this.hintHold > 0;
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
      if (hit.object.visible) return hit.object.userData.tileId;
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
      seed: gameState.seed,
      viewport: {
        w: window.innerWidth,
        h: window.innerHeight,
        dpr: this.renderer.getPixelRatio(),
      },
      camera: this.cameraSystem.snapshot(),
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
