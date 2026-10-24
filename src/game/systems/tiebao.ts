/**
 * 铁堡 (stage 2 boss) rail script. The generic runner still owns parts, HP,
 * phases, and the victory exit. This module only moves the hull between the
 * three fixed rails and runs the weapon cycle. State lives in a WeakMap so
 * `BossRuntime` stays the battleship's shape for the stage-1 render digest.
 *
 * Design: docs/电雷_第二关_铁堡Boss设计_v1.md. No laser. No Math.random.
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
  TIEBAO_CRATE_FIRST,
  TIEBAO_CRATE_FLIGHT,
  TIEBAO_CRATE_GAP,
  TIEBAO_CRATE_HP,
  TIEBAO_CRATE_LAND_Y,
  TIEBAO_CRATE_PER_WINDOW,
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
  TIEBAO_MOVE,
  TIEBAO_OVERLOAD_CRATE_EVERY,
  TIEBAO_OVERLOAD_MISSILE_COUNT,
  TIEBAO_OVERLOAD_MOVE,
  TIEBAO_OVERLOAD_PERIOD,
  TIEBAO_OVERLOAD_RAIN_WARN,
  TIEBAO_CARS,
  TIEBAO_CORE_ROW,
  TIEBAO_END_CARS,
  TIEBAO_END_PARK_Y,
  TIEBAO_ENTER_TAIL_Y,
  TIEBAO_HULL_H,
  TIEBAO_HULL_W,
  TIEBAO_OVERLOAD_WALL_REPEAT,
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
  TIEBAO_ROCKET_RADIUS,
  TIEBAO_ROCKET_SPEED,
  TIEBAO_ROCKET_START,
  TIEBAO_ROCKET_WARN,
  TIEBAO_ROCKET_Y,
  TIEBAO_ROOF_CAR_ROW,
  TIEBAO_ROOF_LOCO_ROW,
  TIEBAO_SWITCH_PERIOD,
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

export const TIEBAO_MODE_IDS = [
  'fan',
  'missiles',
  'rain',
  'broadside',
  'wall',
  'ram',
  'rockets',
  'crates',
] as const;

export const TIEBAO_MODE_NAMES = [
  '高射扇',
  '导弹齐射',
  '落弹雨',
  '侧舷扫射',
  '封轨弹墙',
  '冲轨撞击',
  '三轨火箭',
  '弹链抛射',
] as const;

export const TIEBAO_OVERLOAD_MODE_IDS = ['rain', 'wall', 'missiles'] as const;

export type TiebaoModeId = (typeof TIEBAO_MODE_IDS)[number];
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

interface TiebaoState {
  rail: RailIndex;
  target: RailIndex;
  phase: RailPhase;
  clock: number;
  fromX: number;
  list: 'main' | 'overload';
  mode: number;
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
  rocket: 0 | 1 | 2;
  crateSpawned: number;
  crateNext: number;
  ram: RamPhase;
  /** One dash per output window. Stays set after the retreat so it does not dive again. */
  ramDone: boolean;
  ramClock: number;
  /** Rear cars already exploded. Grows only. Hard's second bar does not add more. */
  sheds: number;
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
   * Background frog only. The hull X stays on `current` until the move
   * completes, then snaps to the target rail. Null while parked.
   */
  switch: { fromX: number; toX: number; u: number; tailY: number } | null;
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

interface ClockProfile {
  output: number;
  move: number;
}

