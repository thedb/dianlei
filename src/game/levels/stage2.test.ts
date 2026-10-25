import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import {
  BG_SCROLL_SPEED,
  POWER_MAX,
  REAR_DIAG_SPAWN_X_LEFT,
  REAR_DIAG_SPAWN_X_RIGHT,
  STAGE2_WARNING_AT,
} from '@/game/config';
import { DIFFICULTY_PROFILES, scaleHp, type Difficulty } from '@/game/difficulty';
import {
  BUILDING_SPECS,
  buildingCenter,
  buildingExitScroll,
  buildingSpawnScroll,
  placeBuildings,
  validateBuildingFootprint,
} from '@/game/entities/building';
import { ENEMY_DEFS } from '@/game/entities/enemyDefs';
import { getStage, nextStageId, stageEnemyCount } from '@/game/levels/registry';
import { getMapGrid } from '@/game/maps';
import { buildStageTrack } from '@/game/maps/track';
import { chooseBuildingDrop, resolvePlacementDrops } from '@/game/systems/dropRules';
import {
  resolveSpawnPosition,
  riskCratesFor,
  WaveScheduler,
  type SpawnRequest,
} from '@/game/systems/waveScheduler';
import type { Move, SpawnGroup } from './types';

const stage = getStage('2');

const COUNTS = {
  easy: {
    small: 84,
    medium: 6,
    interceptor: 10,
    bomber: 3,
    drone: 6,
    tank: 10,
    turret2: 1,
    missile_car: 2,
    total: 122,
    score: 27800,
  },
  medium: {
    small: 115,
    medium: 6,
    interceptor: 12,
    bomber: 3,
    drone: 8,
    tank: 10,
    turret2: 3,
    missile_car: 2,
    total: 159,
    score: 33900,
  },
  hard: {
    small: 138,
    medium: 6,
    interceptor: 14,
    bomber: 3,
    drone: 8,
    tank: 11,
    turret2: 3,
    missile_car: 3,
    total: 186,
    score: 37100,
  },
} as const;

/** Doc §4.5 centers and the scroll times at 40 px/s. */
const BUILDING_CLOCK = [
  { id: 'B01', x: 268, enter: 9.6, exit: 26.4 },
  { id: 'B02', x: 276, enter: 25.6, exit: 42.4 },
  { id: 'B03', x: 76, enter: 28.8, exit: 45.6 },
  { id: 'B04', x: 268, enter: 38.4, exit: 55.2 },
  { id: 'B05', x: 276, enter: 54.4, exit: 71.2 },
  { id: 'B06', x: 44, enter: 76, exit: 92.8 },
  { id: 'B07', x: 268, enter: 76, exit: 92.8 },
  { id: 'B08', x: 140, enter: 76.8, exit: 93.6 },
  { id: 'B09', x: 76, enter: 86.4, exit: 103.2 },
  { id: 'B10', x: 268, enter: 99.2, exit: 116 },
] as const;

function scripted(values: readonly number[]): () => number {
  let i = 0;
  return () => {
    const value = values[i];
    i += 1;
    if (value === undefined) throw new Error('scripted rng ran out');
    return value;
  };
}

function collect(difficulty: Difficulty, power: number): SpawnRequest[] {
  const scheduler = new WaveScheduler({ mvpOnly: false, stage, difficulty });
  scheduler.setPowerLevel(power);
  const spawns: SpawnRequest[] = [];
  for (let i = 0; i < 130; i++) spawns.push(...scheduler.update(1));
  return spawns;
}

function ships(spawns: readonly SpawnRequest[]): SpawnRequest[] {
  return spawns.filter((spawn) => spawn.type !== 'risk_crate');
}

function tally(spawns: readonly SpawnRequest[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const spawn of ships(spawns)) counts[spawn.type] = (counts[spawn.type] ?? 0) + 1;
  return counts;
}

function scoreOf(spawns: readonly SpawnRequest[]): number {
  return ships(spawns).reduce((sum, spawn) => sum + ENEMY_DEFS[spawn.type].score, 0);
}

function isRear(move: Move): move is Extract<Move, { kind: 'rear_diag' }> {
  return move.kind === 'rear_diag';
}

