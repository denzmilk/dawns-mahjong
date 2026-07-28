import { ELVIS_DANCE } from '../core/Constants.js';

// A little 2D Elvis, drawn rather than photographed, for the spotlight celebration.
//
// Everything else in this game that shows Elvis uses Chris's photographs. This one can't:
// a dancing figure needs poses that no still has, and there are no Elvis recordings or
// footage in this project by design (docs/tech.md → Licensing). So he is drawn here, as a
// stylised figure — the white jumpsuit, the collar, the quiff, the mic — which sits beside
// the photographs as an obvious cartoon rather than competing with them.
//
// Drawn ONCE into a sprite sheet at boot, not re-rendered per frame. A canvas redrawn every
// frame means a texture upload every frame, which is exactly the kind of thing that drops
// frames on a mid-range tablet GPU. Eight poses cost one upload and then nothing.
//
// Built from a skeleton rather than eight hand-drawn pictures, so the cycle is smooth and a
// change to his proportions is one number rather than eight redraws.

const TAU = Math.PI * 2;

// Heights as a fraction of his full height, measured from the floor. These are the whole
// design: get the proportions right and the figure reads even as a 40 px silhouette.
const RIG = {
  foot: 0.02,
  knee: 0.24,
  hip: 0.46,
  waist: 0.54,
  chest: 0.68,
  shoulder: 0.76,
  chin: 0.815,
  head: 0.875,
  headRadius: 0.072,
  shoulderX: 0.115,
  hipX: 0.072,
};

const SKIN = '#e9b98d';
const HAIR = '#17120f';
const SUIT = '#f7f2e4';
const SUIT_SHADE = '#d9d0b8';
const TRIM = '#e8c547';
const MIC = '#2b2b31';
const MIC_HEAD = '#cbd0d8';
const INK = '#241d17';

/**
 * The pose at a point in the dance cycle, `p` running 0 → 1.
 *
 * The move is the knee-wobble: feet planted wide, knees swinging together and apart, hips
 * going the other way to the shoulders. That opposition is the whole thing — without it a
 * figure sways, and swaying does not read as dancing at any frame rate. The first attempt
 * at this was too polite and eight frames came out nearly identical.
 */
function pose(p) {
  const swing = Math.sin(p * TAU);
  const bounce = (Math.cos(p * TAU * 2) + 1) / 2;
  // A shoulder roll, a quarter-turn out of phase with the hips.
  //
  // This is not decoration. Both terms above are symmetric about the extremes of the
  // swivel, so without something in quadrature the second half of the cycle is the first
  // half played backwards: eight frames collapsed to five distinct poses, and the dance
  // came out as a mechanical there-and-back. Cosine against their sine is what makes the
  // loop go round rather than bounce.
  const roll = Math.cos(p * TAU);
  return {
    swing,
    bounce,
    roll,
    hipX: 0.075 * swing,
    // He drops on the bounce; the whole figure moves, not just the legs.
    drop: 0.03 * bounce,
    // Shoulders lead the hips the other way.
    shoulderX: -0.05 * swing,
    lean: 0.16 * swing,
    // The free arm comes up and points on the outward swing, and tucks in on the way back.
    // Offset a quarter turn so the point peaks between the hip extremes rather than on
    // them, which is both livelier and part of what keeps the eight poses distinct.
    point: Math.max(0, Math.sin(p * TAU + Math.PI / 4)),
    micBob: 0.016 * bounce + 0.01 * roll,
    headTilt: 0.17 * swing - 0.05 * roll,
  };
}

/** A limb: a thick rounded stroke, outlined so it reads against a bright spotlight. */
function limb(ctx, points, width, colour) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + 0.018;
  ctx.stroke();
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.stroke();
}

