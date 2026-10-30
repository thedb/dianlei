/**
 * Stage 4 run. Naval signature from `docs/电雷_第四关波次表_v3.md`:
 * wake climbs, water skims, radar locks, torpedo lanes, and flak rings.
 * The carrier launch and the obsidian fight are unchanged.
 */

import {
  BG_SCROLL_SPEED,
  STAGE4_RISK_CENTER_X,
  STAGE4_RISK_EARLY_T,
  STAGE4_RISK_LATE_T,
  STAGE4_RISK_LEFT_X,
  STAGE4_RISK_MID_T,
  STAGE4_RISK_MID_X,
  STAGE4_RISK_RIGHT_X,
  STAGE4_WARNING_AT,
  STAGE4_WRECK_AT,
  TORPEDO_LENGTH,
  TORPEDO_LIFE,
  TORPEDO_WARN,
  TORPEDO_WIDTH,
} from '@/game/config';
import { SEA_FLOAT_ANCHORS, SEA_GUN_PADS } from '@/game/maps/seaB';
import { OBSIDIAN } from './bosses/obsidian';
import type {
  Fire,
  Move,
  SpawnGroup,
  StageData,
  StageSection,
  Wave,
  WaveDifficulty,
} from './types';

const WAKE_SPEED = 160;
const WAKE_HOLD = 1.5;
const SKIM_SPEED = 240;
const TORPEDO_MOVE: Move = { kind: 'wake_climb', speed: 140, stopY: 200, hold: 2.2 };

const NONE: Fire = { kind: 'none' };
const HARD: readonly WaveDifficulty[] = ['hard'];
const EASY_MEDIUM: readonly WaveDifficulty[] = ['easy', 'medium'];
const MEDIUM_HARD: readonly WaveDifficulty[] = ['medium', 'hard'];

const TORPEDO_FIRE: Fire = {
  kind: 'torpedo',
  warn: TORPEDO_WARN,
  life: TORPEDO_LIFE,
  length: TORPEDO_LENGTH,
  width: TORPEDO_WIDTH,
  maxShots: 1,
  firstDelay: 0.35,
  interval: 9,
};

function wake(stopY: number): Move {
  return { kind: 'wake_climb', speed: WAKE_SPEED, stopY, hold: WAKE_HOLD };
}

function skim(side: 'left' | 'right', y: number): Move {
  return { kind: 'cross_skim', side, y, speed: SKIM_SPEED };
}

function paint(stopY: number, paintTime: number, hold = 2.2): Move {
  return { kind: 'radar_paint', stopY, paint: paintTime, hold };
}

function orbitMove(x: number): Move {
  return { kind: 'orbit', anchor: { x, y: 150 }, r: 28, period: 2.2, hold: 3.6 };
}

function ring(interval: number): Fire {
  return { kind: 'ring8', interval, rotStep: 22.5 };
}

function splash(shots: number, interval: number, spread?: number): Fire {
  return {
    kind: 'splash',
    maxShots: shots,
    interval,
    firstDelay: 0.08,
    ...(spread === undefined ? {} : { spread }),
  };
}

function fan(
  count: number,
  spread: number,
  speed: number,
  interval: number,
  maxShots: number,
  firstDelay = 0.25
): Fire {
  return {
    kind: 'pattern',
    pattern: { shape: 'fan', count, spreadDeg: spread, aim: 'player', bullet: 'small', speed },
    interval,
    maxShots,
    firstDelay,
  };
}

function lock(count: number, spread: number, speed: number, maxShots = 1): Fire {
  return {
    kind: 'pattern',
    pattern: { shape: 'fan', count, spreadDeg: spread, aim: 'barrel', bullet: 'small', speed },
    interval: maxShots > 1 ? 0.4 : 8,
    maxShots,
    firstDelay: 0.02,
  };
}

const DECK_WAKE: Fire = { kind: 'aimed1', maxShots: 1, firstDelay: 0.45, interval: 2 };
const DECK_WAKE_M: Fire = { kind: 'aimed3burst', maxShots: 1, firstDelay: 0.4, interval: 2 };
const DECK_WAKE_H: Fire = {
  kind: 'aimed_fast3',
  maxShots: 1,
  firstDelay: 0.35,
  interval: 2,
  speed: 220,
};

