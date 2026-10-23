/**
 * Risk crates (P20b). A stage lists slots. The difficulty profile keeps a
 * prefix of that list. The disc drifts in from the top, takes shield damage
 * before body damage, never shoots, and never body-kills the player.
 */

import type { Poolable } from '@/engine/pool';
import type { Rng } from '@/engine/rng';
import {
  HIT_FLASH_TIME,
  LOGICAL_H,
  RISK_CRATE_BODY_HP,
  RISK_CRATE_DROP_M_SHARE,
  RISK_CRATE_DROP_P_SHARE,
  RISK_CRATE_HIT_RADIUS,
  RISK_CRATE_SHIELD_HP,
  RISK_CRATE_SINE_AMP,
  RISK_CRATE_SINE_PERIOD,
  RISK_CRATE_SIZE,
  RISK_CRATE_VY,
} from '@/game/config';
import type { ItemType } from '@/game/entities/item';
import type { RiskCrateSlot } from '@/game/levels/types';

/**
 * First `count` slots, in authored order. Medium takes R1 then R2; Hard also
 * takes R3 even though R3's time sits between them. A non-positive count
 * spawns nothing.
 */
export function selectRiskCrateSlots(
  slots: readonly RiskCrateSlot[] | undefined,
  count: number
): RiskCrateSlot[] {
  if (!slots || count <= 0) return [];
  return slots.slice(0, count);
}

/**
 * Emits each selected slot once, when stage time reaches it. `seek` drops
 * slots that have already come due, the same way a boss-practice jump drops
 * waves that were skipped.
 */
export class RiskCrateScheduler {
  private readonly slots: readonly RiskCrateSlot[];
  private next = 0;

  constructor(slots: readonly RiskCrateSlot[]) {
    this.slots = [...slots].sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  reset(): void {
    this.next = 0;
  }

  /** Skip every slot at or before `time`. Those crates never spawn. */
  seek(time: number): void {
    while (this.next < this.slots.length && this.slots[this.next]!.t <= time) this.next++;
  }

  update(gameTime: number): RiskCrateSlot[] {
    const out: RiskCrateSlot[] = [];
    while (this.next < this.slots.length && gameTime >= this.slots[this.next]!.t) {
      out.push(this.slots[this.next]!);
      this.next++;
    }
    return out;
  }
}

export interface RiskCrate extends Poolable {
  id: string;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  /** Sway center. */
  originX: number;
  age: number;
  width: number;
  height: number;
  hitRadius: number;
  shield: number;
  shieldMax: number;
  hp: number;
  maxHp: number;
  hitFlashTimer: number;
  /** Seconds until the bomb shockwave reaches this crate; negative when none is pending. */
  bombHitIn: number;
}

export function createRiskCrate(): RiskCrate {
  return {
    active: false,
    id: '',
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    originX: 0,
    age: 0,
    width: RISK_CRATE_SIZE,
    height: RISK_CRATE_SIZE,
    hitRadius: RISK_CRATE_HIT_RADIUS,
    shield: RISK_CRATE_SHIELD_HP,
    shieldMax: RISK_CRATE_SHIELD_HP,
    hp: RISK_CRATE_BODY_HP,
    maxHp: RISK_CRATE_BODY_HP,
    hitFlashTimer: 0,
    bombHitIn: -1,

    reset() {
      this.id = '';
      this.x = 0;
      this.y = 0;
      this.prevX = 0;
      this.prevY = 0;
      this.originX = 0;
      this.age = 0;
      this.width = RISK_CRATE_SIZE;
      this.height = RISK_CRATE_SIZE;
      this.hitRadius = RISK_CRATE_HIT_RADIUS;
      this.shield = RISK_CRATE_SHIELD_HP;
      this.shieldMax = RISK_CRATE_SHIELD_HP;
      this.hp = RISK_CRATE_BODY_HP;
      this.maxHp = RISK_CRATE_BODY_HP;
      this.hitFlashTimer = 0;
      this.bombHitIn = -1;
    },
  };
}

/** Enter from above the screen, centered on the slot's x. */
export function spawnRiskCrate(crate: RiskCrate, slot: RiskCrateSlot): void {
  const y = -RISK_CRATE_SIZE / 2;
  crate.id = slot.id;
  crate.originX = slot.x;
  crate.x = slot.x;
  crate.y = y;
  crate.prevX = slot.x;
  crate.prevY = y;
  crate.age = 0;
  crate.width = RISK_CRATE_SIZE;
  crate.height = RISK_CRATE_SIZE;
  crate.hitRadius = RISK_CRATE_HIT_RADIUS;
  crate.shield = RISK_CRATE_SHIELD_HP;
  crate.shieldMax = RISK_CRATE_SHIELD_HP;
  crate.hp = RISK_CRATE_BODY_HP;
  crate.maxHp = RISK_CRATE_BODY_HP;
  crate.hitFlashTimer = 0;
  crate.bombHitIn = -1;
}

/**
 * Shield absorbs first. Spillover hits the body. True only when the body
 * reaches 0. A shield break by itself is not a kill.
 */
export function damageRiskCrate(crate: RiskCrate, amount: number): boolean {
  if (amount <= 0 || crate.hp <= 0) return false;
  crate.hitFlashTimer = HIT_FLASH_TIME;
  let left = amount;
  if (crate.shield > 0) {
    const taken = Math.min(crate.shield, left);
    crate.shield -= taken;
    left -= taken;
  }
  if (left <= 0) return false;
  crate.hp -= left;
  if (crate.hp > 0) return false;
  crate.hp = 0;
  return true;
}

/**
 * Body-destroy drop. Mate 0 is always M and does not draw. Otherwise one roll:
 * M, then P, then T. Never B.
 */
export function chooseRiskCrateDrop(mateLevel: number, rng: Rng): ItemType {
  if (mateLevel <= 0) return 'M';
  const roll = rng();
  if (roll < RISK_CRATE_DROP_M_SHARE) return 'M';
  if (roll < RISK_CRATE_DROP_M_SHARE + RISK_CRATE_DROP_P_SHARE) return 'P';
  return 'T';
}

/**
 * Drift down and sway. True once the disc has left the bottom of the screen.
 */
export function updateRiskCrate(crate: RiskCrate, dt: number): boolean {
  crate.prevX = crate.x;
  crate.prevY = crate.y;
  crate.age += dt;
  crate.y += RISK_CRATE_VY * dt;
  const phase = (crate.age / RISK_CRATE_SINE_PERIOD) * Math.PI * 2;
  crate.x = crate.originX + Math.sin(phase) * RISK_CRATE_SINE_AMP;
  if (crate.hitFlashTimer > 0) crate.hitFlashTimer = Math.max(0, crate.hitFlashTimer - dt);
  return crate.y - crate.height / 2 > LOGICAL_H;
}