function outlinedPath(ctx, build, fill) {
  ctx.beginPath();
  build();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.016;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/**
 * Draws one frame into a context already scaled so that x runs -0.5 → 0.5 across his width
 * and y runs 0 (floor) → 1 (top of the quiff), with y pointing UP.
 *
 * Draw order is load-bearing. The mic and the hand holding it go on LAST, after the head:
 * they sit at chin height, and the collar wings are wide enough to swallow them completely
 * if the head is drawn on top.
 */
function drawElvis(ctx, p) {
  const s = pose(p);
  const hipY = RIG.hip - s.drop;
  const shoulderY = RIG.shoulder - s.drop;
  const headY = RIG.head - s.drop;

  const hip = (side) => [s.hipX + side * RIG.hipX, hipY];
  // One shoulder rides higher than the other as he rolls them.
  const shoulder = (side) => [
    s.shoulderX + side * RIG.shoulderX,
    shoulderY + side * 0.022 * s.roll,
  ];

  // --- legs, as one shape per leg from hip to ankle. Drawn as a single tapering outline
  // rather than a thigh plus a separate flare, which left a visible seam at the knee.
  //
  // Feet stay planted where they are and the KNEES swing. That is the move.
  for (const side of [-1, 1]) {
    const [hx, hy] = hip(side);
    const kneeX = s.hipX * 0.5 + side * 0.055 + s.swing * 0.045;
    const kneeY = RIG.knee - s.drop * 0.4;
    const footX = side * 0.15;
    const footY = RIG.foot;

    outlinedPath(
      ctx,
      () => {
        ctx.moveTo(hx - 0.055, hy + 0.01);
        ctx.quadraticCurveTo(kneeX - 0.05, kneeY, footX - 0.085, footY);
        ctx.lineTo(footX + 0.085, footY);
        ctx.quadraticCurveTo(kneeX + 0.05, kneeY, hx + 0.055, hy + 0.01);
        ctx.closePath();
      },
      SUIT
    );
    // A crease down the flare, so the trouser reads as fabric rather than a paddle.
    ctx.beginPath();
    ctx.moveTo(kneeX, kneeY + 0.06);
    ctx.quadraticCurveTo(kneeX, kneeY - 0.08, footX, footY + 0.015);
    ctx.strokeStyle = SUIT_SHADE;
    ctx.lineWidth = 0.012;
    ctx.stroke();
    // Shoe.
    outlinedPath(
      ctx,
      () => ctx.ellipse(footX + side * 0.018, footY - 0.006, 0.068, 0.028, 0, 0, TAU),
      INK
    );
  }

  // --- torso: hips to shoulders, tapered, with the deep V of the jumpsuit.
  outlinedPath(
    ctx,
    () => {
      ctx.moveTo(...hip(-1));
      ctx.lineTo(...hip(1));
      ctx.lineTo(shoulder(1)[0] + 0.01, shoulder(1)[1]);
      ctx.lineTo(shoulder(-1)[0] - 0.01, shoulder(-1)[1]);
      ctx.closePath();
    },
    SUIT
  );
  // The V, open to the chest.
  outlinedPath(
    ctx,
    () => {
      ctx.moveTo(shoulder(-1)[0] + 0.03, shoulder(-1)[1]);
      ctx.lineTo(s.shoulderX, RIG.chest - s.drop - 0.06);
      ctx.lineTo(shoulder(1)[0] - 0.03, shoulder(1)[1]);
    },
    SKIN
  );
  // Gold belt.
  outlinedPath(
    ctx,
    () => {
      const [bx] = hip(0);
      ctx.rect(bx - 0.105, RIG.waist - s.drop - 0.03, 0.21, 0.052);
    },
    TRIM
  );

  // --- the free arm. Up and pointing on the outward swing, tucked in on the way back —
  // the one gesture everyone does when they imitate him.
  const [fsx, fsy] = shoulder(-1);
  const freeElbow = [fsx - 0.09, fsy - 0.06 + 0.09 * s.point];
  // The reach is capped by the cell, not by taste: at 0.42 the pointing hand went over the
  // top of its own frame and came out sliced off.
  const freeHand = [fsx - 0.1 - 0.07 * s.point, fsy - 0.16 + 0.36 * s.point];
  limb(ctx, [[fsx, fsy], freeElbow, freeHand], 0.062, SUIT);
  outlinedPath(ctx, () => ctx.arc(freeHand[0], freeHand[1], 0.032, 0, TAU), SKIN);

  // --- the mic arm, elbow down and hand up at his mouth. Kept out to the side of the
  // collar rather than in front of it, so the mic is never lost against the white.
  const [msx, msy] = shoulder(1);
  const micHand = [s.shoulderX + 0.135, RIG.chin - s.drop + 0.005 + s.micBob];
  const micElbow = [msx + 0.085, msy - 0.12];
  limb(ctx, [[msx, msy], micElbow, micHand], 0.062, SUIT);

  // --- head, tilted with the swivel.
  ctx.save();
  ctx.translate(s.shoulderX * 0.7, headY);
  ctx.rotate(-s.headTilt);

  // Neck first, so the collar covers where it meets the body.
  limb(ctx, [[0, -RIG.headRadius], [0, -RIG.headRadius - 0.045]], 0.05, SKIN);

  // The collar: the big upturned wings, which are most of what says "Elvis" at this size.
  for (const side of [-1, 1]) {
    outlinedPath(
      ctx,
      () => {
        ctx.moveTo(side * 0.02, -0.1);
        ctx.quadraticCurveTo(side * 0.14, -0.12, side * 0.15, 0.03);
        ctx.quadraticCurveTo(side * 0.1, -0.03, side * 0.03, -0.05);
        ctx.closePath();
      },
      SUIT_SHADE
    );
  }

  outlinedPath(ctx, () => ctx.ellipse(0, 0, RIG.headRadius * 0.92, RIG.headRadius, 0, 0, TAU), SKIN);

  // Sideburns — the other half of the silhouette.
  for (const side of [-1, 1]) {
    outlinedPath(
      ctx,
      () => {
        ctx.moveTo(side * 0.058, 0.03);
        ctx.lineTo(side * 0.072, -0.035);
        ctx.lineTo(side * 0.044, -0.03);
        ctx.closePath();
      },
      HAIR
    );
  }

  // The quiff, swept up and over.
  outlinedPath(
    ctx,
    () => {
      ctx.moveTo(-0.07, 0.02);
      ctx.quadraticCurveTo(-0.085, 0.085, -0.01, 0.098);
      ctx.quadraticCurveTo(0.075, 0.112, 0.088, 0.045);
      ctx.quadraticCurveTo(0.095, -0.005, 0.062, 0.015);
      ctx.quadraticCurveTo(0.03, 0.045, -0.07, 0.02);
      ctx.closePath();
    },
    HAIR
  );

  // Eyes and the lip. Tiny, but a face with nothing on it reads as a mannequin.
  ctx.fillStyle = INK;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 0.028, 0.012, 0.009, 0.006, 0, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(-0.018, -0.032);
  ctx.quadraticCurveTo(0.004, -0.05, 0.026, -0.026);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.009;
  ctx.stroke();
  ctx.restore();

  // --- the mic, LAST. A dark handle with a silver ball and a cord trailing to the floor,
  // drawn over the head so the collar can't swallow it.
  ctx.beginPath();
  ctx.moveTo(micHand[0] + 0.015, micHand[1] - 0.02);
  ctx.quadraticCurveTo(micHand[0] + 0.22, micHand[1] - 0.4, s.hipX + 0.2, RIG.foot + 0.01);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.012;
  ctx.stroke();

  limb(
    ctx,
    [[micHand[0] - 0.012, micHand[1] - 0.04], [micHand[0] + 0.012, micHand[1] + 0.05]],
    0.038,
    MIC
  );
  outlinedPath(ctx, () => ctx.arc(micHand[0] + 0.016, micHand[1] + 0.068, 0.033, 0, TAU), MIC_HEAD);
  outlinedPath(ctx, () => ctx.arc(micHand[0], micHand[1], 0.032, 0, TAU), SKIN);
}

/**
 * The whole cycle as one horizontal strip of frames. Returns the canvas; the caller turns
 * it into a texture and steps `offset.x` to pick a frame.
 */
export function buildElvisSheet({
  frames = ELVIS_DANCE.frames,
  cellWidth = ELVIS_DANCE.cellWidth,
  cellHeight = ELVIS_DANCE.cellHeight,
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = cellWidth * frames;
  canvas.height = cellHeight;
  const ctx = canvas.getContext('2d');

  for (let frame = 0; frame < frames; frame++) {
    ctx.save();
    // Into the cell, then into figure space: x -0.5 → 0.5, y 0 at the floor and pointing up.
    ctx.translate(frame * cellWidth + cellWidth / 2, cellHeight);
    ctx.scale(cellWidth, -cellHeight);
    // Margin for the widest and tallest pose — arm up and pointing, mic cord swinging out.
    // Sized against those, not against a figure standing still.
    ctx.scale(0.84, 0.9);
    // Lifted off the bottom edge so the outline around his shoes isn't shaved off — the
    // texture clamps, and a shaved edge smears sideways when it is filtered.
    ctx.translate(0, 0.045);
    drawElvis(ctx, frame / frames);
    ctx.restore();
  }
  return canvas;
}
