/**
 * Stage 2 mid-stage from docs/电雷_第二关波次表_v2.md.
 *
 * v1's "0 new models" lock is revoked. This table adds `factory_aa`,
 * `step_slide`, and `dive_once`, and keeps `rear_diag` as the signature.
 * Easy is the base count and fire. Medium and hard add ships or swap patterns
 * on the same clock (128 / 168 / 196, plus the W21 relief ship when main power
 * is below max). `STAGE2_WARNING_AT` stays 118. 铁堡 still enters at 123.
 *
 * Clear-wave rewards and the timed supply ship are not implemented (§5.3).
 * W21 is the `powerBelowMax` relief carrier, the same rule as stage 1 W27.
 * It is not that supply ship. No W-path, X-cross formation, or boomerang.
 */

import {
  BG_SCROLL_SPEED,
  FIXED2_SEPARATION,
  REAR_DIAG_SPAWN_X_LEFT,
  REAR_DIAG_SPAWN_X_RIGHT,
  STAGE2_WARNING_AT,
} from '@/game/config';
import { TIEBAO } from './bosses/tiebao';
import type { Fire, GroundEntry, SpawnGroup, StageData, WaveDifficulty } from './types';

const EASY: readonly WaveDifficulty[] = ['easy'];
const MEDIUM: readonly WaveDifficulty[] = ['medium'];
const MEDIUM_HARD: readonly WaveDifficulty[] = ['medium', 'hard'];
const HARD: readonly WaveDifficulty[] = ['hard'];

function aimed(interval: number): Fire {
  return { kind: 'aimed1', interval };
}

function aimedOnce(firstDelay = 0.5): Fire {
  return { kind: 'aimed1', maxShots: 1, firstDelay };
}

function burstOnce(firstDelay = 0.5): Fire {
  return { kind: 'aimed3burst', maxShots: 1, firstDelay };
}

function fan(kind: 'fan3' | 'fan5', spread: number, interval: number, firstDelay?: number): Fire {
  if (firstDelay === undefined) return { kind, spread, interval };
  return { kind, spread, interval, firstDelay };
}

function ring(interval: number, rotStep: number): Fire {
  return { kind: 'ring8', interval, rotStep };
}

/** Rear-diagonal aimed shot. The x gate holds it until the ship is on the field. */
const REAR_SHOT = aimedOnce(0.55);
const REAR_BURST = burstOnce(0.55);

function rear(opts: {
  side: 'left' | 'right';
  count: number;
  y0: number;
  bearing: number;
  speed: number;
  interval: number;
  difficulties: readonly WaveDifficulty[];
  fire?: Fire;
  fireOnly?: readonly number[];
}): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'small',
    count: opts.count,
    xs: [opts.side === 'left' ? REAR_DIAG_SPAWN_X_LEFT : REAR_DIAG_SPAWN_X_RIGHT],
    interval: opts.interval,
    difficulties: opts.difficulties,
    move: {
      kind: 'rear_diag',
      side: opts.side,
      y0: opts.y0,
      bearing: opts.bearing,
      speed: opts.speed,
    },
    fire: opts.fire ?? { kind: 'none' },
  };
  if (opts.fireOnly) group.fireOnly = opts.fireOnly;
  return group;
}

function arc(
  side: 'left' | 'right',
  y0: number,
  delay: number,
  speed: number,
  fire: Fire,
  fireByDifficulty: NonNullable<SpawnGroup['fireByDifficulty']>,
  difficulties?: readonly WaveDifficulty[]
): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'interceptor',
    count: 1,
    xs: [side === 'left' ? -16 : 376],
    y: y0,
    delay,
    move: { kind: 'side_arc', side, y0, speed },
    fire,
    fireByDifficulty,
  };
  if (difficulties) group.difficulties = difficulties;
  return group;
}

/** Anchor y and period follow W11. W19's row does not restate them. */
function drone(
  x: number,
  delay: number,
  r: number,
  hold: number,
  fire: Fire,
  fireByDifficulty: NonNullable<SpawnGroup['fireByDifficulty']>,
  difficulties?: readonly WaveDifficulty[]
): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'drone',
    count: 1,
    xs: [x],
    delay,
    move: { kind: 'orbit', anchor: { x, y: 150 }, r, period: 2.4, hold },
    fire,
    fireByDifficulty,
  };
  if (difficulties) group.difficulties = difficulties;
  return group;
}

