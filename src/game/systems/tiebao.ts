/**
 * 铁堡 (stage 2 boss) rail script. The generic runner still owns parts, HP,
 * phases, and the victory exit. This module only moves the hull between the
 * three fixed rails and runs the rail-bound weapon pairs. State lives in a WeakMap so
 * `BossRuntime` stays the battleship's shape for the stage-1 render digest.
 *
 * Design: docs/电雷_第二关_铁堡Boss设计_v1.md. No laser. No Math.random.
 * One turnout curve (`tiebaoSwitchX`) is shared by the background rails and the
 * rigid cars. Cars bank onto that curve. The long sprite is never sheared.
 */

import type { Rng } from '@/engine/rng';
import {
  FIXED_DT,
  HITBOX_RADIUS,
  LOGICAL_H,
  LOGICAL_W,
  TIEBAO_BROADSIDE_COUNT,
  TIEBAO_BROADSIDE_FIRST,
  TIEBAO_BROADSIDE_FROM,
  TIEBAO_BROADSIDE_GAP,
  TIEBAO_BROADSIDE_SPEED,
  TIEBAO_BROADSIDE_STEP,
  TIEBAO_BROADSIDE_SWEEP,
  TIEBAO_BROADSIDE_TO,
  TIEBAO_CRATE_BLAST,
  TIEBAO_CRATE_FLIGHT,
  TIEBAO_CRATE_HP,
  TIEBAO_CRATE_LAND_Y,
  TIEBAO_CRATE_SCORE,
  TIEBAO_CRATE_SIZE,
  TIEBAO_FAN_FIRST,
  TIEBAO_FAN_INTERVAL,
  TIEBAO_FAN_SPREAD,
  TIEBAO_MISSILE_COUNT,
  TIEBAO_MISSILE_GAP,
  TIEBAO_MISSILE_HOMING,
  TIEBAO_MISSILE_SPEED,
  TIEBAO_MISSILE_WAVES,
  TIEBAO_CHASE_FLAME,
  TIEBAO_MOVE,
  TIEBAO_MOVE_EXTRA,
  TIEBAO_OVERLOAD_CRATE_EVERY,
  TIEBAO_OVERLOAD_MISSILE_COUNT,
  TIEBAO_OVERLOAD_MOVE,
  TIEBAO_OVERLOAD_PERIOD,
  TIEBAO_OVERLOAD_RAIN_WARN,
  TIEBAO_CAR_MAX_BANK,
  TIEBAO_CAR_PITCH,
  TIEBAO_CARS,
  TIEBAO_CORE_ROW,
  TIEBAO_END_CARS,
  TIEBAO_END_PARK_Y,
  TIEBAO_ENTER_TAIL_Y,
  TIEBAO_HULL_W,
  TIEBAO_LOCO_H,
  TIEBAO_OVERLOAD_WALL_REPEAT,
  TIEBAO_POINT_AT,
  TIEBAO_FROG_AT,
  TIEBAO_RAIN_COUNT,
  TIEBAO_RAIN_FIRST,
  TIEBAO_RAIN_RADIUS,
  TIEBAO_RAIN_SECOND,
  TIEBAO_RAIN_SEPARATION,
  TIEBAO_RAIN_WARN,
  TIEBAO_RAIL_X,
  TIEBAO_RAM_BOTTOM,
  TIEBAO_RAM_DIVE,
  TIEBAO_RAM_RETURN,
  TIEBAO_RAM_START,
  TIEBAO_RAM_WARN,
  TIEBAO_ROOF_CAR_ROW,
  TIEBAO_ROOF_LOCO_ROW,
  TIEBAO_SHED_BLAST_FRAME,
  TIEBAO_SHED_DELAY,
  TIEBAO_SHED_SLIDE,
  TIEBAO_SWITCH_CROSS_SPAN,
  TIEBAO_SWITCH_LEAD,
  TIEBAO_SWITCH_PERIOD,
  TIEBAO_SWITCH_RUSH,
  TIEBAO_SWITCH_SPAN,
  TIEBAO_WALL_COUNT,
  TIEBAO_WALL_FIRST,
  TIEBAO_WALL_GAP,
  TIEBAO_WALL_REPEAT,
  TIEBAO_WALL_SPEED,
  TIEBAO_WALL_VOLLEYS,
} from '@/game/config';
import { checkBulletEnemyCollision } from '@/game/systems/collision';
import { bombArrivalDelay, boxOnScreen } from '@/game/systems/bomb';
import type { BossEvents, BossRuntime, BossWorld, BulletBox } from '@/game/systems/boss';
import {
  tiebaoCarCenterRow,
  tiebaoCarsFromRatio,
  tiebaoHullHeight,
  tiebaoRamArmed,
  tiebaoRestCenter,
  tiebaoShedCountFromRatio,
  tiebaoTailY,
} from '@/game/systems/tiebaoShed';

export const TIEBAO_MODE_IDS = ['fan', 'missiles', 'rain', 'broadside', 'wall', 'ram'] as const;

export const TIEBAO_MODE_NAMES = [
  '高射扇',
  '导弹齐射',
  '落弹雨',
  '侧舷扫射',
  '封轨弹墙',
  '冲轨撞击',
] as const;

export const TIEBAO_OVERLOAD_MODE_IDS = ['rain', 'wall', 'missiles'] as const;

export type TiebaoModeId = (typeof TIEBAO_MODE_IDS)[number];

/**
 * Mode A is the odd park (1st, 3rd, …). Mode B is the even park.
 * Left 72, center 180, right 288.
 */
const RAIL_MODES = [
  ['broadside', 'wall'],
  ['fan', 'missiles'],
  ['rain', 'ram'],
] as const satisfies ReadonlyArray<readonly [TiebaoModeId, TiebaoModeId]>;

/** Weapon for `visits` parks on `rail`. A visit of 0 displays mode A and does not count. */
export function tiebaoRailMode(rail: number, visits: number): TiebaoModeId {
  const pair = RAIL_MODES[rail] ?? RAIL_MODES[1];
  const count = Math.max(1, Math.floor(visits));
  return count % 2 === 1 ? pair[0] : pair[1];
}
type RailPhase = 'output' | 'move';
type RamPhase = 'idle' | 'warn' | 'dive' | 'return';
type RailIndex = 0 | 1 | 2;

interface CircleWarn {
  x: number;
  y: number;
  radius: number;
  warn: number;
  age: number;
  fromX: number;
  fromY: number;
}

interface AmmoCrate {
  x: number;
  y: number;
  sx: number;
  sy: number;
  lx: number;
  ly: number;
  age: number;
  hp: number;
  alive: boolean;
  /** Seconds until a bomb ring reaches this crate. Negative means unmarked. */
  bombIn: number;
}

/** One laid turnout. Screen y is `worldY1 + scroll`. `live` still tracks the cars. */
interface LaidTurnout {
  fromX: number;
  toX: number;
  /** Heel screen-y minus the scroll at the last placement. */
  worldY1: number;
  span: number;
  /** The move in progress. Its heel follows `tiebaoSwitchBand` until the move ends. */
  live: boolean;
}

