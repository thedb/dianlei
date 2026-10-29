/**
 * Stage-4 wreck floater. 16×16 scrap in gray 4, light gray 5, and pale cyan 9.
 * Not an enemy sprite and not a building.
 */

import { COLOR } from '@/game/palette';
import type { SpriteData, SpriteFrame } from './types';
import { createHitFlashSprite, renderSprite } from './spriteRenderer';
import { createGrid, plot } from './pixelDraw';

const GRAY = COLOR.GRAY;
const LIGHT = COLOR.LIGHT_GRAY;
const CYAN = COLOR.PLAYER_PALE_CYAN;

/** Bent plate. Opaque cells are only the three signed-off indices. */
export function drawWreckFloat(): SpriteData {
  const g = createGrid(16, 16);
  for (let x = 2; x <= 13; x++) {
    const y = 4 + Math.floor(Math.abs(x - 7.5) / 3);
    plot(g, x, y, LIGHT);
    plot(g, x, y + 1, GRAY);
    plot(g, x, y + 2, GRAY);
    plot(g, x, y + 3, LIGHT);
  }
  plot(g, 5, 9, CYAN);
  plot(g, 10, 8, CYAN);
  plot(g, 8, 10, CYAN);
  return g;
}

export interface WreckFloatArt {
  idle: SpriteFrame;
  hitFlash: SpriteFrame;
}

export function createWreckFloatArt(): WreckFloatArt {
  const idle = renderSprite(drawWreckFloat(), 0.5, 0.5);
  return { idle, hitFlash: createHitFlashSprite(idle) };
}
