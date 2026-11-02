/**
 * Unselected ship-select bust: the top 55% of the level-flight frame,
 * remapped to palette greys. Same raster, no canvas filter.
 */

import { COLOR } from '@/game/palette';
import type { SpriteData } from './types';

/** Confirmed grey map, plus BLACK so Mandy's hull still reads on the plate. */
export function greyShipIndex(index: number): number {
  switch (index) {
    case COLOR.WHITE:
    case COLOR.PLAYER_WHITE:
    case COLOR.PLAYER_PALE_CYAN:
      return COLOR.PALE_GRAY;
    case COLOR.PLAYER_CYAN:
    case COLOR.PLAYER_MED_CYAN:
    case COLOR.PLAYER_BLUE:
      return COLOR.LIGHT_GRAY;
    case COLOR.LIGHT_GRAY:
      return COLOR.GRAY;
    case COLOR.GRAY:
    case COLOR.MEDIUM_GRAY:
    case COLOR.PLAYER_DARK_CYAN:
      return COLOR.MEDIUM_GRAY;
    case COLOR.DARK_GRAY:
    case COLOR.SHADOW:
    case COLOR.BLACK:
    case COLOR.ENEMY_BRIGHT_RED:
    case COLOR.ENEMY_RED:
    case COLOR.PLAYER_PURPLE:
    case COLOR.PLAYER_PURPLE_MID:
    case COLOR.PLAYER_GOLD:
    case COLOR.PLAYER_GOLD_LIGHT:
      return COLOR.DARK_GRAY;
    default:
      return index < 0 ? index : COLOR.DARK_GRAY;
  }
}

/** Top 55% of a frame (rounded), greys only. Eagle 18 rows, Mandy 20, Jason 14. */
export function greyPortrait(frame: SpriteData): SpriteData {
  const rows = Math.round(frame.length * 0.55);
  return frame
    .slice(0, rows)
    .map((row) => row.map((cell) => (cell < 0 ? -1 : greyShipIndex(cell))));
}
