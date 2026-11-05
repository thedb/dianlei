/**
 * Entity assembly files (`*.entity.json`).
 *
 * A stage is a list of parts. Each part places one locked palette grid
 * (`gridFile.ts`) by an integer pivot. A nonzero angle matches `drawPartSprite`:
 * translate to the pivot and rotate (canvas y-down, positive clockwise).
 * `scale` is a finite
 * multiplier in `(0, 16]`: each cell becomes a `scale`×`scale` block, nearest-neighbor,
 * with smoothing off, about the pivot. 1 is one cell per pixel. Values below 1 shrink.
 * Angle 0 and scale 1 use the straight floored blit. Angle 0 and any other integer
 * scale enlarge through that same blit with a destination size. Any other scale,
 * including a shrink, and any nonzero angle, scale about the pivot with a transform.
 * A scaled or rotated edge may cover part of a screen pixel; it is not snapped
 * and not filtered. Shrinking does not box-average: several source cells can land
 * in one screen pixel, and the sample is the nearest source cell.
 * `flipX` mirrors the grid in pixel indices before that blit. There is no vertical flip.
 *
 * `hit`, when present, is in unflipped sprite pixels, before `flipX`, `scale`,
 * and `angle`. A missing `shape` is a rectangle (`x,y` top-left, `w,h`).
 * `shape: "circle"` is a center (`x,y`) and radius `r`. Either one may sit
 * outside the sprite and may be larger than it. `role: "block"` marks a shape
 * that only stops shots; a missing role takes damage. A part with no `hit`
 * neither takes damage nor blocks. The live fight still uses its own hit
 * circles until a boss is switched onto this file.
 *
 * `anchors`, when present, are named points relative to the pivot in unflipped
 * sprite pixels: `exhaust` for a tail flame, `muzzle` for a gun. They move with
 * `flipX` (x negates), `scale`, and `angle`. The fight does not read them yet.
 *
 * `stretchX` / `stretchY`, when present, multiply `scale` on one axis in the
 * part's own frame, after `flipX` and before `angle`. Missing means 1.
 *
 * One stage per pose. A boss uses stages such as folded / half / open. A player
 * ship uses t0 (level) through t5 (full right bank); the game mirrors the left,
 * so a file never holds left-bank stages. A stage with `bank` is rebuilt from
 * stage `bank.from` (which has no `bank` itself): every part position is
 * stretched about the origin, `taper` narrows the +x side more than the -x side
 * (the dipping wing), then the whole pose turns by `bank.angle`. Each part takes
 * the same turn and stretch. That is exact for parts at angle 0; a part already
 * turned in the source keeps its own axes and is only approximated.
 *
 * `previewFrame`, when present, is a saved editor rectangle in entity pixels,
 * centered on the origin. The fight does not read it. The editor does not
 * treat a missing frame as the 360×640 logical screen: that size is only named
 * in the UI. A loaded assembly with no `previewFrame` is framed from its parts.
 *
 * `sampleAssemblyEntity` is the editor smoke fixture (folded / half / open).
 * It is not the live Obsidian boss.
 */

import { LOGICAL_H, LOGICAL_W } from '@/game/config';
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
export const ENTITY_MAX_ANCHORS = 16;

/** Inclusive integer range for a part's entity-space origin. */
export const ENTITY_POS_MIN = -4096;
export const ENTITY_POS_MAX = 4096;

/** Inclusive layer range. Lower layers draw further back. */
export const ENTITY_LAYER_MIN = -999;
export const ENTITY_LAYER_MAX = 999;

/** Inclusive radian range (about ten turns either way). */
export const ENTITY_ANGLE_MAX = 64;

/**
 * Scale must be greater than `ENTITY_SCALE_MIN` and at most `ENTITY_SCALE_MAX`.
 * 1 is the grid at 1 cell = 1 pixel. Fractions such as 0.5 shrink about the pivot.
 * The editor preview zoom is not this value and is not stored.
 */
export const ENTITY_SCALE_MIN = 0;
export const ENTITY_SCALE_MAX = 16;

