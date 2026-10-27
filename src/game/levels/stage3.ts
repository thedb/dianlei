/**
 * Stage 3 mid-stage from docs/电雷_第三关波次表_v1.md (P33).
 *
 * Run map 河流A, boss map 炉心浮台. Two new models: `parked_fighter` (planted
 * on bank land, no guns) and `strike` (one fan on the level leg of a strafe).
 * Everything else reuses stage 1 / stage 2 models and patterns. `rear_diag`,
 * `step_slide`, and `dive_once` are not used here. No `turret2`, no armed boat.
 *
 * Easy is the base count and fire. Medium and hard add ships or swap patterns
 * on the same clock. `STAGE3_WARNING_AT` (118) ends the spawns; 炉心 enters at
 * `FURNACE_ENTER_AT` (123). Clear-wave rewards and the timed supply ship are
 * not implemented; W36 is the `powerBelowMax` relief carrier.
 */

import {
  BG_SCROLL_SPEED,
  FIXED2_SEPARATION,
  LOGICAL_H,
  MAP_CROP_X,
  STAGE3_RISK_CENTER_X,
  STAGE3_RISK_EARLY_T,
  STAGE3_RISK_LATE_T,
  STAGE3_RISK_LEFT_X,
  STAGE3_RISK_MID_T,
  STAGE3_RISK_MID_X,
  STAGE3_RISK_RIGHT_X,
  STAGE3_WARNING_AT,
  TILE_SIZE,
} from '@/game/config';
import { FURNACE } from './bosses/furnace';
import type { Fire, GroundEntry, SpawnGroup, StageData, WaveDifficulty } from './types';

const EASY: readonly WaveDifficulty[] = ['easy'];
const MEDIUM_HARD: readonly WaveDifficulty[] = ['medium', 'hard'];
const HARD: readonly WaveDifficulty[] = ['hard'];

type FireBy = NonNullable<SpawnGroup['fireByDifficulty']>;
type CountBy = SpawnGroup['countByDifficulty'];

const NONE: Fire = { kind: 'none' };

function aimed(interval: number): Fire {
  return { kind: 'aimed1', interval };
}

function aimedOnce(firstDelay = 0.5): Fire {
  return { kind: 'aimed1', maxShots: 1, firstDelay };
}

function burstOnce(firstDelay = 0.5): Fire {
  return { kind: 'aimed3burst', maxShots: 1, firstDelay };
}

function fan(kind: 'fan3' | 'fan5', spread: number, interval: number): Fire {
  return { kind, spread, interval };
}

function ring(interval: number, rotStep: number): Fire {
  return { kind: 'ring8', interval, rotStep };
}

/** Small-fighter fire from 0:20 on: medium adds a little, hard swaps in aimed shots (§4). */
const SMALL_LATE: FireBy = { medium: aimedOnce(0.6), hard: burstOnce(0.55) };
const SMALL_LATE_LIGHT: FireBy = { hard: aimedOnce(0.55) };

const TANK_BY: FireBy = { medium: aimed(2.0), hard: aimed(1.7) };
const TANK_LATE_BY: FireBy = { medium: aimed(1.8), hard: aimed(1.6) };

/** Stage-2 factory gun, unchanged: parallel pair along the barrel, three volleys. */
function aaBurst(interval: number, firstDelay = 0.55): Fire {
  return {
    kind: 'pattern',
    pattern: {
      shape: 'parallel',
      count: 2,
      gap: FIXED2_SEPARATION,
      aim: 'barrel',
      bullet: 'small',
      burst: 3,
    },
    interval,
    firstDelay,
  };
}

/** Strike jet: one five-bullet large fan, aimed, on the level leg only. */
const STRIKE_FAN: Fire = {
  kind: 'pattern',
  pattern: {
    shape: 'fan',
    count: 5,
    spreadDeg: 40,
    aim: 'player',
    bullet: 'large',
    speed: 90,
    minDist: true,
  },
  spread: 40,
  maxShots: 1,
  firstDelay: 0.2,
};

function sineColumn(
  x: number,
  count: number,
  countBy: CountBy,
  opts: { vy?: number; amp?: number; period?: number; interval?: number; fireBy?: FireBy } = {}
): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'small',
    count,
    xs: [x],
    interval: opts.interval ?? 0.32,
    move: { kind: 'sine', vy: opts.vy ?? 120, amp: opts.amp ?? 34, period: opts.period ?? 2.2 },
    fire: NONE,
  };
  if (countBy) group.countByDifficulty = countBy;
  if (opts.fireBy) {
    group.fireByDifficulty = opts.fireBy;
    group.fireOnlyByDifficulty = { medium: [1, 3], hard: [0, 2, 4] };
  }
  return group;
}