describe('stage 2 waves', () => {
  it('keeps the warning and the 铁堡 entrance', () => {
    expect(STAGE2_WARNING_AT).toBe(118);
    expect(stage.warningAt).toBe(118);
    expect(stage.boss.enterAt).toBe(123);
    expect(stage.name).toBe('工业走廊');
    expect(nextStageId('1')).toBe('2');
    expect(nextStageId('2')).toBeUndefined();
    expect(stage.boss.id).toBe('tiebao');
    expect(stage.maps).toEqual({ run: [{ map: 'landB', at: 0 }], boss: 'factoryBoss' });
    expect(stage.captions).toEqual([
      { id: 's2_open', at: 'open' },
      { id: 's2_end', at: 'clear' },
    ]);
    expect(stage.buildingDrops).toBeUndefined();
    expect(stage.scrollSpeed).toBe(BG_SCROLL_SPEED);
  });

  it('labels outskirts, runway, and woods, in time order, and stops before the warning', () => {
    expect(
      stage.waves
        .map((wave) => wave.section)
        .every((section) => section === 'outskirts' || section === 'runway' || section === 'woods')
    ).toBe(true);
    const sections = new Set(stage.waves.map((wave) => wave.section));
    expect([...sections].sort()).toEqual(['outskirts', 'runway', 'woods']);
    for (let i = 1; i < stage.waves.length; i++) {
      expect(stage.waves[i]!.t).toBeGreaterThanOrEqual(stage.waves[i - 1]!.t);
    }
    const last = stage.waves[stage.waves.length - 1]!;
    expect(last.id).toBe('W21');
    expect(last.t).toBe(114);
    expect(last.condition).toBe('powerBelowMax');
    expect(last.t).toBeLessThan(stage.warningAt);
    const w13 = stage.waves.find((wave) => wave.id === 'W13');
    const w22 = stage.waves.find((wave) => wave.id === 'W22');
    expect(w13?.difficulties).toEqual(['medium', 'hard']);
    expect(w13?.t).toBe(70);
    expect(w22?.difficulties).toEqual(['hard']);
    expect(w22?.t).toBe(88);
    expect(w22 && stage.waves.findIndex((wave) => wave.id === 'W22')).toBeGreaterThan(
      stage.waves.findIndex((wave) => wave.id === 'W16')
    );
  });

  it('does not change the stage 1 ship total when a difficulty is applied', () => {
    const stage1 = getStage('1');
    expect(stageEnemyCount(stage1, false)).toBe(148);
    expect(stageEnemyCount(stage1, true)).toBe(149);
    expect(stageEnemyCount(stage1, false, 'hard')).toBe(148);
    expect(stageEnemyCount(stage1, true, 'medium')).toBe(149);
  });

  it('leaves global bullet speed and fire rate at 1', () => {
    for (const profile of Object.values(DIFFICULTY_PROFILES)) {
      expect(profile.bulletSpeedScale).toBe(1);
      expect(profile.fireRateScale).toBe(1);
    }
    expect(scaleHp(10, 'easy')).toBe(10);
    expect(scaleHp(10, 'medium')).toBeCloseTo(11.5);
    expect(scaleHp(10, 'hard')).toBeCloseTo(13);
  });

  it.each(['easy', 'medium', 'hard'] as const)(
    'fields the %s ship table, score, and relief carrier',
    (difficulty) => {
      const expected = COUNTS[difficulty];
      expect(stageEnemyCount(stage, false, difficulty)).toBe(expected.total);
      expect(stageEnemyCount(stage, true, difficulty)).toBe(expected.total + 1);

      const full = ships(collect(difficulty, 1));
      const capped = ships(collect(difficulty, 3));
      expect(capped).toHaveLength(expected.total);
      expect(full).toHaveLength(expected.total + 1);
      expect(tally(capped)).toEqual({
        small: expected.small,
        medium: expected.medium,
        interceptor: expected.interceptor,
        bomber: expected.bomber,
        drone: expected.drone,
        tank: expected.tank,
        turret2: expected.turret2,
        missile_car: expected.missile_car,
      });
      expect(tally(full).medium).toBe(expected.medium + 1);
      expect(scoreOf(capped)).toBe(expected.score);
      expect(scoreOf(full)).toBe(expected.score + 1000);

      const relief = full[full.length - 1]!;
      expect(relief.type).toBe('medium');
      expect(relief.drop).toBe('P');
      expect(relief.fire.kind).toBe('none');
      expect(capped.filter((spawn) => spawn.drop === 'P')).toHaveLength(3);
      expect(full.filter((spawn) => spawn.drop === 'P')).toHaveLength(4);
      expect(full.filter((spawn) => spawn.drop === 'B')).toHaveLength(2);
    }
  );

  it('spawns rear_diag from the lower edges and keeps easy to two waves', () => {
    const easy = ships(collect('easy', 3)).filter((spawn) => isRear(spawn.move));
    const medium = ships(collect('medium', 3)).filter((spawn) => isRear(spawn.move));
    const hard = ships(collect('hard', 3)).filter((spawn) => isRear(spawn.move));

    expect(easy).toHaveLength(18);
    expect(medium).toHaveLength(32);
    expect(hard).toHaveLength(44);

    expect(easy.every((spawn) => isRear(spawn.move) && spawn.move.bearing === 28)).toBe(true);
    expect(easy.filter((spawn) => isRear(spawn.move) && spawn.move.side === 'left')).toHaveLength(
      13
    );
    expect(easy.filter((spawn) => isRear(spawn.move) && spawn.move.side === 'right')).toHaveLength(
      5
    );
    expect(easy.every((spawn) => spawn.fire.kind === 'none')).toBe(true);
    expect(easy.filter((spawn) => isRear(spawn.move) && spawn.move.speed === 160)).toHaveLength(8);
    expect(
      easy
        .filter((spawn) => isRear(spawn.move) && spawn.move.speed === 160)
        .every((spawn) => spawn.y === 620 && spawn.x === REAR_DIAG_SPAWN_X_LEFT)
    ).toBe(true);
    expect(
      easy
        .filter((spawn) => isRear(spawn.move) && spawn.move.speed === 165)
        .every((spawn) => spawn.y === 640)
    ).toBe(true);

    const mediumBearings = new Set(
      medium.map((spawn) => (isRear(spawn.move) ? spawn.move.bearing : 0))
    );
    expect(mediumBearings).toEqual(new Set([28, 26]));
    expect(medium.filter((spawn) => spawn.fire.kind === 'aimed1')).toHaveLength(4);
    expect(medium.filter((spawn) => spawn.fire.kind === 'none')).toHaveLength(28);

    const hardBearings = new Set(
      hard.map((spawn) => (isRear(spawn.move) ? spawn.move.bearing : 0))
    );
    expect(hardBearings).toEqual(new Set([28, 30, 24]));
    expect(hard.filter((spawn) => spawn.fire.kind === 'aimed1')).toHaveLength(8);
    expect(hard.filter((spawn) => spawn.fire.kind === 'aimed3burst')).toHaveLength(6);
    expect(hard.filter((spawn) => spawn.fire.kind === 'none')).toHaveLength(30);
    const w22 = hard.filter((spawn) => isRear(spawn.move) && spawn.move.bearing === 24);
    expect(w22).toHaveLength(8);
    expect(w22.every((spawn) => spawn.y === 580 && spawn.fire.kind === 'none')).toBe(true);
    expect(
      hard.every(
        (spawn) =>
          spawn.x ===
          (isRear(spawn.move) && spawn.move.side === 'left'
            ? REAR_DIAG_SPAWN_X_LEFT
            : REAR_DIAG_SPAWN_X_RIGHT)
      )
    ).toBe(true);

    const sample: SpawnGroup = {
      enemy: 'small',
      count: 1,
      xs: [0],
      move: { kind: 'rear_diag', side: 'right', y0: 580, bearing: 24, speed: 175 },
      fire: { kind: 'none' },
    };
    expect(resolveSpawnPosition(sample, 0)).toEqual({ x: REAR_DIAG_SPAWN_X_RIGHT, y: 580 });
  });

  it('upgrades fans, bursts, and the low side arc by difficulty', () => {
    const easy = ships(collect('easy', 3));
    const medium = ships(collect('medium', 3));
    const hard = ships(collect('hard', 3));

    const fans = (spawns: SpawnRequest[]) => spawns.filter((spawn) => spawn.type === 'medium');
    expect(fans(easy)[0]!.fire).toMatchObject({ kind: 'fan3', spread: 36, interval: 1.3 });
    expect(fans(medium)[0]!.fire).toMatchObject({ kind: 'fan3', spread: 40, interval: 1.15 });
    expect(fans(hard)[0]!.fire).toMatchObject({ kind: 'fan5', spread: 36, interval: 1.05 });
    expect(fans(easy)[1]!.drop).toBe('P');
    expect(fans(easy)[1]!.fire).toMatchObject({ kind: 'fan3', spread: 32 });
    expect(fans(medium)[1]!.fire).toMatchObject({ kind: 'fan5', spread: 40 });
    expect(fans(hard)[1]!.fire).toMatchObject({ kind: 'fan5', spread: 44 });

    const column = (spawns: SpawnRequest[]) =>
      spawns.filter((spawn) => spawn.move.kind === 'straight' && spawn.move.speed === 170);
    expect(column(easy)).toHaveLength(8);
    expect(column(easy).every((spawn) => spawn.fire.kind === 'none')).toBe(true);
    expect(column(hard)).toHaveLength(10);
    expect(column(hard).filter((spawn) => spawn.fire.kind === 'aimed1')).toHaveLength(4);

    const dive = (spawns: SpawnRequest[]) => spawns.filter((spawn) => spawn.move.kind === 'v_dive');
    expect(dive(easy)).toHaveLength(8);
    expect(dive(easy).every((spawn) => spawn.fire.kind === 'aimed1')).toBe(true);
    expect(dive(hard)).toHaveLength(12);
    expect(dive(hard).every((spawn) => spawn.fire.kind === 'aimed3burst')).toBe(true);

    const cross = (spawns: SpawnRequest[]) => spawns.filter((spawn) => spawn.move.kind === 'cross');
    expect(cross(easy)).toHaveLength(16);
    expect(cross(easy).every((spawn) => spawn.fire.kind === 'none')).toBe(true);
    expect(cross(medium).filter((spawn) => spawn.fire.kind === 'aimed1')).toHaveLength(4);
    expect(cross(hard)).toHaveLength(20);
    expect(cross(hard).filter((spawn) => spawn.fire.kind === 'aimed3burst')).toHaveLength(10);

    const arcs = (spawns: SpawnRequest[]) => spawns.filter((spawn) => spawn.type === 'interceptor');
    expect(arcs(easy)).toHaveLength(10);
    expect(arcs(easy).every((spawn) => spawn.fire.kind === 'aimed1')).toBe(true);
    expect(
      arcs(hard)
        .slice(0, 6)
        .every((spawn) => spawn.fire.kind === 'aimed3burst')
    ).toBe(true);
    expect(
      arcs(hard)
        .slice(6)
        .every((spawn) => spawn.fire.kind === 'aimed_fast3')
    ).toBe(true);
    expect(
      arcs(hard)
        .slice(6)
        .every(
          (spawn) => spawn.move.kind === 'side_arc' && spawn.move.y0 >= 180 && spawn.move.y0 <= 240
        )
    ).toBe(true);

    const bombers = (spawns: SpawnRequest[]) => spawns.filter((spawn) => spawn.type === 'bomber');
    expect(bombers(easy)).toHaveLength(3);
    expect(bombers(easy)[0]!.drop).toBe('B');
    expect(bombers(easy)[0]!.fire).toMatchObject({ kind: 'fan5', spread: 50, interval: 1.7 });
    expect(bombers(easy)[2]!.drop).toBe('B');
    expect(bombers(hard)[2]!.fire).toMatchObject({ kind: 'fan5', spread: 58, interval: 1.2 });

    const flank = (spawns: SpawnRequest[], speed: number) =>
      spawns.filter((spawn) => spawn.move.kind === 'straight' && spawn.move.speed === speed);
    expect(flank(easy, 190)).toHaveLength(6);
    expect(flank(easy, 190).every((spawn) => spawn.fire.kind === 'none')).toBe(true);
    expect(flank(hard, 190)).toHaveLength(8);
    expect(flank(hard, 190).every((spawn) => spawn.fire.kind === 'aimed1')).toBe(true);
    expect(flank(easy, 200)).toHaveLength(0);
    expect(flank(medium, 200)).toHaveLength(6);
    expect(flank(hard, 200)).toHaveLength(8);
    expect(flank(hard, 200).every((spawn) => spawn.fire.kind === 'none')).toBe(true);
  });

  it('seeks to 铁堡 without counting ships that never spawned', () => {
    const scheduler = new WaveScheduler({ mvpOnly: false, stage, difficulty: 'hard' });
    scheduler.setPowerLevel(1);
    scheduler.seek(stage.boss.enterAt);
    expect(scheduler.getDebugInfo().time).toBe(123);
    expect(scheduler.getDebugInfo().spawned).toBe(0);
    expect(scheduler.update(1)).toHaveLength(0);
  });
});

