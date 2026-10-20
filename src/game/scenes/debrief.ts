/**
 * Stage clear and game over (design §7).
 * Clear adds kill-rate and no-death bonuses. Both screens can retry or go home.
 */

import type { Scene, SceneContext, SceneId } from './types';
import type { Renderer } from '@/engine/renderer';
import type { InputState } from '@/engine/input';
import { LOGICAL_W } from '@/game/config';
import { commitHighScore } from '@/game/highScore';
import {
  formatStageTime,
  stageClearBonus,
  type ClearBonus,
  type RunReport,
} from '@/game/systems/score';
import {
  drawButton,
  drawPanel,
  drawText,
  tappedIndex,
  UI_COLORS,
  type Rect,
} from '@/game/ui/widgets';

const RETRY: Record<'result' | 'gameover', string> = {
  result: '再来一次',
  gameover: '重新开始',
};

function buttons(): Rect[] {
  return [0, 1].map((i) => ({
    x: 50,
    y: 470 + i * 58,
    w: LOGICAL_W - 100,
    h: 44,
  }));
}

export function createDebriefScene(ctx: SceneContext, outcome: 'clear' | 'gameover'): Scene {
  const id: SceneId = outcome === 'clear' ? 'result' : 'gameover';
  let selected = 0;
  let report: RunReport | null = null;
  let bonus: ClearBonus | null = null;
  let shownScore = 0;
  let best = 0;
  let isNew = false;

  return {
    id,

    enter(): void {
      selected = 0;
      ctx.input.setControlsEnabled(false);
      report = ctx.run.report;
      if (report && report.outcome === 'clear') {
        bonus = stageClearBonus(report);
        shownScore = bonus.total;
      } else {
        bonus = null;
        shownScore = report?.baseScore ?? 0;
      }
      const saved = commitHighScore(ctx.storage, shownScore);
      best = saved.best;
      isNew = saved.isNew;
    },

    exit(): void {
      ctx.input.setControlsEnabled(true);
    },

    update(_dt: number, input: InputState): SceneId | null {
      if (input.menuUp) selected = 0;
      if (input.menuDown) selected = 1;
      const tapped = tappedIndex(buttons(), input.taps);
      const choice = tapped >= 0 ? tapped : input.menuConfirm ? selected : -1;
      if (choice === 0) return 'battle';
      if (choice === 1) return 'title';
      return null;
    },

    render(renderer: Renderer): void {
      renderer.clear('#070b14');
      const c = renderer.getContext();
      const title = outcome === 'clear' ? '过关结算' : 'GAME OVER';
      const titleColor = outcome === 'clear' ? UI_COLORS.accent : UI_COLORS.danger;

      drawText(c, title, LOGICAL_W / 2, 78, 28, titleColor, 'center');
      drawText(
        c,
        shownScore.toString().padStart(8, '0'),
        LOGICAL_W / 2,
        130,
        32,
        UI_COLORS.text,
        'center'
      );

      const panel: Rect = { x: 28, y: 170, w: LOGICAL_W - 56, h: outcome === 'clear' ? 250 : 120 };
      drawPanel(c, panel);

      const line = (text: string, y: number, color = UI_COLORS.text) => {
        drawText(c, text, panel.x + 16, y, 16, color, 'left');
      };

      if (outcome === 'clear' && report && bonus) {
        line(`击落  ${report.kills}/${report.spawned}`, panel.y + 36);
        line(`击落率  ${bonus.killRatePct}%`, panel.y + 68);
        line(`击落率奖励  +${bonus.killBonus}`, panel.y + 100);
        line(
          bonus.noDeath ? `不死奖励  +${bonus.noDeathBonus}` : '不死奖励  —',
          panel.y + 132,
          bonus.noDeath ? UI_COLORS.accent : UI_COLORS.dim
        );
        line(`用时  ${formatStageTime(report.time)}`, panel.y + 164);
        line(
          isNew ? '新纪录' : `最高分  ${best.toString().padStart(8, '0')}`,
          panel.y + 206,
          isNew ? UI_COLORS.accent : UI_COLORS.dim
        );
      } else {
        line(`用时  ${formatStageTime(report?.time ?? 0)}`, panel.y + 40);
        line(
          isNew ? '新纪录' : `最高分  ${best.toString().padStart(8, '0')}`,
          panel.y + 78,
          isNew ? UI_COLORS.accent : UI_COLORS.dim
        );
      }

      const labels = [RETRY[outcome === 'clear' ? 'result' : 'gameover'], '返回首页'];
      buttons().forEach((rect, index) => {
        drawButton(c, rect, labels[index] ?? '', index === selected);
      });
    },
  };
}
