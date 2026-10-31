import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOGICAL_H, LOGICAL_W } from '@/game/config';
import { coverFrame } from './shellArt';

function jpegSize(path: string): { w: number; h: number } {
  const b = readFileSync(path);
  let i = 2;
  while (i < b.length - 8) {
    if (b[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = b[i + 1] ?? 0;
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const h = b.readUInt16BE(i + 5);
      const w = b.readUInt16BE(i + 7);
      return { w, h };
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const seglen = b.readUInt16BE(i + 2);
    if (seglen < 2) break;
    i += 2 + seglen;
  }
  throw new Error(`no SOF in ${path}`);
}

describe('shell art cover fit', () => {
  it('ships the coast cover and the title mark at their source sizes', () => {
    expect(jpegSize('public/ui/boot-cover.jpg')).toEqual({ w: 720, h: 1280 });
    expect(jpegSize('public/ui/title-mark.jpg')).toEqual({ w: 1024, h: 1024 });
  });

  it('covers 360×640 with the 720×1280 coast and no empty bars', () => {
    expect(coverFrame(720, 1280, LOGICAL_W, LOGICAL_H)).toEqual({
      x: 0,
      y: 0,
      w: LOGICAL_W,
      h: LOGICAL_H,
    });
  });

  it('crops a square to the portrait frame instead of letterboxing', () => {
    const dest = coverFrame(1000, 1000, LOGICAL_W, LOGICAL_H);
    expect(dest.h).toBe(LOGICAL_H);
    expect(dest.w).toBeGreaterThan(LOGICAL_W);
    expect(dest.x).toBeLessThan(0);
    expect(dest.y).toBe(0);
  });
});
