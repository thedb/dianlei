import { describe, expect, it } from 'vitest';
import { LOGICAL_H, MAP_CHUNK_CACHE, MAP_CHUNK_ROWS, MAP_TILES_X, TILE_SIZE } from '@/game/config';
import { COLOR, PALETTE } from '@/game/palette';
import { buildMapTrack, getMapGrid } from '@/game/maps';
import { getTilePixels, getTileTallMasks, TileId } from './tiles';
import { createStripJob, finishStripJob, rasterStrip, SHADE, stepStripJob } from './mapRaster';
import { ChunkCache, chunkCount, visibleChunks, type MapCanvas } from './mapDraw';

const WIDTH = MAP_TILES_X * TILE_SIZE;
const BULLET_COLORS = new Set<number>([
  COLOR.BULLET_MAGENTA,
  COLOR.BULLET_PINK,
  COLOR.BULLET_DARK,
  COLOR.BULLET_CORE,
]);

describe('tile pixels', () => {
  it('paints every tile 16×16 in palette indices, never in bullet colours', () => {
    for (const tile of getTilePixels()) {
      expect(tile).toHaveLength(TILE_SIZE);
      for (const row of tile) {
        expect(row).toHaveLength(TILE_SIZE);
        for (const cell of row) {
          expect(cell).toBeGreaterThanOrEqual(0);
          expect(cell).toBeLessThan(PALETTE.length);
          expect(BULLET_COLORS.has(cell)).toBe(false);
        }
      }
    }
  });

  it('casts shadows only from the new land overlays', () => {
    const tall = getTileTallMasks();
    for (let id = 0; id < TileId.meadow; id++) expect(tall[id], `tile ${id}`).toBeNull();
    for (const id of [TileId.oak, TileId.fir, TileId.boulder, TileId.houseRedTL]) {
      expect(tall[id]?.some((row) => row.some(Boolean))).toBe(true);
    }
  });

  it('maps every palette entry to a shade on the same palette', () => {
    expect(SHADE).toHaveLength(PALETTE.length);
    for (const s of SHADE) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(PALETTE.length);
    }
  });
});

describe('map raster', () => {
  it('bakes a 陆地A chunk to one screen of palette pixels', () => {
    const strip = rasterStrip(getMapGrid('landA'), 0, MAP_CHUNK_ROWS);
    expect(strip.width).toBe(WIDTH);
    expect(strip.height).toBe(LOGICAL_H);
    expect(strip.data).toHaveLength(WIDTH * LOGICAL_H);
    const used = new Set(strip.data);
    for (const c of used) {
      expect(c).toBeLessThan(PALETTE.length);
      expect(BULLET_COLORS.has(c)).toBe(false);
    }
    expect(used.size).toBeGreaterThan(8);
  });

  it('copies legacy tile ids pixel for pixel', () => {
    const legacy = [
      TileId.grass,
      TileId.water,
      TileId.runway,
      TileId.hangar,
      TileId.wall,
      TileId.dock,
    ];
    const grid = Array.from({ length: MAP_CHUNK_ROWS + 2 }, (_, r) =>
      Array.from({ length: MAP_TILES_X }, (_, c) => legacy[(r + c) % legacy.length]!)
    );
    const strip = rasterStrip(grid, 1, MAP_CHUNK_ROWS);
    const tiles = getTilePixels();
    for (let r = 0; r < MAP_CHUNK_ROWS; r++) {
      const mapRow = 1 + r;
      const top = (MAP_CHUNK_ROWS - 1 - r) * TILE_SIZE;
      for (let c = 0; c < MAP_TILES_X; c++) {
        const tile = tiles[grid[mapRow]![c]!]!;
        for (let y = 0; y < TILE_SIZE; y += 4) {
          for (let x = 0; x < TILE_SIZE; x += 4) {
            expect(strip.data[(top + y) * WIDTH + c * TILE_SIZE + x]).toBe(tile[y]![x]);
          }
        }
      }
    }
  });

  it('gives the same pixels whether baked at once or a few rows per frame', () => {
    const grid = getMapGrid('landA');
    const whole = rasterStrip(grid, 80, MAP_CHUNK_ROWS);
    const job = createStripJob(grid, 80, MAP_CHUNK_ROWS);
    let frames = 0;
    while (!stepStripJob(job, 4)) frames++;
    expect(frames).toBeGreaterThan(5);
    expect(finishStripJob(job).data).toEqual(whole.data);
  });

  it('joins chunk strips into the same picture as one tall strip', () => {
    const grid = getMapGrid('landA');
    const tall = rasterStrip(grid, 0, MAP_CHUNK_ROWS * 2);
    const lower = rasterStrip(grid, 0, MAP_CHUNK_ROWS);
    const upper = rasterStrip(grid, MAP_CHUNK_ROWS, MAP_CHUNK_ROWS);
    expect(tall.data.subarray(0, upper.data.length)).toEqual(upper.data);
    expect(tall.data.subarray(upper.data.length)).toEqual(lower.data);
  });
});

function fakeCanvas(width: number, height: number): MapCanvas {
  const ctx = {
    createImageData: (w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    }),
    putImageData: () => undefined,
  };
  return { width, height, getContext: () => ctx } as unknown as MapCanvas;
}

describe('chunk cache', () => {
  const layer = buildMapTrack('landA').layers[0]!;

  it('keeps at most MAP_CHUNK_CACHE chunks and evicts the least recently used', () => {
    expect(MAP_CHUNK_CACHE).toBeLessThanOrEqual(4);
    const cache = new ChunkCache(3, fakeCanvas);
    const c0 = cache.get(layer, 0);
    expect(c0.width).toBe(WIDTH);
    expect(c0.height).toBe(LOGICAL_H);
    cache.get(layer, 1);
    cache.get(layer, 2);
    expect(cache.get(layer, 0)).toBe(c0);
    cache.get(layer, 3);
    expect(cache.size()).toBe(3);
    expect(cache.has('landA:0')).toBe(true);
    expect(cache.has('landA:1')).toBe(false);
    expect(cache.bakes).toBe(4);
  });

  it('prefetches a chunk over several frames and then hits without baking', () => {
    const cache = new ChunkCache(4, fakeCanvas);
    let frames = 0;
    while (!cache.has('landA:2')) {
      cache.prefetch(layer, 2);
      frames++;
    }
    expect(frames).toBe(Math.ceil((MAP_CHUNK_ROWS + 1) / 4));
    expect(cache.bakes).toBe(1);
    cache.get(layer, 2);
    expect(cache.bakes).toBe(1);
    cache.prefetch(layer, chunkCount(layer));
    expect(cache.bakes).toBe(1);
  });

  it('draws at most two chunks for a screen', () => {
    for (const local of [0, 1, 320, 639, 640, 641, 3000]) {
      const [first, last] = visibleChunks(layer, local);
      expect(last - first + 1).toBeLessThanOrEqual(2);
      expect(first).toBe(Math.floor(local / LOGICAL_H));
    }
  });
});