/** V from the top. Lead first, then pairs outward. Hard adds the next pair. */
function vee(center: number, fireBy?: FireBy, delay = 0): SpawnGroup {
  const xs = [0, -30, 30, -60, 60, -90, 90].map((dx) => center + dx);
  const group: SpawnGroup = {
    enemy: 'small',
    count: 5,
    xs,
    interval: 0.1,
    move: { kind: 'v_dive', speed: 170, stopY: 210 },
    fire: NONE,
    countByDifficulty: { hard: 7 },
  };
  if (delay) group.delay = delay;
  if (fireBy) {
    group.fireByDifficulty = fireBy;
    group.fireOnlyByDifficulty = { medium: [0], hard: [0, 3, 4] };
  }
  return group;
}

function cross(
  from: 'topLeft' | 'topRight',
  count: number,
  countBy: CountBy,
  delay = 0,
  fireBy?: FireBy
): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'small',
    count,
    xs: [from === 'topLeft' ? -16 : 376],
    y: -16,
    interval: 0.26,
    move: { kind: 'cross', from, speed: 175 },
    fire: NONE,
  };
  if (countBy) group.countByDifficulty = countBy;
  if (delay) group.delay = delay;
  if (fireBy) {
    group.fireByDifficulty = fireBy;
    group.fireOnlyByDifficulty = { medium: [1], hard: [0, 2] };
  }
  return group;
}

function arc(
  side: 'left' | 'right',
  y0: number,
  delay: number,
  difficulties?: readonly WaveDifficulty[]
): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'interceptor',
    count: 1,
    xs: [side === 'left' ? -16 : 376],
    y: y0,
    delay,
    move: { kind: 'side_arc', side, y0, speed: 190 },
    fire: { kind: 'aimed1', maxShots: 1 },
    fireByDifficulty: {
      medium: burstOnce(0.55),
      hard: { kind: 'aimed_fast3', maxShots: 1, firstDelay: 0.5 },
    },
  };
  if (difficulties) group.difficulties = difficulties;
  return group;
}

/** Interceptors alternate sides. Medium and hard add one or two more on the tail. */
function arcs(base: number, y0: number): SpawnGroup[] {
  const groups: SpawnGroup[] = [];
  for (let i = 0; i < base + 2; i++) {
    const side = i % 2 === 0 ? 'left' : 'right';
    const only = i < base ? undefined : i === base ? MEDIUM_HARD : HARD;
    groups.push(arc(side, y0 + (i % 3) * 20, i * 0.42, only));
  }
  return groups;
}

function drone(x: number, delay: number, difficulties?: readonly WaveDifficulty[]): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'drone',
    count: 1,
    xs: [x],
    delay,
    move: { kind: 'orbit', anchor: { x, y: 160 }, r: 30, period: 2.4, hold: 4 },
    fire: ring(2.4, 22.5),
    fireByDifficulty: { medium: ring(2.1, 22.5), hard: ring(1.9, 18) },
  };
  if (difficulties) group.difficulties = difficulties;
  return group;
}

function tank(
  x: number,
  fire: Fire,
  fireBy: FireBy,
  opts: {
    entry?: GroundEntry;
    y?: number;
    delay?: number;
    difficulties?: readonly WaveDifficulty[];
  } = {}
): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'tank',
    count: 1,
    xs: [x],
    move: { kind: 'ground', entry: opts.entry ?? 'top' },
    fire,
    fireByDifficulty: fireBy,
  };
  if (opts.y !== undefined) group.y = opts.y;
  if (opts.delay) group.delay = opts.delay;
  if (opts.difficulties) group.difficulties = opts.difficulties;
  return group;
}

function missileCar(x: number, delay = 0, difficulties?: readonly WaveDifficulty[]): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'missile_car',
    count: 1,
    xs: [x],
    move: { kind: 'ground' },
    fire: { kind: 'missile', interval: 3.2, firstDelay: 1.2 },
    fireByDifficulty: {
      medium: { kind: 'missile', interval: 2.8, firstDelay: 1.1 },
      hard: { kind: 'missile', interval: 2.4, firstDelay: 1.0 },
    },
  };
  if (delay) group.delay = delay;
  if (difficulties) group.difficulties = difficulties;
  return group;
}

