import { describe, expect, it } from 'vitest';
import { formatStageTime, introBanner, stageClearBonus, type RunReport } from './score';

function run(patch: Partial<RunReport> = {}): RunReport {
  return {
    outcome: 'clear',
    baseScore: 1000,
    kills: 0,
    spawned: 0,
    deaths: 0,
    time: 200,
    ...patch,
  };
}

describe('stage clear bonus', () => {
  it('pays 30000 for a perfect kill rate and 30000 for no deaths', () => {
    const tally = stageClearBonus(run({ kills: 148, spawned: 148, deaths: 0 }));
    expect(tally.killRatePct).toBe(100);
    expect(tally.killBonus).toBe(30000);
    expect(tally.noDeathBonus).toBe(30000);
    expect(tally.total).toBe(61000);
  });

  it('floors the kill rate and skips the no-death bonus after a death', () => {
    const tally = stageClearBonus(run({ kills: 50, spawned: 100, deaths: 1, baseScore: 400 }));
    expect(tally.killRatePct).toBe(50);
    expect(tally.killBonus).toBe(10000);
    expect(tally.noDeath).toBe(false);
    expect(tally.noDeathBonus).toBe(0);
    expect(tally.total).toBe(10400);
  });

  it('pays nothing when no enemies spawned', () => {
    const tally = stageClearBonus(run());
    expect(tally.killBonus).toBe(0);
    expect(tally.total).toBe(31000);
  });

  it('formats time and the opening cards', () => {
    expect(formatStageTime(200.9)).toBe('3:20');
    expect(introBanner(0.2)).toBe('STAGE 1');
    expect(introBanner(2)).toBe('READY');
    expect(introBanner(4)).toBe('GO');
    expect(introBanner(5)).toBeNull();
  });
});
