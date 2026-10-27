/**
 * 炉心 (stage 3 boss) script. The generic runner still owns parts, HP, phases,
 * the drift, death, and the victory exit. This module adds the four orbiting
 * gun pods, the petal iris that gates the core, and the three weapons
 * (pod fan / parallel flak / missiles, then flame fan). No laser.
 *
 * State lives in a WeakMap so `BossRuntime` keeps its shape for the stage-1
 * and stage-2 digests. Only types come from `systems/boss.ts`: a value import
 * would close a runtime cycle (boss.ts calls into this module).
 *
 * Design: docs/电雷_第三关_炉心Boss设计_v1.md. Angles are degrees, 0° straight
 * down, increasing clockwise on screen. Orbit and iris read time, never `rng`.
 * Nothing here clears or converts bullets that are already flying.
 */

import {
  AIMED_MIN_DIST,
  FIXED_DT,
  FURNACE_CLOSED_MISSILE_AT,
  FURNACE_CLOSED_MISSILE_GAP,
  FURNACE_CLOSED_MISSILE_X,
  FURNACE_CORE_FLAK_AT,
  FURNACE_CORE_FLAK_GAP,
  FURNACE_CORE_FLAK_LANES,
  FURNACE_CORE_MISSILES,
  FURNACE_CORE_RADIUS,
  FURNACE_FLAK_ROUND_GAP,
  FURNACE_FLAK_ROUNDS,
  FURNACE_FLAK_SPEED,
  FURNACE_FLAME_COUNT,
  FURNACE_FLAME_INTERVAL,
  FURNACE_FLAME_SPEED,
  FURNACE_FLAME_SPREAD,
  FURNACE_HULL_H,
  FURNACE_HULL_W,
  FURNACE_IRIS_MAIN,
  FURNACE_IRIS_OVERLOAD,
  FURNACE_MISSILE_HOMING,
  FURNACE_MISSILE_SPEED,
  FURNACE_OVERLOAD_FLAK_AT,
  FURNACE_OVERLOAD_FLAK_GAP,
  FURNACE_OVERLOAD_FLAK_LANES,
  FURNACE_OVERLOAD_FLAME_COUNT,
  FURNACE_OVERLOAD_FLAME_INTERVAL,
  FURNACE_OVERLOAD_FLAME_SPREAD,
  FURNACE_OVERLOAD_MISSILES,
  FURNACE_PETAL_RADIUS,
  FURNACE_PETAL_REST,
  FURNACE_PETAL_STEP,
  FURNACE_PETAL_TRAVEL,
  FURNACE_PETAL_TURN,
  FURNACE_POD_ANGLES,
  FURNACE_POD_FAN_COUNT,
  FURNACE_POD_FAN_FIRST,
  FURNACE_POD_FAN_INTERVAL,
  FURNACE_POD_FAN_SPEED,
  FURNACE_POD_FAN_SPREAD,
  FURNACE_POD_FAN_STAGGER,
  FURNACE_POD_FLAK_FIRST,
  FURNACE_POD_FLAK_GAP,
  FURNACE_POD_FLAK_INTERVAL,
  FURNACE_POD_FLAK_LANES,
  FURNACE_POD_MISSILE_FIRST,
  FURNACE_POD_MISSILE_INTERVAL,
  FURNACE_POD_ORBIT,
  FURNACE_POD_SPIN,
  LOGICAL_H,
  LOGICAL_W,
} from '@/game/config';
import type { BossPhaseDef } from '@/game/levels/types';
import { checkBulletEnemyCollision } from '@/game/systems/collision';
import type {
  BossEvents,
  BossPartRuntime,
  BossRuntime,
  BossWorld,
  BulletBox,
} from '@/game/systems/boss';

export const FURNACE_CORE_ID = 'core';
export const FURNACE_POD_IDS = ['pod0', 'pod1', 'pod2', 'pod3'] as const;
export const FURNACE_PETALS = 4;

export type FurnaceIris = 'closed' | 'opening' | 'open' | 'closing';
/**
 * Pod art state. `active` is the one pod that takes damage now (cracked,
 * smoking, highlighted); `intact` pods wait their turn; `wrecked` pods stay on
 * the orbit as a shell and take no hits.
 */
export type FurnacePodLook = 'intact' | 'active' | 'wrecked';
const IRIS_ORDER: readonly FurnaceIris[] = ['closed', 'opening', 'open', 'closing'];

