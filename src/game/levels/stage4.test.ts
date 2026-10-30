import { describe, expect, it } from 'vitest';
import { createRng, type Rng } from '@/engine/rng';
import {
  AA_BURST_DELAY,
  AA_GUN_HP,
  BUILDING_HP,
  CARRIER_RUSH_TIME,
  OBSIDIAN_ENTER_AT,
  OBSIDIAN_RADIUS,
  RADAR_PAINT_MIN,
  STAGE4_FIRST_SPAWN,
  STAGE4_WARNING_AT,
  STAGE4_WRECK_AT,
} from '@/game/config';
import { CAPTION_LINES, activeCaption } from '@/game/story/captions';
import { BOSS_STAGE_ROWS } from '@/game/ui/bossChallenge';
import { STAGE_SELECT_ROWS, stageHeading } from '@/game/ui/stageSelect';
import { ENEMY_DEFS } from '@/game/entities/enemyDefs';
import {
  BUILDING_SPECS,
  placementsForDifficulty,
  validateBuildingFootprint,
} from '@/game/entities/building';
import { getMapGrid } from '@/game/maps';
import { SEA_FLOAT_ANCHORS, SEA_GUN_PADS } from '@/game/maps/seaB';
import { resolvePlacementDrops } from '@/game/systems/dropRules';
import { stageEnemyCount } from './stageStats';
import type { Move } from './types';
import { getStage, listStages, nextStageId } from './registry';

describe('stage 4 shell', () => {
  const stage = getStage('4');

  it('is 航母出击 on 海面B, then 黑曜舰空', () => {
    expect(stage.id).toBe('4');
    expect(stage.label).toBe('4');
    expect(stage.name).toBe('航母出击');
    expect(stage.stage).toBe(4);
    expect(stage.warningAt).toBe(STAGE4_WARNING_AT);
    expect(STAGE4_WARNING_AT).toBe(118);
    expect(stage.boss.id).toBe('obsidian');
    expect(stage.boss.script).toBe('obsidian');
    expect(stage.boss.enterAt).toBe(OBSIDIAN_ENTER_AT);
    expect(OBSIDIAN_ENTER_AT).toBe(123);
    expect(stage.boss.parts[0]?.radius).toBe(OBSIDIAN_RADIUS);
    expect(OBSIDIAN_RADIUS).toBe(32);
    expect(stage.boss.drift.amp).toBe(0);
    expect(stage.boss.phases[0]?.attacks).toEqual([]);
    expect(
      stage.boss.phases.some((phase) => phase.attacks.some((attack) => attack.kind === 'laser'))
    ).toBe(false);
    expect(stage.maps).toEqual({ run: [{ map: 'seaB', at: 0 }], boss: 'obsidianBoss' });
    expect(stage.captions).toEqual([
      { id: 's4_open', at: 'open' },
      { id: 's4_wreck', at: 'mid', t: STAGE4_WRECK_AT },
      { id: 's4_ufo', at: 'cutscene' },
    ]);
    expect(stage.waves.length).toBeGreaterThan(0);
    expect(stage.buildings.length).toBeGreaterThan(0);
    expect(listStages().map((entry) => entry.id)).toEqual(['1', '2', '3', '4']);
    expect(nextStageId('3')).toBe('4');
    expect(nextStageId('4')).toBeUndefined();
  });

  it('shows up in 关卡选择 and 挑战 Boss', () => {
    expect(stageHeading(stage)).toBe('第四关');
    expect(STAGE_SELECT_ROWS.find((row) => row.action === '4')).toEqual({
      action: '4',
      title: '第四关',
      sub: '航母出击',
    });
    expect(BOSS_STAGE_ROWS.find((row) => row.action === '4')).toEqual({
      action: '4',
      title: '4',
      sub: '黑曜',
    });
  });

  it('keeps the three caption lines locked, and wires open plus the saucer cue', () => {
    expect(CAPTION_LINES.s4_open).toBe('航母甲板就绪。电雷，出击。');
    expect(CAPTION_LINES.s4_wreck).toBe('不明残骸……弹痕不像地球武器。');
    expect(CAPTION_LINES.s4_ufo).toBe('未知飞行物击毁目标后撤离。追踪。');
  });
});

