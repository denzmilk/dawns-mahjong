/**
 * mulberry32 — small, fast, seedable. Board generation takes its randomness as an
 * argument rather than calling Math.random() internally, so a board that turns out
 * to be broken can be reproduced exactly from its seed instead of being described
 * from memory.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh unseeded generator, for a board she hasn't played before. */
export function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff);
}