type IrisTable = Readonly<Record<FurnaceIris, number>>;

interface FurnaceState {
  /** Seconds the pods have orbited. Fight and transitions only. */
  orbitTime: number;
  /** Pod-phase weapon clock, from that phase's fight start. */
  podClock: number;
  podFans: number[];
  podFlakRounds: number;
  podMissileWaves: number;
  list: 'main' | 'overload';
  iris: FurnaceIris;
  irisTime: number;
  /** Completed returns to `closed`. Each one turns the petals 45°. */
  turns: number;
  closedRounds: number;
  closedMissiles: number;
  /** Seconds since `opening` began, for the flame clock. */
  flameTime: number;
  flames: number;
  /** Openness when a transition started; it closes from there. */
  holdOpen: number;
  /** `orbitTime` when each pod was first seen destroyed; NaN while it lives. Art only. */
  podDown: number[];
}

const states = new WeakMap<BossRuntime, FurnaceState>();
const DEG = Math.PI / 180;

function freshState(): FurnaceState {
  return {
    orbitTime: 0,
    podClock: 0,
    podFans: FURNACE_POD_ANGLES.map(() => 0),
    podDown: FURNACE_POD_ANGLES.map(() => NaN),
    podFlakRounds: 0,
    podMissileWaves: 0,
    list: 'main',
    iris: 'closed',
    irisTime: 0,
    turns: 0,
    closedRounds: 0,
    closedMissiles: 0,
    flameTime: 0,
    flames: 0,
    holdOpen: 0,
  };
}

function ensure(boss: BossRuntime): FurnaceState {
  let state = states.get(boss);
  if (!state) {
    state = freshState();
    states.set(boss, state);
  }
  return state;
}

function irisTable(state: FurnaceState): IrisTable {
  return state.list === 'overload' ? FURNACE_IRIS_OVERLOAD : FURNACE_IRIS_MAIN;
}

function smoothstep(u: number): number {
  const t = Math.max(0, Math.min(1, u));
  return t * t * (3 - 2 * t);
}

/** True for a phase whose target is the core (露核 or overload). */
export function furnaceCorePhase(phase: BossPhaseDef | undefined): boolean {
  return phase?.targets.includes(FURNACE_CORE_ID) === true;
}

/** Phase whose rules apply now. A transition already points at the next phase. */
function livePhase(boss: BossRuntime): BossPhaseDef | undefined {
  if (boss.stage !== 'enter' && boss.stage !== 'fight' && boss.stage !== 'transition') {
    return undefined;
  }
  return boss.phases[boss.phaseIndex];
}

/** Pod orbit angle in degrees (0 down, clockwise on screen). */
export function furnacePodAngle(boss: BossRuntime, index: number): number {
  const state = states.get(boss);
  const base = FURNACE_POD_ANGLES[index] ?? 0;
  return base + FURNACE_POD_SPIN * (state?.orbitTime ?? 0);
}

/** Screen offset for an angle and a distance: 0° is (0, +r), 90° is (−r, 0). */
export function furnaceOffset(angleDeg: number, r: number): { x: number; y: number } {
  const a = angleDeg * DEG;
  return { x: -Math.sin(a) * r, y: Math.cos(a) * r };
}

/** Velocity heading (canvas radians) of the outward normal at this angle. */
function outwardRad(angleDeg: number): number {
  const o = furnaceOffset(angleDeg, 1);
  return Math.atan2(o.y, o.x);
}

/** Pod world positions follow the orbit; the core stays on the hull center. */
export function furnaceSyncMounts(boss: BossRuntime): void {
  for (const part of boss.parts) {
    if (part.falling) continue;
    const index = (FURNACE_POD_IDS as readonly string[]).indexOf(part.id);
    if (index < 0) {
      part.worldX = boss.x + part.offsetX;
      part.worldY = boss.y + part.offsetY;
      continue;
    }
    const o = furnaceOffset(furnacePodAngle(boss, index), FURNACE_POD_ORBIT);
    part.worldX = boss.x + o.x;
    part.worldY = boss.y + o.y;
  }
}

/** Iris state, or null before the core phase. */
export function furnaceIris(boss: BossRuntime): FurnaceIris | null {
  const state = states.get(boss);
  if (!state || !furnaceCorePhase(livePhase(boss))) return null;
  if (boss.stage !== 'fight') return 'closed';
  return state.iris;
}

