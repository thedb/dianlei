/**
 * Terrain mask: every tile id is land, water, or a feature. Buildings, tanks,
 * and the map tests read terrain from here and never from tile ids directly.
 */

import { TILE_COUNT, TileId } from '@/game/art/tiles';
import type { Terrain, TileGrid } from './types';

const LAND: readonly TileId[] = [
  TileId.grass,
  TileId.grassDark,
  TileId.grassB,
  TileId.bush,
  TileId.tree,
  TileId.treePine,
  TileId.dirt,
  TileId.concrete,
  TileId.concreteDark,
  TileId.meadow,
  TileId.meadowB,
  TileId.meadowDark,
  TileId.flowers,
  TileId.reeds,
  TileId.plaza,
  TileId.cropGreen,
  TileId.cropWheat,
  TileId.cropPlowed,
  TileId.forest,
  TileId.oak,
  TileId.fir,
  TileId.scorch,
  TileId.crater,
  TileId.snag,
  TileId.harborMud,
  TileId.harborSlab,
];

const WATER: readonly TileId[] = [
  TileId.water,
  TileId.waterB,
  TileId.ocean,
  TileId.oceanB,
  TileId.shallow,
  TileId.lake,
  // Stage 4 gun pad: painted as metal, masked as water so a 2×2 gun can stand on it.
  TileId.cruiserGunDeck,
];

/** Terrain per tile id. Anything not listed as land or water is a feature. */
export const TILE_TERRAIN: readonly Terrain[] = Array.from({ length: TILE_COUNT }, (_, id) => {
  if (WATER.includes(id as TileId)) return 'water';
  if (LAND.includes(id as TileId)) return 'land';
  return 'feature';
});

export function tileTerrain(id: TileId): Terrain {
  return TILE_TERRAIN[id] ?? 'feature';
}

/** Terrain at a map cell, or null off the grid. */
export function terrainAt(grid: TileGrid, col: number, row: number): Terrain | null {
  const line = grid[row];
  if (!line || col < 0 || col >= line.length) return null;
  return tileTerrain(line[col]!);
}

/** Every cell of a `cols × rows` footprint (lowest row `row`, leftmost `col`) is `want`. */
export function footprintOn(
  grid: TileGrid,
  want: Terrain,
  row: number,
  col: number,
  rows: number,
  cols: number
): boolean {
  for (let r = row; r < row + rows; r++) {
    for (let c = col; c < col + cols; c++) {
      if (terrainAt(grid, c, r) !== want) return false;
    }
  }
  return true;
}
