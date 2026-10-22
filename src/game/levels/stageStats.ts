/**
 * Ship counts for any stage table. The MVP subset drops non-fighter groups
 * from `partial` waves, the same way `WaveScheduler({ mvpOnly: true })` does.
 */

import type { StageData, Wave } from './types';

export function stageMvpWaves(stage: StageData): Wave[] {
  return stage.waves.filter((w) => w.mvp === true || w.mvp === 'partial');
}

/** True when the MVP scheduler skips this group of a `partial` wave. */
export function mvpSkipsGroup(wave: Wave, enemy: string): boolean {
  return wave.mvp === 'partial' && enemy !== 'small' && enemy !== 'medium';
}

function countGroups(wave: Wave, mvpPartial: boolean): number {
  return wave.groups.reduce((sum, group) => {
    if (mvpPartial && mvpSkipsGroup(wave, group.enemy)) return sum;
    return sum + group.count;
  }, 0);
}

/** Ships the MVP scheduler actually spawns, including conditional waves. */
export function stageMvpEnemyCount(stage: StageData): number {
  return stageMvpWaves(stage).reduce((total, wave) => total + countGroups(wave, true), 0);
}

/** Every ship in the stage. Conditional waves count only when asked. */
export function stageEnemyCount(stage: StageData, includeConditional = true): number {
  return stage.waves.reduce((total, wave) => {
    if (!includeConditional && wave.condition) return total;
    return total + countGroups(wave, false);
  }, 0);
}