/** Inclusive range for a hit-box edge, in sprite pixels. Width and height are at least 1. */
/** Per-axis stretch on a part or a bank, inclusive. */
export const ENTITY_STRETCH_MIN = 0.1;
export const ENTITY_STRETCH_MAX = 4;
/** Bank perspective taper, inclusive magnitude. */
export const ENTITY_TAPER_MAX = 0.5;

export const ENTITY_HIT_MIN = -1024;
export const ENTITY_HIT_MAX = 1024;

/** Preview-frame edge length. The default is the logical screen (`LOGICAL_W` × `LOGICAL_H`). */
export const ENTITY_FRAME_MIN = 1;
export const ENTITY_FRAME_MAX = 4096;

/** Extra entity pixels outside the farthest part when fitting the preview frame. */
export const ENTITY_FRAME_PAD = 8;

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
 * Axis-aligned hit box in unflipped sprite pixels. `x,y` is the top-left.
 * Width and height are not clamped to the sprite, so the box may be larger
 * and may start outside it. Omit `hit` when the part does not take hits.
 * Older files have no `shape`; that is this rectangle.
 */
export interface EntityRectHit {
  /** Absent on purpose. A missing shape stays a rectangle, including old files. */
  shape?: undefined;
  x: number;
  y: number;
  w: number;
  h: number;
  /** `block` only stops shots. Missing takes damage. */
  role?: 'block';
}

/**
 * Circle in unflipped sprite pixels. `x,y` is the center and may lie outside
 * the sprite. `r` may be larger than the sprite. Flip mirrors the center
 * (`width - x`) and keeps `r`.
 */
export interface EntityCircleHit {
  shape: 'circle';
  x: number;
  y: number;
  r: number;
  /** `block` only stops shots. Missing takes damage. */
  role?: 'block';
}

export type EntityHitBox = EntityRectHit | EntityCircleHit;

/** `damage` takes hits. `block` only stops shots. */
export type EntityHitRole = 'damage' | 'block';

export function hitRole(hit: EntityHitBox): EntityHitRole {
  return hit.role === 'block' ? 'block' : 'damage';
}

export type EntityAnchorKind = 'exhaust' | 'muzzle';

/** A point relative to the pivot, in unflipped sprite pixels. */
export interface EntityAnchor {
  id: string;
  kind: EntityAnchorKind;
  x: number;
  y: number;
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
  /**
   * Pixel multiplier around the pivot, in `(0, 16]`. Missing on older files means 1.
   * Angle 0 and an integer scale use the floored blit. Any other scale, and any
   * rotation, stay nearest-neighbor and may cover a partial screen pixel.
   */
  scale: number;
  /** Extra horizontal multiplier in the part frame. Omitted when 1. */
  stretchX?: number;
  /** Extra vertical multiplier in the part frame. Omitted when 1. */
  stretchY?: number;
  /** Lower draws further back. Ties keep file order. */
  layer: number;
  hit?: EntityHitBox;
  /** Omitted when empty. At most {@link ENTITY_MAX_ANCHORS}; ids are unique per part. */
  anchors?: EntityAnchor[];
}

/** Bank pose rebuilt from another stage. Angle in radians, positive clockwise. */
export interface EntityBank {
  from: string;
  angle: number;
  stretchX: number;
  stretchY: number;
  /** Positive narrows the +x side and widens the -x side, by up to this share at the edge. */
  taper: number;
}

export interface EntityStage {
  id: string;
  name?: string;
  parts: EntityPlacement[];
  /** When set, `parts` are the result of {@link bankParts} on stage `bank.from`. */
  bank?: EntityBank;
}

/**
 * Editor reference rectangle, centered on the entity origin.
 * Width and height are integer entity pixels. The fight does not read this.
 */
export interface EntityPreviewFrame {
  width: number;
  height: number;
}

