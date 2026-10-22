import { describe, expect, it } from 'vitest';
import { LOGICAL_W } from '@/game/config';
import { makeInput } from '@/test/fakes';
import { choiceButton, choicePanelRect, createChoiceOverlay } from './choiceOverlay';

describe('choice overlay', () => {
  it('keeps the formal four-row panel geometry', () => {
    expect(choicePanelRect(4)).toEqual({ x: 28, y: 132, w: LOGICAL_W - 56, h: 400 });
    expect(choiceButton(0)).toMatchObject({ y: 196, w: 248, h: 58 });
    expect(choiceButton(1).y - choiceButton(0).y).toBe(70);
  });

  it('confirms the highlighted row, wraps, and backs out', () => {
    const overlay = createChoiceOverlay({
      heading: '选择难度',
      rows: [
        { action: 'a', title: 'A', sub: 'one' },
        { action: 'b', title: 'B', sub: '' },
        { action: 'back', title: '返回', sub: '' },
      ],
    });
    overlay.open();
    expect(overlay.update(makeInput({ menuConfirm: true }))).toBe('a');

    overlay.open();
    expect(overlay.update(makeInput({ menuDown: true }))).toBeNull();
    expect(overlay.update(makeInput({ menuDown: true }))).toBeNull();
    expect(overlay.update(makeInput({ menuConfirm: true }))).toBe('back');

    overlay.open();
    expect(overlay.update(makeInput({ menuUp: true }))).toBeNull();
    expect(overlay.update(makeInput({ menuConfirm: true }))).toBe('back');
    expect(overlay.update(makeInput({ menuBack: true }))).toBe('back');

    const first = choiceButton(0);
    expect(
      overlay.update(makeInput({ taps: [{ x: first.x + first.w / 2, y: first.y + first.h / 2 }] }))
    ).toBe('a');
  });
});
