import { describe, expect, it } from 'vitest';
import { BUILDING_HP, LIVES_EASY, LIVES_MAX, LIVES_ROOKIE, LIVES_START } from '@/game/config';
import { placementsForDifficulty } from '@/game/entities/building';
import { ENEMY_STATS } from '@/game/entities/enemy';
import { getStage, listStages } from '@/game/levels/registry';
import { stageEnemyCount } from '@/game/levels/stageStats';
import { bossPhaseDef } from '@/game/systems/boss';
import { WaveScheduler, riskCratesFor } from '@/game/systems/waveScheduler';
import {
  DIFFICULTY_HP_SCALE,
  DIFFICULTY_PROFILES,
  bossUsesPhase3,
  livesMax,
  prepareBossConfig,
  scaleHp,
  startingLives,
  waveTableOf,
  type Difficulty,
} from './difficulty';

const stage1 = getStage('1');

const DIFFICULTIES: Difficulty[] = ['rookie', 'easy', 'medium', 'hard'];

function spawnSignature(stageId: string, difficulty: Difficulty): string {
  const scheduler = new WaveScheduler({ mvpOnly: false, stage: getStage(stageId), difficulty });
  scheduler.setPowerLevel(3);
  const spawns = [];
  for (let i = 0; i < 140; i++) spawns.push(...scheduler.update(1));
  return JSON.stringify(spawns);
}

describe('difficulty HP scale', () => {
  it('uses 1, 1.15, and 1.3, with 菜鸟 on the Easy scale', () => {
    expect(DIFFICULTY_HP_SCALE).toEqual({ rookie: 1, easy: 1, medium: 1.15, hard: 1.3 });
  });

  it('leaves Easy and 菜鸟 HP identical and multiplies Medium and Hard', () => {
    for (const type of Object.keys(ENEMY_STATS) as (keyof typeof ENEMY_STATS)[]) {
      const hp = ENEMY_STATS[type].hp;
      for (const difficulty of DIFFICULTIES) {
        expect(scaleHp(hp, difficulty), `${type} ${difficulty}`).toBeCloseTo(
          hp * DIFFICULTY_HP_SCALE[difficulty]
        );
      }
    }
    expect(scaleHp(BUILDING_HP, 'rookie')).toBe(BUILDING_HP);
    expect(scaleHp(BUILDING_HP, 'easy')).toBe(BUILDING_HP);
    expect(scaleHp(BUILDING_HP, 'medium')).toBeCloseTo(BUILDING_HP * 1.15);
    expect(scaleHp(BUILDING_HP, 'hard')).toBeCloseTo(BUILDING_HP * 1.3);
    expect(scaleHp(3, 'easy')).toBe(3);
    expect(scaleHp(3, 'rookie')).toBe(3);
  });

  it('scales boss parts and the phase-3 segment without editing the stage table', () => {
    const turret = stage1.boss.parts[0]!.hp;
    const core = stage1.boss.parts[2]!.hp;
    const phase3 = bossPhaseDef(stage1.boss, 'phase3').segmentHp!;
    const hard = prepareBossConfig(stage1.boss, 'hard');
    const easy = prepareBossConfig(stage1.boss, 'easy');

    expect(stage1.boss.parts[0]!.hp).toBe(turret);
    expect(bossPhaseDef(stage1.boss, 'phase3').segmentHp).toBe(phase3);
    expect(easy.parts.map((part) => part.hp)).toEqual(stage1.boss.parts.map((part) => part.hp));
    expect(hard.parts[0]!.hp).toBeCloseTo(turret * 1.3);
    expect(hard.parts[2]!.hp).toBeCloseTo(core * 1.3);
    expect(bossPhaseDef(hard, 'phase3').segmentHp!).toBeCloseTo(phase3 * 1.3);
    expect(bossUsesPhase3('rookie')).toBe(false);
    expect(bossUsesPhase3('easy')).toBe(false);
    expect(bossUsesPhase3('hard')).toBe(true);
    expect(prepareBossConfig(stage1.boss, 'rookie').parts.map((part) => part.hp)).toEqual(
      prepareBossConfig(stage1.boss, 'easy').parts.map((part) => part.hp)
    );
  });

  it('gives 菜鸟 99 lives on the Easy table and leaves Easy at 10', () => {
    expect(startingLives('rookie')).toBe(LIVES_ROOKIE);
    expect(startingLives('rookie')).toBe(99);
    expect(livesMax('rookie')).toBe(99);
    expect(startingLives('easy')).toBe(LIVES_EASY);
    expect(startingLives('easy')).toBe(10);
    expect(livesMax('easy')).toBe(LIVES_MAX);
    expect(livesMax('medium')).toBe(LIVES_MAX);
    expect(livesMax('hard')).toBe(LIVES_MAX);
    expect(startingLives('medium')).toBe(LIVES_START);
    expect(startingLives('hard')).toBe(LIVES_START);
    expect(waveTableOf('rookie')).toBe('easy');
    expect(waveTableOf('easy')).toBe('easy');
    expect(DIFFICULTY_PROFILES.rookie.bulletSpeedScale).toBe(1);
    expect(DIFFICULTY_PROFILES.rookie.fireRateScale).toBe(1);
    expect(DIFFICULTY_PROFILES.rookie.bossGates).toEqual([]);
    expect(DIFFICULTY_PROFILES.rookie.hpScale).toBe(DIFFICULTY_PROFILES.easy.hpScale);

    for (const stage of listStages()) {
      expect(stageEnemyCount(stage, true, 'rookie'), stage.id).toBe(
        stageEnemyCount(stage, true, 'easy')
      );
      expect(stageEnemyCount(stage, false, 'rookie'), stage.id).toBe(
        stageEnemyCount(stage, false, 'easy')
      );
      expect(riskCratesFor(stage.riskCrates ?? [], 'rookie')).toEqual(
        riskCratesFor(stage.riskCrates ?? [], 'easy')
      );
      expect(placementsForDifficulty(stage.buildings, 'rookie').map((b) => b.id)).toEqual(
        placementsForDifficulty(stage.buildings, 'easy').map((b) => b.id)
      );
    }
    expect(spawnSignature('2', 'rookie')).toBe(spawnSignature('2', 'easy'));
    expect(spawnSignature('2', 'rookie')).not.toBe(spawnSignature('2', 'medium'));
    expect(spawnSignature('4', 'rookie')).toBe(spawnSignature('4', 'easy'));
  });
});
