/**
 * Placeholder 黑曜 hull. The fight (polyline, strafe, saucer) is a later PR.
 * Nose points down, toward the player, so the generic flame sits on the tail.
 * Dark metal. No player cyan.
 */

import { OBSIDIAN_HULL_H, OBSIDIAN_HULL_W } from '@/game/config';
import { COLOR } from '@/game/palette';
import { createGrid, fillRect } from './pixelDraw';
import type { SpriteData } from './types';

export function buildObsidianStubHull(): SpriteData {
  const g = createGrid(OBSIDIAN_HULL_W, OBSIDIAN_HULL_H, -1);
  fillRect(g, 28, 6, 24, 8, COLOR.MEDIUM_GRAY);
  fillRect(g, 34, 4, 12, 6, COLOR.GRAY);
  fillRect(g, 34, 12, 12, 70, COLOR.GRAY);
  fillRect(g, 36, 16, 8, 60, COLOR.MEDIUM_GRAY);
  fillRect(g, 6, 48, 68, 12, COLOR.DARK_GRAY);
  fillRect(g, 10, 50, 60, 8, COLOR.GRAY);
  fillRect(g, 16, 52, 48, 4, COLOR.LIGHT_GRAY);
  fillRect(g, 36, 78, 8, 12, COLOR.LIGHT_GRAY);
  fillRect(g, 38, 86, 4, 6, COLOR.PALE_GRAY);
  fillRect(g, 37, 36, 6, 8, COLOR.GROUND_TAN);
  fillRect(g, 38, 37, 4, 4, COLOR.EXPLOSION_ORANGE_YELLOW);
  return g;
}
