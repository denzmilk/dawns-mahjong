import * as THREE from 'three';
import { CELEBRATION, COLORS, ELVIS_DANCE, PARTICLES, TILE } from '../core/Constants.js';
import { isElvisFace } from '../board/BoardRules.js';
import { buildElvisSheet } from '../assets/ElvisSprite.js';

// Eight ways to clear a pair, picked at random with no immediate repeat. Clearing a
// pair is the entire reward loop of this game — 36 to 72 times a board — so the same
// flourish every time is wallpaper.
//
// All of it is scripted interpolation, not simulation (ADR-0003): each animation
// ends in exactly the same state at exactly the same time, every time, and steps
// deterministically under advanceTime().

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t) => t * t * t;
const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * Each celebration is { name, run(ctx, t) } where t runs 0 → 1. ctx carries the two
 * tile meshes, their start positions, the midpoint between them, and an emit()
 * for particles.
 */
export const CELEBRATIONS = [
  {
    // Both tiles rocket up, meet dead centre, and burst.
    name: 'rocket-collide',
    sparks: 'gold',
    run(ctx, t) {
      const rise = easeOutCubic(Math.min(1, t / 0.62));
      const converge = easeInCubic(Math.min(1, t / 0.62));
      ctx.meshes.forEach((mesh, i) => {
        const from = ctx.starts[i];
        mesh.position.x = from.x + (ctx.mid.x - from.x) * converge;
        mesh.position.z = from.z + (ctx.mid.z - from.z) * converge;
        mesh.position.y = from.y + rise * CELEBRATION.liftHeight;
        mesh.rotation.z = rise * 0.9 * (i === 0 ? 1 : -1);
        const shrink = t < 0.62 ? 1 : Math.max(0, 1 - (t - 0.62) / 0.2);
        mesh.scale.setScalar(shrink);
      });
      if (ctx.once(0.62)) {
        ctx.emit(ctx.mid.clone().setY(ctx.mid.y + CELEBRATION.liftHeight), {
          count: PARTICLES.burst * 1.4,
          speed: 7,
          spread: 1.4,
          colour: COLORS.gold,
        });
      }
    },
  },
  {
    // The tiles fracture into a grid of shards that tumble away.
    name: 'crumble',
    sparks: 'dust',
    run(ctx, t) {
      const fall = easeInCubic(t);
      ctx.shards.forEach((shard) => {
        shard.mesh.position.set(
          shard.origin.x + shard.drift.x * t * 2.2,
          shard.origin.y + shard.drift.y * t * 2.2 - fall * 6,
          shard.origin.z + shard.drift.z * t * 2.2
        );
        shard.mesh.rotation.set(
          shard.spin.x * t * 5,
          shard.spin.y * t * 5,
          shard.spin.z * t * 5
        );
        shard.mesh.scale.setScalar(Math.max(0, 1 - t * 0.7));
      });
      ctx.meshes.forEach((mesh) => mesh.scale.setScalar(0));
      if (ctx.once(0.02)) {
        for (const start of ctx.starts) {
          ctx.emit(start, { count: 14, speed: 1.6, spread: 2, colour: 0x9c8f6f, gravity: -3 });
        }
      }
    },
  },
  {
    // Straight up, then a firework at the apex.
    name: 'fireworks',
    sparks: 'multi',
    run(ctx, t) {
      const climb = easeOutCubic(Math.min(1, t / 0.45));
      ctx.meshes.forEach((mesh, i) => {
        const from = ctx.starts[i];
        mesh.position.y = from.y + climb * (CELEBRATION.liftHeight + 1.5);
        mesh.rotation.y = climb * 4;
        mesh.scale.setScalar(t < 0.45 ? 1 : Math.max(0, 1 - (t - 0.45) / 0.15));
      });
      if (ctx.once(0.45)) {
        const colours = [COLORS.gold, COLORS.elvisRed, 0x6fd3ff, 0xfff3c4];
        ctx.meshes.forEach((mesh, i) => {
          for (let ring = 0; ring < 2; ring++) {
            ctx.emit(mesh.position.clone(), {
              count: PARTICLES.burst,
              speed: 5 + ring * 3,
              spread: 1.1,
              colour: colours[(i * 2 + ring) % colours.length],
              lifespan: 1.8,
            });
          }
        });
      }
    },
  },
  {
    // Spin down to nothing with a puff of dust.
    name: 'spin-shrink',
    sparks: 'dust',
    run(ctx, t) {
      const spin = easeInOut(t);
      ctx.meshes.forEach((mesh, i) => {
        const from = ctx.starts[i];
        mesh.position.y = from.y + Math.sin(t * Math.PI) * 1.4;
        mesh.rotation.y = spin * Math.PI * 2 * CELEBRATION.spinTurns * (i === 0 ? 1 : -1);
        mesh.scale.setScalar(Math.max(0, 1 - easeInCubic(t)));
      });
      if (ctx.once(0.8)) {
        for (const start of ctx.starts) {
          ctx.emit(start, { count: 20, speed: 2.2, spread: 2.4, colour: 0xe9dcc0, gravity: -1.5 });
        }
      }
    },
  },
  {
    // Flip end over end, thinning to an invisible edge.
    name: 'flip-away',
    sparks: 'gold',
    run(ctx, t) {
      ctx.meshes.forEach((mesh, i) => {
        const from = ctx.starts[i];
        const arc = Math.sin(t * Math.PI);
        mesh.position.y = from.y + arc * 3.2;
        mesh.position.x = from.x + (i === 0 ? -1 : 1) * easeOutCubic(t) * 2.4;
        mesh.rotation.x = easeInOut(t) * Math.PI * 3;
        mesh.scale.set(1 - t * 0.3, 1, Math.max(0, 1 - easeInCubic(t)));
      });
      if (ctx.once(0.55)) {
        ctx.emit(ctx.mid, { count: 24, speed: 3.5, spread: 1.6, colour: COLORS.gold });
      }
    },
  },
  {
    // Swirl into a vortex above the board.
    name: 'vortex',
    sparks: 'gold',
    run(ctx, t) {
      const swirl = easeInCubic(t);
      ctx.meshes.forEach((mesh, i) => {
        const from = ctx.starts[i];
        const angle = swirl * Math.PI * 4 + i * Math.PI;
        const radius = (1 - swirl) * from.distanceTo(ctx.mid) + 0.4;
        mesh.position.x = ctx.mid.x + Math.cos(angle) * radius;
        mesh.position.z = ctx.mid.z + Math.sin(angle) * radius;
        mesh.position.y = from.y + swirl * 4.2;
        mesh.rotation.y = angle;
        mesh.scale.setScalar(Math.max(0, 1 - swirl));
      });
      if (ctx.once(0.9)) {
        ctx.emit(ctx.mid.clone().setY(ctx.mid.y + 4.2), {
          count: 30,
          speed: 2.5,
          spread: 0.6,
          upward: 3,
          colour: 0xfff0b8,
        });
      }
    },
  },
  {
    // Pop, with a shower of confetti.
    name: 'confetti-pop',
    sparks: 'multi',
    run(ctx, t) {
      ctx.meshes.forEach((mesh, i) => {
        const from = ctx.starts[i];
        const pop = t < 0.22 ? easeOutBack(t / 0.22) : 1;
        mesh.scale.setScalar(t < 0.3 ? 1 + pop * 0.35 : Math.max(0, 1 - (t - 0.3) / 0.18));
        mesh.position.y = from.y + pop * 0.7;
        mesh.rotation.z = pop * 0.25 * (i === 0 ? 1 : -1);
      });
      if (ctx.once(0.3)) {
        const colours = [COLORS.gold, COLORS.elvisRed, 0x8fe1b0, 0x7fb6ff, 0xfff3c4];
        ctx.meshes.forEach((mesh, i) => {
          ctx.emit(mesh.position.clone(), {
            count: PARTICLES.burst,
            speed: 6,
            spread: 1.8,
            upward: 2.5,
            colour: colours[i % colours.length],
            lifespan: 1.9,
            gravity: -5,
          });
        });
      }
    },
  },
  {
    // The Elvis one: he steps into a cone of light, dances, and is gone in a shower of
    // rhinestones. Reserved for pairs of Elvis tiles, and unmistakable when it lands.
    name: 'elvis-spotlight',
    sparks: 'rhinestone',
    elvisOnly: true,
    run(ctx, t) {
      // The tiles get out of his way rather than competing with him: up and out to the
      // sides, where before they strutted through the middle of the shot.
      ctx.meshes.forEach((mesh, i) => {
        const from = ctx.starts[i];
        const strut = easeOutCubic(Math.min(1, t / 0.5));
        mesh.position.y = from.y + strut * 2.6;
        mesh.position.x = from.x + (i === 0 ? -1 : 1) * strut * 1.5;
        mesh.rotation.y = strut * Math.PI * 2;
        mesh.rotation.z = Math.sin(t * Math.PI * 4) * 0.22 * (i === 0 ? 1 : -1);
        mesh.scale.setScalar(t < 0.66 ? 1 + strut * 0.22 : Math.max(0, 1 - (t - 0.66) / 0.34));
      });
      if (ctx.spotlight) {
        ctx.spotlight.visible = t < 0.9;
        // Low enough that the pool of light lands where he is standing. It used to sit at
        // +7, which put the whole cone above the board lighting nothing in particular.
        ctx.spotlight.position.set(ctx.mid.x, ctx.mid.y + 3.4, ctx.mid.z);
        ctx.spotlight.material.opacity = Math.sin(Math.min(1, t / 0.9) * Math.PI) * 0.34;
        ctx.spotlight.rotation.y = t * 3;
      }
      if (ctx.dancer) ctx.dancer.play(ctx.mid, t);
      if (ctx.once(0.18) || ctx.once(0.52)) {
        for (const start of ctx.starts) {
          ctx.emit(start.clone().setY(start.y + 2), {
            count: 26,
            speed: 4.5,
            spread: 1.5,
            upward: 1.5,
            colour: 0xffffff,
            lifespan: 1.6,
            size: PARTICLES.size * 1.2,
          });
        }
      }
    },
  },
];

