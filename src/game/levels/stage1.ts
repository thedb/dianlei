/**
 * Stage 1 wave data from docs/电雷_第一关波次表_v1.md
 *
 * MVP small-fighter formations (W01/W02/W06/W07/W10/W13/W17/W21) keep the
 * playtest density bump already on main: 94 MVP enemies including W27,
 * 148 fixed stage enemies, 149 when the W27 relief ship spawns.
 * Non-MVP counts follow the wave table. Docs win where a formation's
 * geometry was wrong (V stagger, hover stopY, escort angles).
 */

import type { SpawnGroup, StageData } from './types';

function sideArc(side: 'left' | 'right', y0: number, delay: number, speed: number): SpawnGroup {
  return {
    enemy: 'interceptor',
    count: 1,
    xs: [side === 'left' ? -16 : 376],
    y: y0,
    delay,
    move: { kind: 'side_arc', side, y0, speed },
    fire: { kind: 'aimed1', maxShots: 1 },
  };
}

function drone(
  x: number,
  anchorY: number,
  delay: number,
  hold: number,
  fireInterval: number
): SpawnGroup {
  return {
    enemy: 'drone',
    count: 1,
    xs: [x],
    delay,
    move: {
      kind: 'orbit',
      anchor: { x, y: anchorY },
      r: 30,
      period: 2.5,
      hold,
    },
    fire: { kind: 'ring8', interval: fireInterval, rotStep: 22.5 },
  };
}

const w20Anchors: ReadonlyArray<readonly [number, number]> = [
  [60, 120],
  [120, 200],
  [180, 140],
  [240, 180],
  [300, 160],
];

