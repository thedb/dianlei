/**
 * 炉心 (stage 3 boss). The generic runner still owns parts, HP, phases,
 * bombs, and the victory exit. This module orbits the four pods, opens and
 * shuts the armor petals, and fires the three conventional weapons.
 *
 * State lives in a WeakMap so `BossRuntime` stays the battleship's shape.
 * The iris and the orbit do not read `rng`. No beam weapon: those stay with
 * stage 5. Phase changes and death do not clear bullets that have already
 * left the muzzles.
 *
 * Design: docs/电雷_第三关_炉心Boss设计_v1.md.
 */

import {
  AIMED_MIN_DIST,
  FURNACE_AA_SPEED,
  FURNACE_CLOSED,
  FURNACE_CLOSED_AA_AT,
  FURNACE_CLOSED_AA_GAP,
  FURNACE_CLOSED_AA_LANES,
  FURNACE_CLOSING,
  FURNACE_CORE_RADIUS,
  FURNACE_FLAME_COUNT,
  FURNACE_FLAME_INTERVAL,
  FURNACE_FLAME_SPEED,
  FURNACE_FLAME_SPREAD,
  FURNACE_HULL_H,
  FURNACE_MISSILE_AT,
  FURNACE_MISSILE_COUNT,
  FURNACE_MISSILE_GAP,
  FURNACE_MISSILE_HOMING,
  FURNACE_MISSILE_SPEED,
  FURNACE_MISSILE_X,
  FURNACE_OPEN,
  FURNACE_OPENING,
  FURNACE_OVERLOAD_AA_AT,
  FURNACE_OVERLOAD_AA_GAP,
  FURNACE_OVERLOAD_AA_LANES,
  FURNACE_OVERLOAD_CLOSED,
  FURNACE_OVERLOAD_CLOSING,
  FURNACE_OVERLOAD_FLAME_COUNT,
  FURNACE_OVERLOAD_FLAME_INTERVAL,
  FURNACE_OVERLOAD_FLAME_SPREAD,
  FURNACE_OVERLOAD_MISSILE_COUNT,
  FURNACE_OVERLOAD_OPEN,
  FURNACE_OVERLOAD_OPENING,
  FURNACE_PETAL_RADIUS,
  FURNACE_PETAL_REST,
  FURNACE_PETAL_STEP,
  FURNACE_PETAL_TRAVEL,
  FURNACE_POD_AA_BURST,
  FURNACE_POD_AA_GAP,
  FURNACE_POD_AA_INTERVAL,
  FURNACE_POD_AA_LANES,
  FURNACE_POD_AA_STEP,
  FURNACE_POD_ANGLES,
  FURNACE_POD_FAN_COUNT,
  FURNACE_POD_FAN_FIRST,
  FURNACE_POD_FAN_INTERVAL,
  FURNACE_POD_FAN_SPEED,
  FURNACE_POD_FAN_SPREAD,
  FURNACE_POD_FAN_STAGGER,
  FURNACE_POD_MISSILE_FIRST,
  FURNACE_POD_MISSILE_INTERVAL,
  FURNACE_POD_ORBIT,
  FURNACE_POD_SPIN,
} from '@/game/config';
import type { EnemyBulletType } from '@/game/entities/enemyBullet';
import { checkBulletEnemyCollision } from '@/game/systems/collision';
import {
  bossHullRect,
  bossPart,
  damageBossPart,
  type BossEvents,
  type BossPartRuntime,
  type BossRuntime,
  type BossWorld,
  type BulletBox,
} from '@/game/systems/boss';

export type FurnaceIris = 'closed' | 'opening' | 'open' | 'closing';
export type FurnaceMode = 'pods' | 'core' | 'overload';

export interface FurnacePetalCenter {
  x: number;
  y: number;
  deg: number;
}

export interface FurnaceDebris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  deg: number;
}

export interface FurnacePodMount {
  x: number;
  y: number;
  deg: number;
  alive: boolean;
}

