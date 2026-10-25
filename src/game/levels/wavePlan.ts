/**
 * Difficulty view of a wave table (stage 2 wave table §8.2).
 *
 * Easy is the authored `count` / `fire` / `fireOnly`. Medium and hard override
 * only the fields they set — hard does not inherit a medium override.
 * Omitting `difficulty` does not filter: every group is counted at its base
 * values, which is how stage 1 tests read the table. Battle always passes one.
 *
 * Clear-wave bonuses and timed supply ships are not fields here (wave table §5.3).
 */

import type { Difficulty } from '@/game/difficulty';
import type { Fire, SpawnGroup, Wave } from './types';

export function waveEnabled(wave: Wave, difficulty?: Difficulty): boolean {
  if (!difficulty || !wave.difficulties) return true;
  return wave.difficulties.includes(difficulty);
}

export function groupEnabled(group: SpawnGroup, difficulty?: Difficulty): boolean {
  if (!difficulty || !group.difficulties) return true;
  return group.difficulties.includes(difficulty);
}

export function resolveGroupCount(group: SpawnGroup, difficulty?: Difficulty): number {
  const over = difficulty ? group.countByDifficulty : undefined;
  if (difficulty === 'medium' && over?.medium !== undefined) return over.medium;
  if (difficulty === 'hard' && over?.hard !== undefined) return over.hard;
  return group.count;
}

export function resolveGroupFire(group: SpawnGroup, difficulty?: Difficulty): Fire {
  const over = difficulty ? group.fireByDifficulty : undefined;
  if (difficulty === 'medium' && over?.medium) return over.medium;
  if (difficulty === 'hard' && over?.hard) return over.hard;
  return group.fire;
}

export function resolveFireOnly(
  group: SpawnGroup,
  difficulty?: Difficulty
): readonly number[] | undefined {
  const over = difficulty ? group.fireOnlyByDifficulty : undefined;
  if (over) {
    const picked =
      difficulty === 'easy' ? over.easy : difficulty === 'medium' ? over.medium : over.hard;
    if (picked) return picked;
  }
  return group.fireOnly;
}
