/**
 * Stage 3 boss 炉心 (赛博浮垒). A wide floating fortress parked in the upper
 * half. Four gun pods orbit it first and fall one at a time, pod0 → pod3:
 * only the active pod takes damage, and hull hits never move onto a pod.
 * Once they are gone, four armor petals
 * open and close on a fixed clock and the core only takes bullets while they
 * are opening or open. Orbit, iris, and weapons live in `systems/furnace.ts`.
 * Easy and Medium end when the core dies. Hard revives the core on a full
 * second yellow bar, and the core's 30000 waits for that kill.
 */

import {
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
  LOGICAL_W,
} from '@/game/config';
import { HARD_PHASE_GATE } from '@/game/difficulty';
import { FURNACE_CORE_ID, FURNACE_POD_IDS, furnaceOffset } from '@/game/systems/furnace';
import type { BossDef, BossPartDef } from '../types';

function pod(index: number): BossPartDef {
  const o = furnaceOffset(FURNACE_POD_ANGLES[index]!, FURNACE_POD_ORBIT);
  return {
    id: FURNACE_POD_IDS[index]!,
    offset: { x: o.x, y: o.y },
    radius: FURNACE_POD_RADIUS,
    hp: FURNACE_POD_HP,
    score: FURNACE_POD_SCORE,
    sprite: 'pod',
    onDestroy: 'burst',
  };
}

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
  anchorX: LOGICAL_W / 2,
  enterY: FURNACE_ENTER_Y,
  parkY: FURNACE_PARK_Y,
  drift: { amp: FURNACE_DRIFT_AMP, period: FURNACE_DRIFT_PERIOD },
  hull: { w: FURNACE_HULL_W, h: FURNACE_HULL_H },
  parts: [
    pod(0),
    pod(1),
    pod(2),
    pod(3),
    {
      id: FURNACE_CORE_ID,
      offset: { x: 0, y: 0 },
      radius: FURNACE_CORE_RADIUS,
      hp: FURNACE_CORE_HP,
      score: FURNACE_CORE_SCORE,
    },
  ],
  bars: [
    { id: 'main', style: 'main' },
    { id: 'extra', style: 'extra', gate: HARD_PHASE_GATE },
  ],
  phases: [
    {
      id: 'pods',
      targets: [...FURNACE_POD_IDS],
      attacks: [],
      look: { hull: 'closed' },
      bar: 'main',
    },
    {
      id: 'core',
      targets: [FURNACE_CORE_ID],
      transition: { id: 'coreIn', duration: FURNACE_PHASE_INVULN },
      attacks: [],
      look: { hull: 'open', glow: { part: FURNACE_CORE_ID, color: 'orange' } },
      bar: 'main',
    },
    {
      id: 'overload',
      targets: [FURNACE_CORE_ID],
      gate: HARD_PHASE_GATE,
      segmentHp: FURNACE_OVERLOAD_HP,
      transition: { id: 'overloadIn', duration: FURNACE_PHASE_INVULN },
      attacks: [],
      look: { hull: 'open', glow: { part: FURNACE_CORE_ID, color: 'yellow' }, smoke: true },
      bar: 'extra',
    },
  ],
  bulletsToScore: 0,
  death: {
    duration: FURNACE_DEATH_DURATION,
    explosions: FURNACE_DEATH_EXPLOSIONS,
    offsets: [
      [0, 0],
      [-64, 20],
      [60, -18],
      [-30, -40],
      [34, 38],
      [0, 54],
    ],
  },
};
