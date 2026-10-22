import { describe, expect, it } from 'vitest';
import {
  BG_SCROLL_SPEED,
  BUILDING_HP,
  HOMING_MAX_LEVEL,
  LOGICAL_H,
  SCORE_BUILDING,
  SCORE_SMALL_FIGHTER,
  SEA_GUN_FIRE_INTERVAL,
  TILE_SIZE,
} from '@/game/config';
import { getStage } from '@/game/levels/registry';
import type { BuildingPlacement } from '@/game/levels/types';
import { TileId } from '@/game/art/tiles';
import { buildStageTrack, getMapGrid, mapPixelScreenY } from '@/game/maps';
import { backgroundFade } from '@/game/systems/background';
import { ENEMY_STATS, createEnemy, spawnEnemy, updateEnemy } from './enemy';
import type { BulletSpawner } from './enemyBullet';
import {
  BUILDING_SPECS,
  BuildingScheduler,
  buildingBlocksTank,
  buildingCenter,
  buildingExitScroll,
  buildingSize,
  buildingSpawnScroll,
  bulletHitsBuilding,
  createBuilding,
  chooseBuildingDrop,
  damageBuilding,
  spawnBuilding,
  updateBuilding,
  placeBuildings,
  validateBuildingFootprint,
  type Building,
  type PlacedBuilding,
} from './building';

const stage1 = getStage('1');
const track = buildStageTrack(stage1);
const placements = placeBuildings(stage1.buildings, track);

const DT = 1 / 60;
const landA = getMapGrid('landA');

function recordingSpawner(): BulletSpawner & { shots: number } {
  const s = {
    shots: 0,
    spawnBullet() {
      s.shots++;
    },
    getBulletCount: () => s.shots,
  };
  return s;
}

function placed(p: PlacedBuilding, scroll: number): Building {
  const b = createBuilding();
  b.active = true;
  spawnBuilding(b, p, scroll);
  return b;
}

describe('stage 1 building placements', () => {
  it('uses exactly the four P6 types, with unique ids', () => {
    const types = new Set(stage1.buildings.map((b) => b.type));
    expect([...types].sort()).toEqual(['fuel_depot', 'pillbox', 'radar_station', 'sea_gun']);
    const ids = stage1.buildings.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all sit on 陆地A, the only map of the stage-1 run', () => {
    for (const b of stage1.buildings) expect(b.map, b.id).toBe('landA');
    expect(placements.every((p) => p.layer === 0 && p.origin === 0)).toBe(true);
  });

  it('every footprint passes the terrain check (land on land, water on water, no decor)', () => {
    for (const p of stage1.buildings) {
      expect(validateBuildingFootprint(landA, p), p.id).toBe(true);
    }
  });

  it('puts every sea gun on 陆地A water (river or lake)', () => {
    const guns = stage1.buildings.filter((b) => b.type === 'sea_gun');
    expect(guns.length).toBe(3);
    for (const p of guns) {
      for (let r = p.row; r < p.row + 2; r++) {
        for (let c = p.col; c < p.col + 2; c++) expect(landA[r]![c], p.id).toBe(TileId.lake);
      }
    }
  });

  it('rejects a map the track does not use', () => {
    expect(() => placeBuildings([{ ...stage1.buildings[0]!, map: 'riverA' }], track)).toThrow();
  });

  it('footprints in a section never overlap', () => {
    const cells = new Set<string>();
    for (const p of stage1.buildings) {
      const spec = BUILDING_SPECS[p.type];
      for (let r = p.row; r < p.row + spec.rows; r++) {
        for (let c = p.col; c < p.col + spec.cols; c++) {
          const key = `${p.map}:${r}:${c}`;
          expect(cells.has(key), key).toBe(false);
          cells.add(key);
        }
      }
    }
  });

  it('crosses the whole screen on its fully opaque map, before the warning', () => {
    for (const p of placements) {
      const tIn = buildingSpawnScroll(p) / BG_SCROLL_SPEED;
      const tOut = buildingExitScroll(p) / BG_SCROLL_SPEED;
      expect(tIn, p.id).toBeGreaterThan(0);
      expect(tOut, p.id).toBeLessThan(stage1.warningAt);
      expect(backgroundFade(tIn, track).layers[p.layer], p.id).toBe(1);
      expect(backgroundFade(tOut, track).layers[p.layer], p.id).toBe(1);
    }
  });
});