export interface EntityFile {
  format: typeof ENTITY_FORMAT;
  version: typeof ENTITY_FORMAT_VERSION;
  name: string;
  /** Inlined locked grids. `source.name` is the original `*.grid.json` file name. */
  grids: Record<string, PaletteGridFile>;
  stages: EntityStage[];
  /**
   * Optional preview rectangle. Missing means {@link defaultPreviewFrame}
   * (the logical screen). Written only after the editor changes it.
   */
  previewFrame?: EntityPreviewFrame;
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
  const entity: EntityFile = {
    format: ENTITY_FORMAT,
    version: ENTITY_FORMAT_VERSION,
    name: asName(root.name, 'entity name'),
    grids,
    stages: parseStages(root.stages, grids),
  };
  if (root.previewFrame !== undefined) entity.previewFrame = parseFrame(root.previewFrame);
  return entity;
}

/** Logical screen. Used when an entity file omits `previewFrame`. */
export function defaultPreviewFrame(): EntityPreviewFrame {
  return { width: LOGICAL_W, height: LOGICAL_H };
}

/**
 * The file's frame, or the logical screen when the field is absent.
 * The editor does not use that fallback as the current object's box.
 */
export function previewFrameOf(entity: EntityFile): EntityPreviewFrame {
  return entity.previewFrame ?? defaultPreviewFrame();
}

/** Axis-aligned edges of a frame centered on the origin. +x right, +y down. */
export function previewFrameRect(frame: EntityPreviewFrame): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  const left = -Math.floor(frame.width / 2);
  const top = -Math.floor(frame.height / 2);
  return { left, top, right: left + frame.width, bottom: top + frame.height };
}

/**
 * Smallest origin-centered frame that contains every part in every stage,
 * plus {@link ENTITY_FRAME_PAD} on the far side. An empty entity stays on
 * the logical screen.
 */
