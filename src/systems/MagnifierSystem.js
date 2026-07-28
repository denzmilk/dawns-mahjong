import * as THREE from 'three';
import { COLORS, MAGNIFIER } from '../core/Constants.js';

// A magnifying glass she can pick up and move about the board (ADR-0004).
//
// The lens does not blow up pixels. It renders the scene a SECOND time, through a camera
// zoomed into the patch of board underneath it, and shows that render inside a circle. The
// difference matters more here than anywhere else in the game: a pixel zoom of a 75 dp tile
// is a bigger blurry tile, and the point of the glass is that she can read the face.
//
// Everything it draws lives in its own orthographic overlay whose coordinates are CSS
// pixels with a top-left origin — the same coordinates a pointer arrives in — so the glass
// is positioned by simply setting x and y. It is drawn over the finished frame.

export class MagnifierSystem {
  constructor() {
    this.on = false;
    this.x = 0;
    this.y = 0;
    this.radius = MAGNIFIER.minRadius;
    this.width = 0;
    this.height = 0;

    this.target = new THREE.WebGLRenderTarget(MAGNIFIER.targetSize, MAGNIFIER.targetSize, {
      // The lens is showing tile faces at 2×; a soft edge on the artwork would undo the
      // reason it exists.
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.target.texture.colorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera();
    this.overlay = new THREE.Scene();
    // Top edge 0, bottom edge `height` — CSS pixel coordinates, so a pointer position can
    // be used as a world position unchanged. It does mean the Y axis is flipped relative
    // to everything else in Three, which the glass and the handle both have to allow for.
    this.overlayCamera = new THREE.OrthographicCamera(0, 1, 0, 1, -10, 10);

    // Unit-sized geometry, scaled to the lens — a viewport change never rebuilds a buffer.
    // DoubleSide throughout: the flipped Y axis reverses winding, and a culled lens would
    // simply be invisible.
    this.glass = new THREE.Mesh(
      new THREE.CircleGeometry(1, 64),
      new THREE.MeshBasicMaterial({ map: this.target.texture, side: THREE.DoubleSide })
    );
    // The rim is the only part whose geometry has to be rebuilt when the lens is resized:
    // a ring scaled from unit size would scale its thickness too, and the rim's thickness
    // is a fixed number of dp.
    this.rim = new THREE.Mesh(
      ringGeometry(this.radius),
      new THREE.MeshBasicMaterial({ color: COLORS.gold, side: THREE.DoubleSide })
    );
    this.handle = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: COLORS.goldDim, side: THREE.DoubleSide })
    );
    this.group = [this.handle, this.glass, this.rim];
    this.overlay.add(...this.group);
  }

  /** Called on boot and on every resize; keeps the lens on screen and correctly sized. */
  setViewport(width, height, pixelRatio = 1) {
    const first = this.width === 0;
    this.width = width;
    this.height = height;
    const radius = Math.max(
      MAGNIFIER.minRadius,
      Math.min(MAGNIFIER.maxRadius, Math.min(width, height) * MAGNIFIER.radiusFactor)
    );
    if (radius !== this.radius) {
      this.radius = radius;
      this.rim.geometry.dispose();
      this.rim.geometry = ringGeometry(radius);
    }
    // One texel per screen pixel of lens. A fixed oversized target has to be scaled down
    // to fit the glass, and scaling a render target down without mipmaps shimmers — which
    // is the one thing a magnifier is not allowed to do.
    const texels = Math.min(MAGNIFIER.targetSize, Math.round(radius * 2 * pixelRatio));
    if (texels !== this.target.width) this.target.setSize(texels, texels);
    this.overlayCamera.left = 0;
    this.overlayCamera.right = width;
    this.overlayCamera.top = 0;
    this.overlayCamera.bottom = height;
    this.overlayCamera.updateProjectionMatrix();

    if (first) this.moveTo(width * MAGNIFIER.startX, height * MAGNIFIER.startY);
    else this.moveTo(this.x, this.y);
  }

  /**
   * Puts the lens down at a point, clamped so it can never be dragged off the screen —
   * there would be no way to get it back.
   */
  moveTo(x, y) {
    const r = this.radius;
    this.x = Math.min(this.width - r, Math.max(r, x));
    this.y = Math.min(this.height - r, Math.max(r, y));

    // Y is scaled negative because the overlay's Y axis points down while the render
    // target's rows run up: without the flip the lens shows the board upside down.
    this.glass.position.set(this.x, this.y, 0);
    this.glass.scale.set(r, -r, 1);
    this.rim.position.set(this.x, this.y, 0.2);

    // Down and to the right at 45°, its inner end pushed well under the glass so the two
    // read as one object rather than a circle with a stick near it. The negative rotation
    // reads as a positive one on screen, again because of the flipped axis.
    const length = r * MAGNIFIER.handleLength;
    const reach = Math.SQRT1_2 * (r * 0.75 + length / 2);
    this.handle.scale.set(length, r * MAGNIFIER.handleWidth, 1);
    this.handle.rotation.z = -Math.PI / 4;
    this.handle.position.set(this.x + reach, this.y + reach, -0.2);
  }

  /** Is a screen point on the glass — the part of it she can pick up? */
  contains(x, y) {
    if (!this.on) return false;
    // The grab area takes in the rim and most of the handle, because someone aiming for a
    // handle 20 px wide will miss it. Generous, and it costs nothing: outside this circle
    // every tap behaves exactly as it did before.
    const reach = this.radius + MAGNIFIER.ringWidth + this.radius * MAGNIFIER.handleLength * 0.8;
    return Math.hypot(x - this.x, y - this.y) <= reach;
  }

  /**
   * Where on the board a tap inside the lens really landed. The glass shows the board
   * magnified about its own centre, so a point `d` from the centre of the glass is showing
   * whatever sits `d / zoom` from the centre underneath it.
   */
  sourcePoint(x, y) {
    return {
      x: this.x + (x - this.x) / MAGNIFIER.zoom,
      y: this.y + (y - this.y) / MAGNIFIER.zoom,
    };
  }

  /**
   * Draws the lens over the frame that has just been rendered. The zoomed camera is the
   * game's own camera with a view offset onto the patch under the glass, so the lens shows
   * the same board from the same angle — just closer.
   */
  render(renderer, scene, camera) {
    if (!this.on || !this.width) return;

    const span = (this.radius * 2) / MAGNIFIER.zoom;
    this.camera.copy(camera);
    // The game camera already carries a view offset of its own — the shear that slides the
    // board clear of the bar (CameraSystem.frame). Three's offsets are linear in pixels, so
    // the lens window is ADDED to it rather than replacing it; overwriting it would make
    // the lens show a patch of board a bar's height away from the one it sits on.
    const base = camera.view && camera.view.enabled ? camera.view : { offsetX: 0, offsetY: 0 };
    // Aspect is deliberately left as the game camera's. World units per pixel are then
    // equal on both axes, so a square window of pixels is a square window of board and the
    // square render target shows it undistorted.
    this.camera.setViewOffset(
      this.width,
      this.height,
      this.x - span / 2 + base.offsetX,
      this.y - span / 2 + base.offsetY,
      span,
      span
    );
    this.camera.updateProjectionMatrix();

    const previousTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.target);
    renderer.render(scene, this.camera);
    renderer.setRenderTarget(previousTarget);

    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.overlay, this.overlayCamera);
    renderer.autoClear = autoClear;
  }

  snapshot() {
    return {
      on: this.on,
      x: Math.round(this.x),
      y: Math.round(this.y),
      radius: Math.round(this.radius),
      zoom: MAGNIFIER.zoom,
    };
  }

  dispose() {
    this.target.dispose();
    for (const mesh of this.group) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
}

/** The gold rim: a band of a fixed dp thickness sitting just outside the glass. */
const ringGeometry = (radius) =>
  new THREE.RingGeometry(radius, radius + MAGNIFIER.ringWidth, 72);
