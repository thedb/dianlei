import { describe, expect, it } from 'vitest';
import {
  BANK_STRIP_CELLS,
  bankFrameTitle,
  bankStripLabel,
  bankStripMirrored,
  bankStripSelected,
  bankStripStageId,
} from '../src/bankStrip';

describe('bank strip focus', () => {
  it('labels the 11 in-game frames, left side mirrored', () => {
    expect(BANK_STRIP_CELLS).toBe(11);
    expect(Array.from({ length: BANK_STRIP_CELLS }, (_, cell) => bankStripLabel(cell))).toEqual([
      '左5 镜像',
      '左4 镜像',
      '左3 镜像',
      '左2 镜像',
      '左1 镜像',
      't0 平飞',
      't1',
      't2',
      't3',
      't4',
      't5',
    ]);
    expect(Array.from({ length: BANK_STRIP_CELLS }, (_, cell) => bankStripMirrored(cell))).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('selects only the focused cell, not the twin that shares its stage', () => {
    const focused = 3;
    expect(bankStripLabel(focused)).toBe('左2 镜像');
    expect(bankStripStageId(focused)).toBe('t2');
    expect(bankStripStageId(7)).toBe('t2');
    expect(
      Array.from({ length: BANK_STRIP_CELLS }, (_, cell) => bankStripSelected(cell, focused))
    ).toEqual([false, false, false, true, false, false, false, false, false, false, false]);

    const right = 7;
    expect(
      Array.from({ length: BANK_STRIP_CELLS }, (_, cell) => bankStripSelected(cell, right))
    ).toEqual([false, false, false, false, false, false, false, true, false, false, false]);
  });

  it('names a mirror in the inspector without dropping the stage the sliders edit', () => {
    expect(bankFrameTitle(3, 't2 右倾 2')).toBe('左2 镜像 · t2 右倾 2');
    expect(bankFrameTitle(7, 't2 右倾 2')).toBe('t2 右倾 2');
    expect(bankFrameTitle(5, 't0 平飞')).toBe('t0 平飞');
    expect(bankFrameTitle(0, 't5（无）')).toBe('左5 镜像 · t5（无）');
  });
});
