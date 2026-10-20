/**
 * Tests for collision detection system
 */

import { describe, expect, it } from 'vitest';
import {
  circleCollision,
  pointInCircle,
  circleRectCollision,
  checkPlayerBulletCollision,
  checkPlayerEnemyCollision,
  checkBulletEnemyCollision,
  checkItemPickup,
  SpatialGrid,
} from './collision';
import { HITBOX_RADIUS, ITEM_PICKUP_RADIUS } from '@/game/config';

describe('circleCollision', () => {
  it('should detect overlapping circles', () => {
    // Two circles at same point
    expect(circleCollision(0, 0, 5, 0, 0, 5)).toBe(true);

    // Two circles just touching
    expect(circleCollision(0, 0, 5, 10, 0, 5)).toBe(false); // exactly touching = not colliding

    // Two circles overlapping
    expect(circleCollision(0, 0, 5, 8, 0, 5)).toBe(true);

    // Two circles far apart
    expect(circleCollision(0, 0, 5, 100, 100, 5)).toBe(false);
  });

  it('should handle different sized circles', () => {
    expect(circleCollision(0, 0, 10, 15, 0, 10)).toBe(true);
    expect(circleCollision(0, 0, 10, 25, 0, 10)).toBe(false);
  });
});

describe('pointInCircle', () => {
  it('should detect point inside circle', () => {
    expect(pointInCircle(5, 5, 5, 5, 10)).toBe(true);
    expect(pointInCircle(0, 0, 5, 5, 10)).toBe(true);
  });

  it('should detect point outside circle', () => {
    expect(pointInCircle(20, 20, 5, 5, 10)).toBe(false);
  });

  it('should handle edge case (on boundary)', () => {
    // Point exactly on boundary is outside (< not <=)
    expect(pointInCircle(15, 5, 5, 5, 10)).toBe(false);
  });
});

describe('circleRectCollision', () => {
  it('should detect circle inside rectangle', () => {
    expect(circleRectCollision(50, 50, 5, 0, 0, 100, 100)).toBe(true);
  });

  it('should detect circle overlapping rectangle edge', () => {
    // Circle overlapping left edge
    expect(circleRectCollision(-2, 50, 5, 0, 0, 100, 100)).toBe(true);

    // Circle overlapping corner
    expect(circleRectCollision(-2, -2, 5, 0, 0, 100, 100)).toBe(true);
  });

  it('should not detect circle outside rectangle', () => {
    expect(circleRectCollision(-10, 50, 5, 0, 0, 100, 100)).toBe(false);
    expect(circleRectCollision(50, -10, 5, 0, 0, 100, 100)).toBe(false);
  });
});

describe('Player collision checks', () => {
  it('should use correct hitbox radius for player-bullet collision', () => {
    // Bullet just touching player hitbox
    const distance = HITBOX_RADIUS + 2; // bullet radius = 2
    expect(checkPlayerBulletCollision(100, 100, 100 + distance - 0.1, 100, 2)).toBe(true);
    expect(checkPlayerBulletCollision(100, 100, 100 + distance + 0.1, 100, 2)).toBe(false);
  });

  it('should use correct hitbox radius for player-enemy collision', () => {
    const enemyRadius = 10;
    const distance = HITBOX_RADIUS + enemyRadius;
    expect(checkPlayerEnemyCollision(100, 100, 100 + distance - 0.1, 100, enemyRadius)).toBe(true);
    expect(checkPlayerEnemyCollision(100, 100, 100 + distance + 0.1, 100, enemyRadius)).toBe(false);
  });
});

describe('Bullet-enemy collision', () => {
  it('should detect bullet hitting enemy', () => {
    // Bullet at center of enemy
    expect(checkBulletEnemyCollision(100, 100, 4, 12, 100, 100, 10)).toBe(true);

    // Bullet just outside enemy
    expect(checkBulletEnemyCollision(80, 100, 4, 12, 100, 100, 10)).toBe(false);
  });

  it('should account for bullet size', () => {
    // Wide bullet should hit
    expect(checkBulletEnemyCollision(85, 100, 20, 12, 100, 100, 10)).toBe(true);
  });
});

describe('Item pickup', () => {
  it('should use correct pickup radius', () => {
    // Item just within pickup range
    const distance = ITEM_PICKUP_RADIUS + 8; // item radius = 8
    expect(checkItemPickup(100, 100, 100 + distance - 0.1, 100)).toBe(true);
    expect(checkItemPickup(100, 100, 100 + distance + 0.1, 100)).toBe(false);
  });
});

describe('SpatialGrid', () => {
  it('should insert and retrieve objects', () => {
    const grid = new SpatialGrid<{ id: number }>(64);
    const obj = { id: 1 };

    grid.insert(obj, 50, 50);
    const results = grid.getAtPosition(50, 50);

    expect(results).toContain(obj);
  });

  it('should retrieve objects in overlapping cells for rect query', () => {
    const grid = new SpatialGrid<{ id: number }>(64);
    const obj1 = { id: 1 };
    const obj2 = { id: 2 };

    grid.insert(obj1, 30, 30);
    grid.insert(obj2, 100, 100);

    // Query that covers only first cell
    const results1 = grid.getInRect(0, 0, 60, 60);
    expect(results1).toContain(obj1);
    expect(results1).not.toContain(obj2);

    // Query that covers both cells
    const results2 = grid.getInRect(0, 0, 120, 120);
    expect(results2).toContain(obj1);
    expect(results2).toContain(obj2);
  });

  it('should clear all objects', () => {
    const grid = new SpatialGrid<{ id: number }>(64);
    grid.insert({ id: 1 }, 50, 50);
    grid.clear();

    expect(grid.getAtPosition(50, 50)).toHaveLength(0);
  });
});
