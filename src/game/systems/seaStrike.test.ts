import { describe, expect, it } from 'vitest';
import { AA_BURST_COUNT, AA_BURST_DELAY, HITBOX_RADIUS } from '@/game/config';
import { createEnemy, shouldEnemyFire, spawnEnemy, updateEnemy } from '@/game/entities/enemy';
import type { BulletSpawner } from '@/game/entities/enemyBullet';
import { FIRE_PRESETS } from './danmaku';
import {
  aaProfile,
  armFlakMark,
  createFlakMark,
  createTorpedoTrack,
  launchTorpedoIfDue,
  spawnTorpedoTrack,
  torpedoHitsPlayer,
  updateFlakMark,
  updateTorpedoTrack,
} from './seaStrike';

describe('naval strikes', () => {
  it('keeps a torpedo lane harmless during the warning, then lethal on the water', () => {
    const track = createTorpedoTrack();
    spawnTorpedoTrack(track, 180, 80, 1.5, 3.8, 460, 26);
    expect(torpedoHitsPlayer(track, 180, 200)).toBe(false);
    expect(updateTorpedoTrack(track, 1.4, 10)).toBe(false);
    expect(track.phase).toBe('warn');
    expect(track.y).toBe(90);
    expect(updateTorpedoTrack(track, 0.2, 0)).toBe(false);
    expect(track.phase).toBe('live');
    expect(torpedoHitsPlayer(track, 180, 200)).toBe(true);
    expect(torpedoHitsPlayer(track, 180, 90 - HITBOX_RADIUS - 1)).toBe(false);
    expect(torpedoHitsPlayer(track, 180 + 26, 200)).toBe(false);
  });

  it('drops one lane when the torpedo plane is due', () => {
    const enemy = createEnemy();
    spawnEnemy(
      enemy,
      'torpedo',
      160,
      220,
      { kind: 'wake_climb', speed: 140, stopY: 200, hold: 2 },
      {
        kind: 'torpedo',
        warn: 1.5,
        life: 3.8,
        length: 460,
        width: 26,
        maxShots: 1,
        firstDelay: 0.05,
      }
    );
    enemy.phase = 'hold';
    const acquired: ReturnType<typeof createTorpedoTrack>[] = [];
    launchTorpedoIfDue(enemy, 0.05, 180, 500, () => {
      const track = createTorpedoTrack();
      track.active = true;
      acquired.push(track);
      return track;
    });
    expect(acquired).toHaveLength(1);
    expect(acquired[0]).toMatchObject({ x: 160, phase: 'warn', timer: 1.5, life: 3.8 });
    launchTorpedoIfDue(enemy, 1, 180, 500, () => {
      throw new Error('second drop');
    });
    expect(acquired).toHaveLength(1);
  });

  it('bursts a flak ring only after the red-circle delay', () => {
    const hard = aaProfile('hard');
    expect(hard.delay).toBe(AA_BURST_DELAY.hard);
    expect(hard.delay).toBeGreaterThanOrEqual(0.6);
    expect(hard.delay).toBeLessThanOrEqual(0.9);
    expect(hard.count).toBe(AA_BURST_COUNT.hard);
    expect(aaProfile('easy').count).toBeLessThan(aaProfile('hard').count);

    const mark = createFlakMark();
    armFlakMark(mark, 120, 240, hard.delay, hard.count, hard.speed);
    const spawned: { x: number; y: number }[] = [];
    const spawner: BulletSpawner = {
      spawnBullet(x, y) {
        spawned.push({ x, y });
      },
      getBulletCount: () => spawned.length,
    };
    expect(updateFlakMark(mark, hard.delay - 0.02, spawner)).toBe(false);
    expect(spawned).toHaveLength(0);
    expect(updateFlakMark(mark, 0.02, spawner)).toBe(true);
    expect(spawned).toHaveLength(hard.count);
    expect(spawned.every((shot) => shot.x !== 0 || shot.y !== 0)).toBe(true);
  });

  it('aims the skim splash down, not at the player', () => {
    expect(FIRE_PRESETS.splash.aim).toBe('down');
    const enemy = createEnemy();
    spawnEnemy(
      enemy,
      'small',
      40,
      280,
      { kind: 'cross_skim', side: 'left', y: 280, speed: 80 },
      { kind: 'splash', maxShots: 1, firstDelay: 0 }
    );
    updateEnemy(enemy, 0, 300, 500, 0);
    expect(shouldEnemyFire(enemy, 0.01, 300, 500).fireData.kind).toBe('splash');
  });
});
