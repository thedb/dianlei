/**
 * 黑曜 fight script. The fuselage stays put. Four blades rotate around
 * hinge pivots: folded, half open, then the cross. The generic runner
 * owns part HP. This module owns the angles, which circle a shot hits,
 * and the weapon lap for the live phase.
 *
 * State lives in a WeakMap. Only types come from `systems/boss.ts`.
 * Nothing here clears bullets that are already flying.
 *
 * Design: docs/电雷_第四关_黑曜Boss设计_v1.md §4–§6.
 */

import {
  AIMED_MIN_DIST,
  HITBOX_RADIUS,
  LOGICAL_H,
  LOGICAL_W,
  OBSIDIAN_BLADE_REACH,
  OBSIDIAN_BODY_CHIP,
  OBSIDIAN_CENTER_X,
  OBSIDIAN_DEPLOY_TIME,
  OBSIDIAN_EDGE_COUNT,
  OBSIDIAN_EDGE_HARD,
  OBSIDIAN_EDGE_SPREAD,
  OBSIDIAN_FAN_B_COUNT,
  OBSIDIAN_FAN_B_GAP,
  OBSIDIAN_FAN_B_SPREAD,
  OBSIDIAN_FAN_COUNT,
  OBSIDIAN_FAN_SETTLE,
  OBSIDIAN_FAN_SPEED,
  OBSIDIAN_FAN_SPREAD,
  OBSIDIAN_FLAME_BOOST,
  OBSIDIAN_FOLD_CYCLE,
  OBSIDIAN_GUN_Y,
  OBSIDIAN_HALF_CYCLE,
  OBSIDIAN_JETTISON_DROP,
  OBSIDIAN_JETTISON_TIME,
  OBSIDIAN_MISSILE_B_COUNT,
  OBSIDIAN_MISSILE_B_DELAY,
  OBSIDIAN_MISSILE_B_GAP,
  OBSIDIAN_MISSILE_B_HOMING,
  OBSIDIAN_MISSILE_COUNT,
  OBSIDIAN_MISSILE_FIRST,
  OBSIDIAN_MISSILE_GAP,
  OBSIDIAN_MISSILE_HOMING,
  OBSIDIAN_MISSILE_SPEED,
  OBSIDIAN_NOSE_COUNT,
  OBSIDIAN_NOSE_SPREAD,
  OBSIDIAN_OVERLOAD_CRUISE_FLAME,
  OBSIDIAN_OVERLOAD_FAN_COUNT,
  OBSIDIAN_OVERLOAD_SPAN,
  OBSIDIAN_OVERLOAD_STRAFE_AT,
  OBSIDIAN_OVERLOAD_STRAFE_BOTTOM,
  OBSIDIAN_OVERLOAD_STRAFE_DIVE,
  OBSIDIAN_OVERLOAD_STRAFE_END,
  OBSIDIAN_OVERLOAD_STRAFE_ROUNDS,
  OBSIDIAN_OVERLOAD_STRAFE_SHOTS,
  OBSIDIAN_OVERLOAD_STRAFE_TELL,
  OBSIDIAN_OVERLOAD_SWEEP_SPREAD,
  OBSIDIAN_PARK_Y,
  OBSIDIAN_POLY_TIME,
  OBSIDIAN_RADIUS,
  OBSIDIAN_SHARD_COUNT,
  OBSIDIAN_SHARD_HARD,
  OBSIDIAN_SHARD_SPEED,
  OBSIDIAN_SLICE,
  OBSIDIAN_STRAFE_BOTTOM,
  OBSIDIAN_STRAFE_DIVE,
  OBSIDIAN_STRAFE_DIVE_Y,
  OBSIDIAN_STRAFE_END,
  OBSIDIAN_STRAFE_ROUND_GAP,
  OBSIDIAN_STRAFE_ROUNDS,
  OBSIDIAN_STRAFE_SHOTS,
  OBSIDIAN_STRAFE_SPEED,
  OBSIDIAN_STRAFE_TELL,
  OBSIDIAN_STRAFE_Y_MAX,
  OBSIDIAN_WING_X,
  OBSIDIAN_WING_Y,
} from '@/game/config';
import type { BossEvents, BossRuntime, BossWorld } from '@/game/systems/boss';
import { checkBulletEnemyCollision } from './collision';

