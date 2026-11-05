/**
 * Selection-box handles for one placed part, in entity pixels.
 *
 * Handles only write fields the entity file already has: edges and corners set
 * `stretchX` / `stretchY` (about the pivot, the same origin the file scales
 * around), the rotate handle sets `angle`. There is no skew field. Stretch snaps
 * so the drawn width and height land on whole entity pixels.
 */

import {
  ENTITY_ANGLE_MAX,
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

export function toPartLocal(part: EntityPlacement, x: number, y: number): { x: number; y: number } {
  const dx = x - part.x;
  const dy = y - part.y;
  const c = Math.cos(part.angle);
  const s = Math.sin(part.angle);
  return { x: dx * c + dy * s, y: -dx * s + dy * c };
}

export function fromPartLocal(
  part: EntityPlacement,
  lx: number,
  ly: number
): { x: number; y: number } {
  const c = Math.cos(part.angle);
  const s = Math.sin(part.angle);
  return { x: part.x + lx * c - ly * s, y: part.y + lx * s + ly * c };
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
