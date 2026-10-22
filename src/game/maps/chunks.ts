/**
 * Chunk maps (P12). A chunk is one screen of tiles (`MAP_CHUNK_ROWS` × 23)
 * painted by code from a seeded generator. A chunk map is a library of chunk
 * kinds plus a slot list; the planner fills the slots deterministically from
 * the map seed, mirrors some chunks, and only joins chunks whose edges match.
 *
 * Edge contract, so roads and water run on across chunk joins. A stream side is
 * `none`, `left`, `right`, or `center`. Mirroring swaps left and right; center
 * stays. Column sets are per map: 陆地A uses 3-wide `STREAM_COLS` plus a
 * one-tile road at `ROAD_COL`; 陆地B uses a wider runway spine and no water;
 * 海面A uses its own 5-wide canal table and no road on the edge row.
 * Nothing else may touch row 0 or the last row with road or water.
 */

import { MAP_CHUNK_ROWS, MAP_TILES_X } from '@/game/config';
import { TileId, HOUSE_BROWN, HOUSE_RED } from '@/game/art/tiles';
import { createRng, type Rng } from '@/engine/rng';
import type { TileGrid } from './types';

export const ROAD_COL = Math.floor(MAP_TILES_X / 2);

export type StreamSide = 'none' | 'left' | 'right' | 'center';

/** Water columns for one side. Each map picks a table; both sides of a join must share it. */
export type EdgeColumns = Readonly<Record<Exclude<StreamSide, 'none'>, readonly number[]>>;

/**
 * 陆地A stream columns (3 tiles). `center` is the third slot; 陆地A itself
 * only uses left, right, and none. 海面A passes a wider table to `sealEdges`.
 */
export const STREAM_COLS: EdgeColumns = {
  left: [2, 3, 4],
  right: [MAP_TILES_X - 5, MAP_TILES_X - 4, MAP_TILES_X - 3],
  center: [ROAD_COL - 1, ROAD_COL, ROAD_COL + 1],
};

export interface ChunkDef {
  id: string;
  /** Stream crossing on the bottom (first) and top (last) row, before mirroring. */
  bottom: StreamSide;
  top: StreamSide;
  variants: number;
  paint(p: ChunkPainter, variant: number): void;
}

export interface ChunkInstance {
  chunk: string;
  variant: number;
  /** Mirrored left-right after painting. */
  flip: boolean;
  /** Seeds the painter: decor scatter, plot sizes, house colours. */
  seed: number;
}

export type ChunkSlot =
  { fixed: string; flip?: boolean; variant?: number } | { pick: readonly string[] };

export interface ChunkMapSpec {
  library: readonly ChunkDef[];
  slots: readonly ChunkSlot[];
  seed: number;
  /** A picked chunk kind appears at most this many times in the map. */
  maxRepeats: number;
}

export function mirrorSide(side: StreamSide): StreamSide {
  if (side === 'left') return 'right';
  if (side === 'right') return 'left';
  return side;
}

export function chunkEdges(def: ChunkDef, flip: boolean): { bottom: StreamSide; top: StreamSide } {
  return flip
    ? { bottom: mirrorSide(def.bottom), top: mirrorSide(def.top) }
    : { bottom: def.bottom, top: def.top };
}

function mixSeed(seed: number, index: number): number {
  let n = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b) >>> 0;
  return (n ^ (n >>> 13)) >>> 0;
}

function findChunk(library: readonly ChunkDef[], id: string): ChunkDef {
  const def = library.find((c) => c.id === id);
  if (!def) throw new Error(`unknown chunk ${id}`);
  return def;
}

/** Same seed, same plan. Throws if a fixed slot cannot join its neighbours. */
export function planChunks(spec: ChunkMapSpec): ChunkInstance[] {
  const rng = createRng(spec.seed);
  const plan: ChunkInstance[] = [];
  const uses = new Map<string, number>();
  let prevTop: StreamSide | null = null;
  let prevId = '';

  spec.slots.forEach((slot, index) => {
    const next = spec.slots[index + 1];
    const nextBottom =
      next && 'fixed' in next
        ? chunkEdges(findChunk(spec.library, next.fixed), next.flip ?? false).bottom
        : null;

    let chosen: { def: ChunkDef; flip: boolean; variant: number };
    if ('fixed' in slot) {
      const def = findChunk(spec.library, slot.fixed);
      const flip = slot.flip ?? false;
      const edges = chunkEdges(def, flip);
      if (prevTop !== null && edges.bottom !== prevTop) {
        throw new Error(`chunk ${index} (${def.id}) does not join the chunk below it`);
      }
      chosen = { def, flip, variant: slot.variant ?? Math.floor(rng() * def.variants) };
    } else {
      const options: Array<{ def: ChunkDef; flip: boolean }> = [];
      for (const id of slot.pick) {
        const def = findChunk(spec.library, id);
        if (def.id === prevId || (uses.get(def.id) ?? 0) >= spec.maxRepeats) continue;
        for (const flip of [false, true]) {
          const edges = chunkEdges(def, flip);
          if (prevTop !== null && edges.bottom !== prevTop) continue;
          if (nextBottom !== null && edges.top !== nextBottom) continue;
          options.push({ def, flip });
        }
      }
      if (options.length === 0) throw new Error(`no chunk fits slot ${index}`);
      const pick = options[Math.floor(rng() * options.length)]!;
      chosen = { ...pick, variant: Math.floor(rng() * pick.def.variants) };
    }

    uses.set(chosen.def.id, (uses.get(chosen.def.id) ?? 0) + 1);
    plan.push({
      chunk: chosen.def.id,
      variant: chosen.variant,
      flip: chosen.flip,
      seed: mixSeed(spec.seed, index),
    });
    prevTop = chunkEdges(chosen.def, chosen.flip).top;
    prevId = chosen.def.id;
  });
  return plan;
}

