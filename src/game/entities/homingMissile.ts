/**
 * T sub weapon: homing missile (design §5.3.1).
 * Steers toward the nearest on-screen live target with a capped turn rate;
 * with no target it turns back to straight up. Pooled by the battle scene.
 */

import type { Poolable } from '@/engine/pool';
import {
  HOMING_DAMAGE,
  HOMING_LIFETIME,
  HOMING_SPEED,
  HOMING_TURN_RATE,
  LOGICAL_H,
  LOGICAL_W,
} from '@/game/config';

/** Exhaust trail samples kept behind the missile */
export const HOMING_TRAIL_LEN = 4;

export interface HomingTarget {
  x: number;
  y: number;
}

export interface HomingMissile extends Poolable {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  /** Heading in radians; -PI/2 is straight up */
  angle: number;
  damage: number;
  age: number;
  /** Ring buffer of recent positions, newest at trailHead */
  trailX: number[];
  trailY: number[];
  trailHead: number;
  trailCount: number;
}

export function createHomingMissile(): HomingMissile {
  return {
    active: false,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    angle: -Math.PI / 2,
    damage: HOMING_DAMAGE,
    age: 0,
    trailX: new Array<number>(HOMING_TRAIL_LEN).fill(0),
    trailY: new Array<number>(HOMING_TRAIL_LEN).fill(0),
    trailHead: 0,
    trailCount: 0,

    reset() {
      this.x = 0;
      this.y = 0;
      this.prevX = 0;
      this.prevY = 0;
      this.angle = -Math.PI / 2;
      this.damage = HOMING_DAMAGE;
      this.age = 0;
      this.trailHead = 0;
      this.trailCount = 0;
    },
  };
}

export function spawnHomingMissile(
  m: HomingMissile,
  x: number,
  y: number,
  angle: number,
  damage: number
): void {
  m.x = x;
  m.y = y;
  m.prevX = x;
  m.prevY = y;
  m.angle = angle;
  m.damage = damage;
  m.age = 0;
  m.trailHead = 0;
  m.trailCount = 0;
}

/** Nearest candidate to (x, y), or null. */
export function pickHomingTarget(
  x: number,
  y: number,
  candidates: readonly HomingTarget[]
): HomingTarget | null {
  let best: HomingTarget | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const dx = c.x - x;
    const dy = c.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}

function wrapPi(rad: number): number {
  let d = rad;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Turn toward `target` (or straight up when null) by at most
 * HOMING_TURN_RATE·dt, then fly. Returns true when the missile should be
 * released: off screen or past HOMING_LIFETIME.
 */
export function updateHomingMissile(
  m: HomingMissile,
  dt: number,
  target: HomingTarget | null
): boolean {
  m.trailHead = (m.trailHead + 1) % HOMING_TRAIL_LEN;
  m.trailX[m.trailHead] = m.x;
  m.trailY[m.trailHead] = m.y;
  m.trailCount = Math.min(HOMING_TRAIL_LEN, m.trailCount + 1);

  m.prevX = m.x;
  m.prevY = m.y;
  m.age += dt;

  const desired = target ? Math.atan2(target.y - m.y, target.x - m.x) : -Math.PI / 2;
  const maxStep = ((HOMING_TURN_RATE * Math.PI) / 180) * dt;
  const diff = wrapPi(desired - m.angle);
  m.angle = wrapPi(m.angle + Math.max(-maxStep, Math.min(maxStep, diff)));

  m.x += Math.cos(m.angle) * HOMING_SPEED * dt;
  m.y += Math.sin(m.angle) * HOMING_SPEED * dt;

  const margin = 16;
  return (
    m.age >= HOMING_LIFETIME ||
    m.y < -margin ||
    m.y > LOGICAL_H + margin ||
    m.x < -margin ||
    m.x > LOGICAL_W + margin
  );
}