interface FurnaceState {
  orbitTime: number;
  mode: FurnaceMode;
  petal: FurnaceIris;
  petalTime: number;
  petalAngle: number;
  clock: number;
  fanNext: number[];
  aaCursor: number;
  aaInBurst: number;
  missileNext: number;
  aaFired: number;
  missileLeft: number;
  missileAt: number;
  flameClock: number;
  flameNext: number;
  debris: FurnaceDebris[] | null;
}

const states = new WeakMap<BossRuntime, FurnaceState>();

const NEXT: Record<FurnaceIris, FurnaceIris> = {
  closed: 'opening',
  opening: 'open',
  open: 'closing',
  closing: 'closed',
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function ensure(boss: BossRuntime): FurnaceState {
  let state = states.get(boss);
  if (!state) {
    state = {
      orbitTime: 0,
      mode: 'pods',
      petal: 'closed',
      petalTime: 0,
      petalAngle: 0,
      clock: 0,
      fanNext: FURNACE_POD_ANGLES.map(
        (_, i) => FURNACE_POD_FAN_FIRST + i * FURNACE_POD_FAN_STAGGER
      ),
      aaCursor: FURNACE_POD_AA_INTERVAL,
      aaInBurst: 0,
      missileNext: FURNACE_POD_MISSILE_FIRST,
      aaFired: 0,
      missileLeft: 0,
      missileAt: FURNACE_MISSILE_AT,
      flameClock: 0,
      flameNext: 0,
      debris: null,
    };
    states.set(boss, state);
  }
  return state;
}

function overloadOf(state: FurnaceState): boolean {
  return state.mode === 'overload';
}

function petalDuration(petal: FurnaceIris, overload: boolean): number {
  if (overload) {
    if (petal === 'closed') return FURNACE_OVERLOAD_CLOSED;
    if (petal === 'opening') return FURNACE_OVERLOAD_OPENING;
    if (petal === 'open') return FURNACE_OVERLOAD_OPEN;
    return FURNACE_OVERLOAD_CLOSING;
  }
  if (petal === 'closed') return FURNACE_CLOSED;
  if (petal === 'opening') return FURNACE_OPENING;
  if (petal === 'open') return FURNACE_OPEN;
  return FURNACE_CLOSING;
}

/** 0° is down-screen, clockwise positive. */
export function furnacePolar(deg: number, radius: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.sin(rad) * radius, y: Math.cos(rad) * radius };
}

export function furnacePodDeg(index: number, orbitTime: number): number {
  return FURNACE_POD_ANGLES[index]! + orbitTime * FURNACE_POD_SPIN;
}

export function furnacePetalOpen(boss: BossRuntime): number {
  const state = ensure(boss);
  if (state.debris) return 0;
  const dur = petalDuration(state.petal, overloadOf(state));
  const u = dur <= 0 ? 0 : clamp(state.petalTime / dur, 0, 1);
  if (state.petal === 'opening') return u;
  if (state.petal === 'closing') return 1 - u;
  if (state.petal === 'open') return 1;
  return 0;
}

export function furnacePetalState(boss: BossRuntime): FurnaceIris {
  return ensure(boss).petal;
}

export function furnacePetalAngle(boss: BossRuntime): number {
  return ensure(boss).petalAngle;
}

export function furnaceMode(boss: BossRuntime): FurnaceMode {
  return ensure(boss).mode;
}

/** Core accepts bullets and homing locks. Pods, closed petals, and the gates do not. */
export function furnaceCoreExposed(boss: BossRuntime): boolean {
  if (boss.def.script !== 'furnace' || boss.stage !== 'fight') return false;
  const state = states.get(boss);
  if (!state || state.mode === 'pods' || state.debris) return false;
  return state.petal === 'opening' || state.petal === 'open';
}

export function furnacePetalCenters(boss: BossRuntime): FurnacePetalCenter[] {
  const state = ensure(boss);
  const open = furnacePetalOpen(boss);
  const radius = FURNACE_PETAL_REST + open * FURNACE_PETAL_TRAVEL;
  const out: FurnacePetalCenter[] = [];
  for (let i = 0; i < 4; i++) {
    const deg = state.petalAngle + i * 90;
    const local = furnacePolar(deg, radius);
    out.push({ x: boss.x + local.x, y: boss.y + local.y, deg });
  }
  return out;
}

