/**
 * Explosion sprites - small, medium, large explosions
 * Design doc §10.3: small 4 frames, medium 6 frames, large 8 frames
 */

import type { SizeClass } from '@/game/entities/objectClass';
import { COLOR } from '@/game/palette';
import { createGrid, plot } from './pixelDraw';
import type { SpriteData, SpriteFrame } from './types';
import { renderSprite } from './spriteRenderer';

// Shorthand
const _ = -1;
// Reserved: const _K = COLOR.BLACK;
const W = COLOR.WHITE;
const G = COLOR.GRAY;
const DG = COLOR.DARK_GRAY;

const EY = COLOR.EXPLOSION_YELLOW;
const EO = COLOR.EXPLOSION_ORANGE_YELLOW;
const EX = COLOR.EXPLOSION_ORANGE;
// Reserved: const _ER = COLOR.EXPLOSION_RED_ORANGE;

/**
 * Small explosion frames (16x16, 4 frames)
 */
const SMALL_EXPLOSION_1 = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, W, W, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, W, EY, EY, W, _, _, _, _, _, _],
  [_, _, _, _, _, W, EY, EY, EY, EY, W, _, _, _, _, _],
  [_, _, _, _, _, W, EY, EY, EY, EY, W, _, _, _, _, _],
  [_, _, _, _, _, _, W, EY, EY, W, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, W, W, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const SMALL_EXPLOSION_2 = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, W, W, _, _, _, _, _, _, _],
  [_, _, _, _, _, W, W, EY, EY, W, W, _, _, _, _, _],
  [_, _, _, _, W, EY, EY, EY, EY, EY, EY, W, _, _, _, _],
  [_, _, _, W, EY, EY, EO, EO, EO, EO, EY, EY, W, _, _, _],
  [_, _, _, W, EY, EO, EO, W, W, EO, EO, EY, W, _, _, _],
  [_, _, _, W, EY, EO, EO, W, W, EO, EO, EY, W, _, _, _],
  [_, _, _, W, EY, EY, EO, EO, EO, EO, EY, EY, W, _, _, _],
  [_, _, _, _, W, EY, EY, EY, EY, EY, EY, W, _, _, _, _],
  [_, _, _, _, _, W, W, EY, EY, W, W, _, _, _, _, _],
  [_, _, _, _, _, _, _, W, W, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const SMALL_EXPLOSION_3 = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, W, _, _, W, _, _, _, _, _, _],
  [_, _, _, _, _, W, EX, W, W, EX, W, _, _, _, _, _],
  [_, _, _, _, W, EX, EO, EY, EY, EO, EX, W, _, _, _, _],
  [_, _, _, W, EX, EO, EY, EY, EY, EY, EO, EX, W, _, _, _],
  [_, _, W, EX, EO, EY, EY, W, W, EY, EY, EO, EX, W, _, _],
  [_, W, EX, EO, EY, EY, W, DG, DG, W, EY, EY, EO, EX, W, _],
  [_, _, W, EY, EY, W, DG, G, G, DG, W, EY, EY, W, _, _],
  [_, _, W, EY, EY, W, DG, G, G, DG, W, EY, EY, W, _, _],
  [_, W, EX, EO, EY, EY, W, DG, DG, W, EY, EY, EO, EX, W, _],
  [_, _, W, EX, EO, EY, EY, W, W, EY, EY, EO, EX, W, _, _],
  [_, _, _, W, EX, EO, EY, EY, EY, EY, EO, EX, W, _, _, _],
  [_, _, _, _, W, EX, EO, EY, EY, EO, EX, W, _, _, _, _],
  [_, _, _, _, _, W, EX, W, W, EX, W, _, _, _, _, _],
  [_, _, _, _, _, _, W, _, _, W, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const SMALL_EXPLOSION_4 = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, DG, _, _, DG, _, _, _, _, _, _],
  [_, _, _, _, _, DG, G, DG, DG, G, DG, _, _, _, _, _],
  [_, _, _, _, DG, G, DG, DG, DG, DG, G, DG, _, _, _, _],
  [_, _, _, DG, G, DG, DG, G, G, DG, DG, G, DG, _, _, _],
  [_, _, DG, G, DG, DG, G, G, G, G, DG, DG, G, DG, _, _],
  [_, _, _, DG, DG, G, G, G, G, G, G, DG, DG, _, _, _],
  [_, _, _, DG, DG, G, G, G, G, G, G, DG, DG, _, _, _],
  [_, _, DG, G, DG, DG, G, G, G, G, DG, DG, G, DG, _, _],
  [_, _, _, DG, G, DG, DG, G, G, DG, DG, G, DG, _, _, _],
  [_, _, _, _, DG, G, DG, DG, DG, DG, G, DG, _, _, _, _],
  [_, _, _, _, _, DG, G, DG, DG, G, DG, _, _, _, _, _],
  [_, _, _, _, _, _, DG, _, _, DG, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

/**
 * Hit spark - small impact effect (8x8, 2 frames)
 */
const HIT_SPARK_1 = [
  [_, _, _, W, W, _, _, _],
  [_, _, W, EY, EY, W, _, _],
  [_, W, EY, W, W, EY, W, _],
  [W, EY, W, W, W, W, EY, W],
  [W, EY, W, W, W, W, EY, W],
  [_, W, EY, W, W, EY, W, _],
  [_, _, W, EY, EY, W, _, _],
  [_, _, _, W, W, _, _, _],
];

const HIT_SPARK_2 = [
  [_, _, _, _, _, _, _, _],
  [_, _, _, W, W, _, _, _],
  [_, _, W, EO, EO, W, _, _],
  [_, W, EO, EO, EO, EO, W, _],
  [_, W, EO, EO, EO, EO, W, _],
  [_, _, W, EO, EO, W, _, _],
  [_, _, _, W, W, _, _, _],
  [_, _, _, _, _, _, _, _],
];

/** Design §10.3. Small stays 16×16; medium and large are their own rasters. */
export const SMALL_EXPLOSION_FRAME_COUNT = 4;
export const MEDIUM_EXPLOSION_FRAME_COUNT = 6;
export const LARGE_EXPLOSION_FRAME_COUNT = 8;
export const HIT_SPARK_FRAME_COUNT = 2;

export const SMALL_EXPLOSION_SIZE = 16;
export const MEDIUM_EXPLOSION_SIZE = 28;
export const LARGE_EXPLOSION_SIZE = 48;

/** Preallocated FX. Sparks have their own pool so hits cannot steal death bursts. */
export const EXPLOSION_POOL_SIZE = 48;
export const HIT_SPARK_POOL_SIZE = 32;

export const EXPLOSION_FRAME_TIME = 0.06;
export const HIT_SPARK_FRAME_TIME = 0.05;

export type ExplosionKind = 'small' | 'medium' | 'large';

/**
 * Player death is the 4-frame small burst (design §3.2.1 / §5.5).
 * The ship is not a row in the size-class table.
 */
export const PLAYER_DEATH_EXPLOSION: ExplosionKind = 'small';

/** Which baked set to draw. Battle indexes `ExplosionAssets` with this key. */
export function explosionDrawKey(
  kind: ExplosionKind
): 'smallExplosion' | 'mediumExplosion' | 'largeExplosion' {
  if (kind === 'small') return 'smallExplosion';
  if (kind === 'medium') return 'mediumExplosion';
  return 'largeExplosion';
}

export function explosionFrameCount(kind: ExplosionKind): number {
  if (kind === 'small') return SMALL_EXPLOSION_FRAME_COUNT;
  if (kind === 'medium') return MEDIUM_EXPLOSION_FRAME_COUNT;
  return LARGE_EXPLOSION_FRAME_COUNT;
}

/** Small enemies and buildings, medium fighters / bombers / turrets, boss → large. */
export function explosionKindForSize(size: SizeClass): ExplosionKind {
  if (size === 'large') return 'large';
  if (size === 'medium') return 'medium';
  return 'small';
}

export interface ExplosionFrameSets {
  small: SpriteData[];
  medium: SpriteData[];
  large: SpriteData[];
  hitSpark: SpriteData[];
}

/** Keys match `ExplosionAssets`. Tests lock this map without baking canvases. */
export interface ExplosionDrawFrames {
  smallExplosion: SpriteData[];
  mediumExplosion: SpriteData[];
  largeExplosion: SpriteData[];
  hitSpark: SpriteData[];
}

export function registerExplosionFrames(sets: ExplosionFrameSets): ExplosionDrawFrames {
  return {
    smallExplosion: sets.small,
    mediumExplosion: sets.medium,
    largeExplosion: sets.large,
    hitSpark: sets.hitSpark,
  };
}

/**
 * Palette-index frames. Medium and large are painted here (not a scale of small).
 * `createExplosionAssets` bakes whatever this returns.
 */
export function buildExplosionFrameSets(): ExplosionFrameSets {
  return {
    small: [SMALL_EXPLOSION_1, SMALL_EXPLOSION_2, SMALL_EXPLOSION_3, SMALL_EXPLOSION_4],
    medium: buildBlast(MEDIUM_EXPLOSION_SIZE, MEDIUM_EXPLOSION_FRAME_COUNT, 5),
    large: buildBlast(LARGE_EXPLOSION_SIZE, LARGE_EXPLOSION_FRAME_COUNT, 8),
    hitSpark: [HIT_SPARK_1, HIT_SPARK_2],
  };
}

export interface ExplosionAssets {
  smallExplosion: SpriteFrame[];
  mediumExplosion: SpriteFrame[];
  largeExplosion: SpriteFrame[];
  hitSpark: SpriteFrame[];
}

function renderFrames(frames: SpriteData[]): SpriteFrame[] {
  return frames.map((frame) => renderSprite(frame, 0.5, 0.5));
}

/** Create all explosion sprites */
export function createExplosionAssets(): ExplosionAssets {
  const registered = registerExplosionFrames(buildExplosionFrameSets());
  return {
    smallExplosion: renderFrames(registered.smallExplosion),
    mediumExplosion: renderFrames(registered.mediumExplosion),
    largeExplosion: renderFrames(registered.largeExplosion),
    hitSpark: renderFrames(registered.hitSpark),
  };
}

/**
 * One blast frame. `lobes` changes the silhouette so medium and large are not
 * the same shape at two sizes. Colors stay in the explosion / smoke range.
 */
function paintBlast(size: number, frame: number, frameCount: number, lobes: number): SpriteData {
  const grid = createGrid(size, size);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const t = frame / (frameCount - 1);
  const reach = size * 0.46 * (0.34 + 0.66 * Math.min(1, t / 0.55));
  const core = Math.max(1.2, reach * (0.55 * (1 - t) + 0.12));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const lobe = 0.74 + 0.26 * Math.abs(Math.sin(ang * lobes + frame));
      const d = dist / lobe;
      if (d > reach) continue;
      const cavity =
        t > 0.62 &&
        d > reach * 0.42 &&
        d < reach * 0.78 &&
        Math.sin(ang * (lobes + 3) - frame * 1.4) > 0.2;
      if (cavity) continue;

      let color: number = COLOR.EXPLOSION_RED_ORANGE;
      if (d <= core) color = t < 0.4 ? COLOR.WHITE : COLOR.EXPLOSION_YELLOW;
      else if (d <= reach * 0.48)
        color = t < 0.55 ? COLOR.EXPLOSION_YELLOW : COLOR.EXPLOSION_ORANGE_YELLOW;
      else if (d <= reach * 0.75)
        color = t < 0.72 ? COLOR.EXPLOSION_ORANGE : COLOR.EXPLOSION_RED_ORANGE;
      else if (t >= 0.45) color = (x + y + frame) % 2 === 0 ? COLOR.GRAY : COLOR.DARK_GRAY;
      if (t < 0.28 && d > reach * 0.82) color = COLOR.WHITE;
      plot(grid, x, y, color);
    }
  }

  const sparks = lobes * 2;
  for (let i = 0; i < sparks; i++) {
    const ang = (i / sparks) * Math.PI * 2 + frame * 0.55;
    const r = reach * (1.02 + (i % 2) * 0.12) * (t < 0.8 ? 1 : 0.7);
    const sx = Math.round(cx + Math.cos(ang) * r);
    const sy = Math.round(cy + Math.sin(ang) * r);
    plot(grid, sx, sy, t < 0.5 ? COLOR.WHITE : COLOR.GRAY);
    plot(
      grid,
      sx,
      sy + (i % 2 === 0 ? 1 : -1),
      t < 0.65 ? COLOR.EXPLOSION_YELLOW : COLOR.DARK_GRAY
    );
  }
  return grid;
}

function buildBlast(size: number, frameCount: number, lobes: number): SpriteData[] {
  const frames: SpriteData[] = [];
  for (let i = 0; i < frameCount; i++) frames.push(paintBlast(size, i, frameCount, lobes));
  return frames;
}
