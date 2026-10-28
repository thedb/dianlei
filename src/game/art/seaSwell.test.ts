import { describe, expect, it } from 'vitest';
import { LOGICAL_H, MAP_CROP_X, SEA_SWELL_SPACING, TILE_SIZE } from '@/game/config';
import { TileId } from '@/game/art/tiles';
import { buildMapTrack } from '@/game/maps/track';
import { drawSeaSwell, isSwellTile, swellCrestScreenYs, swellTileAt } from './seaSwell';

function screenYForRow(row: number): number {
  return LOGICAL_H - (row * TILE_SIZE + TILE_SIZE / 2);
}

describe('sea swell', () => {
  const layer = buildMapTrack('seaB').layers[0]!;

  it('spaces crests far apart and lets them slip against the scroll', () => {
    expect(SEA_SWELL_SPACING).toBeGreaterThanOrEqual(48);
    const still = swellCrestScreenYs(0, 0);
    expect(still.length).toBeGreaterThan(4);
    for (let i = 1; i < still.length; i++) {
      expect(still[i]! - still[i - 1]!).toBe(SEA_SWELL_SPACING);
    }
    const scrolled = swellCrestScreenYs(80, 0);
    const slip = Math.abs(scrolled[0]! - still[0]! - 80);
    expect(slip).toBeGreaterThan(20);
    expect(swellCrestScreenYs(0, 1)[0]).not.toBe(still[0]);
  });

  it('breaks crests on the deck and keeps them on open water', () => {
    expect(isSwellTile(TileId.ocean)).toBe(true);
    expect(isSwellTile(TileId.oceanB)).toBe(true);
    expect(isSwellTile(TileId.wake)).toBe(true);
    expect(isSwellTile(TileId.carrierDeck)).toBe(false);
    expect(isSwellTile(TileId.cruiserHull)).toBe(false);
    expect(isSwellTile(TileId.cruiserGunDeck)).toBe(false);
    expect(isSwellTile(TileId.enemyDeck)).toBe(false);
    const deckY = screenYForRow(10);
    expect(isSwellTile(swellTileAt(layer, 0, 11, deckY))).toBe(false);
    expect(isSwellTile(swellTileAt(layer, 0, 0, deckY))).toBe(true);
  });

  it('draws dashes only on swell tiles', () => {
    const rects: { x: number; y: number; w: number }[] = [];
    const ctx = {
      save: () => undefined,
      restore: () => undefined,
      fillRect: (x: number, y: number, w: number) => {
        rects.push({ x, y, w });
      },
    } as unknown as CanvasRenderingContext2D;
    drawSeaSwell(ctx, layer, 0, 1.5, 1);
    expect(rects.length).toBeGreaterThan(8);
    for (const rect of rects) {
      const col = Math.floor((rect.x + MAP_CROP_X) / TILE_SIZE);
      expect(isSwellTile(swellTileAt(layer, 0, col, rect.y)), `${col},${rect.y}`).toBe(true);
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
