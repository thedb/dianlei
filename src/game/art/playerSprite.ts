/**
 * Player sprite - 28x32 pixel ship with 11-frame bank animation
 * Design doc §3.2.1 / §10.2: 方案 C (Raiden MK-II style)
 *
 * Frames are rasterized at boot from a small geometric model of the ship
 * (fuselage profile, swept wings, strakes, twin engines, canopy, red spine)
 * into palette-index arrays, then rendered like any other sprite.
 *
 * Bank frames: 0-4 = left bank (mirror of right), 5 = center, 6-10 = right bank.
 * Rolling right: the left (near) wing stays large and sweeps back, the right
 * (far) wing foreshortens to a thin sliver, top-surface details (canopy, spine)
 * slide right and the left flank of the fuselage becomes visible. The nose
 * always points up and the fuselage stays on the hitbox.
 *
 * Engine flames are drawn by code (engineFlame.ts) at the nozzle offsets.
 */

import { COLOR } from '@/game/palette';
import type { SpriteData, BankFrame, NozzleOffset } from './types';
import type { PlayerSpriteSheet } from './types';
export type { PlayerSpriteSheet };
import { renderSprite } from './spriteRenderer';

export const PLAYER_SPRITE_W = 28;
export const PLAYER_SPRITE_H = 32;

/** Depth levels for one bank side, 0 = level flight, 5 = deepest bank */
const BANK_STEPS = 5;

/** Ship centerline in sprite pixel space (between columns 13 and 14) */
const CENTER_X = PLAYER_SPRITE_W / 2;

/** Nozzle exit row; flames start right below the engine outline */
const NOZZLE_ROW = 30;

const T = -1;

type Part = 'none' | 'wing' | 'strake' | 'body' | 'engine' | 'canopy';

interface Cell {
  part: Part;
  color: number;
  /** Which side of the ship the pixel belongs to (-1 left, 1 right) */
  side: number;
}

interface BankParams {
  /** Bank depth 0..1 (positive = right bank) */
  b: number;
  /** Fuselage width scale */
  bodyScale: number;
  /** Shift of top-surface details toward the low wing */
  topShift: number;
  /** Shift of engines (underside) toward the high wing */
  underShift: number;
  /** Span scale of the right (far) wing */
  farSpan: number;
  /** Extra sweep of the left (near) wing tip, in pixels */
  nearSweep: number;
}

function bankParams(step: number): BankParams {
  const b = step / BANK_STEPS;
  return {
    b,
    bodyScale: 1 - 0.12 * b,
    topShift: 1.6 * b,
    underShift: -1.0 * b,
    farSpan: 1 - 0.75 * Math.pow(b, 1.1),
    nearSweep: 1.4 * b,
  };
}

// ---------------------------------------------------------------------------
// Geometry helpers (canonical right-side coordinates: x >= 0 from centerline)
// ---------------------------------------------------------------------------

type Vec = [number, number];

function pointInPolygon(x: number, y: number, poly: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Distance from point to the infinite line through a-b */
function distToLine(x: number, y: number, a: Vec, b: Vec): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.abs(dy * (x - a[0]) - dx * (y - a[1])) / Math.hypot(dx, dy);
}

/** Fuselage half-width at a given row (pointed nose, parallel mid, tapered tail) */
function bodyHalfWidth(y: number): number {
  if (y < 1 || y > 27.5) return -1;
  if (y <= 10) return 0.8 + (y - 1) * 0.29;
  if (y <= 25) return 3.5;
  return 3.5 - (y - 25) * 0.4;
}

const WING_ROOT_X = 3;
const WING_LEADING_A: Vec = [3, 12];
const WING_LEADING_B: Vec = [12.8, 21.6];

function wingPolygon(tipSweep: number): Vec[] {
  return [
    WING_LEADING_A,
    [WING_LEADING_B[0], WING_LEADING_B[1] + tipSweep],
    [12.8, 24.6 + tipSweep],
    [8, 24.2 + tipSweep * 0.5],
    [3, 25.5],
  ];
}

const STRAKE: Vec[] = [
  [3, 8.5],
  [5.2, 12.6],
  [3, 12.6],
];

// ---------------------------------------------------------------------------
// Layer shading
// ---------------------------------------------------------------------------

function shadeWing(
  cx: number,
  y: number,
  tipSweep: number,
  near: boolean,
  far: boolean,
  b: number
): number {
  const lead = distToLine(cx, y, WING_LEADING_A, [WING_LEADING_B[0], WING_LEADING_B[1] + tipSweep]);
  const trailingY = cx < 8 ? 25.5 - (cx - 3) * 0.26 : 24.2 + tipSweep * 0.5;
  const dim = far && b >= 0.4;
  const veryDim = far && b >= 0.8;

  if (lead < 1.1) return dim ? COLOR.PLAYER_WHITE : COLOR.WHITE;
  if (cx > 11.9) return dim ? COLOR.PLAYER_DARK_CYAN : COLOR.PLAYER_MED_CYAN;
  if (y > trailingY - 1.1) return dim ? COLOR.GRAY : COLOR.LIGHT_GRAY;
  if (lead > 3.4 && lead < 4.3) return veryDim ? COLOR.MEDIUM_GRAY : COLOR.LIGHT_GRAY;
  if (veryDim) return COLOR.GRAY;
  if (dim) return COLOR.LIGHT_GRAY;
  return near && b > 0 ? COLOR.WHITE : COLOR.PLAYER_WHITE;
}

