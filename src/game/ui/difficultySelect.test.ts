import { describe, expect, it } from 'vitest';
import { LOGICAL_H } from '@/game/config';
import { choicePanelRect } from './choiceOverlay';
import { DIFFICULTY_ROWS, createDifficultySelect } from './difficultySelect';

describe('difficulty select', () => {
  it('puts 菜鸟 above 简单 with the 99条命 line, and the panel stays on screen', () => {
    expect(DIFFICULTY_ROWS.map((row) => [row.action, row.title, row.sub])).toEqual([
      ['rookie', '菜鸟', '99条命'],
      ['easy', '简单', '当前平衡'],
      ['medium', '中等', '敌方生命 +15%'],
      ['hard', '困难', '生命 +30%，BOSS 三阶段'],
      ['back', '返回', ''],
    ]);
    const panel = choicePanelRect(DIFFICULTY_ROWS.length);
    expect(panel.y + panel.h).toBeLessThanOrEqual(LOGICAL_H);
  });

  it('draws the 99条命 description under 菜鸟', () => {
    const texts: string[] = [];
    const ctx = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'fillText') return (text: string) => texts.push(text);
          return () => undefined;
        },
        set() {
          return true;
        },
      }
    ) as CanvasRenderingContext2D;
    createDifficultySelect().render(ctx);
    expect(texts).toContain('选择难度');
    expect(texts).toContain('菜鸟');
    expect(texts).toContain('99条命');
    expect(texts.indexOf('菜鸟')).toBeLessThan(texts.indexOf('简单'));
    expect(texts.indexOf('99条命')).toBe(texts.indexOf('菜鸟') + 1);
  });
});
