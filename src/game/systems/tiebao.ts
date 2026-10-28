/**
 * 铁堡 (stage 2 boss) rail script. The generic runner still owns parts, HP,
 * phases, and the victory exit. This module only moves the hull between the
 * three fixed rails and runs the rail-bound weapon pairs. State lives in a WeakMap so
 * `BossRuntime` stays the battleship's shape for the stage-1 render digest.
 *
 * Design: docs/电雷_第二关_铁堡Boss设计_v1.md (weapons: 武器重构 v1). No laser.
 * No Math.random. Every round leaves from a point on its own car.
 * One turnout curve (`tiebaoSwitchX`) is shared by the background rails and the
 * rigid cars. Cars bank onto that curve. The long sprite is never sheared.
 */

import {
  AIMED_MIN_DIST,
  FIXED_DT,
  HITBOX_RADIUS,
  LOGICAL_H,
  LOGICAL_W,
  TIEBAO_BEATS,
  TIEBAO_CAR_MAX_BANK,
  TIEBAO_CAR_PITCH,
  TIEBAO_CARS,
  TIEBAO_CHASE_FLAME,
  TIEBAO_CORE_ROW,
  TIEBAO_CRATE_BLAST,
  TIEBAO_CRATE_FLIGHT,
  TIEBAO_CRATE_HP,
  TIEBAO_CRATE_LAND_Y,
  TIEBAO_CRATE_SCORE,
  TIEBAO_CRATE_SIZE,
  TIEBAO_END_CARS,
  TIEBAO_END_PARK_Y,
  TIEBAO_ENTER_TAIL_Y,
  TIEBAO_FROG_AT,
  TIEBAO_HULL_W,
  TIEBAO_LOCO_H,
  TIEBAO_MINE_BURST_SPEED,
  TIEBAO_MINE_DROP,
  TIEBAO_MINE_FLIGHT,
  TIEBAO_MINE_FUSE,
  TIEBAO_MINE_PAIR_GAP,
  TIEBAO_MINE_SLIDE,
  TIEBAO_MINE_THROWS,
  TIEBAO_MISSILE_GAP,
  TIEBAO_MISSILE_HOMING,
  TIEBAO_MISSILE_SPEED,
  TIEBAO_MISSILE_X,
  TIEBAO_MOVE,
  TIEBAO_MOVE_EXTRA,
  TIEBAO_OVERLOAD_CRATE_EVERY,
  TIEBAO_OVERLOAD_MINE_FUSE,
  TIEBAO_OVERLOAD_MOVE,
  TIEBAO_OVERLOAD_PERIOD,
  TIEBAO_OVERLOAD_TWIN_GROUPS,
  TIEBAO_OVERLOAD_TWIN_MISSILES,
  TIEBAO_OVERLOAD_VOLLEY_ANGLES,
  TIEBAO_OVERLOAD_VOLLEY_STARTS,
  TIEBAO_OVERLOAD_VOLLEY_TAIL_SPREAD,
  TIEBAO_POINT_AT,
  TIEBAO_RAIL_X,
  TIEBAO_RAM_BOTTOM,
  TIEBAO_RAM_DIVE,
  TIEBAO_RAM_IMPACT,
  TIEBAO_RAM_JITTER,
  TIEBAO_RAM_RECOIL,
  TIEBAO_RAM_RETURN,
  TIEBAO_RAM_START,
  TIEBAO_RAM_WARN,
  TIEBAO_RAM_WARN_FAST,
  TIEBAO_RAM_WARN_SLOW,
  TIEBAO_ROOF_CAR_ROW,
  TIEBAO_ROOF_LOCO_ROW,
  TIEBAO_SHED_BLAST_FRAME,
  TIEBAO_SHED_DELAY,
  TIEBAO_SHED_SLIDE,
  TIEBAO_SIDE_MUZZLE_X,
  TIEBAO_SWEEP_FROM,
  TIEBAO_SWEEP_SPEED,
  TIEBAO_SWEEP_STEP,
  TIEBAO_SWEEP_TIME,
  TIEBAO_SWEEP_TO,
  TIEBAO_SWITCH_CROSS_SPAN,
  TIEBAO_SWITCH_LEAD,
  TIEBAO_SWITCH_PERIOD,
  TIEBAO_SWITCH_RUSH,
  TIEBAO_SWITCH_SPAN,
  TIEBAO_TAIL,
  TIEBAO_TELL,
  TIEBAO_TURRET_FAN_COUNT,
  TIEBAO_TURRET_FAN_SPREAD,
  TIEBAO_TURRET_GAP,
  TIEBAO_TURRET_SHOTS,
  TIEBAO_TURRET_SPEED,
  TIEBAO_TURRET_TURN,
  TIEBAO_TWIN_GROUP_GAP,
  TIEBAO_TWIN_GROUPS,
  TIEBAO_TWIN_MISSILE_AT,
  TIEBAO_TWIN_MISSILES,
  TIEBAO_TWIN_PAIR_HALF,
  TIEBAO_TWIN_SPEED,
  TIEBAO_TWIN_SPREAD,
  TIEBAO_VOLLEY_ANGLES,
  TIEBAO_VOLLEY_CAR_GAP,
  TIEBAO_VOLLEY_CAR_MAX_Y,
  TIEBAO_VOLLEY_CARS,
  TIEBAO_VOLLEY_SHOT_GAP,
  TIEBAO_VOLLEY_SHOTS,
  TIEBAO_VOLLEY_SPEED,
  TIEBAO_VOLLEY_TAIL_DELAY,
} from '@/game/config';
import { checkBulletEnemyCollision } from '@/game/systems/collision';
import { bombArrivalDelay, boxOnScreen } from '@/game/systems/bomb';
import type { BossEvents, BossRuntime, BossWorld, BulletBox } from '@/game/systems/boss';
import {
  tiebaoCarCenterRow,
  tiebaoCarsFromRatio,
  tiebaoHullHeight,
  tiebaoRestCenter,
  tiebaoShedCountFromRatio,
  tiebaoTailY,
} from '@/game/systems/tiebaoShed';