/** 0 = petals shut over the core, 1 = fully open. */
export function furnaceOpenness(boss: BossRuntime): number {
  const state = states.get(boss);
  if (!state) return 0;
  if (boss.stage === 'transition') return Math.max(0, state.holdOpen - boss.phaseTime / 0.3);
  if (boss.stage === 'death') return state.holdOpen;
  if (boss.stage !== 'fight' || !furnaceCorePhase(livePhase(boss))) return 0;
  const table = irisTable(state);
  const u = state.irisTime / Math.max(0.0001, table[state.iris]);
  switch (state.iris) {
    case 'opening':
      return smoothstep(u);
    case 'open':
      return 1;
    case 'closing':
      return 1 - smoothstep(u);
    default:
      return 0;
  }
}

/** Petal 0's axis, degrees. Includes the 45° turn animating at the start of `closed`. */
export function furnacePetalBase(boss: BossRuntime): number {
  const state = states.get(boss);
  if (!state) return 45;
  let turns = state.turns;
  if (boss.stage === 'fight' && state.iris === 'closed' && turns > 0) {
    const u = smoothstep(state.irisTime / FURNACE_PETAL_TURN);
    turns = turns - 1 + u;
  }
  return 45 + FURNACE_PETAL_STEP * turns;
}

export interface FurnacePetal {
  x: number;
  y: number;
  /** Axis angle in degrees, same convention as the pods. */
  angle: number;
}

export function furnacePetals(boss: BossRuntime): FurnacePetal[] {
  const base = furnacePetalBase(boss);
  const dist = FURNACE_PETAL_REST + FURNACE_PETAL_TRAVEL * furnaceOpenness(boss);
  const out: FurnacePetal[] = [];
  for (let k = 0; k < FURNACE_PETALS; k++) {
    const angle = base + k * 90;
    const o = furnaceOffset(angle, dist);
    out.push({ x: boss.x + o.x, y: boss.y + o.y, angle });
  }
  return out;
}

/** Bullets and homing missiles may damage the core right now. */
export function furnaceCoreExposed(boss: BossRuntime): boolean {
  if (boss.stage !== 'fight' || !furnaceCorePhase(livePhase(boss))) return false;
  const iris = states.get(boss)?.iris ?? 'closed';
  return iris === 'opening' || iris === 'open';
}

/** Homing missiles: pods while they live, the core only while it is exposed. */
export function furnaceAcceptsMissiles(boss: BossRuntime): boolean {
  if (!furnaceCorePhase(livePhase(boss))) return true;
  return furnaceCoreExposed(boss);
}

function podPhase(boss: BossRuntime): boolean {
  const phase = livePhase(boss);
  return phase !== undefined && !furnaceCorePhase(phase);
}

/**
 * The one pod that can take damage: the first living pod in id order
 * (pod0 → pod3, clockwise from the start angle). Pod phase only.
 */
export function furnaceActivePod(boss: BossRuntime): BossPartRuntime | null {
  if (!podPhase(boss)) return null;
  for (const id of FURNACE_POD_IDS) {
    const pod = boss.parts.find((p) => p.id === id);
    if (pod?.alive && !pod.falling) return pod;
  }
  return null;
}

/**
 * Narrow the runner's live targets: in the pod phase only the active pod can
 * be hurt, so bombs and homing missiles reach it alone.
 */
export function furnaceDamageable(boss: BossRuntime, parts: BossPartRuntime[]): BossPartRuntime[] {
  if (!podPhase(boss)) return parts;
  const active = furnaceActivePod(boss);
  return parts.filter((part) => part === active);
}

function onHull(boss: BossRuntime, bullet: BulletBox): boolean {
  const left = bullet.x - bullet.w / 2;
  const top = bullet.y - bullet.h / 2;
  const hx = boss.x - FURNACE_HULL_W / 2;
  const hy = boss.y - FURNACE_HULL_H / 2;
  return (
    left < hx + FURNACE_HULL_W &&
    left + bullet.w > hx &&
    top < hy + FURNACE_HULL_H &&
    top + bullet.h > hy
  );
}

function touches(bullet: BulletBox, x: number, y: number, r: number): boolean {
  return checkBulletEnemyCollision(bullet.x, bullet.y, bullet.w, bullet.h, x, y, r);
}

/**
 * Pod phase: only the active pod's hit circle counts. A waiting pod eats the
 * bullet without hurting anything. The chassis, petals, and core do not stop
 * bullets here, so a shot flies on to a pod orbiting past; a wreck has no hit
 * box either. Ramming the chassis still kills the player (separate check).
 */
