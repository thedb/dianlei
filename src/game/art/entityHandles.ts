/**
 * Selection-box handles for one placed part, in entity pixels.
 *
 * Handles only write fields of the part: edges and corners set `stretchX` /
 * `stretchY` (about the pivot, the same origin the file scales around), an edge
 * in skew mode sets `skewX` (top / bottom) or `skewY` (left / right), the rotate
 * handle sets `angle`. Stretch snaps so the drawn width and height land on whole
 * entity pixels; skew and angle snap to degree steps.
 *
 * "Part local" here is the scaled box before skew and rotation
 * ({@link placementLocalBox}), so stretch ratios stay per axis under skew.
 */

import {
  ENTITY_ANGLE_MAX,
  ENTITY_SKEW_MAX,
  ENTITY_STRETCH_MAX,
  ENTITY_STRETCH_MIN,
  placementLocalBox,
  type EntityPlacement,
} from './entityFile';
import type { PaletteGridFile } from './gridFile';

export type PartHandleKind = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';

export interface PartHandle {
  kind: PartHandleKind;
  /** Which box edge the handle drives on x: -1 left, 1 right, 0 none. */
  ax: -1 | 0 | 1;
  ay: -1 | 0 | 1;
  /** Handle in the part frame (relative to the pivot, before `angle`). */
  lx: number;
  ly: number;
  /** Handle in entity pixels. */
  x: number;
  y: number;
}

const BOX_HANDLES: ReadonlyArray<readonly [PartHandleKind, -1 | 0 | 1, -1 | 0 | 1]> = [
  ['nw', -1, -1],
  ['n', 0, -1],
  ['ne', 1, -1],
  ['e', 1, 0],
  ['se', 1, 1],
  ['s', 0, 1],
  ['sw', -1, 1],
  ['w', -1, 0],
];

/** A handle closer than this to the pivot on its axis cannot stretch that axis. */
const PIVOT_DEAD_ZONE = 0.5;

/** Entity point to the part frame after scale, before skew and rotation. */
export function toPartLocal(part: EntityPlacement, x: number, y: number): { x: number; y: number } {
  const turned = unrotate(part, x, y);
  const tx = Math.tan(part.skewX ?? 0);
  const ty = Math.tan(part.skewY ?? 0);
  return { x: turned.x - tx * turned.y, y: -ty * turned.x + (1 + tx * ty) * turned.y };
}

/** Part-frame point (after scale, before skew and rotation) to entity pixels. */
export function fromPartLocal(
  part: EntityPlacement,
  lx: number,
  ly: number
): { x: number; y: number } {
  const tx = Math.tan(part.skewX ?? 0);
  const ty = Math.tan(part.skewY ?? 0);
  const kx = (1 + tx * ty) * lx + tx * ly;
  const ky = ty * lx + ly;
  const c = Math.cos(part.angle);
  const s = Math.sin(part.angle);
  return { x: part.x + kx * c - ky * s, y: part.y + kx * s + ky * c };
}

function unrotate(part: EntityPlacement, x: number, y: number): { x: number; y: number } {
  const dx = x - part.x;
  const dy = y - part.y;
  const c = Math.cos(part.angle);
  const s = Math.sin(part.angle);
  return { x: dx * c + dy * s, y: -dx * s + dy * c };
}

/** Eight box handles, then the rotate handle `rotateOffset` entity pixels above the top edge. */
export function partHandles(
  grid: PaletteGridFile,
  part: EntityPlacement,
  rotateOffset: number
): PartHandle[] {
  const box = placementLocalBox(grid, part);
  const midX = (box.left + box.right) / 2;
  const midY = (box.top + box.bottom) / 2;
  const handles = BOX_HANDLES.map(([kind, ax, ay]) => {
    const lx = ax < 0 ? box.left : ax > 0 ? box.right : midX;
    const ly = ay < 0 ? box.top : ay > 0 ? box.bottom : midY;
    return { kind, ax, ay, lx, ly, ...fromPartLocal(part, lx, ly) };
  });
  const ly = box.top - rotateOffset;
  handles.push({ kind: 'rotate', ax: 0, ay: 0, lx: midX, ly, ...fromPartLocal(part, midX, ly) });
  return handles;
}

/** Nearest handle within `radius` entity pixels of the point, or null. */
export function handleAt(
  handles: readonly PartHandle[],
  x: number,
  y: number,
  radius: number
): PartHandle | null {
  let best: PartHandle | null = null;
  let bestDistance = radius;
  for (const handle of handles) {
    const distance = Math.hypot(handle.x - x, handle.y - y);
    if (distance > bestDistance) continue;
    best = handle;
    bestDistance = distance;
  }
  return best;
}