export function suggestedPreviewFrame(entity: EntityFile): EntityPreviewFrame {
  let reachX = 0;
  let reachY = 0;
  let any = false;
  for (const stage of entity.stages) {
    for (const part of stage.parts) {
      const grid = entity.grids[part.grid];
      if (!grid) continue;
      for (const [x, y] of placementCorners(grid, part)) {
        any = true;
        reachX = Math.max(reachX, Math.abs(x));
        reachY = Math.max(reachY, Math.abs(y));
      }
    }
  }
  if (!any) return defaultPreviewFrame();
  return {
    width: clampFrame(Math.ceil((reachX + ENTITY_FRAME_PAD) * 2)),
    height: clampFrame(Math.ceil((reachY + ENTITY_FRAME_PAD) * 2)),
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

/** Hit shape after `flipX`. Rotation and scale stay with the part transform. */
export function placedHit(grid: PaletteGridFile, part: EntityPlacement): EntityHitBox | null {
  const hit = part.hit;
  if (!hit) return null;
  if (hit.shape === 'circle') {
    return withRole(
      {
        shape: 'circle',
        x: part.flipX ? grid.width - hit.x : hit.x,
        y: hit.y,
        r: hit.r,
      },
      hit
    );
  }
  return withRole(
    {
      x: part.flipX ? grid.width - hit.x - hit.w : hit.x,
      y: hit.y,
      w: hit.w,
      h: hit.h,
    },
    hit
  );
}

function withRole<T extends EntityHitBox>(
  shape: T,
  from: { readonly role?: 'block' | undefined }
): T {
  if (from.role === 'block') shape.role = 'block';
  return shape;
}

/**
 * Anchor in entity pixels after `flipX`, `scale`, and `angle`.
 * Flip negates x because the pivot cell mirrors with the grid.
 */
export function placedAnchor(
  part: EntityPlacement,
  anchor: EntityAnchor
): { x: number; y: number } {
  const lx = (part.flipX ? -anchor.x : anchor.x) * partScaleX(part);
  const ly = anchor.y * partScaleY(part);
  const c = Math.cos(part.angle);
  const s = Math.sin(part.angle);
  return { x: part.x + lx * c - ly * s, y: part.y + lx * s + ly * c };
}

/** Canonical deep copy of one part. */
export function clonePlacement(part: EntityPlacement): EntityPlacement {
  return JSON.parse(JSON.stringify(shapePlacement(part))) as EntityPlacement;
}

/** Copy of a stage under a new id. Parts keep their ids so poses line up across stages. */
export function cloneStage(stage: EntityStage, id: string): EntityStage {
  if (!isEntityId(id)) throw new Error(`stage id ${id} is invalid`);
  const copy: EntityStage = { id, parts: stage.parts.map(clonePlacement) };
  if (stage.name !== undefined) copy.name = stage.name;
  if (stage.bank) copy.bank = { ...stage.bank };
  return copy;
}

/**
 * Put a copy of `part` into `target`. A part with the same id there is replaced
 * in place, keeping its list position; otherwise the copy is appended.
 */
export function copyPartToStage(target: EntityStage, part: EntityPlacement): 'replaced' | 'added' {
  const copy = clonePlacement(part);
  const index = target.parts.findIndex((item) => item.id === part.id);
  if (index >= 0) {
    target.parts[index] = copy;
    return 'replaced';
  }
  if (target.parts.length >= ENTITY_MAX_PARTS)
    throw new Error(`parts must be at most ${ENTITY_MAX_PARTS}`);
  target.parts.push(copy);
  return 'added';
}

/** Sprite bounds of one stage in entity pixels, or null when it has no parts. Hits are not included. */
export function stageBounds(
  entity: EntityFile,
  stage: EntityStage
): { left: number; top: number; right: number; bottom: number } | null {
  let box: { left: number; top: number; right: number; bottom: number } | null = null;
  for (const part of stage.parts) {
    const grid = entity.grids[part.grid];
    if (!grid) continue;
    for (const [x, y] of placementCorners(grid, part)) {
      if (!box) box = { left: x, top: y, right: x, bottom: y };
      box.left = Math.min(box.left, x);
      box.top = Math.min(box.top, y);
      box.right = Math.max(box.right, x);
      box.bottom = Math.max(box.bottom, y);
    }
  }
  return box;
}

/** Horizontal pixel multiplier of a part: `scale` times `stretchX`. */
export function partScaleX(part: EntityPlacement): number {
  return part.scale * (part.stretchX ?? 1);
}

/** Vertical pixel multiplier of a part: `scale` times `stretchY`. */
export function partScaleY(part: EntityPlacement): number {
  return part.scale * (part.stretchY ?? 1);
}

/** Starting bank for right-bank frame `level` (1–5): narrower, with a little taper. */
export function defaultBank(from: string, level: number): EntityBank {
  return {
    from,
    angle: 0,
    stretchX: roundStretch(1 - 0.06 * level),
    stretchY: 1,
    taper: roundStretch(0.04 * level),
  };
}

/**
 * Parts of a bank pose: `source` parts stretched about the origin (with `taper`
 * on x), then turned by `bank.angle`. Positions round to whole entity pixels;
 * stretches round to 0.001 and clamp to the stretch range.
 */
export function bankParts(
  entity: EntityFile,
  source: EntityStage,
  bank: EntityBank
): EntityPlacement[] {
  const box = stageBounds(entity, source);
  const half = box ? Math.max(1, Math.abs(box.left), Math.abs(box.right)) : 1;
  const c = Math.cos(bank.angle);
  const s = Math.sin(bank.angle);
  return source.parts.map((from) => {
    const part = clonePlacement(from);
    const side = Math.max(-1, Math.min(1, from.x / half));
    const kx = bank.stretchX * (1 - bank.taper * side);
    const ky = bank.stretchY;
    const sx = from.x * kx;
    const sy = from.y * ky;
    part.x = clampInt(Math.round(sx * c - sy * s), ENTITY_POS_MIN, ENTITY_POS_MAX);
    part.y = clampInt(Math.round(sx * s + sy * c), ENTITY_POS_MIN, ENTITY_POS_MAX);
    part.angle = Math.max(-ENTITY_ANGLE_MAX, Math.min(ENTITY_ANGLE_MAX, from.angle + bank.angle));
    setStretch(part, 'stretchX', (from.stretchX ?? 1) * kx);
    setStretch(part, 'stretchY', (from.stretchY ?? 1) * ky);
    return part;
  });
}

function setStretch(part: EntityPlacement, key: 'stretchX' | 'stretchY', value: number): void {
  const next = Math.max(ENTITY_STRETCH_MIN, Math.min(ENTITY_STRETCH_MAX, roundStretch(value)));
  if (next === 1) delete part[key];
  else part[key] = next;
}

function roundStretch(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value)) + 0;
}

