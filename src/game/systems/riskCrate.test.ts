import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import {
  DIFFICULTY_HP_HARD,
  DIFFICULTY_HP_MEDIUM,
  LOGICAL_W,
  RISK_CRATE_DROP_M,
  RISK_CRATE_DROP_P,
  RISK_CRATE_EDGE_INSET,
  RISK_CRATE_HP,
  RISK_CRATE_HOLD,
  RISK_CRATE_SHIELD,
  RISK_CRATE_STOP_Y,
} from '@/game/config';
import type { Difficulty } from '@/game/difficulty';
import { createEnemy, damageEnemy, scaledEnemyVitals, spawnEnemy } from '@/game/entities/enemy';
import { ENEMY_DEFS } from '@/game/entities/enemyDefs';
import { getStage } from '@/game/levels/registry';
import { chooseRiskCrateDrop } from '@/game/systems/dropRules';
import { riskCratesFor, WaveScheduler } from '@/game/systems/waveScheduler';

const stage1 = getStage('1');

function scripted(values: readonly number[]): () => number {
  let i = 0;
  return () => {
    const value = values[i];
    i += 1;
    if (value === undefined) throw new Error('scripted rng ran out');
    return value;
  };
}

interface CrateSpawn {
  t: number;
  x: number;
  fire: string;
  canFire: boolean;
}

function spawnedCrates(difficulty: Difficulty): CrateSpawn[] {
  const scheduler = new WaveScheduler({ mvpOnly: false, stage: stage1, difficulty });
  const found: CrateSpawn[] = [];
  for (let i = 0; i < 160; i++) {
    const batch = scheduler.update(1);
    const t = scheduler.getDebugInfo().time;
    for (const spawn of batch) {
      if (spawn.type !== 'risk_crate') continue;
      found.push({ t, x: spawn.x, fire: spawn.fire.kind, canFire: spawn.canFire });
    }
  }
  return found;
}

function side(x: number): 'left' | 'right' | 'mid' {
  if (x <= RISK_CRATE_EDGE_INSET + 24) return 'left';
  if (x >= LOGICAL_W - RISK_CRATE_EDGE_INSET - 24) return 'right';
  return 'mid';
}

describe('risk crate vitals', () => {
  it('stores shield 12 and body 6, and spends the shield first', () => {
    expect(RISK_CRATE_SHIELD).toBe(12);
    expect(RISK_CRATE_HP).toBe(6);
    expect(ENEMY_DEFS.risk_crate.shield).toBe(12);
    expect(ENEMY_DEFS.risk_crate.hp).toBe(6);
    expect(ENEMY_DEFS.risk_crate.size).toBe('small');
    expect(ENEMY_DEFS.risk_crate.category).toBe('air');
    expect(ENEMY_DEFS.risk_crate.countsInKillRate).toBe(false);

    const enemy = createEnemy();
    spawnEnemy(
      enemy,
      'risk_crate',
      LOGICAL_W / 2,
      -20,
      { kind: 'hover', stopY: RISK_CRATE_STOP_Y, hold: RISK_CRATE_HOLD },
      { kind: 'none' }
    );
    expect(enemy.shield).toBe(12);
    expect(enemy.maxShield).toBe(12);
    expect(enemy.hp).toBe(6);
    expect(enemy.maxHp).toBe(6);
    expect(enemy.fire.kind).toBe('none');

    expect(damageEnemy(enemy, 12)).toBe(false);
    expect(enemy.shield).toBe(0);
    expect(enemy.hp).toBe(6);

    const crossing = createEnemy();
    spawnEnemy(
      crossing,
      'risk_crate',
      0,
      0,
      { kind: 'hover', stopY: RISK_CRATE_STOP_Y, hold: RISK_CRATE_HOLD },
      { kind: 'none' }
    );
    expect(damageEnemy(crossing, 14)).toBe(false);
    expect(crossing.shield).toBe(0);
    expect(crossing.hp).toBe(4);
    expect(damageEnemy(crossing, 3)).toBe(false);
    expect(crossing.hp).toBe(1);
    expect(damageEnemy(crossing, 1)).toBe(true);
  });

  it('scales shield and body with the run difficulty', () => {
    expect(scaledEnemyVitals('risk_crate', 'easy')).toEqual({ hp: 6, shield: 12 });
    const medium = scaledEnemyVitals('risk_crate', 'medium');
    expect(medium.hp).toBeCloseTo(6 * DIFFICULTY_HP_MEDIUM);
    expect(medium.shield).toBeCloseTo(12 * DIFFICULTY_HP_MEDIUM);
    const hard = scaledEnemyVitals('risk_crate', 'hard');
    expect(hard.hp).toBeCloseTo(6 * DIFFICULTY_HP_HARD);
    expect(hard.shield).toBeCloseTo(12 * DIFFICULTY_HP_HARD);
    expect(scaledEnemyVitals('small', 'hard').shield).toBe(0);
  });
});

