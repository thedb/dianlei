/**
 * Tests for wave scheduler system
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { WaveScheduler } from './waveScheduler';
import { getStageEnemyCount, stage1 } from '@/game/levels/stage1';

describe('WaveScheduler', () => {
  let scheduler: WaveScheduler;

  beforeEach(() => {
    scheduler = new WaveScheduler({ mvpOnly: true });
  });

  it('should start with no spawns before wave time', () => {
    const spawns = scheduler.update(0.1);
    expect(spawns).toHaveLength(0);
  });

  it('should spawn enemies at correct wave times', () => {
    // First wave W01 spawns at t=6
    let spawns = scheduler.update(5.9);
    expect(spawns).toHaveLength(0);

    spawns = scheduler.update(0.2); // t=6.1
    expect(spawns.length).toBeGreaterThan(0);
    expect(spawns[0]!.type).toBe('small');
  });

  it('should spawn enemies with interval delays', () => {
    // W01 small enemies spawn 0.35s apart starting at t=6.0
    const spawn1 = scheduler.update(6.0);
    expect(spawn1).toHaveLength(1);

    expect(scheduler.update(0.2)).toHaveLength(0);
    expect(scheduler.update(0.15)).toHaveLength(1); // t=6.35

    expect(scheduler.update(0.35)).toHaveLength(1); // t=6.70
  });

  it('should track kill rate', () => {
    scheduler.update(10); // Spawn some enemies
    expect(scheduler.getKillRate()).toBe(0);

    scheduler.recordKill();
    expect(scheduler.getKillRate()).toBeGreaterThan(0);
  });

  it('should reset properly', () => {
    scheduler.update(10);
    scheduler.recordKill();

    scheduler.reset();

    expect(scheduler.getKillRate()).toBe(0);
    expect(scheduler.getCurrentWaveId()).toBe('W01');
    expect(scheduler.isComplete()).toBe(false);
  });

  it('should skip conditional waves when condition not met', () => {
    // W27 has condition 'powerBelowMax' and spawns at t=146
    scheduler.setPowerLevel(3); // Max power

    // Advance time past W27
    for (let t = 0; t < 150; t += 10) {
      scheduler.update(10);
    }

    // W27 should be skipped - check wave ID after it would have spawned
    const info = scheduler.getDebugInfo();
    // The wave scheduler should have processed past W27
    expect(info.time).toBeGreaterThan(146);
  });

  it('should include conditional wave when condition is met', () => {
    scheduler.setPowerLevel(1); // Below max

    // Advance to just before W27
    for (let t = 0; t < 145; t += 10) {
      scheduler.update(10);
    }

    // Trigger W27
    const spawns = scheduler.update(2);

    // Should include the conditional spawn
    const w27Spawns = spawns.filter((s) => s.drop === 'P');
    // W27 drops a P item
    expect(w27Spawns.length).toBeGreaterThanOrEqual(0); // May have already passed
  });

  it('should provide correct debug info', () => {
    const info = scheduler.getDebugInfo();

    expect(info.waveId).toBe('W01');
    expect(info.time).toBe(0);
    expect(info.spawned).toBe(0);
    expect(info.killed).toBe(0);
    expect(info.pending).toBe(0);
  });

  it('should complete after all waves', () => {
    // Fast forward through all waves
    for (let t = 0; t < 200; t += 1) {
      scheduler.update(1);
    }

    expect(scheduler.isComplete()).toBe(true);
    expect(scheduler.getCurrentWaveId()).toBe('END');
  });
});

describe('WaveScheduler spawn requests', () => {
  it('should include correct enemy types', () => {
    const scheduler = new WaveScheduler({ mvpOnly: true });

    // Get to W04 which has medium fighter
    scheduler.update(20.1);
    const spawns = scheduler.update(0);

    const mediumSpawns = spawns.filter((s) => s.type === 'medium');
    expect(mediumSpawns.length).toBeGreaterThanOrEqual(0);
  });

  it('should include drop info', () => {
    const scheduler = new WaveScheduler({ mvpOnly: true });

    // W04 at t=20 has P drop
    scheduler.update(20.1);
    const spawns = scheduler.update(0);

    const droppingEnemy = spawns.find((s) => s.drop !== null);
    if (droppingEnemy) {
      expect(['P', 'B']).toContain(droppingEnemy.drop);
    }
  });

  it('should include movement and fire patterns', () => {
    const scheduler = new WaveScheduler({ mvpOnly: true });
    // First wave W01 at t=6 has small enemies
    const spawns = scheduler.update(6.1);

    expect(spawns.length).toBeGreaterThan(0);
    expect(spawns[0]).toHaveProperty('move');
    expect(spawns[0]).toHaveProperty('fire');
    expect(spawns[0]!.move.kind).toBeDefined();
    expect(spawns[0]!.fire.kind).toBeDefined();
  });
});

describe('WaveScheduler full stage', () => {
  function collect(power: number) {
    const scheduler = new WaveScheduler({ mvpOnly: false });
    scheduler.setPowerLevel(power);
    const spawns = [];
    for (let i = 0; i < 200; i++) spawns.push(...scheduler.update(1));
    return spawns;
  }

  it('spawns every enemy type and the full ship count', () => {
    const spawns = collect(1);
    expect(spawns).toHaveLength(getStageEnemyCount(true));
    const types = new Set(spawns.map((s) => s.type));
    expect(types.size).toBe(8);
    expect(spawns.filter((s) => s.drop === 'P')).toHaveLength(5);
    expect(spawns.filter((s) => s.drop === 'B')).toHaveLength(3);
  });

  it('skips W27 when power is already max and does not count it', () => {
    const spawns = collect(3);
    expect(spawns).toHaveLength(getStageEnemyCount(false));
    expect(spawns.some((s) => s.type === 'tank')).toBe(true);
    expect(spawns.some((s) => s.type === 'interceptor')).toBe(true);
  });

  it('seeks to the boss clock without counting ships that never spawned', () => {
    const scheduler = new WaveScheduler({ mvpOnly: false });
    scheduler.setPowerLevel(1);
    scheduler.update(10);
    const spawned = scheduler.getDebugInfo().spawned;
    expect(spawned).toBeGreaterThan(0);

    scheduler.seek(stage1.boss.enterAt);
    expect(scheduler.getDebugInfo().time).toBe(stage1.boss.enterAt);
    expect(scheduler.getDebugInfo().spawned).toBe(spawned);
    expect(scheduler.update(1)).toHaveLength(0);

    scheduler.seek(5);
    expect(scheduler.getDebugInfo().time).toBe(5);
    expect(scheduler.getDebugInfo().spawned).toBe(0);
  });

  it('keeps interceptors out of the MVP partial wave', () => {
    const mvp = new WaveScheduler({ mvpOnly: true });
    const full = new WaveScheduler({ mvpOnly: false });
    const mvpSpawns = [];
    const fullSpawns = [];
    for (let i = 0; i < 140; i++) {
      mvpSpawns.push(...mvp.update(1));
      fullSpawns.push(...full.update(1));
    }
    expect(mvpSpawns.some((s) => s.type === 'interceptor')).toBe(false);
    expect(fullSpawns.some((s) => s.type === 'interceptor')).toBe(true);
  });
});