function podVerdict(boss: BossRuntime, bullet: BulletBox): 'hit' | 'block' | 'pass' {
  const active = furnaceActivePod(boss);
  if (active && touches(bullet, active.worldX, active.worldY, active.radius)) return 'hit';
  for (const id of FURNACE_POD_IDS) {
    const pod = boss.parts.find((p) => p.id === id);
    if (!pod?.alive || pod === active) continue;
    if (touches(bullet, pod.worldX, pod.worldY, pod.radius)) return 'block';
  }
  return 'pass';
}

/**
 * What a player bullet does from the boss's arrival on. `hit` damages the one
 * live target (the active pod, or the core), `block` eats the bullet, `pass`
 * lets it fly on. Null hands the shot to the generic runner.
 *
 * Pod phase: see `podVerdict`; the body lets bullets through and nothing is
 * moved onto another pod.
 * Core phases: petals block in every state. The chassis blocks while the iris
 * is shut; once it opens, only the throat straight under the core lets shots
 * through, so a bullet has to reach the core radius to count.
 */
export function furnaceShotVerdict(
  boss: BossRuntime,
  bullet: BulletBox
): 'hit' | 'block' | 'pass' | null {
  const phase = livePhase(boss);
  if (!phase) return null;
  if (!furnaceCorePhase(phase)) return podVerdict(boss, bullet);
  if (boss.stage === 'enter') return null;
  const core = boss.parts.find((part) => part.id === FURNACE_CORE_ID);
  const cx = core?.worldX ?? boss.x;
  const cy = core?.worldY ?? boss.y;
  const touchesCore = touches(bullet, cx, cy, FURNACE_CORE_RADIUS);
  const exposed = furnaceCoreExposed(boss);
  if (exposed && touchesCore) return 'hit';
  for (const petal of furnacePetals(boss)) {
    if (touches(bullet, petal.x, petal.y, FURNACE_PETAL_RADIUS)) return 'block';
  }
  if (touchesCore) return 'block';
  if (!onHull(boss, bullet)) return 'pass';
  if (exposed && Math.abs(bullet.x - cx) <= FURNACE_CORE_RADIUS) return 'pass';
  return 'block';
}

/** Fresh weapon clocks for the phase that starts fighting now. Petal turns carry over. */
export function furnaceOnFight(boss: BossRuntime): void {
  const state = ensure(boss);
  const phase = boss.phases[boss.phaseIndex];
  if (!furnaceCorePhase(phase)) {
    state.podClock = 0;
    state.podFans = FURNACE_POD_ANGLES.map(() => 0);
    state.podFlakRounds = 0;
    state.podMissileWaves = 0;
    return;
  }
  state.list = phase?.bar === 'extra' ? 'overload' : 'main';
  enterIris(state, 'closed');
}

/**
 * Call while the boss is still fighting, right before a transition or death.
 * The petals close from this openness (transition) or fly off from it (death).
 */
export function furnaceOnHold(boss: BossRuntime): void {
  const state = ensure(boss);
  state.holdOpen = furnaceOpenness(boss);
}

function enterIris(state: FurnaceState, iris: FurnaceIris): void {
  state.iris = iris;
  state.irisTime = 0;
  if (iris === 'closed') {
    state.closedRounds = 0;
    state.closedMissiles = 0;
  } else if (iris === 'opening') {
    state.flameTime = 0;
    state.flames = 0;
  }
}

/** Advance orbit, iris, and weapons. Fight and transitions only. */
export function stepFurnace(
  boss: BossRuntime,
  dt: number,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  if (boss.stage !== 'fight' && boss.stage !== 'transition') return;
  const state = ensure(boss);
  let left = dt;
  for (let guard = 0; guard < 8000 && left > 1e-9; guard++) {
    const slice = Math.min(FIXED_DT, left);
    state.orbitTime += slice;
    if (boss.stage === 'fight') {
      if (furnaceCorePhase(boss.phases[boss.phaseIndex])) irisSlice(boss, state, slice, world, ev);
      else podSlice(boss, state, slice, world, ev);
    }
    left -= slice;
  }
  furnaceSyncMounts(boss);
  FURNACE_POD_IDS.forEach((id, i) => {
    const pod = boss.parts.find((p) => p.id === id);
    if (pod && !pod.alive && Number.isNaN(state.podDown[i]!)) state.podDown[i] = state.orbitTime;
  });
}

