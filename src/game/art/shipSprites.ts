/**
 * TEMP until G2 and G4.
 * Mandy and Jason reuse Eagle's raster. This file does not draw them.
 * The next canvas, not applied here, is about 48×32 for Mandy and about
 * 26×30 for Jason. Speed and hitbox stay on `shipDefs`.
 */

import type { PlayerSpriteSheet } from './playerSprite';

export function temporaryShipSheets(eagle: PlayerSpriteSheet): {
  mandy: PlayerSpriteSheet;
  jason: PlayerSpriteSheet;
} {
  return { mandy: eagle, jason: eagle };
}
