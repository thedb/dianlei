import { describe, expect, it, vi } from 'vitest';
import { PALETTE } from '@/game/palette';
import { FakeOffscreenCanvas } from '@/test/fakeCanvas';
import { lockedShipArt, createLockedShipSheets, type LockedShipId } from './shipSprites';
import mandy0 from './locked/mandy-bank-t0.json';
import mandy2 from './locked/mandy-bank-t2.json';
import mandy3 from './locked/mandy-bank-t3.json';
import mandy5 from './locked/mandy-bank-t5.json';
import jason0 from './locked/jason-bank-t0.json';
import jason2 from './locked/jason-bank-t2.json';
import jason3 from './locked/jason-bank-t3.json';
import jason5 from './locked/jason-bank-t5.json';

const LOCK = {
  mandy: [mandy0, mandy2, mandy3, mandy5],
  jason: [jason0, jason2, jason3, jason5],
} as const;

/** Center, step 2, step 3, full right. t1 and t4 are not in the lock. */
const RIGHT_INDEX = [5, 7, 8, 10] as const;

function mirror(rows: number[][]): number[][] {
  return rows.map((row) => [...row].reverse());
}

describe('locked Mandy and Jason pixels', () => {
  for (const id of ['mandy', 'jason'] as const) {
    it(`${id} copies the G2 lock into t0 t2 t3 t5 and mirrors left`, () => {
      const art = lockedShipArt(id);
      expect(art.frames).toHaveLength(11);
      LOCK[id].forEach((file, i) => {
        expect(art.frames[RIGHT_INDEX[i]!]).toEqual(file.pixels);
      });
      // t1 repeats t0, t4 repeats t3. No invented pixels.
      expect(art.frames[6]).toEqual(art.frames[5]);
      expect(art.frames[9]).toEqual(art.frames[8]);
      expect(art.frames[0]).toEqual(mirror(art.frames[10]!));
      expect(art.frames[4]).toEqual(mirror(art.frames[6]!));
      for (const frame of art.frames) {
        for (const row of frame) {
          for (const value of row) {
            expect(value).toBeGreaterThanOrEqual(-1);
            expect(value).toBeLessThan(PALETTE.length);
          }
        }
      }
    });
  }

  it('puts Mandy on two tail nozzles and Jason on one', () => {
    const mandy = lockedShipArt('mandy').nozzles;
    const jason = lockedShipArt('jason').nozzles;
    expect(mandy[5]).toEqual([
      { x: -9, y: 8 },
      { x: 9, y: 8 },
    ]);
    expect(mandy[7]).toEqual([
      { x: -8.5, y: 9 },
      { x: 6, y: 9 },
    ]);
    expect(mandy[8]).toEqual([
      { x: -8.5, y: 9 },
      { x: 4.5, y: 9 },
    ]);
    expect(mandy[10]).toEqual([
      { x: -8.5, y: 9 },
      { x: 1.5, y: 9 },
    ]);
    expect(jason[5]).toEqual([{ x: 0, y: 15 }]);
    expect(jason[7]).toEqual([{ x: -0.5, y: 15 }]);
    expect(jason[8]).toEqual([{ x: -2, y: 15 }]);
    expect(jason[10]).toEqual([{ x: -2, y: 15 }]);
    for (const id of ['mandy', 'jason'] as LockedShipId[]) {
      const art = lockedShipArt(id);
      expect(art.nozzles[6]).toEqual(art.nozzles[5]);
      expect(art.nozzles[9]).toEqual(art.nozzles[8]);
      expect(art.nozzles[0]).toEqual(art.nozzles[10]!.map((n) => ({ x: -n.x, y: n.y })));
    }
  });

  it('bakes both sheets from those frames', () => {
    vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
    const sheets = createLockedShipSheets();
    expect(sheets.mandy.frameCount).toBe(11);
    expect(sheets.jason.frameCount).toBe(11);
    expect(sheets.mandy.width).toBe(48);
    expect(sheets.mandy.height).toBe(32);
    expect(sheets.jason.width).toBe(26);
    expect(sheets.jason.height).toBe(30);
    expect(sheets.mandy.bankFrames[5]!.nozzles).toHaveLength(2);
    expect(sheets.jason.bankFrames[5]!.nozzles).toHaveLength(1);
    expect(sheets.mandy).not.toBe(sheets.jason);
  });
});