interface TiebaoState {
  rail: RailIndex;
  target: RailIndex;
  phase: RailPhase;
  clock: number;
  fromX: number;
  /** Latest world scroll. Laid turnouts ride this after their move ends. */
  scroll: number;
  /** Every switch left on the map, oldest first. Culled once it scrolls off the bottom. */
  laid: LaidTurnout[];
  list: 'main' | 'overload';
  /** Overload cycle index. The main fight reads `visits` instead. */
  mode: number;
  /** Parks on rail 0/1/2. Center starts at 1. Only a finished switch increments. */
  visits: [number, number, number];
  weaponClock: number;
  fanNext: number;
  fanSide: number;
  missileWave: number;
  missileShot: number;
  missileNext: number;
  rainWave: number;
  broadNext: number;
  broadSweep: number;
  broadShot: number;
  wallVolley: number;
  wallNext: number;
  ram: RamPhase;
  /** One dash per output window. Stays set after the retreat so it does not dive again. */
  ramDone: boolean;
  ramClock: number;
  /** Rear cars already drawn as gone. Lags `shedGoal` through the hold and the drop. */
  sheds: number;
  /** HP-derived sheds to reach. Explosions fire when this grows. The picture waits. */
  shedGoal: number;
  /** Sheds whose bursts have already been emitted. */
  shedBurst: number;
  /** `delay` holds the old consist. `slide` drops the remaining cars into the new rest pose. */
  shedPhase: 'idle' | 'delay' | 'slide';
  shedClock: number;
  shedFromY: number;
  shedToY: number;
  /** Seconds the current drop takes. One `TIEBAO_SHED_SLIDE` per car in the batch. */
  shedSlide: number;
  ambient: number;
  circles: CircleWarn[];
  crates: AmmoCrate[];
  broken: boolean;
}

export interface TiebaoView {
  rail: number;
  x: number;
  phase: RailPhase;
  modeId: TiebaoModeId;
  modeName: string;
  list: 'main' | 'overload';
  target: number;
}

export interface TiebaoVisual {
  current: number;
  /** Always -1. The switch does not light a rail. */
  highlight: number;
  hot: boolean;
  /**
   * Live car path. Null while parked. The painted steel is `turnouts`, which
   * keeps this curve after the move and scrolls it off the bottom.
   */
  switch: { fromX: number; toX: number; u: number; tailY: number; height: number } | null;
  /**
   * Closure rails on the map. Stock rails are not in this list. Each entry is
   * the shared curve (`tiebaoClosureX` from y0 to y1). Old ones stay until
   * their top scrolls below the screen.
   */
  turnouts: ReadonlyArray<{ fromX: number; toX: number; y0: number; y1: number }>;
  ramWarn: boolean;
  rocketWarn: boolean;
  circles: ReadonlyArray<{
    x: number;
    y: number;
    radius: number;
    u: number;
    fromX: number;
    fromY: number;
  }>;
  crates: ReadonlyArray<{ x: number; y: number }>;
  broken: boolean;
  smoke: boolean;
}

const states = new WeakMap<BossRuntime, TiebaoState>();
const DEG = Math.PI / 180;
const BROADSIDE_SHOTS = Math.floor((TIEBAO_BROADSIDE_SWEEP - 1e-6) / TIEBAO_BROADSIDE_STEP) + 1;

/** Weapon window between parks. The live move is longer and is not taken out of this. */
function outputSeconds(list: TiebaoState['list']): number {
  if (list === 'overload') return TIEBAO_OVERLOAD_PERIOD - TIEBAO_OVERLOAD_MOVE;
  return TIEBAO_SWITCH_PERIOD - TIEBAO_MOVE;
}

/**
 * Seconds the consist spends on this turnout. Adjacent rails are the base
 * move plus `TIEBAO_MOVE_EXTRA`. A left↔right cross is twice that adjacent
 * time, not another extra on top.
 */
export function tiebaoMoveTime(fromX: number, toX: number): number {
  const adjacent = TIEBAO_MOVE + TIEBAO_MOVE_EXTRA;
  return tiebaoSwitchSpan(fromX, toX) === TIEBAO_SWITCH_CROSS_SPAN ? adjacent * 2 : adjacent;
}

function moveSeconds(state: TiebaoState): number {
  if (state.phase !== 'move') return TIEBAO_MOVE + TIEBAO_MOVE_EXTRA;
  return tiebaoMoveTime(state.fromX, railX(state.target));
}