/**
 * Stretch whose drawn size `cells × scale × stretch` is a whole number of
 * entity pixels (at least 1), rounded to 0.001 and clamped to the stretch range.
 */
export function snapStretch(stretch: number, cells: number, scale: number): number {
  const unit = cells * scale;
  const pixels = Math.max(1, Math.round(unit * Math.max(0, stretch)));
  const snapped = Math.round((pixels / unit) * 1000) / 1000;
  return Math.max(ENTITY_STRETCH_MIN, Math.min(ENTITY_STRETCH_MAX, snapped));
}

/**
 * Stretch after dragging `handle` of `start` to the entity point. Each driven
 * axis takes the ratio of the pointer to the handle along that axis in the part
 * frame. `keepRatio` gives a corner one shared ratio, and gives an edge the same
 * ratio on both axes.
 */
export function dragStretch(
  grid: PaletteGridFile,
  start: EntityPlacement,
  handle: PartHandle,
  x: number,
  y: number,
  keepRatio: boolean
): { stretchX: number; stretchY: number } {
  const local = toPartLocal(start, x, y);
  const canX = handle.ax !== 0 && Math.abs(handle.lx) >= PIVOT_DEAD_ZONE;
  const canY = handle.ay !== 0 && Math.abs(handle.ly) >= PIVOT_DEAD_ZONE;
  let rx = canX ? local.x / handle.lx : 1;
  let ry = canY ? local.y / handle.ly : 1;
  if (keepRatio) {
    const shared = canX && canY ? (rx + ry) / 2 : canX ? rx : canY ? ry : 1;
    rx = shared;
    ry = shared;
  }
  return {
    stretchX: snapStretch((start.stretchX ?? 1) * rx, grid.width, start.scale),
    stretchY: snapStretch((start.stretchY ?? 1) * ry, grid.height, start.scale),
  };
}

/**
 * Angle after turning from one entity point to another around the pivot of
 * `start`, snapped to `stepDeg` degrees and wrapped into (-π, π].
 */
export function dragAngle(
  start: EntityPlacement,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  stepDeg: number
): number {
  const before = Math.atan2(fromY - start.y, fromX - start.x);
  const after = Math.atan2(toY - start.y, toX - start.x);
  const raw = start.angle + after - before;
  const step = Math.max(0.1, stepDeg);
  const wrapped = (Math.atan2(Math.sin(raw), Math.cos(raw)) * 180) / Math.PI;
  const degrees = Math.round(wrapped / step) * step;
  const rad = (degrees * Math.PI) / 180;
  return Math.max(-ENTITY_ANGLE_MAX, Math.min(ENTITY_ANGLE_MAX, rad)) + 0;
}

/**
 * Skew after dragging an edge handle of `start` to the entity point, snapped to
 * `stepDeg` degrees and clamped to the skew range. Top / bottom edges set
 * `skewX` so that edge's midpoint follows the pointer sideways; left / right
 * edges set `skewY` so it follows up and down. Corners and the rotate handle,
 * and an edge sitting on the pivot, leave both unchanged.
 */
export function dragSkew(
  start: EntityPlacement,
  handle: PartHandle,
  x: number,
  y: number,
  stepDeg: number
): { skewX: number; skewY: number } {
  const skewX = start.skewX ?? 0;
  const skewY = start.skewY ?? 0;
  const turned = unrotate(start, x, y);
  const ty = Math.tan(skewY);
  if (handle.ax === 0 && handle.ay !== 0) {
    const reach = ty * handle.lx + handle.ly;
    if (Math.abs(reach) < PIVOT_DEAD_ZONE) return { skewX, skewY };
    return { skewX: snapSkew(Math.atan((turned.x - handle.lx) / reach), stepDeg), skewY };
  }
  if (handle.ay === 0 && handle.ax !== 0) {
    if (Math.abs(handle.lx) < PIVOT_DEAD_ZONE) return { skewX, skewY };
    return { skewX, skewY: snapSkew(Math.atan((turned.y - handle.ly) / handle.lx), stepDeg) };
  }
  return { skewX, skewY };
}

function snapSkew(rad: number, stepDeg: number): number {
  const step = Math.max(0.1, stepDeg);
  const degrees = Math.round((rad * 180) / Math.PI / step) * step;
  const snapped = (degrees * Math.PI) / 180;
  return Math.max(-ENTITY_SKEW_MAX, Math.min(ENTITY_SKEW_MAX, snapped)) + 0;
}
