import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import {
  BG_SCROLL_SPEED,
  BUILDING_HP,
  CAPTION_HOLD,
  CARRIER_BOMBER_HOLD,
  CARRIER_BOMBER_STOP_Y,
  CRUISER_GUN_HP,
  LOGICAL_H,
  OBSIDIAN_ENTER_AT,
  OBSIDIAN_RADIUS,
  POWER_MAX,
  SLOW_PUSH_ENTER_SPEED,
  SLOW_PUSH_EXIT_SPEED,
  STAGE4_RISK_CENTER_X,
  STAGE4_RISK_EARLY_T,
  STAGE4_RISK_LATE_T,
  STAGE4_RISK_LEFT_X,
  STAGE4_RISK_MID_T,
  STAGE4_RISK_MID_X,
  STAGE4_RISK_RIGHT_X,
  STAGE4_WARNING_AT,
  STAGE4_WRECK_AT,
  TILE_SIZE,
} from '@/game/config';
import type { Difficulty } from '@/game/difficulty';
import {
  BUILDING_SPECS,
  buildingSpawnScroll,
  createBuilding,
  placeBuildings,
  placementsForDifficulty,
  spawnBuilding,
  updateBuilding,
  validateBuildingFootprint,
} from '@/game/entities/building';
import { ENEMY_DEFS } from '@/game/entities/enemyDefs';
import { SEA_FLOAT_ANCHORS, SEA_GUN_PADS } from '@/game/maps/seaB';
import { getMapGrid } from '@/game/maps';
import { buildStageTrack } from '@/game/maps/track';
import { activeCaption, CAPTION_LINES } from '@/game/story/captions';
import { executeFirePattern } from '@/game/systems/danmaku';
import { resolvePlacementDrops } from '@/game/systems/dropRules';
import { WaveScheduler, type SpawnRequest } from '@/game/systems/waveScheduler';
import type { EnemyBulletType } from '@/game/entities/enemyBullet';
import { createEnemy, shouldEnemyFire, spawnEnemy } from '@/game/entities/enemy';
import {
  WreckFloatScheduler,
  placeWreckFloats,
  wreckFloatCenter,
  wreckFloatSpawnScroll,
} from '@/game/entities/wreckFloat';
import { BOSS_STAGE_ROWS } from '@/game/ui/bossChallenge';
import { STAGE_SELECT_ROWS, stageHeading } from '@/game/ui/stageSelect';
import { CARRIER_BOMBER_FIRE } from './stage4';
import { getStage, listStages, nextStageId, stageEnemyCount } from './registry';

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
    expect(stage.waves.map((wave) => wave.id)).toEqual(
      Array.from({ length: 30 }, (_, i) => `W${String(i + 1).padStart(2, '0')}`)
    );
    expect(stage.buildings).toHaveLength(6);
    expect(stage.wreckFloats).toHaveLength(8);
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

  it('keeps the three caption lines locked, and shows the wreck line at 96s', () => {
    expect(CAPTION_LINES.s4_open).toBe('航母甲板就绪。电雷，出击。');
    expect(CAPTION_LINES.s4_wreck).toBe('不明残骸……弹痕不像地球武器。');
    expect(CAPTION_LINES.s4_ufo).toBe('未知飞行物击毁目标后撤离。追踪。');
    expect(activeCaption(stage.captions, STAGE4_WRECK_AT, null)?.id).toBe('s4_wreck');
    expect(activeCaption(stage.captions, STAGE4_WRECK_AT + CAPTION_HOLD - 0.01, null)?.id).toBe(
      's4_wreck'
    );
    expect(activeCaption(stage.captions, STAGE4_WRECK_AT + CAPTION_HOLD, null)).toBeNull();
    expect(activeCaption(stage.captions, OBSIDIAN_ENTER_AT, null)).toBeNull();
  });
});

const stage = getStage('4');
const DT = 1 / 60;

interface TimedSpawn extends SpawnRequest {
  t: number;
}

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: EnemyBulletType;
}

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

function capture(
  fire: typeof CARRIER_BOMBER_FIRE,
  x: number,
  y: number,
  px: number,
  py: number
): Shot[] {
  const shots: Shot[] = [];
  executeFirePattern(fire, x, y, px, py, {
    spawnBullet(sx, sy, vx, vy, type) {
      shots.push({ x: sx, y: sy, vx, vy, type });
    },
    getBulletCount: () => shots.length,
  });
  return shots;
}