export function furnacePodLook(boss: BossRuntime, pod: BossPartRuntime): FurnacePodLook {
  if (!pod.alive) return 'wrecked';
  return pod === furnaceActivePod(boss) ? 'active' : 'intact';
}

/** Seconds since this pod was destroyed (orbit clock), or null while it lives. */
export function furnacePodWreckAge(boss: BossRuntime, index: number): number | null {
  const state = states.get(boss);
  const down = state?.podDown[index];
  if (!state || down === undefined || Number.isNaN(down)) return null;
  return state.orbitTime - down;
}

function podSlice(
  boss: BossRuntime,
  state: FurnaceState,
  dt: number,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  state.podClock += dt;
  const clock = state.podClock + 1e-9;
  furnaceSyncMounts(boss);
  FURNACE_POD_IDS.forEach((id, i) => {
    const pod = boss.parts.find((part) => part.id === id);
    if (!pod?.alive) return;
    for (let n = 0; n < 4; n++) {
      const at =
        FURNACE_POD_FAN_FIRST +
        i * FURNACE_POD_FAN_STAGGER +
        (state.podFans[i] ?? 0) * FURNACE_POD_FAN_INTERVAL;
      if (clock < at) break;
      podFan(boss, pod, i, ev);
      state.podFans[i] = (state.podFans[i] ?? 0) + 1;
    }
  });
  for (let n = 0; n < 8; n++) {
    const group = Math.floor(state.podFlakRounds / FURNACE_FLAK_ROUNDS);
    const round = state.podFlakRounds % FURNACE_FLAK_ROUNDS;
    const at =
      FURNACE_POD_FLAK_FIRST + group * FURNACE_POD_FLAK_INTERVAL + round * FURNACE_FLAK_ROUND_GAP;
    if (clock < at) break;
    flak(boss, FURNACE_POD_FLAK_LANES, FURNACE_POD_FLAK_GAP, ev);
    state.podFlakRounds++;
  }
  for (let n = 0; n < 4; n++) {
    const at = FURNACE_POD_MISSILE_FIRST + state.podMissileWaves * FURNACE_POD_MISSILE_INTERVAL;
    if (clock < at) break;
    for (const id of FURNACE_POD_IDS) {
      const pod = boss.parts.find((part) => part.id === id);
      if (pod?.alive) missile(pod.worldX, pod.worldY, world, ev);
    }
    state.podMissileWaves++;
  }
}

function irisSlice(
  boss: BossRuntime,
  state: FurnaceState,
  dt: number,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  const table = irisTable(state);
  let left = dt;
  for (let guard = 0; guard < 8 && left > 1e-9; guard++) {
    const duration = table[state.iris];
    const slice = Math.min(left, Math.max(0, duration - state.irisTime));
    state.irisTime += slice;
    if (state.iris === 'opening' || state.iris === 'open') state.flameTime += slice;
    left -= slice;
    fireIrisDue(boss, state, world, ev);
    if (state.irisTime + 1e-9 < duration) return;
    const next = IRIS_ORDER[(IRIS_ORDER.indexOf(state.iris) + 1) % IRIS_ORDER.length]!;
    if (next === 'closed') state.turns++;
    enterIris(state, next);
  }
}

function fireIrisDue(
  boss: BossRuntime,
  state: FurnaceState,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  const overload = state.list === 'overload';
  const clock = state.irisTime + 1e-9;
  if (state.iris === 'closed') {
    const starts = overload ? FURNACE_OVERLOAD_FLAK_AT : FURNACE_CORE_FLAK_AT;
    const lanes = overload ? FURNACE_OVERLOAD_FLAK_LANES : FURNACE_CORE_FLAK_LANES;
    const gap = overload ? FURNACE_OVERLOAD_FLAK_GAP : FURNACE_CORE_FLAK_GAP;
    const total = starts.length * FURNACE_FLAK_ROUNDS;
    while (state.closedRounds < total) {
      const group = Math.floor(state.closedRounds / FURNACE_FLAK_ROUNDS);
      const round = state.closedRounds % FURNACE_FLAK_ROUNDS;
      const at = (starts[group] ?? 0) + round * FURNACE_FLAK_ROUND_GAP;
      if (clock < at) break;
      flak(boss, lanes, gap, ev);
      state.closedRounds++;
    }
    const count = overload ? FURNACE_OVERLOAD_MISSILES : FURNACE_CORE_MISSILES;
    while (state.closedMissiles < count) {
      const at = FURNACE_CLOSED_MISSILE_AT + state.closedMissiles * FURNACE_CLOSED_MISSILE_GAP;
      if (clock < at) break;
      const side = state.closedMissiles % 2 === 0 ? -1 : 1;
      missile(boss.x + side * FURNACE_CLOSED_MISSILE_X, chassisFrontY(boss), world, ev);
      state.closedMissiles++;
    }
    return;
  }
  if (state.iris === 'opening' || state.iris === 'open') {
    const interval = overload ? FURNACE_OVERLOAD_FLAME_INTERVAL : FURNACE_FLAME_INTERVAL;
    for (let n = 0; n < 4; n++) {
      if (state.flameTime + 1e-9 < state.flames * interval) break;
      flame(boss, overload, world, ev);
      state.flames++;
    }
  }
}