describe('footprint validation', () => {
  const ground = (
    type: BuildingPlacement['type'],
    row: number,
    col: number
  ): BuildingPlacement => ({
    id: 'T',
    type,
    map: 'landA',
    row,
    col,
  });

  it('rejects decor, roads, water and off-grid footprints', () => {
    const findTile = (id: TileId): [number, number] => {
      for (let r = 0; r < landA.length; r++) {
        const c = landA[r]!.indexOf(id);
        if (c >= 0) return [r, c];
      }
      throw new Error(`no tile ${id}`);
    };
    for (const decor of [TileId.road, TileId.street, TileId.boulder, TileId.shed, TileId.lake]) {
      const [r, c] = findTile(decor);
      expect(validateBuildingFootprint(landA, ground('pillbox', r, c)), `tile ${decor}`).toBe(
        false
      );
    }
    expect(validateBuildingFootprint(landA, ground('sea_gun', 60, 14))).toBe(false);
    expect(validateBuildingFootprint(landA, ground('pillbox', -1, 14))).toBe(false);
    expect(validateBuildingFootprint(landA, ground('fuel_depot', 60, 21))).toBe(false);
  });

  it('keeps every decor tile out of the land whitelist', () => {
    const decor = [
      TileId.barracks,
      TileId.bunker,
      TileId.hangar,
      TileId.hangarRoof,
      TileId.radar,
      TileId.pad,
    ];
    for (const id of decor) {
      const grid: TileId[][] = [
        [id, id, id],
        [id, id, id],
      ];
      expect(validateBuildingFootprint(grid, ground('fuel_depot', 0, 0))).toBe(false);
    }
  });
});

describe('building motion', () => {
  const p = placements[0]!;

  it('stays on the tile blit in whole pixels', () => {
    const { height } = buildingSize(p.type);
    for (const scroll of [320, 400.3, 512.75, 777.9]) {
      const c = buildingCenter(p, scroll);
      expect(Number.isInteger(c.x)).toBe(true);
      expect(Number.isInteger(c.y)).toBe(true);
      const topRow = p.row + BUILDING_SPECS[p.type].rows - 1;
      const tileTop = mapPixelScreenY(topRow * TILE_SIZE, Math.floor(scroll) - p.origin);
      expect(c.y - height / 2).toBe(tileTop);
    }
  });

  it('enters at the top edge on its spawn scroll and culls past the bottom', () => {
    const scroll = buildingSpawnScroll(p);
    const b = placed(p, scroll);
    expect(b.y + b.height / 2).toBe(0);
    const spawner = recordingSpawner();
    expect(updateBuilding(b, DT, scroll + LOGICAL_H, 180, 560, spawner, true)).toBe(false);
    expect(updateBuilding(b, DT, buildingExitScroll(p) + 1, 180, 560, spawner, true)).toBe(true);
  });
});

describe('building scheduler', () => {
  it('emits each placement once, in scroll order', () => {
    const sched = new BuildingScheduler(placements, stage1.warningAt);
    const seen: string[] = [];
    for (let t = 0; t < stage1.warningAt; t += DT) {
      for (const p of sched.update(t * BG_SCROLL_SPEED, t)) seen.push(p.id);
    }
    expect(seen.sort()).toEqual(stage1.buildings.map((b) => b.id).sort());
    sched.reset();
    expect(sched.update(1e9, 0).length).toBe(stage1.buildings.length);
  });

  it('spawns nothing from the warning on', () => {
    const sched = new BuildingScheduler(placements, stage1.warningAt);
    expect(sched.update(1e9, stage1.warningAt)).toEqual([]);
    expect(sched.update(1e9, stage1.boss.enterAt)).toEqual([]);
  });
});

