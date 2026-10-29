/**
 * 黑曜 fight script. During a fight the fuselage cruises a lemniscate
 * around (180, 140). Four blades rotate around hinge pivots: stacked
 * swept wings, a wider peel, then the cross. The generic runner owns
 * part HP. This module owns the angles, which circle a shot hits, the
 * cruise, and the weapon lap for the live phase.
 *
 * v3 wings trail aft, so an along-blade volley would leave upward. The
 * edge fan keeps that lateral bearing and mirrors it nose-ward. Hit
 * circles stay on the visible wing and are not mirrored.
 *
 * Open and overload run the same figure-8 at twice the angular speed.
 * Their strafe (俯冲前刺) interrupts it: tell eases to (180, 140), then
 * y 140 → 280 → 140 with x pinned, then a short ease back onto the
 * track. The path keeps its clock through the dive. Perch slides stay
 * retired. Enter and deploy still ease toward the path center.
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
  OBSIDIAN_CRUISE_AMP_X,
  OBSIDIAN_CRUISE_AMP_Y,
  OBSIDIAN_CRUISE_PERIOD,
  OBSIDIAN_CRUISE_RAGE_SCALE,
  OBSIDIAN_CRUISE_REJOIN,
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
  OBSIDIAN_HALF_MISSILE_AT,
  OBSIDIAN_HALF_TWIN_AT,
  OBSIDIAN_HALF_TWIN_COUNT,
  OBSIDIAN_HALF_TWIN_GAP,
  OBSIDIAN_HALF_TWIN_SPREAD,
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
 *
 * v3 magnitudes are measured from aft (π). Each hinge carries three visual
 * layers. `fold` / `half` / `open` are the middle layer, which owns the
 * hit circle. Fold is a stacked sweep with lateral span. Half peels the
 * outer layer wider. Open is the X: inners nose-ward at ±0.95, outers
 * aft at ±(π−0.95). Roots stay on their own side so the wing you shoot
 * is the part that breaks.
 */
const AFT = Math.PI;

function aftAngle(side: 1 | -1, mag: number): number {
  return side * (AFT - mag);
}

function aftTriple(
  side: 1 | -1,
  mags: readonly [number, number, number]
): readonly [number, number, number] {
  return [aftAngle(side, mags[0]), aftAngle(side, mags[1]), aftAngle(side, mags[2])];
}

function noseTriple(side: 1 | -1, mag: number): readonly [number, number, number] {
  const angle = side * mag;
  return [angle, angle, angle];
}

const BLADE_LAYOUT = [
  {
    id: 'innerL',
    hinge: 'hinge0',
    role: 'inner' as const,
    x: -16,
    y: 10,
    layers: {
      fold: aftTriple(1, [0.82, 0.66, 0.5]),
      half: aftTriple(1, [1.07, 0.77, 0.53]),
      open: noseTriple(1, 0.95),
    },
  },
  {
    id: 'outerL',
    hinge: 'hinge1',
    role: 'outer' as const,
    x: -14,
    y: -12,
    layers: {
      fold: aftTriple(1, [0.88, 0.72, 0.56]),
      half: aftTriple(1, [1.12, 0.82, 0.58]),
      open: aftTriple(1, [0.95, 0.95, 0.95]),
    },
  },
  {
    id: 'innerR',
    hinge: 'hinge2',
    role: 'inner' as const,
    x: 16,
    y: 10,
    layers: {
      fold: aftTriple(-1, [0.82, 0.66, 0.5]),
      half: aftTriple(-1, [1.07, 0.77, 0.53]),
      open: noseTriple(-1, 0.95),
    },
  },
  {
    id: 'outerR',
    hinge: 'hinge3',
    role: 'outer' as const,
    x: 14,
    y: -12,
    layers: {
      fold: aftTriple(-1, [0.88, 0.72, 0.56]),
      half: aftTriple(-1, [1.12, 0.82, 0.58]),
      open: aftTriple(-1, [0.95, 0.95, 0.95]),
    },
  },
] as const;