function profile(list: TiebaoState['list']): ClockProfile {
  if (list === 'overload') {
    return {
      output: TIEBAO_OVERLOAD_PERIOD - TIEBAO_OVERLOAD_MOVE,
      move: TIEBAO_OVERLOAD_MOVE,
    };
  }
  return {
    output: TIEBAO_SWITCH_PERIOD - TIEBAO_MOVE,
    move: TIEBAO_MOVE,
  };
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

/**
 * Screen X of the background frog at `y`. The hull does not follow this.
 * At u=0 the tail line is still on `fromX`. At u=1 that line is on `toX`.
 * Ahead of the frog (smaller y) the painted rail is already the new one.
 */
export function tiebaoSwitchX(
  y: number,
  fromX: number,
  toX: number,
  u: number,
  tailY: number
): number {
  const y0 = tailY - TIEBAO_SWITCH_SPAN + u * TIEBAO_SWITCH_SPAN;
  const y1 = y0 + TIEBAO_SWITCH_SPAN;
  if (y >= y1) return fromX;
  if (y <= y0) return toX;
  return lerp(fromX, toX, smoothstep((y1 - y) / TIEBAO_SWITCH_SPAN));
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

function emitSheds(
  boss: BossRuntime,
  state: TiebaoState,
  ev: BossEvents,
  fromSheds: number,
  toSheds: number
): void {
  for (let shed = fromSheds; shed < toSheds; shed++) {
    const cars = TIEBAO_CARS - shed;
    const top = tiebaoTailY(cars) - tiebaoHullHeight(cars);
    const y = top + tiebaoCarCenterRow(cars - 1);
    ev.explosions.push({ x: boss.x, y, delay: 0, size: 'medium' });
    ev.explosions.push({ x: boss.x - 10, y: y + 8, delay: 0, size: 'small' });
    ev.explosions.push({ x: boss.x + 8, y: y - 6, delay: 0, size: 'small' });
  }
  state.sheds = toSheds;
}

function commitSheds(boss: BossRuntime, state: TiebaoState, ev: BossEvents | null): void {
  const sheds = tiebaoShedCountFromRatio(tiebaoMainRatio(boss));
  if (ev && sheds > state.sheds) emitSheds(boss, state, ev, state.sheds, sheds);
  else state.sheds = Math.max(state.sheds, sheds);
  applyAnchors(boss, tiebaoHullHeight(carsOf(state)));
}

/**
 * Slide-in. The tail eases from just above the screen to the encounter tail.
 * Shedding during the slide snaps the length. The burst waits for the fight.
 */
export function tiebaoPlaceEnter(boss: BossRuntime, u: number): void {
  const state = ensure(boss);
  const sheds = tiebaoShedCountFromRatio(tiebaoMainRatio(boss));
  state.sheds = sheds;
  const cars = carsOf(state);
  const height = tiebaoHullHeight(cars);
  applyAnchors(boss, height);
  const tail = TIEBAO_ENTER_TAIL_Y + (tiebaoTailY(cars) - TIEBAO_ENTER_TAIL_Y) * clamp(u, 0, 1);
  boss.y = tail - height / 2;
}

function modeList(list: TiebaoState['list']): readonly TiebaoModeId[] {
  return list === 'overload' ? TIEBAO_OVERLOAD_MODE_IDS : TIEBAO_MODE_IDS;
}

function modeIdOf(state: TiebaoState): TiebaoModeId {
  const list = modeList(state.list);
  return list[state.mode % list.length] ?? 'fan';
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
  state.rocket = 0;
  state.crateSpawned = 0;
  state.crateNext = TIEBAO_CRATE_FIRST;
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
    list: 'main',
    mode: 0,
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
    rocket: 0,
    crateSpawned: 0,
    crateNext: 0,
    ram: 'idle',
    ramDone: false,
    ramClock: 0,
    sheds: 0,
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
          u: state.clock / Math.max(0.05, profile(state.list).move),
          tailY: tiebaoTailY(carsOf(state)),
        }
      : null,
    ramWarn: state.ram === 'warn',
    rocketWarn: state.rocket === 1 && modeIdOf(state) === 'rockets',
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
  const clock = profile(state.list);
  const remain = state.phase === 'output' ? clock.output - state.clock : clock.move - state.clock;
  return { text: `换轨 ${Math.max(0, remain).toFixed(1)}`, hot: state.phase !== 'output' };
}

function beginMove(state: TiebaoState, world: BossWorld | undefined): void {
  state.target = pickOtherRail(state.rail, rollOf(world));
  state.fromX = railX(state.rail);
  state.phase = 'move';
  state.clock = 0;
}

function advanceRail(
  state: TiebaoState,
  dt: number,
  world: BossWorld | undefined,
  boss: BossRuntime
): boolean {
  const clock = profile(state.list);
  if (state.phase === 'output') {
    state.clock += dt;
    if (state.clock >= clock.output && state.ram === 'idle') {
      const over = state.clock - clock.output;
      beginMove(state, world);
      state.clock = over;
    } else if (state.clock > clock.output) {
      state.clock = clock.output;
    }
    return false;
  }
  state.clock += dt;
  if (state.clock < clock.move) return false;
  const over = state.clock - clock.move;
  state.rail = state.target;
  state.phase = 'output';
  state.clock = over;
  const list = modeList(state.list);
  state.mode = (state.mode + 1) % list.length;
  state.weaponClock = over;
  resetSchedules(state);
  boss.x = railX(state.rail);
  return true;
}

/**
 * Hull X is always a rail center. During the move it stays on the rail it is
 * leaving. `advanceRail` snaps it onto the target when the frog animation ends.
 */
function placeX(state: TiebaoState, boss: BossRuntime): void {
  boss.x = railX(state.rail);
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

function fireRockets(state: TiebaoState, ev: BossEvents): void {
  if (modeIdOf(state) !== 'rockets') return;
  if (state.rocket === 0 && state.weaponClock + 1e-9 >= TIEBAO_ROCKET_START) state.rocket = 1;
  if (state.rocket !== 1) return;
  if (state.weaponClock + 1e-9 < TIEBAO_ROCKET_START + TIEBAO_ROCKET_WARN) return;
  for (const x of TIEBAO_RAIL_X) {
    pushBolt(ev, x, TIEBAO_ROCKET_Y, 0, TIEBAO_ROCKET_SPEED, 'missile', TIEBAO_ROCKET_RADIUS);
  }
  state.rocket = 2;
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

function fireCrates(state: TiebaoState, boss: BossRuntime, world: BossWorld | undefined): void {
  if (modeIdOf(state) !== 'crates') return;
  if (state.crateSpawned >= TIEBAO_CRATE_PER_WINDOW) return;
  if (state.weaponClock + 1e-9 < state.crateNext) return;
  spawnCrate(state, boss, world);
  state.crateSpawned++;
  state.crateNext += TIEBAO_CRATE_GAP;
}

function stepRam(state: TiebaoState, dt: number, boss: BossRuntime): void {
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
  fireRockets(state, ev);
  fireCrates(state, boss, world);
}

function fightSlice(
  boss: BossRuntime,
  dt: number,
  world: BossWorld | undefined,
  ev: BossEvents
): void {
  const state = ensure(boss);
  if (state.broken) return;
  commitSheds(boss, state, ev);
  const arrived = advanceRail(state, dt, world, boss);
  if (state.phase === 'move') {
    boss.y = tiebaoRestCenter(carsOf(state));
    state.ram = 'idle';
  }
  placeX(state, boss);
  if (state.phase !== 'move') {
    if (!arrived) state.weaponClock += dt;
    fireWeapons(state, boss, world, ev);
    stepRam(state, dt, boss);
  }
  if (state.phase === 'output' && state.ram === 'idle') {
    const clock = profile(state.list);
    if (state.clock >= clock.output - 1e-9) beginMove(state, world);
  }
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
  commitSheds(boss, state, ev);
  boss.x = railX(state.rail);
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
  const endSheds = TIEBAO_CARS - TIEBAO_END_CARS;
  if (state.sheds < endSheds) emitSheds(boss, state, ev, state.sheds, endSheds);
  state.sheds = endSheds;
  applyAnchors(boss, TIEBAO_HULL_H);
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