export function furnacePods(boss: BossRuntime): FurnacePodMount[] {
  const state = ensure(boss);
  const out: FurnacePodMount[] = [];
  for (let i = 0; i < FURNACE_POD_ANGLES.length; i++) {
    const part = bossPart(boss, `pod${i}`);
    const deg = furnacePodDeg(i, state.orbitTime);
    const local = furnacePolar(deg, FURNACE_POD_ORBIT);
    out.push({
      x: part?.worldX ?? boss.x + local.x,
      y: part?.worldY ?? boss.y + local.y,
      deg,
      alive: part?.alive === true && !part.falling,
    });
  }
  return out;
}

export function furnaceDebris(boss: BossRuntime): readonly FurnaceDebris[] | null {
  return states.get(boss)?.debris ?? null;
}

export function furnaceSyncMounts(boss: BossRuntime): void {
  const state = ensure(boss);
  for (let i = 0; i < FURNACE_POD_ANGLES.length; i++) {
    const part = bossPart(boss, `pod${i}`);
    if (!part || part.falling) continue;
    const local = furnacePolar(furnacePodDeg(i, state.orbitTime), FURNACE_POD_ORBIT);
    part.offsetX = local.x;
    part.offsetY = local.y;
    part.worldX = boss.x + local.x;
    part.worldY = boss.y + local.y;
  }
  const core = bossPart(boss, 'core');
  if (core && !core.falling) {
    core.offsetX = 0;
    core.offsetY = 0;
    core.worldX = boss.x;
    core.worldY = boss.y;
  }
}

function armClosedVolley(state: FurnaceState): void {
  state.aaFired = 0;
  state.missileLeft = overloadOf(state) ? FURNACE_OVERLOAD_MISSILE_COUNT : FURNACE_MISSILE_COUNT;
  state.missileAt = FURNACE_MISSILE_AT;
}

/** A finished close. The next opening faces 45° further around the core. */
function enterClosed(state: FurnaceState): void {
  state.petal = 'closed';
  state.petalTime = 0;
  state.petalAngle += FURNACE_PETAL_STEP;
  armClosedVolley(state);
}

function enterOpening(state: FurnaceState): void {
  state.petal = 'opening';
  state.petalTime = 0;
  state.flameClock = 0;
  state.flameNext = 0;
}

function crossPetal(state: FurnaceState): void {
  const next = NEXT[state.petal];
  if (next === 'closed') enterClosed(state);
  else if (next === 'opening') enterOpening(state);
  else {
    state.petal = next;
    state.petalTime = 0;
  }
}

/** Fresh guns for the phase that just became a fight. Pods do not spin backward. */
export function furnaceOnFight(boss: BossRuntime): void {
  const state = ensure(boss);
  const phase = boss.phases[boss.phaseIndex];
  if (!phase) return;
  if (phase.id === 'pods') {
    state.mode = 'pods';
    state.clock = 0;
    state.fanNext = FURNACE_POD_ANGLES.map(
      (_, i) => FURNACE_POD_FAN_FIRST + i * FURNACE_POD_FAN_STAGGER
    );
    state.aaCursor = FURNACE_POD_AA_INTERVAL;
    state.aaInBurst = 0;
    state.missileNext = FURNACE_POD_MISSILE_FIRST;
    state.petal = 'closed';
    state.petalTime = 0;
    state.petalAngle = 0;
    return;
  }
  state.mode = phase.id === 'overload' ? 'overload' : 'core';
  state.petal = 'closed';
  state.petalTime = 0;
  armClosedVolley(state);
}

export function furnaceOnDeath(boss: BossRuntime): void {
  const state = ensure(boss);
  if (state.debris) return;
  state.debris = furnacePetalCenters(boss).map((petal) => ({
    x: petal.x,
    y: petal.y,
    vx: (petal.x - boss.x) * 1.4,
    vy: (petal.y - boss.y) * 1.4 + 30,
    deg: petal.deg,
  }));
}

