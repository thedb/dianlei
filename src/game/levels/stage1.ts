/**
 * Stage 1 wave data - MVP waves only (marked ★ in wave table)
 * Full data from docs/电雷_第一关波次表_v1.md
 */

import type { StageData } from './types';

export const stage1: StageData = {
  stage: 1,
  scrollSpeed: 40,
  warningAt: 150,

  waves: [
    // ========================================================================
    // GROUND SECTION (0:05 - 0:50)
    // ========================================================================

    // W01 ★ - Opening formation
    {
      id: 'W01',
      t: 6,
      section: 'ground',
      mvp: true,
      groups: [
        {
          enemy: 'small',
          count: 3,
          xs: [180],
          interval: 0.4,
          move: { kind: 'straight', speed: 150 },
          fire: { kind: 'none' },
        },
      ],
    },

    // W02 ★ - Two columns with aimed shots
    {
      id: 'W02',
      t: 10,
      section: 'ground',
      mvp: true,
      groups: [
        {
          enemy: 'small',
          count: 4,
          xs: [100, 260, 100, 260],
          interval: 0.5,
          move: { kind: 'straight', speed: 150 },
          fire: { kind: 'aimed1', interval: 2, maxShots: 1, atY: 160 },
        },
      ],
    },

    // W03 ★ - V-formation dive
    {
      id: 'W03',
      t: 15,
      section: 'ground',
      mvp: true,
      groups: [
        {
          enemy: 'small',
          count: 5,
          xs: [120, 240, 150, 210, 180],
          interval: 0.15,
          move: { kind: 'v_dive', speed: 120, stopY: 180 },
          fire: { kind: 'aimed1', interval: 2, maxShots: 1 },
        },
      ],
    },

    // W04 ★ - First medium fighter with P drop
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

    // W06 ★ - Sine wave from left
    {
      id: 'W06',
      t: 28,
      section: 'ground',
      mvp: true,
      groups: [
        {
          enemy: 'small',
          count: 6,
          xs: [80],
          interval: 0.3,
          move: { kind: 'sine', vy: 130, amp: 50, period: 2.0 },
          fire: { kind: 'none' },
        },
      ],
    },

    // W07 ★ - Sine wave from right (mirror)
    {
      id: 'W07',
      t: 32,
      section: 'ground',
      mvp: true,
      groups: [
        {
          enemy: 'small',
          count: 6,
          xs: [280],
          interval: 0.3,
          move: { kind: 'sine', vy: 130, amp: 50, period: 2.0 },
          fire: { kind: 'aimed1', interval: 2, maxShots: 1 },
          fireOnly: [1, 3, 5],
        },
      ],
    },

    // W10 ★ - Two columns straight down
    {
      id: 'W10',
      t: 47,
      section: 'ground',
      mvp: true,
      groups: [
        {
          enemy: 'small',
          count: 8,
          xs: [110, 250, 110, 250, 110, 250, 110, 250],
          interval: 0.35,
          move: { kind: 'straight', speed: 170 },
          fire: { kind: 'aimed1', interval: 2, maxShots: 1 },
          fireOnly: [0, 1],
        },
      ],
    },

    // ========================================================================
    // COAST SECTION (0:50 - 1:35)
    // ========================================================================

    // W11 ★ - Two medium fighters with P drop
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

    // W13 ★ - Cross from left + medium with B drop
    {
      id: 'W13',
      t: 62,
      section: 'coast',
      mvp: true,
      groups: [
        {
          enemy: 'small',
          count: 8,
          xs: [-12, -12, -12, -12, -12, -12, -12, -12],
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

    // W17 ★ - Cross pattern from both sides
    {
      id: 'W17',
      t: 86,
      section: 'coast',
      mvp: true,
      groups: [
        {
          enemy: 'small',
          count: 6,
          xs: [-12, -12, -12, -12, -12, -12],
          y: 20,
          interval: 0.3,
          move: { kind: 'cross', from: 'topLeft', speed: 170 },
          fire: { kind: 'aimed1', maxShots: 1 },
          fireOnly: [2, 5],
        },
        {
          enemy: 'small',
          count: 6,
          xs: [372, 372, 372, 372, 372, 372],
          y: 20,
          interval: 0.3,
          move: { kind: 'cross', from: 'topRight', speed: 170 },
          fire: { kind: 'aimed1', maxShots: 1 },
          fireOnly: [2, 5],
        },
      ],
    },

    // W18 ★ - Three medium fighters in triangle
    {
      id: 'W18',
      t: 91,
      section: 'coast',
      mvp: true,
      groups: [
        {
          enemy: 'medium',
          count: 3,
          xs: [120, 180, 240],
          interval: 0.5,
          move: { kind: 'hover', stopY: 125, hold: 4 },
          fire: { kind: 'fan3', spread: 30, interval: 1.5 },
        },
      ],
    },

    // ========================================================================
    // BASE SECTION (1:35 - 2:30)
    // ========================================================================

    // W21 ★ - Medium with P drop + small escort
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
          count: 6,
          xs: [40, 320, 40, 320, 40, 320],
          interval: 0.3,
          move: { kind: 'straight', speed: 160, angle: 15 },
          fire: { kind: 'none' },
        },
      ],
    },

    // W24 ☆ (partial MVP - only small fighters)
    {
      id: 'W24',
      t: 128,
      section: 'base',
      mvp: 'partial',
      groups: [
        {
          enemy: 'small',
          count: 14,
          xs: [40, 86, 133, 180, 227, 274, 320, 40, 86, 133, 180, 227, 274, 320],
          interval: 0.25,
          move: { kind: 'straight', speed: 190 },
          fire: { kind: 'aimed1', maxShots: 1 },
          fireOnly: [0, 2, 4, 6, 8, 10, 12],
        },
      ],
    },

    // W25 ★ - Four medium fighters with B drop
    {
      id: 'W25',
      t: 135,
      section: 'base',
      mvp: true,
      groups: [
        {
          enemy: 'medium',
          count: 4,
          xs: [70, 150, 210, 290],
          interval: 0.5,
          move: { kind: 'hover', stopY: 120, hold: 4 },
          fire: { kind: 'fan3', spread: 30, interval: 1.4 },
          drops: [{ index: 2, item: 'B' }],
        },
      ],
    },

    // W27 ★ - Conditional backup P drop
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

/** Get MVP-only waves (for P1 playable) */
export function getMvpWaves() {
  return stage1.waves.filter((w) => w.mvp === true || w.mvp === 'partial');
}

/** Get total enemy count for MVP waves */
export function getMvpEnemyCount() {
  return getMvpWaves().reduce((total, wave) => {
    return total + wave.groups.reduce((groupTotal, group) => groupTotal + group.count, 0);
  }, 0);
}
