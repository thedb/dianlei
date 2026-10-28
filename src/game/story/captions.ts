/**
 * Story subtitles. Lines come from `docs/电雷_故事资产表_v1.md` §2.
 * Stage 1 uses `s1_open` / `s1_end`. Stage 2 uses `s2_open` / `s2_end`.
 * Stage 3 uses `s3_open` / `s3_end`. Stage 4 uses `s4_open` and `s4_ufo`.
 * The three stage-4 sentences stay as written. `s4_wreck` is stored and
 * still has no clock (the stage-4 waves own that). `s4_ufo` starts at
 * `cutsceneAt`, stamped when the saucer beam ends.
 *
 * `mid` draws nothing until a later milestone supplies a clock. A later cue
 * in the list replaces an earlier one while both windows are open.
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
  s2_open: '目标：沿岸兵工厂。切断叛军补给。',
  s2_end: '工厂记录提到「打捞物」。继续追查。',
  s3_open: '突入叛军主基地。电雷，撕开防线。',
  s3_end: '航母坐标已锁定。准备舰载出击。',
  s4_open: '航母甲板就绪。电雷，出击。',
  s4_wreck: '不明残骸……弹痕不像地球武器。',
  s4_ufo: '未知飞行物击毁目标后撤离。追踪。',
};

export interface ShownCaption {
  id: string;
  text: string;
}

function triggerAt(
  at: CaptionAt,
  finishedAt: number | null,
  cutsceneAt: number | null
): number | null {
  switch (at) {
    case 'open':
      return CAPTION_OPEN_AT;
    case 'clear':
      return finishedAt;
    case 'mid':
      return null;
    case 'cutscene':
      return cutsceneAt;
    default: {
      const _never: never = at;
      return _never;
    }
  }
}

/**
 * The line to draw now, or null. `finishedAt` is the clock when the boss
 * entered `clear` (null until then). `cutsceneAt` is the beam-end clock for
 * `s4_ufo` (null until then). Game over and pause are the caller's.
 */
export function activeCaption(
  cues: readonly StageCaption[] | undefined,
  gameTime: number,
  finishedAt: number | null,
  cutsceneAt: number | null = null
): ShownCaption | null {
  if (!cues) return null;
  let shown: ShownCaption | null = null;
  for (const cue of cues) {
    const start = triggerAt(cue.at, finishedAt, cutsceneAt);
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
