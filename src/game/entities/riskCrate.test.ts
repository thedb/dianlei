import { describe, expect, it } from 'vitest';
import {
  LOGICAL_H,
  RISK_CRATE_BODY_HP,
  RISK_CRATE_DROP_M_SHARE,
  RISK_CRATE_DROP_P_SHARE,
  RISK_CRATE_SHIELD_HP,
  RISK_CRATE_SINE_AMP,
  RISK_CRATE_SINE_PERIOD,
  RISK_CRATE_SIZE,
  RISK_CRATE_VY,
} from '@/game/config';
import { difficultyProfile, type Difficulty } from '@/game/difficulty';
import { getStage } from '@/game/levels/registry';
import type { RiskCrateSlot } from '@/game/levels/types';
import { bombHitRiskCrate } from '@/game/systems/bomb';
import {
  RiskCrateScheduler,
  chooseRiskCrateDrop,
  createRiskCrate,
  damageRiskCrate,
  selectRiskCrateSlots,
  spawnRiskCrate,
  updateRiskCrate,
} from './riskCrate';

const stage1 = getStage('1');
const slots = stage1.riskCrates!;

function scheduled(difficulty: Difficulty): RiskCrateSlot[] {
  return selectRiskCrateSlots(slots, difficultyProfile(difficulty).riskCrateCount);
}

function emitAll(list: readonly RiskCrateSlot[], until = 200): string[] {
  const scheduler = new RiskCrateScheduler(list);
  return scheduler.update(until).map((slot) => slot.id);
}

describe('stage 1 risk crate slots', () => {
  it('authors R1, R2, then the hard-only R3', () => {
    expect(slots).toEqual([
      { id: 'R1', t: 50, x: 90 },
      { id: 'R2', t: 100, x: 270 },
      { id: 'R3', t: 75, x: 160 },
    ]);
    expect(slots[2]!.x).toBeGreaterThanOrEqual(140);
    expect(slots[2]!.x).toBeLessThanOrEqual(220);
  });

  it('keeps a difficulty prefix, so medium is R1 and R2 and hard adds R3', () => {
    expect(scheduled('easy').map((slot) => slot.id)).toEqual([]);
    expect(scheduled('medium').map((slot) => slot.id)).toEqual(['R1', 'R2']);
    expect(scheduled('hard').map((slot) => slot.id)).toEqual(['R1', 'R2', 'R3']);
  });

  it('emits nothing on easy, two on medium, and three on hard in time order', () => {
    expect(emitAll(scheduled('easy'))).toEqual([]);
    expect(emitAll(scheduled('medium'))).toEqual(['R1', 'R2']);
    expect(emitAll(scheduled('hard'))).toEqual(['R1', 'R3', 'R2']);
  });

  it('spawns each slot once, on its timestamp', () => {
    const scheduler = new RiskCrateScheduler(scheduled('hard'));
    expect(scheduler.update(49.9)).toEqual([]);
    expect(scheduler.update(50).map((slot) => slot.id)).toEqual(['R1']);
    expect(scheduler.update(50)).toEqual([]);
    expect(scheduler.update(75).map((slot) => slot.id)).toEqual(['R3']);
    expect(scheduler.update(100).map((slot) => slot.id)).toEqual(['R2']);
  });

  it('skips slots a boss-practice jump has already passed', () => {
    const scheduler = new RiskCrateScheduler(scheduled('hard'));
    scheduler.seek(80);
    expect(scheduler.update(200).map((slot) => slot.id)).toEqual(['R2']);
  });

  it('does not reorder the stage table', () => {
    const before = slots.map((slot) => slot.id).join();
    emitAll(slots);
    expect(slots.map((slot) => slot.id).join()).toBe(before);
  });
});

describe('risk crate hull', () => {
  function fresh() {
    const crate = createRiskCrate();
    spawnRiskCrate(crate, { id: 'R1', t: 50, x: 90 });
    return crate;
  }

  it('spends the shield before the body', () => {
    const crate = fresh();
    expect(crate.shield).toBe(RISK_CRATE_SHIELD_HP);
    expect(crate.hp).toBe(RISK_CRATE_BODY_HP);
    expect(damageRiskCrate(crate, 5)).toBe(false);
    expect(crate.shield).toBe(7);
    expect(crate.hp).toBe(6);
    expect(damageRiskCrate(crate, 7)).toBe(false);
    expect(crate.shield).toBe(0);
    expect(crate.hp).toBe(6);
    expect(damageRiskCrate(crate, 5)).toBe(false);
    expect(crate.hp).toBe(1);
    expect(damageRiskCrate(crate, 1)).toBe(true);
    expect(crate.hp).toBe(0);
    expect(damageRiskCrate(crate, 4)).toBe(false);
  });

  it('lets one hit spill from the shield into the body', () => {
    const crate = fresh();
    expect(damageRiskCrate(crate, 14)).toBe(false);
    expect(crate.shield).toBe(0);
    expect(crate.hp).toBe(4);
  });

  it('is destroyed outright by a bomb', () => {
    const crate = fresh();
    expect(bombHitRiskCrate(crate)).toBe(true);
    expect(crate.shield).toBe(0);
    expect(crate.hp).toBe(0);
  });
});

describe('risk crate drops', () => {
  it('always drops M at mate 0 and does not roll', () => {
    let draws = 0;
    const rng = () => {
      draws++;
      return 0.9;
    };
    expect(chooseRiskCrateDrop(0, rng)).toBe('M');
    expect(draws).toBe(0);
  });

  it('rolls M, then P, then T once mate is at least 1', () => {
    const m = RISK_CRATE_DROP_M_SHARE;
    const p = RISK_CRATE_DROP_P_SHARE;
    const roll = (u: number) => chooseRiskCrateDrop(1, () => u);
    expect(roll(0)).toBe('M');
    expect(roll(m - 0.0001)).toBe('M');
    expect(roll(m)).toBe('P');
    expect(roll(m + p - 0.0001)).toBe('P');
    expect(roll(m + p)).toBe('T');
    expect(roll(0.99)).toBe('T');
    expect(chooseRiskCrateDrop(2, () => m)).toBe('P');
  });
});

describe('risk crate motion', () => {
  it('enters from the top, sways, and leaves through the bottom', () => {
    const crate = createRiskCrate();
    spawnRiskCrate(crate, { id: 'R1', t: 50, x: 90 });
    expect(crate.y).toBe(-RISK_CRATE_SIZE / 2);
    expect(crate.x).toBe(90);
    expect(updateRiskCrate(crate, RISK_CRATE_SINE_PERIOD / 4)).toBe(false);
    expect(crate.x).toBeCloseTo(90 + RISK_CRATE_SINE_AMP);
    expect(crate.y).toBeGreaterThan(-RISK_CRATE_SIZE / 2);
    spawnRiskCrate(crate, { id: 'R1', t: 50, x: 90 });
    expect(updateRiskCrate(crate, RISK_CRATE_SINE_PERIOD)).toBe(false);
    expect(crate.x).toBeCloseTo(90);
    expect(crate.y).toBeCloseTo(-RISK_CRATE_SIZE / 2 + RISK_CRATE_VY * RISK_CRATE_SINE_PERIOD);
    expect(updateRiskCrate(crate, 30)).toBe(true);
    expect(crate.y - crate.height / 2).toBeGreaterThan(LOGICAL_H);
  });
});
