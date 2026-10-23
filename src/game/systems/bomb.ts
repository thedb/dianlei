/**
 * Bomb rules (design §5.4). Pure: the battle scene owns the pools.
 *
 * A shockwave ring grows from the ship and reaches the farthest screen corner
 * in BOMB_WAVE_TIME. Only objects on screen when the bomb goes off are hit,
 * each when the ring reaches it. Small objects die outright, medium objects
 * lose BOMB_MEDIUM_RATIO of their max HP, the boss (large) is handled by
 * applyBossBomb at BOMB_BOSS_RATIO.
 */

import {
  BOMB_MEDIUM_RATIO,
  BOMB_WAVE_TIME,
  BUILDING_HP,
  LOGICAL_H,
  LOGICAL_W,
} from '@/game/config';
import { damageEnemy, type Enemy } from '@/game/entities/enemy';
import { damageBuilding, type Building } from '@/game/entities/building';
import { damageRiskCrate, type RiskCrate } from '@/game/entities/riskCrate';
import {
  buildingClass,
  enemyClass,
  RISK_CRATE_CLASS,
  type SizeClass,
} from '@/game/entities/objectClass';

export interface BombBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Any part of the box is inside the screen. */
export function boxOnScreen(box: BombBox): boolean {
  return (
    box.x + box.width / 2 > 0 &&
    box.x - box.width / 2 < LOGICAL_W &&
    box.y + box.height / 2 > 0 &&
    box.y - box.height / 2 < LOGICAL_H
  );
}

/** Ring radius that covers the whole screen from (ox, oy). */
export function bombWaveReach(ox: number, oy: number): number {
  const dx = Math.max(ox, LOGICAL_W - ox);
  const dy = Math.max(oy, LOGICAL_H - oy);
  return Math.hypot(dx, dy);
}

/** Ring radius `t` seconds after the bomb. */
export function bombWaveRadius(ox: number, oy: number, t: number): number {
  const u = Math.max(0, Math.min(1, t / BOMB_WAVE_TIME));
  return bombWaveReach(ox, oy) * u;
}

/** Seconds until the ring reaches (x, y). Never more than BOMB_WAVE_TIME. */
export function bombArrivalDelay(ox: number, oy: number, x: number, y: number): number {
  const reach = bombWaveReach(ox, oy);
  if (reach <= 0) return 0;
  const u = Math.min(1, Math.hypot(x - ox, y - oy) / reach);
  return u * BOMB_WAVE_TIME;
}

/**
 * Damage the bomb deals to a small or medium object.
 * Small: all remaining HP. Medium: BOMB_MEDIUM_RATIO of max HP.
 * Large objects take the boss rule instead and get 0 here.
 */
export function bombDamage(size: SizeClass, hp: number, maxHp: number): number {
  if (size === 'small') return Math.max(hp, 0);
  if (size === 'medium') return maxHp * BOMB_MEDIUM_RATIO;
  return 0;
}

export interface BombTarget extends BombBox {
  bombHitIn: number;
}

/**
 * Queue the ring hit on a target that is on screen right now.
 * Returns false (and leaves the target alone) when it is off screen.
 */
export function markBombTarget(target: BombTarget, ox: number, oy: number): boolean {
  if (!boxOnScreen(target)) return false;
  target.bombHitIn = bombArrivalDelay(ox, oy, target.x, target.y);
  return true;
}

/** Count down a queued hit. True on the step the ring arrives. */
export function bombArrives(target: BombTarget, dt: number): boolean {
  if (target.bombHitIn < 0) return false;
  target.bombHitIn -= dt;
  if (target.bombHitIn > 0) return false;
  target.bombHitIn = -1;
  return true;
}

/** Apply the size-class bomb damage to an enemy. True when it dies. */
export function bombHitEnemy(enemy: Enemy): boolean {
  return damageEnemy(enemy, bombDamage(enemyClass(enemy.type).size, enemy.hp, enemy.maxHp));
}

/** Apply the size-class bomb damage to a building. True when it is wrecked. */
export function bombHitBuilding(b: Building): boolean {
  if (b.wrecked) return false;
  return damageBuilding(b, bombDamage(buildingClass(b.type).size, b.hp, BUILDING_HP));
}

/**
 * A small crate loses shield and body together. Damage still empties the
 * shield before the body, so the score is the body kill.
 */
export function bombHitRiskCrate(crate: RiskCrate): boolean {
  const hp = crate.shield + crate.hp;
  const maxHp = crate.shieldMax + crate.maxHp;
  return damageRiskCrate(crate, bombDamage(RISK_CRATE_CLASS.size, hp, maxHp));
}
