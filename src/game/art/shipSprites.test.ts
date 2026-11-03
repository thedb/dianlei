import { describe, expect, it } from 'vitest';
import type { PlayerSpriteSheet } from './playerSprite';
import { temporaryShipSheets } from './shipSprites';

describe('temporary ship sheets', () => {
  it('points Mandy and Jason at the Eagle sheet until G2 and G4', () => {
    const eagle = { frameCount: 11 } as PlayerSpriteSheet;
    const sheets = temporaryShipSheets(eagle);
    expect(sheets.mandy).toBe(eagle);
    expect(sheets.jason).toBe(eagle);
  });
});
