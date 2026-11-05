/**
 * Entity assembly files (`*.entity.json`).
 *
 * A stage is a list of parts. Each part places one locked palette grid
 * (`gridFile.ts`) by an integer pivot. The blit matches `drawPartSprite`:
 * angle 0 is the straight floored blit; any other angle translates to the
 * pivot and rotates (canvas y-down, positive clockwise). `flipX` mirrors the
 * grid in pixel indices before that blit. There is no vertical flip.
 *
 * `hit`, when present, is an axis-aligned box in unflipped sprite pixels.
 * The live fight still uses its own hit circles until a boss is switched
 * onto this file. Reference PNGs are not stored here.
 *
 * `sampleAssemblyEntity` is the editor smoke fixture (folded / half / open).
 * It is not the live Obsidian boss.
 */

import { COLOR } from '@/game/palette';
import {
  parsePaletteGrid,
  serializePaletteGrid,
  spriteToGrid,
  type PaletteGridFile,
} from './gridFile';
import type { SpriteData } from './types';

export const ENTITY_FORMAT = 'dianlei.entity';
export const ENTITY_FORMAT_VERSION = 1;
export const ENTITY_FILE_EXTENSION = '.entity.json';

export const ENTITY_MAX_GRIDS = 32;
export const ENTITY_MAX_STAGES = 16;
export const ENTITY_MAX_PARTS = 32;

/** Inclusive integer range for a part's entity-space origin. */
export const ENTITY_POS_MIN = -4096;
export const ENTITY_POS_MAX = 4096;

/** Inclusive layer range. Lower layers draw further back. */
export const ENTITY_LAYER_MIN = -999;
export const ENTITY_LAYER_MAX = 999;

/** Inclusive radian range (about ten turns either way). */
export const ENTITY_ANGLE_MAX = 64;

/** Inclusive range for a hit-box edge, in sprite pixels. Width and height are at least 1. */
export const ENTITY_HIT_MIN = -1024;
export const ENTITY_HIT_MAX = 1024;

const NAME_MAX = 128;

/** Letters, digits, underscore, hyphen. 1–32 characters. */
const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

export function isEntityId(value: string): boolean {
  return ID_RE.test(value);
}

/** Sprite pixel that sits on the placement origin. Top-left of the unflipped grid is (0, 0). */
export interface EntityPivot {
  x: number;
  y: number;
}

/**
 * Axis-aligned hit box in unflipped sprite pixels, before `flipX` and `angle`.
 * Omit the field when the part does not take hits.
 */
export interface EntityHitBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EntityPlacement {
  id: string;
  /** Key in `EntityFile.grids`. */
  grid: string;
  /** Where the pivot sits, in entity pixels. +x right, +y down. */
  x: number;
  y: number;
  pivot: EntityPivot;
  /** Radians. 0 selects the unrotated blit. */
  angle: number;
  /** Horizontal mirror of the grid. The pivot pixel stays on `(x, y)`. */
  flipX: boolean;
  /** Lower draws further back. Ties keep file order. */
  layer: number;
  hit?: EntityHitBox;
}

export interface EntityStage {
  id: string;
  name?: string;
  parts: EntityPlacement[];
}

export interface EntityFile {
  format: typeof ENTITY_FORMAT;
  version: typeof ENTITY_FORMAT_VERSION;
  name: string;
  /** Inlined locked grids. `source.name` is the original `*.grid.json` file name. */
  grids: Record<string, PaletteGridFile>;
  stages: EntityStage[];
}

export interface PlacedSprite {
  data: SpriteData;
  anchorX: number;
  anchorY: number;
}

export function createEmptyEntity(name: string): EntityFile {
  return parseEntityFile(
    JSON.stringify({
      format: ENTITY_FORMAT,
      version: ENTITY_FORMAT_VERSION,
      name,
      grids: {},
      stages: [{ id: 'stage', parts: [] }],
    })
  );
}

export function serializeEntityFile(entity: EntityFile): string {
  const checked = parseEntityFile(JSON.stringify(shapeEntity(entity)));
  return `${JSON.stringify(shapeEntity(checked), null, 2)}\n`;
}

