/**
 * Story subtitles. Lines come from `docs/电雷_故事资产表_v1.md` §2.
 * This milestone wires Stage 1 only (`s1_open`, `s1_end`).
 *
 * `mid` and `cutscene` are extension points for s4_wreck / s4_ufo / s5_end.
 * They are accepted on a stage cue and draw nothing until a later milestone
 * supplies a clock. A later cue in the list replaces an earlier one while
 * both windows are open, so the next beat dismisses the line.
 */

import {
  CAPTION_BAR_H,
  CAPTION_HOLD,
  CAPTION_OPEN_AT,
  CONTROL_BOTTOM_PAD,
  CONTROL_SCALE_MAX,
  JOYSTICK_RADIUS,
  LOGICAL_H,
} from '@/game/config';
import type { CaptionAt, StageCaption } from '@/game/levels/types';

/** Catalog. Add a row here; do not branch on the id in the battle scene. */
export const CAPTION_LINES: Readonly<Record<string, string>> = {
  s1_open: '边境机场遇袭。电雷，立即起飞。',
  s1_end: '前线已肃清。叛军残部向工业带撤退。',
};

export interface ShownCaption {
  id: string;
  text: string;
}

function triggerAt(at: CaptionAt, finishedAt: number | null): number | null {
  switch (at) {
    case 'open':
      return CAPTION_OPEN_AT;
    case 'clear':
      return finishedAt;
    case 'mid':
    case 'cutscene':
      return null;
    default: {
      const _never: never = at;
      return _never;
    }
  }
}

/**
 * The line to draw now, or null. `finishedAt` is the clock when the boss
 * entered `clear` (null until then). Game over and pause are the caller's.
 */
export function activeCaption(
  cues: readonly StageCaption[] | undefined,
  gameTime: number,
  finishedAt: number | null
): ShownCaption | null {
  if (!cues) return null;
  let shown: ShownCaption | null = null;
  for (const cue of cues) {
    const start = triggerAt(cue.at, finishedAt);
    if (start === null) continue;
    const age = gameTime - start;
    if (age < 0 || age >= CAPTION_HOLD) continue;
    const text = CAPTION_LINES[cue.id];
    if (!text) continue;
    shown = { id: cue.id, text };
  }
  return shown;
}

/**
 * Top of the subtitle bar. Sits above the joystick at maximum control scale,
 * and follows the bottom safe area so the thumb does not cover the line.
 */
export function captionBarY(safeBottom: number): number {
  const bottomEdge = LOGICAL_H - safeBottom - CONTROL_BOTTOM_PAD;
  const joystickTop = bottomEdge - 2 * JOYSTICK_RADIUS * CONTROL_SCALE_MAX - 8;
  return Math.max(48, Math.round(joystickTop - 8 - CAPTION_BAR_H));
}
