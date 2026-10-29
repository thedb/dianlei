/**
 * Wreck floaters are a prop pool. Overlap does not kill the ship. A player
 * bullet scores them without a kill-rate tick. The bomb only marks the ones
 * already on screen.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOMB_WAVE_TIME, SCORE_WRECK_FLOAT, WRECK_FLOAT_HP } from '@/game/config';
import { ENEMY_DEFS } from '@/game/entities/enemyDefs';
import { spawnEnemy } from '@/game/entities/enemy';
import { spawnWreckFloat, type PlacedWreckFloat } from '@/game/entities/wreckFloat';
import { getStage } from '@/game/levels/registry';
import { WaveScheduler } from '@/game/systems/waveScheduler';
import { battleContext, seeded } from '@/test/battleHarness';
import { activateBomb, resolveCollisions, updateBombHits } from './combat';
import { createBattle, type Battle } from './context';

vi.mock('@/game/systems/audio', () => {
  const sfx = {
    init: () => undefined,
    unlock: () => undefined,
    play: () => undefined,
    setMuted: () => undefined,
    isMuted: () => false,
  };
  return { getAudioSystem: () => sfx, createAudioSystem: () => sfx };
});

afterEach(() => {
  vi.restoreAllMocks();
});

const ANCHOR: PlacedWreckFloat = {
  id: 'F01',
  map: 'seaB',
  row: 288,
  col: 5,
  layer: 0,
  origin: 0,
};

function battle(): Battle {
  const b = createBattle(battleContext('stage', 'easy', seeded(4)));
  b.stage = getStage('4');
  b.waves = new WaveScheduler({ stage: b.stage, mvpOnly: false, difficulty: 'easy' });
  return b;
}

function floatAt(b: Battle, x: number, y: number) {
  const floater = b.wreckFloats.acquire();
  spawnWreckFloat(floater, ANCHOR, 0, WRECK_FLOAT_HP, SCORE_WRECK_FLOAT);
  floater.x = x;
  floater.y = y;
  return floater;
}

describe('wreck float combat', () => {
  it('is not an enemy and does not kill the ship on overlap', () => {
    expect(Object.keys(ENEMY_DEFS)).not.toContain('wreck_float');
    const b = battle();
    const lives = b.state.lives;
    floatAt(b, b.player.x, b.player.y);
    resolveCollisions(b, false);
    expect(b.state.isDead).toBe(false);
    expect(b.state.lives).toBe(lives);
    expect(b.state.score).toBe(0);
    expect(b.wreckFloats.getActiveCount()).toBe(1);
    expect(b.waves?.getDebugInfo().killed).toBe(0);

    const enemy = b.enemies.acquire();
    spawnEnemy(
      enemy,
      'small',
      b.player.x,
      b.player.y,
      { kind: 'straight', speed: 120 },
      { kind: 'none' }
    );
    resolveCollisions(b, false);
    expect(b.state.isDead).toBe(true);
    expect(b.state.lives).toBe(lives - 1);
  });

  it('scores a bullet without a kill-rate tick', () => {
    const b = battle();
    const floater = floatAt(b, 180, 240);
    const bullet = b.bullets.acquire();
    bullet.x = floater.x;
    bullet.y = floater.y;
    bullet.damage = WRECK_FLOAT_HP;
    resolveCollisions(b, false);
    expect(floater.active).toBe(false);
    expect(b.wreckFloats.getActiveCount()).toBe(0);
    expect(b.state.score).toBe(SCORE_WRECK_FLOAT);
    expect(b.state.isDead).toBe(false);
    expect(b.waves?.getDebugInfo().killed).toBe(0);
    expect(b.bullets.getActiveCount()).toBe(0);
  });

  it('lets the bomb destroy only the floater already on screen', () => {
    const b = battle();
    const off = floatAt(b, 180, -40);
    const on = floatAt(b, b.player.x, b.player.y);
    b.state.bombs = 1;
    b.state.bombCooldown = 0;
    activateBomb(b);
    expect(off.bombHitIn).toBe(-1);
    expect(on.bombHitIn).toBeGreaterThanOrEqual(0);
    updateBombHits(b, BOMB_WAVE_TIME);
    expect(on.active).toBe(false);
    expect(off.active).toBe(true);
    expect(off.hp).toBe(WRECK_FLOAT_HP);
    expect(b.state.score).toBe(SCORE_WRECK_FLOAT);
    expect(b.waves?.getDebugInfo().killed).toBe(0);
    expect(b.state.isDead).toBe(false);
  });
});