describe('risk crate drops', () => {
  it('drops M when mate is 0 and does not roll', () => {
    expect(RISK_CRATE_DROP_M).toBe(0.5);
    expect(RISK_CRATE_DROP_P).toBe(0.25);
    expect(RISK_CRATE_DROP_M + RISK_CRATE_DROP_P).toBeLessThan(1);
    let calls = 0;
    const rng = () => {
      calls += 1;
      return 0.99;
    };
    expect(chooseRiskCrateDrop(0, rng)).toBe('M');
    expect(calls).toBe(0);
    for (let seed = 1; seed <= 20; seed++) {
      expect(chooseRiskCrateDrop(0, createRng(seed))).toBe('M');
    }
  });

  it('weights M 50% / P 25% / T 25% once mate is up, and never drops B', () => {
    expect(chooseRiskCrateDrop(1, scripted([0]))).toBe('M');
    expect(chooseRiskCrateDrop(1, scripted([0.49]))).toBe('M');
    expect(chooseRiskCrateDrop(2, scripted([0.5]))).toBe('P');
    expect(chooseRiskCrateDrop(1, scripted([0.74]))).toBe('P');
    expect(chooseRiskCrateDrop(2, scripted([0.75]))).toBe('T');
    expect(chooseRiskCrateDrop(1, scripted([0.99]))).toBe('T');

    const counts = { M: 0, P: 0, T: 0, B: 0 };
    for (let i = 0; i < 1000; i++) {
      const item = chooseRiskCrateDrop(1, () => i / 1000);
      counts[item] += 1;
    }
    expect(counts.B).toBe(0);
    expect(counts.M).toBe(500);
    expect(counts.P).toBe(250);
    expect(counts.T).toBe(250);
  });
});

describe('stage 1 risk crate spawns', () => {
  it('puts one centered crate on easy, inside the 50–60s window', () => {
    const authored = riskCratesFor(stage1.riskCrates ?? [], 'easy');
    expect(authored).toHaveLength(1);
    expect(authored[0]!.x).toBe(LOGICAL_W / 2);
    expect(authored[0]!.t).toBeGreaterThanOrEqual(50);
    expect(authored[0]!.t).toBeLessThanOrEqual(60);

    const spawned = spawnedCrates('easy');
    expect(spawned).toEqual([
      { t: authored[0]!.t, x: LOGICAL_W / 2, fire: 'none', canFire: false },
    ]);
  });

  it('puts two edge crates on medium, swapping sides from t≈50 to t≈100', () => {
    const spawned = spawnedCrates('medium');
    expect(spawned).toHaveLength(2);
    expect(spawned[0]!.t).toBeGreaterThanOrEqual(48);
    expect(spawned[0]!.t).toBeLessThanOrEqual(55);
    expect(spawned[1]!.t).toBeGreaterThanOrEqual(95);
    expect(spawned[1]!.t).toBeLessThanOrEqual(105);
    expect(side(spawned[0]!.x)).not.toBe('mid');
    expect(side(spawned[1]!.x)).not.toBe('mid');
    expect(side(spawned[0]!.x)).not.toBe(side(spawned[1]!.x));
    expect(spawned.every((crate) => crate.fire === 'none' && !crate.canFire)).toBe(true);
  });

  it('adds a slightly off-center crate at t≈75 on hard', () => {
    const medium = spawnedCrates('medium');
    const hard = spawnedCrates('hard');
    expect(hard).toHaveLength(3);
    const extra = hard.filter(
      (crate) => !medium.some((other) => other.t === crate.t && other.x === crate.x)
    );
    expect(extra).toHaveLength(1);
    expect(extra[0]!.t).toBeGreaterThanOrEqual(70);
    expect(extra[0]!.t).toBeLessThanOrEqual(80);
    expect(side(extra[0]!.x)).toBe('mid');
    expect(extra[0]!.x).not.toBe(LOGICAL_W / 2);
    expect(Math.abs(extra[0]!.x - LOGICAL_W / 2)).toBeLessThan(80);
  });

  it('does not add crates to the 148-ship wave list or a scheduler with no difficulty', () => {
    const plain = new WaveScheduler({ mvpOnly: false, stage: stage1 });
    const spawns = [];
    for (let i = 0; i < 160; i++) spawns.push(...plain.update(1));
    expect(spawns.some((spawn) => spawn.type === 'risk_crate')).toBe(false);
    expect(plain.getDebugInfo().spawned).toBe(149);

    const hard = new WaveScheduler({ mvpOnly: false, stage: stage1, difficulty: 'hard' });
    hard.setPowerLevel(1);
    for (let i = 0; i < 160; i++) hard.update(1);
    expect(hard.getDebugInfo().spawned).toBe(149);
  });

  it('skips crates a boss-practice seek jumps over', () => {
    const scheduler = new WaveScheduler({ mvpOnly: false, stage: stage1, difficulty: 'hard' });
    scheduler.seek(stage1.boss.enterAt);
    const later = scheduler.update(5);
    expect(later.some((spawn) => spawn.type === 'risk_crate')).toBe(false);
    expect(scheduler.getDebugInfo().spawned).toBe(0);
  });
});