/**
 * Canvas radians. 0 points the blade down the nose. Positive swings the
 * tip to the left. Right-hand blades store the negated angle.
 * Fold is stacked on the fuselage, half is the weapon rail, open is the X.
 */
export const OBSIDIAN_BLADES = [
  {
    id: 'innerL',
    hinge: 'hinge0',
    role: 'inner' as const,
    x: -6,
    y: -16,
    fold: 0.1,
    half: 0.62,
    open: 0.95,
  },
  {
    id: 'outerL',
    hinge: 'hinge1',
    role: 'outer' as const,
    x: -11,
    y: -26,
    fold: 0.24,
    half: 1.08,
    open: 2.16,
  },
  {
    id: 'innerR',
    hinge: 'hinge2',
    role: 'inner' as const,
    x: 6,
    y: -16,
    fold: -0.1,
    half: -0.62,
    open: -0.95,
  },
  {
    id: 'outerR',
    hinge: 'hinge3',
    role: 'outer' as const,
    x: 11,
    y: -26,
    fold: -0.24,
    half: -1.08,
    open: -2.16,
  },
] as const;

const ARMOR_DIST = [14, 28, 46] as const;
const ARMOR_RADIUS = 9;
const FOLD_NOSE = [0.25, 0.7, 1.15] as const;
const FOLD_MISSILE = 1.5;
const HALF_EDGE = [0.12, 0.48, 0.84, 1.2] as const;
const HALF_EDGE_HARD = 1.44;
const HALF_SHARD = [0.3, 0.96] as const;
const HALF_NOSE = 0.72;
const SWEEP_AT = [0.1, 0.32, 0.54, 0.76, 0.98, 1.2] as const;

type PoseName = 'fold' | 'half' | 'open';

interface FightState {
  clock: number;
  from: number[];
  to: number[];
  shown: number[];
  holdFromX: number;
  holdFromY: number;
}

interface StrafePlan {
  tell: number;
  dive: number;
  bottom: number;
  end: number;
  rounds: number;
  shots: readonly { dx: number; vx: number }[];
}

interface BulletBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ObsidianShotPlan {
  consumed: boolean;
  id: string | null;
  amount: number;
}

const states = new WeakMap<BossRuntime, FightState>();

const MAIN_STRAFE: StrafePlan = {
  tell: OBSIDIAN_STRAFE_TELL,
  dive: OBSIDIAN_STRAFE_DIVE,
  bottom: OBSIDIAN_STRAFE_BOTTOM,
  end: OBSIDIAN_STRAFE_END,
  rounds: OBSIDIAN_STRAFE_ROUNDS,
  shots: OBSIDIAN_STRAFE_SHOTS,
};

const OVER_STRAFE: StrafePlan = {
  tell: OBSIDIAN_OVERLOAD_STRAFE_TELL,
  dive: OBSIDIAN_OVERLOAD_STRAFE_DIVE,
  bottom: OBSIDIAN_OVERLOAD_STRAFE_BOTTOM,
  end: OBSIDIAN_OVERLOAD_STRAFE_END,
  rounds: OBSIDIAN_OVERLOAD_STRAFE_ROUNDS,
  shots: OBSIDIAN_OVERLOAD_STRAFE_SHOTS,
};

function poseAngles(name: PoseName): number[] {
  return OBSIDIAN_BLADES.map((blade) => blade[name]);
}

function anglesForPhase(id: string | undefined): number[] {
  if (id === 'half') return poseAngles('half');
  if (id === 'open' || id === 'overload') return poseAngles('open');
  return poseAngles('fold');
}