const FLEET_WAKE: Fire = { kind: 'aimed3burst', interval: 1.35, maxShots: 2, firstDelay: 0.3 };
const FLEET_WAKE_M: Fire = {
  kind: 'aimed_fast3',
  interval: 1.1,
  maxShots: 2,
  firstDelay: 0.25,
  speed: 210,
};
const FLEET_WAKE_H: Fire = fan(5, 40, 200, 0.95, 3, 0.2);

const WRECK_WAKE: Fire = {
  kind: 'aimed_fast3',
  interval: 1.05,
  maxShots: 3,
  firstDelay: 0.2,
  speed: 210,
};
const WRECK_WAKE_M: Fire = fan(5, 44, 210, 0.85, 3, 0.2);
const WRECK_WAKE_H: Fire = fan(7, 52, 230, 0.7, 4, 0.15);

const SKIM_E = splash(2, 0.2);
const SKIM_M = splash(3, 0.16);
const SKIM_H = splash(3, 0.14, 78);
const WRECK_SKIM_E = splash(3, 0.16);
const WRECK_SKIM_M = splash(4, 0.14);
const WRECK_SKIM_H = splash(4, 0.12, 84);

const LOCK_E = lock(5, 24, 180);
const LOCK_M = lock(7, 24, 200);
const LOCK_H = lock(9, 28, 220);
const WRECK_LOCK_E = lock(5, 24, 180, 2);
const WRECK_LOCK_M = lock(7, 24, 200, 2);
const WRECK_LOCK_H = lock(9, 28, 220, 2);

const RING_E = ring(2.2);
const RING_M = ring(1.9);
const RING_H = ring(1.6);
const WRECK_RING_E = ring(1.7);
const WRECK_RING_M = ring(1.45);
const WRECK_RING_H = ring(1.2);

const ARC: Fire = { kind: 'aimed_fast3', maxShots: 1, firstDelay: 0.35, interval: 2 };
const ARC_H: Fire = {
  kind: 'aimed_fast3',
  maxShots: 2,
  firstDelay: 0.3,
  interval: 0.65,
  speed: 220,
};

interface CountOpts {
  medium?: number;
  hard?: number;
  delay?: number;
  interval?: number;
  difficulties?: readonly WaveDifficulty[];
  drops?: SpawnGroup['drops'];
}

function air(
  enemy: SpawnGroup['enemy'],
  count: number,
  xs: number[],
  move: Move,
  fire: Fire,
  fireByDifficulty: SpawnGroup['fireByDifficulty'],
  opts: CountOpts = {}
): SpawnGroup {
  const countByDifficulty: { medium?: number; hard?: number } = {};
  if (opts.medium !== undefined) countByDifficulty.medium = opts.medium;
  if (opts.hard !== undefined) countByDifficulty.hard = opts.hard;
  return {
    enemy,
    count,
    xs,
    move,
    fire,
    ...(fireByDifficulty ? { fireByDifficulty } : {}),
    ...(opts.medium !== undefined || opts.hard !== undefined ? { countByDifficulty } : {}),
    ...(opts.delay === undefined ? {} : { delay: opts.delay }),
    ...(opts.interval === undefined ? {} : { interval: opts.interval }),
    ...(opts.difficulties ? { difficulties: opts.difficulties } : {}),
    ...(opts.drops ? { drops: opts.drops } : {}),
  };
}

function wakes(
  xs: number[],
  per: number,
  medium: number,
  hard: number,
  stopY: number,
  fire: Fire,
  by: SpawnGroup['fireByDifficulty']
): SpawnGroup[] {
  return xs.map((x) =>
    air('small', per, [x], wake(stopY), fire, by, { medium, hard, interval: 0.28 })
  );
}

