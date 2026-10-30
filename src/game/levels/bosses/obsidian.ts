/**
 * Stage 4 boss 黑曜, look 3A 刃翼十字.
 * Nose locks, then the outer blades, then the inner blades plus the
 * fuselage. Tail locks stay visible and take no damage in phase 1.
 * Hard adds a full second yellow bar on the fuselage alone.
 * Empty HP does not take the generic explosion clear.
 *
 * HP is a draft aimed at about 40 seconds. The main bar sums to
 * OBSIDIAN_MAIN_HP. Measure before locking the split.
 */

import {
  OBSIDIAN_BLADE_RADIUS,
  OBSIDIAN_BREAK_EXPLOSIONS,
  OBSIDIAN_BREAK_SPAN,
  OBSIDIAN_CENTER_X,
  OBSIDIAN_DEPLOY_TIME,
  OBSIDIAN_ENTER_AT,
  OBSIDIAN_ENTER_DURATION,
  OBSIDIAN_ENTER_Y,
  OBSIDIAN_FRAME_HP,
  OBSIDIAN_FRAME_SCORE,
  OBSIDIAN_HINGE_NOSE_HP,
  OBSIDIAN_HINGE_RADIUS,
  OBSIDIAN_HULL_H,
  OBSIDIAN_HULL_W,
  OBSIDIAN_INNER_HP,
  OBSIDIAN_OUTER_HP,
  OBSIDIAN_OVERLOAD_HP,
  OBSIDIAN_PARK_Y,
  OBSIDIAN_PHASE_INVULN,
  OBSIDIAN_RADIUS,
  OBSIDIAN_WARNING,
} from '@/game/config';
import { HARD_PHASE_GATE } from '@/game/difficulty';
import {
  OBSIDIAN_BLADES,
  obsidianBladeOffset,
  obsidianVulnerableHinge,
} from '@/game/systems/obsidian';
import type { BossDef, BossPartDef } from '../types';

const hinges: BossPartDef[] = OBSIDIAN_BLADES.map((blade) => ({
  id: blade.hinge,
  offset: { x: blade.x, y: blade.y },
  radius: OBSIDIAN_HINGE_RADIUS,
  hp: obsidianVulnerableHinge(blade.hinge) ? OBSIDIAN_HINGE_NOSE_HP : 0,
  score: 0,
  onDestroy: 'burst',
}));

const wings: BossPartDef[] = OBSIDIAN_BLADES.map((blade, index) => ({
  id: blade.id,
  offset: obsidianBladeOffset(index, 'fold'),
  radius: OBSIDIAN_BLADE_RADIUS,
  hp: blade.role === 'outer' ? OBSIDIAN_OUTER_HP : OBSIDIAN_INNER_HP,
  score: 0,
  onDestroy: 'burst',
}));

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
  // Cruise is the obsidian script's lemniscate. Generic drift stays off.
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
    ...hinges,
    ...wings,
  ],
  bars: [
    { id: 'main', style: 'main' },
    { id: 'extra', style: 'extra', gate: HARD_PHASE_GATE },
  ],
  phases: [
    {
      id: 'folded',
      targets: OBSIDIAN_BLADES.filter((blade) => obsidianVulnerableHinge(blade.hinge)).map(
        (blade) => blade.hinge
      ),
      attacks: [],
      look: { hull: 'closed' },
      bar: 'main',
    },
    {
      id: 'half',
      targets: ['outerL', 'outerR'],
      transition: { id: 'half', duration: OBSIDIAN_DEPLOY_TIME },
      attacks: [],
      look: { hull: 'closed' },
      bar: 'main',
    },
    {
      id: 'open',
      targets: ['innerL', 'innerR', 'frame'],
      transition: { id: 'open', duration: OBSIDIAN_DEPLOY_TIME },
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
      look: { hull: 'open', smoke: true },
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
