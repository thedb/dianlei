import { describe, expect, it } from 'vitest';
import { BG_SCROLL_SPEED, LOGICAL_H, TILE_SIZE, warningTileScrollPx } from '@/game/config';
import { backgroundFade, scrollSpeedAt, warningBulletAlpha, Scroller } from './background';
import {
  TileId,
  buildBaseMap,
  buildCoastMap,
  buildGroundMap,
  getTilePixels,
  isWaterTile,
  logicalMapY,
  mapLayerSpecs,
  mapPixelScreenY,
  scrollSourceY,
  terrainBlocksTank,
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

  it('moves a fixed map pixel downward and brings the next row in from the top', () => {
    const start = mapPixelScreenY(0, 0);
    expect(start).toBe(LOGICAL_H - TILE_SIZE);
    expect(mapPixelScreenY(TILE_SIZE, 0)).toBeLessThan(start);
    expect(mapPixelScreenY(0, 10)).toBe(start + 10);
    expect(mapPixelScreenY(LOGICAL_H, 0)).toBe(-TILE_SIZE);
    expect(mapPixelScreenY(LOGICAL_H, TILE_SIZE)).toBe(0);
    const height = 4000;
    expect(scrollSourceY(height, 0)).toBe(height - LOGICAL_H);
    expect(scrollSourceY(height, 25)).toBe(height - LOGICAL_H - 25);
    expect(logicalMapY(start, 0)).toBe(0);
  });

  it('treats coast river tiles as blocked for tanks and grass as open', () => {
    const specs = mapLayerSpecs();
    const coast = buildCoastMap(specs.coast.rows);
    const grids = {
      ground: buildGroundMap(4),
      coast,
      base: buildBaseMap(4),
    };
    const fade = backgroundFade(70, WARNING);
    const local = 400;
    const scroll = specs.coast.origin + local;
    let water: { x: number; y: number } | null = null;
    let land: { x: number; y: number } | null = null;
    for (let row = 12; row < 48 && (!water || !land); row++) {
      for (let col = 0; col < coast[row]!.length; col++) {
        const id = coast[row]![col]!;
        const logicalY = row * TILE_SIZE + 8;
        const screenY = mapPixelScreenY(logicalY, local);
        const screenX = col * TILE_SIZE + 8 - 4;
        if (!water && isWaterTile(id)) water = { x: screenX, y: screenY };
        if (!land && !isWaterTile(id) && id !== TileId.dock) land = { x: screenX, y: screenY };
      }
    }
    expect(water).not.toBeNull();
    expect(land).not.toBeNull();
    expect(terrainBlocksTank(grids, scroll, fade, water!.x, water!.y)).toBe(true);
    expect(terrainBlocksTank(grids, scroll, fade, land!.x, land!.y)).toBe(false);
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