describe('building damage and wreck', () => {
  const p = placements[0]!;

  it('has small-fighter HP and its own score', () => {
    expect(BUILDING_HP).toBe(ENEMY_STATS.small.hp);
    expect(SCORE_BUILDING).toBeGreaterThan(SCORE_SMALL_FIGHTER);
  });

  it('turns into a wreck with no hitbox and no tank blocking', () => {
    const b = placed(p, 600);
    expect(bulletHitsBuilding(b, b.x, b.y, 4, 12)).toBe(true);
    expect(buildingBlocksTank(b, b.x + b.width / 2 + 4, b.y)).toBe(true);
    for (let i = 0; i < BUILDING_HP - 1; i++) expect(damageBuilding(b, 1)).toBe(false);
    expect(b.hitFlashTimer).toBeGreaterThan(0);
    expect(damageBuilding(b, 1)).toBe(true);
    expect(b.wrecked).toBe(true);
    expect(damageBuilding(b, 1)).toBe(false);
    expect(bulletHitsBuilding(b, b.x, b.y, 4, 12)).toBe(false);
    expect(buildingBlocksTank(b, b.x, b.y)).toBe(false);
  });

  it('misses bullets outside the inset footprint', () => {
    const b = placed(p, 600);
    expect(bulletHitsBuilding(b, b.x + b.width / 2 + 3, b.y, 4, 12)).toBe(false);
  });

  it('stops a tank driving into it, then lets it through once wrecked', () => {
    const b = placed(p, 600);
    const tank = createEnemy();
    spawnEnemy(tank, 'tank', b.x - 80, b.y, { kind: 'ground', entry: 'left' }, { kind: 'none' });
    const terrain = { blocksTank: (x: number, y: number) => buildingBlocksTank(b, x, y) };
    for (let i = 0; i < 60 * 6; i++) updateEnemy(tank, DT, 180, 560, 0, terrain);
    expect(tank.x).toBeLessThanOrEqual(b.x - b.width / 2);
    damageBuilding(b, BUILDING_HP);
    for (let i = 0; i < 60 * 6; i++) updateEnemy(tank, DT, 180, 560, 0, terrain);
    expect(tank.x).toBeGreaterThan(b.x);
  });
});

describe('building drops', () => {
  it('always drops T until the live homing slot is at max, then only B', () => {
    expect(chooseBuildingDrop(null)).toBe('T');
    const sub: { id: 'homing' | 'vulcan'; level: number } = { id: 'homing', level: 0 };
    expect(chooseBuildingDrop(sub)).toBe('T');
    sub.level = 1;
    expect(chooseBuildingDrop(sub)).toBe('T');
    sub.level = HOMING_MAX_LEVEL;
    expect(chooseBuildingDrop(sub)).toBe('B');
    sub.id = 'vulcan';
    expect(chooseBuildingDrop(sub)).toBe('T');
  });

  it('reads the slot object it is given, so a later level change is the next drop', () => {
    const sub = { id: 'homing' as const, level: 1 };
    expect(chooseBuildingDrop(sub)).toBe('T');
    sub.level = HOMING_MAX_LEVEL;
    expect(chooseBuildingDrop(sub)).toBe('B');
    sub.level = 1;
    expect(chooseBuildingDrop(sub)).toBe('T');
  });

  it('is the only source of T: wave-table carriers drop only P and B', () => {
    for (const wave of stage1.waves) {
      for (const g of wave.groups) {
        for (const d of g.drops ?? []) expect(['P', 'B']).toContain(d.item);
      }
    }
  });
});

describe('sea gun fire', () => {
  const sea = placements.find((b) => b.type === 'sea_gun')!;
  const onScreen = buildingSpawnScroll(sea) + 200;

  it('fires a fixed2 pair every SEA_GUN_FIRE_INTERVAL, slower than any ground turret', () => {
    for (const wave of stage1.waves) {
      for (const g of wave.groups) {
        if (g.enemy !== 'turret2' || g.fire.kind !== 'fixed2') continue;
        expect(SEA_GUN_FIRE_INTERVAL).toBeGreaterThan(g.fire.interval ?? 0);
      }
    }
    const b = placed(sea, onScreen);
    const spawner = recordingSpawner();
    const steps = Math.round((SEA_GUN_FIRE_INTERVAL * 3) / DT) + 1;
    for (let i = 0; i < steps; i++) updateBuilding(b, DT, onScreen, 180, 560, spawner, true);
    expect(b.shotsFired).toBe(3);
    expect(spawner.shots).toBe(6);
  });

  it('holds fire during the warning and once wrecked', () => {
    const b = placed(sea, onScreen);
    const spawner = recordingSpawner();
    for (let i = 0; i < 600; i++) updateBuilding(b, DT, onScreen, 180, 560, spawner, false);
    expect(spawner.shots).toBe(0);
    damageBuilding(b, BUILDING_HP);
    for (let i = 0; i < 600; i++) updateBuilding(b, DT, onScreen, 180, 560, spawner, true);
    expect(spawner.shots).toBe(0);
  });

  it('is the only building that fires', () => {
    for (const p of placements.filter((x) => x.type !== 'sea_gun')) {
      const scroll = buildingSpawnScroll(p) + 200;
      const b = placed(p, scroll);
      const spawner = recordingSpawner();
      for (let i = 0; i < 600; i++) updateBuilding(b, DT, scroll, 180, 560, spawner, true);
      expect(spawner.shots, p.id).toBe(0);
    }
  });
});
