import * as THREE from 'three';
import { CAMERA, COLORS, FACES, LIGHTING, RENDER, TABLE, TILE, TIME } from './Constants.js';
import { Events, eventBus } from './EventBus.js';
import { gameState } from './GameState.js';
import { getLayout } from '../board/Layouts.js';
import {
  buildPlaceholderAtlas,
  createAtlasTexture,
  createTileGeometry,
  createTileMaterial,
  latticeToWorld,
} from '../board/TileMeshes.js';
import { CameraSystem } from '../systems/CameraSystem.js';

export class Game {
  constructor(container, { layoutId } = {}) {
    this.container = container;
    this.tileMeshes = [];
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
    this.loadLayout(layoutId || gameState.layoutId);

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

  loadLayout(layoutId) {
    const layout = getLayout(layoutId);
    if (!layout) throw new Error(`Unknown layout: ${layoutId}`);

    this.disposeTiles();
    gameState.reset(layout.id);

    // Faces are dealt round-robin in milestone 01 purely so every tile has one:
    // solvable generation is milestone 02's job (BoardGenerator).
    gameState.tiles = layout.tiles.map((t, i) => ({
      id: t.id,
      x: t.x,
      y: t.y,
      layer: t.layer,
      face: FACES[i % FACES.length],
      cleared: false,
    }));

    this.boardGroup = new THREE.Group();
    for (const tile of gameState.tiles) {
      const faceIndex = FACES.indexOf(tile.face);
      const mesh = new THREE.Mesh(createTileGeometry(faceIndex), this.tileMaterial);
      const pos = latticeToWorld(tile);
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.tileId = tile.id;
      this.boardGroup.add(mesh);
      this.tileMeshes.push(mesh);
    }
    this.scene.add(this.boardGroup);

    this.updateSize();
    eventBus.emit(Events.BOARD_GENERATED, { layoutId: layout.id, tiles: gameState.tiles.length });
  }

  disposeTiles() {
    for (const mesh of this.tileMeshes) mesh.geometry.dispose();
    if (this.boardGroup) this.scene.remove(this.boardGroup);
    this.tileMeshes = [];
    this.boardGroup = null;
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

  /** True while anything needs per-frame updates. Nothing animates in milestone 01. */
  get animating() {
    return false;
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

  update(_delta) {
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

  /** Topmost tile id under a CSS-pixel point, or null. */
  pickAt(cssX, cssY) {
    this.pointer.set((cssX / window.innerWidth) * 2 - 1, -(cssY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.tileMeshes, false);
    return hits.length ? hits[0].object.userData.tileId : null;
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
    const meshById = new Map(this.tileMeshes.map((m) => [m.userData.tileId, m]));
    return {
      screen: gameState.screen,
      layout: gameState.layoutId,
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
        screen: this.tileScreenRect(meshById.get(t.id)),
      })),
    };
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    this.disposeTiles();
    this.tileMaterial.dispose();
    this.atlasTexture.dispose();
    this.renderer.dispose();
  }
}

const round = (n) => Math.round(n * 100) / 100;
