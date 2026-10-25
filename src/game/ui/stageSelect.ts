/**
 * Debug 「关卡选择」. One row per registered stage, then the same difficulty
 * overlay a normal start uses. The chosen stage begins at t = 0.
 */

import { listStages } from '@/game/levels/registry';
import type { StageData } from '@/game/levels/types';
import {
  choiceButton,
  createChoiceOverlay,
  type ChoiceOverlay,
  type ChoiceRow,
} from './choiceOverlay';

const CN = ['零', '一', '二', '三', '四', '五'] as const;

/** 「第一关」 / 「第二关」. Falls back to the digit past the table. */
export function stageHeading(stage: Pick<StageData, 'stage'>): string {
  const n = CN[stage.stage];
  return n ? `第${n}关` : `第${stage.stage}关`;
}

export const STAGE_SELECT_ROWS: ReadonlyArray<ChoiceRow<string>> = [
  ...listStages().map((stage) => ({
    action: stage.id,
    title: stageHeading(stage),
    sub: stage.name,
  })),
  { action: 'back', title: '返回', sub: '' },
];

export const STAGE_SELECT_1_BUTTON = choiceButton(0);
export const STAGE_SELECT_2_BUTTON = choiceButton(1);
export const STAGE_SELECT_BACK_BUTTON = choiceButton(STAGE_SELECT_ROWS.length - 1);

export function createStageSelect(): ChoiceOverlay<string> {
  return createChoiceOverlay({ heading: '关卡选择', rows: STAGE_SELECT_ROWS });
}
