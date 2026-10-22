/**
 * Stage 1 boss: the orbital battleship (wave table §5).
 *
 * Phase 1: two turrets and the hull guns. Killing one turret speeds the other.
 * Phase 2: the core opens and alternates the spiral and a fast aimed volley.
 * Phase 3 (Hard only): the core comes back on its own HP segment with the
 * ring, the sweeping laser, gap shots, and a half-HP enrage.
 *
 * The generic runner is `systems/boss.ts`; nothing there knows these ids.
 */

import {
  BOSS_ANCHOR_X,
  BOSS_ENTER_Y,
  BOSS_HULL_H,
  BOSS_HULL_W,
  BOSS_PHASE3_AIMED_INTERVAL,
  BOSS_PHASE3_AIMED_SPEED,
  BOSS_PHASE3_HP,
  BOSS_PHASE3_PATTERN_HOLD,
  BOSS_PHASE3_SPIRAL_ARMS,
  BOSS_PHASE3_SPIRAL_INTERVAL,
  BOSS_PHASE3_SPIRAL_ROT,
  BOSS_PHASE3_SPIRAL_SPEED,
  BOSS_PHASE3_TRANSITION,
} from '@/game/config';
import { HARD_PHASE_GATE } from '@/game/difficulty';
import type { BossDef } from '../types';

export const ORBITAL_BATTLESHIP: BossDef = {
  id: 'orbital',
  art: 'orbital',
  enterAt: 155,
  enterDuration: 3,
  anchorX: BOSS_ANCHOR_X,
  enterY: BOSS_ENTER_Y,
  parkY: 110,
  drift: { amp: 40, period: 6 },
  hull: { w: BOSS_HULL_W, h: BOSS_HULL_H },
  parts: [
    {
      id: 'turretL',
      offset: { x: -78, y: 20 },
      radius: 16,
      hp: 140,
      score: 5000,
      sprite: 'turret',
      onDestroy: 'fall',
    },
    {
      id: 'turretR',
      offset: { x: 78, y: 20 },
      radius: 16,
      hp: 140,
      score: 5000,
      sprite: 'turret',
      onDestroy: 'fall',
    },
    { id: 'core', offset: { x: 0, y: 10 }, radius: 22, hp: 560, score: 30000 },
  ],
  phases: [
    {
      id: 'phase1',
      targets: ['turretL', 'turretR'],
      survivorRateMul: 1.25,
      attacks: [
        {
          kind: 'gun',
          id: 'turretL',
          from: 'turretL',
          fire: { kind: 'fan5', spread: 60, interval: 1.6 },
        },
        {
          kind: 'gun',
          id: 'turretR',
          from: 'turretR',
          fire: { kind: 'aimed3burst', interval: 1.6, firstDelay: 0.8 },
        },
        {
          kind: 'gun',
          id: 'hull',
          from: 'hull',
          fire: { kind: 'fan7wide', spread: 90, interval: 5 },
        },
      ],
      look: { hull: 'closed' },
      bar: 'main',
    },
    {
      id: 'phase2',
      targets: ['core'],
      transition: { id: 'transition', duration: 1.5 },
      attacks: [
        {
          kind: 'cycle',
          id: 'pattern',
          from: 'core',
          hold: BOSS_PHASE3_PATTERN_HOLD,
          steps: [
            {
              label: 'spiral',
              fire: {
                kind: 'spiral',
                interval: BOSS_PHASE3_SPIRAL_INTERVAL,
                arms: BOSS_PHASE3_SPIRAL_ARMS,
                rotStep: BOSS_PHASE3_SPIRAL_ROT,
                speed: BOSS_PHASE3_SPIRAL_SPEED,
              },
            },
            {
              label: 'aimed',
              fire: {
                kind: 'aimed_fast3',
                interval: BOSS_PHASE3_AIMED_INTERVAL,
                speed: BOSS_PHASE3_AIMED_SPEED,
              },
            },
          ],
        },
      ],
      look: { hull: 'open', glow: { part: 'core', color: 'magenta' } },
      bar: 'main',
    },
    {
      id: 'phase3',
      targets: ['core'],
      gate: HARD_PHASE_GATE,
      segmentHp: BOSS_PHASE3_HP,
      transition: { id: 'transition3', duration: BOSS_PHASE3_TRANSITION },
      enrageAtHpRatio: 0.5,
      attacks: [
        {
          kind: 'laser',
          id: 'laser',
          from: 'core',
          laser: {
            every: 7,
            telegraph: 0.8,
            sweep: 1.5,
            fromDeg: -25,
            toDeg: 25,
            width: 10,
            hitWidth: 8,
          },
          enraged: { every: 5.5, sweep: 1.2 },
        },
        {
          kind: 'gun',
          id: 'ring',
          from: 'core',
          fire: { kind: 'ring16', interval: 2.0, rotStep: 11.25 },
          enrageInterval: 1.6,
          pauseWhileLaserSweeps: true,
          yieldOnFire: true,
        },
        {
          kind: 'gun',
          id: 'aimed',
          from: 'core',
          fire: { kind: 'aimed_fast3', interval: 1.2 },
          onlyWhileLaserIdle: true,
        },
      ],
      look: { hull: 'open', glow: { part: 'core', color: 'yellow' } },
      bar: 'extra',
    },
  ],
  bulletsToScore: 10,
  death: {
    duration: 2.5,
    explosions: 6,
    offsets: [
      [0, -10],
      [-68, -20],
      [72, 8],
      [-40, 28],
      [36, -32],
      [8, 18],
    ],
  },
};