/** Sprite rectangle around the pivot, in entity pixels, before rotation. Includes scale and stretch. */
export function placementLocalBox(
  grid: PaletteGridFile,
  part: EntityPlacement
): { left: number; top: number; right: number; bottom: number } {
  const placed = placedSprite(grid, part);
  const sx = partScaleX(part);
  const sy = partScaleY(part);
  return {
    left: -placed.anchorX * sx,
    top: -placed.anchorY * sy,
    right: (grid.width - placed.anchorX) * sx,
    bottom: (grid.height - placed.anchorY) * sy,
  };
}

/** Bitmap corners in entity pixels, after flip, scale, and rotation around the pivot. */
export function placementCorners(
  grid: PaletteGridFile,
  part: EntityPlacement
): Array<[number, number]> {
  const box = placementLocalBox(grid, part);
  const local: Array<[number, number]> = [
    [box.left, box.top],
    [box.right, box.top],
    [box.right, box.bottom],
    [box.left, box.bottom],
  ];
  const c = Math.cos(part.angle);
  const s = Math.sin(part.angle);
  return local.map(([x, y]) => [part.x + x * c - y * s, part.y + x * s + y * c]);
}

/** True when the entity-space point lies in the scaled, rotated sprite rectangle. */
export function placementContains(
  grid: PaletteGridFile,
  part: EntityPlacement,
  x: number,
  y: number
): boolean {
  const box = placementLocalBox(grid, part);
  const dx = x - part.x;
  const dy = y - part.y;
  const c = Math.cos(part.angle);
  const s = Math.sin(part.angle);
  const lx = dx * c + dy * s;
  const ly = -dx * s + dy * c;
  return lx >= box.left && lx < box.right && ly >= box.top && ly < box.bottom;
}

/**
 * Hit box relative to the pivot, after `flipX` and before `scale` and `angle`.
 * Draw it in that local space, then scale and rotate with the sprite.
 */
export function placedHitLocal(grid: PaletteGridFile, part: EntityPlacement): EntityHitBox | null {
  const hit = placedHit(grid, part);
  if (!hit) return null;
  const placed = placedSprite(grid, part);
  if (hit.shape === 'circle') {
    return withRole(
      {
        shape: 'circle',
        x: hit.x - placed.anchorX,
        y: hit.y - placed.anchorY,
        r: hit.r,
      },
      hit
    );
  }
  return withRole(
    {
      x: hit.x - placed.anchorX,
      y: hit.y - placed.anchorY,
      w: hit.w,
      h: hit.h,
    },
    hit
  );
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
            wingPart('wingL', -4, 0, false, null),
            wingPart('wingR', 4, 0, true, null),
          ],
        },
        {
          id: 'half',
          parts: [
            bodyPart(),
            wingPart('wingL', -4, 0, false, null),
            wingPart('wingR', 4, open, true, null),
          ],
        },
        {
          id: 'open',
          parts: [
            bodyPart(),
            wingPart('wingL', -4, -open, false, 'block'),
            wingPart('wingR', 4, open, true, 'damage'),
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
    scale: 1,
    layer: 0,
    hit: { x: 0, y: 0, w: 8, h: 10 },
    anchors: [
      { id: 'jet', kind: 'exhaust', x: 0, y: 5 },
      { id: 'gun', kind: 'muzzle', x: 0, y: -5 },
    ],
  };
}

