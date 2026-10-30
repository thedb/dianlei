/**
 * Stage 2 boss 铁堡. An armored munitions train on three fixed rails.
 * The rail clock and the six weapon modes live in `systems/tiebao.ts`.
 * Phases only decide which part takes damage. Easy and Medium end when the
 * core dies. Hard revives the core on a full second HP bar.
 */

import {
  TIEBAO_CORE,
  TIEBAO_CORE_HP,
  TIEBAO_CORE_RADIUS,
  TIEBAO_CORE_SCORE,
  TIEBAO_DEATH_DURATION,
  TIEBAO_DEATH_EXPLOSIONS,
  TIEBAO_ENTER_AT,
  TIEBAO_ENTER_DURATION,
  TIEBAO_ENTER_Y,
  TIEBAO_HULL_H,
  TIEBAO_HULL_W,
  TIEBAO_OVERLOAD_HP,
  TIEBAO_OVERLOAD_TRANSITION,
  TIEBAO_PARK_Y,
  TIEBAO_RAIL_X,
  TIEBAO_ROOF_CAR,
  TIEBAO_ROOF_HP,
  TIEBAO_ROOF_LOCO,
  TIEBAO_ROOF_RADIUS,
  TIEBAO_ROOF_SCORE,
  TIEBAO_WARNING,
} from '@/game/config';
import { HARD_PHASE_GATE } from '@/game/difficulty';
import type { BossDef } from '../types';

export const TIEBAO: BossDef = {
  id: 'tiebao',
  art: 'tiebao',
  script: 'tiebao',
  title: '铁堡',
  subtitle: '弹药转运',
  fightWarning: TIEBAO_WARNING,
  vulnerableEnter: true,
  hullTransfers: true,
  enterAt: TIEBAO_ENTER_AT,
  enterDuration: TIEBAO_ENTER_DURATION,
  anchorX: TIEBAO_RAIL_X[1],
  enterY: TIEBAO_ENTER_Y,
  parkY: TIEBAO_PARK_Y,
  drift: { amp: 0, period: 10 },
  /** End-form size. The live rect follows the cars still attached. */
  hull: { w: TIEBAO_HULL_W, h: TIEBAO_HULL_H },
  parts: [
    {
      id: 'roofCar',
      offset: TIEBAO_ROOF_CAR,
      radius: TIEBAO_ROOF_RADIUS,
      hp: TIEBAO_ROOF_HP,
      score: TIEBAO_ROOF_SCORE,
      sprite: 'aa',
    },
    {
      id: 'roofLoco',
      offset: TIEBAO_ROOF_LOCO,
      radius: TIEBAO_ROOF_RADIUS,
      hp: TIEBAO_ROOF_HP,
      score: TIEBAO_ROOF_SCORE,
      sprite: 'aa',
    },
    {
      id: 'core',
      offset: TIEBAO_CORE,
      radius: TIEBAO_CORE_RADIUS,
      hp: TIEBAO_CORE_HP,
      score: TIEBAO_CORE_SCORE,
    },
  ],
  bars: [
    { id: 'main', style: 'main' },
    { id: 'extra', style: 'extra', gate: HARD_PHASE_GATE },
  ],
  phases: [
    {
      id: 'main',
      targets: ['roofCar', 'roofLoco'],
      attacks: [],
      look: { hull: 'closed' },
      bar: 'main',
    },
    {
      id: 'core',
      targets: ['core'],
      attacks: [],
      look: { hull: 'open', glow: { part: 'core', color: 'orange' } },
      bar: 'main',
    },
    {
      id: 'overload',
      targets: ['core'],
      gate: HARD_PHASE_GATE,
      segmentHp: TIEBAO_OVERLOAD_HP,
      transition: { id: 'overloadIn', duration: TIEBAO_OVERLOAD_TRANSITION },
      attacks: [],
      look: { hull: 'open', glow: { part: 'core', color: 'yellow' }, smoke: true },
      bar: 'extra',
    },
  ],
  bulletsToScore: 10,
  death: {
    duration: TIEBAO_DEATH_DURATION,
    explosions: TIEBAO_DEATH_EXPLOSIONS,
    offsets: [
      [0, -122],
      [0, -76],
      [-8, -40],
      [6, 0],
      [0, 30],
      [-8, 60],
      [0, 100],
      [6, 128],
    ],
  },
};