export const TIEBAO_MODE_IDS = ['sweep', 'volley', 'turret', 'twin', 'mines', 'ram'] as const;

export const TIEBAO_MODE_NAMES = [
  '侧舷扇扫',
  '舷炮排射',
  '炮塔追扫',
  '双联散射 + 追踪导弹',
  '尾抛轨雷',
  '冲轨撞击',
] as const;

/** Hard overload, one step per finished switch. The ram is not in it. */
export const TIEBAO_OVERLOAD_MODE_IDS = ['mines', 'volley', 'twin'] as const;

export type TiebaoModeId = (typeof TIEBAO_MODE_IDS)[number];

/**
 * Mode A is the odd park (1st, 3rd, …). Mode B is the even park.
 * Left 72, center 180, right 288.
 */
const RAIL_MODES = [
  ['sweep', 'volley'],
  ['turret', 'twin'],
  ['mines', 'ram'],
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

/** A rail mine in the air. Not lethal until it lands and becomes an enemy bullet. */
interface MineShell {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  age: number;
  fuse: number;
}

/**
 * One timed round (or group) inside a 4.8s output window. Built once per park
 * by `tiebaoSchedule`. Aim and muzzle are resolved when the event fires, on
 * the car that owns that gun at that moment.
 */
export type TiebaoShotEvent =
  | { at: number; kind: 'sweep'; sweep: number; shot: number }
  | { at: number; kind: 'side'; volley: number; slot: number; shot: number }
  | { at: number; kind: 'tail'; volley: number }
  | { at: number; kind: 'turret'; beat: number; shot: number }
  | { at: number; kind: 'finisher'; beat: number }
  | { at: number; kind: 'twin'; group: number }
  | { at: number; kind: 'missile'; shot: number }
  | { at: number; kind: 'lob'; lob: number };

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
  /** This window's rounds, sorted by `at`. `eventNext` is the first not yet fired. */
  events: TiebaoShotEvent[];
  eventNext: number;
  /** 炮塔追扫 barrel heading, radians. Turns toward the player at a capped rate. */
  turretAim: number;
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
  shells: MineShell[];
  /** Spark ring where the ram bottomed out. Null once it has faded. */
  impact: { x: number; y: number; age: number } | null;
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
  /** Seconds into the 0.9s ram warning, or null. Drives the lamps, recoil sparks, and wheels. */
  ramWarn: number | null;
  /** Spark ring at the bottom of a ram, `u` 0 → 1 over `TIEBAO_RAM_IMPACT`. */
  ramImpact: { x: number; y: number; u: number } | null;
  /** On-car tell for the first `TIEBAO_TELL` seconds of a park. Null otherwise and for the ram. */
  tell: { mode: TiebaoModeId; t: number } | null;
  /** Rail mines in the air, already placed on their lob arc. */
  shells: ReadonlyArray<{ x: number; y: number }>;
  crates: ReadonlyArray<{ x: number; y: number }>;
  broken: boolean;
  smoke: boolean;
}

