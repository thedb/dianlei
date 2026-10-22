/**
 * Collision detection system
 * Design doc §5.2: Player hitbox radius 2.5, items pickup radius 14
 */

import { HITBOX_RADIUS, ITEM_PICKUP_RADIUS } from '@/game/config';

/** Check circle-circle collision */
export function circleCollision(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distSq = dx * dx + dy * dy;
  const radiusSum = r1 + r2;
  return distSq < radiusSum * radiusSum;
}

/** Check point-circle collision */
export function pointInCircle(px: number, py: number, cx: number, cy: number, r: number): boolean {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy < r * r;
}

/** Check circle-rectangle collision */
export function circleRectCollision(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}

/** Check if player hitbox collides with enemy bullet */
export function checkPlayerBulletCollision(
  playerX: number,
  playerY: number,
  bulletX: number,
  bulletY: number,
  bulletRadius: number
): boolean {
  return circleCollision(playerX, playerY, HITBOX_RADIUS, bulletX, bulletY, bulletRadius);
}

/**
 * Check whether segment a→b passes within r of point c (strictly less than r,
 * matching circleCollision so exact tangency is a miss)
 */
export function segmentCircleCollision(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  r: number
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((cx - ax) * dx + (cy - ay) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const ex = ax + dx * t - cx;
  const ey = ay + dy * t - cy;
  return ex * ex + ey * ey < r * r;
}

/**
 * Swept enemy-bullet vs player-hitbox test for one fixed step.
 * Works in the player's frame of reference, so both the bullet's and the
 * player's motion during the step are covered and fast bullets can't tunnel
 * through the 2.5px hitbox.
 */
export function checkPlayerBulletSwept(
  playerPrevX: number,
  playerPrevY: number,
  playerX: number,
  playerY: number,
  bulletPrevX: number,
  bulletPrevY: number,
  bulletX: number,
  bulletY: number,
  bulletRadius: number
): boolean {
  return segmentCircleCollision(
    bulletPrevX - playerPrevX,
    bulletPrevY - playerPrevY,
    bulletX - playerX,
    bulletY - playerY,
    0,
    0,
    HITBOX_RADIUS + bulletRadius
  );
}

export interface PlayerVulnerabilityState {
  isDead: boolean;
  isFlying: boolean;
  bombInvincible: number;
  respawnInvincible: number;
}

/** Whether enemy bullets / bodies can kill the player this step */
export function isPlayerVulnerable(s: PlayerVulnerabilityState): boolean {
  return !s.isDead && !s.isFlying && s.bombInvincible <= 0 && s.respawnInvincible <= 0;
}

/** Check if player hitbox collides with enemy body */
export function checkPlayerEnemyCollision(
  playerX: number,
  playerY: number,
  enemyX: number,
  enemyY: number,
  enemyRadius: number
): boolean {
  return circleCollision(playerX, playerY, HITBOX_RADIUS, enemyX, enemyY, enemyRadius);
}

/** Check if player bullet hits enemy */
export function checkBulletEnemyCollision(
  bulletX: number,
  bulletY: number,
  bulletW: number,
  bulletH: number,
  enemyX: number,
  enemyY: number,
  enemyRadius: number
): boolean {
  // Use rectangle-circle collision
  return circleRectCollision(
    enemyX,
    enemyY,
    enemyRadius,
    bulletX - bulletW / 2,
    bulletY - bulletH / 2,
    bulletW,
    bulletH
  );
}

/** Check if player can pick up item */
export function checkItemPickup(
  playerX: number,
  playerY: number,
  itemX: number,
  itemY: number
): boolean {
  return circleCollision(playerX, playerY, ITEM_PICKUP_RADIUS, itemX, itemY, 8);
}

const GRID_HALF = 2048;
const GRID_SPAN = GRID_HALF * 2;
const ascending = (a: number, b: number): number => a - b;

/**
 * Spatial hash grid for broad-phase collision detection.
 * Each object goes into the one cell holding its point. Rect queries visit
 * objects in insertion order, so a caller that inserts in pool order sees the
 * same order as a full pool scan. Cell arrays are reused across frames.
 */
export class SpatialGrid<T> {
  private readonly cellSize: number;
  private readonly cells = new Map<number, number[]>();
  private readonly used: number[][] = [];
  private readonly items: T[] = [];
  private readonly scratch: number[] = [];

  constructor(cellSize: number = 64) {
    this.cellSize = cellSize;
  }

  /** Clear all cells */
  clear(): void {
    for (const cell of this.used) cell.length = 0;
    this.used.length = 0;
    this.items.length = 0;
  }

  private cell(cx: number, cy: number): number[] | undefined {
    return this.cells.get((cx + GRID_HALF) * GRID_SPAN + (cy + GRID_HALF));
  }

  /** Insert object at position */
  insert(obj: T, x: number, y: number): void {
    const slot = this.items.length;
    this.items.push(obj);
    const key =
      (Math.floor(x / this.cellSize) + GRID_HALF) * GRID_SPAN +
      (Math.floor(y / this.cellSize) + GRID_HALF);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    if (cell.length === 0) this.used.push(cell);
    cell.push(slot);
  }

  /**
   * Visit every object whose cell overlaps the rectangle, in insertion order.
   * The callback must not query or insert into this grid.
   */
  forEachInRect(x: number, y: number, w: number, h: number, visit: (obj: T) => void): void {
    const slots = this.scratch;
    slots.length = 0;
    const minCX = Math.floor(x / this.cellSize);
    const maxCX = Math.floor((x + w) / this.cellSize);
    const minCY = Math.floor(y / this.cellSize);
    const maxCY = Math.floor((y + h) / this.cellSize);
    let cellsHit = 0;
    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.cell(cx, cy);
        if (!cell || cell.length === 0) continue;
        cellsHit++;
        for (let i = 0; i < cell.length; i++) slots.push(cell[i]!);
      }
    }
    if (cellsHit > 1) slots.sort(ascending);
    for (let i = 0; i < slots.length; i++) visit(this.items[slots[i]!]!);
  }

  /** Get all objects in cell containing position */
  getAtPosition(x: number, y: number): T[] {
    const cell = this.cell(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize));
    return cell ? cell.map((slot) => this.items[slot]!) : [];
  }

  /** Get all objects in cells overlapping a rectangle */
  getInRect(x: number, y: number, w: number, h: number): T[] {
    const result: T[] = [];
    this.forEachInRect(x, y, w, h, (obj) => result.push(obj));
    return result;
  }

  /** Get all objects in cells overlapping a circle */
  getInCircle(x: number, y: number, r: number): T[] {
    return this.getInRect(x - r, y - r, r * 2, r * 2);
  }
}
