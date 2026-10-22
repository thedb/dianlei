/**
 * Seeded random numbers for gameplay.
 * Every gameplay draw goes through an injected `Rng`, so a fixed seed plus a
 * fixed input script replays the same run. `Math.random` is not used for
 * gameplay; audio noise buffers are the only remaining caller.
 */

/** Uniform in [0, 1), like `Math.random`. */
export type Rng = () => number;

/** mulberry32: small, fast, and good enough for drops and demo routes. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seed for a session that was not given one. Wall clock only. */
export function clockSeed(): number {
  return Date.now() >>> 0;
}