describe('stage 4 waves', () => {
  it('labels deck, fleet, swell, wreck and stops before the warning', () => {
    expect([...new Set(stage.waves.map((wave) => wave.section))]).toEqual([
      'deck',
      'fleet',
      'swell',
      'wreck',
    ]);
    for (let i = 1; i < stage.waves.length; i++) {
      expect(stage.waves[i]!.t).toBeGreaterThanOrEqual(stage.waves[i - 1]!.t);
    }
    const last = stage.waves[stage.waves.length - 1]!;
    expect(last.id).toBe('W30');
    expect(last.t).toBe(114);
    expect(last.condition).toBe('powerBelowMax');
    expect(stage.waves.every((wave) => wave.mvp === true)).toBe(true);
    for (const spawn of ships(collect('hard', POWER_MAX))) expect(spawn.t).toBeLessThan(118);
  });

  it('keeps the global slow_push speeds and does not reuse stage 2 or 3 signatures', () => {
    expect(SLOW_PUSH_ENTER_SPEED).toBe(30);
    expect(SLOW_PUSH_EXIT_SPEED).toBe(60);
    expect(BUILDING_HP).toBe(3);
    const moves = new Set<string>();
    const enemies = new Set<string>();
    for (const wave of stage.waves) {
      for (const group of wave.groups) {
        moves.add(group.move.kind);
        enemies.add(group.enemy);
      }
    }
    expect([...moves].sort()).toEqual([
      'cross',
      'hover',
      'orbit',
      'side_arc',
      'sine',
      'slow_push',
      'v_dive',
    ]);
    expect(enemies.has('carrier_bomber')).toBe(true);
    for (const banned of [
      'bomber',
      'tank',
      'missile_car',
      'factory_aa',
      'parked_fighter',
      'strike',
      'turret2',
    ]) {
      expect(enemies.has(banned)).toBe(false);
    }
  });

  it.each(['easy', 'medium', 'hard'] as const)(
    'fields the %s ship table inside the ±15 band',
    (difficulty) => {
      const expected = { easy: 113, medium: 146, hard: 178 }[difficulty];
      const target = { easy: 110, medium: 145, hard: 175 }[difficulty];
      const capped = ships(collect(difficulty, POWER_MAX));
      const full = ships(collect(difficulty, 1));
      expect(stageEnemyCount(stage, false, difficulty)).toBe(expected);
      expect(capped).toHaveLength(expected);
      expect(full).toHaveLength(expected + 1);
      expect(Math.abs(expected - target)).toBeLessThanOrEqual(15);
      const counts = tally(capped);
      const bombers = { easy: 2, medium: 3, hard: 4 }[difficulty];
      expect(counts.carrier_bomber).toBe(bombers);
      expect(counts.medium).toBe(3);
      expect(full[full.length - 1]).toMatchObject({ type: 'medium', drop: 'P' });
      expect(capped.filter((spawn) => spawn.drop === 'P')).toHaveLength(2);
      expect(capped.filter((spawn) => spawn.drop === 'B')).toHaveLength(2);
    }
  );

  it('drops B only from the first carrier bomber and aims its fan straight down', () => {
    const bombers = ships(collect('hard', POWER_MAX)).filter(
      (spawn) => spawn.type === 'carrier_bomber'
    );
    expect(bombers.map((spawn) => [spawn.x, spawn.drop])).toEqual([
      [180, 'B'],
      [150, null],
      [230, null],
      [200, null],
    ]);
    expect(bombers.map((spawn) => spawn.t)).toEqual([
      expect.closeTo(26, 1),
      expect.closeTo(58, 1),
      expect.closeTo(59.2, 1),
      expect.closeTo(104, 1),
    ]);
    expect(
      ships(collect('easy', POWER_MAX)).filter((s) => s.type === 'carrier_bomber')
    ).toHaveLength(2);
    expect(ENEMY_DEFS.carrier_bomber).toMatchObject({
      hp: 48,
      score: 1000,
      width: 56,
      height: 48,
      hitRadius: 22,
      size: 'medium',
      category: 'air',
    });
    expect(ENEMY_DEFS.carrier_bomber.countsInKillRate).not.toBe(false);
    const wave = stage.waves.find((entry) => entry.id === 'W07')!;
    expect(wave.groups[0]!.fire).toEqual(CARRIER_BOMBER_FIRE);
    expect(wave.groups[0]!.move).toEqual({
      kind: 'slow_push',
      stopY: CARRIER_BOMBER_STOP_Y,
      hold: CARRIER_BOMBER_HOLD,
    });
    expect(CARRIER_BOMBER_FIRE.kind).toBe('pattern');
    if (CARRIER_BOMBER_FIRE.kind !== 'pattern') return;
    expect(CARRIER_BOMBER_FIRE.pattern).toMatchObject({
      shape: 'fan',
      count: 5,
      spreadDeg: 36,
      aim: 'down',
      bullet: 'large',
      speed: 80,
    });

    const shots = capture(CARRIER_BOMBER_FIRE, 180, 180, 20, 500);
    expect(shots).toHaveLength(5);
    expect(shots.every((shot) => shot.type === 'large')).toBe(true);
    const mid = shots[2]!;
    expect(mid.vx).toBeCloseTo(0, 5);
    expect(mid.vy).toBeCloseTo(80, 5);
    expect(shots.every((shot) => shot.vy > 70)).toBe(true);
    expect(shots[0]!.vx).toBeCloseTo(-shots[4]!.vx, 5);

    const bomber = createEnemy();
    spawnEnemy(
      bomber,
      'carrier_bomber',
      180,
      40,
      { kind: 'slow_push', stopY: 180, hold: 2 },
      CARRIER_BOMBER_FIRE
    );
    let fired = 0;
    for (let i = 0; i < 400; i++) {
      if (shouldEnemyFire(bomber, DT, 20, 500).shouldFire) fired++;
    }
    expect(fired).toBe(1);
  });
});

