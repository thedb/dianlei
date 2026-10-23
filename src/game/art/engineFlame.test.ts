import { describe, expect, it } from 'vitest';
import { LOGICAL_W, MATE_OFFSET_X, MATE_SCALE, PLAYER_SPAWN_Y } from '@/game/config';
import { matePixels } from '@/game/systems/mate';
import { fittedNozzle, flooredSpriteCenter, type FlameSpriteBox } from './engineFlame';
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

  it('floors the blit origin the same way Renderer.drawImage does', () => {
    expect(flooredSpriteCenter(10.9, 20.2, 5, 5)).toEqual({ x: 10, y: 20 });
    expect(flooredSpriteCenter(10, 20, 5, 5)).toEqual({ x: 10, y: 20 });
    // Floor toward -infinity, matching canvas, not toward zero.
    expect(flooredSpriteCenter(-0.1, 3, 5, 4)).toEqual({ x: -1, y: 3 });
  });

  it('centers level-flight wingman flames on the snapped ship at every x', () => {
    const nozzles = createPlayerNozzles()[5]!;
    const mid =
      (fittedNozzle(source, nozzles[0]!, drawn).x + fittedNozzle(source, nozzles[1]!, drawn).x) / 2;
    expect(mid).toBeCloseTo(-drawn.anchorX + drawn.width / 2);

    const snappedGaps: number[] = [];
    const rawGaps: number[] = [];
    for (let step = 0; step < 100; step++) {
      const playerX = LOGICAL_W / 2 + step * 0.01;
      for (const dx of [-MATE_OFFSET_X, MATE_OFFSET_X]) {
        const cx = playerX + dx;
        const at = flooredSpriteCenter(cx, PLAYER_SPAWN_Y, drawn.anchorX, drawn.anchorY);
        const blitCenter = Math.floor(cx - drawn.anchorX) + drawn.width / 2;
        snappedGaps.push(at.x + mid - blitCenter);
        rawGaps.push(cx + mid - blitCenter);
      }
    }

    for (const gap of snappedGaps) expect(gap).toBeCloseTo(0, 8);
    // Integer spawn plus the 25.6 gap: both mates are already off the blit.
    const spawnRaw = [-MATE_OFFSET_X, MATE_OFFSET_X].map((dx) => {
      const cx = LOGICAL_W / 2 + dx;
      const blitCenter = Math.floor(cx - drawn.anchorX) + drawn.width / 2;
      return cx + mid - blitCenter;
    });
    expect(Math.min(...spawnRaw.map(Math.abs))).toBeGreaterThan(0.2);
    // Moving sweeps that leftover fraction across a full pixel.
    expect(Math.max(...rawGaps) - Math.min(...rawGaps)).toBeGreaterThan(0.9);
  });

  it('keeps a banked flame shift fixed while the ship moves', () => {
    const bank = createPlayerNozzles()[10]!;
    const mid =
      (fittedNozzle(source, bank[0]!, drawn).x + fittedNozzle(source, bank[1]!, drawn).x) / 2;
    const blitOffset = -drawn.anchorX + drawn.width / 2;
    expect(mid).not.toBeCloseTo(blitOffset);
    const shift = mid - blitOffset;
    const raw: number[] = [];
    for (let step = 0; step <= 20; step++) {
      const cx = 100 + step * 0.37 + MATE_OFFSET_X;
      const cy = 400 + step * 0.37;
      const at = flooredSpriteCenter(cx, cy, drawn.anchorX, drawn.anchorY);
      const blitCenter = Math.floor(cx - drawn.anchorX) + drawn.width / 2;
      const top = Math.floor(cy - drawn.anchorY);
      expect(at.x + mid - blitCenter).toBeCloseTo(shift, 8);
      expect(at.y).toBe(top + drawn.anchorY);
      raw.push(cx + mid - blitCenter);
    }
    expect(Math.max(...raw) - Math.min(...raw)).toBeGreaterThan(0.5);
  });
});