function tank(
  entry: GroundEntry,
  x: number,
  y: number | undefined,
  fire: Fire,
  fireByDifficulty?: SpawnGroup['fireByDifficulty'],
  difficulties?: readonly WaveDifficulty[]
): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'tank',
    count: 1,
    xs: [x],
    move: { kind: 'ground', entry },
    fire,
  };
  if (y !== undefined) group.y = y;
  if (fireByDifficulty) group.fireByDifficulty = fireByDifficulty;
  if (difficulties) group.difficulties = difficulties;
  return group;
}

/**
 * Escort gap. W12 states 0.28. W20 does not, so it uses the same gap.
 * Positive angle drifts right (toward center from the left lane).
 */
function escort(
  x: number,
  angle: number,
  speed: number,
  count: number,
  countBy?: SpawnGroup['countByDifficulty'],
  difficulties?: readonly WaveDifficulty[],
  fireBy?: SpawnGroup['fireByDifficulty']
): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'small',
    count,
    xs: [x],
    interval: 0.28,
    move: { kind: 'straight', speed, angle },
    fire: { kind: 'none' },
  };
  if (countBy) group.countByDifficulty = countBy;
  if (difficulties) group.difficulties = difficulties;
  if (fireBy) group.fireByDifficulty = fireBy;
  return group;
}

const TANK_EARLY: SpawnGroup['fireByDifficulty'] = {
  medium: aimed(2.0),
  hard: aimed(1.8),
};

const TANK_WOODS: SpawnGroup['fireByDifficulty'] = {
  medium: aimed(2.0),
  hard: aimed(1.7),
};

const TANK_OPEN: SpawnGroup['fireByDifficulty'] = {
  medium: aimed(2.1),
  hard: aimed(1.8),
};

const TANK_MID: SpawnGroup['fireByDifficulty'] = {
  medium: aimed(2.0),
  hard: aimed(1.7),
};

const TANK_LATE: SpawnGroup['fireByDifficulty'] = {
  medium: aimed(1.8),
  hard: aimed(1.6),
};

/** Easy and medium fire one aimed shot at the arc apex. Hard replaces it. */
const ARC_APEX: Fire = { kind: 'aimed1', maxShots: 1 };

function outskirtsArcs(): SpawnGroup[] {
  const fireBy: NonNullable<SpawnGroup['fireByDifficulty']> = { hard: burstOnce(0.6) };
  const groups: SpawnGroup[] = [];
  for (let i = 0; i < 6; i++) {
    const side = i % 2 === 0 ? 'left' : 'right';
    const y0 = side === 'left' ? 90 : 140;
    groups.push(arc(side, y0, i * 0.45, 185, ARC_APEX, fireBy, i >= 4 ? MEDIUM_HARD : undefined));
  }
  return groups;
}

/** Six span y0 180–240. Hard adds two more inside that band, still alternating. */
function runwayArcs(): SpawnGroup[] {
  const fireBy: NonNullable<SpawnGroup['fireByDifficulty']> = {
    medium: burstOnce(0.55),
    hard: { kind: 'aimed_fast3', maxShots: 1, firstDelay: 0.5 },
  };
  const groups: SpawnGroup[] = [];
  for (let i = 0; i < 6; i++) {
    const side = i % 2 === 0 ? 'left' : 'right';
    groups.push(arc(side, 180 + i * 12, i * 0.4, 195, ARC_APEX, fireBy));
  }
  groups.push(arc('left', 210, 2.4, 195, ARC_APEX, fireBy, HARD));
  groups.push(arc('right', 230, 2.8, 195, ARC_APEX, fireBy, HARD));
  return groups;
}

const W11_FIRE = ring(2.4, 22.5);
const W11_BY: NonNullable<SpawnGroup['fireByDifficulty']> = {
  medium: ring(2.1, 22.5),
  hard: ring(1.9, 18),
};

const W19_FIRE = ring(2.3, 22.5);
const W19_BY: NonNullable<SpawnGroup['fireByDifficulty']> = {
  medium: ring(2.0, 22.5),
  hard: ring(1.9, 22.5),
};

