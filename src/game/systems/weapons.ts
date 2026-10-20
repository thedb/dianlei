/**
 * Turns an enemy's Fire config into bullets.
 * aimed3burst is three aimed shots  AIMED_BURST_GAP apart.
 * side_arc ships with a single aimed1 and no interval fire once, at the arc apex.
 */

import type { Enemy } from '@/game/entities/enemy';
import { shouldEnemyFire } from '@/game/entities/enemy';
import { executeFirePattern, type BulletSpawner } from '@/game/entities/enemyBullet';
import { AIMED_BURST_COUNT, AIMED_BURST_GAP, AIMED_MIN_DIST } from '@/game/config';

function farEnough(enemy: Enemy, playerX: number, playerY: number): boolean {
  const dx = playerX - enemy.x;
  const dy = playerY - enemy.y;
  return dx * dx + dy * dy >= AIMED_MIN_DIST * AIMED_MIN_DIST;
}

/** One aimed1 whose interval is omitted: fire a single shot when the arc finishes. */
function isArcApexShot(enemy: Enemy): boolean {
  if (enemy.move.kind !== 'side_arc') return false;
  if (enemy.fire.kind !== 'aimed1') return false;
  return (
    enemy.fire.maxShots === 1 && enemy.fire.interval === undefined && enemy.fire.atY === undefined
  );
}

/**
 * Advance fire timers and spawn bullets.
 * `enabled` is false during the warning, so leftover bullets can fade without new ones.
 */
export function updateEnemyWeapons(
  enemy: Enemy,
  dt: number,
  playerX: number,
  playerY: number,
  spawner: BulletSpawner,
  enabled: boolean
): void {
  if (!enabled || enemy.fire.kind === 'none') return;

  if (enemy.burstLeft > 0) {
    enemy.burstTimer += dt;
    if (enemy.burstTimer >= AIMED_BURST_GAP) {
      enemy.burstTimer -= AIMED_BURST_GAP;
      enemy.burstLeft--;
      if (enemy.y >= 8 && farEnough(enemy, playerX, playerY)) {
        executeFirePattern(enemy.fire, enemy.x, enemy.y, playerX, playerY, spawner);
      }
    }
    return;
  }

  if (isArcApexShot(enemy)) {
    if (enemy.phase === 'exit' && enemy.shotsFired === 0 && enemy.y >= 8) {
      enemy.shotsFired = 1;
      if (farEnough(enemy, playerX, playerY)) {
        executeFirePattern(enemy.fire, enemy.x, enemy.y, playerX, playerY, spawner);
      }
    }
    return;
  }

  const result = shouldEnemyFire(enemy, dt, playerX, playerY);
  if (!result.shouldFire) return;

  const fire = result.fireData;
  if (fire.kind === 'ring8' || fire.kind === 'ring16') {
    executeFirePattern(fire, enemy.x, enemy.y, playerX, playerY, spawner, {
      rotation: enemy.patternRot,
    });
    enemy.patternRot += fire.rotStep;
    return;
  }

  if (fire.kind === 'fixed2') {
    executeFirePattern(fire, enemy.x, enemy.y, playerX, playerY, spawner, {
      aimAngle: enemy.aimAngle,
    });
    return;
  }

  executeFirePattern(fire, enemy.x, enemy.y, playerX, playerY, spawner);

  if (fire.kind === 'aimed3burst') {
    enemy.burstLeft = AIMED_BURST_COUNT - 1;
    enemy.burstTimer = 0;
  }
}
