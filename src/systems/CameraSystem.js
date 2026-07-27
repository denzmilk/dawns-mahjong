import * as THREE from 'three';
import { CAMERA } from '../core/Constants.js';

// The camera is fixed: a constant tilt, framed to fit the whole board, and it
// never responds to input (ADR-0002 constraint 1). The only thing that moves it
// is a viewport change.

export class CameraSystem {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
    this.target = new THREE.Vector3();
    this.distance = 10;
    // Tilt is measured off vertical, so 0° would be straight down.
    const tilt = THREE.MathUtils.degToRad(CAMERA.tiltDegrees);
    this.direction = new THREE.Vector3(0, Math.cos(tilt), Math.sin(tilt)).normalize();
  }

  /**
   * Fit the board in view. Places the camera along the fixed tilt direction and solves
   * for the pushback distance that brings every given point inside the frustum —
   * pushing back along the view axis leaves camera-space X and Y untouched, so the
   * required distance is exact rather than iterated.
   *
   * It takes the actual corners of the actual tiles, not a bounding box. A box reserves
   * room for its corners, and on a stacked board the corner "top layer, far edge" holds
   * no tile at all — fitting to it cost about 4% of tile size on every multi-layer
   * board, which is the difference between clearing the 64 dp touch floor and not.
   */
  frame(points, centre, width, height, inset = { top: 0, bottom: 0 }) {
    // The bar covers a strip of the screen, so the board is fitted to what is left and
    // then slid clear of it. Both halves are needed: fitting alone leaves the board
    // centred on the canvas (still under the bar), and sliding alone makes it overflow
    // the opposite edge.
    const usable = Math.max(160, height - inset.top - inset.bottom);
    this.camera.aspect = width / height;
    this.target.copy(centre);

    this.camera.position.copy(this.target).addScaledVector(this.direction, 1);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld(true);

    const tanFull = Math.tan(THREE.MathUtils.degToRad(CAMERA.fov) / 2);
    const tanV = tanFull * (usable / height);
    const tanH = tanFull * this.camera.aspect;
    const inverse = new THREE.Matrix4().copy(this.camera.matrixWorld).invert();
    const corner = new THREE.Vector3();

    let pushback = 0;
    for (const point of points) {
      corner.copy(point).applyMatrix4(inverse);
      // Points in front of the camera have negative z in camera space.
      pushback = Math.max(
        pushback,
        Math.abs(corner.x) / tanH + corner.z,
        Math.abs(corner.y) / tanV + corner.z
      );
    }

    this.distance = (1 + pushback) * CAMERA.margin;

    // Slide the board into the middle of the usable strip. Screen-up is -z for this fixed
    // camera, so a bar at the bottom (inset.bottom) moves the board towards -z.
    const shiftPixels = (inset.top - inset.bottom) / 2;
    const worldPerPixel = (2 * tanFull * this.distance) / height;
    this.target.z -= shiftPixels * worldPerPixel;

    this.camera.position.copy(this.target).addScaledVector(this.direction, this.distance);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
  }

  snapshot() {
    return {
      tiltDegrees: CAMERA.tiltDegrees,
      distance: round(this.distance),
      target: { x: round(this.target.x), y: round(this.target.y), z: round(this.target.z) },
    };
  }
}

const round = (n) => Math.round(n * 1000) / 1000;