function fresh(): FightState {
  const shown = poseAngles('fold');
  return {
    clock: 0,
    from: shown.slice(),
    to: shown.slice(),
    shown,
    holdFromX: OBSIDIAN_CENTER_X,
    holdFromY: OBSIDIAN_PARK_Y,
  };
}

function ensure(boss: BossRuntime): FightState {
  let state = states.get(boss);
  if (!state) {
    state = fresh();
    states.set(boss, state);
  }
  return state;
}

function smoothstep(u: number): number {
  const t = Math.max(0, Math.min(1, u));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u;
}

function bladeVector(angle: number, dist: number): { x: number; y: number } {
  return { x: -Math.sin(angle) * dist, y: Math.cos(angle) * dist };
}

/** Hit-circle offset from the boss center for a blade at one pose. */
export function obsidianBladeOffset(index: number, pose: PoseName): { x: number; y: number } {
  const blade = OBSIDIAN_BLADES[index]!;
  const v = bladeVector(blade[pose], OBSIDIAN_BLADE_REACH);
  return { x: blade.x + v.x, y: blade.y + v.y };
}

/** Current canvas angle for blade `index`. Folded until the fight script runs. */
export function obsidianBladeAngle(boss: BossRuntime, index: number): number {
  return ensure(boss).shown[index] ?? 0;
}

function living(boss: BossRuntime, id: string): boolean {
  const part = boss.parts.find((item) => item.id === id);
  return part !== undefined && part.alive && !part.falling;
}

/** Orange ticks on a lock the folded phase will actually damage. */
export function obsidianHingeMarked(boss: BossRuntime, id: string): boolean {
  if (!living(boss, id)) return false;
  if (boss.stage === 'enter') return true;
  return boss.stage === 'fight' && boss.phase === 'folded';
}

/** Write pivot and blade-hit offsets. `syncParts` turns them into world points. */
export function obsidianSyncOffsets(boss: BossRuntime): void {
  const state = ensure(boss);
  const frame = boss.parts.find((part) => part.id === 'frame');
  if (frame && !frame.falling) {
    frame.offsetX = 0;
    frame.offsetY = 0;
  }
  OBSIDIAN_BLADES.forEach((blade, index) => {
    const hinge = boss.parts.find((part) => part.id === blade.hinge);
    if (hinge && !hinge.falling) {
      hinge.offsetX = blade.x;
      hinge.offsetY = blade.y;
    }
    const wing = boss.parts.find((part) => part.id === blade.id);
    if (!wing || wing.falling) return;
    const v = bladeVector(state.shown[index] ?? blade.fold, OBSIDIAN_BLADE_REACH);
    wing.offsetX = blade.x + v.x;
    wing.offsetY = blade.y + v.y;
  });
}

function hits(bullet: BulletBox, x: number, y: number, radius: number): boolean {
  return checkBulletEnemyCollision(bullet.x, bullet.y, bullet.w, bullet.h, x, y, radius);
}

function poseKind(boss: BossRuntime): 'folded' | 'half' | 'open' | 'overload' | 'hold' {
  if (boss.stage === 'transition') return 'hold';
  if (boss.stage === 'enter' || boss.phase === 'folded') return 'folded';
  if (boss.phase === 'half') return 'half';
  if (boss.phase === 'open') return 'open';
  if (boss.phase === 'overload') return 'overload';
  return 'folded';
}

function blocked(boss: BossRuntime, bullet: BulletBox): boolean {
  if (hits(bullet, boss.x, boss.y, OBSIDIAN_RADIUS)) return true;
  for (const part of boss.parts) {
    if (part.id === 'frame' || !part.alive) continue;
    if (hits(bullet, part.worldX, part.worldY, part.radius)) return true;
  }
  return false;
}

/**
 * What a player bullet touches. `amount` is already chipped and clamped.
 * Phase 1 armor consumes the bullet and deals nothing. Phase 2 cannot
 * empty the fuselage.
 */