const W17_FIRE = fan('fan3', 34, 1.4);
const W17_BY: NonNullable<SpawnGroup['fireByDifficulty']> = {
  medium: fan('fan5', 38, 1.25),
  hard: fan('fan5', 42, 1.05),
};

const W20_FIRE = fan('fan5', 50, 1.6);
const W20_BY: NonNullable<SpawnGroup['fireByDifficulty']> = {
  medium: fan('fan5', 54, 1.4),
  hard: fan('fan5', 58, 1.2),
};

function columnSine(
  x: number,
  count: number,
  countBy: SpawnGroup['countByDifficulty'],
  interval: number,
  move: Extract<SpawnGroup['move'], { kind: 'sine' }>,
  fireOnly?: readonly number[]
): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'small',
    count,
    xs: [x],
    interval,
    move,
    fire: { kind: 'none' },
  };
  if (countBy) group.countByDifficulty = countBy;
  if (fireOnly) group.fireOnly = fireOnly;
  return group;
}

/**
 * Parallel pair along the barrel, three volleys `AIMED_BURST_GAP` (0.12s) apart.
 * `interval` is the wait before the next trio, not a machine-gun stream.
 */
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

/** One on-screen factory gun. Each difficulty writes its own interval. */
function aaPlaced(x: number, y: number, firstDelay: number): SpawnGroup {
  return {
    enemy: 'factory_aa',
    count: 1,
    xs: [x],
    y,
    move: { kind: 'ground' },
    fire: aaBurst(1.65, firstDelay),
    fireByDifficulty: {
      medium: aaBurst(1.4, firstDelay),
      hard: aaBurst(1.15, firstDelay),
    },
  };
}

/** One 4-bullet fan. `maxShots` 1, so the ship does not keep spraying. */
function quadOnce(spread: number, firstDelay: number): Fire {
  return {
    kind: 'pattern',
    pattern: {
      shape: 'fan',
      count: 4,
      aim: 'player',
      bullet: 'small',
      minDist: true,
      spreadDeg: spread,
    },
    spread,
    maxShots: 1,
    firstDelay,
  };
}

const AA_EASY = aaBurst(1.65);
const AA_MEDIUM = aaBurst(1.4);
const AA_HARD = aaBurst(1.15);

function stepLane(opts: {
  x: number;
  run: number;
  count: number;
  countBy?: SpawnGroup['countByDifficulty'];
  speed: number;
  drop: number;
  steps: 1 | 2;
  interval: number;
  fire?: Fire;
  fireBy?: SpawnGroup['fireByDifficulty'];
  fireOnly?: readonly number[];
  difficulties?: readonly WaveDifficulty[];
}): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'small',
    count: opts.count,
    xs: [opts.x],
    interval: opts.interval,
    move: {
      kind: 'step_slide',
      speed: opts.speed,
      drop: opts.drop,
      run: opts.run,
      steps: opts.steps,
    },
    fire: opts.fire ?? { kind: 'none' },
  };
  if (opts.countBy) group.countByDifficulty = opts.countBy;
  if (opts.fireBy) group.fireByDifficulty = opts.fireBy;
  if (opts.fireOnly) group.fireOnly = opts.fireOnly;
  if (opts.difficulties) group.difficulties = opts.difficulties;
  return group;
}

function diveShip(opts: {
  x: number;
  angle: number;
  delay: number;
  speed: number;
  fireBy?: SpawnGroup['fireByDifficulty'];
  difficulties?: readonly WaveDifficulty[];
}): SpawnGroup {
  const group: SpawnGroup = {
    enemy: 'small',
    count: 1,
    xs: [opts.x],
    delay: opts.delay,
    move: { kind: 'dive_once', speed: opts.speed, angle: opts.angle },
    fire: { kind: 'none' },
  };
  if (opts.fireBy) group.fireByDifficulty = opts.fireBy;
  if (opts.difficulties) group.difficulties = opts.difficulties;
  return group;
}

