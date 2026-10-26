import { afterEach, describe, expect, it, vi } from 'vitest';
import { FURNACE_CLOSED, FURNACE_DEATH_DURATION, FURNACE_PHASE_INVULN } from '@/game/config';
import { spawnEnemyBullet } from '@/game/entities/enemyBullet';
import { getStage } from '@/game/levels/registry';
import { bossPart, resolveBossBullet } from '@/game/systems/boss';
import { furnaceCoreExposed } from '@/game/systems/furnace';
import { battleContext, seeded } from '@/test/battleHarness';
import { activateBomb } from './combat';
import { createBattle, type Battle } from './context';
import { applyBossEvents, armBoss, spawnBoss, stepBoss } from './bossFight';

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

function fight(stageId: '2' | '3', difficulty: 'easy' | 'hard' = 'easy'): Battle {
  const b = createBattle(battleContext('stage', difficulty, seeded(9)));
  b.stage = getStage(stageId);
  b.bossCfg = b.stage.boss;
  armBoss(b);
  b.boss = spawnBoss(b);
  b.gameTime = b.stage.boss.enterAt;
  return b;
}

function killPods(b: Battle): void {
  const boss = b.boss!;
  for (const id of ['pod0', 'pod1', 'pod2', 'pod3']) {
    const pod = bossPart(boss, id)!;
    applyBossEvents(
      b,
      resolveBossBullet(boss, { x: pod.worldX, y: pod.worldY, w: 4, h: 12 }, pod.hp)
    );
  }
}

describe('炉心 battle', () => {
  it('keeps flying bullets through the iris change and death, and a bomb still clears them', () => {
    const b = fight('3');
    stepBoss(b, 2);
    const marker = b.enemyBullets.acquire();
    spawnEnemyBullet(marker, 40, 400, 0, 40, 'small');
    killPods(b);
    expect(b.boss!.stage).toBe('transition');
    stepBoss(b, FURNACE_PHASE_INVULN);
    expect(b.boss!.phase).toBe('core');
    expect(marker.active).toBe(true);
    expect(marker.x).toBe(40);
    expect(marker.y).toBe(400);

    stepBoss(b, FURNACE_CLOSED);
    expect(furnaceCoreExposed(b.boss!)).toBe(true);
    const core = bossPart(b.boss!, 'core')!;
    applyBossEvents(
      b,
      resolveBossBullet(b.boss!, { x: core.worldX, y: core.worldY, w: 4, h: 12 }, core.hp)
    );
    expect(b.boss!.stage).toBe('death');
    expect(marker.active).toBe(true);
    stepBoss(b, FURNACE_DEATH_DURATION);
    expect(b.boss!.stage).toBe('clear');
    expect(marker.active).toBe(true);

    const bomb = fight('3');
    stepBoss(bomb, 2);
    const flying = bomb.enemyBullets.acquire();
    spawnEnemyBullet(flying, 40, 400, 0, 40, 'small');
    expect(bomb.state.bombs).toBeGreaterThan(0);
    activateBomb(bomb);
    expect(flying.active).toBe(false);
    expect(bomb.enemyBullets.getActiveCount()).toBe(0);
  });

  it('reaches the shared victory exit on easy, and a stage 2 clear cards into stage 3', () => {
    const b = fight('3');
    stepBoss(b, 2);
    killPods(b);
    stepBoss(b, FURNACE_PHASE_INVULN + FURNACE_CLOSED);
    const core = bossPart(b.boss!, 'core')!;
    applyBossEvents(
      b,
      resolveBossBullet(b.boss!, { x: core.worldX, y: core.worldY, w: 4, h: 12 }, core.hp)
    );
    stepBoss(b, FURNACE_DEATH_DURATION);
    expect(b.boss!.phase).toBe('clear');
    expect(b.victory.phase).not.toBe('idle');
    expect(stepBoss(b, 30)).toBe('result');
    expect(b.scene.campaignNext).toBeUndefined();

    const previous = fight('2');
    previous.boss!.stage = 'clear';
    previous.boss!.phase = 'clear';
    expect(stepBoss(previous, 30)).toBe('result');
    expect(previous.scene.campaignNext).toBe('3');
    expect(previous.scene.carriedRun?.score).toBe(previous.state.score);
  });
});
