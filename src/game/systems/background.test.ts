import { describe, expect, it } from 'vitest';
import {
  BG_SCROLL_SPEED,
  LOGICAL_H,
  MAP_BLEND_LEAD,
  TILE_SIZE,
  warningTileScrollPx,
} from '@/game/config';
import {
  backgroundFade,
  scrollDistance,
  scrollSpeedAt,
  tileHandoffDistance,
  tileHandoffSpeed,
  warningBulletAlpha,
  Scroller,
} from './background';
import { TileId } from '@/game/art/tiles';
import { getStage } from '@/game/levels/registry';
import {
  backdropSegments,
  buildMapTrack,
  buildStageTrack,
  getMapGrid,
  getTileMap,
  logicalMapY,
  mapPixelScreenY,
  segmentScreenSpan,
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
      role: 'run' as const,
      loopFrom: null,
    })),
    warningAt: WARNING,
    starsOnly: false,
    handoff: 'starfield' as const,
    endAt: null,
  };
}

/** Same run as stage 1, but the boss handoff is still the starfield. */
function starfieldStage(): BackgroundTrack {
  const stage = getStage('1');
  return buildStageTrack({
    ...stage,
    id: 'star',
    maps: { run: stage.maps.run, boss: 'spaceA' },
  });
}

describe('stage background', () => {
  it('keeps stage 1 on one fully opaque map until the warning', () => {
    expect(stage1.layers.map((l) => l.map.id)).toEqual(['landA', 'landBoss']);
    expect(stage1.handoff).toBe('tiles');
    for (const t of [0, 45, 90, 149.9]) expect(backgroundFade(t, stage1).layers).toEqual([1, 0]);
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

  it('stitches stage 1 onto the land boss without a cloud sheet', () => {
    const land = stage1.layers[0]!;
    const boss = stage1.layers[1]!;
    expect(boss.origin).toBe(land.grid.length * TILE_SIZE);
    expect(backgroundFade(0, stage1)).toEqual({ layers: [1, 0], clouds: 0, stars: 0 });
    const armed = backgroundFade(150, stage1);
    expect(armed).toEqual({ layers: [1, 1], clouds: 0, stars: 0 });
    const oldCloudWindow = backgroundFade(151.6, stage1);
    expect(oldCloudWindow.clouds).toBe(0);
    expect(oldCloudWindow.stars).toBe(0);
    expect(oldCloudWindow.layers[0]).toBe(1);
    const arena = backgroundFade(154, stage1);
    expect(arena).toEqual({ layers: [0, 1], clouds: 0, stars: 0 });
  });

  it('meets landA and the boss map on one screen edge during the join', () => {
    const land = stage1.layers[0]!;
    const boss = stage1.layers[1]!;
    const scroll = boss.origin - LOGICAL_H / 2;
    const landSeg = backdropSegments(
      scroll - land.origin,
      land.grid.length * TILE_SIZE,
      null,
      LOGICAL_H
    );
    const bossSeg = backdropSegments(
      scroll - boss.origin,
      boss.grid.length * TILE_SIZE,
      (boss.loopFrom ?? 0) * TILE_SIZE,
      LOGICAL_H
    );
    expect(landSeg).toHaveLength(1);
    expect(bossSeg).toHaveLength(1);
    const landSpan = segmentScreenSpan(landSeg[0]!);
    const bossSpan = segmentScreenSpan(bossSeg[0]!);
    expect(bossSpan.top).toBe(0);
    expect(landSpan.bottom).toBe(LOGICAL_H);
    expect(landSpan.top).toBe(bossSpan.bottom);
  });

  it('still fades a starfield boss into clouds and then stars', () => {
    const space = starfieldStage();
    expect(space.layers).toHaveLength(1);
    expect(space.handoff).toBe('starfield');
    const early = backgroundFade(150.2, space);
    expect(early.layers[0]).toBeLessThan(1);
    expect(early.stars).toBe(0);
    const stars = backgroundFade(154, space);
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

  it('ramps a starfield to a stop and rushes a tile boss back to cruise', () => {
    expect(scrollSpeedAt(10, WARNING)).toBe(BG_SCROLL_SPEED);
    const mid = scrollSpeedAt(150.8, WARNING);
    expect(mid).toBeGreaterThan(BG_SCROLL_SPEED);
    expect(mid).toBeLessThan(200);
    expect(scrollSpeedAt(154, WARNING)).toBe(0);
    expect(scrollSpeedAt(154, null)).toBe(BG_SCROLL_SPEED);
    expect(warningTileScrollPx()).toBe(192);
    expect(tileHandoffSpeed(0)).toBe(BG_SCROLL_SPEED);
    expect(tileHandoffSpeed(2)).toBe(280);
    expect(tileHandoffSpeed(5)).toBe(BG_SCROLL_SPEED);
    expect(tileHandoffDistance(5)).toBe(1160);
    expect(scrollSpeedAt(152, WARNING, 'tiles')).toBe(280);
    expect(scrollSpeedAt(155, WARNING, 'tiles')).toBe(BG_SCROLL_SPEED);
    expect(scrollDistance(WARNING, WARNING, 'tiles')).toBe(WARNING * BG_SCROLL_SPEED);
    expect(scrollDistance(WARNING + 5, WARNING, 'tiles')).toBe(
      WARNING * BG_SCROLL_SPEED + tileHandoffDistance(5)
    );
  });

  it('seeks challenge boss onto the approach strip and keeps that strip scrolling', () => {
    const stage = getStage('1');
    const origin = stage1.layers[1]!.origin;
    const scroller = new Scroller(stage1);
    const frame = scroller.seek(stage.boss.enterAt);
    const local = frame.scroll - origin;
    const approachPx = (getTileMap('landBoss').loopFrom ?? 0) * TILE_SIZE;
    expect(frame.fade.stars).toBe(0);
    expect(frame.fade.clouds).toBe(0);
    expect(frame.fade.layers).toEqual([0, 1]);
    expect(local).toBeGreaterThan(0);
    expect(local).toBeLessThan(approachPx);
    const before = scroller.scroll;
    scroller.update(1, stage.boss.enterAt + 2);
    expect(scroller.scroll).toBeCloseTo(before + BG_SCROLL_SPEED, 5);

    const space = new Scroller(starfieldStage());
    const parked = space.seek(154);
    expect(parked.fade.stars).toBe(1);
    space.update(1, 156);
    expect(space.scroll).toBe(parked.scroll);
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
