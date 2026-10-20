/**
 * Stage 1 wave data skeleton
 * Full data will be populated in P2 milestone
 */

import type { StageData } from './types';

export const stage1: StageData = {
  stage: 1,
  scrollSpeed: 40,
  warningAt: 150,

  waves: [
    // W01 - Opening formation (MVP)
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

    // W04 - First medium fighter with P drop (MVP)
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

    // Additional waves will be added in P2
    // See docs/电雷_第一关波次表_v1.md for full wave data
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