export function obsidianShotPlan(
  boss: BossRuntime,
  bullet: BulletBox,
  damage: number
): ObsidianShotPlan {
  const kind = poseKind(boss);
  const none = { consumed: false, id: null, amount: 0 };
  if (kind === 'hold') {
    return blocked(boss, bullet) ? { consumed: true, id: null, amount: 0 } : none;
  }

  if (kind === 'folded') {
    for (const blade of OBSIDIAN_BLADES) {
      const lock = boss.parts.find((part) => part.id === blade.hinge);
      if (!lock?.alive) continue;
      if (hits(bullet, lock.worldX, lock.worldY, lock.radius)) {
        return { consumed: true, id: lock.id, amount: damage };
      }
    }
    if (hits(bullet, boss.x, boss.y, OBSIDIAN_RADIUS)) {
      return { consumed: true, id: null, amount: 0 };
    }
    const shown = ensure(boss).shown;
    for (let i = 0; i < OBSIDIAN_BLADES.length; i++) {
      const blade = OBSIDIAN_BLADES[i]!;
      if (!living(boss, blade.id)) continue;
      for (const dist of ARMOR_DIST) {
        const v = bladeVector(shown[i] ?? blade.fold, dist);
        if (hits(bullet, boss.x + blade.x + v.x, boss.y + blade.y + v.y, ARMOR_RADIUS)) {
          return { consumed: true, id: null, amount: 0 };
        }
      }
    }
    return none;
  }

  if (kind === 'half') {
    for (const blade of OBSIDIAN_BLADES) {
      if (blade.role !== 'outer') continue;
      const wing = boss.parts.find((part) => part.id === blade.id);
      if (!wing?.alive) continue;
      if (hits(bullet, wing.worldX, wing.worldY, wing.radius)) {
        return { consumed: true, id: wing.id, amount: damage };
      }
    }
    const frame = boss.parts.find((part) => part.id === 'frame');
    if (frame?.alive && hits(bullet, frame.worldX, frame.worldY, frame.radius)) {
      const chipped = damage * OBSIDIAN_BODY_CHIP;
      const room = Math.max(0, frame.hp - 1);
      return { consumed: true, id: frame.id, amount: Math.min(chipped, room) };
    }
    return none;
  }

  if (kind === 'open') {
    for (const blade of OBSIDIAN_BLADES) {
      if (blade.role !== 'inner') continue;
      const wing = boss.parts.find((part) => part.id === blade.id);
      if (!wing?.alive) continue;
      if (hits(bullet, wing.worldX, wing.worldY, wing.radius)) {
        return { consumed: true, id: wing.id, amount: damage };
      }
    }
  }

  const frame = boss.parts.find((part) => part.id === 'frame');
  if (frame?.alive && hits(bullet, frame.worldX, frame.worldY, frame.radius)) {
    return { consumed: true, id: frame.id, amount: damage };
  }
  return none;
}

/** Fuselage, living locks, and living blades. A stripped blade no longer touches. */
export function obsidianTouches(boss: BossRuntime, px: number, py: number): boolean {
  const near = (x: number, y: number, radius: number): boolean => {
    const dx = px - x;
    const dy = py - y;
    const reach = HITBOX_RADIUS + radius;
    return dx * dx + dy * dy < reach * reach;
  };
  if (near(boss.x, boss.y, OBSIDIAN_RADIUS)) return true;
  for (const part of boss.parts) {
    if (!part.alive || part.falling || part.id === 'frame') continue;
    if (near(part.worldX, part.worldY, part.radius)) return true;
  }
  const shown = ensure(boss).shown;
  for (let i = 0; i < OBSIDIAN_BLADES.length; i++) {
    const blade = OBSIDIAN_BLADES[i]!;
    if (!living(boss, blade.id)) continue;
    for (const dist of ARMOR_DIST) {
      const v = bladeVector(shown[i] ?? blade.fold, dist);
      if (near(boss.x + blade.x + v.x, boss.y + blade.y + v.y, ARMOR_RADIUS)) return true;
    }
  }
  return false;
}