describe('stage 4 cruiser guns', () => {
  it('places six pads on cruiserGunDeck and fields five unless the run is hard', () => {
    expect(CRUISER_GUN_HP).toBe(16);
    expect(BUILDING_HP).toBe(3);
    expect(stage.buildings.map((gun) => [gun.id, gun.row, gun.col])).toEqual(
      SEA_GUN_PADS.map((pad) => [pad.id, pad.row, pad.col])
    );
    expect(stage.buildings.every((gun) => gun.type === 'cruiser_gun' && gun.map === 'seaB')).toBe(
      true
    );
    const grid = getMapGrid('seaB');
    const track = buildStageTrack(stage);
    for (const placement of placeBuildings(stage.buildings, track)) {
      expect(validateBuildingFootprint(grid, placement), placement.id).toBe(true);
      expect(buildingSpawnScroll(placement) / BG_SCROLL_SPEED).toBeLessThan(STAGE4_WARNING_AT);
    }
    expect(placementsForDifficulty(stage.buildings, 'easy').map((gun) => gun.id)).toEqual([
      'B01',
      'B02',
      'B03',
      'B04',
      'B05',
    ]);
    expect(placementsForDifficulty(stage.buildings, 'medium').map((gun) => gun.id)).toEqual([
      'B01',
      'B02',
      'B03',
      'B04',
      'B05',
    ]);
    expect(placementsForDifficulty(stage.buildings, 'hard').map((gun) => gun.id)).toEqual([
      'B01',
      'B02',
      'B03',
      'B04',
      'B05',
      'B06',
    ]);
    expect(stage.buildings.find((gun) => gun.id === 'B06')!.difficulties).toEqual(['hard']);
  });

  it('locks T and M, and rolls exactly one M inside s4-fleet-mate', () => {
    expect(stage.buildings.map((gun) => gun.drop)).toEqual([
      'T',
      'M',
      'T',
      { exclusive: 's4-fleet-mate', item: 'M' },
      { exclusive: 's4-fleet-mate', item: 'M' },
      undefined,
    ]);
    for (const seed of [1, 2, 3, 4, 5]) {
      const drops = resolvePlacementDrops(stage.buildings, createRng(seed));
      const mates = ['B04', 'B05'].filter((id) => drops.get(id) === 'M');
      expect(mates).toHaveLength(1);
    }
  });

  it('fires a downward pair and does not turn the barrels toward the ship', () => {
    const fire = BUILDING_SPECS.cruiser_gun.fire!;
    expect(fire).toMatchObject({
      kind: 'pattern',
      interval: 1.8,
      pattern: { shape: 'parallel', count: 2, gap: 14, aim: 'down', bullet: 'small', speed: 110 },
    });
    const shots = capture(fire, 180, 100, 20, 500);
    expect(shots).toHaveLength(2);
    for (const shot of shots) {
      expect(shot.type).toBe('small');
      expect(shot.vx).toBeCloseTo(0, 5);
      expect(shot.vy).toBeCloseTo(110, 5);
    }
    expect(Math.abs(shots[0]!.x - shots[1]!.x)).toBeCloseTo(14, 5);

    const gun = createBuilding();
    spawnBuilding(
      gun,
      { id: 'B01', type: 'cruiser_gun', map: 'seaB', row: 132, col: 8, layer: 0, origin: 0 },
      132 * TILE_SIZE,
      CRUISER_GUN_HP
    );
    gun.y = 120;
    const spawner = {
      spawnBullet() {
        return undefined;
      },
      getBulletCount: () => 0,
    };
    updateBuilding(gun, 0.5, 132 * TILE_SIZE, 20, 500, spawner, true);
    expect(gun.aimAngle).toBeCloseTo(Math.PI / 2, 5);

    const sea = createBuilding();
    spawnBuilding(
      sea,
      { id: 'sea', type: 'sea_gun', map: 'seaB', row: 132, col: 8, layer: 0, origin: 0 },
      132 * TILE_SIZE,
      BUILDING_HP
    );
    sea.y = 120;
    updateBuilding(sea, 0.5, 132 * TILE_SIZE, 20, 500, spawner, true);
    expect(sea.aimAngle).not.toBeCloseTo(Math.PI / 2, 2);
  });
});