const states = new WeakMap<BossRuntime, TiebaoState>();
const DEG = Math.PI / 180;
const SWEEP_SHOTS = Math.floor((TIEBAO_SWEEP_TIME - 1e-6) / TIEBAO_SWEEP_STEP) + 1;
/** Height of the lob arc above the straight line from tail beam to rail. */
const MINE_ARC = 24;

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

/**
 * One rigid pose's local point, in screen pixels.
 * Local +x is the car's right, local +y points at the tail. The same map as
 * `blitTiebaoRigid`: `x = cx + lx·cos − ly·sin`, `y = cy + lx·sin + ly·cos`.
 */
export function tiebaoLocalOnPose(
  pose: TiebaoCarPose,
  localX: number,
  localY: number
): { x: number; y: number } {
  const c = Math.cos(pose.angle);
  const s = Math.sin(pose.angle);
  return {
    x: pose.x + localX * c - localY * s,
    y: pose.y + localX * s + localY * c,
  };
}

/** Which side of this car a shot travels. 0 stays on the centerline. */
export function tiebaoFanLocalX(carAngle: number, shotAngle: number): number {
  const alongRight =
    Math.cos(shotAngle) * Math.cos(carAngle) + Math.sin(shotAngle) * Math.sin(carAngle);
  if (alongRight > 1e-3) return TIEBAO_SIDE_MUZZLE_X;
  if (alongRight < -1e-3) return -TIEBAO_SIDE_MUZZLE_X;
  return 0;
}

const PART_ROW: Readonly<Record<string, number>> = {
  core: TIEBAO_CORE_ROW,
  roofLoco: TIEBAO_ROOF_LOCO_ROW,
  roofCar: TIEBAO_ROOF_CAR_ROW,
};

function poseAtRow(poses: readonly TiebaoCarPose[], row: number): TiebaoCarPose | undefined {
  return (
    poses.find((pose) => row >= pose.row && row < pose.row + pose.h) ?? poses[poses.length - 1]
  );
}

/**
 * Screen mount of a sprite row on the rigid car that contains it.
 * Straight: this is `(boss.x + localX, top + row)`, the old parked point.
 * Banked: it rides that car's translate and rotate, not the curve sample at
 * the unrotated y.
 */
export function tiebaoRowMount(boss: BossRuntime, spriteRow: number, localX = 0): TiebaoMount {
  const poses = tiebaoCarPoses(boss);
  const pose = poseAtRow(poses, spriteRow);
  if (!pose) return { x: boss.x + localX, y: boss.y, angle: 0 };
  const localY = spriteRow - pose.row - pose.h / 2;
  const at = tiebaoLocalOnPose(pose, localX, localY);
  return { x: at.x, y: at.y, angle: pose.angle };
}

/** Core glow and the two roof guns. Null for any other id. */
export function tiebaoPartMount(boss: BossRuntime, partId: string): TiebaoMount | null {
  const row = PART_ROW[partId];
  if (row === undefined) return null;
  return tiebaoRowMount(boss, row, 0);
}

/**
 * Write each living part's screen point from its rigid mount.
 * `offsetY` stays the unrotated row offset (`row − height/2`). Falling
 * debris is left where it broke off. Before the rail script exists, parts
 * keep the generic `boss + offset` placement.
 */
export function tiebaoSyncMounts(boss: BossRuntime): void {
  if (!states.has(boss)) return;
  for (const part of boss.parts) {
    if (part.falling) continue;
    const mount = tiebaoPartMount(boss, part.id);
    if (!mount) {
      part.worldX = boss.x + part.offsetX;
      part.worldY = boss.y + part.offsetY;
      continue;
    }
    part.worldX = mount.x;
    part.worldY = mount.y;
    part.offsetX = mount.x - boss.x;
  }
}

