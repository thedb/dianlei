import { describe, expect, it } from 'vitest';
import {
  BOMB_BOSS_RATIO,
  BOMB_MEDIUM_RATIO,
  BOMB_WAVE_TIME,
  BUILDING_HP,
  LOGICAL_H,
  LOGICAL_W,
} from '@/game/config';
import { getStage } from '@/game/levels/registry';
import { ENEMY_STATS } from '@/game/entities/enemy';
import { BOSS_CLASS, enemyClass } from '@/game/entities/objectClass';
import type { EnemyType } from '@/game/levels/types';
import { createEnemy, spawnEnemy, type Enemy } from '@/game/entities/enemy';
import { createBuilding, spawnBuilding, buildingSpawnScroll } from '@/game/entities/building';
import {
  bombArrives,
  bombArrivalDelay,
  bombDamage,
  bombHitBuilding,
  bombHitEnemy,
  markBombTarget,
  bombWaveRadius,
  bombWaveReach,
  boxOnScreen,
} from './bomb';
import { applyBossBomb, bossHpRemaining, bossTotalHp, createBoss, updateBoss } from './boss';

const stage1 = getStage('1');

const cfg = stage1.boss;

describe('bomb on-screen rule', () => {
  const box = (x: number, y: number) => ({ x, y, width: 24, height: 24 });

  it('hits anything with part of its body on screen', () => {
    expect(boxOnScreen(box(180, 320))).toBe(true);
    expect(boxOnScreen(box(180, -11))).toBe(true);
    expect(boxOnScreen(box(-11, 320))).toBe(true);
    expect(boxOnScreen(box(LOGICAL_W + 11, 320))).toBe(true);
    expect(boxOnScreen(box(180, LOGICAL_H + 11))).toBe(true);
  });

  it('skips objects fully off screen, including fresh spawns above the top', () => {
    expect(boxOnScreen(box(180, -20))).toBe(false);
    expect(boxOnScreen(box(180, -12))).toBe(false);
    expect(boxOnScreen(box(-12, 320))).toBe(false);
    expect(boxOnScreen(box(LOGICAL_W + 12, 320))).toBe(false);
    expect(boxOnScreen(box(180, LOGICAL_H + 12))).toBe(false);
  });
});

describe('bomb damage by size class', () => {
  it('destroys every small object outright, whatever its HP', () => {
    for (const type of Object.keys(ENEMY_STATS) as EnemyType[]) {
      if (enemyClass(type).size !== 'small') continue;
      const hp = ENEMY_STATS[type].hp;
      expect(hp - bombDamage('small', hp, hp), type).toBeLessThanOrEqual(0);
    }
    expect(BUILDING_HP - bombDamage('small', BUILDING_HP, BUILDING_HP)).toBeLessThanOrEqual(0);
    expect(500 - bombDamage('small', 500, 500)).toBeLessThanOrEqual(0);
  });

  it('takes half of MAX HP from medium objects', () => {
    expect(BOMB_MEDIUM_RATIO).toBe(0.5);
    for (const type of ['medium', 'bomber', 'turret2'] as const) {
      expect(enemyClass(type).size).toBe('medium');
      const max = ENEMY_STATS[type].hp;
      expect(bombDamage('medium', max, max), type).toBe(max / 2);
      expect(max - bombDamage('medium', max, max), type).toBeGreaterThan(0);
    }
  });

  it('kills a damaged medium object once half its max HP covers what is left', () => {
    const max = ENEMY_STATS.bomber.hp;
    expect(max - 10 - bombDamage('medium', max - 10, max)).toBeGreaterThan(0);
    expect(max / 2 - bombDamage('medium', max / 2, max)).toBeLessThanOrEqual(0);
    expect(7 - bombDamage('medium', 7, max)).toBeLessThanOrEqual(0);
    // Two bombs finish a full-HP medium.
    const after1 = max - bombDamage('medium', max, max);
    expect(after1 - bombDamage('medium', after1, max)).toBeLessThanOrEqual(0);
  });

  it('leaves the boss to its own 8% rule', () => {
    expect(BOSS_CLASS.size).toBe('large');
    expect(bombDamage('large', 840, 840)).toBe(0);
    expect(BOMB_BOSS_RATIO).toBe(0.08);
    const boss = createBoss(cfg);
    updateBoss(boss, cfg.enterDuration);
    const before = bossHpRemaining(boss);
    applyBossBomb(boss);
    expect(before - bossHpRemaining(boss)).toBe(Math.round(bossTotalHp(cfg) * BOMB_BOSS_RATIO));
  });
});

