/**
 * Turns an enemy's Fire config into bullets through the shared pattern library.
 * Burst patterns (aimed3burst) repeat AIMED_BURST_GAP apart; rings turn by `rotStep`;
 * barrel patterns (fixed2) follow the shooter's aim angle.
 * side_arc ships with a single aimed1 and no interval fire once, at the arc apex.
 */

import type { Enemy } from '@/game/entities/enemy';
import { shouldEnemyFire } from '@/game/entities/enemy';
import { executeFirePattern, type BulletSpawner } from '@/game/entities/enemyBullet';
import { fireBurst, fireRotStep, fireUsesBarrel } from '@/game/systems/danmaku';
import { AIMED_BURST_GAP, AIMED_MIN_DIST } from '@/game/config';

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
  const aimAngle = fireUsesBarrel(fire) ? enemy.aimAngle : undefined;
  executeFirePattern(fire, enemy.x, enemy.y, playerX, playerY, spawner, {
    rotation: enemy.patternRot,
    ...(aimAngle === undefined ? {} : { aimAngle }),
  });
  enemy.patternRot += fireRotStep(fire);

  const burst = fireBurst(fire);
  if (burst > 1) {
    enemy.burstLeft = burst - 1;
    enemy.burstTimer = 0;
  }
}
