/**
 * Background drawing for a track: baked map chunks, cloud shadows, the
 * warning cloud band, and the starfield.
 *
 * Memory stays bounded on mobile: a map is never baked whole. Each chunk
 * (`MAP_CHUNK_ROWS` tile rows, one screen) is baked once into a 368×640
 * canvas and kept in a small LRU (`MAP_CHUNK_CACHE`). A frame blits the two
 * chunks on screen and bakes a few rows of the next one ahead of time
 * (`MAP_PREFETCH_ROWS_PER_FRAME`), so no single frame pays for a whole chunk.
 */

import {
  CLOUD_SHADOW_ALPHA,
  CLOUD_SHADOW_SCROLL,
  LOGICAL_H,
  MAP_CHUNK_CACHE,
  MAP_CHUNK_ROWS,
  MAP_CROP_X,
  MAP_PREFETCH_ROWS_PER_FRAME,
  TILE_SIZE,
} from '@/game/config';
import { PALETTE } from '@/game/palette';
import type { BackgroundTrack, TrackLayer } from '@/game/maps/track';
import type { ScrollFrame } from '@/game/systems/background';
import {
  createStripJob,
  finishStripJob,
  stepStripJob,
  type StripJob,
  type StripPixels,
} from './mapRaster';
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
}

export function createBackgroundArt(): BackgroundArt {
  return { chunks: new ChunkCache(), stars: buildStars() };
}

/** Chunks on screen for a layer-local scroll: `[first, last]`, clipped to the map. */
export function visibleChunks(layer: TrackLayer, localScroll: number): [number, number] {
  const first = Math.floor(localScroll / CHUNK_PX);
  const last = Math.floor((localScroll + LOGICAL_H - 1) / CHUNK_PX);
  return [Math.max(0, first), Math.min(chunkCount(layer) - 1, last)];
}

interface Cloud {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

const CLOUDS: readonly Cloud[] = [
  { x: 50, y: 40, rx: 78, ry: 16 },
  { x: 180, y: 120, rx: 96, ry: 18 },
  { x: 300, y: 70, rx: 70, ry: 14 },
  { x: 120, y: 220, rx: 110, ry: 20 },
  { x: 250, y: 300, rx: 80, ry: 15 },
  { x: 40, y: 380, rx: 90, ry: 16 },
  { x: 200, y: 460, rx: 120, ry: 18 },
  { x: 320, y: 520, rx: 64, ry: 14 },
];

const CLOUD_SHADOWS: readonly Cloud[] = [
  { x: 70, y: 0, rx: 92, ry: 54 },
  { x: 290, y: 380, rx: 110, ry: 62 },
  { x: 170, y: 720, rx: 80, ry: 46 },
];
const CLOUD_SHADOW_SPAN = LOGICAL_H + 480;

function drawLayer(
  ctx: CanvasRenderingContext2D,
  art: BackgroundArt,
  layer: TrackLayer,
  scroll: number,
  alpha: number,
  prefetch: boolean
): void {
  const local = Math.max(0, Math.floor(scroll - layer.origin));
  const [first, last] = visibleChunks(layer, local);
  ctx.globalAlpha = alpha;
  for (let k = first; k <= last; k++) {
    const canvas = art.chunks.get(layer, k);
    const dy = local + LOGICAL_H - k * CHUNK_PX - canvas.height;
    ctx.drawImage(canvas, -MAP_CROP_X, dy);
  }
  if (prefetch) art.chunks.prefetch(layer, last + 1);

  if (layer.map.cloudShadows) {
    ctx.globalAlpha = alpha * CLOUD_SHADOW_ALPHA;
    ctx.fillStyle = PALETTE[1];
    const drift = scroll * CLOUD_SHADOW_SCROLL;
    for (const c of CLOUD_SHADOWS) {
      const y = ((c.y + drift) % CLOUD_SHADOW_SPAN) - 240;
      ctx.beginPath();
      ctx.ellipse(c.x, y, c.rx, c.ry, 0, 0, Math.PI * 2);
      ctx.fill();
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
  track.layers.forEach((layer, i) => {
    const alpha = fade.layers[i] ?? 0;
    if (alpha <= 0.01) return;
    drawLayer(ctx, art, layer, frame.scroll, alpha, alpha >= 0.99);
  });

  if (fade.clouds > 0.01) {
    const drift = time * 70;
    ctx.globalAlpha = fade.clouds * 0.85;
    ctx.fillStyle = 'rgba(210, 220, 230, 0.9)';
    for (const cloud of CLOUDS) {
      const y = ((cloud.y + drift) % (LOGICAL_H + 80)) - 40;
      ctx.beginPath();
      ctx.ellipse(cloud.x, y, cloud.rx, cloud.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (fade.stars > 0.01) {
    ctx.globalAlpha = fade.stars;
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