/** Which celebration to play next: never the same one twice in a row. */
export function pickCelebration(faces, lastName, rng = Math.random) {
  const elvisPair = faces.every(isElvisFace);
  // An Elvis pair always gets the Elvis one — it is the reward for finding them.
  if (elvisPair) return CELEBRATIONS.find((c) => c.name === 'elvis-spotlight');

  const pool = CELEBRATIONS.filter((c) => !c.elvisOnly && c.name !== lastName);
  return pool[Math.floor(rng() * pool.length)];
}

/**
 * Builds the shard meshes a "crumble" needs: the tile top sliced into a grid, each
 * piece carrying the same UVs as the region of the face it came from.
 */
export function buildShards(mesh, parent) {
  const n = CELEBRATION.shardGrid;
  const shards = [];
  const w = (TILE.width - TILE.gap) / n;
  const d = (TILE.depth - TILE.gap) / n;

  for (let ix = 0; ix < n; ix++) {
    for (let iz = 0; iz < n; iz++) {
      const geometry = new THREE.BoxGeometry(w, TILE.thickness, d);
      const shard = new THREE.Mesh(geometry, mesh.material);
      const offsetX = (ix - (n - 1) / 2) * w;
      const offsetZ = (iz - (n - 1) / 2) * d;
      shard.position.set(mesh.position.x + offsetX, mesh.position.y, mesh.position.z + offsetZ);
      shard.castShadow = false;
      parent.add(shard);
      shards.push({
        mesh: shard,
        origin: shard.position.clone(),
        drift: new THREE.Vector3(offsetX * 1.6, 0.4 + Math.random() * 0.6, offsetZ * 1.6),
        spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5),
      });
    }
  }
  return shards;
}