/** Tiles that are one quarter of a wider sprite swap with their mirror twin. */
const MIRROR = new Map<TileId, TileId>();
for (const [tl, tr, bl, br] of [HOUSE_RED, HOUSE_BROWN]) {
  MIRROR.set(tl, tr).set(tr, tl).set(bl, br).set(br, bl);
}

export function paintChunk(library: readonly ChunkDef[], inst: ChunkInstance): TileGrid {
  const def = findChunk(library, inst.chunk);
  const painter = new ChunkPainter(createRng(inst.seed));
  def.paint(painter, inst.variant);
  if (!inst.flip) return painter.grid;
  return painter.grid.map((row) => row.map((id) => MIRROR.get(id) ?? id).reverse());
}

/** Paint every planned chunk, bottom to top, into one map grid. */
export function composeChunks(spec: ChunkMapSpec, plan = planChunks(spec)): TileGrid {
  const grid: TileGrid = [];
  for (const inst of plan) grid.push(...paintChunk(spec.library, inst));
  return grid;
}

const ROADLIKE: ReadonlySet<TileId> = new Set<TileId>([
  TileId.road,
  TileId.street,
  TileId.bridge,
  TileId.runway,
  TileId.runwayMark,
]);
const WATERLIKE: ReadonlySet<TileId> = new Set<TileId>([
  TileId.lake,
  TileId.bridge,
  TileId.water,
  TileId.waterB,
  TileId.shallow,
]);

export function isRoadTile(id: TileId): boolean {
  return ROADLIKE.has(id);
}

/** Lake, bridge, or a legacy water tile. Bridge also counts as road. */
export function isStreamTile(id: TileId): boolean {
  return WATERLIKE.has(id);
}

/**
 * Stamp row 0 and the last row so they match this map's edge contract.
 * Water columns become lake. Spine columns become `spineId` unless they are
 * water. Any other road or water tile on those rows becomes meadow.
 * Call at the end of `paint`, before the chunk is mirrored.
 */
export function sealEdges(
  p: ChunkPainter,
  bottom: StreamSide,
  top: StreamSide,
  spine: readonly number[],
  spineId: TileId = TileId.road,
  channels: EdgeColumns = STREAM_COLS
): void {
  const spineSet = new Set<number>(spine);
  const apply = (row: number, side: StreamSide) => {
    const water = new Set<number>(side === 'none' ? [] : channels[side]);
    for (let c = 0; c < p.cols; c++) {
      if (water.has(c)) {
        p.set(c, row, TileId.lake);
        continue;
      }
      if (spineSet.has(c)) {
        p.set(c, row, spineId);
        continue;
      }
      const id = p.get(c, row);
      if (id !== null && (isRoadTile(id) || isStreamTile(id))) p.set(c, row, TileId.meadow);
    }
  };
  apply(0, bottom);
  apply(p.rows - 1, top);
}

/** Columns of one row holding road (or bridge) tiles, and those holding water. */
export function rowConnectors(row: readonly TileId[]): { road: number[]; water: number[] } {
  const road: number[] = [];
  const water: number[] = [];
  row.forEach((id, col) => {
    if (ROADLIKE.has(id)) road.push(col);
    if (WATERLIKE.has(id)) water.push(col);
  });
  return { road, water };
}

/** Ground variety for open meadow cells. */
const MEADOW_MIX: readonly TileId[] = [
  TileId.meadow,
  TileId.meadow,
  TileId.meadow,
  TileId.meadowB,
  TileId.meadowB,
  TileId.meadow,
  TileId.flowers,
  TileId.meadowB,
];

const OPEN: ReadonlySet<TileId> = new Set<TileId>([
  TileId.meadow,
  TileId.meadowB,
  TileId.meadowDark,
  TileId.flowers,
]);

export type HouseColor = 'red' | 'brown';

/** Drawing helpers for chunk authors. Rows grow toward the top of the screen. */
export class ChunkPainter {
  readonly rows = MAP_CHUNK_ROWS;
  readonly cols = MAP_TILES_X;
  readonly grid: TileGrid;

  constructor(readonly rng: Rng) {
    this.grid = [];
    for (let r = 0; r < this.rows; r++) {
      const row: TileId[] = [];
      for (let c = 0; c < this.cols; c++) row.push(TileId.meadow);
      this.grid.push(row);
    }
  }

