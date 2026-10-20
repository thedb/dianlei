import { describe, expect, it } from 'vitest';
import { getMvpEnemyCount, getMvpWaves } from './stage1';

/** MVP enemy total from the wave doc before playtest tuning */
const DOC_MVP_ENEMY_COUNT = 85;

describe('stage1 MVP waves', () => {
  it('has about 10% more enemies than the doc baseline', () => {
    const count = getMvpEnemyCount();
    expect(count).toBeGreaterThanOrEqual(Math.round(DOC_MVP_ENEMY_COUNT * 1.1));
    expect(count).toBeLessThanOrEqual(Math.round(DOC_MVP_ENEMY_COUNT * 1.15));
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
