import { describe, expect, it } from 'vitest';
import { PALETTE, COLOR } from '@/game/palette';
import {
  createPlayerFrameData,
  createPlayerNozzles,
  getBankFrameIndex,
  PLAYER_SPRITE_W,
  PLAYER_SPRITE_H,
} from './playerSprite';

const frames = createPlayerFrameData();
const CENTER = 5;

/** Leftmost / rightmost opaque columns over the whole frame */
function extents(frame: number[][]): { left: number; right: number } {
  let left = Infinity;
  let right = -Infinity;
  frame.forEach((row) =>
    row.forEach((v, x) => {
      if (v >= 0) {
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    })
  );
  return { left, right };
}

describe('player sprite frames', () => {
  it('has 11 frames of exactly 28x32', () => {
    expect(frames).toHaveLength(11);
    for (const f of frames) {
      expect(f).toHaveLength(PLAYER_SPRITE_H);
      for (const row of f) expect(row).toHaveLength(PLAYER_SPRITE_W);
    }
  });

  it('only uses locked palette indices', () => {
    for (const f of frames) {
      for (const row of f) {
        for (const v of row) {
          expect(v === -1 || (Number.isInteger(v) && v >= 0 && v < PALETTE.length)).toBe(true);
        }
      }
    }
  });

  it('center frame is left-right symmetric in silhouette', () => {
    const c = frames[CENTER]!;
    for (const row of c) {
      const mask = row.map((v) => v >= 0);
      expect(mask).toEqual([...mask].reverse());
    }
  });

  it('left frames mirror the right frames', () => {
    for (let i = 1; i <= 5; i++) {
      const left = frames[CENTER - i]!;
      const right = frames[CENTER + i]!;
      expect(left).toEqual(right.map((row) => [...row].reverse()));
    }
  });

  it('deep bank has a large near wing and a thin far wing sliver', () => {
    const mid = PLAYER_SPRITE_W / 2;
    const center = extents(frames[CENTER]!);
    const deep = extents(frames[10]!);
    const nearSpan = mid - deep.left;
    const farSpan = deep.right + 1 - mid;
    expect(nearSpan).toBeGreaterThanOrEqual(mid - center.left);
    expect(farSpan).toBeLessThanOrEqual(nearSpan / 2);
  });

  it('keeps the nose pointing up in every frame', () => {
    for (const f of frames) {
      const topRow = f.findIndex((row) => row.some((v) => v >= 0));
      expect(topRow).toBeLessThanOrEqual(1);
    }
  });

  it('shows the red spine in every frame', () => {
    for (const f of frames) {
      const reds = f.flat().filter((v) => v === COLOR.ENEMY_RED || v === COLOR.ENEMY_BRIGHT_RED);
      expect(reds.length).toBeGreaterThan(4);
    }
  });

  it('does not bake engine flames into the sprite', () => {
    const flameColors = [COLOR.EXPLOSION_YELLOW, COLOR.EXPLOSION_ORANGE];
    for (const f of frames) {
      expect(f.flat().some((v) => flameColors.includes(v as never))).toBe(false);
    }
  });

  it('provides two nozzles per frame', () => {
    const nozzles = createPlayerNozzles();
    expect(nozzles).toHaveLength(11);
    for (const n of nozzles) expect(n).toHaveLength(2);
  });

  it('maps bank values to frame indices', () => {
    expect(getBankFrameIndex(-1)).toBe(0);
    expect(getBankFrameIndex(0)).toBe(5);
    expect(getBankFrameIndex(1)).toBe(10);
  });
});
