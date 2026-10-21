import { describe, expect, it } from 'vitest';
import { BUILDING_HP } from '@/game/config';
import { ENEMY_STATS } from '@/game/entities/enemy';
import { stage1 } from '@/game/levels/stage1';
import {
  DIFFICULTY_HP_SCALE,
  bossUsesPhase3,
  prepareBossConfig,
  scaleHp,
  type Difficulty,
} from './difficulty';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

describe('difficulty HP scale', () => {
  it('uses 1, 1.15, and 1.3', () => {
    expect(DIFFICULTY_HP_SCALE).toEqual({ easy: 1, medium: 1.15, hard: 1.3 });
  });

  it('leaves Easy HP identical and multiplies Medium and Hard', () => {
    for (const type of Object.keys(ENEMY_STATS) as (keyof typeof ENEMY_STATS)[]) {
      const hp = ENEMY_STATS[type].hp;
      for (const difficulty of DIFFICULTIES) {
        expect(scaleHp(hp, difficulty), `${type} ${difficulty}`).toBeCloseTo(
          hp * DIFFICULTY_HP_SCALE[difficulty]
        );
      }
    }
    expect(scaleHp(BUILDING_HP, 'easy')).toBe(BUILDING_HP);
    expect(scaleHp(BUILDING_HP, 'medium')).toBeCloseTo(BUILDING_HP * 1.15);
    expect(scaleHp(BUILDING_HP, 'hard')).toBeCloseTo(BUILDING_HP * 1.3);
    expect(scaleHp(3, 'easy')).toBe(3);
  });

  it('scales boss parts and the phase-3 segment without editing the stage table', () => {
    const turret = stage1.boss.parts[0]!.hp;
    const core = stage1.boss.parts[2]!.hp;
    const phase3 = stage1.boss.phase3!.hp;
    const hard = prepareBossConfig(stage1.boss, 'hard');
    const easy = prepareBossConfig(stage1.boss, 'easy');

    expect(stage1.boss.parts[0]!.hp).toBe(turret);
    expect(stage1.boss.phase3!.hp).toBe(phase3);
    expect(easy.parts.map((part) => part.hp)).toEqual(stage1.boss.parts.map((part) => part.hp));
    expect(hard.parts[0]!.hp).toBeCloseTo(turret * 1.3);
    expect(hard.parts[2]!.hp).toBeCloseTo(core * 1.3);
    expect(hard.phase3!.hp).toBeCloseTo(phase3 * 1.3);
    expect(bossUsesPhase3('easy')).toBe(false);
    expect(bossUsesPhase3('hard')).toBe(true);
  });
});
