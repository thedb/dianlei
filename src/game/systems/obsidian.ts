/**
 * 黑曜 fight script. The generic runner still owns parts, HP, the phase
 * gate, and the victory exit. This module owns the three perches and the
 * weapon lap (missiles → polyline fan → strafe).
 *
 * State lives in a WeakMap so `BossRuntime` keeps its shape. Only types come
 * from `systems/boss.ts`: a value import would close a runtime cycle.
 *
 * Design: docs/电雷_第四关_黑曜Boss设计_v1.md §4–§6. Nothing here clears
 * bullets that are already flying. The saucer show is `obsidianSaucer.ts`.
 *
 * HP numbers are a draft aimed at about 40 seconds. Measure in the weapon
 * range (vulcan Lv3 + M1, no T, target y=140 r=32, player y=480) and write
 * the constants back before treating 1200 / 360 as final.
 */

import type { Rng } from '@/engine/rng';
import {
  AIMED_MIN_DIST,
  LOGICAL_H,
  LOGICAL_W,
  OBSIDIAN_BANK,
  OBSIDIAN_CENTER_X,
  OBSIDIAN_FAN_B_COUNT,
  OBSIDIAN_FAN_B_GAP,
  OBSIDIAN_FAN_B_SPREAD,
  OBSIDIAN_FAN_COUNT,
  OBSIDIAN_FAN_SETTLE,
  OBSIDIAN_FAN_SPEED,
  OBSIDIAN_FAN_SPREAD,
  OBSIDIAN_FLAME_BOOST,
  OBSIDIAN_GUN_Y,
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
  OBSIDIAN_OVERLOAD_CRUISE_FLAME,
  OBSIDIAN_OVERLOAD_FAN_B_COUNT,
  OBSIDIAN_OVERLOAD_FAN_B_GAP,
  OBSIDIAN_OVERLOAD_FAN_B_SPREAD,
  OBSIDIAN_OVERLOAD_FAN_COUNT,
  OBSIDIAN_OVERLOAD_FAN_SPREAD,
  OBSIDIAN_OVERLOAD_MISSILE_B_COUNT,
  OBSIDIAN_OVERLOAD_MISSILE_B_DELAY,
  OBSIDIAN_OVERLOAD_MISSILE_B_GAP,
  OBSIDIAN_OVERLOAD_MISSILE_COUNT,
  OBSIDIAN_OVERLOAD_MISSILE_FIRST,
  OBSIDIAN_OVERLOAD_MISSILE_GAP,
  OBSIDIAN_OVERLOAD_POLY_TIME,
  OBSIDIAN_OVERLOAD_SLICE,
  OBSIDIAN_OVERLOAD_STRAFE_BOTTOM,
  OBSIDIAN_OVERLOAD_STRAFE_DIVE,
  OBSIDIAN_OVERLOAD_STRAFE_END,
  OBSIDIAN_OVERLOAD_STRAFE_ROUNDS,
  OBSIDIAN_OVERLOAD_STRAFE_SHOTS,
  OBSIDIAN_OVERLOAD_STRAFE_TELL,
  OBSIDIAN_PARK_Y,
  OBSIDIAN_PERCH_X,
  OBSIDIAN_PHASE_INVULN,
  OBSIDIAN_POLY_TIME,
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

type List = 'main' | 'overload';

interface StrafeShot {
  dx: number;
  vx: number;
}

interface MissileWave {
  count: number;
  first: number;
  gap: number;
  homing: number;
  center: boolean;
}

interface FanBeat {
  at: number;
  count: number;
  spread: number;
}

interface StrafePlan {
  tell: number;
  dive: number;
  bottom: number;
  end: number;
  rounds: number;
  shots: readonly StrafeShot[];
}

interface Move {
  start: number;
  from: number;
  to: number;
  dur: number;
}

interface FightState {
  list: List;
  /** Seconds of this phase's fight. Resets when the overload fight starts. */
  clock: number;
  /** Rest x. Updated when a polyline is chosen, before the ship arrives. */
  perch: number;
  move: Move | null;
  holdFromX: number;
  holdFromY: number;
  holdToX: number;
  holdToY: number;
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

function missileWaves(list: List): MissileWave[] {
  if (list === 'overload') {
    const wingLast =
      OBSIDIAN_OVERLOAD_MISSILE_FIRST +
      (OBSIDIAN_OVERLOAD_MISSILE_COUNT - 1) * OBSIDIAN_OVERLOAD_MISSILE_GAP;
    return [
      {
        count: OBSIDIAN_OVERLOAD_MISSILE_COUNT,
        first: OBSIDIAN_OVERLOAD_MISSILE_FIRST,
        gap: OBSIDIAN_OVERLOAD_MISSILE_GAP,
        homing: OBSIDIAN_MISSILE_HOMING,
        center: false,
      },
      {
        count: OBSIDIAN_OVERLOAD_MISSILE_B_COUNT,
        first: wingLast + OBSIDIAN_OVERLOAD_MISSILE_B_DELAY,
        gap: OBSIDIAN_OVERLOAD_MISSILE_B_GAP,
        homing: OBSIDIAN_MISSILE_B_HOMING,
        center: true,
      },
    ];
  }
  const wingLast = OBSIDIAN_MISSILE_FIRST + (OBSIDIAN_MISSILE_COUNT - 1) * OBSIDIAN_MISSILE_GAP;
  return [
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
}

function fanBeats(list: List): FanBeat[] {
  const poly = polyTime(list);
  if (list === 'overload') {
    return [
      {
        at: poly + OBSIDIAN_FAN_SETTLE,
        count: OBSIDIAN_OVERLOAD_FAN_COUNT,
        spread: OBSIDIAN_OVERLOAD_FAN_SPREAD,
      },
      {
        at: poly + OBSIDIAN_FAN_SETTLE + OBSIDIAN_OVERLOAD_FAN_B_GAP,
        count: OBSIDIAN_OVERLOAD_FAN_B_COUNT,
        spread: OBSIDIAN_OVERLOAD_FAN_B_SPREAD,
      },
    ];
  }
  return [
    { at: poly + OBSIDIAN_FAN_SETTLE, count: OBSIDIAN_FAN_COUNT, spread: OBSIDIAN_FAN_SPREAD },
    {
      at: poly + OBSIDIAN_FAN_SETTLE + OBSIDIAN_FAN_B_GAP,
      count: OBSIDIAN_FAN_B_COUNT,
      spread: OBSIDIAN_FAN_B_SPREAD,
    },
  ];
}

function fresh(): FightState {
  return {
    list: 'main',
    clock: 0,
    perch: OBSIDIAN_CENTER_X,
    move: null,
    holdFromX: OBSIDIAN_CENTER_X,
    holdFromY: OBSIDIAN_PARK_Y,
    holdToX: OBSIDIAN_CENTER_X,
    holdToY: OBSIDIAN_PARK_Y,
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

function sliceOf(list: List): number {
  return list === 'overload' ? OBSIDIAN_OVERLOAD_SLICE : OBSIDIAN_SLICE;
}

function strafeOf(list: List): StrafePlan {
  return list === 'overload' ? OVER_STRAFE : MAIN_STRAFE;
}

function polyTime(list: List): number {
  return list === 'overload' ? OBSIDIAN_OVERLOAD_POLY_TIME : OBSIDIAN_POLY_TIME;
}

/** Index of the mode that contains `clock`. A hair past a boundary counts. */
function modeIndex(clock: number, slice: number): number {
  return Math.floor((clock + 1e-8) / slice);
}

function smoothstep(u: number): number {
  const t = Math.max(0, Math.min(1, u));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u;
}

function follow(boss: BossRuntime): void {
  for (const part of boss.parts) {
    if (part.falling) continue;
    part.worldX = boss.x + part.offsetX;
    part.worldY = boss.y + part.offsetY;
  }
}

function playerOf(world: BossWorld | undefined): { x: number; y: number } {
  return { x: world?.playerX ?? LOGICAL_W / 2, y: world?.playerY ?? LOGICAL_H * 0.8 };
}

/** The other two perches, left then right. Never the one we are on. */
function nextPerch(current: number, rng: Rng): number {
  const others = OBSIDIAN_PERCH_X.filter((x) => x !== current);
  const left = others[0] ?? OBSIDIAN_CENTER_X;
  const right = others[1] ?? left;
  return rng() < 0.5 ? left : right;
}

function beginPolyline(state: FightState, index: number, rng: Rng): void {
  const slice = sliceOf(state.list);
  const from = state.perch;
  const to = nextPerch(from, rng);
  state.move = { start: index * slice, from, to, dur: polyTime(state.list) };
  state.perch = to;
}

/** Snap the logical list and the weapon clock. The perch is kept. */
export function obsidianOnFight(boss: BossRuntime): void {
  const state = ensure(boss);
  state.list = boss.phases[boss.phaseIndex]?.bar === 'extra' ? 'overload' : 'main';
  state.clock = 0;
  state.move = null;
  boss.x = state.perch;
  boss.y = OBSIDIAN_PARK_Y;
  follow(boss);
}

/** Remember the pose so the 1.2s beat can ease back to the perch and park y. */
export function obsidianOnTransition(boss: BossRuntime): void {
  const state = ensure(boss);
  state.holdFromX = boss.x;
  state.holdFromY = boss.y;
  state.holdToX = state.perch;
  state.holdToY = OBSIDIAN_PARK_Y;
}

export function stepObsidianHold(boss: BossRuntime): void {
  const state = ensure(boss);
  const u = smoothstep(Math.min(1, boss.phaseTime / OBSIDIAN_PHASE_INVULN));
  boss.x = lerp(state.holdFromX, state.holdToX, u);
  boss.y = lerp(state.holdFromY, state.holdToY, u);
  follow(boss);
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

function place(boss: BossRuntime, state: FightState): void {
  const slice = sliceOf(state.list);
  const index = modeIndex(state.clock, slice);
  const mode = index % 3;
  const local = state.clock - index * slice;
  if (mode === 2) {
    // Strafe keeps the perch it entered on. It does not start another polyline.
    boss.x = state.perch;
    boss.y = Math.min(OBSIDIAN_STRAFE_Y_MAX, strafeY(local, strafeOf(state.list)));
    return;
  }
  const move = state.move;
  if (mode === 1 && move) {
    const u = (state.clock - move.start) / move.dur;
    if (u < 1) {
      boss.x = lerp(move.from, move.to, smoothstep(Math.max(0, u)));
      boss.y = OBSIDIAN_PARK_Y;
      return;
    }
  }
  boss.x = state.perch;
  boss.y = OBSIDIAN_PARK_Y;
}

function due(prev: number, now: number, at: number): boolean {
  return at > prev && at <= now + 1e-9;
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
  ev: BossEvents
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
      vx: Math.cos(a) * OBSIDIAN_FAN_SPEED,
      vy: Math.sin(a) * OBSIDIAN_FAN_SPEED,
      type: 'large',
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

function fireWindow(
  boss: BossRuntime,
  state: FightState,
  prev: number,
  now: number,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  const slice = sliceOf(state.list);
  const plan = strafeOf(state.list);
  const waves = missileWaves(state.list);
  const beats = fanBeats(state.list);
  const first = modeIndex(prev, slice);
  const last = modeIndex(now, slice);
  for (let index = first; index <= last; index++) {
    const start = index * slice;
    const mode = index % 3;
    if (mode === 0) {
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
      for (const beat of beats) {
        if (due(prev, now, start + beat.at)) {
          fanAt(boss.x, boss.y, world, beat.count, beat.spread, ev);
        }
      }
    } else {
      for (let i = 0; i < plan.rounds; i++) {
        const at = start + plan.dive + i * OBSIDIAN_STRAFE_ROUND_GAP;
        if (at > start + plan.bottom + 1e-6) break;
        if (!due(prev, now, at)) continue;
        strafeVolley(boss, plan, ev);
      }
    }
  }
}

/** Advance the lap. Called only while the phase is actually fighting. */
export function stepObsidian(
  boss: BossRuntime,
  dt: number,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  const state = ensure(boss);
  const prev = state.clock;
  const next = prev + dt;
  const slice = sliceOf(state.list);
  const rng = world?.rng ?? (() => 0);
  const prevIndex = modeIndex(prev, slice);
  const nextIndex = modeIndex(next, slice);
  for (let index = prevIndex + 1; index <= nextIndex; index++) {
    if (index % 3 === 1) beginPolyline(state, index, rng);
  }
  state.clock = next;
  place(boss, state);
  fireWindow(boss, state, prev, next, world, ev);
  follow(boss);
}

export interface ObsidianMotion {
  /** Radians, positive clockwise, toward the perch it is flying to. */
  bank: number;
  /** Passed to the tail flame. 0 on a cruise perch. */
  flameBoost: number;
  /** Overload cockpit. The hull art stays the same silhouette. */
  warn: boolean;
}

/** What the draw pass needs from the fight. The saucer overrides this. */
export function obsidianMotion(boss: BossRuntime): ObsidianMotion {
  const state = states.get(boss);
  const warn = boss.phase === 'overload';
  const cruise = warn ? OBSIDIAN_OVERLOAD_CRUISE_FLAME : 0;
  if (!state || boss.stage !== 'fight') return { bank: 0, flameBoost: 0, warn };
  const slice = sliceOf(state.list);
  const mode = modeIndex(state.clock, slice) % 3;
  const move = state.move;
  if (mode === 1 && move) {
    const u = (state.clock - move.start) / move.dur;
    if (u >= 0 && u < 1) {
      const dir = Math.sign(move.to - move.from);
      return {
        bank: dir * Math.sin(Math.PI * u) * OBSIDIAN_BANK,
        flameBoost: OBSIDIAN_FLAME_BOOST,
        warn,
      };
    }
  }
  if (mode === 2) return { bank: 0, flameBoost: OBSIDIAN_FLAME_BOOST, warn };
  return { bank: 0, flameBoost: cruise, warn };
}

/**
 * Two pods under the wing roots while the overload beat is still young.
 * Screen points. They are not hitboxes and they are not bullets.
 */
export function obsidianJettison(boss: BossRuntime): { x: number; y: number }[] {
  if (boss.stage !== 'transition' || boss.def.script !== 'obsidian') return [];
  if (boss.phaseTime < 0 || boss.phaseTime >= OBSIDIAN_JETTISON_TIME) return [];
  const drop = (boss.phaseTime / OBSIDIAN_JETTISON_TIME) * OBSIDIAN_JETTISON_DROP;
  return [-1, 1].map((side) => ({
    x: boss.x + side * OBSIDIAN_WING_X,
    y: boss.y + 10 + drop,
  }));
}
