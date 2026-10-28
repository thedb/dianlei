import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import {
  BG_SCROLL_SPEED,
  LOGICAL_H,
  MAP_CHUNK_ROWS,
  MAP_CROP_X,
  POWER_MAX,
  STAGE3_RISK_CENTER_X,
  STAGE3_RISK_EARLY_T,
  STAGE3_RISK_LATE_T,
  STAGE3_RISK_LEFT_X,
  STAGE3_RISK_MID_T,
  STAGE3_RISK_MID_X,
  STAGE3_RISK_RIGHT_X,
  STAGE3_WARNING_AT,
  TILE_SIZE,
} from '@/game/config';
import type { Difficulty } from '@/game/difficulty';
import {
  BUILDING_SPECS,
  buildingCenter,
  buildingSpawnScroll,
  placeBuildings,
  validateBuildingFootprint,
} from '@/game/entities/building';
import { ENEMY_DEFS } from '@/game/entities/enemyDefs';
import { getStage, listStages, nextStageId, stageEnemyCount } from '@/game/levels/registry';
import { getMapGrid } from '@/game/maps';
import { footprintOn, terrainAt } from '@/game/maps/terrain';
import { buildStageTrack } from '@/game/maps/track';
import { resolvePlacementDrops } from '@/game/systems/dropRules';
import { WaveScheduler, type SpawnRequest } from '@/game/systems/waveScheduler';
import {
  PARKED_BRIDGE,
  PARKED_DOCK,
  PARKED_SCORCH,
  PARKED_SIZE_TILES,
  parkedCenterX,
  parkedSpawnTime,
} from './stage3';

const stage = getStage('3');
const river = getMapGrid('riverA');

const COUNTS = {
  easy: {
    small: 78,
    medium: 3,
    interceptor: 12,
    bomber: 2,
    drone: 9,
    tank: 10,
    factory_aa: 4,
    missile_car: 1,
    parked_fighter: 4,
    strike: 2,
    total: 125,
    target: 120,
  },
  medium: {
    small: 94,
    medium: 3,
    interceptor: 15,
    bomber: 2,
    drone: 12,
    tank: 12,
    factory_aa: 5,
    missile_car: 1,
    parked_fighter: 6,
    strike: 5,
    total: 155,
    target: 155,
  },
  hard: {
    small: 120,
    medium: 3,
    interceptor: 18,
    bomber: 2,
    drone: 12,
    tank: 15,
    factory_aa: 5,
    missile_car: 2,
    parked_fighter: 8,
    strike: 7,
    total: 192,
    target: 185,
  },
} as const;

interface TimedSpawn extends SpawnRequest {
  t: number;
}

const DT = 1 / 60;

function collect(difficulty: Difficulty, power: number): TimedSpawn[] {
  const scheduler = new WaveScheduler({ mvpOnly: false, stage, difficulty });
  scheduler.setPowerLevel(power);
  const out: TimedSpawn[] = [];
  const frames = Math.round(130 / DT);
  for (let i = 1; i <= frames; i++) {
    for (const spawn of scheduler.update(DT)) out.push({ ...spawn, t: i * DT });
  }
  return out;
}

function ships(spawns: readonly TimedSpawn[]): TimedSpawn[] {
  return spawns.filter((spawn) => spawn.type !== 'risk_crate');
}

function tally(spawns: readonly TimedSpawn[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const spawn of ships(spawns)) counts[spawn.type] = (counts[spawn.type] ?? 0) + 1;
  return counts;
}

/** Map cell under a ground spawn: rows grow upward, the scroll is 40 px/s before the warning. */
function cellAt(t: number, x: number, y: number): { row: number; col: number } {
  const scroll = BG_SCROLL_SPEED * t;
  return {
    row: Math.floor((scroll + LOGICAL_H - y) / TILE_SIZE),
    col: Math.floor((x + MAP_CROP_X) / TILE_SIZE),
  };
}

function chunkEdge(row: number): boolean {
  const local = row % MAP_CHUNK_ROWS;
  return local === 0 || local === MAP_CHUNK_ROWS - 1;
}