function chassisFrontY(boss: BossRuntime): number {
  return boss.y + FURNACE_HULL_H / 2 - 6;
}

function playerOf(world: BossWorld | undefined): { x: number; y: number } {
  return { x: world?.playerX ?? LOGICAL_W / 2, y: world?.playerY ?? LOGICAL_H * 0.8 };
}

function fan(
  ev: BossEvents,
  x: number,
  y: number,
  base: number,
  count: number,
  spreadDeg: number,
  speed: number,
  type: 'small' | 'large'
): void {
  const step = count > 1 ? (spreadDeg * DEG) / (count - 1) : 0;
  for (let i = 0; i < count; i++) {
    const angle = base + (i - (count - 1) / 2) * step;
    ev.bolts.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      type,
      homing: 0,
    });
  }
}

function podFan(boss: BossRuntime, pod: BossPartRuntime, index: number, ev: BossEvents): void {
  const base = outwardRad(furnacePodAngle(boss, index));
  fan(
    ev,
    pod.worldX,
    pod.worldY,
    base,
    FURNACE_POD_FAN_COUNT,
    FURNACE_POD_FAN_SPREAD,
    FURNACE_POD_FAN_SPEED,
    'small'
  );
}

function flak(boss: BossRuntime, lanes: number, gap: number, ev: BossEvents): void {
  const y = boss.y + FURNACE_HULL_H / 2 - 4;
  for (let j = 0; j < lanes; j++) {
    const dx = (j - (lanes - 1) / 2) * gap;
    ev.bolts.push({ x: boss.x + dx, y, vx: 0, vy: FURNACE_FLAK_SPEED, type: 'small', homing: 0 });
  }
}

function missile(x: number, y: number, world: BossWorld | undefined, ev: BossEvents): void {
  const p = playerOf(world);
  const dx = p.x - x;
  const dy = p.y - y;
  const dist = Math.hypot(dx, dy);
  if (dist < AIMED_MIN_DIST) return;
  ev.bolts.push({
    x,
    y,
    vx: (dx / dist) * FURNACE_MISSILE_SPEED,
    vy: (dy / dist) * FURNACE_MISSILE_SPEED,
    type: 'missile',
    homing: FURNACE_MISSILE_HOMING,
  });
}

function flame(
  boss: BossRuntime,
  overload: boolean,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  const core = boss.parts.find((part) => part.id === FURNACE_CORE_ID);
  const x = core?.worldX ?? boss.x;
  const y = core?.worldY ?? boss.y;
  const p = playerOf(world);
  if (Math.hypot(p.x - x, p.y - y) < AIMED_MIN_DIST) return;
  fan(
    ev,
    x,
    y,
    Math.atan2(p.y - y, p.x - x),
    overload ? FURNACE_OVERLOAD_FLAME_COUNT : FURNACE_FLAME_COUNT,
    overload ? FURNACE_OVERLOAD_FLAME_SPREAD : FURNACE_FLAME_SPREAD,
    FURNACE_FLAME_SPEED,
    'large'
  );
}

/** Read-only snapshot for tests and the debug overlay. */
export interface FurnaceReadout {
  iris: FurnaceIris | null;
  irisTime: number;
  turns: number;
  list: 'main' | 'overload';
  openness: number;
}

export function furnaceReadout(boss: BossRuntime): FurnaceReadout | null {
  const state = states.get(boss);
  if (!state || boss.def.script !== 'furnace') return null;
  return {
    iris: furnaceIris(boss),
    irisTime: state.irisTime,
    turns: state.turns,
    list: state.list,
    openness: furnaceOpenness(boss),
  };
}