function skims(
  y: number,
  per: number,
  medium: number,
  hard: number,
  fire: Fire,
  by: SpawnGroup['fireByDifficulty'],
  rightMedium = medium,
  rightHard = hard
): SpawnGroup[] {
  return [
    air('small', per, [0], skim('left', y), fire, by, { medium, hard, interval: 0.32 }),
    air('small', per, [0], skim('right', y), fire, by, {
      medium: rightMedium,
      hard: rightHard,
      interval: 0.32,
      delay: 0.16,
    }),
  ];
}

function painters(
  xs: number[],
  count: number,
  stopY: number,
  paintTime: number,
  fire: Fire,
  by: SpawnGroup['fireByDifficulty'],
  opts: CountOpts = {}
): SpawnGroup {
  return air(
    'interceptor',
    count,
    xs,
    paint(stopY, paintTime, opts.delay === undefined ? 2.2 : 2),
    fire,
    by,
    {
      ...opts,
      interval: 0.22,
    }
  );
}

function drones(
  xs: number[],
  fire: Fire,
  by: SpawnGroup['fireByDifficulty'],
  difficulties?: readonly WaveDifficulty[],
  delay = 0
): SpawnGroup[] {
  return xs.map((x, i) =>
    air('drone', 1, [x], orbitMove(x), fire, by, {
      delay: delay + i * 0.28,
      ...(difficulties ? { difficulties } : {}),
    })
  );
}

function wave(
  id: string,
  t: number,
  section: StageSection,
  groups: SpawnGroup[],
  condition?: Wave['condition']
): Wave {
  return { id, t, section, mvp: true, groups, ...(condition ? { condition } : {}) };
}

const LOCK_BY = { medium: LOCK_M, hard: LOCK_H };
const WRECK_LOCK_BY = { medium: WRECK_LOCK_M, hard: WRECK_LOCK_H };
const SKIM_BY = { medium: SKIM_M, hard: SKIM_H };
const WRECK_SKIM_BY = { medium: WRECK_SKIM_M, hard: WRECK_SKIM_H };
const DECK_WAKE_BY = { medium: DECK_WAKE_M, hard: DECK_WAKE_H };
const FLEET_WAKE_BY = { medium: FLEET_WAKE_M, hard: FLEET_WAKE_H };
const WRECK_WAKE_BY = { medium: WRECK_WAKE_M, hard: WRECK_WAKE_H };
const RING_BY = { medium: RING_M, hard: RING_H };
const WRECK_RING_BY = { medium: WRECK_RING_M, hard: WRECK_RING_H };

