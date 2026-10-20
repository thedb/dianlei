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
  checkPlayerBulletSwept,
  segmentCircleCollision,
  isPlayerVulnerable,
  SpatialGrid,
} from './collision';
import {
  HITBOX_RADIUS,
  ITEM_PICKUP_RADIUS,
  EB_HIT_RADIUS_SMALL,
  EB_HIT_RADIUS_LARGE,
  EB_SPEED_FAST,
  ENEMY_BULLET_SPEED_SCALE,
  FIXED_DT,
} from '@/game/config';
import { createEnemyBullet, spawnEnemyBullet } from '@/game/entities/enemyBullet';

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

describe('segmentCircleCollision', () => {
  it('hits when the segment passes through the circle', () => {
    expect(segmentCircleCollision(-10, 0, 10, 0, 0, 0, 1)).toBe(true);
  });

  it('misses when the closest approach is outside the radius', () => {
    expect(segmentCircleCollision(-10, 2, 10, 2, 0, 0, 1.5)).toBe(false);
  });

  it('only considers the segment, not the infinite line', () => {
    expect(segmentCircleCollision(5, 0, 10, 0, 0, 0, 2)).toBe(false);
  });

  it('degenerates to a point test for zero-length segments', () => {
    expect(segmentCircleCollision(1, 1, 1, 1, 0, 0, 2)).toBe(true);
    expect(segmentCircleCollision(3, 0, 3, 0, 0, 0, 2)).toBe(false);
  });
});

describe('checkPlayerBulletSwept', () => {
  const sum = HITBOX_RADIUS + EB_HIT_RADIUS_SMALL;

  it('catches a bullet that tunnels over the hitbox in one step', () => {
    // Bullet jumps from above to below the player; neither endpoint overlaps
    const prevY = 100 - sum - 3;
    const y = 100 + sum + 3;
    expect(checkPlayerBulletCollision(180, 100, 180, prevY, EB_HIT_RADIUS_SMALL)).toBe(false);
    expect(checkPlayerBulletCollision(180, 100, 180, y, EB_HIT_RADIUS_SMALL)).toBe(false);
    expect(
      checkPlayerBulletSwept(180, 100, 180, 100, 180, prevY, 180, y, EB_HIT_RADIUS_SMALL)
    ).toBe(true);
  });

  it('catches the fastest bullet type at the fixed timestep', () => {
    const step = EB_SPEED_FAST * ENEMY_BULLET_SPEED_SCALE * FIXED_DT;
    // Positioned so the point samples straddle the hitbox center
    const prevY = 100 - step / 2;
    const y = 100 + step / 2;
    expect(
      checkPlayerBulletSwept(180, 100, 180, 100, 181, prevY, 181, y, EB_HIT_RADIUS_SMALL)
    ).toBe(true);
  });

  it('accounts for player motion during the step', () => {
    // Player moves right across a stationary bullet
    expect(
      checkPlayerBulletSwept(170, 100, 190, 100, 180, 100, 180, 100, EB_HIT_RADIUS_SMALL)
    ).toBe(true);
    // Player and bullet move together, never overlapping
    expect(checkPlayerBulletSwept(170, 100, 190, 100, 170, 90, 190, 90, EB_HIT_RADIUS_SMALL)).toBe(
      false
    );
  });

  it('counts an edge graze just inside the combined radius as a hit', () => {
    const x = 180 + sum - 0.05;
    expect(checkPlayerBulletSwept(180, 100, 180, 100, x, 60, x, 140, EB_HIT_RADIUS_SMALL)).toBe(
      true
    );
  });

  it('treats a pass just outside the combined radius as a miss', () => {
    const x = 180 + sum + 0.05;
    expect(checkPlayerBulletSwept(180, 100, 180, 100, x, 60, x, 140, EB_HIT_RADIUS_SMALL)).toBe(
      false
    );
  });
});

describe('enemy bullet hit radius', () => {
  it('matches the drawn orb sprite size', () => {
    const b = createEnemyBullet();
    spawnEnemyBullet(b, 0, 0, 0, 0, 'small');
    expect(b.hitRadius).toBe(EB_HIT_RADIUS_SMALL);
    expect(b.hitRadius * 2).toBe(6);
    spawnEnemyBullet(b, 0, 0, 0, 0, 'large');
    expect(b.hitRadius).toBe(EB_HIT_RADIUS_LARGE);
    expect(b.hitRadius * 2).toBe(12);
  });
});

describe('isPlayerVulnerable', () => {
  const base = { isDead: false, isFlying: false, bombInvincible: 0, respawnInvincible: 0 };

  it('is vulnerable when controllable and not invincible', () => {
    expect(isPlayerVulnerable(base)).toBe(true);
  });

  it('does not kill during bomb invincibility even on a direct hit', () => {
    const s = { ...base, bombInvincible: 0.5 };
    const hit = checkPlayerBulletSwept(180, 100, 180, 100, 180, 90, 180, 110, 3);
    expect(hit).toBe(true);
    expect(hit && isPlayerVulnerable(s)).toBe(false);
  });

  it('does not kill during respawn invincibility, fly-in, or while dead', () => {
    expect(isPlayerVulnerable({ ...base, respawnInvincible: 1.2 })).toBe(false);
    expect(isPlayerVulnerable({ ...base, isFlying: true })).toBe(false);
    expect(isPlayerVulnerable({ ...base, isDead: true })).toBe(false);
  });

  it('becomes vulnerable again the moment invincibility runs out', () => {
    expect(isPlayerVulnerable({ ...base, respawnInvincible: 0 })).toBe(true);
  });
});
