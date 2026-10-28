import { describe, expect, it } from 'vitest';
import {
  LOGICAL_H,
  MAP_CHUNK_ROWS,
  MAP_TILES_X,
  OBSIDIAN_BOSS_SEED,
  OBSIDIAN_ENTER_AT,
  SEA_B_CHUNKS,
  STAGE4_WARNING_AT,
  TILE_SIZE,
} from '@/game/config';
import { TileId } from '@/game/art/tiles';
import { rasterStrip } from '@/game/art/mapRaster';
import { PALETTE } from '@/game/palette';
import { getStage } from '@/game/levels/registry';
import { backgroundFade, scrollDistance } from '@/game/systems/background';
import { composeChunks, planChunks } from './chunks';
import {
  OBSIDIAN_BOSS_LIBRARY,
  OBSIDIAN_BOSS_LOOP_ROW,
  OBSIDIAN_BOSS_SPEC,
  OBSIDIAN_SPOTS,
  obsidianDeckSeam,
} from './obsidianBoss';
import { getMapGrid, getTileMap } from './registry';
import { seaBTopRow } from './seaB';
import { buildMapTrack, buildStageTrack } from './track';

type Grid = readonly (readonly TileId[])[];

const ALLOWED: ReadonlySet<TileId> = new Set([
  TileId.ocean,
  TileId.oceanB,
  TileId.enemyDeck,
  TileId.enemyMark,
  TileId.deckSpot,
  TileId.carrierIsland,
  TileId.wreckAlloy,
  TileId.wreckBurn,
]);

function luminance(index: number): number {
  const hex = PALETTE[index]!;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function meanLum(grid: Grid, r0: number, rows: number): number {
  const strip = rasterStrip(grid, r0, rows);
  let lum = 0;
  for (const v of strip.data) lum += luminance(v);
  return lum / strip.data.length;
}

describe('黑曜舰空', () => {
  const grid = getMapGrid('obsidianBoss');
  const loop = OBSIDIAN_BOSS_LOOP_ROW;
  const sea = getMapGrid('seaB');

  it('is one approach and a looping enemy deck, seed 43, no mirror', () => {
    expect(OBSIDIAN_BOSS_LIBRARY.map((chunk) => chunk.id)).toEqual(['approach', 'deckLoop']);
    expect(planChunks(OBSIDIAN_BOSS_SPEC).map((slot) => slot.chunk)).toEqual([
      'approach',
      'deckLoop',
    ]);
    expect(planChunks(OBSIDIAN_BOSS_SPEC).some((slot) => slot.flip)).toBe(false);
    expect(OBSIDIAN_BOSS_SPEC.seed).toBe(OBSIDIAN_BOSS_SEED);
    expect(loop).toBe(MAP_CHUNK_ROWS);
    expect(grid).toHaveLength(MAP_CHUNK_ROWS * 2);
    expect(getTileMap('obsidianBoss').loopFrom).toBe(loop);
    expect(getTileMap('obsidianBoss').cloudShadows).toBe(true);
    expect(getTileMap('obsidianBoss').label).toBe('黑曜舰空');
    expect(composeChunks(OBSIDIAN_BOSS_SPEC)).toEqual(grid);
  });

  it('stitches row 0 to 海面B and keeps the enemy-deck seam', () => {
    expect(grid[0]).toEqual(sea[sea.length - 1]);
    expect(seaBTopRow()).toEqual(sea[sea.length - 1]);
    const seam = obsidianDeckSeam();
    expect(seam.filter((id) => id === TileId.enemyDeck)).toHaveLength(19);
    expect(seam[0]).toBe(TileId.ocean);
    expect(seam[1]).toBe(TileId.ocean);
    expect(seam[21]).toBe(TileId.ocean);
    expect(seam[22]).toBe(TileId.ocean);
    expect(grid[loop - 1]).toEqual(seam);
    expect(grid[loop]).toEqual(seam);
    expect(grid[grid.length - 1]).toEqual(seam);
  });

  it('is an empty enemy deck, island on the port side, not our concrete deck', () => {
    grid.forEach((row, r) => {
      row.forEach((id, c) => {
        expect(ALLOWED.has(id), `${id} at ${c},${r}`).toBe(true);
        if (id === TileId.carrierIsland) expect(c).toBeLessThanOrEqual(6);
      });
    });
    expect(grid.some((row) => row.includes(TileId.carrierDeck))).toBe(false);
    expect(grid.some((row) => row.includes(TileId.carrierMark))).toBe(false);
    expect(grid.some((row) => row.includes(TileId.carrierPlaneTL))).toBe(false);
    const floor = grid.slice(loop);
    let spots = 0;
    floor.forEach((row, local) => {
      row.forEach((id, c) => {
        if (id !== TileId.deckSpot) return;
        spots++;
        expect(OBSIDIAN_SPOTS.some(([col, r]) => col === c && r === local)).toBe(true);
      });
    });
    expect(spots).toBe(8);
    expect(OBSIDIAN_SPOTS).toHaveLength(8);
    const island = floor.some((row) => row.slice(3, 7).includes(TileId.carrierIsland));
    expect(island).toBe(true);
  });

  it('stays bright against the sea it stitches from', () => {
    const approach = meanLum(grid, 0, loop);
    const deck = meanLum(grid, loop, grid.length - loop);
    const tail = meanLum(sea, sea.length - MAP_CHUNK_ROWS, MAP_CHUNK_ROWS);
    const opening = meanLum(sea, 0, MAP_CHUNK_ROWS);
    expect(approach).toBeGreaterThanOrEqual(tail * 0.85);
    expect(deck).toBeGreaterThanOrEqual(opening * 0.85);
  });

  it('hands off from 海面B with opaque tiles and no warning clouds', () => {
    const stage = getStage('4');
    const track = buildStageTrack(stage);
    expect(track.handoff).toBe('tiles');
    expect(track.layers.map((layer) => layer.map.id)).toEqual(['seaB', 'obsidianBoss']);
    const origin = SEA_B_CHUNKS * MAP_CHUNK_ROWS * TILE_SIZE;
    expect(track.layers[1]!.origin).toBe(origin);
    expect(origin).toBe(5760);
    expect(STAGE4_WARNING_AT * 40 + LOGICAL_H).toBeLessThan(origin);
    const scroll = scrollDistance(OBSIDIAN_ENTER_AT, STAGE4_WARNING_AT, 'tiles');
    expect(scroll - origin).toBeCloseTo(120, 0);
    const fade = backgroundFade(STAGE4_WARNING_AT + 1, track);
    expect(fade.clouds).toBe(0);
    expect(fade.stars).toBe(0);
  });

  it('previews the run for 128s and the arena for 32s', () => {
    expect(buildMapTrack('seaB').endAt).toBeCloseTo((5760 - LOGICAL_H) / 40, 5);
    expect(buildMapTrack('obsidianBoss').endAt).toBeCloseTo(32, 5);
    expect(MAP_TILES_X).toBe(23);
  });
});