describe('stage 3 data', () => {
  it('is 叛军心脏 on 河流A, then 炉心浮台, after stage 2', () => {
    expect(stage.id).toBe('3');
    expect(stage.name).toBe('叛军心脏');
    expect(stage.stage).toBe(3);
    expect(stage.warningAt).toBe(STAGE3_WARNING_AT);
    expect(STAGE3_WARNING_AT).toBe(118);
    expect(stage.boss.id).toBe('furnace');
    expect(stage.boss.enterAt).toBe(123);
    expect(stage.maps).toEqual({ run: [{ map: 'riverA', at: 0 }], boss: 'furnaceBoss' });
    expect(stage.captions).toEqual([
      { id: 's3_open', at: 'open' },
      { id: 's3_end', at: 'clear' },
    ]);
    expect(stage.buildingDrops).toBeUndefined();
    expect(listStages().map((s) => s.id)).toEqual(['1', '2', '3', '4']);
    expect(nextStageId('2')).toBe('3');
    expect(nextStageId('3')).toBe('4');
  });

  it('labels valley, dock, crossing, scorch in time order and stops before the warning', () => {
    const sections = stage.waves.map((wave) => wave.section);
    expect([...new Set(sections)]).toEqual(['valley', 'dock', 'crossing', 'scorch']);
    for (let i = 1; i < stage.waves.length; i++) {
      expect(stage.waves[i]!.t).toBeGreaterThanOrEqual(stage.waves[i - 1]!.t);
    }
    const last = stage.waves[stage.waves.length - 1]!;
    expect(last.t).toBe(114);
    expect(last.condition).toBe('powerBelowMax');
    for (const spawn of ships(collect('hard', 1))) expect(spawn.t).toBeLessThan(stage.warningAt);
  });

  it('uses only the reused models plus parked_fighter and strike', () => {
    const moves = new Set<string>();
    const enemies = new Set<string>();
    for (const wave of stage.waves) {
      for (const group of wave.groups) {
        moves.add(group.move.kind);
        enemies.add(group.enemy);
      }
    }
    for (const kind of ['rear_diag', 'step_slide', 'dive_once'])
      expect(moves.has(kind)).toBe(false);
    expect(enemies.has('turret2')).toBe(false);
    expect(enemies.has('parked_fighter')).toBe(true);
    expect(enemies.has('strike')).toBe(true);
    for (const wave of stage.waves) {
      for (const group of wave.groups) {
        if (group.enemy === 'parked_fighter') expect(group.move.kind).toBe('planted');
        if (group.enemy === 'strike') expect(group.move.kind).toBe('strafe');
      }
    }
  });

  it.each(['easy', 'medium', 'hard'] as const)(
    'fields the %s ship table near the plane target, plus the relief carrier',
    (difficulty) => {
      const expected = COUNTS[difficulty];
      const capped = ships(collect(difficulty, POWER_MAX));
      const full = ships(collect(difficulty, 1));
      expect(stageEnemyCount(stage, false, difficulty)).toBe(expected.total);
      expect(capped).toHaveLength(expected.total);
      expect(full).toHaveLength(expected.total + 1);
      expect(Math.abs(expected.total - expected.target)).toBeLessThanOrEqual(15);
      expect(tally(capped)).toEqual({
        small: expected.small,
        medium: expected.medium,
        interceptor: expected.interceptor,
        bomber: expected.bomber,
        drone: expected.drone,
        tank: expected.tank,
        factory_aa: expected.factory_aa,
        missile_car: expected.missile_car,
        parked_fighter: expected.parked_fighter,
        strike: expected.strike,
      });
      expect(capped.filter((s) => s.drop === 'P')).toHaveLength(2);
      expect(capped.filter((s) => s.drop === 'B')).toHaveLength(2);
      const relief = full[full.length - 1]!;
      expect(relief.type).toBe('medium');
      expect(relief.drop).toBe('P');
    }
  );

  it('counts parked jets and strikes in the kill rate', () => {
    expect(ENEMY_DEFS.parked_fighter.countsInKillRate).not.toBe(false);
    expect(ENEMY_DEFS.strike.countsInKillRate).not.toBe(false);
    expect(ENEMY_DEFS.parked_fighter).toMatchObject({ size: 'small', category: 'ground' });
    expect(ENEMY_DEFS.strike).toMatchObject({ size: 'medium', category: 'air' });
    expect([ENEMY_DEFS.parked_fighter.width, ENEMY_DEFS.parked_fighter.height]).toEqual([32, 32]);
    expect([ENEMY_DEFS.strike.width, ENEMY_DEFS.strike.height]).toEqual([40, 36]);
  });
});

