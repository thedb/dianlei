import { describe, expect, it } from 'vitest';
import { ATTRACT_LOOP_SECONDS } from '@/game/config';
import { createTitleAttract } from './titleAttract';

const DT = 1 / 60;

describe('title attract demo', () => {
  it('spawns stage enemies and fires, without spending bombs or lives', () => {
    const attract = createTitleAttract();
    attract.start();
    const steps = Math.ceil(8 / DT);
    for (let i = 0; i < steps; i++) attract.update(DT);
    const stats = attract.stats();
    expect(stats.spawned).toBeGreaterThan(0);
    expect(stats.bullets).toBeGreaterThan(0);
    expect(stats.time).toBeGreaterThan(6);
    expect(stats.time).toBeLessThan(ATTRACT_LOOP_SECONDS);
    expect(stats.bombsUsed).toBe(0);
    expect(stats.livesLost).toBe(0);
    const frozen = attract.stats().time;
    attract.stop();
    expect(attract.stats().bullets).toBe(0);
    expect(attract.stats().enemies).toBe(0);
    attract.update(DT);
    expect(attract.isRunning()).toBe(false);
    expect(attract.stats().time).toBe(frozen);
  });

  it('loops the opening instead of playing into the boss', () => {
    const attract = createTitleAttract();
    attract.start();
    const steps = Math.ceil((ATTRACT_LOOP_SECONDS + 3) / DT);
    for (let i = 0; i < steps; i++) attract.update(DT);
    const stats = attract.stats();
    expect(stats.time).toBeGreaterThan(0);
    expect(stats.time).toBeLessThan(ATTRACT_LOOP_SECONDS);
    expect(stats.bombsUsed).toBe(0);
    expect(stats.livesLost).toBe(0);
  });
});