const FORBIDDEN_MOVES = new Set<Move['kind']>([
  'sine',
  'v_dive',
  'cross',
  'rear_diag',
  'step_slide',
  'dive_once',
  'strafe',
  'planted',
  'slow_push',
]);

describe('stage 4 naval run', () => {
  const stage = getStage('4');

  it('opens at or after the carrier floor and stops before the warning', () => {
    expect(STAGE4_FIRST_SPAWN).toBeCloseTo(CARRIER_RUSH_TIME + 8, 5);
    expect(stage.waves[0]?.t).toBeGreaterThanOrEqual(STAGE4_FIRST_SPAWN);
    for (const wave of stage.waves) {
      expect(wave.t, wave.id).toBeGreaterThanOrEqual(STAGE4_FIRST_SPAWN);
      expect(wave.t, wave.id).toBeLessThan(STAGE4_WARNING_AT);
      expect(wave.mvp).toBe(true);
    }
    expect(stage.warningAt).toBe(118);
    expect(stage.boss.enterAt).toBe(123);
  });

  it('counts 132 / 168 / 200 ships at full power, with a heavier wreck', () => {
    expect(stageEnemyCount(stage, false, 'easy')).toBe(132);
    expect(stageEnemyCount(stage, false, 'medium')).toBe(168);
    expect(stageEnemyCount(stage, false, 'hard')).toBe(200);
    const wreck = (difficulty: 'easy' | 'medium' | 'hard') =>
      stage.waves
        .filter((wave) => wave.section === 'wreck' && wave.id !== 'W30')
        .reduce((sum, wave) => {
          const only = {
            ...stage,
            waves: [wave],
          };
          return sum + stageEnemyCount(only, true, difficulty);
        }, 0);
    expect(wreck('easy')).toBe(28);
    expect(wreck('medium')).toBe(36);
    expect(wreck('hard')).toBe(43);
    const ships = (id: string, difficulty: 'easy' | 'medium' | 'hard') => {
      const wave = stage.waves.find((row) => row.id === id);
      expect(wave, id).toBeDefined();
      return stageEnemyCount({ ...stage, waves: [wave!] }, true, difficulty);
    };
    expect(ships('W01', 'easy')).toBe(8);
    expect(ships('W01', 'medium')).toBe(10);
    expect(ships('W01', 'hard')).toBe(11);
    expect(ships('W09', 'hard')).toBe(11);
    expect(ships('W14', 'hard')).toBe(11);
    expect(ships('W17', 'easy')).toBe(8);
    expect(ships('W17', 'medium')).toBe(9);
    expect(ships('W17', 'hard')).toBe(10);
    expect(ships('W21', 'easy')).toBe(4);
    expect(ships('W21', 'medium')).toBe(6);
    expect(ships('W21', 'hard')).toBe(7);
    expect(ships('W24', 'hard')).toBe(9);
    expect(ships('W28', 'hard')).toBe(9);
    expect(ships('W29', 'easy')).toBe(4);
    expect(ships('W29', 'medium')).toBe(6);
    expect(ships('W29', 'hard')).toBe(7);
    expect(ships('W12', 'hard')).toBe(2);
    expect(ships('W26', 'hard')).toBe(2);
  });

  it('uses the naval moves and refuses the old signatures', () => {
    const kinds = new Set<Move['kind']>();
    for (const wave of stage.waves) {
      for (const group of wave.groups) {
        kinds.add(group.move.kind);
        expect(FORBIDDEN_MOVES.has(group.move.kind), `${wave.id} ${group.move.kind}`).toBe(false);
        expect(group.enemy, wave.id).not.toBe('bomber');
        if (group.move.kind === 'radar_paint') {
          expect(group.move.paint).toBeGreaterThanOrEqual(RADAR_PAINT_MIN);
        }
        if (group.fire.kind === 'splash') {
          expect(group.fire.kind).toBe('splash');
        }
        expect(group.fire.kind, wave.id).not.toBe('fan5');
      }
    }
    expect(kinds.has('wake_climb')).toBe(true);
    expect(kinds.has('cross_skim')).toBe(true);
    expect(kinds.has('radar_paint')).toBe(true);
    expect(ENEMY_DEFS.torpedo).toMatchObject({ size: 'medium', category: 'air', hp: 56 });
    expect([ENEMY_DEFS.torpedo.width, ENEMY_DEFS.torpedo.height]).toEqual([48, 40]);
    const torpedo = stage.waves
      .flatMap((wave) => wave.groups)
      .filter((group) => group.enemy === 'torpedo');
    expect(
      torpedo.every((group) => group.fire.kind === 'torpedo' && group.move.kind === 'wake_climb')
    ).toBe(true);
    expect(
      stageEnemyCount(
        { ...stage, waves: stage.waves.filter((w) => w.groups.some((g) => g.enemy === 'torpedo')) },
        true,
        'easy'
      )
    ).toBe(3);
    expect(
      stageEnemyCount(
        { ...stage, waves: stage.waves.filter((w) => w.groups.some((g) => g.enemy === 'torpedo')) },
        true,
        'hard'
      )
    ).toBe(5);
  });

  it('fields five flak guns on easy and medium, and four on hard', () => {
    expect(BUILDING_SPECS.aa_gun.hp).toBe(AA_GUN_HP);
    expect(AA_GUN_HP).not.toBe(BUILDING_HP);
    expect(BUILDING_SPECS.aa_gun.fire?.kind).toBe('airburst');
    expect(AA_BURST_DELAY.easy).toBeGreaterThanOrEqual(0.6);
    expect(AA_BURST_DELAY.hard).toBeLessThanOrEqual(0.9);
    expect(AA_BURST_DELAY.hard).toBeLessThan(AA_BURST_DELAY.medium);
    expect(AA_BURST_DELAY.medium).toBeLessThan(AA_BURST_DELAY.easy);
    const grid = getMapGrid('seaB');
    const ids = (difficulty: 'easy' | 'medium' | 'hard') =>
      placementsForDifficulty(stage.buildings, difficulty).map((b) => b.id);
    expect(ids('easy')).toEqual(['B01', 'B02', 'B03', 'B04', 'B05']);
    expect(ids('medium')).toEqual(['B01', 'B02', 'B03', 'B04', 'B05']);
    expect(ids('hard')).toEqual(['B01', 'B02', 'B03', 'B04']);
    expect(stage.buildings.map((b) => b.type).every((type) => type === 'aa_gun')).toBe(true);
    expect(stage.buildings.find((b) => b.id === 'B05')?.difficulties).toEqual(['easy', 'medium']);
    expect(stage.buildings.some((b) => b.id === 'B06')).toBe(false);
    expect(SEA_GUN_PADS.some((pad) => pad.id === 'B06')).toBe(true);
    for (const placed of stage.buildings) {
      expect(validateBuildingFootprint(grid, placed)).toBe(true);
    }
    const scripted =
      (value: number): Rng =>
      () =>
        value;
    const mate = (difficulty: 'easy' | 'medium' | 'hard', roll: number) => {
      const fixed = resolvePlacementDrops(
        placementsForDifficulty(stage.buildings, difficulty),
        scripted(roll)
      );
      return ['B04', 'B05'].filter((id) => fixed.get(id) === 'M');
    };
    expect(mate('easy', 0)).toEqual(['B04']);
    expect(mate('easy', 0.5)).toEqual(['B05']);
    expect(mate('medium', 0.5)).toEqual(['B05']);
    expect(mate('hard', 0)).toEqual(['B04']);
    expect(mate('hard', 0.99)).toEqual(['B04']);
    expect(
      resolvePlacementDrops(placementsForDifficulty(stage.buildings, 'hard'), createRng(4)).get(
        'B05'
      )
    ).toBeUndefined();
  });

  it('keeps eight wreck floats that are not an enemy type', () => {
    expect(stage.wreckFloats).toHaveLength(8);
    expect(Object.keys(ENEMY_DEFS)).not.toContain('wreck_float');
    expect(SEA_FLOAT_ANCHORS).toHaveLength(8);
    for (const anchor of SEA_FLOAT_ANCHORS) {
      expect(stage.wreckFloats).toContainEqual({
        id: anchor.id,
        map: 'seaB',
        row: anchor.row,
        col: anchor.col,
      });
    }
  });

  it('shows the wreck line at 96 seconds', () => {
    expect(activeCaption(stage.captions, STAGE4_WRECK_AT, null)?.id).toBe('s4_wreck');
    expect(activeCaption(stage.captions, STAGE4_WRECK_AT - 0.1, null)?.id).not.toBe('s4_wreck');
  });
});