export interface TiebaoMount {
  x: number;
  y: number;
  /** Car bank, clockwise radians. 0 on a straight rail. */
  angle: number;
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

/**
 * Sprite row of the car a centerline weapon may fire from.
 * The lead car once its center is on screen, otherwise the rear car.
 */
function visibleMuzzleRow(boss: BossRuntime, cars: number): number {
  const top = consistTop(boss, cars);
  const lead = tiebaoCarCenterRow(0);
  if (top + lead > 8) return lead;
  return tiebaoCarCenterRow(Math.max(0, cars - 1));
}

/** Visible muzzle. The lead car once it is on screen, otherwise the rear car. */
function muzzleY(boss: BossRuntime, cars: number): number {
  return consistTop(boss, cars) + visibleMuzzleRow(boss, cars);
}

/** Tail-beam row: the mine launcher and the volley's aimed round. */
function tailRow(cars: number): number {
  return tiebaoHullHeight(cars) - TIEBAO_TAIL;
}

/**
 * Roof gun for this beat. The two guns alternate. A gun whose row is still
 * above the screen hands the beat to the visible car's centerline mount.
 */
function turretRow(boss: BossRuntime, cars: number, beat: number): number {
  const gunRow = beat % 2 === 0 ? TIEBAO_ROOF_CAR_ROW : TIEBAO_ROOF_LOCO_ROW;
  if (consistTop(boss, cars) + gunRow > 8) return gunRow;
  return visibleMuzzleRow(boss, cars);
}

/** Car indices for 舷炮排射: centers on screen y 0–400, the rearmost three, front to back. */
function volleyCars(boss: BossRuntime, cars: number): number[] {
  const top = consistTop(boss, cars);
  const seen: number[] = [];
  for (let i = 0; i < cars; i++) {
    const y = top + tiebaoCarCenterRow(i);
    if (y >= 0 && y <= TIEBAO_VOLLEY_CAR_MAX_Y) seen.push(i);
  }
  return seen.slice(-TIEBAO_VOLLEY_CARS);
}

/** Sprite rows the tells light up. Same rows the guns fire from. */
export interface TiebaoGunRows {
  /** Visible car's side muzzles and missile tubes. */
  muzzle: number;
  /** Roof gun (or its visible stand-in) for the first beat. */
  turret: number;
  tail: number;
  /** Car indices of the 舷炮排射 guns, front to back. */
  volley: number[];
}

export function tiebaoGunRows(boss: BossRuntime): TiebaoGunRows {
  const cars = tiebaoCommittedCars(boss);
  return {
    muzzle: visibleMuzzleRow(boss, cars),
    turret: turretRow(boss, cars, 0),
    tail: tailRow(cars),
    volley: volleyCars(boss, cars),
  };
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
    return TIEBAO_OVERLOAD_MODE_IDS[state.mode % TIEBAO_OVERLOAD_MODE_IDS.length] ?? 'mines';
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

/**
 * Every round of one output window for `mode`, sorted by time. Beats follow
 * `TIEBAO_BEATS`; the ram has no rounds (its dash is `stepRam`). Times are
 * final seconds after the park.
 */
export function tiebaoSchedule(
  mode: TiebaoModeId,
  list: TiebaoState['list'] = 'main'
): TiebaoShotEvent[] {
  const overload = list === 'overload';
  const out: TiebaoShotEvent[] = [];
  if (mode === 'sweep') {
    TIEBAO_BEATS.forEach((start, sweep) => {
      for (let shot = 0; shot < SWEEP_SHOTS; shot++) {
        out.push({ at: start + shot * TIEBAO_SWEEP_STEP, kind: 'sweep', sweep, shot });
      }
    });
  } else if (mode === 'volley') {
    const starts = overload ? TIEBAO_OVERLOAD_VOLLEY_STARTS : TIEBAO_BEATS;
    starts.forEach((start, volley) => {
      for (let slot = 0; slot < TIEBAO_VOLLEY_CARS; slot++) {
        for (let shot = 0; shot < TIEBAO_VOLLEY_SHOTS; shot++) {
          const at = start + slot * TIEBAO_VOLLEY_CAR_GAP + shot * TIEBAO_VOLLEY_SHOT_GAP;
          out.push({ at, kind: 'side', volley, slot, shot });
        }
      }
      const last =
        (TIEBAO_VOLLEY_CARS - 1) * TIEBAO_VOLLEY_CAR_GAP +
        (TIEBAO_VOLLEY_SHOTS - 1) * TIEBAO_VOLLEY_SHOT_GAP;
      out.push({ at: start + last + TIEBAO_VOLLEY_TAIL_DELAY, kind: 'tail', volley });
    });
  } else if (mode === 'turret') {
    TIEBAO_BEATS.forEach((start, beat) => {
      for (let shot = 0; shot < TIEBAO_TURRET_SHOTS; shot++) {
        out.push({ at: start + shot * TIEBAO_TURRET_GAP, kind: 'turret', beat, shot });
      }
      out.push({ at: start + TIEBAO_TURRET_SHOTS * TIEBAO_TURRET_GAP, kind: 'finisher', beat });
    });
  } else if (mode === 'twin') {
    const groups = overload ? TIEBAO_OVERLOAD_TWIN_GROUPS : TIEBAO_TWIN_GROUPS;
    TIEBAO_BEATS.forEach((start, beat) => {
      for (let g = 0; g < groups; g++) {
        out.push({ at: start + g * TIEBAO_TWIN_GROUP_GAP, kind: 'twin', group: beat * groups + g });
      }
    });
    const per = overload ? TIEBAO_OVERLOAD_TWIN_MISSILES : TIEBAO_TWIN_MISSILES;
    TIEBAO_TWIN_MISSILE_AT.forEach((start, salvo) => {
      for (let k = 0; k < per; k++) {
        out.push({ at: start + k * TIEBAO_MISSILE_GAP, kind: 'missile', shot: salvo * per + k });
      }
    });
  } else if (mode === 'mines') {
    TIEBAO_MINE_THROWS.forEach((at, lob) => out.push({ at, kind: 'lob', lob }));
  }
  return out.sort((x, y) => x.at - y.at);
}

function resetSchedules(state: TiebaoState): void {
  state.events = tiebaoSchedule(modeIdOf(state), state.list);
  state.eventNext = 0;
  state.turretAim = Math.PI / 2;
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
    events: [],
    eventNext: 0,
    turretAim: Math.PI / 2,
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
    shells: [],
    impact: null,
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

function tellOf(state: TiebaoState, boss: BossRuntime): TiebaoVisual['tell'] {
  if (state.broken || boss.stage !== 'fight' || state.phase !== 'output') return null;
  if (state.weaponClock >= TIEBAO_TELL) return null;
  const mode = modeIdOf(state);
  if (mode === 'ram') return null;
  return { mode, t: Math.max(0, state.weaponClock) };
}

/** Lob position: straight line from the tail beam to the rail, lifted by a parabola. */
function shellPoint(shell: MineShell): { x: number; y: number } {
  const u = clamp(shell.age / TIEBAO_MINE_FLIGHT, 0, 1);
  return {
    x: lerp(shell.fromX, shell.toX, u),
    y: lerp(shell.fromY, shell.toY, u) - MINE_ARC * 4 * u * (1 - u),
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
    ramWarn: state.ram === 'warn' ? state.ramClock : null,
    ramImpact: state.impact
      ? {
          x: state.impact.x,
          y: state.impact.y,
          u: clamp(state.impact.age / TIEBAO_RAM_IMPACT, 0, 1),
        }
      : null,
    tell: tellOf(state, boss),
    shells: state.shells.map(shellPoint),
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
  }
  tiebaoSyncMounts(boss);
}

/**
 * Parked: one rail center, every mount upright. Moving: `boss.x` is the curve
 * at the consist center, and each part sticks to the rigid car that owns its
 * sprite row. Sampling the curve at the part's unrotated y shears the guns
 * off the body.
 */
function pose(state: TiebaoState, boss: BossRuntime): void {
  boss.x = state.phase === 'move' ? consistX(state, boss.y) : railX(state.rail);
  tiebaoSyncMounts(boss);
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
  type: 'small' | 'large' | 'missile',
  hitRadius?: number
): void {
  ev.bolts.push(
    hitRadius === undefined
      ? { x, y, vx, vy, type, homing: 0 }
      : { x, y, vx, vy, type, homing: 0, hitRadius }
  );
}

function pushAt(ev: BossEvents, x: number, y: number, angle: number, speed: number): void {
  pushBolt(ev, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 'small');
}

function playerOf(world: BossWorld | undefined): { x: number; y: number } {
  return { x: world?.playerX ?? LOGICAL_W / 2, y: world?.playerY ?? LOGICAL_H * 0.8 };
}

/** Heading from a muzzle to the player, or null when the player is inside `AIMED_MIN_DIST`. */
function aimFrom(world: BossWorld | undefined, x: number, y: number): number | null {
  const p = playerOf(world);
  if (Math.hypot(p.x - x, p.y - y) < AIMED_MIN_DIST) return null;
  return Math.atan2(p.y - y, p.x - x);
}

function wrapAngle(a: number): number {
  let d = a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** `count` rounds centered on `base`, `spread` degrees edge to edge. */
function fanFrom(
  ev: BossEvents,
  x: number,
  y: number,
  base: number,
  count: number,
  spread: number,
  speed: number
): void {
  const step = count > 1 ? (spread * DEG) / (count - 1) : 0;
  for (let i = 0; i < count; i++) pushAt(ev, x, y, base + (i - (count - 1) / 2) * step, speed);
}

/** 侧舷扇扫: both side muzzles of the visible car sweep outward → across the lane. */
function fireSweep(state: TiebaoState, boss: BossRuntime, ev: BossEvents, shot: number): void {
  const t = (shot * TIEBAO_SWEEP_STEP) / TIEBAO_SWEEP_TIME;
  const left = lerp(Math.PI / 2 + TIEBAO_SWEEP_FROM * DEG, Math.PI / 2 - TIEBAO_SWEEP_TO * DEG, t);
  const right = lerp(Math.PI / 2 - TIEBAO_SWEEP_FROM * DEG, Math.PI / 2 + TIEBAO_SWEEP_TO * DEG, t);
  const row = visibleMuzzleRow(boss, carsOf(state));
  const port = tiebaoRowMount(boss, row, -TIEBAO_SIDE_MUZZLE_X);
  const starboard = tiebaoRowMount(boss, row, TIEBAO_SIDE_MUZZLE_X);
  pushAt(ev, port.x, port.y, left + port.angle, TIEBAO_SWEEP_SPEED);
  pushAt(ev, starboard.x, starboard.y, right + starboard.angle, TIEBAO_SWEEP_SPEED);
}

/** 舷炮排射: one round from each side of one car, outward at this volley's fixed angle. */
function fireSide(
  state: TiebaoState,
  boss: BossRuntime,
  ev: BossEvents,
  volley: number,
  slot: number
): void {
  const car = volleyCars(boss, carsOf(state))[slot];
  if (car === undefined) return;
  const angles = state.list === 'overload' ? TIEBAO_OVERLOAD_VOLLEY_ANGLES : TIEBAO_VOLLEY_ANGLES;
  const off = (angles[volley] ?? angles[0]) * DEG;
  const row = tiebaoCarCenterRow(car);
  const port = tiebaoRowMount(boss, row, -TIEBAO_SIDE_MUZZLE_X);
  const starboard = tiebaoRowMount(boss, row, TIEBAO_SIDE_MUZZLE_X);
  pushAt(ev, port.x, port.y, Math.PI / 2 + off + port.angle, TIEBAO_VOLLEY_SPEED);
  pushAt(ev, starboard.x, starboard.y, Math.PI / 2 - off + starboard.angle, TIEBAO_VOLLEY_SPEED);
}

/** Tail-beam round after each volley so the lane behind the car is not a free spot. */
function fireTail(
  state: TiebaoState,
  boss: BossRuntime,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  const at = tiebaoRowMount(boss, tailRow(carsOf(state)), 0);
  const aim = aimFrom(world, at.x, at.y);
  if (aim === null) return;
  const overload = state.list === 'overload';
  const count = overload ? 3 : 1;
  const spread = overload ? TIEBAO_OVERLOAD_VOLLEY_TAIL_SPREAD : 0;
  fanFrom(ev, at.x, at.y, aim, count, spread, TIEBAO_VOLLEY_SPEED);
}

/**
 * 炮塔追扫: the first round of a beat aims at the player, then the barrel
 * turns toward the player at no more than `TIEBAO_TURRET_TURN` °/s. Keeps
 * firing after the roof gun is destroyed.
 */
function fireTurret(
  state: TiebaoState,
  boss: BossRuntime,
  world: BossWorld | undefined,
  ev: BossEvents,
  beat: number,
  shot: number
): void {
  const at = tiebaoRowMount(boss, turretRow(boss, carsOf(state), beat), 0);
  const p = playerOf(world);
  const want = Math.atan2(p.y - at.y, p.x - at.x);
  if (shot === 0) {
    state.turretAim = want;
  } else {
    const cap = TIEBAO_TURRET_TURN * DEG * TIEBAO_TURRET_GAP;
    state.turretAim += clamp(wrapAngle(want - state.turretAim), -cap, cap);
  }
  if (Math.hypot(p.x - at.x, p.y - at.y) < AIMED_MIN_DIST) return;
  pushAt(ev, at.x, at.y, state.turretAim, TIEBAO_TURRET_SPEED);
}

/** Three-round aimed fan from the side muzzle facing the player, on the turret's car. */
function fireFinisher(
  state: TiebaoState,
  boss: BossRuntime,
  world: BossWorld | undefined,
  ev: BossEvents,
  beat: number
): void {
  const row = turretRow(boss, carsOf(state), beat);
  const center = tiebaoRowMount(boss, row, 0);
  const side = playerOf(world).x >= center.x ? 1 : -1;
  const at = tiebaoRowMount(boss, row, side * TIEBAO_SIDE_MUZZLE_X);
  const aim = aimFrom(world, at.x, at.y);
  if (aim === null) return;
  fanFrom(
    ev,
    at.x,
    at.y,
    aim,
    TIEBAO_TURRET_FAN_COUNT,
    TIEBAO_TURRET_FAN_SPREAD,
    TIEBAO_TURRET_SPEED
  );
}

/**
 * 双联散射: three lanes (aimed, ±`TIEBAO_TWIN_SPREAD`), two side-by-side
 * rounds per lane, from one side muzzle. Groups alternate left and right.
 */
function fireTwin(
  state: TiebaoState,
  boss: BossRuntime,
  world: BossWorld | undefined,
  ev: BossEvents,
  group: number
): void {
  const side = group % 2 === 0 ? -1 : 1;
  const row = visibleMuzzleRow(boss, carsOf(state));
  const at = tiebaoRowMount(boss, row, side * TIEBAO_SIDE_MUZZLE_X);
  const aim = aimFrom(world, at.x, at.y);
  if (aim === null) return;
  for (const lane of [-1, 0, 1]) {
    const angle = aim + lane * TIEBAO_TWIN_SPREAD * DEG;
    const px = -Math.sin(angle) * TIEBAO_TWIN_PAIR_HALF;
    const py = Math.cos(angle) * TIEBAO_TWIN_PAIR_HALF;
    for (const pair of [-1, 1]) {
      pushAt(ev, at.x + px * pair, at.y + py * pair, angle, TIEBAO_TWIN_SPEED);
    }
  }
}

/** Short homing missile from the tubes at ±`TIEBAO_MISSILE_X` on the visible car. */
function fireMissile(state: TiebaoState, boss: BossRuntime, ev: BossEvents, shot: number): void {
  const side = shot % 2 === 0 ? -1 : 1;
  const row = visibleMuzzleRow(boss, carsOf(state));
  const at = tiebaoRowMount(boss, row, side * TIEBAO_MISSILE_X);
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
    x: at.x,
    y: at.y,
    rotation: 0,
  });
}

/** Rails a lob lands on. Lobs 1 and 3 seal the other two rails, lob 2 this one. Overload: all. */
export function tiebaoMineRails(rail: number, lob: number, list: TiebaoState['list']): number[] {
  if (list === 'overload') return [0, 1, 2];
  if (lob % 2 === 1) return [rail];
  return [0, 1, 2].filter((index) => index !== rail);
}

/** 尾抛轨雷: lob two mines per rail from the tail beam. They land `TIEBAO_MINE_FLIGHT` later. */
function lobMines(state: TiebaoState, boss: BossRuntime, lob: number): void {
  const from = tiebaoRowMount(boss, tailRow(carsOf(state)), 0);
  const fuse = state.list === 'overload' ? TIEBAO_OVERLOAD_MINE_FUSE : TIEBAO_MINE_FUSE;
  for (const rail of tiebaoMineRails(state.rail, lob, state.list)) {
    for (let k = 0; k < 2; k++) {
      state.shells.push({
        fromX: from.x,
        fromY: from.y,
        toX: railX(rail),
        toY: from.y + TIEBAO_MINE_DROP + k * TIEBAO_MINE_PAIR_GAP,
        age: 0,
        fuse,
      });
    }
  }
}

/** A landed shell becomes an ordinary enemy bullet: B clears it, the cap counts it. */
function stepShells(state: TiebaoState, dt: number, ev: BossEvents): void {
  if (state.shells.length === 0) return;
  const flying: MineShell[] = [];
  for (const shell of state.shells) {
    shell.age += dt;
    if (shell.age < TIEBAO_MINE_FLIGHT) {
      flying.push(shell);
      continue;
    }
    ev.bolts.push({
      x: shell.toX,
      y: shell.toY,
      vx: 0,
      vy: TIEBAO_MINE_SLIDE,
      type: 'large',
      homing: 0,
      fuse: { time: shell.fuse, burstSpeed: TIEBAO_MINE_BURST_SPEED },
    });
  }
  state.shells = flying;
}

function fireEvent(
  state: TiebaoState,
  boss: BossRuntime,
  world: BossWorld | undefined,
  ev: BossEvents,
  event: TiebaoShotEvent
): void {
  switch (event.kind) {
    case 'sweep':
      fireSweep(state, boss, ev, event.shot);
      return;
    case 'side':
      fireSide(state, boss, ev, event.volley, event.slot);
      return;
    case 'tail':
      fireTail(state, boss, world, ev);
      return;
    case 'turret':
      fireTurret(state, boss, world, ev, event.beat, event.shot);
      return;
    case 'finisher':
      fireFinisher(state, boss, world, ev, event.beat);
      return;
    case 'twin':
      fireTwin(state, boss, world, ev, event.group);
      return;
    case 'missile':
      fireMissile(state, boss, ev, event.shot);
      return;
    case 'lob':
      lobMines(state, boss, event.lob);
      return;
  }
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

/** Recoil up during the warning: eases in over the 4 Hz stage, then holds. */
export function tiebaoRamRecoil(warnSeconds: number): number {
  if (warnSeconds >= TIEBAO_RAM_WARN_SLOW) return TIEBAO_RAM_RECOIL;
  return TIEBAO_RAM_RECOIL * easeOutCubic(warnSeconds / TIEBAO_RAM_WARN_SLOW);
}

/** One-pixel shake, 8 Hz stage only. The final white hold is still. */
export function tiebaoRamJitter(warnSeconds: number): number {
  if (warnSeconds < TIEBAO_RAM_WARN_SLOW || warnSeconds >= TIEBAO_RAM_WARN_FAST) return 0;
  return (Math.floor(warnSeconds / FIXED_DT) % 2 === 0 ? 1 : -1) * TIEBAO_RAM_JITTER;
}

/**
 * Right B. Armed from the 9-car opening. `TIEBAO_RAM_START` after the park the
 * 0.9s on-car warning runs (recoil, lamps, wheel sparks), then the dash to
 * the bottom edge and the slow retreat. One dash per output window.
 */
function stepRam(state: TiebaoState, dt: number, boss: BossRuntime): void {
  if (state.shedPhase !== 'idle') return;
  const home = tiebaoRestCenter(carsOf(state));
  const rail = railX(state.rail);
  if (modeIdOf(state) !== 'ram') {
    state.ram = 'idle';
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
  const coiled = home - TIEBAO_RAM_RECOIL;
  const diveY = TIEBAO_RAM_BOTTOM - tiebaoHullHeight(carsOf(state)) / 2;
  if (state.ram === 'warn') {
    if (state.ramClock < TIEBAO_RAM_WARN) {
      boss.y = home - tiebaoRamRecoil(state.ramClock);
      boss.x = rail + tiebaoRamJitter(state.ramClock);
      return;
    }
    state.ram = 'dive';
    state.ramClock -= TIEBAO_RAM_WARN;
    boss.x = rail;
  }
  if (state.ram === 'dive') {
    const u = easeOutCubic(state.ramClock / Math.max(0.05, TIEBAO_RAM_DIVE));
    boss.y = lerp(coiled, diveY, u);
    if (state.ramClock < TIEBAO_RAM_DIVE) return;
    state.ram = 'return';
    state.ramClock -= TIEBAO_RAM_DIVE;
    state.impact = { x: rail, y: TIEBAO_RAM_BOTTOM, age: 0 };
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

function stepImpact(state: TiebaoState, dt: number): void {
  if (!state.impact) return;
  state.impact.age += dt;
  if (state.impact.age >= TIEBAO_RAM_IMPACT) state.impact = null;
}

function playerHit(world: BossWorld | undefined, x: number, y: number, radius: number): boolean {
  if (!world) return false;
  const reach = radius + HITBOX_RADIUS;
  const dx = world.playerX - x;
  const dy = world.playerY - y;
  return dx * dx + dy * dy <= reach * reach;
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

/** Fire every scheduled round whose time has come. Never runs during a move. */
function fireWeapons(
  state: TiebaoState,
  boss: BossRuntime,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  while (state.eventNext < state.events.length) {
    const event = state.events[state.eventNext];
    if (!event || state.weaponClock + 1e-9 < event.at) return;
    state.eventNext++;
    fireEvent(state, boss, world, ev, event);
  }
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
  stepShells(state, dt, ev);
  stepImpact(state, dt);
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
  stepShells(state, dt, ev);
  stepImpact(state, dt);
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
  state.shells = [];
  state.impact = null;
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

/**
 * Bomb press. Mines still in the air are shots too, so they go with the rest
 * of the screen's bullets. Crates wait for the ring.
 */
export function tiebaoMarkBomb(boss: BossRuntime, ox: number, oy: number): void {
  const state = states.get(boss);
  if (!state) return;
  state.shells = [];
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