describe('stage 2 risk crates', () => {
  it('retimes the floater and does not count it as a ship', () => {
    expect(riskCratesFor(stage.riskCrates ?? [], 'easy')).toEqual([
      { t: 46, x: 180, difficulties: ['easy'] },
    ]);
    expect(
      riskCratesFor(stage.riskCrates ?? [], 'medium').map((crate) => [crate.t, crate.x])
    ).toEqual([
      [46, 48],
      [100, 312],
    ]);
    expect(
      riskCratesFor(stage.riskCrates ?? [], 'hard').map((crate) => [crate.t, crate.x])
    ).toEqual([
      [46, 48],
      [70, 220],
      [100, 312],
    ]);

    const scheduler = new WaveScheduler({ mvpOnly: false, stage, difficulty: 'easy' });
    scheduler.setPowerLevel(3);
    const requests: SpawnRequest[] = [];
    for (let i = 0; i < 130; i++) requests.push(...scheduler.update(1));
    expect(scheduler.getDebugInfo().spawned).toBe(122);
    const crates = requests.filter((spawn) => spawn.type === 'risk_crate');
    expect(crates).toHaveLength(1);
    expect(crates[0]).toMatchObject({
      x: 180,
      y: -20,
      move: { kind: 'hover', stopY: 160, hold: 6 },
      fire: { kind: 'none' },
    });
  });
});