/** Snap the weapon clock and the blade pose for the phase that just opened. */
export function obsidianOnFight(boss: BossRuntime): void {
  const state = ensure(boss);
  state.clock = 0;
  state.shown = anglesForPhase(boss.phase);
  state.from = state.shown.slice();
  state.to = state.shown.slice();
  boss.x = OBSIDIAN_CENTER_X;
  boss.y = OBSIDIAN_PARK_Y;
}

/** Remember the pose so the deploy beat can rotate the blades and ease home. */
export function obsidianOnTransition(boss: BossRuntime): void {
  const state = ensure(boss);
  state.from = state.shown.slice();
  const next = boss.phases[boss.phaseIndex + 1]?.id;
  state.to = anglesForPhase(next);
  state.holdFromX = boss.x;
  state.holdFromY = boss.y;
}

export function stepObsidianHold(boss: BossRuntime): void {
  const state = ensure(boss);
  const duration = boss.phases[boss.phaseIndex]?.transition?.duration ?? OBSIDIAN_DEPLOY_TIME;
  const u = smoothstep(Math.min(1, boss.phaseTime / Math.max(0.0001, duration)));
  state.shown = state.from.map((angle, index) => lerp(angle, state.to[index] ?? angle, u));
  boss.x = lerp(state.holdFromX, OBSIDIAN_CENTER_X, u);
  boss.y = lerp(state.holdFromY, OBSIDIAN_PARK_Y, u);
}

function due(prev: number, now: number, at: number): boolean {
  return at > prev && at <= now + 1e-9;
}

function playerOf(world: BossWorld | undefined): { x: number; y: number } {
  return { x: world?.playerX ?? LOGICAL_W / 2, y: world?.playerY ?? LOGICAL_H * 0.8 };
}

function missile(
  x: number,
  y: number,
  world: BossWorld | undefined,
  ev: BossEvents,
  homing: number
): void {
  const p = playerOf(world);
  const dx = p.x - x;
  const dy = p.y - y;
  const dist = Math.hypot(dx, dy);
  if (dist < AIMED_MIN_DIST) return;
  ev.bolts.push({
    x,
    y,
    vx: (dx / dist) * OBSIDIAN_MISSILE_SPEED,
    vy: (dy / dist) * OBSIDIAN_MISSILE_SPEED,
    type: 'missile',
    homing,
  });
}

function fanAt(
  x: number,
  y: number,
  world: BossWorld | undefined,
  count: number,
  spreadDeg: number,
  ev: BossEvents,
  speed = OBSIDIAN_FAN_SPEED
): void {
  const p = playerOf(world);
  const dx = p.x - x;
  const dy = p.y - y;
  const dist = Math.hypot(dx, dy);
  if (dist < AIMED_MIN_DIST) return;
  const down = Math.PI / 2;
  const limit = (70 * Math.PI) / 180;
  let angle = Math.atan2(dy, dx);
  if (angle < down - limit) angle = down - limit;
  if (angle > down + limit) angle = down + limit;
  const step = count > 1 ? (spreadDeg * Math.PI) / 180 / (count - 1) : 0;
  for (let i = 0; i < count; i++) {
    const a = angle + (i - (count - 1) / 2) * step;
    ev.bolts.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      type: 'large',
      homing: 0,
    });
  }
}

function edgeFan(
  boss: BossRuntime,
  index: number,
  count: number,
  spreadDeg: number,
  speed: number,
  type: 'large' | 'small',
  ev: BossEvents
): void {
  const blade = OBSIDIAN_BLADES[index];
  if (!blade) return;
  const angle = ensure(boss).shown[index] ?? blade.fold;
  const v = bladeVector(angle, OBSIDIAN_BLADE_REACH);
  const x = boss.x + blade.x + v.x;
  const y = boss.y + blade.y + v.y;
  const dir = Math.atan2(v.y, v.x);
  const step = count > 1 ? (spreadDeg * Math.PI) / 180 / (count - 1) : 0;
  for (let i = 0; i < count; i++) {
    const a = dir + (i - (count - 1) / 2) * step;
    ev.bolts.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      type,
      homing: 0,
    });
  }
}