/**
 * The dancing Elvis: one camera-facing quad showing one frame of the sprite sheet at a
 * time. Built once and reused, like the spotlight — a celebration that allocates is a
 * celebration that stutters on the 40th repetition.
 */
export class ElvisDancer {
  constructor() {
    this.texture = new THREE.CanvasTexture(buildElvisSheet());
    this.texture.colorSpace = THREE.SRGBColorSpace;
    // One cell of the strip at a time, stepped by offset.x.
    this.texture.repeat.set(1 / ELVIS_DANCE.frames, 1);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;

    // Unit-height geometry, scaled to the view in setViewHeight — so a new board or a
    // rotation never rebuilds a buffer.
    this.height = 1;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(ELVIS_DANCE.cellWidth / ELVIS_DANCE.cellHeight, 1),
      new THREE.MeshBasicMaterial({
        map: this.texture,
        transparent: true,
        // Drawn over the board rather than into it. He is a flourish in a spotlight, and
        // the alternative — Elvis buried to the waist in a stack of tiles — is worse than
        // the depth being wrong.
        depthTest: false,
        depthWrite: false,
      })
    );
    this.mesh.renderOrder = 12;
    this.mesh.visible = false;
    this.frame = 0;
  }

  /** Faces the fixed camera, so "up" on the drawing is up on her screen. */
  faceCamera(camera) {
    this.mesh.quaternion.copy(camera.quaternion);
  }

  /**
   * Sizes him against what the camera can see rather than against the board's own units.
   * `viewHeight` is the world height of the frustum where the board sits, so he comes out
   * the same size on screen whether he is dancing on a 4-column board or a 12-column one.
   */
  setViewHeight(viewHeight) {
    this.height = viewHeight * ELVIS_DANCE.heightOfView;
    this.mesh.scale.setScalar(this.height);
  }

  /**
   * Keeps him on the board. He dances where the pair was, which connects the flourish to
   * what she just did — but a pair in the corner put him half off the edge of the screen,
   * which is a poor reward for finding the two hardest tiles on the board.
   */
  setBounds(bounds) {
    this.bounds = bounds;
  }

  /**
   * One step of the dance. `t` is the celebration's own 0 → 1, so the whole thing steps
   * deterministically under advanceTime() like everything else (ADR-0003).
   */
  play(mid, t) {
    const visible = t >= ELVIS_DANCE.fadeIn && t < ELVIS_DANCE.fadeOut;
    this.mesh.visible = visible;
    if (!visible) return;

    this.frame =
      Math.floor(t * CELEBRATION.duration * ELVIS_DANCE.fps) % ELVIS_DANCE.frames;
    this.texture.offset.x = this.frame / ELVIS_DANCE.frames;

    const half = (this.height * ELVIS_DANCE.cellWidth) / ELVIS_DANCE.cellHeight / 2;
    this.mesh.position.set(
      clamp(mid.x, this.bounds?.min.x, this.bounds?.max.x, half),
      mid.y + this.height * (0.5 - ELVIS_DANCE.footLift),
      clamp(mid.z, this.bounds?.min.z, this.bounds?.max.z, half)
    );
    // In fast, out fast, full strength in between — he should look like he arrived, not
    // like he faded up.
    const span = ELVIS_DANCE.fadeOut - ELVIS_DANCE.fadeIn;
    const local = (t - ELVIS_DANCE.fadeIn) / span;
    this.mesh.material.opacity = Math.min(1, Math.min(local, 1 - local) * 7);
  }

  hide() {
    this.mesh.visible = false;
  }

  snapshot() {
    return { visible: this.mesh.visible, frame: this.frame, frames: ELVIS_DANCE.frames };
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.texture.dispose();
  }
}

/**
 * Holds a value inside [min + inset, max - inset]. A board narrower than he is wide leaves
 * no room to clamp into, so he goes to the middle of it rather than to a nonsense edge.
 */
function clamp(value, min, max, inset) {
  if (min === undefined || max === undefined) return value;
  const low = min + inset;
  const high = max - inset;
  if (low >= high) return (min + max) / 2;
  return Math.min(high, Math.max(low, value));
}

/**
 * The cone of light the Elvis celebration sweeps across the board.
 *
 * Narrower and dimmer than it was. Once the cone was lowered so its pool actually lands on
 * the board, a 2.4-radius cone at half opacity blew out most of a small board — and the
 * whole point of the light is to pick one man out of the dark, not to floodlight the table.
 */
export function buildSpotlight() {
  const geometry = new THREE.ConeGeometry(1.7, 7, 24, 1, true);
  const material = new THREE.MeshBasicMaterial({
    color: 0xfff6d0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const cone = new THREE.Mesh(geometry, material);
  cone.visible = false;
  return cone;
}