export function parseEntityFile(json: string): EntityFile {
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch {
    throw new Error('entity json is not valid JSON');
  }
  const root = asObject(value, 'entity');
  if (root.format !== ENTITY_FORMAT) throw new Error('entity format is not dianlei.entity');
  if (root.version !== ENTITY_FORMAT_VERSION) throw new Error('entity version is not supported');
  const grids = parseGrids(root.grids);
  return {
    format: ENTITY_FORMAT,
    version: ENTITY_FORMAT_VERSION,
    name: asName(root.name, 'entity name'),
    grids,
    stages: parseStages(root.stages, grids),
  };
}

/** Draw order: layer ascending, then file order. */
export function stageDrawOrder(parts: readonly EntityPlacement[]): number[] {
  return parts
    .map((_, index) => index)
    .sort((a, b) => {
      const layerA = parts[a]?.layer ?? 0;
      const layerB = parts[b]?.layer ?? 0;
      if (layerA !== layerB) return layerA - layerB;
      return a - b;
    });
}

/**
 * Grid pixels and the anchor that should sit on the placement origin.
 * Flip is a pixel-index mirror (`width - 1 - pivot.x`), not the fractional
 * anchor used by `renderSpriteMirrored`.
 */
export function placedSprite(grid: PaletteGridFile, part: EntityPlacement): PlacedSprite {
  const data = gridRows(grid);
  if (!part.flipX) {
    return { data, anchorX: part.pivot.x, anchorY: part.pivot.y };
  }
  return {
    data: data.map((row) => [...row].reverse()),
    anchorX: grid.width - 1 - part.pivot.x,
    anchorY: part.pivot.y,
  };
}

/** Hit box after `flipX`. Rotation stays with the part transform. `null` when the part has no hit. */
export function placedHit(grid: PaletteGridFile, part: EntityPlacement): EntityHitBox | null {
  const hit = part.hit;
  if (!hit) return null;
  if (!part.flipX) return { x: hit.x, y: hit.y, w: hit.w, h: hit.h };
  return {
    x: grid.width - hit.x - hit.w,
    y: hit.y,
    w: hit.w,
    h: hit.h,
  };
}

/** Bitmap corners in entity pixels, after flip and rotation around the pivot. */
export function placementCorners(
  grid: PaletteGridFile,
  part: EntityPlacement
): Array<[number, number]> {
  const placed = placedSprite(grid, part);
  const left = -placed.anchorX;
  const top = -placed.anchorY;
  const right = grid.width - placed.anchorX;
  const bottom = grid.height - placed.anchorY;
  const local: Array<[number, number]> = [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ];
  const c = Math.cos(part.angle);
  const s = Math.sin(part.angle);
  return local.map(([x, y]) => [part.x + x * c - y * s, part.y + x * s + y * c]);
}

/**
 * Folded / half / open smoke assembly. Two grids, three stages.
 * Not a dump of the live Obsidian boss.
 */
export function sampleAssemblyEntity(): EntityFile {
  const open = Math.PI / 2;
  return parseEntityFile(
    JSON.stringify({
      format: ENTITY_FORMAT,
      version: ENTITY_FORMAT_VERSION,
      name: 'sample-assembly',
      grids: {
        body: spriteToGrid(
          solid(8, 10, COLOR.DARK_GRAY, column(4, 10, COLOR.PLAYER_CYAN)),
          'body.grid.json'
        ),
        wing: spriteToGrid(
          solid(4, 8, COLOR.PLAYER_MED_CYAN, [[3, 0, COLOR.PLAYER_CYAN]]),
          'wing.grid.json'
        ),
      },
      stages: [
        {
          id: 'folded',
          parts: [
            bodyPart(),
            wingPart('wingL', -4, 0, false, false),
            wingPart('wingR', 4, 0, true, false),
          ],
        },
        {
          id: 'half',
          parts: [
            bodyPart(),
            wingPart('wingL', -4, 0, false, false),
            wingPart('wingR', 4, open, true, false),
          ],
        },
        {
          id: 'open',
          parts: [
            bodyPart(),
            wingPart('wingL', -4, -open, false, true),
            wingPart('wingR', 4, open, true, true),
          ],
        },
      ],
    })
  );
}