export const stage2: StageData = {
  id: '2',
  label: '2',
  name: '工业走廊',
  stage: 2,
  scrollSpeed: BG_SCROLL_SPEED,
  warningAt: STAGE2_WARNING_AT,
  maps: { run: [{ map: 'landB', at: 0 }], boss: 'factoryBoss' },
  captions: [
    { id: 's2_open', at: 'open' },
    { id: 's2_end', at: 'clear' },
  ],

  waves: [
    // Outskirts from 0:04. Guns are already on screen; the center road stays open.
    {
      id: 'W30',
      t: 4,
      section: 'outskirts',
      mvp: true,
      groups: [
        // Shoulders of the airfield spine, not a mirror, none on x 150–210.
        aaPlaced(44, 56, 0.4),
        aaPlaced(96, 132, 0.72),
        aaPlaced(58, 220, 1.0),
        aaPlaced(124, 292, 1.28),
        aaPlaced(236, 44, 0.52),
        aaPlaced(312, 108, 0.84),
        aaPlaced(268, 188, 1.12),
        aaPlaced(332, 268, 1.36),
        tank('left', 48, 200, aimed(2.4), TANK_OPEN),
        tank('right', 312, 280, aimed(2.4), TANK_OPEN),
        tank('left', 72, 140, aimed(2.4), TANK_OPEN, MEDIUM_HARD),
        tank('right', 288, 360, aimed(2.4), TANK_OPEN, HARD),
      ],
    },
    {
      id: 'W02',
      t: 11,
      section: 'outskirts',
      mvp: true,
      groups: [100, 260].map((x) => ({
        ...columnSine(x, 4, { medium: 5, hard: 5 }, 0.24, {
          kind: 'sine',
          vy: 140,
          amp: 32,
          period: 1.8,
        }),
        fireByDifficulty: { medium: aimedOnce(), hard: burstOnce() },
        fireOnlyByDifficulty: { medium: [1, 3], hard: [1, 3] },
      })),
    },
    {
      id: 'W03',
      t: 16,
      section: 'outskirts',
      mvp: true,
      groups: [
        {
          enemy: 'medium',
          count: 2,
          xs: [104, 256],
          interval: 1.4,
          fireStagger: 0.5,
          move: { kind: 'hover', stopY: 125, hold: 5 },
          fire: quadOnce(52, 0.9),
          fireByDifficulty: {
            medium: quadOnce(40, 0.75),
            hard: quadOnce(28, 0.6),
          },
          drops: [{ index: 0, item: 'P' }],
        },
      ],
    },
    {
      id: 'W04',
      t: 21,
      section: 'outskirts',
      mvp: false,
      groups: [
        tank('left', 72, 200, aimed(2.2), TANK_EARLY),
        tank('right', 288, 260, aimed(2.2), TANK_EARLY),
        tank('bottomLeft', 96, undefined, aimed(1.8), undefined, HARD),
      ],
    },
    {
      id: 'W05',
      t: 22,
      section: 'outskirts',
      mvp: true,
      groups: [
        {
          enemy: 'small',
          count: 6,
          countByDifficulty: { medium: 8, hard: 8 },
          xs: [72, 108, 144, 180, 216, 252, 288, 324],
          interval: 0.22,
          move: { kind: 'v_dive', speed: 170, stopY: 200 },
          fire: { kind: 'aimed1', maxShots: 1, atY: 200 },
          fireByDifficulty: { hard: { kind: 'aimed3burst', maxShots: 1, atY: 200 } },
        },
      ],
    },
    {
      id: 'W23',
      t: 28,
      section: 'outskirts',
      mvp: true,
      groups: [
        stepLane({
          x: 180,
          run: 48,
          count: 4,
          countBy: { medium: 5, hard: 6 },
          speed: 130,
          drop: 72,
          steps: 1,
          interval: 0.4,
        }),
      ],
    },
    {
      id: 'W06',
      t: 34,
      section: 'outskirts',
      mvp: true,
      groups: outskirtsArcs(),
    },
    {
      id: 'W07',
      t: 36,
      section: 'outskirts',
      mvp: false,
      groups: [
        {
          enemy: 'factory_aa',
          count: 1,
          xs: [180],
          difficulties: EASY,
          move: { kind: 'ground' },
          fire: AA_EASY,
        },
        {
          enemy: 'factory_aa',
          count: 2,
          xs: [96, 264],
          difficulties: MEDIUM_HARD,
          fireStagger: 0.45,
          move: { kind: 'ground' },
          fire: AA_MEDIUM,
          fireByDifficulty: { hard: AA_HARD },
        },
        tank('bottomLeft', 72, undefined, aimed(2.2), TANK_EARLY),
        tank('bottomRight', 288, undefined, aimed(2.2), TANK_EARLY),
      ],
    },
    {
      id: 'W08',
      t: 43,
      section: 'outskirts',
      mvp: true,
      groups: [
        rear({
          side: 'left',
          count: 8,
          y0: 620,
          bearing: 28,
          speed: 160,
          interval: 0.3,
          difficulties: EASY,
        }),
        rear({
          side: 'left',
          count: 6,
          y0: 620,
          bearing: 28,
          speed: 168,
          interval: 0.26,
          difficulties: MEDIUM,
        }),
        rear({
          side: 'right',
          count: 6,
          y0: 620,
          bearing: 28,
          speed: 168,
          interval: 0.26,
          difficulties: MEDIUM,
        }),
        rear({
          side: 'left',
          count: 6,
          y0: 620,
          bearing: 28,
          speed: 180,
          interval: 0.24,
          difficulties: HARD,
          fire: REAR_SHOT,
          fireOnly: [1, 4],
        }),
        rear({
          side: 'right',
          count: 6,
          y0: 620,
          bearing: 28,
          speed: 180,
          interval: 0.24,
          difficulties: HARD,
          fire: REAR_SHOT,
          fireOnly: [1, 4],
        }),
      ],
    },

    // Runway 0:48–1:36. W22 sits at 1:30, between W16 and W17, hard only.
    {
      id: 'W09',
      t: 48,
      section: 'runway',
      mvp: true,
      groups: [
        {
          enemy: 'medium',
          count: 2,
          xs: [110, 250],
          interval: 0.6,
          move: { kind: 'hover', stopY: 120, hold: 4.5 },
          fire: fan('fan3', 32, 1.35),
          fireByDifficulty: {
            medium: fan('fan5', 40, 1.25),
            hard: fan('fan5', 44, 1.05),
          },
          drops: [{ index: 0, item: 'P' }],
        },
      ],
    },
    {
      id: 'W10',
      t: 53,
      section: 'runway',
      mvp: true,
      groups: (['topLeft', 'topRight'] as const).map((from) => ({
        enemy: 'small' as const,
        count: 6,
        countByDifficulty: { medium: 7, hard: 7 },
        xs: [from === 'topLeft' ? -12 : 372],
        y: 40,
        interval: 0.22,
        move: { kind: 'cross' as const, from, speed: 185 },
        fire: { kind: 'none' as const },
        fireByDifficulty: { medium: aimedOnce(), hard: burstOnce() },
        fireOnlyByDifficulty: { medium: [2, 5], hard: [1, 3, 5] },
      })),
    },
    {
      id: 'W11',
      t: 58,
      section: 'runway',
      mvp: false,
      groups: [70, 150, 310, 230].map((x, i) =>
        drone(x, i * 0.35, 32, 4.5, W11_FIRE, W11_BY, i === 3 ? MEDIUM_HARD : undefined)
      ),
    },
    {
      id: 'W31',
      t: 61,
      section: 'runway',
      mvp: false,
      groups: [
        tank('left', 64, 160, aimed(2.2), TANK_MID),
        tank('right', 300, 250, aimed(2.2), TANK_MID),
        tank('left', 88, 320, aimed(2.2), TANK_MID, MEDIUM_HARD),
        tank('right', 276, 90, aimed(2.2), TANK_MID, HARD),
      ],
    },
    {
      id: 'W12',
      t: 64,
      section: 'runway',
      mvp: false,
      groups: [
        {
          enemy: 'bomber',
          count: 1,
          xs: [180],
          move: { kind: 'slow_push', stopY: 165, hold: 5 },
          fire: fan('fan5', 50, 1.7),
          fireByDifficulty: {
            medium: fan('fan5', 50, 1.5),
            hard: fan('fan5', 50, 1.25),
          },
          drops: [{ index: 0, item: 'B' }],
        },
        escort(100, 10, 190, 2, { medium: 3, hard: 3 }, undefined, { hard: aimedOnce() }),
        escort(260, -10, 190, 2, { medium: 3, hard: 3 }, undefined, { hard: aimedOnce() }),
      ],
    },
    {
      id: 'W25',
      t: 68,
      section: 'runway',
      mvp: true,
      groups: [
        stepLane({
          x: 88,
          run: 64,
          count: 3,
          countBy: { medium: 4, hard: 4 },
          speed: 160,
          drop: 56,
          steps: 2,
          interval: 0.2,
          fireBy: { medium: aimedOnce(0.12), hard: burstOnce(0.12) },
          fireOnly: [1, 3],
        }),
        stepLane({
          x: 272,
          run: -64,
          count: 3,
          countBy: { medium: 4, hard: 4 },
          speed: 160,
          drop: 56,
          steps: 2,
          interval: 0.2,
          fireBy: { medium: aimedOnce(0.12), hard: burstOnce(0.12) },
          fireOnly: [1, 3],
        }),
      ],
    },
    {
      id: 'W14',
      t: 74,
      section: 'runway',
      mvp: false,
      groups: [
        {
          enemy: 'missile_car',
          count: 2,
          countByDifficulty: { hard: 3 },
          xs: [60, 300, 180],
          fireStagger: 0.8,
          move: { kind: 'ground' },
          fire: { kind: 'missile', interval: 2.6 },
          fireByDifficulty: {
            medium: { kind: 'missile', interval: 2.4 },
            hard: { kind: 'missile', interval: 2.2 },
          },
        },
        {
          enemy: 'factory_aa',
          count: 1,
          xs: [180],
          move: { kind: 'ground' },
          fire: AA_EASY,
          fireByDifficulty: { medium: AA_MEDIUM, hard: AA_HARD },
        },
        // Stay off the shoulder ditches (map columns 7 and 15). x ≥ 240.
        tank('right', 288, 220, aimed(2.2)),
        tank('bottomRight', 300, undefined, aimed(2.2)),
      ],
    },
    {
      id: 'W13',
      t: 78,
      section: 'runway',
      mvp: true,
      difficulties: MEDIUM_HARD,
      groups: [
        rear({
          side: 'left',
          count: 4,
          y0: 600,
          bearing: 26,
          speed: 170,
          interval: 0.26,
          difficulties: MEDIUM,
        }),
        rear({
          side: 'right',
          count: 4,
          y0: 600,
          bearing: 26,
          speed: 170,
          interval: 0.26,
          difficulties: MEDIUM,
        }),
        rear({
          side: 'left',
          count: 5,
          y0: 600,
          bearing: 30,
          speed: 185,
          interval: 0.22,
          difficulties: HARD,
          fire: REAR_SHOT,
          fireOnly: [2, 4],
        }),
        rear({
          side: 'right',
          count: 5,
          y0: 600,
          bearing: 30,
          speed: 185,
          interval: 0.22,
          difficulties: HARD,
          fire: REAR_SHOT,
          fireOnly: [2, 4],
        }),
      ],
    },
    {
      id: 'W15',
      t: 80,
      section: 'runway',
      mvp: true,
      groups: [64, 296].map((x) => ({
        ...columnSine(
          x,
          5,
          { medium: 6, hard: 6 },
          0.22,
          { kind: 'sine', vy: 125, amp: 64, period: 1.5 },
          [1, 3]
        ),
        fireByDifficulty: { medium: aimedOnce(), hard: burstOnce() },
      })),
    },
    {
      id: 'W26',
      t: 82,
      section: 'runway',
      mvp: true,
      groups: [
        diveShip({ x: 100, angle: 12, delay: 0, speed: 230 }),
        diveShip({
          x: 180,
          angle: 0,
          delay: 0.12,
          speed: 230,
          fireBy: { medium: aimedOnce(0.28), hard: aimedOnce(0.28) },
        }),
        diveShip({ x: 260, angle: -12, delay: 0.24, speed: 230 }),
        diveShip({ x: 180, angle: 0, delay: 0.36, speed: 230, difficulties: HARD }),
      ],
    },
    {
      id: 'W27',
      t: 84,
      section: 'runway',
      mvp: true,
      difficulties: MEDIUM_HARD,
      groups: [
        {
          enemy: 'small',
          count: 2,
          countByDifficulty: { hard: 3 },
          xs: [150, 210, 180],
          interval: 0.12,
          move: { kind: 'dive_once', speed: 260, angle: 0 },
          fire: { kind: 'none' },
        },
      ],
    },
    {
      id: 'W16',
      t: 87,
      section: 'runway',
      mvp: true,
      groups: runwayArcs(),
    },
    {
      id: 'W22',
      t: 90,
      section: 'runway',
      mvp: true,
      difficulties: HARD,
      groups: [
        rear({
          side: 'left',
          count: 4,
          y0: 580,
          bearing: 24,
          speed: 175,
          interval: 0.22,
          difficulties: HARD,
        }),
        rear({
          side: 'right',
          count: 4,
          y0: 580,
          bearing: 24,
          speed: 175,
          interval: 0.22,
          difficulties: HARD,
        }),
      ],
    },
    {
      id: 'W17',
      t: 92,
      section: 'runway',
      mvp: true,
      groups: [
        {
          enemy: 'medium',
          count: 1,
          xs: [100],
          move: { kind: 'hover', stopY: 110, hold: 4 },
          fire: W17_FIRE,
          fireByDifficulty: W17_BY,
        },
        {
          enemy: 'medium',
          count: 1,
          xs: [180],
          delay: 0.45,
          move: { kind: 'hover', stopY: 140, hold: 4 },
          fire: W17_FIRE,
          fireByDifficulty: W17_BY,
          drops: [{ index: 0, item: 'P' }],
        },
        {
          enemy: 'medium',
          count: 1,
          xs: [260],
          delay: 0.9,
          move: { kind: 'hover', stopY: 110, hold: 4 },
          fire: W17_FIRE,
          fireByDifficulty: W17_BY,
        },
      ],
    },

    // Woods 1:38–1:54. Nothing spawns after the relief ship.
    {
      id: 'W18',
      t: 98,
      section: 'woods',
      mvp: true,
      groups: [
        rear({
          side: 'left',
          count: 5,
          y0: 640,
          bearing: 28,
          speed: 165,
          interval: 0.3,
          difficulties: EASY,
        }),
        rear({
          side: 'right',
          count: 5,
          y0: 640,
          bearing: 28,
          speed: 165,
          interval: 0.3,
          difficulties: EASY,
        }),
        rear({
          side: 'left',
          count: 6,
          y0: 640,
          bearing: 28,
          speed: 172,
          interval: 0.26,
          difficulties: MEDIUM,
          fire: REAR_SHOT,
          fireOnly: [1, 3],
        }),
        rear({
          side: 'right',
          count: 6,
          y0: 640,
          bearing: 28,
          speed: 172,
          interval: 0.26,
          difficulties: MEDIUM,
          fire: REAR_SHOT,
          fireOnly: [1, 3],
        }),
        rear({
          side: 'left',
          count: 7,
          y0: 640,
          bearing: 28,
          speed: 182,
          interval: 0.22,
          difficulties: HARD,
          fire: REAR_BURST,
          fireOnly: [1, 3, 5],
        }),
        rear({
          side: 'right',
          count: 7,
          y0: 640,
          bearing: 28,
          speed: 182,
          interval: 0.22,
          difficulties: HARD,
          fire: REAR_BURST,
          fireOnly: [1, 3, 5],
        }),
      ],
    },
    {
      id: 'W28',
      t: 102,
      section: 'woods',
      mvp: true,
      difficulties: HARD,
      groups: [
        stepLane({
          x: 72,
          run: 40,
          count: 2,
          speed: 170,
          drop: 64,
          steps: 1,
          interval: 0.24,
        }),
        stepLane({
          x: 288,
          run: -40,
          count: 2,
          speed: 170,
          drop: 64,
          steps: 1,
          interval: 0.24,
        }),
      ],
    },
    {
      id: 'W19',
      t: 104,
      section: 'woods',
      mvp: false,
      groups: [
        ...[80, 180, 280, 140].map((x, i) =>
          drone(x, i * 0.35, 28, 4, W19_FIRE, W19_BY, i === 3 ? MEDIUM_HARD : undefined)
        ),
        tank('left', 72, 200, aimed(2.2), TANK_WOODS),
        tank('right', 288, 240, aimed(2.2), TANK_WOODS),
        tank('bottomLeft', 80, undefined, aimed(2.2), TANK_WOODS),
        tank('bottomRight', 280, undefined, aimed(2.2), TANK_WOODS),
      ],
    },
    {
      id: 'W29',
      t: 108,
      section: 'woods',
      mvp: true,
      groups: [
        {
          enemy: 'small',
          count: 3,
          xs: [120, 180, 240],
          interval: 0.1,
          move: { kind: 'dive_once', speed: 260, angle: 0 },
          fire: { kind: 'none' },
        },
      ],
    },
    {
      id: 'W20',
      t: 110,
      section: 'woods',
      mvp: false,
      groups: [
        {
          enemy: 'bomber',
          count: 1,
          xs: [100],
          move: { kind: 'slow_push', stopY: 150, hold: 4 },
          fire: W20_FIRE,
          fireByDifficulty: W20_BY,
        },
        {
          enemy: 'bomber',
          count: 1,
          xs: [260],
          delay: 0.8,
          move: { kind: 'slow_push', stopY: 150, hold: 4 },
          fire: W20_FIRE,
          fireByDifficulty: W20_BY,
          drops: [{ index: 0, item: 'B' }],
        },
        escort(70, 10, 200, 2, { hard: 3 }, MEDIUM_HARD),
        escort(290, -10, 200, 2, { hard: 3 }, MEDIUM_HARD),
      ],
    },
    {
      id: 'W32',
      t: 112,
      section: 'woods',
      mvp: false,
      groups: [
        tank('left', 56, 200, aimed(2.0), TANK_LATE),
        tank('right', 304, 280, aimed(2.0), TANK_LATE),
        tank('left', 80, 120, aimed(2.0), TANK_LATE, HARD),
      ],
    },
    {
      // Relief carrier. Not the timed supply ship (§5.3), which is not implemented.
      id: 'W21',
      t: 114,
      section: 'woods',
      mvp: true,
      condition: 'powerBelowMax',
      groups: [
        {
          enemy: 'medium',
          count: 1,
          xs: [180],
          move: { kind: 'hover', stopY: 150, hold: 3 },
          fire: { kind: 'none' },
          drops: [{ index: 0, item: 'P' }],
        },
      ],
    },
  ],

  // §4.6. Stage 1's RISK_CRATE_* times stay on stage 1. Same hover, shield, and drop.
  riskCrates: [
    { t: 46, x: 180, difficulties: ['easy'] },
    { t: 46, x: 48, difficulties: ['medium', 'hard'] },
    { t: 78, x: 220, difficulties: ['hard'] },
    { t: 100, x: 312, difficulties: ['medium', 'hard'] },
  ],

  // §4.5. Rows and columns index the composed 陆地B grid (mirrors already applied).
  // Locks beat BUILDING_DROP_RULES. This stage does not set `buildingDrops`.
  // `s2-drain-mate` is B07 then B08, so floor(rng * 2) === 0 locks M on B07.
  buildings: [
    { id: 'B01', type: 'pillbox', map: 'landB', row: 64, col: 16, drop: 'T' },
    { id: 'B02', type: 'fuel_depot', map: 'landB', row: 104, col: 16 },
    { id: 'B03', type: 'pillbox', map: 'landB', row: 112, col: 4 },
    { id: 'B04', type: 'pillbox', map: 'landB', row: 136, col: 16, drop: 'T' },
    { id: 'B05', type: 'fuel_depot', map: 'landB', row: 176, col: 16 },
    { id: 'B06', type: 'sea_gun', map: 'landB', row: 230, col: 2, drop: 'M' },
    {
      id: 'B07',
      type: 'sea_gun',
      map: 'landB',
      row: 230,
      col: 16,
      drop: { exclusive: 's2-drain-mate', item: 'M' },
    },
    {
      id: 'B08',
      type: 'sea_gun',
      map: 'landB',
      row: 232,
      col: 8,
      drop: { exclusive: 's2-drain-mate', item: 'M' },
    },
    { id: 'B09', type: 'radar_station', map: 'landB', row: 256, col: 4 },
    { id: 'B10', type: 'radar_station', map: 'landB', row: 288, col: 16 },
  ],

  boss: TIEBAO,
};