function wingPart(
  id: 'wingL' | 'wingR',
  x: number,
  angle: number,
  flipX: boolean,
  hit: EntityHitRole | null
): EntityPlacement {
  const part: EntityPlacement = {
    id,
    grid: 'wing',
    x,
    y: 0,
    pivot: { x: 3, y: 1 },
    angle,
    flipX,
    scale: 1,
    layer: 1,
  };
  if (hit === 'damage') part.hit = { x: 0, y: 0, w: 4, h: 8 };
  if (hit === 'block') part.hit = { x: 0, y: 0, w: 4, h: 8, role: 'block' };
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
  const shaped: EntityFile = {
    format: ENTITY_FORMAT,
    version: ENTITY_FORMAT_VERSION,
    name: entity.name,
    grids,
    stages: entity.stages.map(shapeStage),
  };
  if (entity.previewFrame) {
    shaped.previewFrame = {
      width: entity.previewFrame.width,
      height: entity.previewFrame.height,
    };
  }
  return shaped;
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
  const shaped: EntityStage = { id: stage.id, parts: stage.parts.map(shapePlacement) };
  if (stage.name !== undefined) shaped.name = stage.name;
  if (stage.bank) {
    shaped.bank = {
      from: stage.bank.from,
      angle: stage.bank.angle,
      stretchX: stage.bank.stretchX,
      stretchY: stage.bank.stretchY,
      taper: stage.bank.taper,
    };
  }
  return shaped;
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
    scale: part.scale,
    layer: part.layer,
  };
  if (part.stretchX !== undefined && part.stretchX !== 1) shaped.stretchX = part.stretchX;
  if (part.stretchY !== undefined && part.stretchY !== 1) shaped.stretchY = part.stretchY;
  if (part.hit?.shape === 'circle') {
    shaped.hit = withRole(
      { shape: 'circle', x: part.hit.x, y: part.hit.y, r: part.hit.r },
      part.hit
    );
  } else if (part.hit) {
    shaped.hit = withRole({ x: part.hit.x, y: part.hit.y, w: part.hit.w, h: part.hit.h }, part.hit);
  }
  if (part.anchors && part.anchors.length > 0) {
    shaped.anchors = part.anchors.map((anchor) => ({
      id: anchor.id,
      kind: anchor.kind,
      x: anchor.x,
      y: anchor.y,
    }));
  }
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
  const stages = value.map((item) => {
    const stage = parseStage(item, grids);
    if (seen.has(stage.id)) throw new Error(`duplicate stage id ${stage.id}`);
    seen.add(stage.id);
    return stage;
  });
  for (const stage of stages) {
    if (!stage.bank) continue;
    const from = stages.find((item) => item.id === stage.bank?.from);
    if (!from || from === stage || from.bank) {
      throw new Error(`stage ${stage.id} bank.from must name another stage without bank`);
    }
  }
  return stages;
}

function parseStage(value: unknown, grids: Record<string, PaletteGridFile>): EntityStage {
  const raw = asObject(value, 'stage');
  const stage: EntityStage = {
    id: asId(raw.id, 'stage id'),
    parts: parseParts(raw.parts, grids),
  };
  if (raw.name !== undefined) stage.name = asName(raw.name, 'stage name');
  if (raw.bank !== undefined) stage.bank = parseBank(raw.bank);
  return stage;
}

function parseBank(value: unknown): EntityBank {
  const raw = asObject(value, 'bank');
  const taper = raw.taper === undefined ? 0 : raw.taper;
  if (typeof taper !== 'number' || !Number.isFinite(taper) || Math.abs(taper) > ENTITY_TAPER_MAX) {
    throw new Error(`bank.taper must be a number from -${ENTITY_TAPER_MAX} to ${ENTITY_TAPER_MAX}`);
  }
  return {
    from: asId(raw.from, 'bank.from'),
    angle: asAngle(raw.angle),
    stretchX: asStretch(raw.stretchX, 'bank.stretchX'),
    stretchY: asStretch(raw.stretchY, 'bank.stretchY'),
    taper,
  };
}