function bodyPart(): EntityPlacement {
  return {
    id: 'body',
    grid: 'body',
    x: 0,
    y: 0,
    pivot: { x: 4, y: 5 },
    angle: 0,
    flipX: false,
    layer: 0,
    hit: { x: 0, y: 0, w: 8, h: 10 },
  };
}

function wingPart(
  id: 'wingL' | 'wingR',
  x: number,
  angle: number,
  flipX: boolean,
  hit: boolean
): EntityPlacement {
  const part: EntityPlacement = {
    id,
    grid: 'wing',
    x,
    y: 0,
    pivot: { x: 3, y: 1 },
    angle,
    flipX,
    layer: 1,
  };
  if (hit) part.hit = { x: 0, y: 0, w: 4, h: 8 };
  return part;
}

function column(x: number, height: number, color: number): Array<[number, number, number]> {
  const marks: Array<[number, number, number]> = [];
  for (let y = 0; y < height; y++) marks.push([x, y, color]);
  return marks;
}

function solid(
  width: number,
  height: number,
  color: number,
  marks: ReadonlyArray<readonly [number, number, number]>
): SpriteData {
  const rows: SpriteData = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) row.push(color);
    rows.push(row);
  }
  for (const [x, y, mark] of marks) {
    const row = rows[y];
    if (!row) throw new Error('sample mark is outside the sprite');
    row[x] = mark;
  }
  return rows;
}

function gridRows(grid: PaletteGridFile): SpriteData {
  const rows: SpriteData = [];
  for (let y = 0; y < grid.height; y++) {
    const start = y * grid.width;
    rows.push(grid.cells.slice(start, start + grid.width));
  }
  return rows;
}

function shapeEntity(entity: EntityFile): EntityFile {
  const grids: Record<string, PaletteGridFile> = {};
  for (const id of Object.keys(entity.grids).sort()) {
    const grid = entity.grids[id];
    if (!grid) continue;
    grids[id] = embeddedGrid(grid);
  }
  return {
    format: ENTITY_FORMAT,
    version: ENTITY_FORMAT_VERSION,
    name: entity.name,
    grids,
    stages: entity.stages.map(shapeStage),
  };
}

/** Same field order as a standalone `*.grid.json`, so the embed stays diffable. */
function embeddedGrid(grid: PaletteGridFile): PaletteGridFile {
  const checked = parsePaletteGrid(serializePaletteGrid(grid));
  return {
    format: checked.format,
    version: checked.version,
    width: checked.width,
    height: checked.height,
    palette: {
      id: checked.palette.id,
      version: checked.palette.version,
      size: checked.palette.size,
    },
    source: {
      name: checked.source.name,
      params: {
        sourceWidth: checked.source.params.sourceWidth,
        sourceHeight: checked.source.params.sourceHeight,
        targetWidth: checked.source.params.targetWidth,
        targetHeight: checked.source.params.targetHeight,
        sample: checked.source.params.sample,
        quantize: checked.source.params.quantize,
        alphaCutoff: checked.source.params.alphaCutoff,
        ditherStrength: checked.source.params.ditherStrength,
      },
    },
    cells: checked.cells,
  };
}

function shapeStage(stage: EntityStage): EntityStage {
  const parts = stage.parts.map(shapePlacement);
  if (stage.name !== undefined) return { id: stage.id, name: stage.name, parts };
  return { id: stage.id, parts };
}

function shapePlacement(part: EntityPlacement): EntityPlacement {
  const shaped: EntityPlacement = {
    id: part.id,
    grid: part.grid,
    x: part.x,
    y: part.y,
    pivot: { x: part.pivot.x, y: part.pivot.y },
    angle: part.angle,
    flipX: part.flipX,
    layer: part.layer,
  };
  if (part.hit) shaped.hit = { x: part.hit.x, y: part.hit.y, w: part.hit.w, h: part.hit.h };
  return shaped;
}

function parseGrids(value: unknown): Record<string, PaletteGridFile> {
  const raw = asObject(value, 'grids');
  const ids = Object.keys(raw);
  if (ids.length > ENTITY_MAX_GRIDS) throw new Error(`too many grids (max ${ENTITY_MAX_GRIDS})`);
  const grids: Record<string, PaletteGridFile> = {};
  for (const id of ids) {
    if (!isEntityId(id)) throw new Error(`grid id ${id} is invalid`);
    grids[id] = parsePaletteGrid(JSON.stringify(raw[id]));
  }
  return grids;
}

