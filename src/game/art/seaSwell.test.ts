import { describe, expect, it } from 'vitest';
import {
  LOGICAL_H,
  MAP_CROP_X,
  MAP_TILES_X,
  SEA_SWELL_DRIFT,
  SEA_SWELL_JITTER,
  SEA_SWELL_LONG_DRIFT,
  SEA_SWELL_LONG_SCROLL,
  SEA_SWELL_LONG_SPACING,
  SEA_SWELL_SCROLL,
  SEA_SWELL_SPACING,
  TILE_SIZE,
} from '@/game/config';
import { TileId } from '@/game/art/tiles';
import { buildMapTrack } from '@/game/maps/track';
import {
  drawSeaSwell,
  isSwellTile,
  swellFamilyScreenYs,
  swellRunColumns,
  swellShowsFoam,
  swellSpeckColumns,
  swellTileAt,
  swellWaveKept,
  swellWaveScreenY,
} from './seaSwell';

function screenYForRow(row: number): number {
  return LOGICAL_H - (row * TILE_SIZE + TILE_SIZE / 2);
}

function gapsOf(ys: readonly number[]): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < ys.length; i++) gaps.push(ys[i]! - ys[i - 1]!);
  return gaps;
}

describe('sea swell', () => {
  const layer = buildMapTrack('seaB').layers[0]!;

  it('breaks the even comb and still slips against the scroll', () => {
    expect(SEA_SWELL_SPACING).toBeGreaterThanOrEqual(48);
    expect(SEA_SWELL_SPACING - SEA_SWELL_JITTER * 2).toBeGreaterThanOrEqual(32);
    const ys = swellFamilyScreenYs(0, 0, 1);
    expect(ys.length).toBeGreaterThan(4);
    const gaps = gapsOf(ys);
    expect(new Set(gaps).size).toBeGreaterThan(1);
    for (const gap of gaps) {
      expect(gap).toBeGreaterThanOrEqual(SEA_SWELL_SPACING - SEA_SWELL_JITTER * 2);
    }
    const still = swellWaveScreenY(0, 0, 0);
    const scrolled = swellWaveScreenY(80, 0, 0);
    expect(Math.abs(scrolled - still - 80)).toBeGreaterThan(55);
    expect(scrolled - still).toBeCloseTo(SEA_SWELL_SCROLL * 80, 5);
    expect(Math.abs(swellWaveScreenY(0, 1, 0) - still)).toBeGreaterThanOrEqual(SEA_SWELL_DRIFT);
  });

  it('lets a second wavelength slip away from the first', () => {
    const ys = swellFamilyScreenYs(0, 0, 2);
    expect(ys.length).toBeGreaterThan(3);
    for (const gap of gapsOf(ys)) {
      expect(gap).toBeGreaterThanOrEqual(SEA_SWELL_LONG_SPACING - SEA_SWELL_JITTER * 2);
    }
    const index = 2;
    const apart = (scroll: number) =>
      swellWaveScreenY(
        scroll,
        0,
        index,
        SEA_SWELL_LONG_SPACING,
        SEA_SWELL_LONG_SCROLL,
        SEA_SWELL_LONG_DRIFT,
        2
      ) - swellWaveScreenY(scroll, 0, index);
    expect(Math.abs(apart(400) - apart(0))).toBeGreaterThan(20);
  });

  it('keeps crest runs short and gives each wave its own mask', () => {
    const masks = new Set<string>();
    let checked = 0;
    for (let index = 0; index < 16; index++) {
      if (!swellWaveKept(1, index)) continue;
      const cols = swellRunColumns(1, index);
      checked += 1;
      expect(cols.length).toBeGreaterThanOrEqual(3);
      expect(cols.length).toBeLessThan(MAP_TILES_X);
      expect(new Set(cols).size).toBe(cols.length);
      masks.add(cols.join(','));
    }
    expect(checked).toBeGreaterThan(8);
    expect(masks.size).toBeGreaterThan(3);
  });

  it('varies foam along a crest and scatters specks off a full row', () => {
    const foamCounts: number[] = [];
    for (let index = 0; index < 20; index++) {
      if (!swellWaveKept(1, index)) continue;
      const cols = swellRunColumns(1, index);
      foamCounts.push(cols.filter((col) => swellShowsFoam(1, index, col)).length);
    }
    expect(Math.max(...foamCounts) - Math.min(...foamCounts)).toBeGreaterThan(0);
    const speckMasks = new Set<string>();
    for (let index = 0; index < 8; index++) {
      const cols = swellSpeckColumns(4, index);
      expect(cols.length).toBeGreaterThanOrEqual(5);
      expect(cols.length).toBeLessThanOrEqual(9);
      expect(cols.length).toBeLessThan(MAP_TILES_X);
      speckMasks.add(cols.join(','));
    }
    expect(speckMasks.size).toBeGreaterThan(3);
  });

  it('breaks crests on the deck and keeps them on open water', () => {
    expect(isSwellTile(TileId.ocean)).toBe(true);
    expect(isSwellTile(TileId.oceanB)).toBe(true);
    expect(isSwellTile(TileId.wake)).toBe(false);
    expect(isSwellTile(TileId.carrierDeck)).toBe(false);
    expect(isSwellTile(TileId.cruiserHull)).toBe(false);
    expect(isSwellTile(TileId.cruiserGunDeck)).toBe(false);
    expect(isSwellTile(TileId.enemyDeck)).toBe(false);
    const deckY = screenYForRow(10);
    expect(isSwellTile(swellTileAt(layer, 0, 11, deckY))).toBe(false);
    expect(isSwellTile(swellTileAt(layer, 0, 0, deckY))).toBe(true);
  });

  it('draws the same dashes twice, and only on swell tiles', () => {
    const take = (scroll: number, time: number) => {
      const rects: { x: number; y: number; w: number; h: number }[] = [];
      const ctx = {
        save: () => undefined,
        restore: () => undefined,
        fillRect: (x: number, y: number, w: number, h: number) => {
          rects.push({ x, y, w, h });
        },
      } as unknown as CanvasRenderingContext2D;
      drawSeaSwell(ctx, layer, scroll, time, 1);
      return rects;
    };
    const once = take(2000, 3);
    expect(take(2000, 3)).toEqual(once);
    expect(once.length).toBeGreaterThan(8);
    expect(once.some((rect) => rect.h >= 2 && rect.w >= 8)).toBe(true);
    expect(once.some((rect) => rect.w === 2)).toBe(true);
    for (const rect of once) {
      const col = Math.floor((rect.x + MAP_CROP_X) / TILE_SIZE);
      expect(isSwellTile(swellTileAt(layer, 2000, col, rect.y)), `${col},${rect.y}`).toBe(true);
      expect(rect.w).toBeLessThan(TILE_SIZE);
    }
  });

  it('does not touch the context on a land map', () => {
    const land = buildMapTrack('landA').layers[0]!;
    let calls = 0;
    const ctx = new Proxy({} as CanvasRenderingContext2D, {
      get: () => () => {
        calls++;
      },
    });
    drawSeaSwell(ctx, land, 0, 1, 1);
    expect(calls).toBe(0);
  });
});
