/**
 * Debug 「挑战 Boss」 picker (P10.2).
 * Step A lists stage bosses. Step B is 普通 / 困难, the same overlay as the
 * formal difficulty screen, without 中等.
 * 普通 is formal Easy (HP ×1, two boss phases). 困难 is formal Hard
 * (HP ×1.3, three boss phases). The choice stays on the run.
 */

import type { Difficulty } from '@/game/difficulty';
import {
  choiceButton,
  createChoiceOverlay,
  type ChoiceOverlay,
  type ChoiceRow,
} from './choiceOverlay';

/** Offered stage bosses. Add a row here when another stage exists. */
export const BOSS_CHALLENGE_STAGES = [{ id: '1', label: '1' }] as const;

export type BossChallengeStageId = (typeof BOSS_CHALLENGE_STAGES)[number]['id'];

export type BossChallengeRank = 'normal' | 'hard';

export const BOSS_STAGE_ROWS: ReadonlyArray<ChoiceRow<BossChallengeStageId>> = [
  ...BOSS_CHALLENGE_STAGES.map((stage) => ({
    action: stage.id,
    title: stage.label,
    sub: '',
  })),
  { action: 'back', title: '返回', sub: '' },
];

export const BOSS_DIFFICULTY_ROWS: ReadonlyArray<ChoiceRow<BossChallengeRank>> = [
  { action: 'normal', title: '普通', sub: '当前平衡' },
  { action: 'hard', title: '困难', sub: '生命 +30%，BOSS 三阶段' },
  { action: 'back', title: '返回', sub: '' },
];

export const BOSS_STAGE_1_BUTTON = choiceButton(0);
export const BOSS_STAGE_BACK_BUTTON = choiceButton(1);
export const BOSS_DIFF_NORMAL_BUTTON = choiceButton(0);
export const BOSS_DIFF_HARD_BUTTON = choiceButton(1);
export const BOSS_DIFF_BACK_BUTTON = choiceButton(2);

/** 普通 → easy, 困难 → hard. No medium on this picker. */
export function challengeRunDifficulty(rank: BossChallengeRank): Difficulty {
  return rank === 'hard' ? 'hard' : 'easy';
}

export function createBossStageSelect(): ChoiceOverlay<BossChallengeStageId> {
  return createChoiceOverlay({ heading: '选择 Boss', rows: BOSS_STAGE_ROWS });
}

export function createBossDifficultySelect(): ChoiceOverlay<BossChallengeRank> {
  return createChoiceOverlay({ heading: '选择难度', rows: BOSS_DIFFICULTY_ROWS });
}
