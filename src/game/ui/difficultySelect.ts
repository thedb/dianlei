/**
 * Difficulty overlay drawn over the title (and the boot start path).
 * Canvas widgets only. The caller writes `SceneContext.difficulty` and decides
 * whether the attract demo keeps stepping.
 */

import type { InputState } from '@/engine/input';
import type { Difficulty } from '@/game/difficulty';
import { choiceButton, createChoiceOverlay, type ChoiceRow } from './choiceOverlay';
import type { Rect } from './widgets';

export type DifficultyAction = Difficulty | 'back' | null;

export function difficultyButton(index: number): Rect {
  return choiceButton(index);
}

export const DIFFICULTY_EASY_BUTTON = difficultyButton(0);
export const DIFFICULTY_MEDIUM_BUTTON = difficultyButton(1);
export const DIFFICULTY_HARD_BUTTON = difficultyButton(2);
export const DIFFICULTY_BACK_BUTTON = difficultyButton(3);

const ROWS: ReadonlyArray<ChoiceRow<Difficulty>> = [
  { action: 'easy', title: '简单', sub: '当前平衡' },
  { action: 'medium', title: '中等', sub: '敌方生命 +15%' },
  { action: 'hard', title: '困难', sub: '生命 +30%，BOSS 三阶段' },
  { action: 'back', title: '返回', sub: '' },
];

export interface DifficultySelect {
  open(): void;
  update(input: InputState): DifficultyAction;
  render(ctx: CanvasRenderingContext2D): void;
}

export function createDifficultySelect(): DifficultySelect {
  return createChoiceOverlay({ heading: '选择难度', rows: ROWS });
}
