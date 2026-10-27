import { describe, expect, it } from 'vitest';
import {
  CAPTION_BAR_H,
  CAPTION_HOLD,
  CAPTION_OPEN_AT,
  CONTROL_BOTTOM_PAD,
  CONTROL_SCALE_MAX,
  INTRO_GO_UNTIL,
  JOYSTICK_RADIUS,
  LOGICAL_H,
} from '@/game/config';
import { stage1 } from '@/game/levels/stage1';
import { CAPTION_LINES, activeCaption, captionBarY } from './captions';

describe('story captions', () => {
  it('stores the stage 1 lines from the story bible', () => {
    expect(CAPTION_LINES.s1_open).toBe('边境机场遇袭。电雷，立即起飞。');
    expect(CAPTION_LINES.s1_end).toBe('前线已肃清。叛军残部向工业带撤退。');
    expect(CAPTION_LINES.s2_open).toBe('目标：沿岸兵工厂。切断叛军补给。');
    expect(CAPTION_LINES.s2_end).toBe('工厂记录提到「打捞物」。继续追查。');
    expect(CAPTION_OPEN_AT + CAPTION_HOLD).toBe(INTRO_GO_UNTIL);
  });

  it('shows s1_open through the intro and s1_end after the boss is cleared', () => {
    const cues = stage1.captions;
    expect(activeCaption(cues, 0, null)).toBeNull();
    expect(activeCaption(cues, CAPTION_OPEN_AT, null)?.id).toBe('s1_open');
    expect(activeCaption(cues, INTRO_GO_UNTIL - 0.01, null)?.text).toBe(CAPTION_LINES.s1_open);
    expect(activeCaption(cues, CAPTION_OPEN_AT + CAPTION_HOLD, null)).toBeNull();
    // Challenge Boss starts at enterAt, so the open line has already elapsed.
    expect(activeCaption(cues, stage1.boss.enterAt, null)).toBeNull();
    const cleared = stage1.boss.enterAt + 40;
    expect(activeCaption(cues, cleared, cleared)?.id).toBe('s1_end');
    expect(activeCaption(cues, cleared + CAPTION_HOLD, cleared)).toBeNull();
  });

  it('lets the later beat replace the earlier one, and ignores stubs and unknown ids', () => {
    expect(
      activeCaption(
        [
          { id: 's1_open', at: 'open' },
          { id: 's1_end', at: 'clear' },
        ],
        1,
        1
      )?.id
    ).toBe('s1_end');
    expect(activeCaption([{ id: 's1_open', at: 'mid' }], 1, null)).toBeNull();
    expect(activeCaption([{ id: 's4_ufo', at: 'cutscene' }], 1, 1)).toBeNull();
    expect(activeCaption([{ id: 'missing', at: 'open' }], 1, null)).toBeNull();
  });

  it('places the bar above the tallest joystick', () => {
    for (const safe of [0, 24, 48]) {
      const y = captionBarY(safe);
      const bottomEdge = LOGICAL_H - safe - CONTROL_BOTTOM_PAD;
      const joystickTop = bottomEdge - 2 * JOYSTICK_RADIUS * CONTROL_SCALE_MAX - 8;
      expect(y + CAPTION_BAR_H).toBeLessThanOrEqual(joystickTop);
      expect(y).toBeGreaterThanOrEqual(48);
    }
  });
});