describe('stage 2 buildings', () => {
  const placed = placeBuildings(stage.buildings, buildStageTrack(stage));
  const grid = getMapGrid('landB');

  it('stands ten footprints on 陆地B without overlap, on the doc clock', () => {
    expect(stage.buildings).toHaveLength(10);
    expect(placed.map((building) => building.id)).toEqual(BUILDING_CLOCK.map((row) => row.id));
    const cells = new Set<string>();
    for (const building of stage.buildings) {
      expect(validateBuildingFootprint(grid, building), building.id).toBe(true);
      expect(building.map).toBe('landB');
      const spec = BUILDING_SPECS[building.type];
      for (let row = 0; row < spec.rows; row++) {
        for (let col = 0; col < spec.cols; col++) {
          const key = `${building.row + row},${building.col + col}`;
          expect(cells.has(key), key).toBe(false);
          cells.add(key);
        }
      }
    }
    for (const row of BUILDING_CLOCK) {
      const building = placed.find((item) => item.id === row.id)!;
      expect(buildingCenter(building, 0).x).toBe(row.x);
      expect(buildingSpawnScroll(building) / BG_SCROLL_SPEED).toBeCloseTo(row.enter, 5);
      expect(buildingExitScroll(building) / BG_SCROLL_SPEED).toBeCloseTo(row.exit, 5);
    }
    const last = placed.find((building) => building.id === 'B10')!;
    expect(buildingExitScroll(last) / BG_SCROLL_SPEED).toBeLessThan(stage.warningAt);
  });

  it('locks T on B01 and B04, M on B06, and exactly one of B07/B08', () => {
    const byId = new Map(stage.buildings.map((building) => [building.id, building.drop]));
    expect(byId.get('B01')).toBe('T');
    expect(byId.get('B04')).toBe('T');
    expect(byId.get('B06')).toBe('M');
    for (const id of ['B02', 'B03', 'B05', 'B09', 'B10']) expect(byId.get(id)).toBeUndefined();
    const members = stage.buildings.filter((building) => typeof building.drop === 'object');
    expect(members.map((building) => building.id)).toEqual(['B07', 'B08']);
    expect(members.map((building) => building.drop)).toEqual([
      { exclusive: 's2-drain-mate', item: 'M' },
      { exclusive: 's2-drain-mate', item: 'M' },
    ]);

    const low = resolvePlacementDrops(stage.buildings, scripted([0]));
    expect(low.get('B07')).toBe('M');
    expect(low.has('B08')).toBe(false);
    const high = resolvePlacementDrops(stage.buildings, scripted([0.5]));
    expect(high.get('B08')).toBe('M');
    expect(high.has('B07')).toBe(false);
    expect(low.get('B01')).toBe('T');
    expect(low.get('B04')).toBe('T');
    expect(low.get('B06')).toBe('M');

    const winners = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const fixed = resolvePlacementDrops(stage.buildings, createRng(seed));
      const m7 = fixed.get('B07') === 'M';
      const m8 = fixed.get('B08') === 'M';
      expect(Number(m7) + Number(m8)).toBe(1);
      winners.add(m7 ? 'B07' : 'B08');
    }
    expect(winners).toEqual(new Set(['B07', 'B08']));

    const fixed = resolvePlacementDrops(stage.buildings, scripted([0]));
    expect(
      chooseBuildingDrop({ id: 'B02', mainLevel: 1, sub: null, rng: scripted([0]), fixed })
    ).toBe('P');
    expect(
      chooseBuildingDrop({ id: 'B08', mainLevel: 1, sub: null, rng: scripted([0.5]), fixed })
    ).toBe('B');
    let draws = 0;
    const rng = (): number => {
      draws += 1;
      return 0;
    };
    expect(chooseBuildingDrop({ id: 'B05', mainLevel: POWER_MAX, sub: null, rng, fixed })).toBe(
      'B'
    );
    expect(chooseBuildingDrop({ id: 'B08', mainLevel: POWER_MAX, sub: null, rng, fixed })).toBe(
      'B'
    );
    expect(draws).toBe(0);
  });
});
