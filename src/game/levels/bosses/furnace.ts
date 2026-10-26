/**
 * Stage 3 boss 炉心. Four pods orbit the chassis, then four armor petals
 * open and close around the core. Weapons live in `systems/furnace.ts`.
 * Easy and Medium end when the core dies. Hard revives the core for the
 * overload segment. No laser.
 */

import {
  FURNACE_ANCHOR_X,
  FURNACE_CORE_HP,
  FURNACE_CORE_RADIUS,
  FURNACE_CORE_SCORE,
  FURNACE_DEATH_DURATION,
  FURNACE_DEATH_EXPLOSIONS,
  FURNACE_DRIFT_AMP,
  FURNACE_DRIFT_PERIOD,
  FURNACE_ENTER_AT,
  FURNACE_ENTER_DURATION,
  FURNACE_ENTER_Y,
  FURNACE_HULL_H,
  FURNACE_HULL_W,
  FURNACE_OVERLOAD_HP,
  FURNACE_PARK_Y,
  FURNACE_PHASE_INVULN,
  FURNACE_POD_ANGLES,
  FURNACE_POD_HP,
  FURNACE_POD_ORBIT,
  FURNACE_POD_RADIUS,
  FURNACE_POD_SCORE,
  FURNACE_WARNING,
} from '@/game/config';
import { HARD_PHASE_GATE } from '@/game/difficulty';
import type { BossDef, BossPartDef } from '../types';

function podOffset(deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.sin(rad) * FURNACE_POD_ORBIT, y: Math.cos(rad) * FURNACE_POD_ORBIT };
}

const PODS: BossPartDef[] = FURNACE_POD_ANGLES.map((deg, index) => ({
  id: `pod${index}`,
  offset: podOffset(deg),
  radius: FURNACE_POD_RADIUS,
  hp: FURNACE_POD_HP,
  score: FURNACE_POD_SCORE,
}));

export const FURNACE: BossDef = {
  id: 'furnace',
  art: 'furnace',
  script: 'furnace',
  title: '炉心',
  subtitle: '赛博浮垒',
  fightWarning: FURNACE_WARNING,
  vulnerableEnter: true,
  enterAt: FURNACE_ENTER_AT,
  enterDuration: FURNACE_ENTER_DURATION,
  anchorX: FURNACE_ANCHOR_X,
  enterY: FURNACE_ENTER_Y,
  parkY: FURNACE_PARK_Y,
  drift: { amp: FURNACE_DRIFT_AMP, period: FURNACE_DRIFT_PERIOD },
  hull: { w: FURNACE_HULL_W, h: FURNACE_HULL_H },
  parts: [
    ...PODS,
    {
      id: 'core',
      offset: { x: 0, y: 0 },
      radius: FURNACE_CORE_RADIUS,
      hp: FURNACE_CORE_HP,
      score: FURNACE_CORE_SCORE,
    },
  ],
  phases: [
    {
      id: 'pods',
      targets: ['pod0', 'pod1', 'pod2', 'pod3'],
      attacks: [],
      look: { hull: 'closed' },
      bar: 'main',
    },
    {
      id: 'core',
      targets: ['core'],
      transition: { id: 'irisIn', duration: FURNACE_PHASE_INVULN },
      attacks: [],
      look: { hull: 'open', glow: { part: 'core', color: 'orange' } },
      bar: 'main',
    },
    {
      id: 'overload',
      targets: ['core'],
      gate: HARD_PHASE_GATE,
      segmentHp: FURNACE_OVERLOAD_HP,
      transition: { id: 'overloadIn', duration: FURNACE_PHASE_INVULN },
      attacks: [],
      look: { hull: 'open', glow: { part: 'core', color: 'yellow' } },
      bar: 'extra',
    },
  ],
  bulletsToScore: 10,
  death: {
    duration: FURNACE_DEATH_DURATION,
    explosions: FURNACE_DEATH_EXPLOSIONS,
    offsets: [
      [-70, -36],
      [64, -18],
      [0, 8],
      [-48, 28],
      [52, 36],
      [0, -48],
    ],
  },
};
