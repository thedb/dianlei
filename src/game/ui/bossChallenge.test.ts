import { describe, expect, it } from 'vitest';
import { makeInput } from '@/test/fakes';
import {
  BOSS_CHALLENGE_STAGES,
  BOSS_DIFF_HARD_BUTTON,
  BOSS_DIFF_NORMAL_BUTTON,
  BOSS_DIFFICULTY_ROWS,
  BOSS_STAGE_1_BUTTON,
  BOSS_STAGE_BACK_BUTTON,
  BOSS_STAGE_ROWS,
  challengeRunDifficulty,
  createBossDifficultySelect,
  createBossStageSelect,
} from './bossChallenge';

function point(rect: { x: number; y: number; w: number; h: number }) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

describe('challenge boss picker', () => {
  it('lists stage 1 and 2, then 普通 and 困难, with no medium row', () => {
    expect(BOSS_CHALLENGE_STAGES.map((stage) => stage.label)).toEqual(['1', '2', '3']);
    expect(BOSS_STAGE_ROWS.map((row) => row.title)).toEqual(['1', '2', '3', '返回']);
    expect(BOSS_STAGE_ROWS[1]?.sub).toBe('铁堡');
    expect(BOSS_STAGE_ROWS[2]?.sub).toBe('炉心');
    expect(BOSS_DIFFICULTY_ROWS.map((row) => row.title)).toEqual(['普通', '困难', '返回']);
    expect(BOSS_DIFFICULTY_ROWS.some((row) => row.title.includes('中等'))).toBe(false);
    expect(challengeRunDifficulty('normal')).toBe('easy');
    expect(challengeRunDifficulty('hard')).toBe('hard');
  });

  it('returns the stage id, then the rank, and back from either step', () => {
    const stages = createBossStageSelect();
    const ranks = createBossDifficultySelect();
    stages.open();
    expect(stages.update(makeInput({ taps: [point(BOSS_STAGE_1_BUTTON)] }))).toBe('1');
    ranks.open();
    expect(ranks.update(makeInput({ taps: [point(BOSS_DIFF_NORMAL_BUTTON)] }))).toBe('normal');
    expect(ranks.update(makeInput({ taps: [point(BOSS_DIFF_HARD_BUTTON)] }))).toBe('hard');
    expect(ranks.update(makeInput({ menuBack: true }))).toBe('back');
    expect(stages.update(makeInput({ taps: [point(BOSS_STAGE_BACK_BUTTON)] }))).toBe('back');
  });
});