export function furnaceStepDebris(boss: BossRuntime, dt: number): void {
  const state = states.get(boss);
  if (!state?.debris) return;
  for (const bit of state.debris) {
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
    bit.vy += 90 * dt;
    bit.deg += dt * 120;
  }
}

function pushBolt(
  ev: BossEvents,
  x: number,
  y: number,
  vx: number,
  vy: number,
  type: EnemyBulletType,
  homing = 0
): void {
  ev.bolts.push({ x, y, vx, vy, type, homing });
}

function shotToward(
  ev: BossEvents,
  x: number,
  y: number,
  deg: number,
  speed: number,
  type: EnemyBulletType,
  homing = 0
): void {
  const local = furnacePolar(deg, speed);
  pushBolt(ev, x, y, local.x, local.y, type, homing);
}

function fan(
  ev: BossEvents,
  x: number,
  y: number,
  deg: number,
  count: number,
  spread: number,
  speed: number,
  type: EnemyBulletType
): void {
  const step = count > 1 ? spread / (count - 1) : 0;
  for (let i = 0; i < count; i++) {
    shotToward(ev, x, y, deg + (i - (count - 1) / 2) * step, speed, type);
  }
}

function parallel(
  ev: BossEvents,
  boss: BossRuntime,
  count: number,
  gap: number,
  speed: number
): void {
  const y = boss.y + FURNACE_HULL_H / 2 - 2;
  const lane = count > 1 ? gap / (count - 1) : 0;
  for (let i = 0; i < count; i++) {
    const x = boss.x + (i - (count - 1) / 2) * lane;
    shotToward(ev, x, y, 0, speed, 'small');
  }
}