/** One factory gun on bank land, centered just above the screen. */
function aa(
  x: number,
  y: number,
  firstDelay: number,
  difficulties?: readonly WaveDifficulty[]
): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'factory_aa',
    count: 1,
    xs: [x],
    y,
    move: { kind: 'ground' },
    fire: aaBurst(1.65, firstDelay),
    fireByDifficulty: { medium: aaBurst(1.4, firstDelay), hard: aaBurst(1.15, firstDelay) },
  };
  if (difficulties) group.difficulties = difficulties;
  return group;
}

/**
 * A row of parked jets on the composed 河流A grid. `row` is the footprint's
 * bottom tile row, `cols` the left column of each 2×2 jet. The wave clock is
 * the scroll that brings that bottom edge to the top of the screen, so the
 * jet spawns at the same moment a building on that row would.
 */
export interface ParkedRow {
  row: number;
  cols: readonly number[];
}

export const PARKED_SIZE_TILES = 2;

export function parkedSpawnTime(row: number): number {
  return (row * TILE_SIZE - LOGICAL_H) / BG_SCROLL_SPEED;
}

export function parkedCenterX(col: number): number {
  return col * TILE_SIZE - MAP_CROP_X + (PARKED_SIZE_TILES * TILE_SIZE) / 2;
}

function parked(
  spot: ParkedRow,
  count: number,
  countBy?: CountBy,
  difficulties?: readonly WaveDifficulty[]
): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'parked_fighter',
    count,
    xs: spot.cols.map(parkedCenterX),
    y: -(PARKED_SIZE_TILES * TILE_SIZE) / 2,
    interval: 0,
    move: { kind: 'planted' },
    fire: NONE,
  };
  if (countBy) group.countByDifficulty = countBy;
  if (difficulties) group.difficulties = difficulties;
  return group;
}

/** Parked rows (§3.1). Every jet sits on land, off the chunk edge rows. */
export const PARKED_DOCK: ParkedRow = { row: 136, cols: [12, 15, 18] };
export const PARKED_BRIDGE: ParkedRow = { row: 194, cols: [10, 13] };
export const PARKED_SCORCH: ParkedRow = { row: 314, cols: [4, 7, 10] };

function strike(
  side: 'left' | 'right',
  delay: number,
  opts: { levelY?: number; run?: number; difficulties?: readonly WaveDifficulty[]; drop?: 'B' } = {}
): SpawnGroup {
  const sign = side === 'left' ? 1 : -1;
  const group: SpawnGroup = {
    enemy: 'strike',
    count: 1,
    xs: [side === 'left' ? 64 : 296],
    y: -24,
    delay,
    move: {
      kind: 'strafe',
      speed: 120,
      levelY: opts.levelY ?? 150,
      run: sign * (opts.run ?? 150),
      enterAngle: sign * 20,
      exitAngle: sign * 25,
    },
    fire: STRIKE_FAN,
  };
  if (opts.difficulties) group.difficulties = opts.difficulties;
  if (opts.drop) group.drops = [{ index: 0, item: opts.drop }];
  return group;
}

function hoverMedium(x: number, stopY: number, drop: 'P' | 'B' | null, delay = 0): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'medium',
    count: 1,
    xs: [x],
    move: { kind: 'hover', stopY, hold: 3 },
    fire: fan('fan3', 34, 1.4),
    fireByDifficulty: { medium: fan('fan5', 38, 1.25), hard: fan('fan5', 42, 1.05) },
  };
  if (drop) group.drops = [{ index: 0, item: drop }];
  if (delay) group.delay = delay;
  return group;
}

function escort(x: number, angle: number, count: number, countBy?: CountBy, delay = 0): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'small',
    count,
    xs: [x],
    interval: 0.28,
    move: { kind: 'straight', speed: 200, angle },
    fire: NONE,
    fireByDifficulty: SMALL_LATE_LIGHT,
  };
  if (countBy) group.countByDifficulty = countBy;
  if (delay) group.delay = delay;
  return group;
}

function bomber(x: number, delay: number, drop?: 'B'): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'bomber',
    count: 1,
    xs: [x],
    move: { kind: 'slow_push', stopY: 150, hold: 4 },
    fire: fan('fan5', 50, 1.6),
    fireByDifficulty: { medium: fan('fan5', 54, 1.4), hard: fan('fan5', 58, 1.2) },
  };
  if (delay) group.delay = delay;
  if (drop) group.drops = [{ index: 0, item: drop }];
  return group;
}

