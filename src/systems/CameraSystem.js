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
   * Fit the board in view. Places the camera along the fixed tilt direction and
   * solves for the pushback distance that brings every corner of the board's
   * bounding box inside the frustum — pushing back along the view axis leaves
   * camera-space X and Y untouched, so the required distance is exact rather
   * than iterated.
   */
  frame(bounds, width, height) {
    const aspect = width / height;
    this.camera.aspect = aspect;
    bounds.getCenter(this.target);

    this.camera.position.copy(this.target).addScaledVector(this.direction, 1);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld(true);

    const tanV = Math.tan(THREE.MathUtils.degToRad(CAMERA.fov) / 2);
    const tanH = tanV * aspect;
    const inverse = new THREE.Matrix4().copy(this.camera.matrixWorld).invert();
    const corner = new THREE.Vector3();

    let pushback = 0;
    for (const cx of [bounds.min.x, bounds.max.x]) {
      for (const cy of [bounds.min.y, bounds.max.y]) {
        for (const cz of [bounds.min.z, bounds.max.z]) {
          corner.set(cx, cy, cz).applyMatrix4(inverse);
          // Points in front of the camera have negative z in camera space.
          pushback = Math.max(
            pushback,
            Math.abs(corner.x) / tanH + corner.z,
            Math.abs(corner.y) / tanV + corner.z
          );
        }
      }
    }

    this.distance = (1 + pushback) * CAMERA.margin;
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