function strafeVolley(boss: BossRuntime, plan: StrafePlan, ev: BossEvents): void {
  const y = boss.y + OBSIDIAN_GUN_Y;
  for (const shot of plan.shots) {
    ev.bolts.push({
      x: boss.x + shot.dx,
      y,
      vx: shot.vx,
      vy: OBSIDIAN_STRAFE_SPEED,
      type: 'small',
      homing: 0,
    });
  }
}

function strafeY(local: number, plan: StrafePlan): number {
  if (local <= plan.tell) return OBSIDIAN_PARK_Y;
  if (local < plan.dive) {
    const u = (local - plan.tell) / (plan.dive - plan.tell);
    return lerp(OBSIDIAN_PARK_Y, OBSIDIAN_STRAFE_DIVE_Y, smoothstep(u));
  }
  if (local <= plan.bottom) return OBSIDIAN_STRAFE_DIVE_Y;
  const u = (local - plan.bottom) / (plan.end - plan.bottom);
  return lerp(OBSIDIAN_STRAFE_DIVE_Y, OBSIDIAN_PARK_Y, smoothstep(Math.min(1, u)));
}

function onCycle(
  prev: number,
  now: number,
  span: number,
  at: readonly number[] | number,
  fire: () => void
): void {
  const times = typeof at === 'number' ? [at] : at;
  const first = Math.floor(prev / span);
  const last = Math.floor((now + 1e-8) / span);
  for (let index = first; index <= last; index++) {
    const start = index * span;
    for (const beat of times) {
      if (due(prev, now, start + beat)) fire();
    }
  }
}

function fireFold(
  boss: BossRuntime,
  prev: number,
  now: number,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  onCycle(prev, now, OBSIDIAN_FOLD_CYCLE, FOLD_NOSE, () => {
    fanAt(boss.x, boss.y + OBSIDIAN_GUN_Y, world, OBSIDIAN_NOSE_COUNT, OBSIDIAN_NOSE_SPREAD, ev);
  });
  onCycle(prev, now, OBSIDIAN_FOLD_CYCLE, FOLD_MISSILE, () => {
    missile(boss.x - OBSIDIAN_WING_X, boss.y + OBSIDIAN_WING_Y, world, ev, OBSIDIAN_MISSILE_HOMING);
    missile(boss.x + OBSIDIAN_WING_X, boss.y + OBSIDIAN_WING_Y, world, ev, OBSIDIAN_MISSILE_HOMING);
  });
}

function fireHalf(
  boss: BossRuntime,
  prev: number,
  now: number,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  const hard = boss.extraArmed;
  const edge = hard ? OBSIDIAN_EDGE_HARD : OBSIDIAN_EDGE_COUNT;
  const shards = hard ? OBSIDIAN_SHARD_HARD : OBSIDIAN_SHARD_COUNT;
  const beats = hard ? [...HALF_EDGE, HALF_EDGE_HARD] : [...HALF_EDGE];
  onCycle(prev, now, OBSIDIAN_HALF_CYCLE, beats, () => {
    OBSIDIAN_BLADES.forEach((blade, index) => {
      if (blade.role !== 'outer' || !living(boss, blade.id)) return;
      edgeFan(boss, index, edge, OBSIDIAN_EDGE_SPREAD, OBSIDIAN_FAN_SPEED, 'large', ev);
    });
  });
  onCycle(prev, now, OBSIDIAN_HALF_CYCLE, HALF_SHARD, () => {
    OBSIDIAN_BLADES.forEach((blade, index) => {
      if (blade.role !== 'outer' || !living(boss, blade.id)) return;
      edgeFan(boss, index, shards, 18, OBSIDIAN_SHARD_SPEED, 'small', ev);
    });
  });
  onCycle(prev, now, OBSIDIAN_HALF_CYCLE, HALF_NOSE, () => {
    fanAt(boss.x, boss.y + OBSIDIAN_GUN_Y, world, OBSIDIAN_NOSE_COUNT, OBSIDIAN_NOSE_SPREAD, ev);
  });
}

