/**
 * Stage 4 mid-stage from docs/电雷_第四关波次表_v2.md (P35).
 *
 * Run map 海面B, boss map 黑曜舰空. One new aircraft (`carrier_bomber`) and one
 * new building (`cruiser_gun`). Wreck floaters are a prop pool, not enemies.
 * `rear_diag`, `step_slide`, `dive_once`, `strafe`, and `planted` are not used.
 * No tanks, missile cars, factory guns, parked fighters, strikes, or `turret2`.
 *
 * Easy is the base count and fire. Medium and hard add ships or swap patterns
 * on the same clock. `STAGE4_WARNING_AT` (118) ends new spawns; 黑曜 enters at
 * `OBSIDIAN_ENTER_AT` (123). Clear-wave rewards and the timed supply ship are
 * not implemented; W30 is the `powerBelowMax` relief carrier.
 */

import {
  BG_SCROLL_SPEED,
  CARRIER_BOMBER_HOLD,
  CARRIER_BOMBER_STOP_Y,
  STAGE4_RISK_CENTER_X,
  STAGE4_RISK_EARLY_T,
  STAGE4_RISK_LATE_T,
  STAGE4_RISK_LEFT_X,
  STAGE4_RISK_MID_T,
  STAGE4_RISK_MID_X,
  STAGE4_RISK_RIGHT_X,
  STAGE4_WARNING_AT,
  STAGE4_WRECK_AT,
} from '@/game/config';
import { OBSIDIAN } from './bosses/obsidian';
import type { Fire, SpawnGroup, StageData, WaveDifficulty, WreckFloatAnchor } from './types';

const MEDIUM_HARD: readonly WaveDifficulty[] = ['medium', 'hard'];
const HARD: readonly WaveDifficulty[] = ['hard'];

type FireBy = NonNullable<SpawnGroup['fireByDifficulty']>;
type CountBy = SpawnGroup['countByDifficulty'];

const NONE: Fire = { kind: 'none' };

function aimedOnce(firstDelay: number): Fire {
  return { kind: 'aimed1', maxShots: 1, firstDelay };
}

function burstOnce(firstDelay: number): Fire {
  return { kind: 'aimed3burst', maxShots: 1, firstDelay };
}

function ring(interval: number): Fire {
  return { kind: 'ring8', interval, rotStep: 22.5 };
}

/**
 * One downward large fan, then nothing. Not `fan5`: that preset aims at the
 * player and fires small bullets.
 */
export const CARRIER_BOMBER_FIRE: Fire = {
  kind: 'pattern',
  pattern: {
    shape: 'fan',
    count: 5,
    spreadDeg: 36,
    aim: 'down',
    bullet: 'large',
    speed: 80,
  },
  maxShots: 1,
  firstDelay: 0.6,
};

/** Fleet small-fighter shots. Easy stays silent. Indices are per column. */
const FLEET_FIRE: FireBy = { medium: aimedOnce(0.6), hard: burstOnce(0.55) };
const FLEET_ONLY = { medium: [1], hard: [0, 2] } as const;

function sineColumn(
  x: number,
  count: number,
  countBy?: CountBy,
  opts: { delay?: number; fleet?: boolean } = {}
): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'small',
    count,
    xs: [x],
    interval: 0.32,
    move: { kind: 'sine', vy: 120, amp: 34, period: 2.2 },
    fire: NONE,
  };
  if (countBy) group.countByDifficulty = countBy;
  if (opts.delay) group.delay = opts.delay;
  if (opts.fleet) {
    group.fireByDifficulty = FLEET_FIRE;
    group.fireOnlyByDifficulty = FLEET_ONLY;
  }
  return group;
}

function sinePair(
  left: number,
  right: number,
  count: number,
  countBy?: CountBy,
  fleet = false
): SpawnGroup[] {
  return [
    sineColumn(left, count, countBy, { fleet }),
    sineColumn(right, count, countBy, { delay: 0.16, fleet }),
  ];
}

/** V from the top. Lead first, then pairs outward. Hard adds ±90 unless asked not to. */
function vee(center: number, hardSeven: boolean): SpawnGroup {
  const xs = [0, -30, 30, -60, 60, -90, 90].map((dx) => center + dx);
  const group: SpawnGroup = {
    enemy: 'small',
    count: 5,
    xs,
    interval: 0.1,
    move: { kind: 'v_dive', speed: 170, stopY: 210 },
    fire: NONE,
  };
  if (hardSeven) group.countByDifficulty = { hard: 7 };
  return group;
}