function shadeBody(px: number, y: number, p: BankParams, hw: number): number {
  const tx = px - p.topShift;
  const bx = px / p.bodyScale;

  // Revealed left flank while rolling right
  if (p.b > 0 && bx < -hw + 1.7 * p.b) return y > 12 ? COLOR.GRAY : COLOR.LIGHT_GRAY;

  // Spine stripe behind the canopy
  if (y >= 12.5 && y < 22 && Math.abs(tx) < 1) {
    return tx < 0 ? COLOR.ENEMY_BRIGHT_RED : COLOR.ENEMY_RED;
  }

  // Cyan intake panels on both flanks
  const ax = Math.abs(px - p.topShift * 0.6);
  if (ax > 1.2 && (y >= 13 && y < 15.6 ? true : y >= 16.5 && y < 19.1)) {
    const blockBottom = (y >= 14.6 && y < 15.6) || y >= 18.1;
    if (blockBottom) return COLOR.PLAYER_DARK_CYAN;
    return px - p.topShift * 0.6 < 0 ? COLOR.PLAYER_CYAN : COLOR.PLAYER_MED_CYAN;
  }

  // Panel lines across the fuselage
  if ((Math.floor(y) === 20 || Math.floor(y) === 23) && Math.abs(tx) > 0.6) {
    return COLOR.LIGHT_GRAY;
  }

  if (y < 4) return Math.abs(tx) < 0.6 ? COLOR.WHITE : COLOR.PLAYER_WHITE;
  if (tx < -1.6) return COLOR.PLAYER_WHITE;
  if (tx < 1) return COLOR.WHITE;
  if (tx < 2.2) return COLOR.PLAYER_WHITE;
  return COLOR.LIGHT_GRAY;
}

function shadeCanopy(u: number, v: number): number {
  if (v < -0.35 && u < 0.1) return COLOR.PLAYER_PALE_CYAN;
  if (v > 0.55) return COLOR.PLAYER_DARK_CYAN;
  if (u > 0.35) return COLOR.PLAYER_MED_CYAN;
  return COLOR.PLAYER_BLUE;
}

function shadeEngine(px: number, ex: number, y: number): number {
  if (y >= NOZZLE_ROW - 1) return px < ex ? COLOR.DARK_GRAY : COLOR.SHADOW;
  if (px < ex - 0.6) return COLOR.LIGHT_GRAY;
  if (px < ex + 0.4) return COLOR.GRAY;
  return COLOR.MEDIUM_GRAY;
}

// ---------------------------------------------------------------------------
// Rasterization
// ---------------------------------------------------------------------------

function engineCenters(p: BankParams): [number, number] {
  return [-2.4 * p.bodyScale + p.underShift, 2.4 * p.bodyScale + p.underShift];
}

function sampleCell(px: number, y: number, p: BankParams): Cell {
  const side = px < 0 ? -1 : 1;

  // Canopy (top surface, slides with the roll)
  const canopyX = p.topShift * 0.9;
  const cu = (px - canopyX) / (2.0 * p.bodyScale);
  const cv = (y - 9) / 4;
  if (cu * cu + cv * cv < 1) {
    return { part: 'canopy', color: shadeCanopy(cu, cv), side };
  }

  // Engines (rear section overrides the fuselage)
  const [elx, erx] = engineCenters(p);
  if (y >= 20 && y < NOZZLE_ROW) {
    const rightHalf = 1.4 * (1 - 0.35 * p.b);
    const inLeft = Math.abs(px - elx) < 1.4;
    const inRight = Math.abs(px - erx) < rightHalf;
    if ((inLeft || inRight) && (y > 23 || Math.abs(px) / p.bodyScale > bodyHalfWidth(y))) {
      const ex = inLeft ? elx : erx;
      return { part: 'engine', color: shadeEngine(px, ex, y), side: inLeft ? -1 : 1 };
    }
  }

  // Fuselage
  const hw = bodyHalfWidth(y);
  if (hw > 0 && Math.abs(px) / p.bodyScale < hw) {
    return { part: 'body', color: shadeBody(px, y, p, hw), side };
  }

  // Wings and strakes: map screen x back into canonical wing coordinates
  const rootScreen = side > 0 ? WING_ROOT_X * p.bodyScale : WING_ROOT_X;
  const span = side > 0 ? p.farSpan : 1;
  const tipSweep = side > 0 ? 0 : p.nearSweep;
  const cx = WING_ROOT_X + (Math.abs(px) - rootScreen) / span;
  if (cx >= WING_ROOT_X - 0.5) {
    if (pointInPolygon(cx, y, STRAKE)) {
      const dim = side > 0 && p.b >= 0.4;
      return { part: 'strake', color: dim ? COLOR.LIGHT_GRAY : COLOR.PLAYER_WHITE, side };
    }
    if (pointInPolygon(cx, y, wingPolygon(tipSweep))) {
      const near = side < 0;
      const far = side > 0;
      return { part: 'wing', color: shadeWing(cx, y, tipSweep, near, far, p.b), side };
    }
  }

  return { part: 'none', color: T, side };
}