export const stage1: StageData = {
  stage: 1,
  scrollSpeed: 40,
  warningAt: 150,

  waves: [
    // ========================================================================
    // GROUND (0:05–0:50)
    // ========================================================================
    {
      id: 'W01',
      t: 6,
      section: 'ground',
      mvp: true,
      groups: [
        {
          enemy: 'small',
          count: 4,
          xs: [180],
          interval: 0.35,
          move: { kind: 'straight', speed: 150 },
          fire: { kind: 'none' },
        },
      ],
    },
    {
      id: 'W02',
      t: 10,
      section: 'ground',
      mvp: true,
      groups: [
        {
          enemy: 'small',
          count: 5,
          xs: [100, 260, 100, 260, 180],
          interval: 0.45,
          move: { kind: 'straight', speed: 150 },
          fire: { kind: 'aimed1', interval: 2, maxShots: 1, atY: 160 },
        },
      ],
    },
    {
      id: 'W03',
      t: 15,
      section: 'ground',
      mvp: true,
      groups: [
        {
          enemy: 'small',
          count: 1,
          xs: [180],
          y: -20,
          move: { kind: 'v_dive', speed: 120, stopY: 180 },
          fire: { kind: 'aimed1', maxShots: 1, atY: 180 },
        },
        {
          enemy: 'small',
          count: 2,
          xs: [150, 210],
          y: -40,
          move: { kind: 'v_dive', speed: 120, stopY: 180 },
          fire: { kind: 'aimed1', maxShots: 1, atY: 180 },
        },
        {
          enemy: 'small',
          count: 2,
          xs: [120, 240],
          y: -60,
          move: { kind: 'v_dive', speed: 120, stopY: 180 },
          fire: { kind: 'aimed1', maxShots: 1, atY: 180 },
        },
      ],
    },
    {
      id: 'W04',
      t: 20,
      section: 'ground',
      mvp: true,
      groups: [
        {
          enemy: 'medium',
          count: 1,
          xs: [180],
          move: { kind: 'hover', stopY: 120, hold: 4 },
          fire: { kind: 'fan3', spread: 30, interval: 1.4, firstDelay: 0.8 },
          drops: [{ index: 0, item: 'P' }],
        },
      ],
    },
    {
      id: 'W05',
      t: 24,
      section: 'ground',
      mvp: false,
      groups: [
        {
          enemy: 'tank',
          count: 1,
          xs: [72],
          y: 180,
          move: { kind: 'ground', entry: 'left' },
          fire: { kind: 'aimed1', interval: 2.2 },
        },
        {
          enemy: 'tank',
          count: 1,
          xs: [288],
          y: 260,
          move: { kind: 'ground', entry: 'right' },
          fire: { kind: 'aimed1', interval: 2.2 },
        },
      ],
    },
    {
      id: 'W06',
      t: 28,
      section: 'ground',
      mvp: true,
      groups: [
        {
          enemy: 'small',
          count: 7,
          xs: [80],
          interval: 0.28,
          move: { kind: 'sine', vy: 130, amp: 50, period: 2.0 },
          fire: { kind: 'none' },
        },
      ],
    },
    {
      id: 'W07',
      t: 32,
      section: 'ground',
      mvp: true,
      groups: [
        {
          enemy: 'small',
          count: 7,
          xs: [280],
          interval: 0.28,
          move: { kind: 'sine', vy: 130, amp: 50, period: 2.0 },
          fire: { kind: 'aimed1', interval: 2, maxShots: 1 },
          fireOnly: [1, 3, 5],
        },
      ],
    },
    {
      id: 'W08',
      t: 37,
      section: 'ground',
      mvp: false,
      groups: [
        {
          enemy: 'turret2',
          count: 1,
          xs: [180],
          move: { kind: 'ground' },
          fire: { kind: 'fixed2', interval: 1.6 },
        },
        {
          enemy: 'tank',
          count: 1,
          xs: [72],
          move: { kind: 'ground', entry: 'bottomLeft' },
          fire: { kind: 'aimed1', interval: 2.2 },
        },
        {
          enemy: 'tank',
          count: 1,
          xs: [288],
          move: { kind: 'ground', entry: 'bottomRight' },
          fire: { kind: 'aimed1', interval: 2.2 },
        },
      ],
    },
    {
      id: 'W09',
      t: 43,
      section: 'ground',
      mvp: false,
      groups: [
        {
          enemy: 'interceptor',
          count: 2,
          xs: [-16],
          y: 80,
          interval: 1.2,
          move: { kind: 'side_arc', side: 'left', y0: 80, speed: 170 },
          fire: { kind: 'aimed1', maxShots: 1 },
        },
        {
          enemy: 'interceptor',
          count: 2,
          xs: [376],
          y: 120,
          delay: 0.6,
          interval: 1.2,
          move: { kind: 'side_arc', side: 'right', y0: 120, speed: 170 },
          fire: { kind: 'aimed1', maxShots: 1 },
        },
      ],
    },
    {
      id: 'W10',
      t: 47,
      section: 'ground',
      mvp: true,
      groups: [
        {
          enemy: 'small',
          count: 9,
          xs: [110, 250, 110, 250, 110, 250, 110, 250, 180],
          interval: 0.32,
          move: { kind: 'straight', speed: 170 },
          fire: { kind: 'aimed1', interval: 2, maxShots: 1 },
          fireOnly: [0, 1],
        },
      ],
    },

    // ========================================================================
    // COAST (0:50–1:35)
    // ========================================================================
    {
      id: 'W11',
      t: 52,
      section: 'coast',
      mvp: true,
      groups: [
        {
          enemy: 'medium',
          count: 2,
          xs: [110, 250],
          interval: 0.7,
          move: { kind: 'hover', stopY: 130, hold: 5 },
          fire: { kind: 'fan3', spread: 30, interval: 1.4 },
          drops: [{ index: 0, item: 'P' }],
        },
      ],
    },
    {
      id: 'W12',
      t: 58,
      section: 'coast',
      mvp: false,
      groups: [drone(90, 150, 0, 5, 2.2), drone(180, 150, 0, 5, 2.2), drone(270, 150, 0, 5, 2.2)],
    },
    {
      id: 'W13',
      t: 62,
      section: 'coast',
      mvp: true,
      groups: [
        {
          enemy: 'small',
          count: 9,
          xs: [-12],
          y: 40,
          interval: 0.3,
          move: { kind: 'cross', from: 'topLeft', speed: 160 },
          fire: { kind: 'none' },
        },
        {
          enemy: 'medium',
          count: 1,
          xs: [270],
          move: { kind: 'hover', stopY: 110, hold: 3 },
          fire: { kind: 'fan3', spread: 30, interval: 1.4 },
          drops: [{ index: 0, item: 'B' }],
        },
      ],
    },
    {
      id: 'W14',
      t: 68,
      section: 'coast',
      mvp: false,
      groups: [
        {
          enemy: 'bomber',
          count: 1,
          xs: [180],
          move: { kind: 'slow_push', stopY: 170, hold: 6 },
          fire: { kind: 'fan5', spread: 50, interval: 1.8 },
          drops: [{ index: 0, item: 'P' }],
        },
      ],
    },
    {
      id: 'W15',
      t: 74,
      section: 'coast',
      mvp: false,
      groups: [
        {
          enemy: 'missile_car',
          count: 2,
          xs: [48, 312],
          move: { kind: 'ground' },
          fire: { kind: 'missile', interval: 3.0 },
        },
        {
          enemy: 'tank',
          count: 1,
          xs: [300],
          y: 200,
          move: { kind: 'ground', entry: 'right' },
          fire: { kind: 'aimed1', interval: 2.2 },
        },
        {
          enemy: 'tank',
          count: 1,
          xs: [300],
          move: { kind: 'ground', entry: 'bottomRight' },
          fire: { kind: 'aimed1', interval: 2.2 },
        },
      ],
    },
    {
      id: 'W16',
      t: 80,
      section: 'coast',
      mvp: false,
      groups: [0, 1, 2, 3, 4, 5].map((i) =>
        sideArc(i % 2 === 0 ? 'left' : 'right', 60 + i * 16, i * 0.5, 180)
      ),
    },
    {
      id: 'W17',
      t: 86,
      section: 'coast',
      mvp: true,
      groups: [
        {
          enemy: 'small',
          count: 7,
          xs: [-12],
          y: 20,
          interval: 0.3,
          move: { kind: 'cross', from: 'topLeft', speed: 170 },
          fire: { kind: 'aimed1', maxShots: 1, firstDelay: 0.7 },
          fireOnly: [2, 5],
        },
        {
          enemy: 'small',
          count: 7,
          xs: [372],
          y: 20,
          interval: 0.3,
          move: { kind: 'cross', from: 'topRight', speed: 170 },
          fire: { kind: 'aimed1', maxShots: 1, firstDelay: 0.7 },
          fireOnly: [2, 5],
        },
      ],
    },
    {
      id: 'W18',
      t: 91,
      section: 'coast',
      mvp: true,
      groups: [
        {
          enemy: 'medium',
          count: 1,
          xs: [120],
          move: { kind: 'hover', stopY: 110, hold: 4 },
          fire: { kind: 'fan3', spread: 30, interval: 1.5 },
        },
        {
          enemy: 'medium',
          count: 1,
          xs: [180],
          delay: 0.5,
          move: { kind: 'hover', stopY: 140, hold: 4 },
          fire: { kind: 'fan3', spread: 30, interval: 1.5 },
        },
        {
          enemy: 'medium',
          count: 1,
          xs: [240],
          delay: 1,
          move: { kind: 'hover', stopY: 110, hold: 4 },
          fire: { kind: 'fan3', spread: 30, interval: 1.5 },
        },
      ],
    },

    // ========================================================================
    // BASE (1:35–2:30)
    // ========================================================================
    {
      id: 'W19',
      t: 97,
      section: 'base',
      mvp: false,
      groups: [
        {
          enemy: 'turret2',
          count: 3,
          xs: [64, 180, 296],
          move: { kind: 'ground' },
          fire: { kind: 'fixed2', interval: 1.8 },
          fireStagger: 0.6,
        },
        {
          enemy: 'tank',
          count: 4,
          xs: [40],
          y: 210,
          interval: 0.8,
          move: { kind: 'ground', entry: 'left', vx: 15 },
          fire: { kind: 'aimed1', interval: 2.4 },
        },
      ],
    },
    {
      id: 'W20',
      t: 104,
      section: 'base',
      mvp: false,
      groups: w20Anchors.map(([x, y], i) => drone(x, y, i * 0.3, 5, 2.4)),
    },
    {
      id: 'W21',
      t: 109,
      section: 'base',
      mvp: true,
      groups: [
        {
          enemy: 'medium',
          count: 1,
          xs: [180],
          move: { kind: 'hover', stopY: 120, hold: 4 },
          fire: { kind: 'fan5', spread: 40, interval: 1.6 },
          drops: [{ index: 0, item: 'P' }],
        },
        {
          enemy: 'small',
          count: 4,
          xs: [40],
          interval: 0.56,
          move: { kind: 'straight', speed: 160, angle: 15 },
          fire: { kind: 'none' },
        },
        {
          enemy: 'small',
          count: 3,
          xs: [320],
          delay: 0.28,
          interval: 0.56,
          move: { kind: 'straight', speed: 160, angle: -15 },
          fire: { kind: 'none' },
        },
      ],
    },
    {
      id: 'W22',
      t: 115,
      section: 'base',
      mvp: false,
      groups: [
        {
          enemy: 'bomber',
          count: 1,
          xs: [100],
          move: { kind: 'slow_push', stopY: 160, hold: 6 },
          fire: { kind: 'fan5', spread: 50, interval: 1.8 },
        },
        {
          enemy: 'bomber',
          count: 1,
          xs: [260],
          delay: 1,
          move: { kind: 'slow_push', stopY: 160, hold: 6 },
          fire: { kind: 'fan5', spread: 50, interval: 1.8, firstDelay: 1.7 },
          drops: [{ index: 0, item: 'B' }],
        },
      ],
    },
    {
      id: 'W23',
      t: 122,
      section: 'base',
      mvp: false,
      groups: [
        {
          enemy: 'missile_car',
          count: 3,
          xs: [60, 180, 300],
          move: { kind: 'ground' },
          fire: { kind: 'missile', interval: 3.0 },
          fireStagger: 1,
        },
        {
          enemy: 'turret2',
          count: 2,
          xs: [120, 240],
          move: { kind: 'ground' },
          fire: { kind: 'fixed2', interval: 1.8 },
        },
      ],
    },
    {
      id: 'W24',
      t: 128,
      section: 'base',
      mvp: 'partial',
      groups: [
        {
          enemy: 'small',
          count: 14,
          xs: [40, 320, 86, 274, 133, 227, 180, 40, 320, 86, 274, 133, 227, 180],
          interval: 0.25,
          move: { kind: 'straight', speed: 190 },
          fire: { kind: 'aimed1', maxShots: 1, firstDelay: 0.45 },
          fireOnly: [0, 2, 4, 6, 8, 10, 12],
        },
        sideArc('left', 70, 0.4, 180),
        sideArc('right', 100, 0.9, 180),
        sideArc('left', 130, 1.4, 180),
        sideArc('right', 90, 1.9, 180),
      ],
    },
    {
      id: 'W25',
      t: 135,
      section: 'base',
      mvp: true,
      groups: [
        {
          enemy: 'medium',
          count: 2,
          xs: [70, 210],
          interval: 1,
          move: { kind: 'hover', stopY: 100, hold: 4 },
          fire: { kind: 'fan3', spread: 30, interval: 1.4 },
          drops: [{ index: 1, item: 'B' }],
        },
        {
          enemy: 'medium',
          count: 2,
          xs: [150, 290],
          delay: 0.5,
          interval: 1,
          move: { kind: 'hover', stopY: 140, hold: 4 },
          fire: { kind: 'fan3', spread: 30, interval: 1.4 },
        },
      ],
    },
    {
      id: 'W26',
      t: 141,
      section: 'base',
      mvp: false,
      groups: [
        drone(80, 130, 0, 4, 2.6),
        drone(280, 130, 0.2, 4, 2.6),
        drone(80, 190, 0.4, 4, 2.6),
        drone(280, 190, 0.6, 4, 2.6),
        {
          enemy: 'tank',
          count: 1,
          xs: [60],
          y: 160,
          move: { kind: 'ground', entry: 'left' },
          fire: { kind: 'aimed1', interval: 2.4 },
        },
        {
          enemy: 'tank',
          count: 1,
          xs: [300],
          y: 240,
          move: { kind: 'ground', entry: 'right' },
          fire: { kind: 'aimed1', interval: 2.4 },
        },
        {
          enemy: 'tank',
          count: 1,
          xs: [80],
          move: { kind: 'ground', entry: 'bottomLeft' },
          fire: { kind: 'aimed1', interval: 2.4 },
        },
        {
          enemy: 'tank',
          count: 1,
          xs: [280],
          move: { kind: 'ground', entry: 'bottomRight' },
          fire: { kind: 'aimed1', interval: 2.4 },
        },
        {
          enemy: 'bomber',
          count: 1,
          xs: [180],
          move: { kind: 'slow_push', stopY: 150, hold: 4 },
          fire: { kind: 'fan5', spread: 50, interval: 2.0 },
        },
      ],
    },
    {
      id: 'W27',
      t: 146,
      section: 'base',
      mvp: true,
      condition: 'powerBelowMax',
      groups: [
        {
          enemy: 'medium',
          count: 1,
          xs: [180],
          move: { kind: 'hover', stopY: 140, hold: 3 },
          fire: { kind: 'none' },
          drops: [{ index: 0, item: 'P' }],
        },
      ],
    },
  ],

  boss: {
    enterAt: 155,
    enterDuration: 3,
    parkY: 110,
    drift: { amp: 40, period: 6 },
    parts: [
      { id: 'turretL', offset: { x: -78, y: 20 }, radius: 16, hp: 140, score: 5000, phase: 1 },
      { id: 'turretR', offset: { x: 78, y: 20 }, radius: 16, hp: 140, score: 5000, phase: 1 },
      { id: 'core', offset: { x: 0, y: 10 }, radius: 22, hp: 560, score: 30000, phase: 2 },
    ],
    phase1: {
      turretL: { kind: 'fan5', spread: 60, interval: 1.6 },
      turretR: { kind: 'aimed3burst', interval: 1.6, firstDelay: 0.8 },
      hull: { kind: 'fan7wide', spread: 90, interval: 5 },
      survivorRateMul: 1.25,
    },
    transition: { duration: 1.5, bulletsToScore: 10 },
    phase2: {
      ring: { kind: 'ring16', interval: 2.0, rotStep: 11.25 },
      aimed: { kind: 'aimed_fast3', interval: 1.2 },
      laser: {
        every: 7,
        telegraph: 0.8,
        sweep: 1.5,
        fromDeg: -25,
        toDeg: 25,
        width: 10,
        hitWidth: 8,
      },
      enrageAtHpRatio: 0.5,
      enrage: { ringInterval: 1.6, laserEvery: 5.5, sweep: 1.2 },
    },
    death: { duration: 2.5, explosions: 6 },
  },
};

/** Waves marked playable in the MVP (★ and ☆). */
export function getMvpWaves() {
  return stage1.waves.filter((w) => w.mvp === true || w.mvp === 'partial');
}

function countGroups(wave: (typeof stage1.waves)[number], mvpPartial: boolean): number {
  return wave.groups.reduce((sum, group) => {
    if (
      mvpPartial &&
      wave.mvp === 'partial' &&
      group.enemy !== 'small' &&
      group.enemy !== 'medium'
    ) {
      return sum;
    }
    return sum + group.count;
  }, 0);
}

/** Small and medium ships the MVP scheduler actually spawns, including W27. */
export function getMvpEnemyCount(): number {
  return getMvpWaves().reduce((total, wave) => total + countGroups(wave, true), 0);
}

/**
 * Every ship in the full stage.
 * The conditional relief ship (W27) is included only when asked.
 */
export function getStageEnemyCount(includeConditional = true): number {
  return stage1.waves.reduce((total, wave) => {
    if (!includeConditional && wave.condition) return total;
    return total + countGroups(wave, false);
  }, 0);
}