function parseStages(value: unknown, grids: Record<string, PaletteGridFile>): EntityStage[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > ENTITY_MAX_STAGES) {
    throw new Error(`stages must be a list of 1 to ${ENTITY_MAX_STAGES}`);
  }
  const seen = new Set<string>();
  return value.map((item) => {
    const stage = parseStage(item, grids);
    if (seen.has(stage.id)) throw new Error(`duplicate stage id ${stage.id}`);
    seen.add(stage.id);
    return stage;
  });
}

function parseStage(value: unknown, grids: Record<string, PaletteGridFile>): EntityStage {
  const raw = asObject(value, 'stage');
  const stage: EntityStage = {
    id: asId(raw.id, 'stage id'),
    parts: parseParts(raw.parts, grids),
  };
  if (raw.name !== undefined) stage.name = asName(raw.name, 'stage name');
  return stage;
}

function parseParts(value: unknown, grids: Record<string, PaletteGridFile>): EntityPlacement[] {
  if (!Array.isArray(value) || value.length > ENTITY_MAX_PARTS) {
    throw new Error(`parts must be a list of at most ${ENTITY_MAX_PARTS}`);
  }
  const seen = new Set<string>();
  return value.map((item) => {
    const part = parsePlacement(item, grids);
    if (seen.has(part.id)) throw new Error(`duplicate part id ${part.id}`);
    seen.add(part.id);
    return part;
  });
}

function parsePlacement(value: unknown, grids: Record<string, PaletteGridFile>): EntityPlacement {
  const raw = asObject(value, 'part');
  const id = asId(raw.id, 'part id');
  const gridId = asId(raw.grid, 'part grid');
  const grid = grids[gridId];
  if (!grid) throw new Error(`part ${id} references missing grid ${gridId}`);
  const pivotRaw = asObject(raw.pivot, 'pivot');
  const part: EntityPlacement = {
    id,
    grid: gridId,
    x: asInt(raw.x, 'x', ENTITY_POS_MIN, ENTITY_POS_MAX),
    y: asInt(raw.y, 'y', ENTITY_POS_MIN, ENTITY_POS_MAX),
    pivot: {
      x: asInt(pivotRaw.x, 'pivot.x', 0, grid.width - 1),
      y: asInt(pivotRaw.y, 'pivot.y', 0, grid.height - 1),
    },
    angle: asAngle(raw.angle),
    flipX: asBool(raw.flipX, 'flipX'),
    layer: asInt(raw.layer, 'layer', ENTITY_LAYER_MIN, ENTITY_LAYER_MAX),
  };
  if (raw.hit !== undefined) part.hit = parseHit(raw.hit);
  return part;
}

function parseHit(value: unknown): EntityHitBox {
  const raw = asObject(value, 'hit');
  return {
    x: asInt(raw.x, 'hit.x', ENTITY_HIT_MIN, ENTITY_HIT_MAX),
    y: asInt(raw.y, 'hit.y', ENTITY_HIT_MIN, ENTITY_HIT_MAX),
    w: asInt(raw.w, 'hit.w', 1, ENTITY_HIT_MAX),
    h: asInt(raw.h, 'hit.h', 1, ENTITY_HIT_MAX),
  };
}

function asAngle(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < -ENTITY_ANGLE_MAX ||
    value > ENTITY_ANGLE_MAX
  ) {
    throw new Error(
      `angle must be a finite number of radians from -${ENTITY_ANGLE_MAX} to ${ENTITY_ANGLE_MAX}`
    );
  }
  return value;
}

function asBool(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean`);
  return value;
}

function asId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !isEntityId(value)) {
    throw new Error(`${label} must be 1-32 letters, digits, _ or -`);
  }
  return value;
}

function asName(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > NAME_MAX) {
    throw new Error(`${label} is empty or too long`);
  }
  if (value.includes('/') || value.includes('\\') || value.includes('\0')) {
    throw new Error(`${label} must not be a path`);
  }
  return value;
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asInt(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}`);
  }
  return value;
}
