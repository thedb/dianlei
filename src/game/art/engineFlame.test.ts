import { describe, expect, it } from 'vitest';
import { MATE_SCALE } from '@/game/config';
import { matePixels } from '@/game/systems/mate';
import { fittedNozzle, type FlameSpriteBox } from './engineFlame';
import { PLAYER_SPRITE_H, PLAYER_SPRITE_W, createPlayerNozzles } from './playerSprite';

const source: FlameSpriteBox = {
  width: PLAYER_SPRITE_W,
  height: PLAYER_SPRITE_H,
  anchorX: Math.floor(PLAYER_SPRITE_W * 0.5),
  anchorY: Math.floor(PLAYER_SPRITE_H * 0.5),
};

/** Same box `drawMates` passes: rounded 1/3 of the player frame. */
const drawn: FlameSpriteBox = {
  width: matePixels(source.width),
  height: matePixels(source.height),
  anchorX: matePixels(source.anchorX),
  anchorY: matePixels(source.anchorY),
};

describe('fitted wingman flames', () => {
  it('keeps native nozzles on the player ship', () => {
    for (const frame of createPlayerNozzles()) {
      for (const nozzle of frame) {
        expect(fittedNozzle(source, nozzle, source)).toEqual(nozzle);
      }
    }
  });

  it('seats scaled flames on the drawn tail and follows the bank', () => {
    const frames = createPlayerNozzles();
    const center = frames[5]!;
    const scaleX = drawn.width / source.width;

    for (const nozzle of center) {
      const fit = fittedNozzle(source, nozzle, drawn);
      expect(fit.x).not.toBeCloseTo(nozzle.x * MATE_SCALE);
      expect(fit.y).not.toBeCloseTo(nozzle.y * MATE_SCALE);
      const fromTop = fit.y - -drawn.anchorY;
      expect(fromTop).toBeCloseTo(((source.anchorY + nozzle.y) * drawn.height) / source.height);
      expect(fromTop).toBeGreaterThan(nozzle.y * MATE_SCALE + drawn.anchorY);
      expect(fromTop).toBeLessThanOrEqual(drawn.height);
    }

    const left = fittedNozzle(source, center[0]!, drawn);
    const right = fittedNozzle(source, center[1]!, drawn);
    expect(left.y).toBeCloseTo(right.y);
    expect((left.x + right.x) / 2).toBeCloseTo(-drawn.anchorX + drawn.width / 2);

    const bank = frames[10]!;
    const bankMid = (bank[0]!.x + bank[1]!.x) / 2;
    const centerMid = (center[0]!.x + center[1]!.x) / 2;
    expect(bankMid).not.toBeCloseTo(centerMid);
    const fittedShift =
      (fittedNozzle(source, bank[0]!, drawn).x + fittedNozzle(source, bank[1]!, drawn).x) / 2 -
      (left.x + right.x) / 2;
    expect(fittedShift).toBeCloseTo((bankMid - centerMid) * scaleX);
    expect(fittedShift).not.toBeCloseTo((bankMid - centerMid) * MATE_SCALE);
  });
});
