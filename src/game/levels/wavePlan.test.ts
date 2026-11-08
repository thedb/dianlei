import { describe, expect, it } from 'vitest';
import type { SpawnGroup, Wave } from './types';
import {
  groupEnabled,
  resolveFireOnly,
  resolveGroupCount,
  resolveGroupFire,
  waveEnabled,
} from './wavePlan';

function group(partial: Partial<SpawnGroup> = {}): SpawnGroup {
  return {
    enemy: 'small',
    count: 8,
    xs: [180],
    move: { kind: 'straight', speed: 170 },
    fire: { kind: 'none' },
    ...partial,
  };
}

describe('wave difficulty plan', () => {
  it('keeps the base count and fire when a difficulty does not override', () => {
    const row = group({
      countByDifficulty: { medium: 9 },
      fireByDifficulty: { medium: { kind: 'aimed1', maxShots: 1 } },
      fireOnlyByDifficulty: { medium: [1, 3] },
    });
    expect(resolveGroupCount(row, 'easy')).toBe(8);
    expect(resolveGroupCount(row, 'hard')).toBe(8);
    expect(resolveGroupCount(row, 'medium')).toBe(9);
    expect(resolveGroupCount(row)).toBe(8);
    expect(resolveGroupFire(row, 'hard').kind).toBe('none');
    expect(resolveGroupFire(row, 'medium').kind).toBe('aimed1');
    expect(resolveFireOnly(row, 'easy')).toBeUndefined();
    expect(resolveFireOnly(row, 'hard')).toBeUndefined();
    expect(resolveFireOnly(row, 'medium')).toEqual([1, 3]);
  });

  it('skips a wave or group whose difficulty list does not include the run', () => {
    const wave: Wave = {
      id: 'W',
      t: 0,
      section: 'runway',
      mvp: true,
      difficulties: ['medium', 'hard'],
      groups: [],
    };
    expect(waveEnabled(wave, 'easy')).toBe(false);
    expect(waveEnabled(wave, 'rookie')).toBe(false);
    expect(waveEnabled(wave, 'hard')).toBe(true);
    expect(waveEnabled(wave)).toBe(true);
    const open: Wave = { id: 'W', t: 0, section: 'runway', mvp: true, groups: [] };
    expect(waveEnabled(open, 'easy')).toBe(true);

    const hardOnly = group({ difficulties: ['hard'] });
    expect(groupEnabled(hardOnly, 'easy')).toBe(false);
    expect(groupEnabled(hardOnly, 'rookie')).toBe(false);
    expect(groupEnabled(hardOnly, 'hard')).toBe(true);
    expect(groupEnabled(hardOnly)).toBe(true);
  });

  it('reads 菜鸟 from the Easy column, including an Easy-only fire list', () => {
    const row = group({
      difficulties: ['easy'],
      countByDifficulty: { hard: 3 },
      fireByDifficulty: { hard: { kind: 'aimed1', maxShots: 1 } },
      fireOnlyByDifficulty: { easy: [0], hard: [1, 2] },
    });
    expect(groupEnabled(row, 'rookie')).toBe(true);
    expect(resolveGroupCount(row, 'rookie')).toBe(resolveGroupCount(row, 'easy'));
    expect(resolveGroupFire(row, 'rookie')).toEqual(resolveGroupFire(row, 'easy'));
    expect(resolveFireOnly(row, 'rookie')).toEqual([0]);
    expect(resolveFireOnly(row, 'hard')).toEqual([1, 2]);
    const easyWave: Wave = {
      id: 'W',
      t: 0,
      section: 'runway',
      mvp: true,
      difficulties: ['easy'],
      groups: [],
    };
    expect(waveEnabled(easyWave, 'rookie')).toBe(true);
    expect(waveEnabled(easyWave, 'medium')).toBe(false);
  });
});