function aimDeg(
  x: number,
  y: number,
  world: BossWorld | undefined,
  boss: BossRuntime
): number | null {
  const px = world?.playerX ?? boss.x;
  const py = world?.playerY ?? boss.y + 240;
  const dx = px - x;
  const dy = py - y;
  const dist = Math.hypot(dx, dy);
  if (dist < AIMED_MIN_DIST) return null;
  if (dist < 1) return 0;
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

function missile(
  ev: BossEvents,
  x: number,
  y: number,
  world: BossWorld | undefined,
  boss: BossRuntime
): void {
  const deg = aimDeg(x, y, world, boss);
  if (deg === null) return;
  shotToward(ev, x, y, deg, FURNACE_MISSILE_SPEED, 'missile', FURNACE_MISSILE_HOMING);
}

function flame(
  ev: BossEvents,
  boss: BossRuntime,
  world: BossWorld | undefined,
  overload: boolean
): void {
  const y = boss.y + 8;
  const deg = aimDeg(boss.x, y, world, boss);
  if (deg === null) return;
  fan(
    ev,
    boss.x,
    y,
    deg,
    overload ? FURNACE_OVERLOAD_FLAME_COUNT : FURNACE_FLAME_COUNT,
    overload ? FURNACE_OVERLOAD_FLAME_SPREAD : FURNACE_FLAME_SPREAD,
    FURNACE_FLAME_SPEED,
    'large'
  );
}

function stepPods(
  boss: BossRuntime,
  state: FurnaceState,
  dt: number,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  const t0 = state.clock;
  state.clock += dt;
  const t1 = state.clock;
  for (let i = 0; i < FURNACE_POD_ANGLES.length; i++) {
    const part = bossPart(boss, `pod${i}`);
    while (state.fanNext[i]! <= t1 + 1e-9) {
      if (part?.alive && state.fanNext[i]! >= t0 - 1e-9) {
        fan(
          ev,
          part.worldX,
          part.worldY,
          furnacePodDeg(i, state.orbitTime),
          FURNACE_POD_FAN_COUNT,
          FURNACE_POD_FAN_SPREAD,
          FURNACE_POD_FAN_SPEED,
          'small'
        );
      }
      state.fanNext[i] = state.fanNext[i]! + FURNACE_POD_FAN_INTERVAL;
    }
  }

  let guard = 0;
  while (state.aaCursor <= t1 + 1e-9 && guard < 24) {
    guard += 1;
    const at = state.aaCursor;
    if (at >= t0 - 1e-9)
      parallel(ev, boss, FURNACE_POD_AA_LANES, FURNACE_POD_AA_GAP, FURNACE_AA_SPEED);
    state.aaInBurst += 1;
    if (state.aaInBurst >= FURNACE_POD_AA_BURST) {
      const first = at - (FURNACE_POD_AA_BURST - 1) * FURNACE_POD_AA_STEP;
      state.aaInBurst = 0;
      state.aaCursor = first + FURNACE_POD_AA_INTERVAL;
    } else {
      state.aaCursor = at + FURNACE_POD_AA_STEP;
    }
  }

  while (state.missileNext <= t1 + 1e-9) {
    if (state.missileNext >= t0 - 1e-9) {
      for (let i = 0; i < FURNACE_POD_ANGLES.length; i++) {
        const part = bossPart(boss, `pod${i}`);
        if (!part?.alive) continue;
        missile(ev, part.worldX, part.worldY, world, boss);
      }
    }
    state.missileNext += FURNACE_POD_MISSILE_INTERVAL;
  }
}

function fireIrisSlice(
  boss: BossRuntime,
  state: FurnaceState,
  overload: boolean,
  t0: number,
  slice: number,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  const t1 = t0 + slice;
  if (state.petal === 'closed') {
    const marks = overload ? FURNACE_OVERLOAD_AA_AT : FURNACE_CLOSED_AA_AT;
    const lanes = overload ? FURNACE_OVERLOAD_AA_LANES : FURNACE_CLOSED_AA_LANES;
    const gap = overload ? FURNACE_OVERLOAD_AA_GAP : FURNACE_CLOSED_AA_GAP;
    while (state.aaFired < marks.length && marks[state.aaFired]! <= t1 + 1e-9) {
      if (marks[state.aaFired]! >= t0 - 1e-9) parallel(ev, boss, lanes, gap, FURNACE_AA_SPEED);
      state.aaFired += 1;
    }
    let shot = 0;
    while (state.missileLeft > 0 && state.missileAt <= t1 + 1e-9) {
      if (state.missileAt >= t0 - 1e-9) {
        const index =
          (overload ? FURNACE_OVERLOAD_MISSILE_COUNT : FURNACE_MISSILE_COUNT) - state.missileLeft;
        const y = boss.y + FURNACE_HULL_H / 2;
        const x = boss.x + (index % 2 === 0 ? -FURNACE_MISSILE_X : FURNACE_MISSILE_X);
        missile(ev, x, y, world, boss);
      }
      state.missileAt += FURNACE_MISSILE_GAP;
      state.missileLeft -= 1;
      shot += 1;
      if (shot > 12) break;
    }
    return;
  }
  if (state.petal !== 'opening' && state.petal !== 'open') return;
  const interval = overload ? FURNACE_OVERLOAD_FLAME_INTERVAL : FURNACE_FLAME_INTERVAL;
  const end = state.flameClock + slice;
  let guard = 0;
  while (state.flameNext <= end + 1e-9 && guard < 16) {
    guard += 1;
    if (state.flameNext >= state.flameClock - 1e-9) flame(ev, boss, world, overload);
    state.flameNext += interval;
  }
  state.flameClock = end;
}

function stepIris(
  boss: BossRuntime,
  state: FurnaceState,
  dt: number,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  const overload = overloadOf(state);
  let left = dt;
  for (let guard = 0; guard < 8 && left > 1e-9; guard++) {
    const dur = petalDuration(state.petal, overload);
    const room = dur - state.petalTime;
    const slice = Math.min(left, Math.max(0, room));
    if (slice > 0) {
      fireIrisSlice(boss, state, overload, state.petalTime, slice, world, ev);
      state.petalTime += slice;
      left -= slice;
    }
    if (state.petalTime + 1e-8 < dur) return;
    crossPetal(state);
  }
}

/**
 * Advance the orbit, and fire when `weapons` is set. A transition passes
 * `weapons` false: petals stay shut, the ring keeps turning, nothing shoots.
 */
export function stepFurnace(
  boss: BossRuntime,
  dt: number,
  world: BossWorld | undefined,
  ev: BossEvents,
  weapons: boolean
): void {
  const state = ensure(boss);
  if (state.debris) return;
  state.orbitTime += dt;
  if (!weapons || boss.stage === 'transition') {
    if (state.petal !== 'closed') state.petalAngle += FURNACE_PETAL_STEP;
    state.petal = 'closed';
    state.petalTime = 0;
    furnaceSyncMounts(boss);
    return;
  }
  furnaceSyncMounts(boss);
  if (state.mode === 'pods') stepPods(boss, state, dt, world, ev);
  else stepIris(boss, state, dt, world, ev);
  furnaceSyncMounts(boss);
}

function hitsCircle(bullet: BulletBox, x: number, y: number, radius: number): boolean {
  return checkBulletEnemyCollision(bullet.x, bullet.y, bullet.w, bullet.h, x, y, radius);
}

function hitsHull(boss: BossRuntime, bullet: BulletBox): boolean {
  const hull = bossHullRect(boss);
  const left = bullet.x - bullet.w / 2;
  const top = bullet.y - bullet.h / 2;
  return (
    left < hull.x + hull.w &&
    left + bullet.w > hull.x &&
    top < hull.y + hull.h &&
    top + bullet.h > hull.y
  );
}

function hitsPetal(boss: BossRuntime, bullet: BulletBox): boolean {
  return furnacePetalCenters(boss).some((petal) =>
    hitsCircle(bullet, petal.x, petal.y, FURNACE_PETAL_RADIUS)
  );
}

function nearestLivingPod(boss: BossRuntime, x: number, y: number): BossPartRuntime | undefined {
  let best: BossPartRuntime | undefined;
  let bestD = Infinity;
  for (let i = 0; i < FURNACE_POD_ANGLES.length; i++) {
    const part = bossPart(boss, `pod${i}`);
    if (!part?.alive || part.falling) continue;
    const d = (part.worldX - x) ** 2 + (part.worldY - y) ** 2;
    if (d < bestD) {
      best = part;
      bestD = d;
    }
  }
  return best;
}

function connect(boss: BossRuntime, part: BossPartRuntime, damage: number, ev: BossEvents): void {
  ev.consumedBullet = true;
  if (boss.invulnerable) return;
  damageBossPart(boss, part, damage, ev);
}

/**
 * Pods take direct hits. A chassis hit in the pod phase is charged to the
 * nearest living pod. Once the iris is up, the core takes a hit only while
 * the petals are opening or open. A closed petal or the plate swallows the
 * bullet and does not touch the core.
 */
export function furnaceTryShot(
  boss: BossRuntime,
  bullet: BulletBox,
  damage: number,
  ev: BossEvents
): boolean {
  if (boss.def.script !== 'furnace') return false;
  const state = ensure(boss);
  if (state.debris) return true;

  const ring = state.mode === 'pods' || boss.stage === 'enter' || boss.stage === 'transition';
  if (ring) {
    for (let i = 0; i < FURNACE_POD_ANGLES.length; i++) {
      const part = bossPart(boss, `pod${i}`);
      if (!part?.alive || part.falling) continue;
      if (hitsCircle(bullet, part.worldX, part.worldY, part.radius)) {
        connect(boss, part, damage, ev);
        return true;
      }
    }
    if (hitsHull(boss, bullet) || hitsPetal(boss, bullet)) {
      ev.consumedBullet = true;
      if (!boss.invulnerable) {
        const pod = nearestLivingPod(boss, bullet.x, bullet.y);
        if (pod) connect(boss, pod, damage, ev);
      }
      return true;
    }
    return false;
  }

  const core = bossPart(boss, 'core');
  if (
    furnaceCoreExposed(boss) &&
    core?.alive &&
    hitsCircle(bullet, core.worldX, core.worldY, FURNACE_CORE_RADIUS)
  ) {
    connect(boss, core, damage, ev);
    return true;
  }
  if (hitsPetal(boss, bullet) || hitsHull(boss, bullet)) {
    ev.consumedBullet = true;
    return true;
  }
  return false;
}
