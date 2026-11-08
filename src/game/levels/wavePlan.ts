/**
 * Difficulty view of a wave table (stage 2 wave table §8.2).
 *
 * Easy is the authored `count` / `fire` / `fireOnly`. Medium and hard override
 * only the fields they set — hard does not inherit a medium override.
 * 菜鸟 is not a column: `waveTableOf` maps it onto Easy before these lookups.
 * Omitting `difficulty` does not filter: every group is counted at its base
 * values, which is how stage 1 tests read the table. Battle always passes one.
 *
 * Clear-wave bonuses and timed supply ships are not fields here (wave table §5.3).
 */

import { waveTableOf, type Difficulty } from '@/game/difficulty';
import type { Fire, SpawnGroup, Wave, WaveDifficulty } from './types';

function tableKey(difficulty?: Difficulty): WaveDifficulty | undefined {
  return difficulty === undefined ? undefined : waveTableOf(difficulty);
}

export function waveEnabled(wave: Wave, difficulty?: Difficulty): boolean {
  const key = tableKey(difficulty);
  if (!key || !wave.difficulties) return true;
  return wave.difficulties.includes(key);
}

export function groupEnabled(group: SpawnGroup, difficulty?: Difficulty): boolean {
  const key = tableKey(difficulty);
  if (!key || !group.difficulties) return true;
  return group.difficulties.includes(key);
}

export function resolveGroupCount(group: SpawnGroup, difficulty?: Difficulty): number {
  const key = tableKey(difficulty);
  const over = key ? group.countByDifficulty : undefined;
  if (key === 'medium' && over?.medium !== undefined) return over.medium;
  if (key === 'hard' && over?.hard !== undefined) return over.hard;
  return group.count;
}

export function resolveGroupFire(group: SpawnGroup, difficulty?: Difficulty): Fire {
  const key = tableKey(difficulty);
  const over = key ? group.fireByDifficulty : undefined;
  if (key === 'medium' && over?.medium) return over.medium;
  if (key === 'hard' && over?.hard) return over.hard;
  return group.fire;
}

export function resolveFireOnly(
  group: SpawnGroup,
  difficulty?: Difficulty
): readonly number[] | undefined {
  const key = tableKey(difficulty);
  const over = key ? group.fireOnlyByDifficulty : undefined;
  if (over && key) {
    const picked = key === 'easy' ? over.easy : key === 'medium' ? over.medium : over.hard;
    if (picked) return picked;
  }
  return group.fireOnly;
}
