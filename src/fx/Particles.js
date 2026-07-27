import * as THREE from 'three';
import { PARTICLES } from '../core/Constants.js';

// One pooled THREE.Points system for every burst in the game. Pooled because
// creating and destroying geometry per celebration is exactly what drops frames on
// a mid-range tablet GPU, and this fires on every matched pair.

export class Particles {
  constructor(scene) {
    this.count = PARTICLES.poolSize;
    this.cursor = 0;

    this.positions = new Float32Array(this.count * 3);
    this.colors = new Float32Array(this.count * 3);
    this.sizes = new Float32Array(this.count);
    this.velocities = new Float32Array(this.count * 3);
    this.life = new Float32Array(this.count);
    this.maxLife = new Float32Array(this.count);
    this.gravity = new Float32Array(this.count);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    // Additive so overlapping sparks brighten rather than muddy, and depth-write
    // off so they never punch holes in each other.
    this.material = new THREE.PointsMaterial({
      size: PARTICLES.size,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      map: sparkTexture(),
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.geometry = geometry;
    this.active = 0;
  }

  /**
   * Emit a burst. `spread` shapes the initial velocity cone: 1 is a ball, higher
   * values fling outward, and `upward` biases it skyward for fireworks.
   */
  emit(origin, {
    count = PARTICLES.burst,
    colour = 0xe8c547,
    speed = 4,
    spread = 1,
    upward = 0,
    lifespan = PARTICLES.lifespan,
    gravity = PARTICLES.gravity,
    size = PARTICLES.size,
  } = {}) {
    const tint = new THREE.Color(colour);
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;

      this.positions[i * 3] = origin.x;
      this.positions[i * 3 + 1] = origin.y;
      this.positions[i * 3 + 2] = origin.z;

      // Random direction on a sphere, then stretched by spread/upward.
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const magnitude = speed * (0.45 + Math.random() * 0.55);
      this.velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * magnitude * spread;
      this.velocities[i * 3 + 1] = Math.cos(phi) * magnitude + upward;
      this.velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * magnitude * spread;

      // A little colour jitter stops a burst reading as one flat blob.
      this.colors[i * 3] = Math.min(1, tint.r * (0.8 + Math.random() * 0.4));
      this.colors[i * 3 + 1] = Math.min(1, tint.g * (0.8 + Math.random() * 0.4));
      this.colors[i * 3 + 2] = Math.min(1, tint.b * (0.8 + Math.random() * 0.4));

      this.sizes[i] = size * (0.6 + Math.random() * 0.8);
      this.maxLife[i] = lifespan * (0.7 + Math.random() * 0.6);
      this.life[i] = this.maxLife[i];
      this.gravity[i] = gravity;
    }
    this.recount();
  }

  update(delta) {
    let alive = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= delta;
      if (this.life[i] <= 0) {
        // Park dead particles far below the table rather than paying for a
        // compaction pass every frame.
        this.positions[i * 3 + 1] = -1000;
        this.sizes[i] = 0;
        continue;
      }
      alive++;

      this.velocities[i * 3 + 1] += this.gravity[i] * delta;
      const drag = Math.pow(PARTICLES.drag, delta * 60);
      this.velocities[i * 3] *= drag;
      this.velocities[i * 3 + 2] *= drag;

      this.positions[i * 3] += this.velocities[i * 3] * delta;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * delta;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * delta;

      // Fade out by shrinking: PointsMaterial has no per-point alpha.
      const t = this.life[i] / this.maxLife[i];
      this.sizes[i] = Math.max(0, this.sizes[i] * (0.9 + t * 0.1));
    }

    this.active = alive;
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
    return alive > 0;
  }

  recount() {
    let alive = 0;
    for (let i = 0; i < this.count; i++) if (this.life[i] > 0) alive++;
    this.active = alive;
  }

  clear() {
    this.life.fill(0);
    this.sizes.fill(0);
    for (let i = 0; i < this.count; i++) this.positions[i * 3 + 1] = -1000;
    this.active = 0;
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.map?.dispose();
    this.material.dispose();
  }
}

/** A soft round spark, drawn once into a canvas rather than shipped as a file. */
function sparkTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
