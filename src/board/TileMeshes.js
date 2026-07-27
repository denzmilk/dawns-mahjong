import * as THREE from 'three';
import { ATLAS, COLORS, FACES, FACE_LABELS, LATTICE, TILE } from '../core/Constants.js';

// All 144 tiles share ONE texture and ONE material. Each tile carries its own
// small geometry whose top-face UVs point at its cell in the atlas, and whose
// side/back UVs point at a flat ivory cell. That keeps the draw calls cheap on a
// tablet GPU and means milestone 03 only has to swap the atlas pixels, not the
// rendering.

const cellRect = (index) => {
  const { columns, cellSize } = ATLAS;
  const rows = Math.ceil((FACES.length + 1) / columns);
  const col = index % columns;
  const row = Math.floor(index / columns);
  const du = 1 / columns;
  const dv = 1 / rows;
  return { u0: col * du, v0: 1 - (row + 1) * dv, du, dv };
};

/**
 * Milestone 01 placeholder art: big black labels on white. Deliberately unlike
 * the real tile faces so placeholder output can never be mistaken for finished
 * work. Milestone 03 replaces this with the sliced sheet.
 */
export function buildPlaceholderAtlas() {
  const { columns, cellSize } = ATLAS;
  const rows = Math.ceil((FACES.length + 1) / columns);
  const canvas = document.createElement('canvas');
  canvas.width = columns * cellSize;
  canvas.height = rows * cellSize;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  FACES.forEach((face, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = col * cellSize;
    const y = row * cellSize;
    const [family, value] = face.split('-');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, cellSize, cellSize);
    ctx.strokeStyle = '#c9c2ad';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 4, y + 4, cellSize - 8, cellSize - 8);

    ctx.fillStyle = '#111111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // maxWidth on both draws: without it a long label ("southwest") overflows its
    // cell and bleeds into the neighbouring face in the atlas.
    const inset = cellSize * 0.82;
    ctx.font = `bold ${Math.round(cellSize * 0.44)}px monospace`;
    ctx.fillText(FACE_LABELS[family] || '?', x + cellSize / 2, y + cellSize * 0.36, inset);
    ctx.font = `bold ${Math.round(cellSize * 0.4)}px monospace`;
    ctx.fillText(String(value ?? ''), x + cellSize / 2, y + cellSize * 0.72, inset);
  });

  // The flat ivory cell every tile's sides and back point at.
  const sideRect = cellRect(ATLAS.sideCellIndex);
  ctx.fillStyle = `#${new THREE.Color(COLORS.tileSide).getHexString()}`;
  ctx.fillRect(
    sideRect.u0 * canvas.width,
    (1 - sideRect.v0 - sideRect.dv) * canvas.height,
    sideRect.du * canvas.width,
    sideRect.dv * canvas.height
  );

  return canvas;
}

export function createAtlasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function createTileMaterial(texture) {
  return new THREE.MeshLambertMaterial({ map: texture, color: 0xffffff });
}

const FACE_GROUP_PY = 2; // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z

/**
 * A tile's geometry, with the atlas UVs baked in. faceIndex indexes FACES.
 */
export function createTileGeometry(faceIndex) {
  const geometry = new THREE.BoxGeometry(
    TILE.width - TILE.gap,
    TILE.thickness,
    TILE.depth - TILE.gap
  );

  const uv = geometry.attributes.uv;
  const top = cellRect(faceIndex);
  const side = cellRect(ATLAS.sideCellIndex);

  for (let group = 0; group < 6; group++) {
    const base = group * 4;
    if (group === FACE_GROUP_PY) {
      // BoxGeometry emits each face's UVs as (0,1) (1,1) (0,0) (1,0).
      const corners = [
        [0, 1],
        [1, 1],
        [0, 0],
        [1, 0],
      ];
      corners.forEach(([u, v], i) => {
        uv.setXY(base + i, top.u0 + u * top.du, top.v0 + v * top.dv);
      });
    } else {
      // Every non-face side samples the middle of the flat ivory cell.
      const cu = side.u0 + side.du / 2;
      const cv = side.v0 + side.dv / 2;
      for (let i = 0; i < 4; i++) uv.setXY(base + i, cu, cv);
    }
  }
  uv.needsUpdate = true;
  return geometry;
}

/** Lattice coordinates → world position of a tile's centre. */
export function latticeToWorld({ x, y, layer }) {
  return {
    x: (x + 1) * LATTICE.stepX,
    y: layer * TILE.thickness + TILE.thickness / 2,
    z: (y + 1) * LATTICE.stepZ,
  };
}