function fireOpen(
  boss: BossRuntime,
  prev: number,
  now: number,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  const wingLast = OBSIDIAN_MISSILE_FIRST + (OBSIDIAN_MISSILE_COUNT - 1) * OBSIDIAN_MISSILE_GAP;
  const waves = [
    {
      count: OBSIDIAN_MISSILE_COUNT,
      first: OBSIDIAN_MISSILE_FIRST,
      gap: OBSIDIAN_MISSILE_GAP,
      homing: OBSIDIAN_MISSILE_HOMING,
      center: false,
    },
    {
      count: OBSIDIAN_MISSILE_B_COUNT,
      first: wingLast + OBSIDIAN_MISSILE_B_DELAY,
      gap: OBSIDIAN_MISSILE_B_GAP,
      homing: OBSIDIAN_MISSILE_B_HOMING,
      center: true,
    },
  ];
  const fans = [
    {
      at: OBSIDIAN_POLY_TIME + OBSIDIAN_FAN_SETTLE,
      count: OBSIDIAN_FAN_COUNT,
      spread: OBSIDIAN_FAN_SPREAD,
    },
    {
      at: OBSIDIAN_POLY_TIME + OBSIDIAN_FAN_SETTLE + OBSIDIAN_FAN_B_GAP,
      count: OBSIDIAN_FAN_B_COUNT,
      spread: OBSIDIAN_FAN_B_SPREAD,
    },
  ];
  const first = Math.floor(prev / OBSIDIAN_SLICE);
  const last = Math.floor((now + 1e-8) / OBSIDIAN_SLICE);
  for (let index = first; index <= last; index++) {
    const start = index * OBSIDIAN_SLICE;
    const mode = index % 3;
    if (mode === 0 && living(boss, 'frame')) {
      for (const wave of waves) {
        for (let i = 0; i < wave.count; i++) {
          const at = start + wave.first + i * wave.gap;
          if (!due(prev, now, at)) continue;
          const side = wave.center ? 0 : i % 2 === 0 ? -1 : 1;
          missile(
            boss.x + side * OBSIDIAN_WING_X,
            boss.y + OBSIDIAN_WING_Y,
            world,
            ev,
            wave.homing
          );
        }
      }
    } else if (mode === 1) {
      for (const beat of fans) {
        if (!due(prev, now, start + beat.at)) continue;
        if (living(boss, 'frame')) {
          fanAt(boss.x, boss.y, world, beat.count, beat.spread, ev);
        }
        OBSIDIAN_BLADES.forEach((blade, bladeIndex) => {
          if (blade.role !== 'inner' || !living(boss, blade.id)) return;
          edgeFan(
            boss,
            bladeIndex,
            OBSIDIAN_EDGE_COUNT,
            OBSIDIAN_EDGE_SPREAD,
            OBSIDIAN_FAN_SPEED,
            'large',
            ev
          );
        });
      }
    } else if (living(boss, 'frame')) {
      for (let i = 0; i < MAIN_STRAFE.rounds; i++) {
        const at = start + MAIN_STRAFE.dive + i * OBSIDIAN_STRAFE_ROUND_GAP;
        if (at > start + MAIN_STRAFE.bottom + 1e-6) break;
        if (!due(prev, now, at)) continue;
        strafeVolley(boss, MAIN_STRAFE, ev);
      }
    }
  }
}

