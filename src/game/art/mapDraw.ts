/**
 * Background drawing for a track: baked map chunks, cloud shadows, the
 * warning cloud band, and the starfield with its planet layer.
 *
 * Memory stays bounded on mobile: a map is never baked whole. Each chunk
 * (`MAP_CHUNK_ROWS` tile rows, one screen) is baked once into a 368×640
 * canvas and kept in a small LRU (`MAP_CHUNK_CACHE`). A frame blits the two
 * chunks on screen and bakes a few rows of the next one ahead of time
 * (`MAP_PREFETCH_ROWS_PER_FRAME`), so no single frame pays for a whole chunk.
 * Cloud stamps and planets are baked once too (`clouds.ts`, `planets.ts`).
 */

import {
  LOGICAL_H,
  LOGICAL_W,
  MAP_CHUNK_CACHE,
  MAP_CHUNK_ROWS,
  MAP_CROP_X,
  MAP_PREFETCH_ROWS_PER_FRAME,
  TILE_SIZE,
} from '@/game/config';
import { PALETTE } from '@/game/palette';
import { backdropSegments, type BackgroundTrack, type TrackLayer } from '@/game/maps/track';
import type { ScrollFrame } from '@/game/systems/background';
import { createCloudSheet, drawCloudShadows, drawSkyClouds, type CloudSheet } from './clouds';
import {
  createStripJob,
  finishStripJob,
  stepStripJob,
  type StripJob,
  type StripPixels,
} from './mapRaster';
import { createPlanetLayer, drawPlanets, type BakedPlanet } from './planets';
import { buildStars, type Star } from './tiles';

export type MapCanvas = OffscreenCanvas | HTMLCanvasElement;

const CHUNK_PX = MAP_CHUNK_ROWS * TILE_SIZE;

function createCanvas(width: number, height: number): MapCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

const RGB = PALETTE.map((hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
});

