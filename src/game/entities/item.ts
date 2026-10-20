/**
 * Item entity system
 * Design doc §5.6: P bounces around, B falls down
 */

import type { Poolable } from '@/engine/pool';
import {
  LOGICAL_W,
  LOGICAL_H,
  ITEM_P_SPEED,
  ITEM_P_LIFETIME,
  ITEM_B_FALL_SPEED,
} from '@/game/config';

export type ItemType = 'P' | 'B';

export interface Item extends Poolable {
  type: ItemType;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  lifetime: number;
  flashTimer: number;
}

/** Create item factory for pool */
export function createItem(): Item {
  return {
    active: false,
    type: 'P',
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    lifetime: 0,
    flashTimer: 0,

    reset() {
      this.type = 'P';
      this.x = 0;
      this.y = 0;
      this.prevX = 0;
      this.prevY = 0;
      this.vx = 0;
      this.vy = 0;
      this.lifetime = 0;
      this.flashTimer = 0;
    },
  };
}

/** Spawn item at position */
export function spawnItem(item: Item, type: ItemType, x: number, y: number): void {
  item.type = type;
  item.x = x;
  item.y = y;
  item.prevX = x;
  item.prevY = y;
  item.lifetime = 0;
  item.flashTimer = 0;

  if (type === 'P') {
    // P item bounces around - start with random diagonal velocity
    const angle = Math.random() * Math.PI * 2;
    item.vx = Math.cos(angle) * ITEM_P_SPEED;
    item.vy = Math.sin(angle) * ITEM_P_SPEED;
  } else {
    // B item falls down with slight sway
    item.vx = 0;
    item.vy = ITEM_B_FALL_SPEED;
  }
}

/** Update item and return true if should be culled */
export function updateItem(item: Item, dt: number): boolean {
  item.prevX = item.x;
  item.prevY = item.y;
  item.lifetime += dt;
  item.flashTimer += dt;

  if (item.type === 'P') {
    // P item bounces off walls
    item.x += item.vx * dt;
    item.y += item.vy * dt;

    // Bounce off left/right edges
    if (item.x < 8) {
      item.x = 8;
      item.vx = Math.abs(item.vx);
    } else if (item.x > LOGICAL_W - 8) {
      item.x = LOGICAL_W - 8;
      item.vx = -Math.abs(item.vx);
    }

    // Bounce off top edge only
    if (item.y < 8) {
      item.y = 8;
      item.vy = Math.abs(item.vy);
    }

    // After lifetime, fly off bottom
    if (item.lifetime >= ITEM_P_LIFETIME) {
      item.vy = Math.abs(item.vy);
      if (item.y > LOGICAL_H + 20) {
        return true;
      }
    }

    return false;
  } else {
    // B item falls with slight horizontal sway
    item.x += Math.sin(item.lifetime * 3) * 10 * dt;
    item.y += item.vy * dt;

    // Cull when off bottom of screen
    return item.y > LOGICAL_H + 20;
  }
}

/** Check if item should display in flash state (for blinking effect) */
export function isItemFlashing(item: Item): boolean {
  const blinkSpeed = item.lifetime > ITEM_P_LIFETIME - 2 ? 0.1 : 0.25;
  return Math.floor(item.flashTimer / blinkSpeed) % 2 === 1;
}
