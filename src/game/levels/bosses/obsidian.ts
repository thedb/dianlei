/**
 * Stage 4 boss 黑曜, stub. The ship can enter and be shot. It does not fly
 * the polyline, the strafe, or the saucer sequence. Those stay in the design
 * docs until the next PR. Dying here still uses the normal explosion clear.
 */

import {
  OBSIDIAN_ENTER_AT,
  OBSIDIAN_ENTER_DURATION,
  OBSIDIAN_ENTER_Y,
  OBSIDIAN_HULL_H,
  OBSIDIAN_HULL_W,
  OBSIDIAN_PARK_Y,
  OBSIDIAN_STUB_DEATH_DURATION,
  OBSIDIAN_STUB_DEATH_EXPLOSIONS,
  OBSIDIAN_STUB_HP,
  OBSIDIAN_STUB_RADIUS,
  OBSIDIAN_STUB_SCORE,
  OBSIDIAN_WARNING,
  LOGICAL_W,
} from '@/game/config';
import type { BossDef } from '../types';

export const OBSIDIAN: BossDef = {
  id: 'obsidian',
  art: 'obsidian',
  title: '黑曜',
  subtitle: '舰载王牌',
  fightWarning: OBSIDIAN_WARNING,
  vulnerableEnter: true,
  enterAt: OBSIDIAN_ENTER_AT,
  enterDuration: OBSIDIAN_ENTER_DURATION,
  anchorX: LOGICAL_W / 2,
  enterY: OBSIDIAN_ENTER_Y,
  parkY: OBSIDIAN_PARK_Y,
  drift: { amp: 0, period: 8 },
  hull: { w: OBSIDIAN_HULL_W, h: OBSIDIAN_HULL_H },
  parts: [
    {
      id: 'frame',
      offset: { x: 0, y: 0 },
      radius: OBSIDIAN_STUB_RADIUS,
      hp: OBSIDIAN_STUB_HP,
      score: OBSIDIAN_STUB_SCORE,
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
  ],
  bulletsToScore: 0,
  death: {
    duration: OBSIDIAN_STUB_DEATH_DURATION,
    explosions: OBSIDIAN_STUB_DEATH_EXPLOSIONS,
    offsets: [
      [0, 0],
      [-20, 16],
      [18, -12],
      [0, 28],
    ],
  },
};