function fireOver(
  boss: BossRuntime,
  prev: number,
  now: number,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  onCycle(prev, now, OBSIDIAN_OVERLOAD_SPAN, SWEEP_AT, () => {
    fanAt(
      boss.x,
      boss.y + OBSIDIAN_GUN_Y,
      world,
      OBSIDIAN_OVERLOAD_FAN_COUNT,
      OBSIDIAN_OVERLOAD_SWEEP_SPREAD,
      ev
    );
  });
  const first = Math.floor(prev / OBSIDIAN_OVERLOAD_SPAN);
  const last = Math.floor((now + 1e-8) / OBSIDIAN_OVERLOAD_SPAN);
  for (let index = first; index <= last; index++) {
    const start = index * OBSIDIAN_OVERLOAD_SPAN + OBSIDIAN_OVERLOAD_STRAFE_AT;
    for (let i = 0; i < OVER_STRAFE.rounds; i++) {
      const at = start + OVER_STRAFE.dive + i * OBSIDIAN_STRAFE_ROUND_GAP;
      if (at > start + OVER_STRAFE.bottom + 1e-6) break;
      if (!due(prev, now, at)) continue;
      strafeVolley(boss, OVER_STRAFE, ev);
    }
  }
}

function place(boss: BossRuntime, state: FightState): void {
  boss.x = OBSIDIAN_CENTER_X;
  if (boss.phase === 'open') {
    const index = Math.floor((state.clock + 1e-8) / OBSIDIAN_SLICE);
    const local = state.clock - index * OBSIDIAN_SLICE;
    boss.y =
      index % 3 === 2
        ? Math.min(OBSIDIAN_STRAFE_Y_MAX, strafeY(local, MAIN_STRAFE))
        : OBSIDIAN_PARK_Y;
    return;
  }
  if (boss.phase === 'overload') {
    const local =
      state.clock - Math.floor(state.clock / OBSIDIAN_OVERLOAD_SPAN) * OBSIDIAN_OVERLOAD_SPAN;
    const into = local - OBSIDIAN_OVERLOAD_STRAFE_AT;
    boss.y =
      into >= 0 && into <= OVER_STRAFE.end
        ? Math.min(OBSIDIAN_STRAFE_Y_MAX, strafeY(into, OVER_STRAFE))
        : OBSIDIAN_PARK_Y;
    return;
  }
  boss.y = OBSIDIAN_PARK_Y;
}

/** Advance the live phase. Called only while the boss is actually fighting. */
export function stepObsidian(
  boss: BossRuntime,
  dt: number,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  const state = ensure(boss);
  const prev = state.clock;
  state.clock = prev + dt;
  place(boss, state);
  if (boss.phase === 'half') fireHalf(boss, prev, state.clock, world, ev);
  else if (boss.phase === 'open') fireOpen(boss, prev, state.clock, world, ev);
  else if (boss.phase === 'overload') fireOver(boss, prev, state.clock, world, ev);
  else fireFold(boss, prev, state.clock, world, ev);
}

export interface ObsidianMotion {
  bank: number;
  flameBoost: number;
  warn: boolean;
}

/** Draw hints. The fuselage does not bank; the blades carry the motion. */
export function obsidianMotion(boss: BossRuntime): ObsidianMotion {
  const warn = boss.phase === 'overload';
  if (boss.stage !== 'fight') return { bank: 0, flameBoost: 0, warn };
  if (boss.y > OBSIDIAN_PARK_Y + 1) return { bank: 0, flameBoost: OBSIDIAN_FLAME_BOOST, warn };
  if (warn) return { bank: 0, flameBoost: OBSIDIAN_OVERLOAD_CRUISE_FLAME, warn };
  return { bank: 0, flameBoost: 0, warn };
}

/**
 * Two pods under the wing roots while the overload beat is still young.
 * They are not hitboxes. Blade deploys do not drop them.
 */
export function obsidianJettison(boss: BossRuntime): { x: number; y: number }[] {
  if (boss.stage !== 'transition' || boss.phase !== 'overload') return [];
  if (boss.phaseTime < 0 || boss.phaseTime >= OBSIDIAN_JETTISON_TIME) return [];
  const drop = (boss.phaseTime / OBSIDIAN_JETTISON_TIME) * OBSIDIAN_JETTISON_DROP;
  return [-1, 1].map((side) => ({
    x: boss.x + side * OBSIDIAN_WING_X,
    y: boss.y + 10 + drop,
  }));
}