const PAINT_XS = [70, 130, 190, 250, 300, 330];

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
  riskCrates: [
    { t: STAGE4_RISK_EARLY_T, x: STAGE4_RISK_CENTER_X, difficulties: ['easy'] },
    { t: STAGE4_RISK_EARLY_T, x: STAGE4_RISK_LEFT_X, difficulties: MEDIUM_HARD },
    { t: STAGE4_RISK_MID_T, x: STAGE4_RISK_MID_X, difficulties: HARD },
    { t: STAGE4_RISK_LATE_T, x: STAGE4_RISK_RIGHT_X, difficulties: MEDIUM_HARD },
  ],
  waves: [
    wave('W01', 12, 'deck', [
      ...wakes([72], 4, 5, 6, 340, DECK_WAKE, DECK_WAKE_BY),
      ...wakes([288], 4, 5, 5, 340, DECK_WAKE, DECK_WAKE_BY),
    ]),
    wave('W02', 16.5, 'deck', skims(240, 3, 4, 5, SKIM_E, SKIM_BY)),
    wave('W03', 21, 'deck', [
      painters(PAINT_XS, 4, 150, 1.05, LOCK_E, LOCK_BY, { medium: 5, hard: 6 }),
    ]),
    wave('W04', 25, 'deck', [
      air('torpedo', 1, [200], TORPEDO_MOVE, TORPEDO_FIRE, undefined, {
        drops: [{ index: 0, item: 'B' }],
      }),
    ]),
    wave('W05', 28, 'deck', wakes([96, 264], 3, 4, 5, 380, DECK_WAKE, DECK_WAKE_BY)),
    wave('W06', 33, 'deck', skims(300, 3, 4, 5, SKIM_E, SKIM_BY)),
    wave('W07', 37, 'deck', [
      ...drones([90, 150, 210, 270], RING_E, RING_BY),
      ...drones([180], RING_E, RING_BY, MEDIUM_HARD),
      ...drones([240], RING_E, RING_BY, HARD),
    ]),
    wave('W08', 39, 'deck', [
      air('medium', 1, [120], { kind: 'hover', stopY: 170, hold: 4 }, NONE, undefined, {
        drops: [{ index: 0, item: 'P' }],
      }),
    ]),
    wave('W09', 44, 'fleet', [
      ...wakes([64], 4, 5, 6, 320, FLEET_WAKE, FLEET_WAKE_BY),
      ...wakes([296], 4, 5, 5, 320, FLEET_WAKE, FLEET_WAKE_BY),
    ]),
    wave('W10', 48, 'fleet', [
      painters([80, 140, 200, 260, 300, 340], 4, 140, 0.95, LOCK_E, LOCK_BY, {
        medium: 5,
        hard: 6,
      }),
    ]),
    wave('W11', 52, 'fleet', skims(360, 3, 4, 5, SKIM_E, SKIM_BY)),
    wave('W12', 56, 'fleet', [
      air('torpedo', 1, [150], TORPEDO_MOVE, TORPEDO_FIRE, undefined),
      air('torpedo', 1, [250], TORPEDO_MOVE, TORPEDO_FIRE, undefined, {
        delay: 1.1,
        difficulties: HARD,
      }),
    ]),
    wave('W13', 60, 'fleet', [
      air(
        'interceptor',
        2,
        [0],
        { kind: 'side_arc', side: 'left', y0: 180, speed: 200 },
        ARC,
        { hard: ARC_H },
        {
          hard: 3,
          interval: 0.42,
        }
      ),
      air(
        'interceptor',
        2,
        [0],
        { kind: 'side_arc', side: 'right', y0: 200, speed: 200 },
        ARC,
        { hard: ARC_H },
        {
          medium: 3,
          hard: 3,
          interval: 0.42,
          delay: 0.2,
        }
      ),
    ]),
    wave('W14', 64, 'fleet', [
      ...wakes([88], 4, 5, 6, 400, FLEET_WAKE, FLEET_WAKE_BY),
      ...wakes([272], 4, 5, 5, 400, FLEET_WAKE, FLEET_WAKE_BY),
    ]),
    wave('W15', 67, 'fleet', [
      ...drones([100, 160, 220, 280], RING_E, RING_BY),
      ...drones([190], RING_E, RING_BY, MEDIUM_HARD),
      ...drones([250], RING_E, RING_BY, HARD),
    ]),
    wave('W16', 69, 'fleet', [
      air(
        'medium',
        1,
        [100],
        { kind: 'hover', stopY: 170, hold: 4 },
        { kind: 'aimed1', interval: 1.5, firstDelay: 0.4 },
        {
          medium: { kind: 'aimed3burst', interval: 1.3, firstDelay: 0.35 },
          hard: { kind: 'aimed_fast3', interval: 1.1, firstDelay: 0.3, speed: 220 },
        },
        { drops: [{ index: 0, item: 'B' }] }
      ),
    ]),
    wave('W17', 71, 'fleet', [
      painters([40, 80, 120, 160, 200, 240, 280, 320], 8, 160, 0.9, LOCK_E, LOCK_BY),
      painters([100], 1, 160, 0.9, LOCK_E, LOCK_BY, { difficulties: MEDIUM_HARD, delay: 0.35 }),
      painters([140], 1, 160, 0.9, LOCK_E, LOCK_BY, { difficulties: HARD, delay: 0.7 }),
    ]),
    wave('W18', 76, 'swell', skims(260, 3, 4, 5, SKIM_E, SKIM_BY)),
    wave('W19', 80, 'swell', wakes([110, 250], 3, 4, 5, 360, FLEET_WAKE, FLEET_WAKE_BY)),
    wave('W20', 84, 'swell', [
      air(
        'medium',
        1,
        [260],
        { kind: 'hover', stopY: 170, hold: 4 },
        { kind: 'aimed1', maxShots: 1, firstDelay: 0.6, interval: 2 },
        { hard: { kind: 'aimed3burst', maxShots: 1, firstDelay: 0.5, interval: 2 } },
        { drops: [{ index: 0, item: 'P' }] }
      ),
    ]),
    wave('W21', 86, 'swell', [
      painters([60, 120, 180, 240], 4, 130, 0.9, LOCK_E, LOCK_BY),
      painters([300, 340], 2, 130, 0.9, LOCK_E, LOCK_BY, { difficulties: MEDIUM_HARD, delay: 0.3 }),
      painters([100], 1, 130, 0.9, LOCK_E, LOCK_BY, { difficulties: HARD, delay: 0.6 }),
    ]),
    wave('W22', 90, 'swell', [
      ...drones([140, 200, 260], RING_E, RING_BY),
      ...drones([170], RING_E, RING_BY, MEDIUM_HARD),
      ...drones([230], RING_E, RING_BY, HARD),
    ]),
    wave('W23', 94, 'swell', skims(420, 2, 2, 3, SKIM_E, SKIM_BY, 3, 3)),
    wave('W24', 98, 'wreck', [
      ...wakes([80], 4, 4, 4, 440, WRECK_WAKE, WRECK_WAKE_BY),
      ...wakes([260], 3, 4, 5, 440, WRECK_WAKE, WRECK_WAKE_BY),
    ]),
    wave('W25', 102, 'wreck', [
      painters([70, 140, 210, 280, 320, 40], 4, 170, 0.85, WRECK_LOCK_E, WRECK_LOCK_BY, {
        medium: 5,
        hard: 6,
      }),
    ]),
    wave('W26', 105, 'wreck', [
      air('torpedo', 1, [160], TORPEDO_MOVE, TORPEDO_FIRE, undefined),
      air('torpedo', 1, [280], TORPEDO_MOVE, TORPEDO_FIRE, undefined, {
        delay: 1,
        difficulties: HARD,
      }),
    ]),
    wave('W27', 108, 'wreck', skims(280, 3, 4, 5, WRECK_SKIM_E, WRECK_SKIM_BY)),
    wave('W28', 111, 'wreck', [
      ...wakes([100], 3, 4, 5, 480, WRECK_WAKE, WRECK_WAKE_BY),
      ...wakes([240], 3, 4, 4, 480, WRECK_WAKE, WRECK_WAKE_BY),
    ]),
    wave('W29', 114, 'wreck', [
      ...drones([40, 90, 140, 190], WRECK_RING_E, WRECK_RING_BY),
      ...drones([230, 280], WRECK_RING_E, WRECK_RING_BY, MEDIUM_HARD),
      ...drones([60], WRECK_RING_E, WRECK_RING_BY, HARD),
    ]),
    wave(
      'W30',
      116,
      'wreck',
      [
        air('medium', 1, [180], { kind: 'hover', stopY: 150, hold: 3 }, NONE, undefined, {
          drops: [{ index: 0, item: 'P' }],
        }),
      ],
      'powerBelowMax'
    ),
  ],
  // B06 stays a painted pad and never spawns. Hard also skips B05.
  buildings: SEA_GUN_PADS.filter((pad) => pad.id !== 'B06').map((pad) => {
    const id = pad.id;
    const drop =
      id === 'B01' || id === 'B03'
        ? 'T'
        : id === 'B02'
          ? 'M'
          : id === 'B04' || id === 'B05'
            ? { exclusive: 's4-fleet-mate', item: 'M' as const }
            : undefined;
    return {
      id,
      type: 'aa_gun' as const,
      map: 'seaB',
      row: pad.row,
      col: pad.col,
      ...(drop ? { drop } : {}),
      ...(id === 'B05' ? { difficulties: EASY_MEDIUM } : {}),
    };
  }),
  wreckFloats: SEA_FLOAT_ANCHORS.map((anchor) => ({
    id: anchor.id,
    map: 'seaB',
    row: anchor.row,
    col: anchor.col,
  })),
  boss: OBSIDIAN,
};