export const stage3: StageData = {
  id: '3',
  label: '3',
  name: '叛军心脏',
  stage: 3,
  scrollSpeed: BG_SCROLL_SPEED,
  warningAt: STAGE3_WARNING_AT,
  maps: { run: [{ map: 'riverA', at: 0 }], boss: 'furnaceBoss' },
  captions: [
    { id: 's3_open', at: 'open' },
    { id: 's3_end', at: 'clear' },
  ],

  waves: [
    // valley 0:00–0:20. River in the middle, then the lake.
    {
      id: 'W01',
      t: 1,
      section: 'valley',
      mvp: true,
      groups: [
        sineColumn(110, 3, { medium: 4, hard: 5 }),
        { ...sineColumn(250, 3, { medium: 4, hard: 5 }), delay: 0.16 },
      ],
    },
    {
      id: 'W02',
      t: 6,
      section: 'valley',
      mvp: true,
      groups: [vee(180)],
    },
    {
      id: 'W03',
      t: 11,
      section: 'valley',
      mvp: false,
      groups: [tank(48, aimed(2.4), TANK_BY), tank(312, aimed(2.4), TANK_BY, { delay: 0.6 })],
    },
    {
      id: 'W04',
      t: 15,
      section: 'valley',
      mvp: true,
      groups: [hoverMedium(180, 140, 'P')],
    },
    {
      id: 'W05',
      t: 17,
      section: 'valley',
      mvp: false,
      groups: [
        cross('topLeft', 3, { medium: 4, hard: 5 }),
        cross('topRight', 3, { medium: 4, hard: 5 }, 0.5),
      ],
    },

    // dock 0:20–0:46. River on the left bank; factory guns and the first parked row.
    {
      id: 'W06',
      t: 20,
      section: 'dock',
      mvp: true,
      groups: [
        aa(56, -24, 0.5),
        aa(232, -40, 0.9),
        tank(300, aimed(2.3), TANK_BY, { delay: 1.4 }),
        tank(196, aimed(2.3), TANK_BY, { delay: 2.4, difficulties: MEDIUM_HARD }),
      ],
    },
    {
      id: 'W07',
      t: 24,
      section: 'dock',
      mvp: true,
      groups: [
        sineColumn(220, 3, { medium: 4, hard: 5 }, { fireBy: SMALL_LATE }),
        { ...sineColumn(310, 3, { medium: 4, hard: 5 }, { fireBy: SMALL_LATE }), delay: 0.16 },
      ],
    },
    {
      id: 'W08',
      t: 28,
      section: 'dock',
      mvp: false,
      groups: arcs(4, 110),
    },
    {
      id: 'W09',
      t: 32,
      section: 'dock',
      mvp: true,
      groups: [vee(230, SMALL_LATE)],
    },
    {
      id: 'W10',
      t: 36,
      section: 'dock',
      mvp: true,
      groups: [
        hoverMedium(250, 130, 'P'),
        escort(150, 8, 2, { hard: 3 }, 0.4),
        escort(340, -8, 2, { hard: 3 }, 0.4),
      ],
    },
    {
      id: 'W11',
      t: parkedSpawnTime(PARKED_DOCK.row),
      section: 'dock',
      mvp: true,
      groups: [parked(PARKED_DOCK, 2, { medium: 3, hard: 3 })],
    },
    {
      id: 'W12',
      t: 40,
      section: 'dock',
      mvp: false,
      groups: [
        tank(200, aimed(2.2), TANK_BY),
        tank(296, aimed(2.2), TANK_BY, { delay: 0.8 }),
        tank(150, aimed(2.2), TANK_BY, { delay: 1.6, difficulties: HARD }),
      ],
    },
    {
      id: 'W13',
      t: 43,
      section: 'dock',
      mvp: false,
      groups: [drone(140, 0), drone(240, 0.35), drone(320, 0.7), drone(190, 1.05, MEDIUM_HARD)],
    },

    // crossing 0:46–1:06. Air pressure; a gap near 0:48 for the risk crate.
    {
      id: 'W14',
      t: 52,
      section: 'crossing',
      mvp: false,
      groups: arcs(4, 150),
    },
    {
      id: 'W15',
      t: 55,
      section: 'crossing',
      mvp: true,
      groups: [
        cross('topLeft', 3, { medium: 4, hard: 5 }, 0, SMALL_LATE),
        cross('topRight', 3, { medium: 4, hard: 5 }, 0.5, SMALL_LATE),
      ],
    },
    {
      id: 'W16',
      t: 58,
      section: 'crossing',
      mvp: false,
      groups: [drone(100, 0), drone(200, 0.35), drone(300, 0.7), drone(250, 1.05, MEDIUM_HARD)],
    },
    {
      id: 'W17',
      t: 60,
      section: 'crossing',
      mvp: true,
      groups: [
        sineColumn(200, 3, { medium: 4, hard: 5 }, { fireBy: SMALL_LATE }),
        { ...sineColumn(300, 3, { medium: 4, hard: 5 }, { fireBy: SMALL_LATE }), delay: 0.16 },
      ],
    },
    {
      // Hard only: two more parked jets on the bank past the first bridge.
      id: 'W18',
      t: parkedSpawnTime(PARKED_BRIDGE.row),
      section: 'crossing',
      mvp: false,
      difficulties: HARD,
      groups: [parked(PARKED_BRIDGE, 2)],
    },
    {
      id: 'W19',
      t: 63,
      section: 'crossing',
      mvp: false,
      groups: [aa(184, -24, 0.6), aa(296, -40, 1.0, MEDIUM_HARD)],
    },

    // crossing 1:06–1:28. First strafe, a bomber push, the missile car.
    {
      id: 'W20',
      t: 67,
      section: 'crossing',
      mvp: true,
      groups: [
        strike('left', 0, { difficulties: EASY }),
        strike('left', 0, { difficulties: MEDIUM_HARD }),
        strike('right', 1.2, { difficulties: MEDIUM_HARD, levelY: 180 }),
      ],
    },
    {
      id: 'W21',
      t: 71,
      section: 'crossing',
      mvp: false,
      groups: [
        bomber(200, 0),
        escort(60, 10, 2, { medium: 2, hard: 3 }),
        escort(300, -10, 2, { medium: 2, hard: 3 }),
      ],
    },
    {
      id: 'W22',
      t: 74,
      section: 'crossing',
      mvp: false,
      groups: [
        missileCar(64),
        tank(310, aimed(2.1), TANK_BY, { delay: 0.6 }),
        missileCar(120, 1.4, HARD),
      ],
    },
    {
      id: 'W23',
      t: 76,
      section: 'crossing',
      mvp: true,
      groups: [hoverMedium(110, 140, 'B')],
    },
    {
      id: 'W24',
      t: 80,
      section: 'crossing',
      mvp: true,
      groups: [vee(150, SMALL_LATE)],
    },
    {
      id: 'W25',
      t: 84,
      section: 'crossing',
      mvp: false,
      groups: [
        tank(56, aimed(2.0), TANK_LATE_BY),
        tank(120, aimed(2.0), TANK_LATE_BY, { delay: 0.7 }),
        tank(88, aimed(2.0), TANK_LATE_BY, { delay: 1.4, difficulties: HARD }),
      ],
    },

    // scorch 1:28–1:54. Two more strafes, denser smalls, the second parked row.
    {
      id: 'W26',
      t: 88,
      section: 'scorch',
      mvp: true,
      groups: [
        sineColumn(60, 4, { medium: 5, hard: 6 }, { fireBy: SMALL_LATE }),
        { ...sineColumn(170, 4, { medium: 5, hard: 6 }, { fireBy: SMALL_LATE }), delay: 0.16 },
      ],
    },
    {
      id: 'W27',
      t: 92,
      section: 'scorch',
      mvp: true,
      groups: [
        strike('right', 0),
        strike('left', 1.2, { difficulties: MEDIUM_HARD, levelY: 170 }),
        strike('right', 2.4, { difficulties: HARD, levelY: 120, run: 120 }),
      ],
    },
    {
      id: 'W28',
      t: 96,
      section: 'scorch',
      mvp: false,
      groups: [drone(80, 0.8), drone(180, 1.15), drone(260, 1.5), drone(130, 1.85, MEDIUM_HARD)],
    },
    {
      id: 'W29',
      t: 99,
      section: 'scorch',
      mvp: false,
      groups: arcs(4, 120),
    },
    {
      id: 'W30',
      t: 101,
      section: 'scorch',
      mvp: false,
      groups: [
        aa(152, -24, 0.6),
        tank(72, aimed(2.0), TANK_LATE_BY, { delay: 0.8 }),
        tank(170, aimed(2.0), TANK_LATE_BY, { delay: 1.4 }),
        tank(100, aimed(2.0), TANK_LATE_BY, { delay: 2.0, difficulties: MEDIUM_HARD }),
        tank(40, aimed(2.0), TANK_LATE_BY, { delay: 2.4, difficulties: HARD }),
      ],
    },
    {
      id: 'W31',
      t: 104,
      section: 'scorch',
      mvp: true,
      groups: [
        cross('topLeft', 4, { medium: 5, hard: 6 }, 0, SMALL_LATE),
        cross('topRight', 4, { medium: 5, hard: 6 }, 0.4, SMALL_LATE),
      ],
    },
    {
      id: 'W32',
      t: 106,
      section: 'scorch',
      mvp: true,
      difficulties: MEDIUM_HARD,
      groups: [
        strike('left', 0, { levelY: 160 }),
        strike('right', 1.2, { difficulties: HARD, levelY: 190 }),
      ],
    },
    {
      id: 'W33',
      t: 108,
      section: 'scorch',
      mvp: true,
      groups: [vee(200, SMALL_LATE)],
    },
    {
      id: 'W34',
      t: parkedSpawnTime(PARKED_SCORCH.row),
      section: 'scorch',
      mvp: true,
      groups: [parked(PARKED_SCORCH, 2, { medium: 3, hard: 3 })],
    },
    {
      id: 'W35',
      t: 110,
      section: 'scorch',
      mvp: false,
      groups: [
        bomber(130, 0, 'B'),
        escort(40, 10, 2, { medium: 3, hard: 3 }),
        escort(230, -10, 2, { medium: 3, hard: 3 }),
      ],
    },
    {
      // Relief carrier. Not the timed supply ship, which is not implemented.
      id: 'W36',
      t: 114,
      section: 'scorch',
      mvp: true,
      condition: 'powerBelowMax',
      groups: [
        {
          enemy: 'medium',
          count: 1,
          xs: [180],
          move: { kind: 'hover', stopY: 150, hold: 3 },
          fire: NONE,
          drops: [{ index: 0, item: 'P' }],
        },
      ],
    },
  ],

  // §5. Stage 3's own clocks. Stage 1's RISK_CRATE_* and stage 2's times stay put.
  riskCrates: [
    { t: STAGE3_RISK_EARLY_T, x: STAGE3_RISK_CENTER_X, difficulties: ['easy'] },
    { t: STAGE3_RISK_EARLY_T, x: STAGE3_RISK_LEFT_X, difficulties: ['medium', 'hard'] },
    { t: STAGE3_RISK_MID_T, x: STAGE3_RISK_MID_X, difficulties: ['hard'] },
    { t: STAGE3_RISK_LATE_T, x: STAGE3_RISK_RIGHT_X, difficulties: ['medium', 'hard'] },
  ],

  // §5. Rows and columns index the composed 河流A grid. Sea guns sit in the
  // channel, everything else on bank land. Locks beat BUILDING_DROP_RULES.
  // `s3-bank-mate` is B06 then B08, so floor(rng * 2) === 0 locks M on B06.
  buildings: [
    { id: 'B01', type: 'pillbox', map: 'riverA', row: 142, col: 14 },
    { id: 'B02', type: 'sea_gun', map: 'riverA', row: 150, col: 2, drop: 'T' },
    { id: 'B03', type: 'fuel_depot', map: 'riverA', row: 172, col: 12, drop: 'M' },
    { id: 'B04', type: 'radar_station', map: 'riverA', row: 212, col: 14 },
    { id: 'B05', type: 'sea_gun', map: 'riverA', row: 236, col: 18, drop: 'T' },
    {
      id: 'B06',
      type: 'pillbox',
      map: 'riverA',
      row: 276,
      col: 4,
      drop: { exclusive: 's3-bank-mate', item: 'M' },
    },
    { id: 'B07', type: 'fuel_depot', map: 'riverA', row: 288, col: 8 },
    {
      id: 'B08',
      type: 'pillbox',
      map: 'riverA',
      row: 304,
      col: 4,
      drop: { exclusive: 's3-bank-mate', item: 'M' },
    },
  ],

  boss: FURNACE,
};