describe('stage 4 risk crates and wreck floats', () => {
  it('times risk crates on the stage 4 clocks only', () => {
    expect(stage.riskCrates).toEqual([
      { t: STAGE4_RISK_EARLY_T, x: STAGE4_RISK_CENTER_X, difficulties: ['easy'] },
      { t: STAGE4_RISK_EARLY_T, x: STAGE4_RISK_LEFT_X, difficulties: ['medium', 'hard'] },
      { t: STAGE4_RISK_MID_T, x: STAGE4_RISK_MID_X, difficulties: ['hard'] },
      { t: STAGE4_RISK_LATE_T, x: STAGE4_RISK_RIGHT_X, difficulties: ['medium', 'hard'] },
    ]);
    expect([STAGE4_RISK_EARLY_T, STAGE4_RISK_MID_T, STAGE4_RISK_LATE_T]).toEqual([42, 68, 92]);
    const crates = (difficulty: Difficulty) =>
      collect(difficulty, 1).filter((spawn) => spawn.type === 'risk_crate');
    expect(crates('easy')).toHaveLength(1);
    expect(crates('medium')).toHaveLength(2);
    expect(crates('hard')).toHaveLength(3);
    expect(STAGE4_RISK_LATE_T).toBeLessThan(STAGE4_WRECK_AT);
  });

  it('anchors eight floaters on the chart cells and stops spawning at the warning', () => {
    expect(stage.wreckFloats?.map((floater) => [floater.id, floater.row, floater.col])).toEqual(
      SEA_FLOAT_ANCHORS.map((anchor) => [anchor.id, anchor.row, anchor.col])
    );
    const track = buildStageTrack(stage);
    const placed = placeWreckFloats(stage.wreckFloats ?? [], track);
    const scheduler = new WreckFloatScheduler(placed, stage.warningAt);
    const born: { id: string; t: number }[] = [];
    const frames = Math.round(117 / DT);
    for (let i = 1; i <= frames; i++) {
      const t = i * DT;
      for (const anchor of scheduler.update(BG_SCROLL_SPEED * t, t)) {
        born.push({ id: anchor.id, t });
      }
    }
    expect(born.map((floater) => floater.id)).toEqual(SEA_FLOAT_ANCHORS.map((anchor) => anchor.id));
    for (const anchor of placed) {
      const at = (anchor.row * TILE_SIZE - LOGICAL_H) / BG_SCROLL_SPEED;
      const hit = born.find((floater) => floater.id === anchor.id)!;
      expect(hit.t).toBeGreaterThanOrEqual(at - DT);
      expect(hit.t).toBeLessThan(at + DT);
      expect(at).toBeLessThan(STAGE4_WARNING_AT);
      const center = wreckFloatCenter(anchor, wreckFloatSpawnScroll(anchor));
      expect(center.x).toBe(anchor.col * TILE_SIZE - 4 + 8);
      expect(center.y).toBe(-8);
    }
    const late = new WreckFloatScheduler(placed, stage.warningAt);
    expect(late.update(BG_SCROLL_SPEED * STAGE4_WARNING_AT, STAGE4_WARNING_AT)).toEqual([]);
  });
});