function asStretch(value: unknown, label: string): number {
  if (value === undefined) return 1;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < ENTITY_STRETCH_MIN ||
    value > ENTITY_STRETCH_MAX
  ) {
    throw new Error(
      `${label} must be a number from ${ENTITY_STRETCH_MIN} to ${ENTITY_STRETCH_MAX}`
    );
  }
  return value;
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
    scale: asScale(raw.scale),
    layer: asInt(raw.layer, 'layer', ENTITY_LAYER_MIN, ENTITY_LAYER_MAX),
  };
  const stretchX = asStretch(raw.stretchX, 'stretchX');
  const stretchY = asStretch(raw.stretchY, 'stretchY');
  if (stretchX !== 1) part.stretchX = stretchX;
  if (stretchY !== 1) part.stretchY = stretchY;
  if (raw.hit !== undefined) part.hit = parseHit(raw.hit);
  if (raw.anchors !== undefined) {
    const anchors = parseAnchors(raw.anchors);
    if (anchors.length > 0) part.anchors = anchors;
  }
  return part;
}

function parseAnchors(value: unknown): EntityAnchor[] {
  if (!Array.isArray(value) || value.length > ENTITY_MAX_ANCHORS) {
    throw new Error(`anchors must be a list of at most ${ENTITY_MAX_ANCHORS}`);
  }
  const seen = new Set<string>();
  return value.map((item) => {
    const raw = asObject(item, 'anchor');
    const id = asId(raw.id, 'anchor id');
    if (seen.has(id)) throw new Error(`duplicate anchor id ${id}`);
    seen.add(id);
    if (raw.kind !== 'exhaust' && raw.kind !== 'muzzle') {
      throw new Error('anchor.kind must be exhaust or muzzle');
    }
    return {
      id,
      kind: raw.kind,
      x: asInt(raw.x, 'anchor.x', ENTITY_HIT_MIN, ENTITY_HIT_MAX),
      y: asInt(raw.y, 'anchor.y', ENTITY_HIT_MIN, ENTITY_HIT_MAX),
    };
  });
}

function parseFrame(value: unknown): EntityPreviewFrame {
  const raw = asObject(value, 'previewFrame');
  return {
    width: asInt(raw.width, 'previewFrame.width', ENTITY_FRAME_MIN, ENTITY_FRAME_MAX),
    height: asInt(raw.height, 'previewFrame.height', ENTITY_FRAME_MIN, ENTITY_FRAME_MAX),
  };
}

function clampFrame(value: number): number {
  return Math.min(ENTITY_FRAME_MAX, Math.max(ENTITY_FRAME_MIN, value));
}

function parseHit(value: unknown): EntityHitBox {
  const raw = asObject(value, 'hit');
  const shape = raw.shape === undefined ? 'rect' : raw.shape;
  const x = asInt(raw.x, 'hit.x', ENTITY_HIT_MIN, ENTITY_HIT_MAX);
  const y = asInt(raw.y, 'hit.y', ENTITY_HIT_MIN, ENTITY_HIT_MAX);
  if (raw.role !== undefined && raw.role !== 'damage' && raw.role !== 'block') {
    throw new Error('hit.role must be damage or block');
  }
  const role: { role?: 'block' } = raw.role === 'block' ? { role: 'block' } : {};
  if (shape === 'circle') {
    return withRole({ shape: 'circle', x, y, r: asInt(raw.r, 'hit.r', 1, ENTITY_HIT_MAX) }, role);
  }
  if (shape !== 'rect') throw new Error('hit.shape must be rect or circle');
  return withRole(
    {
      x,
      y,
      w: asInt(raw.w, 'hit.w', 1, ENTITY_HIT_MAX),
      h: asInt(raw.h, 'hit.h', 1, ENTITY_HIT_MAX),
    },
    role
  );
}

function asScale(value: unknown): number {
  if (value === undefined) return 1;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= ENTITY_SCALE_MIN ||
    value > ENTITY_SCALE_MAX
  ) {
    throw new Error(
      `scale must be a finite number greater than ${ENTITY_SCALE_MIN} and at most ${ENTITY_SCALE_MAX}`
    );
  }
  return value;
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
