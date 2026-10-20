import { describe, expect, it } from 'vitest';
import { BG_SCROLL_SPEED, TILE_SIZE, warningTileScrollPx } from '@/game/config';
import { backgroundFade, scrollSpeedAt, warningBulletAlpha, Scroller } from './background';
import {
  TileId,
  buildBaseMap,
  buildCoastMap,
  buildGroundMap,
  getTilePixels,
  mapLayerSpecs,
} from '@/game/art/tiles';
import { COLOR } from '@/game/palette';

const WARNING = 150;

describe('stage background', () => {
  it('crossfades ground into coast, then coast into base', () => {
    expect(backgroundFade(10, WARNING)).toMatchObject({ ground: 1, coast: 0, base: 0, stars: 0 });
    const midCoast = backgroundFade(50.5, WARNING);
    expect(midCoast.ground).toBeCloseTo(0.5, 5);
    expect(midCoast.coast).toBeCloseTo(0.5, 5);
    expect(midCoast.base).toBe(0);
    expect(backgroundFade(70, WARNING).coast).toBe(1);
    const midBase = backgroundFade(95.5, WARNING);
    expect(midBase.coast).toBeCloseTo(0.5, 5);
    expect(midBase.base).toBeCloseTo(0.5, 5);
    expect(backgroundFade(120, WARNING).base).toBe(1);
  });

  it('fades tiles into clouds and then stars during the warning', () => {
    const early = backgroundFade(150.2, WARNING);
    expect(early.base).toBeLessThan(1);
    expect(early.stars).toBe(0);
    const clouds = backgroundFade(151.6, WARNING);
    expect(clouds.clouds).toBeGreaterThan(0.5);
    const stars = backgroundFade(154, WARNING);
    expect(stars.base).toBe(0);
    expect(stars.clouds).toBe(0);
    expect(stars.stars).toBe(1);
  });

  it('ramps the scroll and then stops it', () => {
    expect(scrollSpeedAt(10, WARNING)).toBe(BG_SCROLL_SPEED);
    const mid = scrollSpeedAt(150.8, WARNING);
    expect(mid).toBeGreaterThan(BG_SCROLL_SPEED);
    expect(mid).toBeLessThan(200);
    expect(scrollSpeedAt(154, WARNING)).toBe(0);
  });

  it('fades bullets without leaving them opaque', () => {
    expect(warningBulletAlpha(100, WARNING)).toBe(1);
    expect(warningBulletAlpha(150.6, WARNING)).toBeGreaterThan(0);
    expect(warningBulletAlpha(150.6, WARNING)).toBeLessThan(1);
    expect(warningBulletAlpha(152, WARNING)).toBe(0);
  });

  it('locks ground motion to whole tile pixels', () => {
    const scroller = new Scroller();
    let stepped = 0;
    for (let i = 0; i < 60; i++) {
      stepped += scroller.update(1 / 60, i / 60, WARNING).tileDelta;
    }
    expect(stepped).toBe(Math.floor(scroller.scroll));
    expect(scroller.scroll).toBeCloseTo(BG_SCROLL_SPEED, 1);
  });

  it('builds three sections with the documented features', () => {
    const specs = mapLayerSpecs();
    expect(specs.ground.rows * TILE_SIZE).toBeGreaterThan(640);
    expect(warningTileScrollPx()).toBe(192);

    const ground = buildGroundMap(specs.ground.rows);
    const coast = buildCoastMap(specs.coast.rows);
    const base = buildBaseMap(specs.base.rows);
    expect(ground).toHaveLength(specs.ground.rows);
    expect(coast).toHaveLength(specs.coast.rows);
    expect(base).toHaveLength(specs.base.rows);
    expect(ground.some((row) => row.includes(TileId.roadV))).toBe(true);
    expect(ground.some((row) => row.includes(TileId.barracks))).toBe(true);
    expect(coast.some((row) => row.includes(TileId.water))).toBe(true);
    expect(coast.some((row) => row.includes(TileId.dock))).toBe(true);
    expect(base.some((row) => row.includes(TileId.runway))).toBe(true);
    expect(base.some((row) => row.includes(TileId.hangar))).toBe(true);
    expect(ground.some((row) => row.includes(TileId.tree) || row.includes(TileId.treePine))).toBe(
      true
    );
    expect(ground.some((row) => row.includes(TileId.mountain) || row.includes(TileId.rock))).toBe(
      true
    );
    expect(base.some((row) => row.includes(TileId.wall))).toBe(true);
    let coastLeft = false;
    let coastRight = false;
    for (const row of coast) {
      row.forEach((id, x) => {
        if (id !== TileId.water && id !== TileId.waterB && id !== TileId.shallow) return;
        if (x < 8) coastLeft = true;
        if (x > 14) coastRight = true;
      });
    }
    expect(coastLeft && coastRight).toBe(true);
    for (const tile of getTilePixels()) {
      expect(tile).toHaveLength(TILE_SIZE);
      for (const row of tile) {
        expect(row).toHaveLength(TILE_SIZE);
        for (const cell of row) expect(cell).toBeGreaterThanOrEqual(0);
      }
    }

    const bulletColors = new Set<number>([
      COLOR.BULLET_MAGENTA,
      COLOR.BULLET_PINK,
      COLOR.BULLET_DARK,
      COLOR.BULLET_CORE,
    ]);
    for (const tile of getTilePixels()) {
      for (const row of tile) {
        for (const cell of row) expect(bulletColors.has(cell)).toBe(false);
      }
    }
  });
});
