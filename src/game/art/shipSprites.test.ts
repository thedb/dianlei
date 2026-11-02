import { describe, expect, it } from 'vitest';
import { COLOR, PALETTE } from '@/game/palette';
import { createPlayerFrameData } from './playerSprite';
import { greyPortrait, greyShipIndex } from './shipPortrait';
import {
  createJasonFrameData,
  createJasonNozzles,
  createMandyFrameData,
  createMandyNozzles,
  JASON_SPRITE_H,
  JASON_SPRITE_W,
  MANDY_SPRITE_H,
  MANDY_SPRITE_W,
} from './shipSprites';

const mandy = createMandyFrameData();
const jason = createJasonFrameData();
const eagle = createPlayerFrameData();

function count(frame: number[][], color: number): number {
  let n = 0;
  for (const row of frame) for (const cell of row) if (cell === color) n += 1;
  return n;
}

function opaque(frame: number[][]): number {
  let n = 0;
  for (const row of frame) for (const cell of row) if (cell >= 0) n += 1;
  return n;
}

function extents(frame: number[][]): { left: number; right: number } {
  let left = Infinity;
  let right = -Infinity;
  frame.forEach((row) =>
    row.forEach((cell, x) => {
      if (cell >= 0) {
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    })
  );
  return { left, right };
}

describe('Mandy flying wing', () => {
  it('is 11 frames of 32×36 and mirrors the deep banks', () => {
    expect(mandy).toHaveLength(11);
    for (const frame of mandy) {
      expect(frame).toHaveLength(MANDY_SPRITE_H);
      for (const row of frame) {
        expect(row).toHaveLength(MANDY_SPRITE_W);
        for (const cell of row) {
          expect(cell === -1 || (cell >= 0 && cell < PALETTE.length)).toBe(true);
        }
      }
    }
    expect(mandy[0]!.map((row) => [...row].reverse())).toEqual(mandy[10]);
  });

  it('reads as a black wing with a belly bay and twin nozzles, not a wide Eagle', () => {
    const center = mandy[5]!;
    const black = count(center, COLOR.BLACK);
    const filled = opaque(center);
    expect(black / filled).toBeGreaterThan(0.35);
    expect(count(center, COLOR.ENEMY_RED) + count(center, COLOR.ENEMY_BRIGHT_RED)).toBe(0);
    expect(count(center, COLOR.PLAYER_WHITE)).toBe(0);

    const span = extents(center);
    expect(span.left).toBeLessThanOrEqual(1);
    expect(span.right).toBeGreaterThanOrEqual(MANDY_SPRITE_W - 2);
    const eagleSpan = extents(eagle[5]!);
    expect(span.right - span.left).toBeGreaterThan(eagleSpan.right - eagleSpan.left);

    const bay = center[18]!;
    expect(bay[15]).toBe(COLOR.MEDIUM_GRAY);
    expect(bay[13] === COLOR.DARK_GRAY || bay[12] === COLOR.DARK_GRAY).toBe(true);

    let cyan = 0;
    for (const row of center)
      for (const cell of row) {
        if (cell === COLOR.PLAYER_MED_CYAN || cell === COLOR.PLAYER_DARK_CYAN) cyan += 1;
      }
    expect(cyan).toBeGreaterThan(4);
    expect(cyan).toBeLessThan(40);

    const nozzles = createMandyNozzles()[5]!;
    expect(nozzles).toHaveLength(2);
    expect(nozzles[0]!.x).toBeLessThan(-3);
    expect(nozzles[1]!.x).toBeGreaterThan(3);
    expect(nozzles[0]!.y).toBeCloseTo(nozzles[1]!.y);
  });
});

describe('Jason dart', () => {
  it('is 11 frames of 22×26 and mirrors the deep banks', () => {
    expect(jason).toHaveLength(11);
    for (const frame of jason) {
      expect(frame).toHaveLength(JASON_SPRITE_H);
      for (const row of frame) {
        expect(row).toHaveLength(JASON_SPRITE_W);
        for (const cell of row) {
          expect(cell === -1 || (cell >= 0 && cell < PALETTE.length)).toBe(true);
        }
      }
    }
    expect(jason[0]!.map((row) => [...row].reverse())).toEqual(jason[10]);
  });

  it('is purple and gold, with one centerline nozzle and wings inside the canvas', () => {
    const center = jason[5]!;
    const purple = count(center, COLOR.PLAYER_PURPLE) + count(center, COLOR.PLAYER_PURPLE_MID);
    const gold = count(center, COLOR.PLAYER_GOLD) + count(center, COLOR.PLAYER_GOLD_LIGHT);
    expect(purple).toBeGreaterThan(20);
    expect(gold).toBeGreaterThan(12);
    expect(count(center, COLOR.PLAYER_CYAN)).toBe(0);
    expect(count(center, COLOR.ENEMY_BRIGHT_RED)).toBe(0);
    expect(count(center, COLOR.PLAYER_WHITE)).toBe(0);

    const span = extents(center);
    expect(span.left).toBeGreaterThanOrEqual(1);
    expect(span.right).toBeLessThanOrEqual(JASON_SPRITE_W - 2);
    const eagleSpan = extents(eagle[5]!);
    expect(span.right - span.left).toBeLessThan(eagleSpan.right - eagleSpan.left);

    const mid = Math.floor(JASON_SPRITE_W / 2);
    expect(
      center[12]![mid] === COLOR.PLAYER_GOLD || center[12]![mid] === COLOR.PLAYER_GOLD_LIGHT
    ).toBe(true);

    const nozzles = createJasonNozzles();
    expect(nozzles[5]).toHaveLength(1);
    expect(Math.abs(nozzles[5]![0]!.x)).toBeLessThan(0.2);
    for (const set of nozzles) expect(set).toHaveLength(1);

    const tail = center[23]!;
    tail.forEach((cell, x) => {
      if (cell >= 0) expect(Math.abs(x - mid)).toBeLessThanOrEqual(3);
    });
  });
});

describe('ship select grey bust', () => {
  it('crops the top 55% and remaps Jason gold and Mandy black', () => {
    expect(greyPortrait(eagle[5]!).length).toBe(18);
    expect(greyPortrait(mandy[5]!).length).toBe(20);
    expect(greyPortrait(jason[5]!).length).toBe(14);
    expect(greyShipIndex(COLOR.WHITE)).toBe(COLOR.PALE_GRAY);
    expect(greyShipIndex(COLOR.PLAYER_CYAN)).toBe(COLOR.LIGHT_GRAY);
    expect(greyShipIndex(COLOR.ENEMY_BRIGHT_RED)).toBe(COLOR.DARK_GRAY);
    expect(greyShipIndex(COLOR.PLAYER_GOLD)).toBe(COLOR.DARK_GRAY);
    expect(greyShipIndex(COLOR.PLAYER_PURPLE)).toBe(COLOR.DARK_GRAY);
    expect(greyShipIndex(COLOR.BLACK)).toBe(COLOR.DARK_GRAY);
    const bust = greyPortrait(jason[5]!);
    for (const row of bust) {
      for (const cell of row) {
        if (cell < 0) continue;
        expect([
          COLOR.PALE_GRAY,
          COLOR.LIGHT_GRAY,
          COLOR.GRAY,
          COLOR.MEDIUM_GRAY,
          COLOR.DARK_GRAY,
        ]).toContain(cell);
      }
    }
  });
});
