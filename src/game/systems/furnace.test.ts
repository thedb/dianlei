import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import {
  FURNACE_CLOSED,
  FURNACE_CLOSING,
  FURNACE_CORE_HP,
  FURNACE_CORE_SCORE,
  FURNACE_DEATH_DURATION,
  FURNACE_ENTER_DURATION,
  FURNACE_FLAME_COUNT,
  FURNACE_FLAME_SPEED,
  FURNACE_HULL_H,
  FURNACE_OPEN,
  FURNACE_OPENING,
  FURNACE_OVERLOAD_CLOSED,
  FURNACE_OVERLOAD_FLAME_COUNT,
  FURNACE_PHASE_INVULN,
  FURNACE_POD_FAN_COUNT,
  FURNACE_POD_FAN_FIRST,
  FURNACE_POD_FAN_SPEED,
  FURNACE_POD_SCORE,
} from '@/game/config';
import { FURNACE } from '@/game/levels/bosses/furnace';
import {
  applyBossBomb,
  bossHitsPlayer,
  bossPart,
  createBoss,
  resolveBossBullet,
  updateBoss,
  type BossEvents,
  type BossRuntime,
  type BossWorld,
} from '@/game/systems/boss';
import {
  furnaceCoreExposed,
  furnaceDebris,
  furnaceMode,
  furnacePetalAngle,
  furnacePetalState,
} from '@/game/systems/furnace';

const DT = 1 / 60;

function world(): BossWorld {
  return { playerX: 180, playerY: 520, rng: createRng(7), scroll: 0 };
}

function shot(boss: BossRuntime, x: number, y: number, damage: number): BossEvents {
  return resolveBossBullet(boss, { x, y, w: 4, h: 12 }, damage);
}

function park(boss: BossRuntime, w = world()): void {
  updateBoss(boss, FURNACE_ENTER_DURATION, w);
}

function killPods(boss: BossRuntime): number {
  let score = 0;
  for (const id of ['pod0', 'pod1', 'pod2', 'pod3']) {
    const pod = bossPart(boss, id)!;
    const ev = shot(boss, pod.worldX, pod.worldY, pod.hp);
    expect(ev.consumedBullet).toBe(true);
    expect(ev.clearBullets).toBe(false);
    expect(ev.convertBullets).toBe(false);
    score += ev.score;
  }
  return score;
}

function openIris(boss: BossRuntime, w = world()): void {
  updateBoss(boss, FURNACE_PHASE_INVULN, w);
  expect(boss.stage).toBe('fight');
  expect(boss.phase).toBe('core');
  updateBoss(boss, FURNACE_CLOSED, w);
  expect(furnacePetalState(boss)).toBe('opening');
  expect(furnaceCoreExposed(boss)).toBe(true);
}