describe('stage 3 ground placement', () => {
  it('parks every jet on land, off chunk edge rows, at the building clock', () => {
    for (const spot of [PARKED_DOCK, PARKED_BRIDGE, PARKED_SCORCH]) {
      expect(parkedSpawnTime(spot.row)).toBeLessThan(STAGE3_WARNING_AT);
      for (let r = spot.row; r < spot.row + PARKED_SIZE_TILES; r++)
        expect(chunkEdge(r)).toBe(false);
      for (const col of spot.cols) {
        expect(
          footprintOn(river, 'land', spot.row, col, PARKED_SIZE_TILES, PARKED_SIZE_TILES)
        ).toBe(true);
        // Same center as a 2×2 building on that cell.
        const scroll = spot.row * TILE_SIZE - LOGICAL_H;
        const center = buildingCenter(
          { id: 'x', type: 'pillbox', map: 'riverA', row: spot.row, col, layer: 0, origin: 0 },
          scroll
        );
        expect(parkedCenterX(col)).toBe(center.x);
        expect(center.y).toBe(-(PARKED_SIZE_TILES * TILE_SIZE) / 2);
      }
    }
  });

  it.each(['easy', 'medium', 'hard'] as const)(
    'puts every %s parked jet, tank, missile car, and factory gun on land',
    (difficulty) => {
      const ground = ships(collect(difficulty, 1)).filter(
        (s) => ENEMY_DEFS[s.type].category === 'ground'
      );
      expect(ground.length).toBeGreaterThan(0);
      for (const spawn of ground) {
        const { row, col } = cellAt(spawn.t, spawn.x, spawn.y);
        expect(terrainAt(river, col, row), `${spawn.type} t=${spawn.t.toFixed(2)}`).toBe('land');
      }
      const parked = ground.filter((s) => s.type === 'parked_fighter');
      for (const spawn of parked) {
        const half = (PARKED_SIZE_TILES * TILE_SIZE) / 2;
        const { row, col } = cellAt(spawn.t, spawn.x - half + 1, spawn.y + half - 1);
        expect(footprintOn(river, 'land', row, col, PARKED_SIZE_TILES, PARKED_SIZE_TILES)).toBe(
          true
        );
      }
    }
  );
});

describe('stage 3 buildings and risk crates', () => {
  it('places eight buildings that fit their terrain and spawn before the warning', () => {
    expect(stage.buildings).toHaveLength(8);
    const track = buildStageTrack(stage);
    for (const placement of placeBuildings(stage.buildings, track)) {
      expect(validateBuildingFootprint(river, placement), placement.id).toBe(true);
      expect(buildingSpawnScroll(placement) / BG_SCROLL_SPEED).toBeLessThan(STAGE3_WARNING_AT);
    }
    const seaGuns = stage.buildings.filter((b) => b.type === 'sea_gun');
    expect(seaGuns).toHaveLength(2);
    expect(seaGuns.every((b) => BUILDING_SPECS[b.type].terrain === 'water')).toBe(true);
    expect(
      stage.buildings.filter((b) => b.type !== 'sea_gun').every((b) => b.map === 'riverA')
    ).toBe(true);
  });

  it('locks T on both sea guns, M on one bank building, and one M in s3-bank-mate', () => {
    const seaGuns = stage.buildings.filter((b) => b.type === 'sea_gun');
    expect(seaGuns.map((b) => b.drop)).toEqual(['T', 'T']);
    const bank = stage.buildings.filter((b) => b.type !== 'sea_gun');
    expect(bank.filter((b) => b.drop === 'M')).toHaveLength(1);
    const group = stage.buildings.filter(
      (b) => typeof b.drop === 'object' && b.drop.exclusive === 's3-bank-mate'
    );
    expect(group.map((b) => b.id)).toEqual(['B06', 'B08']);
    expect(group.every((b) => b.type !== 'sea_gun')).toBe(true);
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const drops = resolvePlacementDrops(stage.buildings, createRng(seed));
      expect(group.filter((b) => drops.get(b.id) === 'M')).toHaveLength(1);
    }
    expect(stage.buildings.filter((b) => b.drop === undefined)).toHaveLength(3);
  });

  it('times risk crates on stage 3 clocks: Easy 1, Medium 2, Hard 3', () => {
    expect(stage.riskCrates).toEqual([
      { t: STAGE3_RISK_EARLY_T, x: STAGE3_RISK_CENTER_X, difficulties: ['easy'] },
      { t: STAGE3_RISK_EARLY_T, x: STAGE3_RISK_LEFT_X, difficulties: ['medium', 'hard'] },
      { t: STAGE3_RISK_MID_T, x: STAGE3_RISK_MID_X, difficulties: ['hard'] },
      { t: STAGE3_RISK_LATE_T, x: STAGE3_RISK_RIGHT_X, difficulties: ['medium', 'hard'] },
    ]);
    expect([STAGE3_RISK_EARLY_T, STAGE3_RISK_MID_T, STAGE3_RISK_LATE_T]).toEqual([50, 72, 96]);
    const crates = (d: Difficulty) => collect(d, 1).filter((s) => s.type === 'risk_crate');
    expect(crates('easy')).toHaveLength(1);
    expect(crates('medium')).toHaveLength(2);
    expect(crates('hard')).toHaveLength(3);
  });
});