function toCanvas(strip: StripPixels, make: (w: number, h: number) => MapCanvas): MapCanvas {
  const canvas = make(strip.width, strip.height);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
  if (!ctx) throw new Error('Failed to get 2D context for map chunk');
  const image = ctx.createImageData(strip.width, strip.height);
  const px = image.data;
  for (let i = 0; i < strip.data.length; i++) {
    const rgb = RGB[strip.data[i]!]!;
    const o = i * 4;
    px[o] = rgb[0];
    px[o + 1] = rgb[1];
    px[o + 2] = rgb[2];
    px[o + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function chunkCount(layer: TrackLayer): number {
  return Math.ceil(layer.grid.length / MAP_CHUNK_ROWS);
}

function chunkRows(layer: TrackLayer, index: number): number {
  return Math.min(MAP_CHUNK_ROWS, layer.grid.length - index * MAP_CHUNK_ROWS);
}

/** LRU of baked chunk canvases, keyed `<mapId>:<chunk>`. */
export class ChunkCache {
  private readonly entries = new Map<string, MapCanvas>();
  private job: { key: string; job: StripJob } | null = null;
  /** Chunks baked so far (sync or prefetched). */
  bakes = 0;

  constructor(
    readonly capacity: number = MAP_CHUNK_CACHE,
    private readonly make: (w: number, h: number) => MapCanvas = createCanvas
  ) {}

  size(): number {
    return this.entries.size;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  private store(key: string, canvas: MapCanvas): MapCanvas {
    this.entries.delete(key);
    this.entries.set(key, canvas);
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
    }
    this.bakes++;
    return canvas;
  }

  /** The chunk's canvas, baked now if it is not cached. */
  get(layer: TrackLayer, index: number): MapCanvas {
    const key = `${layer.map.id}:${index}`;
    const hit = this.entries.get(key);
    if (hit) {
      this.entries.delete(key);
      this.entries.set(key, hit);
      return hit;
    }
    const job =
      this.job?.key === key
        ? this.job.job
        : createStripJob(layer.grid, index * MAP_CHUNK_ROWS, chunkRows(layer, index));
    if (this.job?.key === key) this.job = null;
    return this.store(key, toCanvas(finishStripJob(job), this.make));
  }

  /** Bake a few more rows of a chunk that is about to scroll on. */
  prefetch(layer: TrackLayer, index: number, tileRows = MAP_PREFETCH_ROWS_PER_FRAME): void {
    if (index < 0 || index >= chunkCount(layer)) return;
    const key = `${layer.map.id}:${index}`;
    if (this.entries.has(key)) return;
    if (this.job?.key !== key) {
      this.job = {
        key,
        job: createStripJob(layer.grid, index * MAP_CHUNK_ROWS, chunkRows(layer, index)),
      };
    }
    if (stepStripJob(this.job.job, tileRows)) {
      const done = this.job.job;
      this.job = null;
      this.store(key, toCanvas(finishStripJob(done), this.make));
    }
  }
}

export interface BackgroundArt {
  chunks: ChunkCache;
  stars: Star[];
  clouds: CloudSheet;
  planets: BakedPlanet[];
}

export function createBackgroundArt(): BackgroundArt {
  return {
    chunks: new ChunkCache(),
    stars: buildStars(),
    clouds: createCloudSheet(),
    planets: createPlanetLayer(),
  };
}

/** Chunks on screen for a layer-local scroll: `[first, last]`, clipped to the map. */
export function visibleChunks(layer: TrackLayer, localScroll: number): [number, number] {
  const first = Math.floor(localScroll / CHUNK_PX);
  const last = Math.floor((localScroll + LOGICAL_H - 1) / CHUNK_PX);
  return [Math.max(0, first), Math.min(chunkCount(layer) - 1, last)];
}

function blitSegment(
  ctx: CanvasRenderingContext2D,
  art: BackgroundArt,
  layer: TrackLayer,
  local: number,
  y0: number,
  y1: number,
  alpha: number
): void {
  const first = Math.max(0, Math.floor(y0 / CHUNK_PX));
  const last = Math.min(chunkCount(layer) - 1, Math.floor((y1 - 1) / CHUNK_PX));
  if (last < first) return;
  const top = local + LOGICAL_H - y1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-MAP_CROP_X, top, LOGICAL_W + MAP_CROP_X * 2, y1 - y0);
  ctx.clip();
  ctx.globalAlpha = alpha;
  for (let k = first; k <= last; k++) {
    const canvas = art.chunks.get(layer, k);
    const dy = local + LOGICAL_H - k * CHUNK_PX - canvas.height;
    ctx.drawImage(canvas, -MAP_CROP_X, dy);
  }
  ctx.restore();
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  art: BackgroundArt,
  layer: TrackLayer,
  scroll: number,
  alpha: number,
  prefetch: boolean
): void {
  // Negative local keeps the layer above the view so its first row enters
  // from the top. Clamping to 0 would pop the whole first screen on.
  const local = Math.floor(scroll - layer.origin);
  const mapPx = layer.grid.length * TILE_SIZE;
  const loopPx = layer.loopFrom === null ? null : layer.loopFrom * TILE_SIZE;
  const segs = backdropSegments(local, mapPx, loopPx, LOGICAL_H);
  for (const seg of segs) {
    blitSegment(ctx, art, layer, seg.local, seg.y0, seg.y1, alpha);
  }
  if (prefetch) {
    const top = segs[segs.length - 1];
    if (top) {
      const next = Math.floor(top.y1 / CHUNK_PX);
      const index =
        next >= chunkCount(layer) && loopPx !== null ? Math.floor(loopPx / CHUNK_PX) : next;
      art.chunks.prefetch(layer, index);
    } else if (local < 0) {
      art.chunks.prefetch(layer, 0);
    }
  }
}

/**
 * Draw the track's map layers, then clouds and stars when the fade asks for
 * them. `frame.scroll` is the world scroll in pixels.
 */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  art: BackgroundArt,
  track: BackgroundTrack,
  frame: ScrollFrame,
  time: number
): void {
  const { fade } = frame;
  let shadowAlpha = 0;
  track.layers.forEach((layer, i) => {
    const alpha = fade.layers[i] ?? 0;
    if (alpha <= 0.01) return;
    drawLayer(ctx, art, layer, frame.scroll, alpha, alpha > 0.2);
    if (layer.map.cloudShadows) shadowAlpha = Math.max(shadowAlpha, alpha);
  });
  // One shadow pass. Drawing it per layer stacks the stamps into a dark blob
  // wherever two maps overlap on the boss join.
  if (shadowAlpha > 0.01) drawCloudShadows(ctx, art.clouds, frame.scroll, shadowAlpha);

  if (fade.clouds > 0.01) drawSkyClouds(ctx, art.clouds, time, fade.clouds);

  if (fade.stars > 0.01) {
    ctx.globalAlpha = fade.stars;
    drawPlanets(ctx, art.planets, frame.starScroll[0]);
    for (const star of art.stars) {
      const speedScroll = frame.starScroll[star.layer];
      const y = (star.y + speedScroll) % (LOGICAL_H + 40);
      const size = star.layer === 2 ? 2 : 1;
      ctx.fillStyle = star.layer === 0 ? 'rgba(180, 190, 210, 0.7)' : 'rgba(245, 248, 255, 0.95)';
      ctx.fillRect(Math.floor(star.x), Math.floor(y), size, size);
    }
  }

  ctx.globalAlpha = 1;
}