describe('炉心 iris', () => {
  it('can be hit on the way in, and does not shoot until it is parked', () => {
    const boss = createBoss(FURNACE);
    const w = world();
    const slide = updateBoss(boss, 1, w);
    expect(boss.stage).toBe('enter');
    expect(slide.bolts).toEqual([]);
    const pod = bossPart(boss, 'pod0')!;
    const hit = shot(boss, pod.worldX, pod.worldY, 10);
    expect(hit.consumedBullet).toBe(true);
    expect(pod.hp).toBe(pod.maxHp - 10);
    expect(bossPart(boss, 'core')!.hp).toBe(FURNACE_CORE_HP);
    const miss = shot(boss, 8, boss.y, 10);
    expect(miss.consumedBullet).toBe(false);
    expect(pod.hp).toBe(pod.maxHp - 10);
  });

  it('charges a chassis hit to the nearest living pod and leaves the core alone', () => {
    const boss = createBoss(FURNACE);
    park(boss);
    const before = boss.parts.filter((part) => part.id.startsWith('pod')).map((part) => part.hp);
    const ev = shot(boss, boss.x, boss.y, 15);
    expect(ev.consumedBullet).toBe(true);
    const after = boss.parts.filter((part) => part.id.startsWith('pod')).map((part) => part.hp);
    expect(after.filter((hp, i) => hp !== before[i])).toHaveLength(1);
    expect(bossPart(boss, 'core')!.hp).toBe(FURNACE_CORE_HP);
  });

  it('hides the core until the petals are opening or open, then turns 45° each close', () => {
    const boss = createBoss(FURNACE);
    const w = world();
    park(boss, w);
    expect(killPods(boss)).toBe(FURNACE_POD_SCORE * 4);
    expect(boss.stage).toBe('transition');
    expect(boss.invulnerable).toBe(true);
    const core = bossPart(boss, 'core')!;
    expect(shot(boss, core.worldX, core.worldY, 40).consumedBullet).toBe(true);
    expect(core.hp).toBe(FURNACE_CORE_HP);
    expect(applyBossBomb(boss).score).toBe(0);
    expect(core.hp).toBe(FURNACE_CORE_HP);

    updateBoss(boss, FURNACE_PHASE_INVULN, w);
    expect(furnaceMode(boss)).toBe('core');
    expect(furnacePetalState(boss)).toBe('closed');
    expect(furnacePetalAngle(boss)).toBe(0);
    expect(furnaceCoreExposed(boss)).toBe(false);
    expect(shot(boss, core.worldX, core.worldY, 40).consumedBullet).toBe(true);
    expect(core.hp).toBe(FURNACE_CORE_HP);
    const bombed = applyBossBomb(boss);
    expect(bombed.clearBullets).toBe(false);
    expect(core.hp).toBeLessThan(FURNACE_CORE_HP);
    core.hp = FURNACE_CORE_HP;

    updateBoss(boss, FURNACE_CLOSED, w);
    expect(furnacePetalState(boss)).toBe('opening');
    expect(shot(boss, core.worldX, core.worldY, 25).consumedBullet).toBe(true);
    expect(core.hp).toBe(FURNACE_CORE_HP - 25);

    updateBoss(boss, FURNACE_OPENING, w);
    expect(furnacePetalState(boss)).toBe('open');
    expect(furnaceCoreExposed(boss)).toBe(true);
    updateBoss(boss, FURNACE_OPEN, w);
    expect(furnacePetalState(boss)).toBe('closing');
    expect(furnaceCoreExposed(boss)).toBe(false);
    expect(shot(boss, core.worldX, core.worldY, 25).consumedBullet).toBe(true);
    expect(core.hp).toBe(FURNACE_CORE_HP - 25);

    updateBoss(boss, FURNACE_CLOSING, w);
    expect(furnacePetalState(boss)).toBe('closed');
    expect(furnacePetalAngle(boss)).toBe(45);
  });

  it('uses missiles, a flame fan, and parallel flak, and no laser', () => {
    const boss = createBoss(FURNACE);
    const w = world();
    park(boss, w);
    const fan = updateBoss(boss, FURNACE_POD_FAN_FIRST, w);
    const fans = fan.bolts.filter((bolt) => bolt.type === 'small');
    expect(fans.length).toBe(FURNACE_POD_FAN_COUNT);
    for (const bolt of fans) {
      expect(Math.hypot(bolt.vx, bolt.vy)).toBeCloseTo(FURNACE_POD_FAN_SPEED, 4);
    }
    expect(fan.bolts.some((bolt) => bolt.type === 'missile')).toBe(false);

    let missiles = 0;
    for (let t = FURNACE_POD_FAN_FIRST; t < 1.25; t += DT) {
      for (const bolt of updateBoss(boss, DT, w).bolts) {
        expect(['small', 'large', 'missile']).toContain(bolt.type);
        if (bolt.type === 'missile') {
          missiles += 1;
          expect(bolt.homing).toBe(0.5);
        }
      }
    }
    expect(missiles).toBe(4);

    const iris = createBoss(FURNACE);
    park(iris, w);
    killPods(iris);
    openIris(iris, w);
    const flame = updateBoss(iris, DT, w);
    const larges = flame.bolts.filter((bolt) => bolt.type === 'large');
    expect(larges).toHaveLength(FURNACE_FLAME_COUNT);
    for (const bolt of larges) {
      expect(Math.hypot(bolt.vx, bolt.vy)).toBeCloseTo(FURNACE_FLAME_SPEED, 4);
    }
  });

  it('ends easy on the core and hard only after the yellow overload bar', () => {
    const easy = createBoss(FURNACE);
    const w = world();
    park(easy, w);
    killPods(easy);
    openIris(easy, w);
    const core = bossPart(easy, 'core')!;
    const killed = shot(easy, core.worldX, core.worldY, core.hp);
    expect(killed.score).toBe(FURNACE_CORE_SCORE);
    expect(killed.clearBullets).toBe(false);
    expect(easy.stage).toBe('death');
    expect(furnaceDebris(easy)).toHaveLength(4);
    updateBoss(easy, FURNACE_DEATH_DURATION, w);
    expect(easy.stage).toBe('clear');

    const hard = createBoss(FURNACE, { gates: ['hard'] });
    park(hard, w);
    killPods(hard);
    openIris(hard, w);
    const main = bossPart(hard, 'core')!;
    const emptied = shot(hard, main.worldX, main.worldY, main.hp);
    expect(emptied.score).toBe(0);
    expect(emptied.clearBullets).toBe(false);
    expect(hard.stage).toBe('transition');
    expect(hard.phase).toBe('overloadIn');
    expect(shot(hard, main.worldX, main.worldY, 30).consumedBullet).toBe(true);
    expect(main.hp).toBe(main.maxHp);
    updateBoss(hard, FURNACE_PHASE_INVULN, w);
    expect(hard.phase).toBe('overload');
    expect(furnaceMode(hard)).toBe('overload');
    expect(furnacePetalState(hard)).toBe('closed');
    updateBoss(hard, FURNACE_OVERLOAD_CLOSED, w);
    expect(furnaceCoreExposed(hard)).toBe(true);
    const flame = updateBoss(hard, DT, w);
    expect(flame.bolts.filter((bolt) => bolt.type === 'large')).toHaveLength(
      FURNACE_OVERLOAD_FLAME_COUNT
    );
    const last = shot(hard, main.worldX, main.worldY, main.hp);
    expect(last.score).toBe(FURNACE_CORE_SCORE);
    expect(last.clearBullets).toBe(false);
    expect(hard.stage).toBe('death');
  });

  it('hits the player on a pod that sticks out of the chassis', () => {
    const boss = createBoss(FURNACE);
    park(boss);
    const pod = boss.parts
      .filter((part) => part.id.startsWith('pod') && part.alive)
      .reduce((best, part) => (part.worldY > best.worldY ? part : best));
    const y = pod.worldY + pod.radius - 0.25;
    expect(y).toBeGreaterThan(boss.y + FURNACE_HULL_H / 2);
    expect(bossHitsPlayer(boss, pod.worldX, y)).toBe(true);
    expect(bossHitsPlayer(boss, 4, 620)).toBe(false);
  });
});