describe('bomb shockwave', () => {
  it('reaches the farthest corner in BOMB_WAVE_TIME', () => {
    expect(BOMB_WAVE_TIME).toBeGreaterThanOrEqual(0.3);
    expect(BOMB_WAVE_TIME).toBeLessThanOrEqual(0.5);
    const reach = bombWaveReach(180, 560);
    expect(reach).toBeCloseTo(Math.hypot(180, 560));
    expect(bombWaveRadius(180, 560, 0)).toBe(0);
    expect(bombWaveRadius(180, 560, BOMB_WAVE_TIME / 2)).toBeCloseTo(reach / 2);
    expect(bombWaveRadius(180, 560, BOMB_WAVE_TIME)).toBeCloseTo(reach);
    expect(bombWaveRadius(180, 560, 5)).toBeCloseTo(reach);
  });

  it('staggers hits by distance, all within BOMB_WAVE_TIME', () => {
    const near = bombArrivalDelay(180, 560, 180, 500);
    const mid = bombArrivalDelay(180, 560, 180, 300);
    const far = bombArrivalDelay(180, 560, 0, 0);
    expect(bombArrivalDelay(180, 560, 180, 560)).toBe(0);
    expect(near).toBeLessThan(mid);
    expect(mid).toBeLessThan(far);
    expect(far).toBeCloseTo(BOMB_WAVE_TIME);
    expect(bombArrivalDelay(180, 560, -50, -50)).toBe(BOMB_WAVE_TIME);
  });
});

describe('bomb against real enemies and buildings', () => {
  const PX = 180;
  const PY = 560;

  function enemy(type: EnemyType, x: number, y: number): Enemy {
    const e = createEnemy();
    spawnEnemy(e, type, x, y, { kind: 'straight', speed: 0 }, { kind: 'none' });
    return e;
  }

  /** Mark, then step the ring until it has passed. Returns the ids that died. */
  function detonate(targets: Enemy[]): Set<Enemy> {
    const dead = new Set<Enemy>();
    for (const t of targets) markBombTarget(t, PX, PY);
    const dt = 1 / 60;
    for (let step = 0; step * dt <= BOMB_WAVE_TIME + dt; step++) {
      for (const t of targets) {
        if (!dead.has(t) && bombArrives(t, dt) && bombHitEnemy(t)) dead.add(t);
      }
    }
    return dead;
  }

  it('kills on-screen small enemies, halves on-screen mediums, ignores off-screen ones', () => {
    const smallOn = (['small', 'drone', 'interceptor', 'tank', 'missile_car'] as const).map(
      (type, i) => enemy(type, 40 + i * 60, 200)
    );
    const mediumOn = (['medium', 'bomber', 'turret2'] as const).map((type, i) =>
      enemy(type, 60 + i * 100, 360)
    );
    const offTop = enemy('small', 180, -20);
    const offBomber = enemy('bomber', 180, -40);
    const offSide = enemy('interceptor', -30, 300);
    const all = [...smallOn, ...mediumOn, offTop, offBomber, offSide];

    const dead = detonate(all);
    for (const e of smallOn) expect(dead.has(e), e.type).toBe(true);
    for (const e of mediumOn) {
      expect(dead.has(e), e.type).toBe(false);
      expect(e.hp, e.type).toBe(e.maxHp / 2);
    }
    for (const e of [offTop, offBomber, offSide]) {
      expect(dead.has(e)).toBe(false);
      expect(e.hp).toBe(e.maxHp);
      expect(e.bombHitIn).toBe(-1);
    }
  });

  it('kills a medium whose HP is already at half or less', () => {
    const hurt = enemy('turret2', 180, 300);
    hurt.hp = hurt.maxHp / 2;
    const scratched = enemy('medium', 100, 300);
    scratched.hp = scratched.maxHp - 1;
    const dead = detonate([hurt, scratched]);
    expect(dead.has(hurt)).toBe(true);
    expect(dead.has(scratched)).toBe(false);
    expect(scratched.hp).toBe(scratched.maxHp / 2 - 1);
  });

  it('lands nearer hits first, all within BOMB_WAVE_TIME', () => {
    const near = enemy('small', 180, 520);
    const far = enemy('small', 20, 20);
    markBombTarget(near, PX, PY);
    markBombTarget(far, PX, PY);
    expect(near.bombHitIn).toBeLessThan(far.bombHitIn);
    expect(far.bombHitIn).toBeLessThanOrEqual(BOMB_WAVE_TIME);
    let t = 0;
    let nearAt = -1;
    let farAt = -1;
    while (t < 1 && (nearAt < 0 || farAt < 0)) {
      t += 1 / 60;
      if (bombArrives(near, 1 / 60)) nearAt = t;
      if (bombArrives(far, 1 / 60)) farAt = t;
    }
    expect(nearAt).toBeGreaterThan(0);
    expect(farAt).toBeGreaterThan(nearAt);
    expect(farAt).toBeLessThanOrEqual(BOMB_WAVE_TIME + 1 / 60);
  });

  it('wrecks on-screen buildings and leaves off-screen ones intact', () => {
    const p = stage1.buildings[0]!;
    const on = createBuilding();
    spawnBuilding(on, p, buildingSpawnScroll(p) + 200);
    const off = createBuilding();
    spawnBuilding(off, p, buildingSpawnScroll(p) - 40);
    expect(markBombTarget(on, PX, PY)).toBe(true);
    expect(markBombTarget(off, PX, PY)).toBe(false);
    let wrecked = false;
    for (let i = 0; i < 40; i++) {
      if (bombArrives(on, 1 / 60) && bombHitBuilding(on)) wrecked = true;
      expect(bombArrives(off, 1 / 60)).toBe(false);
    }
    expect(wrecked).toBe(true);
    expect(on.wrecked).toBe(true);
    expect(off.wrecked).toBe(false);
    expect(off.hp).toBe(BUILDING_HP);
  });
});
