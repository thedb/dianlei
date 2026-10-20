/**
 * Enemy sprites - code-drawn pixel art
 * Design doc §10.2: small fighter 24x24, medium 36x36 (scaled small)
 */

import { COLOR } from '@/game/palette';
import type { SpriteData, SpriteFrame } from './types';
import { renderSprite, createHitFlashSprite, createTintedSprite } from './spriteRenderer';

// Shorthand for common colors
const _ = -1; // Transparent
const K = COLOR.BLACK;
const S = COLOR.SHADOW;
const DG = COLOR.DARK_GRAY;
const G = COLOR.GRAY;

// Reserved: const _EB = COLOR.ENEMY_BLACK;
const ED = COLOR.ENEMY_DARK_RED;
const EC = COLOR.ENEMY_CRIMSON;
const ER = COLOR.ENEMY_RED;
const EH = COLOR.ENEMY_BRIGHT_RED;
// Reserved: const _EV = COLOR.ENEMY_VIVID_RED;

/**
 * Small fighter - 24x24 pixels
 * Aggressive looking red fighter with swept wings
 */
const SMALL_FIGHTER: SpriteData = [
  // Row 0-5: Nose and cockpit
  [_, _, _, _, _, _, _, _, _, _, _, K, K, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, K, ER, ER, K, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, K, EC, ER, ER, EC, K, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, K, EC, EC, ER, ER, EC, EC, K, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, K, EC, EC, ED, ER, ER, ED, EC, EC, K, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, K, EC, EC, ED, K, EH, EH, K, ED, EC, EC, K, _, _, _, _, _, _],

  // Row 6-11: Mid fuselage with wing roots
  [_, _, _, _, _, K, EC, EC, ED, K, K, EH, EH, K, K, ED, EC, EC, K, _, _, _, _, _],
  [_, _, _, _, K, EC, EC, ED, K, DG, K, ER, ER, K, DG, K, ED, EC, EC, K, _, _, _, _],
  [_, _, _, K, EC, EC, ED, K, DG, G, K, ER, ER, K, G, DG, K, ED, EC, EC, K, _, _, _],
  [_, _, K, EC, EC, ED, K, DG, G, G, K, ER, ER, K, G, G, DG, K, ED, EC, EC, K, _, _],
  [_, K, EC, EC, ED, K, K, DG, G, K, K, ER, ER, K, K, G, DG, K, K, ED, EC, EC, K, _],
  [K, EC, EC, ED, K, K, K, DG, K, K, EC, ER, ER, EC, K, K, DG, K, K, K, ED, EC, EC, K],

  // Row 12-17: Wings at full width
  [K, EC, ED, K, K, K, EC, ED, K, EC, EC, ER, ER, EC, EC, K, ED, EC, K, K, K, ED, EC, K],
  [K, ED, K, K, K, EC, EC, ED, EC, EC, ED, ER, ER, ED, EC, EC, ED, EC, EC, K, K, K, ED, K],
  [K, K, K, K, EC, EC, ED, ED, ED, ED, ED, ER, ER, ED, ED, ED, ED, ED, EC, EC, K, K, K, K],
  [_, K, K, EC, EC, ED, ED, S, S, S, ED, ER, ER, ED, S, S, S, ED, ED, EC, EC, K, K, _],
  [_, _, K, EC, ED, ED, S, K, K, K, S, ER, ER, S, K, K, K, S, ED, ED, EC, K, _, _],
  [_, _, K, EC, ED, S, K, _, _, K, S, ER, ER, S, K, _, _, K, S, ED, EC, K, _, _],

  // Row 18-23: Engine pods
  [_, _, _, K, ED, S, K, _, _, K, ED, ER, ER, ED, K, _, _, K, S, ED, K, _, _, _],
  [_, _, _, K, ED, K, _, _, _, K, ED, EC, EC, ED, K, _, _, _, K, ED, K, _, _, _],
  [_, _, _, K, S, K, _, _, _, K, ED, EC, EC, ED, K, _, _, _, K, S, K, _, _, _],
  [_, _, _, _, K, _, _, _, _, K, S, EC, EC, S, K, _, _, _, _, K, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, K, K, K, K, _, _, _, _, _, _, _, _, _, _],
];

/** Nozzle position for small fighter (below, center) */
const SMALL_FIGHTER_NOZZLE = { x: 0, y: 12 };

export interface EnemySpriteSheet {
  idle: SpriteFrame;
  hitFlash: SpriteFrame;
  nozzle: { x: number; y: number };
  width: number;
  height: number;
}

/**
 * Create small fighter sprite sheet
 */
export function createSmallFighterSheet(): EnemySpriteSheet {
  const idle = renderSprite(SMALL_FIGHTER, 0.5, 0.5);
  const hitFlash = createHitFlashSprite(idle);

  return {
    idle,
    hitFlash,
    nozzle: SMALL_FIGHTER_NOZZLE,
    width: 24,
    height: 24,
  };
}

/**
 * Create medium fighter sprite sheet
 * This is the small fighter scaled 1.5x and tinted darker (per design doc S7)
 */
export function createMediumFighterSheet(): EnemySpriteSheet {
  // First render at original size
  const original = renderSprite(SMALL_FIGHTER, 0.5, 0.5);

  // Create tinted (darker) version
  const tinted = createTintedSprite(original, 0, 1.0, 0.75);

  // Scale up to 36x36
  const scaledWidth = 36;
  const scaledHeight = 36;

  const scaledCanvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(scaledWidth, scaledHeight)
      : document.createElement('canvas');

  if (!(scaledCanvas instanceof OffscreenCanvas)) {
    scaledCanvas.width = scaledWidth;
    scaledCanvas.height = scaledHeight;
  }

  const ctx = scaledCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }

  // Disable smoothing for pixel-perfect scaling
  ctx.imageSmoothingEnabled = false;

  // Scale up
  ctx.drawImage(tinted.canvas, 0, 0, 24, 24, 0, 0, scaledWidth, scaledHeight);

  const idle: SpriteFrame = {
    canvas: scaledCanvas,
    width: scaledWidth,
    height: scaledHeight,
    anchorX: scaledWidth / 2,
    anchorY: scaledHeight / 2,
  };

  const hitFlash = createHitFlashSprite(idle);

  return {
    idle,
    hitFlash,
    nozzle: { x: 0, y: 18 }, // Scaled nozzle position
    width: scaledWidth,
    height: scaledHeight,
  };
}

/** All enemy sprite sheets cached at boot */
export interface EnemyAssets {
  smallFighter: EnemySpriteSheet;
  mediumFighter: EnemySpriteSheet;
}

/** Initialize all enemy sprites */
export function createEnemyAssets(): EnemyAssets {
  return {
    smallFighter: createSmallFighterSheet(),
    mediumFighter: createMediumFighterSheet(),
  };
}
