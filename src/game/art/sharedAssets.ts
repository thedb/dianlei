/**
 * One shared sprite bake for the title stills and the attract demo.
 * Battle keeps its own copy, created when a real run starts.
 */

import { createGameAssets, type GameAssets } from './index';

let cached: GameAssets | null | undefined;

/** Null in Node tests and if the canvas bake fails. */
export function sharedGameAssets(): GameAssets | null {
  if (cached !== undefined) return cached;
  if (typeof document === 'undefined') {
    cached = null;
    return null;
  }
  try {
    cached = createGameAssets();
  } catch {
    cached = null;
  }
  return cached;
}