function smoothstep(u: number): number {
  const t = clamp(u, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Ease that spends most of the dash in the first moments. */
function easeOutCubic(u: number): number {
  const t = clamp(u, 0, 1);
  return 1 - (1 - t) ** 3;
}

function railPitch(): number {
  return TIEBAO_RAIL_X[1] - TIEBAO_RAIL_X[0];
}

/** Adjacent rails use one turnout. L↔R uses the longer compound span. */
export function tiebaoSwitchSpan(fromX: number, toX: number): number {
  return Math.abs(toX - fromX) > railPitch() + 1 ? TIEBAO_SWITCH_CROSS_SPAN : TIEBAO_SWITCH_SPAN;
}

/**
 * The moving bend. `y1` is the heel (still the old rail, larger y) and `y0`
 * is the toe (already the new rail, smaller y). At u=0 the heel sits
 * `TIEBAO_SWITCH_LEAD` above the nose, so the curve is painted before any car
 * leaves `fromX`. At u=1 the toe sits on the tail, so the whole consist is on
 * `toX`. Background rails and cars both use this band.
 */
export function tiebaoSwitchBand(
  u: number,
  tailY: number,
  height: number,
  fromX: number,
  toX: number
): { y0: number; y1: number; span: number } {
  const span = tiebaoSwitchSpan(fromX, toX);
  const noseY = tailY - height;
  const travel = height + span + TIEBAO_SWITCH_LEAD;
  const y1 = noseY - TIEBAO_SWITCH_LEAD + clamp(u, 0, 1) * travel;
  return { y0: y1 - span, y1, span };
}

/** One smoothstep, or two through the middle rail when the rails are not neighbors. */
function turnoutAlong(fromX: number, toX: number, t: number): number {
  const u = clamp(t, 0, 1);
  if (tiebaoSwitchSpan(fromX, toX) === TIEBAO_SWITCH_CROSS_SPAN) {
    const mid = TIEBAO_RAIL_X[1];
    if (u < 0.5) return lerp(fromX, mid, smoothstep(u * 2));
    return lerp(mid, toX, smoothstep((u - 0.5) * 2));
  }
  return lerp(fromX, toX, smoothstep(u));
}

/**
 * Screen X on a closure laid from heel `y1` to toe `y0`. Endpoints are the
 * stock rails. Outside the bend the value is exactly a rail.
 */
export function tiebaoClosureX(
  y: number,
  fromX: number,
  toX: number,
  y0: number,
  y1: number
): number {
  if (y >= y1) return fromX;
  if (y <= y0) return toX;
  const span = Math.max(1e-6, y1 - y0);
  return turnoutAlong(fromX, toX, (y1 - y) / span);
}

/**
 * Screen X of the rail a car at `y` is on during a move.
 * Smaller y (the nose) leads. The curve is `tiebaoClosureX` inside the live band.
 */
export function tiebaoSwitchX(
  y: number,
  fromX: number,
  toX: number,
  u: number,
  tailY: number,
  height: number
): number {
  const { y0, y1 } = tiebaoSwitchBand(u, tailY, height, fromX, toX);
  return tiebaoClosureX(y, fromX, toX, y0, y1);
}

export interface TiebaoTurnoutMark {
  kind: 'points' | 'frog';
  /** Screen y of the hardware. */
  y: number;
  /** Rail this half of the turnout leaves. */
  stockX: number;
  /** Rail this half joins. */
  joinX: number;
}

/** Point blades and frogs on one laid closure. L↔R is two turnouts in series. */
export function tiebaoSpanMarks(
  y0: number,
  y1: number,
  fromX: number,
  toX: number
): TiebaoTurnoutMark[] {
  const span = y1 - y0;
  const cross = tiebaoSwitchSpan(fromX, toX) === TIEBAO_SWITCH_CROSS_SPAN;
  const halves: Array<readonly [number, number, number, number]> = cross
    ? [
        [fromX, TIEBAO_RAIL_X[1], 0, 0.5],
        [TIEBAO_RAIL_X[1], toX, 0.5, 1],
      ]
    : [[fromX, toX, 0, 1]];
  const marks: TiebaoTurnoutMark[] = [];
  for (const [stockX, joinX, t0, t1] of halves) {
    const spanT = t1 - t0;
    marks.push({
      kind: 'points',
      y: y1 - (t0 + spanT * TIEBAO_POINT_AT) * span,
      stockX,
      joinX,
    });
    marks.push({
      kind: 'frog',
      y: y1 - (t0 + spanT * TIEBAO_FROG_AT) * span,
      stockX,
      joinX,
    });
  }
  return marks;
}

/** Point blades and frogs along the live bend. L↔R is two turnouts. */
export function tiebaoTurnoutMarks(
  u: number,
  tailY: number,
  height: number,
  fromX: number,
  toX: number
): TiebaoTurnoutMark[] {
  const { y0, y1 } = tiebaoSwitchBand(u, tailY, height, fromX, toX);
  return tiebaoSpanMarks(y0, y1, fromX, toX);
}

/** Remaining fraction of bar 1. The Hard extra bar reports 0 and does not shed. */
export function tiebaoMainRatio(boss: BossRuntime): number {
  const extra = boss.extraArmed ? boss.extraMax : 0;
  const mainMax = Math.max(1, boss.fightMax - extra);
  const phase = boss.phases[boss.phaseIndex];
  if (phase?.bar === 'extra') return 0;
  let hp = 0;
  for (const part of boss.parts) hp += Math.max(0, part.hp);
  return Math.min(1, hp / mainMax);
}

export function tiebaoCommittedCars(boss: BossRuntime): number {
  const state = states.get(boss);
  if (state) return TIEBAO_CARS - state.sheds;
  return tiebaoCarsFromRatio(tiebaoMainRatio(boss));
}

export function tiebaoLiveHull(boss: BossRuntime): { w: number; h: number } {
  return { w: TIEBAO_HULL_W, h: tiebaoHullHeight(tiebaoCommittedCars(boss)) };
}

export interface TiebaoHullSegment {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Locomotive, then each boxcar still coupled. Heights sum to the live hull. */
export function tiebaoPieces(cars: number): Array<{ row: number; h: number }> {
  const height = tiebaoHullHeight(cars);
  if (cars <= 0) return [{ row: 0, h: height }];
  const pieces: Array<{ row: number; h: number }> = [{ row: 0, h: TIEBAO_LOCO_H }];
  for (let i = 0; i < cars; i++) {
    const row = TIEBAO_LOCO_H + i * TIEBAO_CAR_PITCH;
    pieces.push({ row, h: i === cars - 1 ? height - row : TIEBAO_CAR_PITCH });
  }
  return pieces;
}

export interface TiebaoCarPose {
  /** Live-sprite row of this piece's nose edge. */
  row: number;
  h: number;
  /** Screen center: midpoint of the front and rear rail samples. */
  x: number;
  y: number;
  /** Clockwise radians. 0 on a straight rail, capped at `TIEBAO_CAR_MAX_BANK`. */
  angle: number;
}

/** Chord bank. `length` is the piece height. Zero when the two samples share an X. */
export function tiebaoBankAngle(frontX: number, rearX: number, length: number): number {
  if (length <= 0) return 0;
  const cap = TIEBAO_CAR_MAX_BANK * DEG;
  return clamp(Math.atan2(frontX - rearX, length), -cap, cap);
}

/**
 * One rigid pose per piece. `xAt` is the shared turnout (or a constant rail).
 * Front and rear are the unrotated screen edges; the body sits on their midpoint.
 */
export function tiebaoPiecePoses(
  cars: number,
  top: number,
  xAt: (y: number) => number
): TiebaoCarPose[] {
  return tiebaoPieces(cars).map((piece) => {
    const frontY = top + piece.row;
    const rearY = frontY + piece.h;
    const frontX = xAt(frontY);
    const rearX = xAt(rearY);
    return {
      row: piece.row,
      h: piece.h,
      x: (frontX + rearX) / 2,
      y: (frontY + rearY) / 2,
      angle: tiebaoBankAngle(frontX, rearX, piece.h),
    };
  });
}

/** Live poses. A parked consist is one X and angle 0. A move uses `tiebaoSwitchX`. */
export function tiebaoCarPoses(boss: BossRuntime): TiebaoCarPose[] {
  const cars = tiebaoCommittedCars(boss);
  const top = boss.y - tiebaoHullHeight(cars) / 2;
  const sw = tiebaoVisual(boss)?.switch;
  const xAt = (y: number): number =>
    sw ? tiebaoSwitchX(y, sw.fromX, sw.toX, sw.u, sw.tailY, sw.height) : boss.x;
  return tiebaoPiecePoses(cars, top, xAt);
}

/**
 * One axis-aligned box per rigid car. Parked, the boxes tile the hull.
 * On a turnout each box bounds that car's capped rotation. Not a stack of
 * sheared slices.
 */
export function tiebaoHullSegments(boss: BossRuntime): TiebaoHullSegment[] {
  return tiebaoCarPoses(boss).map((pose) => {
    const c = Math.abs(Math.cos(pose.angle));
    const s = Math.abs(Math.sin(pose.angle));
    const w = TIEBAO_HULL_W * c + pose.h * s;
    const h = TIEBAO_HULL_W * s + pose.h * c;
    return { x: pose.x - w / 2, y: pose.y - h / 2, w, h };
  });
}

function carsOf(state: TiebaoState): number {
  return TIEBAO_CARS - state.sheds;
}

function applyAnchors(boss: BossRuntime, height: number): void {
  const cy = height / 2;
  const rows: Record<string, number> = {
    core: TIEBAO_CORE_ROW,
    roofLoco: TIEBAO_ROOF_LOCO_ROW,
    roofCar: TIEBAO_ROOF_CAR_ROW,
  };
  for (const part of boss.parts) {
    const row = rows[part.id];
    if (row === undefined) continue;
    part.offsetY = row - cy;
  }
}

function consistTop(boss: BossRuntime, cars: number): number {
  return boss.y - tiebaoHullHeight(cars) / 2;
}

/** Visible muzzle. The lead car once it is on screen, otherwise the rear car. */
function muzzleY(boss: BossRuntime, cars: number): number {
  const top = consistTop(boss, cars);
  const lead = top + tiebaoCarCenterRow(0);
  if (lead > 8) return lead;
  return top + tiebaoCarCenterRow(Math.max(0, cars - 1));
}

function burstSheds(state: TiebaoState, ev: BossEvents, toSheds: number): void {
  const from = state.shedBurst;
  if (toSheds <= from) return;
  for (let shed = from; shed < toSheds; shed++) {
    const cars = TIEBAO_CARS - shed;
    const top = tiebaoTailY(cars) - tiebaoHullHeight(cars);
    const y = top + tiebaoCarCenterRow(cars - 1);
    const x = consistX(state, y);
    const frameTime = TIEBAO_SHED_BLAST_FRAME;
    ev.explosions.push({ x, y, delay: 0, size: 'medium', frameTime });
    ev.explosions.push({ x: x - 10, y: y + 8, delay: 0, size: 'small', frameTime });
    ev.explosions.push({ x: x + 8, y: y - 6, delay: 0, size: 'small', frameTime });
  }
  state.shedBurst = toSheds;
}

/** Fight sheds play the hold and the drop. Death, enter, and the extra bar snap. */
function shedAnimated(boss: BossRuntime): boolean {
  if (boss.stage !== 'fight') return false;
  const phase = boss.phases[boss.phaseIndex];
  return phase?.bar !== 'extra';
}

function snapShed(boss: BossRuntime, state: TiebaoState, sheds: number): void {
  state.sheds = Math.max(state.sheds, sheds);
  state.shedGoal = state.sheds;
  state.shedBurst = Math.max(state.shedBurst, state.sheds);
  state.shedPhase = 'idle';
  state.shedClock = 0;
  applyAnchors(boss, tiebaoHullHeight(carsOf(state)));
}

/**
 * Cut the exploded cars out and leave the ones in front where they are.
 * The nose stays put, so nothing slides up into the gap. The later drop
 * carries this center down to the locked rest pose.
 */
function beginHold(state: TiebaoState, boss: BossRuntime): void {
  const fromCars = carsOf(state);
  const toCars = TIEBAO_CARS - state.shedGoal;
  const dropped = Math.max(1, fromCars - toCars);
  const nose = boss.y - tiebaoHullHeight(fromCars) / 2;
  const holdY = nose + tiebaoHullHeight(toCars) / 2;
  state.sheds = state.shedGoal;
  applyAnchors(boss, tiebaoHullHeight(toCars));
  state.shedFromY = holdY;
  state.shedToY = tiebaoRestCenter(toCars);
  state.shedSlide = TIEBAO_SHED_SLIDE * dropped;
  boss.y = holdY;
}

function finishSlide(state: TiebaoState, boss: BossRuntime): void {
  boss.y = state.shedToY;
  state.shedPhase = 'idle';
  state.shedClock = 0;
  if (state.shedGoal > state.sheds && state.ram === 'idle') {
    beginHold(state, boss);
    state.shedPhase = 'delay';
    state.shedClock = 0;
  }
}

/**
 * HP thresholds still decide how many cars leave. The picture waits
 * `TIEBAO_SHED_DELAY`, then the remaining cars drop to the locked rest pose.
 */
function stepShed(boss: BossRuntime, state: TiebaoState, dt: number, ev: BossEvents | null): void {
  // A live turnout owns the pose. HP crossed during the move waits until park.
  if (state.phase === 'move') return;
  const goal = tiebaoShedCountFromRatio(tiebaoMainRatio(boss));
  if (!shedAnimated(boss)) {
    if (ev && goal > state.shedBurst) burstSheds(state, ev, goal);
    if (goal > state.sheds || state.shedPhase !== 'idle') snapShed(boss, state, goal);
    return;
  }
  if (goal > state.shedGoal) {
    if (ev) burstSheds(state, ev, goal);
    state.shedGoal = goal;
    if (state.shedPhase === 'delay') beginHold(state, boss);
  }
  if (state.shedPhase === 'idle' && state.shedGoal > state.sheds && state.ram === 'idle') {
    beginHold(state, boss);
    state.shedPhase = 'delay';
    state.shedClock = 0;
  }
  if (state.shedPhase === 'delay') {
    state.shedClock += dt;
    if (state.shedClock + 1e-9 >= TIEBAO_SHED_DELAY && state.ram === 'idle') {
      state.shedPhase = 'slide';
      state.shedClock = 0;
      state.shedFromY = boss.y;
    }
    return;
  }
  if (state.shedPhase !== 'slide') return;
  state.shedClock += dt;
  const u = smoothstep(clamp(state.shedClock / Math.max(0.05, state.shedSlide), 0, 1));
  boss.y = lerp(state.shedFromY, state.shedToY, u);
  if (state.shedClock + 1e-9 >= state.shedSlide) finishSlide(state, boss);
}

/** 0 while parked. `TIEBAO_CHASE_FLAME` for the shed hold, then back to 0. */
export function tiebaoChaseBoost(boss: BossRuntime): number {
  const state = states.get(boss);
  if (!state || boss.def.script !== 'tiebao' || state.shedPhase !== 'delay') return 0;
  return TIEBAO_CHASE_FLAME;
}

/**
 * Slide-in. The tail eases from just above the screen to the encounter tail.
 * Shedding during the slide snaps the length. The burst waits for the fight.
 */
export function tiebaoPlaceEnter(boss: BossRuntime, u: number): void {
  const state = ensure(boss);
  const sheds = tiebaoShedCountFromRatio(tiebaoMainRatio(boss));
  state.sheds = sheds;
  state.shedGoal = sheds;
  state.shedBurst = sheds;
  state.shedPhase = 'idle';
  state.shedClock = 0;
  const cars = carsOf(state);
  const height = tiebaoHullHeight(cars);
  applyAnchors(boss, height);
  const tail = TIEBAO_ENTER_TAIL_Y + (tiebaoTailY(cars) - TIEBAO_ENTER_TAIL_Y) * clamp(u, 0, 1);
  boss.y = tail - height / 2;
}

function modeIdOf(state: TiebaoState): TiebaoModeId {
  if (state.list === 'overload') {
    return TIEBAO_OVERLOAD_MODE_IDS[state.mode % TIEBAO_OVERLOAD_MODE_IDS.length] ?? 'rain';
  }
  return tiebaoRailMode(state.rail, state.visits[state.rail] ?? 1);
}

function modeNameOf(id: TiebaoModeId): string {
  const index = TIEBAO_MODE_IDS.indexOf(id);
  return TIEBAO_MODE_NAMES[index] ?? id;
}

/** The other two rails, 50/50. `roll` in [0, 1). Never returns `current`. */
export function pickOtherRail(current: number, roll: number): RailIndex {
  const options: readonly [RailIndex, RailIndex] =
    current === 0 ? [1, 2] : current === 2 ? [0, 1] : [0, 2];
  return roll < 0.5 ? options[0] : options[1];
}

function rollOf(world: BossWorld | undefined): number {
  return world ? world.rng() : 0;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u;
}

function railX(index: number): number {
  return TIEBAO_RAIL_X[index] ?? TIEBAO_RAIL_X[1];
}

function resetSchedules(state: TiebaoState): void {
  state.fanNext = TIEBAO_FAN_FIRST;
  state.fanSide = 0;
  state.missileWave = 0;
  state.missileShot = 0;
  state.missileNext = TIEBAO_MISSILE_WAVES[0];
  state.rainWave = 0;
  state.broadNext = TIEBAO_BROADSIDE_FIRST;
  state.broadSweep = 0;
  state.broadShot = 0;
  state.wallVolley = 0;
  state.wallNext = TIEBAO_WALL_FIRST;
  state.ram = 'idle';
  state.ramDone = false;
  state.ramClock = 0;
}

function createState(): TiebaoState {
  const state: TiebaoState = {
    rail: 1,
    target: 1,
    phase: 'output',
    clock: 0,
    fromX: TIEBAO_RAIL_X[1],
    scroll: 0,
    laid: [],
    list: 'main',
    mode: 0,
    visits: [0, 1, 0],
    weaponClock: 0,
    fanNext: 0,
    fanSide: 0,
    missileWave: 0,
    missileShot: 0,
    missileNext: 0,
    rainWave: 0,
    broadNext: 0,
    broadSweep: 0,
    broadShot: 0,
    wallVolley: 0,
    wallNext: 0,
    ram: 'idle',
    ramDone: false,
    ramClock: 0,
    sheds: 0,
    shedGoal: 0,
    shedBurst: 0,
    shedPhase: 'idle',
    shedClock: 0,
    shedFromY: 0,
    shedToY: 0,
    shedSlide: 0,
    ambient: 0,
    circles: [],
    crates: [],
    broken: false,
  };
  resetSchedules(state);
  return state;
}

function ensure(boss: BossRuntime): TiebaoState {
  let state = states.get(boss);
  if (!state) {
    state = createState();
    states.set(boss, state);
    boss.x = railX(state.rail);
  }
  return state;
}

/** Fresh fight, or the overload clock after the 1.2s gate. Core opening does not reset. */
export function tiebaoOnFight(boss: BossRuntime): void {
  const state = ensure(boss);
  if (boss.phase === 'overload' && state.list !== 'overload') {
    state.list = 'overload';
    state.mode = 0;
    state.phase = 'output';
    state.clock = 0;
    state.weaponClock = 0;
    state.target = state.rail;
    resetSchedules(state);
    boss.x = railX(state.rail);
    zeroOffsets(boss);
    snapShed(boss, state, TIEBAO_CARS - TIEBAO_END_CARS);
    boss.y = TIEBAO_END_PARK_Y;
  }
}

export function tiebaoView(boss: BossRuntime): TiebaoView | null {
  const state = states.get(boss);
  if (!state || boss.def.script !== 'tiebao') return null;
  const id = modeIdOf(state);
  return {
    rail: state.rail,
    x: boss.x,
    phase: state.phase,
    modeId: id,
    modeName: modeNameOf(id),
    list: state.list,
    target: state.target,
  };
}

export function tiebaoVisual(boss: BossRuntime): TiebaoVisual | null {
  const state = states.get(boss);
  if (!state || boss.def.script !== 'tiebao') return null;
  const moving = state.phase === 'move';
  return {
    current: state.rail,
    highlight: -1,
    hot: moving,
    switch: moving
      ? {
          fromX: state.fromX,
          toX: railX(state.target),
          u: moveU(state),
          tailY: tiebaoTailY(carsOf(state)),
          height: tiebaoHullHeight(carsOf(state)),
        }
      : null,
    turnouts: state.laid.map((item) => {
      const y1 = item.worldY1 + state.scroll;
      return { fromX: item.fromX, toX: item.toX, y1, y0: y1 - item.span };
    }),
    ramWarn: state.ram === 'warn',
    rocketWarn: false,
    circles: state.circles.map((circle) => ({
      x: circle.x,
      y: circle.y,
      radius: circle.radius,
      u: clamp(circle.age / Math.max(0.05, circle.warn), 0, 1),
      fromX: circle.fromX,
      fromY: circle.fromY,
    })),
    crates: state.crates
      .filter((crate) => crate.alive)
      .map((crate) => ({ x: crate.x, y: crate.y })),
    broken: state.broken,
    smoke: state.list === 'overload' && !state.broken,
  };
}

/** Countdown until the next park. Hot while the turnout is moving. */
export function tiebaoReadout(boss: BossRuntime): { text: string; hot: boolean } | null {
  if (boss.def.script !== 'tiebao' || boss.stage !== 'fight') return null;
  const state = states.get(boss);
  if (!state) return null;
  const remain =
    state.phase === 'output'
      ? outputSeconds(state.list) - state.clock
      : moveSeconds(state) - state.clock;
  return { text: `换轨 ${Math.max(0, remain).toFixed(1)}`, hot: state.phase !== 'output' };
}

function beginMove(state: TiebaoState, world: BossWorld | undefined): void {
  releaseLive(state);
  state.target = pickOtherRail(state.rail, rollOf(world));
  state.fromX = railX(state.rail);
  state.phase = 'move';
  state.clock = 0;
  state.laid.push({
    fromX: state.fromX,
    toX: railX(state.target),
    worldY1: 0,
    span: tiebaoSwitchSpan(state.fromX, railX(state.target)),
    live: true,
  });
}

/** Pin the live closure to the same band the cars sample. */
function anchorLive(state: TiebaoState): void {
  const live = state.laid.find((item) => item.live);
  if (!live || state.phase !== 'move') return;
  const cars = carsOf(state);
  const band = tiebaoSwitchBand(
    moveU(state),
    tiebaoTailY(cars),
    tiebaoHullHeight(cars),
    live.fromX,
    live.toX
  );
  live.span = band.span;
  live.worldY1 = band.y1 - state.scroll;
}

/** The move ended or was cancelled. The steel stays; it no longer tracks the cars. */
function releaseLive(state: TiebaoState): void {
  for (const item of state.laid) item.live = false;
}

function cullTurnouts(state: TiebaoState): void {
  const floor = LOGICAL_H + 32;
  state.laid = state.laid.filter((item) => {
    if (item.live) return true;
    return item.worldY1 - item.span + state.scroll < floor;
  });
}

/** Absolute scroll. Safe to call every frame, including death, when the fight step is idle. */
export function tiebaoSyncScroll(boss: BossRuntime, scroll: number | undefined): void {
  if (scroll === undefined || boss.def.script !== 'tiebao') return;
  const state = states.get(boss);
  if (!state) return;
  state.scroll = scroll;
  cullTurnouts(state);
}

/** Ram and the shed presentation both own `boss.y`. A turnout waits for them. */
function parkedReady(state: TiebaoState): boolean {
  return state.ram === 'idle' && state.shedPhase === 'idle';
}

function advanceRail(state: TiebaoState, dt: number, world: BossWorld | undefined): boolean {
  const output = outputSeconds(state.list);
  if (state.phase === 'output') {
    state.clock += dt;
    if (state.clock >= output && parkedReady(state)) {
      const over = state.clock - output;
      beginMove(state, world);
      state.clock = over;
    } else if (state.clock > output) {
      state.clock = output;
    }
    return false;
  }
  state.clock += dt;
  if (state.clock < moveSeconds(state)) return false;
  anchorLive(state);
  releaseLive(state);
  const over = state.clock - moveSeconds(state);
  state.rail = state.target;
  state.phase = 'output';
  state.clock = over;
  if (state.list === 'overload') {
    state.mode = (state.mode + 1) % TIEBAO_OVERLOAD_MODE_IDS.length;
  } else {
    state.visits[state.rail] += 1;
  }
  state.weaponClock = over;
  resetSchedules(state);
  return true;
}

/**
 * Curve parameter 0 → 1 over the move. A 9-car nose sits far above the screen,
 * so a linear sweep would park the visible tail on the old rail for most of
 * the 1.9s while the bend is still off the top. Spend `TIEBAO_SWITCH_RUSH`
 * bringing the heel down to the screen, then the rest of the move on the
 * visible crossing. A nose that is already on screen stays linear.
 */
function moveU(state: TiebaoState): number {
  const seconds = Math.max(0.05, moveSeconds(state));
  const t = clamp(state.clock / seconds, 0, 1);
  const cars = carsOf(state);
  const height = tiebaoHullHeight(cars);
  const tail = tiebaoTailY(cars);
  const nose = tail - height;
  const span = tiebaoSwitchSpan(state.fromX, railX(state.target));
  const travel = Math.max(1, height + span + TIEBAO_SWITCH_LEAD);
  const visibleY = nose >= 0 ? nose : Math.min(tail, 0);
  const uHit = clamp((visibleY - (nose - TIEBAO_SWITCH_LEAD)) / travel, 0, 1 - TIEBAO_SWITCH_RUSH);
  if (uHit <= TIEBAO_SWITCH_RUSH) return t;
  if (t <= TIEBAO_SWITCH_RUSH) return (t / TIEBAO_SWITCH_RUSH) * uHit;
  const rest = (t - TIEBAO_SWITCH_RUSH) / (1 - TIEBAO_SWITCH_RUSH);
  return uHit + rest * (1 - uHit);
}

function consistX(state: TiebaoState, y: number): number {
  if (state.phase !== 'move') return railX(state.rail);
  const cars = carsOf(state);
  return tiebaoSwitchX(
    y,
    state.fromX,
    railX(state.target),
    moveU(state),
    tiebaoTailY(cars),
    tiebaoHullHeight(cars)
  );
}

function zeroOffsets(boss: BossRuntime): void {
  for (const part of boss.parts) {
    if (part.falling) continue;
    part.offsetX = 0;
    part.worldX = boss.x;
  }
}

/**
 * Parked: one rail center. Moving: the hull center and every part sit on the
 * turnout at their own Y. `syncParts` copies `offsetX` into `worldX`.
 */
function pose(state: TiebaoState, boss: BossRuntime): void {
  if (state.phase !== 'move') {
    boss.x = railX(state.rail);
    zeroOffsets(boss);
    return;
  }
  boss.x = consistX(state, boss.y);
  for (const part of boss.parts) {
    if (part.falling) continue;
    const y = boss.y + part.offsetY;
    part.offsetX = consistX(state, y) - boss.x;
    part.worldX = boss.x + part.offsetX;
  }
}

/**
 * Death and the overload gate cancel a half-finished move. The tail settles
 * onto whichever of the two rails it is closer to, and the cars straighten in
 * that frame. The rail's park count does not advance. The closure already laid
 * stays on the map.
 */
function settleTail(state: TiebaoState, boss: BossRuntime): void {
  if (state.phase === 'move') {
    anchorLive(state);
    releaseLive(state);
    const cars = carsOf(state);
    const tail = tiebaoTailY(cars);
    const x = consistX(state, tail);
    const to = railX(state.target);
    if (Math.abs(x - to) < Math.abs(x - state.fromX)) state.rail = state.target;
  }
  state.target = state.rail;
  state.fromX = railX(state.rail);
  state.phase = 'output';
  state.clock = 0;
  boss.x = railX(state.rail);
  zeroOffsets(boss);
}

function pushBolt(
  ev: BossEvents,
  x: number,
  y: number,
  vx: number,
  vy: number,
  type: 'small' | 'missile',
  hitRadius?: number
): void {
  ev.bolts.push(
    hitRadius === undefined
      ? { x, y, vx, vy, type, homing: 0 }
      : { x, y, vx, vy, type, homing: 0, hitRadius }
  );
}

function fireFan(state: TiebaoState, boss: BossRuntime, ev: BossEvents): void {
  if (modeIdOf(state) !== 'fan') return;
  const cars = carsOf(state);
  const visible = muzzleY(boss, cars);
  for (let n = 0; n < 4 && state.weaponClock + 1e-9 >= state.fanNext; n++) {
    const id = state.fanSide % 2 === 0 ? 'roofCar' : 'roofLoco';
    const part = boss.parts.find((item) => item.id === id);
    const gunY = boss.y + (part?.offsetY ?? 0);
    ev.shots.push({
      fire: { kind: 'fan5', spread: TIEBAO_FAN_SPREAD, interval: TIEBAO_FAN_INTERVAL },
      x: boss.x + (part?.offsetX ?? 0),
      y: gunY > 8 ? gunY : visible,
      rotation: 0,
    });
    state.fanSide++;
    state.fanNext += TIEBAO_FAN_INTERVAL;
  }
}

function fireMissiles(state: TiebaoState, boss: BossRuntime, ev: BossEvents): void {
  if (modeIdOf(state) !== 'missiles') return;
  const count = state.list === 'overload' ? TIEBAO_OVERLOAD_MISSILE_COUNT : TIEBAO_MISSILE_COUNT;
  for (let n = 0; n < 8 && state.missileWave < TIEBAO_MISSILE_WAVES.length; n++) {
    if (state.weaponClock + 1e-9 < state.missileNext) return;
    const side = state.missileShot % 2 === 0 ? -1 : 1;
    ev.shots.push({
      fire: {
        kind: 'pattern',
        pattern: {
          shape: 'aimed',
          bullet: 'missile',
          speed: TIEBAO_MISSILE_SPEED,
          homing: TIEBAO_MISSILE_HOMING,
          minDist: true,
        },
      },
      x: boss.x + side * 28,
      y: muzzleY(boss, carsOf(state)),
      rotation: 0,
    });
    state.missileShot++;
    if (state.missileShot >= count) {
      state.missileWave++;
      state.missileShot = 0;
      state.missileNext = TIEBAO_MISSILE_WAVES[state.missileWave] ?? 1e9;
    } else {
      state.missileNext += TIEBAO_MISSILE_GAP;
    }
  }
}

function spawnRain(state: TiebaoState, boss: BossRuntime, world: BossWorld | undefined): void {
  const warn = state.list === 'overload' ? TIEBAO_OVERLOAD_RAIN_WARN : TIEBAO_RAIN_WARN;
  const px = clamp(world?.playerX ?? LOGICAL_W / 2, 24, LOGICAL_W - 24);
  const py = clamp(world?.playerY ?? 520, 48, LOGICAL_H - 36);
  const spots: Array<{ x: number; y: number }> = [{ x: px, y: py }];
  const rng: Rng | undefined = world?.rng;
  for (let n = 1; n < TIEBAO_RAIN_COUNT; n++) {
    let placed = false;
    if (rng) {
      for (let attempt = 0; attempt < 48 && !placed; attempt++) {
        const x = 24 + rng() * (LOGICAL_W - 48);
        const y = LOGICAL_H * 0.5 + rng() * (LOGICAL_H * 0.42);
        const far = spots.every(
          (spot) => Math.hypot(spot.x - x, spot.y - y) >= TIEBAO_RAIN_SEPARATION
        );
        if (far) {
          spots.push({ x, y });
          placed = true;
        }
      }
    }
    if (!placed) spots.push({ x: 40 + n * 84, y: 400 + (n % 2) * 80 });
  }
  for (const spot of spots) {
    state.circles.push({
      x: spot.x,
      y: spot.y,
      radius: TIEBAO_RAIN_RADIUS,
      warn,
      age: 0,
      fromX: boss.x,
      fromY: muzzleY(boss, carsOf(state)),
    });
  }
}

function fireRain(state: TiebaoState, boss: BossRuntime, world: BossWorld | undefined): void {
  if (modeIdOf(state) !== 'rain') return;
  const at = state.rainWave === 0 ? TIEBAO_RAIN_FIRST : TIEBAO_RAIN_SECOND;
  if (state.rainWave >= 2 || state.weaponClock + 1e-9 < at) return;
  spawnRain(state, boss, world);
  state.rainWave++;
}

function fireBroadside(state: TiebaoState, boss: BossRuntime, ev: BossEvents): void {
  if (modeIdOf(state) !== 'broadside') return;
  if (state.broadSweep >= TIEBAO_BROADSIDE_COUNT) return;
  if (state.weaponClock + 1e-9 < state.broadNext) return;
  const t = (state.broadShot * TIEBAO_BROADSIDE_STEP) / TIEBAO_BROADSIDE_SWEEP;
  const left = lerp(
    Math.PI / 2 + TIEBAO_BROADSIDE_FROM * DEG,
    Math.PI / 2 - TIEBAO_BROADSIDE_TO * DEG,
    t
  );
  const right = lerp(
    Math.PI / 2 - TIEBAO_BROADSIDE_FROM * DEG,
    Math.PI / 2 + TIEBAO_BROADSIDE_TO * DEG,
    t
  );
  const speed = TIEBAO_BROADSIDE_SPEED;
  const y = muzzleY(boss, carsOf(state));
  pushBolt(ev, boss.x - 34, y, Math.cos(left) * speed, Math.sin(left) * speed, 'small');
  pushBolt(ev, boss.x + 34, y, Math.cos(right) * speed, Math.sin(right) * speed, 'small');
  state.broadShot++;
  if (state.broadShot >= BROADSIDE_SHOTS) {
    state.broadSweep++;
    state.broadShot = 0;
    state.broadNext =
      TIEBAO_BROADSIDE_FIRST + state.broadSweep * (TIEBAO_BROADSIDE_SWEEP + TIEBAO_BROADSIDE_GAP);
  } else {
    state.broadNext += TIEBAO_BROADSIDE_STEP;
  }
}

function sealedRails(rail: number): RailIndex[] {
  return rail === 1 ? [0, 2] : [1];
}

function fireWall(state: TiebaoState, boss: BossRuntime, ev: BossEvents): void {
  if (modeIdOf(state) !== 'wall') return;
  if (state.wallVolley >= TIEBAO_WALL_VOLLEYS) return;
  if (state.weaponClock + 1e-9 < state.wallNext) return;
  const top = Math.max(4, consistTop(boss, carsOf(state)) + TIEBAO_ROOF_LOCO_ROW);
  for (const rail of sealedRails(state.rail)) {
    const x = railX(rail);
    for (let i = 0; i < TIEBAO_WALL_COUNT; i++) {
      pushBolt(ev, x, top + i * TIEBAO_WALL_GAP, 0, TIEBAO_WALL_SPEED, 'small');
    }
  }
  state.wallVolley++;
  const gap = state.list === 'overload' ? TIEBAO_OVERLOAD_WALL_REPEAT : TIEBAO_WALL_REPEAT;
  state.wallNext += gap;
}

function spawnCrate(state: TiebaoState, boss: BossRuntime, world: BossWorld | undefined): void {
  if (state.crates.length >= 16) return;
  const ly = TIEBAO_CRATE_LAND_Y - TIEBAO_CRATE_SIZE / 2;
  const crate: AmmoCrate = {
    x: boss.x,
    y: muzzleY(boss, carsOf(state)),
    sx: boss.x + (state.crates.length % 2 === 0 ? -16 : 16),
    sy: muzzleY(boss, carsOf(state)),
    lx: 28 + rollOf(world) * (LOGICAL_W - 56),
    ly,
    age: 0,
    hp: TIEBAO_CRATE_HP,
    alive: true,
    bombIn: -1,
  };
  crate.x = crate.sx;
  crate.y = crate.sy;
  state.crates.push(crate);
}

function stepRam(state: TiebaoState, dt: number, boss: BossRuntime): void {
  if (state.shedPhase !== 'idle') return;
  const home = tiebaoRestCenter(carsOf(state));
  // Disarmed until loco+4 (main HP ≤ 50%). A full consist would fill the screen.
  if (modeIdOf(state) !== 'ram' || !tiebaoRamArmed(carsOf(state))) {
    if (modeIdOf(state) !== 'ram') state.ram = 'idle';
    boss.y = home;
    return;
  }
  if (state.ram === 'idle') {
    if (state.ramDone || state.weaponClock + 1e-9 < TIEBAO_RAM_START) {
      boss.y = home;
      return;
    }
    state.ramDone = true;
    state.ram = 'warn';
    state.ramClock = 0;
  }
  state.ramClock += dt;
  const diveY = TIEBAO_RAM_BOTTOM - tiebaoHullHeight(carsOf(state)) / 2;
  if (state.ram === 'warn') {
    boss.y = home;
    if (state.ramClock >= TIEBAO_RAM_WARN) {
      state.ram = 'dive';
      state.ramClock -= TIEBAO_RAM_WARN;
    }
  }
  if (state.ram === 'dive') {
    const u = easeOutCubic(state.ramClock / Math.max(0.05, TIEBAO_RAM_DIVE));
    boss.y = lerp(home, diveY, u);
    if (state.ramClock >= TIEBAO_RAM_DIVE) {
      state.ram = 'return';
      state.ramClock -= TIEBAO_RAM_DIVE;
    }
  }
  if (state.ram === 'return') {
    const u = clamp(state.ramClock / Math.max(0.05, TIEBAO_RAM_RETURN), 0, 1);
    boss.y = lerp(diveY, home, u);
    if (state.ramClock >= TIEBAO_RAM_RETURN) {
      state.ram = 'idle';
      boss.y = home;
    }
  }
}

function playerHit(world: BossWorld | undefined, x: number, y: number, radius: number): boolean {
  if (!world) return false;
  const reach = radius + HITBOX_RADIUS;
  const dx = world.playerX - x;
  const dy = world.playerY - y;
  return dx * dx + dy * dy <= reach * reach;
}

function stepCircles(
  state: TiebaoState,
  dt: number,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  const left: CircleWarn[] = [];
  for (const circle of state.circles) {
    circle.age += dt;
    if (circle.age >= circle.warn) {
      ev.explosions.push({ x: circle.x, y: circle.y, delay: 0, size: 'medium' });
      if (playerHit(world, circle.x, circle.y, circle.radius)) ev.hurtPlayer = true;
      continue;
    }
    left.push(circle);
  }
  state.circles = left;
}

function stepCrates(
  state: TiebaoState,
  dt: number,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  for (const crate of state.crates) {
    if (!crate.alive) continue;
    crate.age += dt;
    const u = clamp(crate.age / TIEBAO_CRATE_FLIGHT, 0, 1);
    crate.x = lerp(crate.sx, crate.lx, u);
    crate.y = crate.sy + (crate.ly - crate.sy) * u * u;
    if (crate.age >= TIEBAO_CRATE_FLIGHT) {
      crate.alive = false;
      ev.explosions.push({ x: crate.x, y: crate.y, delay: 0, size: 'small' });
      if (playerHit(world, crate.x, crate.y, TIEBAO_CRATE_BLAST)) ev.hurtPlayer = true;
    }
  }
  if (state.crates.length > 24) state.crates = state.crates.filter((crate) => crate.alive);
}

function fireWeapons(
  state: TiebaoState,
  boss: BossRuntime,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  fireFan(state, boss, ev);
  fireMissiles(state, boss, ev);
  fireRain(state, boss, world);
  fireBroadside(state, boss, ev);
  fireWall(state, boss, ev);
}

function fightSlice(
  boss: BossRuntime,
  dt: number,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  const state = ensure(boss);
  if (state.broken) return;
  stepShed(boss, state, dt, ev);
  const arrived = advanceRail(state, dt, world);
  if (arrived) stepShed(boss, state, dt, ev);
  if (state.phase === 'move') {
    if (state.shedPhase === 'idle') boss.y = tiebaoRestCenter(carsOf(state));
    state.ram = 'idle';
  }
  pose(state, boss);
  if (state.phase !== 'move') {
    if (!arrived) state.weaponClock += dt;
    fireWeapons(state, boss, world, ev);
    stepRam(state, dt, boss);
  }
  if (state.phase === 'output' && parkedReady(state)) {
    if (state.clock >= outputSeconds(state.list) - 1e-9) beginMove(state, world);
  }
  anchorLive(state);
  boss.invulnerable = state.phase === 'move';
  if (state.list === 'overload') {
    state.ambient += dt;
    while (state.ambient >= TIEBAO_OVERLOAD_CRATE_EVERY) {
      state.ambient -= TIEBAO_OVERLOAD_CRATE_EVERY;
      spawnCrate(state, boss, world);
    }
  }
  stepCircles(state, dt, world, ev);
  stepCrates(state, dt, world, ev);
}

function holdSlice(
  boss: BossRuntime,
  dt: number,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  const state = ensure(boss);
  state.ram = 'idle';
  if (state.phase === 'move') settleTail(state, boss);
  stepShed(boss, state, dt, ev);
  boss.x = railX(state.rail);
  zeroOffsets(boss);
  boss.y = tiebaoRestCenter(carsOf(state));
  stepCircles(state, dt, world, ev);
  stepCrates(state, dt, world, ev);
}

/** Substep so a large `dt` still crosses bursts and the ram. */
export function stepTiebao(
  boss: BossRuntime,
  dt: number,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  if (boss.stage !== 'fight' && boss.stage !== 'transition') return;
  ensure(boss);
  tiebaoSyncScroll(boss, world?.scroll);
  let left = dt;
  for (let guard = 0; guard < 8000 && left > 1e-8; guard++) {
    const slice = Math.min(FIXED_DT, left);
    if (boss.stage === 'transition') holdSlice(boss, slice, world, ev);
    else fightSlice(boss, slice, world, ev);
    left -= slice;
  }
}

export function tiebaoOnDeath(boss: BossRuntime, ev: BossEvents): void {
  const state = ensure(boss);
  settleTail(state, boss);
  const endSheds = TIEBAO_CARS - TIEBAO_END_CARS;
  if (state.shedBurst < endSheds) burstSheds(state, ev, endSheds);
  snapShed(boss, state, endSheds);
  boss.y = TIEBAO_END_PARK_Y;
  state.broken = true;
  state.circles = [];
  for (const crate of state.crates) crate.alive = false;
  TIEBAO_RAIL_X.forEach((x, index) => {
    ev.explosions.push({ x, y: 220, delay: 0.12 * index, size: 'medium' });
    ev.explosions.push({ x, y: 420, delay: 0.35 + 0.1 * index, size: 'medium' });
  });
}

/** A player shot into a flying crate. Returns true when the bullet is consumed. */
export function tiebaoTryShot(
  boss: BossRuntime,
  bullet: BulletBox,
  damage: number,
  ev: BossEvents
): boolean {
  const state = states.get(boss);
  if (!state) return false;
  for (const crate of state.crates) {
    if (!crate.alive || crate.age >= TIEBAO_CRATE_FLIGHT) continue;
    const radius = TIEBAO_CRATE_SIZE / 2;
    if (
      !checkBulletEnemyCollision(bullet.x, bullet.y, bullet.w, bullet.h, crate.x, crate.y, radius)
    ) {
      continue;
    }
    ev.consumedBullet = true;
    crate.hp -= damage;
    if (crate.hp <= 0) {
      crate.alive = false;
      ev.score += TIEBAO_CRATE_SCORE;
      ev.explosions.push({ x: crate.x, y: crate.y, delay: 0, size: 'small' });
    }
    return true;
  }
  return false;
}

export function tiebaoMarkBomb(boss: BossRuntime, ox: number, oy: number): void {
  const state = states.get(boss);
  if (!state) return;
  const half = TIEBAO_CRATE_SIZE / 2;
  for (const crate of state.crates) {
    if (!crate.alive || crate.age >= TIEBAO_CRATE_FLIGHT || crate.bombIn >= 0) continue;
    const box = { x: crate.x, y: crate.y, width: half * 2, height: half * 2 };
    if (!boxOnScreen(box)) continue;
    crate.bombIn = bombArrivalDelay(ox, oy, crate.x, crate.y);
  }
}

/** Bomb ring reaches a crate: small destroy, no score, no ground blast. */
export function tiebaoResolveBomb(boss: BossRuntime, dt: number, ev: BossEvents): void {
  const state = states.get(boss);
  if (!state) return;
  for (const crate of state.crates) {
    if (!crate.alive || crate.bombIn < 0) continue;
    crate.bombIn -= dt;
    if (crate.bombIn > 0) continue;
    crate.alive = false;
    crate.bombIn = -1;
    ev.explosions.push({ x: crate.x, y: crate.y, delay: 0, size: 'small' });
  }
}
