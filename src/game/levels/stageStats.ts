/**
 * Ship counts for any stage table. The MVP subset drops non-fighter groups
 * from `partial` waves, the same way `WaveScheduler({ mvpOnly: true })` does.
 *
 * Pass a difficulty to apply stage 2's wave and group filters and the
 * per-difficulty counts. Omit it and every group counts at its base `count`
 * (stage 1, and any unfiltered read).
 */

import type { Difficulty } from '@/game/difficulty';
import type { StageData, Wave } from './types';
import { groupEnabled, resolveGroupCount, waveEnabled } from './wavePlan';

export function stageMvpWaves(stage: StageData): Wave[] {
  return stage.waves.filter((w) => w.mvp === true || w.mvp === 'partial');
}

/** True when the MVP scheduler skips this group of a `partial` wave. */
export function mvpSkipsGroup(wave: Wave, enemy: string): boolean {
  return wave.mvp === 'partial' && enemy !== 'small' && enemy !== 'medium';
}

function countGroups(wave: Wave, mvpPartial: boolean, difficulty?: Difficulty): number {
  return wave.groups.reduce((sum, group) => {
    if (!groupEnabled(group, difficulty)) return sum;
    if (mvpPartial && mvpSkipsGroup(wave, group.enemy)) return sum;
    return sum + resolveGroupCount(group, difficulty);
  }, 0);
}

/** Ships the MVP scheduler actually spawns, including conditional waves. */
export function stageMvpEnemyCount(stage: StageData, difficulty?: Difficulty): number {
  return stageMvpWaves(stage).reduce((total, wave) => {
    if (!waveEnabled(wave, difficulty)) return total;
    return total + countGroups(wave, true, difficulty);
  }, 0);
}

/**
 * Every ship in the stage. Conditional waves count only when asked.
 * A difficulty skips waves and groups that do not list it, and uses that
 * difficulty's count override. Risk crates are not in this total.
 */
export function stageEnemyCount(
  stage: StageData,
  includeConditional = true,
  difficulty?: Difficulty
): number {
  return stage.waves.reduce((total, wave) => {
    if (!includeConditional && wave.condition) return total;
    if (!waveEnabled(wave, difficulty)) return total;
    return total + countGroups(wave, false, difficulty);
  }, 0);
}
