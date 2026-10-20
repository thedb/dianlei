import { describe, expect, it } from 'vitest';
import { getMvpEnemyCount, getMvpWaves } from './stage1';

/** MVP enemy total documented in docs/电雷_第一关波次表_v1.md §1 */
const DOC_MVP_ENEMY_COUNT = 94;

describe('stage1 MVP waves', () => {
  it('matches the MVP enemy total in the wave table doc', () => {
    expect(getMvpEnemyCount()).toBe(DOC_MVP_ENEMY_COUNT);
  });

  it('only uses small/medium fighters in fully-MVP waves', () => {
    for (const wave of getMvpWaves().filter((w) => w.mvp === true)) {
      for (const group of wave.groups) {
        expect(['small', 'medium']).toContain(group.enemy);
      }
    }
  });

  it('has a spawn x for every enemy in each group', () => {
    for (const wave of getMvpWaves()) {
      for (const group of wave.groups) {
        expect(group.xs.length === 1 || group.xs.length >= group.count).toBe(true);
      }
    }
  });
});