function cross(
  from: 'topLeft' | 'topRight',
  count: number,
  countBy?: CountBy,
  fleet = false
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
  if (fleet) {
    group.fireByDifficulty = FLEET_FIRE;
    group.fireOnlyByDifficulty = FLEET_ONLY;
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

/** Interceptors alternate sides. Counts are the easy / medium / hard totals. */
function arcs(easy: number, medium: number, hard: number): SpawnGroup[] {
  const groups: SpawnGroup[] = [];
  for (let i = 0; i < hard; i++) {
    const side = i % 2 === 0 ? 'left' : 'right';
    const only = i < easy ? undefined : i < medium ? MEDIUM_HARD : HARD;
    groups.push(arc(side, 180 + (i % 3) * 20, i * 0.42, only));
  }
  return groups;
}

function drone(x: number, delay = 0, difficulties?: readonly WaveDifficulty[]): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'drone',
    count: 1,
    xs: [x],
    move: { kind: 'orbit', anchor: { x, y: 160 }, r: 30, period: 2.4, hold: 4 },
    fire: ring(2.6),
    fireByDifficulty: { medium: ring(2.4), hard: ring(2.2) },
  };
  if (delay) group.delay = delay;
  if (difficulties) group.difficulties = difficulties;
  return group;
}

function hover(
  x: number,
  stopY: number,
  hold: number,
  drop: 'P' | 'B',
  fire: Fire = NONE,
  fireBy?: FireBy
): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'medium',
    count: 1,
    xs: [x],
    move: { kind: 'hover', stopY, hold },
    fire,
    drops: [{ index: 0, item: drop }],
  };
  if (fireBy) group.fireByDifficulty = fireBy;
  return group;
}

function bomber(
  x: number,
  delay = 0,
  drop?: 'B',
  difficulties?: readonly WaveDifficulty[]
): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'carrier_bomber',
    count: 1,
    xs: [x],
    move: { kind: 'slow_push', stopY: CARRIER_BOMBER_STOP_Y, hold: CARRIER_BOMBER_HOLD },
    fire: CARRIER_BOMBER_FIRE,
  };
  if (delay) group.delay = delay;
  if (drop) group.drops = [{ index: 0, item: drop }];
  if (difficulties) group.difficulties = difficulties;
  return group;
}

const COL4: CountBy = { medium: 5, hard: 6 };
const COL3: CountBy = { medium: 4, hard: 5 };
const COL2: CountBy = { medium: 3, hard: 4 };

/** Eight water cells. The same rows the sea chart reserves. */
const FLOATS: readonly WreckFloatAnchor[] = [
  { id: 'F01', map: 'seaB', row: 288, col: 5 },
  { id: 'F02', map: 'seaB', row: 294, col: 16 },
  { id: 'F03', map: 'seaB', row: 302, col: 9 },
  { id: 'F04', map: 'seaB', row: 308, col: 18 },
  { id: 'F05', map: 'seaB', row: 314, col: 4 },
  { id: 'F06', map: 'seaB', row: 316, col: 13 },
  { id: 'F07', map: 'seaB', row: 324, col: 7 },
  { id: 'F08', map: 'seaB', row: 332, col: 15 },
];