function rasterizeRightBank(step: number): SpriteData {
  const p = bankParams(step);
  const cells: Cell[][] = [];
  for (let row = 0; row < PLAYER_SPRITE_H; row++) {
    const line: Cell[] = [];
    for (let col = 0; col < PLAYER_SPRITE_W; col++) {
      line.push(sampleCell(col + 0.5 - CENTER_X, row + 0.5, p));
    }
    cells.push(line);
  }

  const at = (r: number, c: number): Cell | undefined => cells[r]?.[c];
  const neighbors = (r: number, c: number): (Cell | undefined)[] => [
    at(r - 1, c),
    at(r + 1, c),
    at(r, c - 1),
    at(r, c + 1),
  ];

  const out: SpriteData = [];
  for (let r = 0; r < PLAYER_SPRITE_H; r++) {
    const line: number[] = [];
    for (let c = 0; c < PLAYER_SPRITE_W; c++) {
      const cell = at(r, c)!;
      const ns = neighbors(r, c);

      if (cell.part === 'none') {
        // 1px dark-cyan outline around the silhouette
        const touches = ns.some((n) => n !== undefined && n.part !== 'none');
        line.push(touches ? COLOR.PLAYER_DARK_CYAN : T);
        continue;
      }

      let color = cell.color;
      if (cell.part === 'canopy' && (ns[0]?.part !== 'canopy' || ns[1]?.part !== 'canopy')) {
        color = COLOR.PLAYER_DARK_CYAN;
      } else if (
        (cell.part === 'wing' || cell.part === 'strake') &&
        ns.some((n) => n?.part === 'body' || n?.part === 'engine')
      ) {
        color = COLOR.GRAY;
      } else if (cell.part === 'body' && ns.some((n) => n?.part === 'none')) {
        if (r >= 4 && color !== COLOR.GRAY) color = COLOR.LIGHT_GRAY;
      } else if (cell.part === 'engine' && ns.some((n) => n?.part === 'body')) {
        color = COLOR.DARK_GRAY;
      }
      line.push(color);
    }
    out.push(line);
  }
  return out;
}

function nozzlesFor(step: number): NozzleOffset[] {
  const [l, r] = engineCenters(bankParams(step));
  const y = NOZZLE_ROW - PLAYER_SPRITE_H / 2;
  return [
    { x: l, y },
    { x: r, y },
  ];
}

function mirror(data: SpriteData): SpriteData {
  return data.map((row) => [...row].reverse());
}

/**
 * Raw palette-index data for all 11 bank frames, ordered left-deep → right-deep.
 * Exposed for tests and the sprite preview script.
 */
export function createPlayerFrameData(): SpriteData[] {
  const right: SpriteData[] = [];
  for (let s = 0; s <= BANK_STEPS; s++) right.push(rasterizeRightBank(s));
  const frames: SpriteData[] = [];
  for (let s = BANK_STEPS; s >= 1; s--) frames.push(mirror(right[s]!));
  for (let s = 0; s <= BANK_STEPS; s++) frames.push(right[s]!);
  return frames;
}

/** Nozzle offsets (relative to sprite center) for all 11 frames */
export function createPlayerNozzles(): NozzleOffset[][] {
  const result: NozzleOffset[][] = [];
  for (let s = BANK_STEPS; s >= 1; s--) {
    result.push(nozzlesFor(s).map((n) => ({ x: -n.x, y: n.y })));
  }
  for (let s = 0; s <= BANK_STEPS; s++) result.push(nozzlesFor(s));
  return result;
}

/**
 * Create the full player sprite sheet with all 11 bank frames
 */
export function createPlayerSpriteSheet(): PlayerSpriteSheet {
  const data = createPlayerFrameData();
  const nozzles = createPlayerNozzles();
  const bankFrames: BankFrame[] = data.map((frame, i) => ({
    ...renderSprite(frame, 0.5, 0.5),
    nozzles: nozzles[i]!,
  }));

  return {
    bankFrames,
    frameCount: bankFrames.length,
    width: PLAYER_SPRITE_W,
    height: PLAYER_SPRITE_H,
  };
}

/** Get the bank frame index (0-10) from bank value (-1 to 1) */
export function getBankFrameIndex(bank: number): number {
  // bank: -1 = full left (frame 0), 0 = center (frame 5), 1 = full right (frame 10)
  const normalized = (bank + 1) / 2; // 0 to 1
  return Math.round(normalized * 10);
}