  int(lo: number, hi: number): number {
    return lo + Math.floor(this.rng() * (hi - lo + 1));
  }

  chance(p: number): boolean {
    return this.rng() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.rng() * items.length)]!;
  }

  get(c: number, r: number): TileId | null {
    return this.grid[r]?.[c] ?? null;
  }

  set(c: number, r: number, id: TileId): void {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return;
    this.grid[r]![c] = id;
  }

  isOpen(c: number, r: number): boolean {
    const id = this.get(c, r);
    return id !== null && OPEN.has(id);
  }

  rect(c: number, r: number, w: number, h: number, id: TileId): void {
    for (let rr = r; rr < r + h; rr++) for (let cc = c; cc < c + w; cc++) this.set(cc, rr, id);
  }

  /** Open meadow with grass variety and a few flower patches. */
  meadow(): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) this.set(c, r, this.pick(MEADOW_MIX));
    }
  }

  /**
   * Rough ellipse. `rough` jitters the rim (0 = clean). `onlyOpen` keeps
   * roads, water, and buildings already painted.
   */
  blob(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    id: TileId | (() => TileId),
    rough = 0.25,
    onlyOpen = false
  ): void {
    for (let r = Math.floor(cy - ry - 1); r <= Math.ceil(cy + ry + 1); r++) {
      for (let c = Math.floor(cx - rx - 1); c <= Math.ceil(cx + rx + 1); c++) {
        const dx = (c - cx) / rx;
        const dy = (r - cy) / ry;
        const edge = 1 + (this.rng() - 0.5) * 2 * rough;
        if (dx * dx + dy * dy > edge) continue;
        if (onlyOpen && !this.isOpen(c, r)) continue;
        this.set(c, r, typeof id === 'function' ? id() : id);
      }
    }
  }

  /** Vertical road from row 0 to the top, one column per row; steps get a horizontal join. */
  roadPath(
    colAt: (row: number) => number,
    idAt: (row: number) => TileId = () => TileId.road
  ): void {
    let prev = colAt(0);
    for (let r = 0; r < this.rows; r++) {
      const col = colAt(r);
      const id = idAt(r);
      const a = Math.min(prev, col);
      const b = Math.max(prev, col);
      for (let c = a; c <= b; c++) this.set(c, r, id);
      prev = col;
    }
  }

  /** The main road: enters and leaves at `ROAD_COL`, sways up to `amp` columns between. */
  mainRoad(amp: number, idAt?: (row: number) => TileId): (row: number) => number {
    const phase = this.rng() * Math.PI * 2;
    const freq = 0.12 + this.rng() * 0.08;
    const colAt = (r: number): number => {
      const envelope = Math.sin((Math.PI * r) / (this.rows - 1));
      return ROAD_COL + Math.round(amp * envelope * Math.sin(phase + r * freq));
    };
    this.roadPath(colAt, idAt);
    return colAt;
  }

  /** Horizontal road along `row` from `c0` to `c1` (inclusive). */
  hRoad(row: number, c0: number, c1: number, id: TileId = TileId.road): void {
    for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) this.set(c, row, id);
  }

  /** Stream of `STREAM_COLS` width; `centerAt` gives its middle column per row. */
  stream(r0: number, r1: number, centerAt: (row: number) => number): void {
    for (let r = r0; r <= r1; r++) {
      const c = centerAt(r);
      for (let dc = -1; dc <= 1; dc++) this.set(c + dc, r, TileId.lake);
    }
  }

  /** 2×2 house with its lowest row at `r` and left column at `c`. */
  house(c: number, r: number, color: HouseColor): void {
    const [tl, tr, bl, br] = color === 'red' ? HOUSE_RED : HOUSE_BROWN;
    this.set(c, r, bl);
    this.set(c + 1, r, br);
    this.set(c, r + 1, tl);
    this.set(c + 1, r + 1, tr);
  }

  /** Free 2×2 meadow block? */
  open2x2(c: number, r: number): boolean {
    return (
      this.isOpen(c, r) &&
      this.isOpen(c + 1, r) &&
      this.isOpen(c, r + 1) &&
      this.isOpen(c + 1, r + 1)
    );
  }

  /** Scatter single tiles over open meadow. */
  scatter(count: number, ids: readonly TileId[], where?: (c: number, r: number) => boolean): void {
    for (let i = 0; i < count; i++) {
      const c = this.int(0, this.cols - 1);
      const r = this.int(1, this.rows - 2);
      if (!this.isOpen(c, r)) continue;
      if (where && !where(c, r)) continue;
      this.set(c, r, this.pick(ids));
    }
  }

  /** Reeds on open cells touching water. */
  reedBanks(chance: number): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.isOpen(c, r)) continue;
        const wet =
          this.get(c - 1, r) === TileId.lake ||
          this.get(c + 1, r) === TileId.lake ||
          this.get(c, r - 1) === TileId.lake ||
          this.get(c, r + 1) === TileId.lake;
        if (wet && this.chance(chance)) this.set(c, r, TileId.reeds);
      }
    }
  }
}
