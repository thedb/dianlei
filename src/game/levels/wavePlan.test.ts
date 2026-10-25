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
    expect(waveEnabled(wave, 'hard')).toBe(true);
    expect(waveEnabled(wave)).toBe(true);
    const open: Wave = { id: 'W', t: 0, section: 'runway', mvp: true, groups: [] };
    expect(waveEnabled(open, 'easy')).toBe(true);

    const hardOnly = group({ difficulties: ['hard'] });
    expect(groupEnabled(hardOnly, 'easy')).toBe(false);
    expect(groupEnabled(hardOnly, 'hard')).toBe(true);
    expect(groupEnabled(hardOnly)).toBe(true);
  });
});
