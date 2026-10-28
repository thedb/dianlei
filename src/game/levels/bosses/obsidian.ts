/**
 * Stage 4 boss 黑曜. One `frame` circle. The polyline, the three weapons,
 * and the saucer show live in `systems/obsidian.ts` and `obsidianSaucer.ts`.
 * Empty HP does not take the generic explosion clear.
 *
 * HP is a draft aimed at about 40 seconds. Measure vulcan Lv3 + M1, no T,
 * in the weapon range and write §6 back before locking 800 / 240.
 */

import {
  OBSIDIAN_BREAK_EXPLOSIONS,
  OBSIDIAN_BREAK_SPAN,
  OBSIDIAN_CENTER_X,
  OBSIDIAN_ENTER_AT,
  OBSIDIAN_ENTER_DURATION,
  OBSIDIAN_ENTER_Y,
  OBSIDIAN_FRAME_HP,
  OBSIDIAN_FRAME_SCORE,
  OBSIDIAN_HULL_H,
  OBSIDIAN_HULL_W,
  OBSIDIAN_OVERLOAD_HP,
  OBSIDIAN_PARK_Y,
  OBSIDIAN_PHASE_INVULN,
  OBSIDIAN_RADIUS,
  OBSIDIAN_WARNING,
} from '@/game/config';
import { HARD_PHASE_GATE } from '@/game/difficulty';
import type { BossDef } from '../types';

export const OBSIDIAN: BossDef = {
  id: 'obsidian',
  art: 'obsidian',
  script: 'obsidian',
  title: '黑曜',
  subtitle: '舰载王牌',
  fightWarning: OBSIDIAN_WARNING,
  vulnerableEnter: true,
  enterAt: OBSIDIAN_ENTER_AT,
  enterDuration: OBSIDIAN_ENTER_DURATION,
  anchorX: OBSIDIAN_CENTER_X,
  enterY: OBSIDIAN_ENTER_Y,
  parkY: OBSIDIAN_PARK_Y,
  drift: { amp: 0, period: 8 },
  hull: { w: OBSIDIAN_HULL_W, h: OBSIDIAN_HULL_H },
  parts: [
    {
      id: 'frame',
      offset: { x: 0, y: 0 },
      radius: OBSIDIAN_RADIUS,
      hp: OBSIDIAN_FRAME_HP,
      score: OBSIDIAN_FRAME_SCORE,
    },
  ],
  phases: [
    {
      id: 'fight',
      targets: ['frame'],
      attacks: [],
      look: { hull: 'closed' },
      bar: 'main',
    },
    {
      id: 'overload',
      targets: ['frame'],
      segmentHp: OBSIDIAN_OVERLOAD_HP,
      transition: { id: 'overload', duration: OBSIDIAN_PHASE_INVULN },
      gate: HARD_PHASE_GATE,
      attacks: [],
      look: { hull: 'open' },
      bar: 'extra',
    },
  ],
  bulletsToScore: 0,
  // The saucer plays these blasts at t=4.40. The runner must not start them
  // on the frame HP hits zero.
  death: {
    duration: OBSIDIAN_BREAK_SPAN,
    explosions: OBSIDIAN_BREAK_EXPLOSIONS,
    offsets: [
      [0, 0],
      [-22, 14],
      [20, -16],
      [0, 26],
      [-18, -22],
      [16, 8],
    ],
  },
};