export const stage4: StageData = {
  id: '4',
  label: '4',
  name: '航母出击',
  stage: 4,
  scrollSpeed: BG_SCROLL_SPEED,
  warningAt: STAGE4_WARNING_AT,
  maps: { run: [{ map: 'seaB', at: 0 }], boss: 'obsidianBoss' },
  captions: [
    { id: 's4_open', at: 'open' },
    { id: 's4_wreck', at: 'mid', t: STAGE4_WRECK_AT },
    { id: 's4_ufo', at: 'cutscene' },
  ],

  waves: [
    // deck 0:00–0:40. Catapult, then the first bomber.
    {
      id: 'W01',
      t: 2,
      section: 'deck',
      mvp: true,
      groups: sinePair(88, 272, 4, COL4),
    },
    {
      id: 'W02',
      t: 7,
      section: 'deck',
      mvp: true,
      groups: [vee(140, true)],
    },
    {
      id: 'W03',
      t: 12,
      section: 'deck',
      mvp: true,
      groups: arcs(4, 5, 6),
    },
    {
      id: 'W04',
      t: 16,
      section: 'deck',
      mvp: true,
      groups: [cross('topLeft', 3, COL3), cross('topRight', 3, COL3)],
    },
    {
      id: 'W05',
      t: 18,
      section: 'deck',
      mvp: true,
      groups: [hover(210, 160, 5, 'P')],
    },
    {
      id: 'W06',
      t: 22,
      section: 'deck',
      mvp: true,
      groups: sinePair(120, 240, 4, COL4),
    },
    {
      id: 'W07',
      t: 26,
      section: 'deck',
      mvp: true,
      groups: [bomber(180, 0, 'B')],
    },
    {
      id: 'W08',
      t: 30,
      section: 'deck',
      mvp: true,
      groups: sinePair(100, 260, 3, COL3),
    },
    {
      id: 'W09',
      t: 36,
      section: 'deck',
      mvp: true,
      groups: [drone(160), drone(200), drone(240), drone(220, 0.8, MEDIUM_HARD)],
    },

    // fleet 0:40–1:12. Cruiser guns scroll in beside these waves.
    {
      id: 'W10',
      t: 44,
      section: 'fleet',
      mvp: true,
      groups: sinePair(120, 280, 4, COL4, true),
    },
    {
      id: 'W11',
      t: 46,
      section: 'fleet',
      mvp: true,
      groups: arcs(4, 5, 6),
    },
    {
      id: 'W12',
      t: 50,
      section: 'fleet',
      mvp: true,
      groups: [vee(180, true)],
    },
    {
      id: 'W13',
      t: 54,
      section: 'fleet',
      mvp: true,
      groups: [cross('topLeft', 4, COL4, true), cross('topRight', 4, COL4, true)],
    },
    {
      id: 'W14',
      t: 58,
      section: 'fleet',
      mvp: true,
      groups: [bomber(150), bomber(230, 1.2, undefined, HARD)],
    },
    {
      id: 'W15',
      t: 62,
      section: 'fleet',
      mvp: true,
      groups: [drone(100), drone(180), drone(260), drone(140, 0, MEDIUM_HARD), drone(220, 0, HARD)],
    },
    {
      id: 'W16',
      t: 66,
      section: 'fleet',
      mvp: true,
      groups: sinePair(96, 264, 4, COL4, true),
    },
    {
      id: 'W17',
      t: 68,
      section: 'fleet',
      mvp: true,
      groups: [
        hover(
          120,
          160,
          5,
          'B',
          { kind: 'aimed1', interval: 1.8 },
          {
            medium: { kind: 'aimed1', interval: 1.5 },
            hard: { kind: 'aimed3burst', interval: 1.6 },
          }
        ),
      ],
    },
    {
      id: 'W18',
      t: 71,
      section: 'fleet',
      mvp: true,
      groups: arcs(4, 5, 6),
    },

    // swell 1:12–1:36. No bomber and no new gun.
    {
      id: 'W19',
      t: 76,
      section: 'swell',
      mvp: true,
      groups: [drone(140), drone(180), drone(220), drone(260, 0, MEDIUM_HARD)],
    },
    {
      id: 'W20',
      t: 80,
      section: 'swell',
      mvp: true,
      groups: [hover(240, 160, 5, 'P', aimedOnce(0.8), { hard: burstOnce(0.7) })],
    },
    {
      id: 'W21',
      t: 86,
      section: 'swell',
      mvp: true,
      groups: sinePair(100, 200, 3, COL3),
    },
    {
      id: 'W22',
      t: 90,
      section: 'swell',
      mvp: true,
      groups: arcs(2, 4, 4),
    },
    {
      id: 'W23',
      t: 94,
      section: 'swell',
      mvp: true,
      groups: sinePair(80, 160, 2, COL2),
    },

    // wreck 1:36–1:54. The caption is up from 96. Density stays under the fleet.
    {
      id: 'W24',
      t: 98,
      section: 'wreck',
      mvp: true,
      groups: sinePair(110, 250, 2, COL2),
    },
    {
      id: 'W25',
      t: 102,
      section: 'wreck',
      mvp: true,
      groups: arcs(2, 3, 4),
    },
    {
      id: 'W26',
      t: 104,
      section: 'wreck',
      mvp: true,
      difficulties: MEDIUM_HARD,
      groups: [bomber(200)],
    },
    {
      id: 'W27',
      t: 108,
      section: 'wreck',
      mvp: true,
      groups: [vee(160, false)],
    },
    {
      id: 'W28',
      t: 110,
      section: 'wreck',
      mvp: true,
      groups: [drone(120), drone(240), drone(180, 0, HARD)],
    },
    {
      id: 'W29',
      t: 112,
      section: 'wreck',
      mvp: true,
      difficulties: MEDIUM_HARD,
      groups: [sineColumn(200, 3, { hard: 4 })],
    },
    {
      id: 'W30',
      t: 114,
      section: 'wreck',
      mvp: true,
      condition: 'powerBelowMax',
      groups: [hover(180, 150, 3, 'P')],
    },
  ],

  riskCrates: [
    { t: STAGE4_RISK_EARLY_T, x: STAGE4_RISK_CENTER_X, difficulties: ['easy'] },
    { t: STAGE4_RISK_EARLY_T, x: STAGE4_RISK_LEFT_X, difficulties: ['medium', 'hard'] },
    { t: STAGE4_RISK_MID_T, x: STAGE4_RISK_MID_X, difficulties: ['hard'] },
    { t: STAGE4_RISK_LATE_T, x: STAGE4_RISK_RIGHT_X, difficulties: ['medium', 'hard'] },
  ],

  buildings: [
    { id: 'B01', type: 'cruiser_gun', map: 'seaB', row: 132, col: 8, drop: 'T' },
    { id: 'B02', type: 'cruiser_gun', map: 'seaB', row: 146, col: 5, drop: 'M' },
    { id: 'B03', type: 'cruiser_gun', map: 'seaB', row: 170, col: 7, drop: 'T' },
    {
      id: 'B04',
      type: 'cruiser_gun',
      map: 'seaB',
      row: 184,
      col: 14,
      drop: { exclusive: 's4-fleet-mate', item: 'M' },
    },
    {
      id: 'B05',
      type: 'cruiser_gun',
      map: 'seaB',
      row: 214,
      col: 15,
      drop: { exclusive: 's4-fleet-mate', item: 'M' },
    },
    {
      id: 'B06',
      type: 'cruiser_gun',
      map: 'seaB',
      row: 226,
      col: 17,
      difficulties: ['hard'],
    },
  ],

  wreckFloats: FLOATS,
  boss: OBSIDIAN,
};
