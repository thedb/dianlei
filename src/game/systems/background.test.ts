import { describe, expect, it } from 'vitest';
import {
  BG_SCROLL_SPEED,
  LOGICAL_H,
  MAP_BLEND_LEAD,
  TILE_SIZE,
  warningTileScrollPx,
} from '@/game/config';
import { backgroundFade, scrollSpeedAt, warningBulletAlpha, Scroller } from './background';
import { TileId } from '@/game/art/tiles';
import { getStage } from '@/game/levels/registry';
import {
  buildMapTrack,
  buildStageTrack,
  getMapGrid,
  getTileMap,
  logicalMapY,
  mapPixelScreenY,
  terrainAt,
  terrainBlocksTank,
  type BackgroundTrack,
} from '@/game/maps';

const WARNING = 150;
const stage1 = buildStageTrack(getStage('1'));

/** 陆地A → 河流A at 45 s → 陆地B at 90 s, a three-map crossfade fixture. */
function threeMapTrack(): BackgroundTrack {
  const at = [0, 45, 90];
  const ids = ['landA', 'riverA', 'landB'];
  return {
    label: 'test',
    layers: ids.map((id, i) => ({
      map: getTileMap(id),
      grid: getMapGrid(id),
      origin: i === 0 ? 0 : (at[i]! - MAP_BLEND_LEAD) * BG_SCROLL_SPEED,
      inAt: i === 0 ? null : at[i]!,
      outAt: at[i + 1] ?? null,
    })),
    warningAt: WARNING,
    starsOnly: false,
    endAt: null,
  };
}

describe('stage background', () => {
  it('keeps stage 1 on one fully opaque map until the warning', () => {
    expect(stage1.layers).toHaveLength(1);
    for (const t of [0, 45, 90, 149.9]) expect(backgroundFade(t, stage1).layers).toEqual([1]);
  });

  it('crossfades map layers around each handover', () => {
    const track = threeMapTrack();
    expect(backgroundFade(10, track)).toMatchObject({ layers: [1, 0, 0], stars: 0 });
    const mid = backgroundFade(45.5, track).layers;
    expect(mid[0]).toBeCloseTo(0.5, 5);
    expect(mid[1]).toBeCloseTo(0.5, 5);
    expect(mid[2]).toBe(0);
    expect(backgroundFade(70, track).layers[1]).toBe(1);
    expect(backgroundFade(120, track).layers[2]).toBe(1);
  });

  it('fades tiles into clouds and then stars during the warning', () => {
    const early = backgroundFade(150.2, stage1);
    expect(early.layers[0]).toBeLessThan(1);
    expect(early.stars).toBe(0);
    const clouds = backgroundFade(151.6, stage1);
    expect(clouds.clouds).toBeGreaterThan(0.5);
    const stars = backgroundFade(154, stage1);
    expect(stars.layers[0]).toBe(0);
    expect(stars.clouds).toBe(0);
    expect(stars.stars).toBe(1);
  });

  it('shows only stars for a starfield preview and never fades a preview track', () => {
    const space = buildMapTrack('spaceA');
    expect(backgroundFade(0, space)).toEqual({ layers: [], clouds: 0, stars: 1 });
    const land = buildMapTrack('landA');
    expect(backgroundFade(155, land)).toEqual({ layers: [1], clouds: 0, stars: 0 });
  });

  it('ramps the scroll and then stops it', () => {
    expect(scrollSpeedAt(10, WARNING)).toBe(BG_SCROLL_SPEED);
    const mid = scrollSpeedAt(150.8, WARNING);
    expect(mid).toBeGreaterThan(BG_SCROLL_SPEED);
    expect(mid).toBeLessThan(200);
    expect(scrollSpeedAt(154, WARNING)).toBe(0);
    expect(scrollSpeedAt(154, null)).toBe(BG_SCROLL_SPEED);
    expect(warningTileScrollPx()).toBe(192);
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
    expect(logicalMapY(start, 0)).toBe(0);
    expect(logicalMapY(mapPixelScreenY(1234, 77), 77)).toBe(1234);
  });

  it('blocks tanks on 陆地A water and lets them drive on its meadow', () => {
    const grid = getMapGrid('landA');
    let water: { x: number; y: number } | null = null;
    let land: { x: number; y: number } | null = null;
    const scroll = 160 * TILE_SIZE;
    for (let row = 160; row < 200 && (!water || !land); row++) {
      for (let col = 0; col < grid[row]!.length; col++) {
        const screenY = mapPixelScreenY(row * TILE_SIZE + 8, scroll);
        if (screenY < 0 || screenY >= LOGICAL_H) continue;
        const screenX = col * TILE_SIZE + 8 - 4;
        const t = terrainAt(grid, col, row);
        if (!water && t === 'water') water = { x: screenX, y: screenY };
        if (!land && t === 'land') land = { x: screenX, y: screenY };
      }
    }
    expect(water).not.toBeNull();
    expect(land).not.toBeNull();
    expect(terrainBlocksTank(stage1, scroll, [1], water!.x, water!.y)).toBe(true);
    expect(terrainBlocksTank(stage1, scroll, [1], land!.x, land!.y)).toBe(false);
    expect(terrainBlocksTank(stage1, scroll, [0], water!.x, water!.y)).toBe(false);
  });

  it('reads tank terrain from the most opaque layer', () => {
    const track = threeMapTrack();
    const sea = track.layers[1]!;
    const local = 400;
    let water: { x: number; y: number } | null = null;
    for (let row = 12; row < 48 && !water; row++) {
      for (let col = 0; col < sea.grid[row]!.length && !water; col++) {
        if (terrainAt(sea.grid, col, row) !== 'water' || sea.grid[row]![col] === TileId.dock)
          continue;
        water = { x: col * TILE_SIZE + 4, y: mapPixelScreenY(row * TILE_SIZE + 8, local) };
      }
    }
    expect(water).not.toBeNull();
    const scroll = sea.origin + local;
    expect(terrainBlocksTank(track, scroll, [0, 1, 0], water!.x, water!.y)).toBe(true);
    expect(terrainBlocksTank(track, scroll, [1, 0, 0], water!.x, water!.y)).toBe(
      terrainAt(
        track.layers[0]!.grid,
        Math.floor((water!.x + 4) / TILE_SIZE),
        Math.floor(logicalMapY(water!.y, scroll) / TILE_SIZE)
      ) === 'water'
    );
  });

  it('locks ground motion to whole tile pixels', () => {
    const scroller = new Scroller(stage1);
    let stepped = 0;
    for (let i = 0; i < 60; i++) {
      stepped += scroller.update(1 / 60, i / 60).tileDelta;
    }
    expect(stepped).toBe(Math.floor(scroller.scroll));
    expect(scroller.scroll).toBeCloseTo(BG_SCROLL_SPEED, 1);
  });
});