type PoseName = 'fold' | 'half' | 'open';

const bladeRows = BLADE_LAYOUT.map((blade) => ({
  ...blade,
  fold: blade.layers.fold[1],
  half: blade.layers.half[1],
  open: blade.layers.open[1],
}));

/** Middle layer is the gameplay angle. The array stays a tuple so callers can index it. */
export const OBSIDIAN_BLADES = [
  bladeRows[0]!,
  bladeRows[1]!,
  bladeRows[2]!,
  bladeRows[3]!,
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

interface FightState {
  clock: number;
  from: number[][];
  to: number[][];
  layers: number[][];
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

function cloneLayers(rows: readonly (readonly number[])[]): number[][] {
  return rows.map((row) => [...row]);
}

function poseLayers(name: PoseName): number[][] {
  return OBSIDIAN_BLADES.map((blade) => [...blade.layers[name]]);
}

function anglesForPhase(id: string | undefined): number[][] {
  if (id === 'half') return poseLayers('half');
  if (id === 'open' || id === 'overload') return poseLayers('open');
  return poseLayers('fold');
}

function midAngle(row: readonly number[] | undefined, fallback = 0): number {
  return row?.[1] ?? row?.[0] ?? fallback;
}

function ragePhase(phase: string): boolean {
  return phase === 'open' || phase === 'overload';
}

/**
 * Lissajous figure-8. θ advances with the fight clock. Open and overload
 * use twice the angular speed. t = 0 sits on the path center.
 */
export function obsidianCruisePoint(clock: number, phase: string): { x: number; y: number } {
  const scale = ragePhase(phase) ? OBSIDIAN_CRUISE_RAGE_SCALE : 1;
  const theta =
    (Math.PI * 2 * Math.max(0, clock) * scale) / Math.max(0.0001, OBSIDIAN_CRUISE_PERIOD);
  return {
    x: OBSIDIAN_CENTER_X + OBSIDIAN_CRUISE_AMP_X * Math.sin(theta),
    y: OBSIDIAN_PARK_Y + OBSIDIAN_CRUISE_AMP_Y * Math.sin(2 * theta),
  };
}

function fresh(): FightState {
  const layers = poseLayers('fold');
  return {
    clock: 0,
    from: cloneLayers(layers),
    to: cloneLayers(layers),
    layers,
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

/** Three visual layers for blade `index`. The middle layer owns the hit circle. */
export function obsidianBladeLayers(boss: BossRuntime, index: number): readonly number[] {
  return ensure(boss).layers[index] ?? OBSIDIAN_BLADES[index]?.layers.fold ?? [0, 0, 0];
}

/** Middle canvas angle for blade `index`. Folded until the fight script runs. */
export function obsidianBladeAngle(boss: BossRuntime, index: number): number {
  return midAngle(obsidianBladeLayers(boss, index));
}

function living(boss: BossRuntime, id: string): boolean {
  const part = boss.parts.find((item) => item.id === id);
  return part !== undefined && part.alive && !part.falling;
}

/**
 * Phase-1 locks the player can break: the nose pair, local y > 0
 * (`hinge0` / `hinge2`). The tail pair stays on the sprite and does not count.
 */
export function obsidianVulnerableHinge(id: string): boolean {
  const blade = OBSIDIAN_BLADES.find((item) => item.hinge === id);
  return blade !== undefined && blade.y > 0;
}

/** Orange ticks on a lock the folded phase will actually damage. */
export function obsidianHingeMarked(boss: BossRuntime, id: string): boolean {
  if (!obsidianVulnerableHinge(id) || !living(boss, id)) return false;
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
    const v = bladeVector(midAngle(state.layers[index], blade.fold), OBSIDIAN_BLADE_REACH);
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
 * Phase 1: the nose locks take the hit. Tail locks, the fuselage circle,
 * and the blade samples consume the bullet and deal nothing. Nose circles
 * are tested first so a shared overlap still damages the real target.
 * Phase 2 cannot empty the fuselage.
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
      if (!obsidianVulnerableHinge(blade.hinge)) continue;
      const lock = boss.parts.find((part) => part.id === blade.hinge);
      if (!lock?.alive) continue;
      if (hits(bullet, lock.worldX, lock.worldY, lock.radius)) {
        return { consumed: true, id: lock.id, amount: damage };
      }
    }
    for (const blade of OBSIDIAN_BLADES) {
      if (obsidianVulnerableHinge(blade.hinge)) continue;
      const lock = boss.parts.find((part) => part.id === blade.hinge);
      if (!lock?.alive) continue;
      if (hits(bullet, lock.worldX, lock.worldY, lock.radius)) {
        return { consumed: true, id: null, amount: 0 };
      }
    }
    if (hits(bullet, boss.x, boss.y, OBSIDIAN_RADIUS)) {
      return { consumed: true, id: null, amount: 0 };
    }
    const layers = ensure(boss).layers;
    for (let i = 0; i < OBSIDIAN_BLADES.length; i++) {
      const blade = OBSIDIAN_BLADES[i]!;
      if (!living(boss, blade.id)) continue;
      for (const dist of ARMOR_DIST) {
        const v = bladeVector(midAngle(layers[i], blade.fold), dist);
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
  const layers = ensure(boss).layers;
  for (let i = 0; i < OBSIDIAN_BLADES.length; i++) {
    const blade = OBSIDIAN_BLADES[i]!;
    if (!living(boss, blade.id)) continue;
    for (const dist of ARMOR_DIST) {
      const v = bladeVector(midAngle(layers[i], blade.fold), dist);
      if (near(boss.x + blade.x + v.x, boss.y + blade.y + v.y, ARMOR_RADIUS)) return true;
    }
  }
  return false;
}

/** Snap the weapon clock and the blade pose for the phase that just opened. */
export function obsidianOnFight(boss: BossRuntime): void {
  const state = ensure(boss);
  state.clock = 0;
  state.layers = anglesForPhase(boss.phase);
  state.from = cloneLayers(state.layers);
  state.to = cloneLayers(state.layers);
  boss.x = OBSIDIAN_CENTER_X;
  boss.y = OBSIDIAN_PARK_Y;
}

/** Remember the pose so the deploy beat can rotate the blades and ease home. */
export function obsidianOnTransition(boss: BossRuntime): void {
  const state = ensure(boss);
  state.from = cloneLayers(state.layers);
  const next = boss.phases[boss.phaseIndex + 1]?.id;
  state.to = anglesForPhase(next);
  state.holdFromX = boss.x;
  state.holdFromY = boss.y;
}

export function stepObsidianHold(boss: BossRuntime): void {
  const state = ensure(boss);
  const duration = boss.phases[boss.phaseIndex]?.transition?.duration ?? OBSIDIAN_DEPLOY_TIME;
  const u = smoothstep(Math.min(1, boss.phaseTime / Math.max(0.0001, duration)));
  state.layers = state.from.map((row, index) =>
    row.map((angle, layer) => lerp(angle, state.to[index]?.[layer] ?? angle, u))
  );
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
  const angle = midAngle(ensure(boss).layers[index], blade.fold);
  const along = bladeVector(angle, OBSIDIAN_BLADE_REACH);
  const x = boss.x + blade.x + along.x;
  const y = boss.y + blade.y + along.y;
  // Swept wings trail aft. Keep the lateral bearing and send the fan nose-ward.
  const dir = Math.atan2(along.y < 0 ? -along.y : along.y, along.x);
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

function wingMissiles(
  boss: BossRuntime,
  world: BossWorld | undefined,
  ev: BossEvents,
  homing: number
): void {
  missile(boss.x - OBSIDIAN_WING_X, boss.y + OBSIDIAN_WING_Y, world, ev, homing);
  missile(boss.x + OBSIDIAN_WING_X, boss.y + OBSIDIAN_WING_Y, world, ev, homing);
}

function twinNose(boss: BossRuntime, world: BossWorld | undefined, ev: BossEvents): void {
  const y = boss.y + OBSIDIAN_GUN_Y;
  fanAt(
    boss.x - OBSIDIAN_HALF_TWIN_GAP,
    y,
    world,
    OBSIDIAN_HALF_TWIN_COUNT,
    OBSIDIAN_HALF_TWIN_SPREAD,
    ev
  );
  fanAt(
    boss.x + OBSIDIAN_HALF_TWIN_GAP,
    y,
    world,
    OBSIDIAN_HALF_TWIN_COUNT,
    OBSIDIAN_HALF_TWIN_SPREAD,
    ev
  );
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
  onCycle(prev, now, OBSIDIAN_HALF_CYCLE, OBSIDIAN_HALF_TWIN_AT, () => {
    twinNose(boss, world, ev);
  });
  onCycle(prev, now, OBSIDIAN_HALF_CYCLE, OBSIDIAN_HALF_MISSILE_AT, () => {
    wingMissiles(boss, world, ev, OBSIDIAN_MISSILE_HOMING);
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

/** Local time on the open slice or the overload lap, including the rejoin tail. */
function strafeLocal(phase: string, clock: number): { local: number; plan: StrafePlan } | null {
  if (phase === 'open') {
    const index = Math.floor((clock + 1e-8) / OBSIDIAN_SLICE);
    if (index % 3 !== 2) return null;
    return { local: clock - index * OBSIDIAN_SLICE, plan: MAIN_STRAFE };
  }
  if (phase === 'overload') {
    const into =
      clock -
      Math.floor(clock / OBSIDIAN_OVERLOAD_SPAN) * OBSIDIAN_OVERLOAD_SPAN -
      OBSIDIAN_OVERLOAD_STRAFE_AT;
    if (into < 0 || into > OVER_STRAFE.end + OBSIDIAN_CRUISE_REJOIN) return null;
    return { local: into, plan: OVER_STRAFE };
  }
  return null;
}

/** Active dive, tell through the pull-up. The rejoin tail is not part of it. */
function strafeWindow(phase: string, clock: number): { local: number; plan: StrafePlan } | null {
  const hit = strafeLocal(phase, clock);
  if (!hit || hit.local > hit.plan.end) return null;
  return hit;
}

function place(boss: BossRuntime, state: FightState): void {
  const cruise = obsidianCruisePoint(state.clock, boss.phase);
  const hit = strafeLocal(boss.phase, state.clock);
  if (!hit) {
    boss.x = cruise.x;
    boss.y = cruise.y;
    return;
  }
  const { local, plan } = hit;
  if (local <= plan.tell) {
    const u = plan.tell <= 0 ? 1 : smoothstep(local / plan.tell);
    const origin = obsidianCruisePoint(state.clock - local, boss.phase);
    boss.x = lerp(origin.x, OBSIDIAN_CENTER_X, u);
    boss.y = lerp(origin.y, OBSIDIAN_PARK_Y, u);
    return;
  }
  if (local <= plan.end) {
    boss.x = OBSIDIAN_CENTER_X;
    boss.y = Math.min(OBSIDIAN_STRAFE_Y_MAX, strafeY(local, plan));
    return;
  }
  if (local <= plan.end + OBSIDIAN_CRUISE_REJOIN) {
    const u = smoothstep((local - plan.end) / OBSIDIAN_CRUISE_REJOIN);
    boss.x = lerp(OBSIDIAN_CENTER_X, cruise.x, u);
    boss.y = lerp(OBSIDIAN_PARK_Y, cruise.y, u);
    return;
  }
  boss.x = cruise.x;
  boss.y = cruise.y;
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

/** Draw hints. The fuselage does not bank; the blades and the cruise carry the motion. */
export function obsidianMotion(boss: BossRuntime): ObsidianMotion {
  const warn = boss.phase === 'overload';
  if (boss.stage !== 'fight') return { bank: 0, flameBoost: 0, warn };
  if (strafeWindow(boss.phase, ensure(boss).clock)) {
    return { bank: 0, flameBoost: OBSIDIAN_FLAME_BOOST, warn };
  }
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
