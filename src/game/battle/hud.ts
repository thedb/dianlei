/**
 * Screen-space layers over the battle field: bomb flash, the stage HUD (score,
 * lives, bombs, weapon slots, intro, boss bar, WARNING) or the range panels,
 * on-screen controls, the pause menu, and STAGE CLEAR.
 */

import type { Renderer } from '@/engine/renderer';
import {
  BOMB_FLASH_TIME,
  BOMBS_MAX,
  LOGICAL_H,
  LOGICAL_W,
  WARNING_BANNER_DELAY,
} from '@/game/config';
import { PALETTE, COLOR } from '@/game/palette';
import { drawBossHpBar, type GameAssets } from '@/game/art';
import { WEAPONS } from '@/game/systems/playerWeapons';
import {
  bossExtraSpan,
  bossHpBarLayout,
  bossIntroBarFill,
  bossIntroBarLayout,
  type BossHpBarLayout,
} from '@/game/systems/boss';
import { introBanner } from '@/game/systems/score';
import { drawControls, drawPauseButton } from '@/game/ui/controlsOverlay';
import { runProfile, type Battle } from './context';
import { drawRangeHud } from './range';

function drawStageHud(renderer: Renderer, b: Battle, assets: GameAssets): void {
  const { state, stage, boss, gameTime } = b;
  const ctx = renderer.getContext();
  const hudY = 4;

  renderer.fillText(`SCORE: ${state.score.toString().padStart(8, '0')}`, 8, hudY, '#fff', 10);
  renderer.fillText('♦', LOGICAL_W - 90, hudY, PALETTE[COLOR.PLAYER_CYAN], 10);
  renderer.fillText('x' + state.lives, LOGICAL_W - 80, hudY, '#fff', 10);

  // Bomb stock: octagon B, bright when owned and dim when empty.
  // Sits under the score line and above the boss bar (y = 32).
  const iconY = hudY + 10;
  const bombIcon = assets.items.byType.B.idle;
  const bombStep = bombIcon.width + 1;
  for (let i = 0; i < BOMBS_MAX; i++) {
    ctx.globalAlpha = i < state.bombs ? 1 : 0.4;
    renderer.drawImage(bombIcon.canvas, 6 + i * bombStep, iconY);
  }
  ctx.globalAlpha = 1;

  // Weapon slots: each shows its pickup icon and level. Sub sits left of main.
  const mainIcon = assets.items.byType[WEAPONS[state.main.id].item].idle;
  const mainX = LOGICAL_W - mainIcon.width - 32;
  renderer.drawImage(mainIcon.canvas, mainX, iconY);
  renderer.fillText(`Lv${state.main.level}`, mainX + mainIcon.width + 2, iconY + 4, '#fff', 10);
  const subX = mainX - 40;
  if (state.sub) {
    const subIcon = assets.items.byType[WEAPONS[state.sub.id].item].idle;
    renderer.drawImage(subIcon.canvas, subX, iconY);
    renderer.fillText(`Lv${state.sub.level}`, subX + subIcon.width + 2, iconY + 4, '#fff', 10);
  } else {
    renderer.fillText('SUB -', subX, iconY + 4, '#666', 10);
  }

  const intro = boss ? null : introBanner(gameTime, stage.label);
  if (intro && !state.gameOver) {
    const blink = intro !== 'GO' || Math.floor(gameTime * 8) % 2 === 0;
    renderer.fillText(
      intro,
      LOGICAL_W / 2 - intro.length * 6,
      LOGICAL_H / 2 - 80,
      blink ? '#fff' : '#7fd',
      18
    );
  }

  const barIntro = bossIntroBarFill(gameTime, stage.warningAt, stage.boss.enterAt);
  let barLayout: BossHpBarLayout | null = null;
  if (barIntro !== null) {
    barLayout = bossIntroBarLayout(barIntro, bossExtraSpan(stage.boss, runProfile(b).bossGates));
  } else if (boss && boss.phase !== 'clear' && boss.phase !== 'done') {
    barLayout = bossHpBarLayout(boss);
  }
  if (barLayout) drawBossHpBar(ctx, barLayout, 48, 32, 264, 8);

  if (
    !state.gameOver &&
    gameTime >= stage.warningAt + WARNING_BANNER_DELAY &&
    gameTime < stage.boss.enterAt
  ) {
    const blink = Math.floor(gameTime * 6) % 2 === 0;
    renderer.fillRect(0, LOGICAL_H / 2 - 28, LOGICAL_W, 40, 'rgba(0, 0, 0, 0.45)');
    renderer.fillText(
      'WARNING',
      LOGICAL_W / 2 - 46,
      LOGICAL_H / 2 - 16,
      blink ? '#ff4444' : '#ffffff',
      20
    );
  }
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

/** 地图预览: which track is playing and how far along it is. */
function drawPreviewHud(renderer: Renderer, b: Battle): void {
  const { track, gameTime } = b;
  renderer.fillText(`地图预览  ${track.label}`, 8, 4, '#fff', 10);
  const end = track.endAt ?? 0;
  renderer.fillText(`${clock(gameTime)} / ${clock(end)}`, LOGICAL_W - 72, 4, '#9cf', 10);
  const fill = end > 0 ? Math.min(1, gameTime / end) : 0;
  renderer.fillRect(8, 18, LOGICAL_W - 16, 3, 'rgba(255, 255, 255, 0.2)');
  renderer.fillRect(8, 18, (LOGICAL_W - 16) * fill, 3, PALETTE[COLOR.PLAYER_CYAN]);
}

/** Everything above the field. The silent title demo draws none of it. */
export function drawOverlay(renderer: Renderer, b: Battle, assets: GameAssets): void {
  const hud = b.rules().hud;
  if (hud === 'none') return;
  const { state } = b;
  const ctx = renderer.getContext();

  if (state.bombFlashTimer > 0) {
    const flashAlpha = state.bombFlashTimer / BOMB_FLASH_TIME;
    renderer.fillRect(0, 0, LOGICAL_W, LOGICAL_H, `rgba(255, 255, 255, ${flashAlpha * 0.35})`);
  }

  if (hud === 'range') drawRangeHud(ctx, b);
  else if (hud === 'preview') drawPreviewHud(renderer, b);
  else drawStageHud(renderer, b, assets);

  const controlsView = b.scene.input.getControlsView();
  if (!b.pause.isOpen()) {
    drawControls(ctx, controlsView, { bDisabled: state.bombs <= 0 || state.bombCooldown > 0 });
  }
  drawPauseButton(ctx, controlsView.layout.pauseButton, controlsView.settings.controlOpacity);
  b.pause.render(ctx, controlsView, { stage: b.stage.stage, score: state.score });

  if (b.boss?.phase === 'clear' && b.victory.phase === 'wait') {
    renderer.fillText('STAGE CLEAR', LOGICAL_W / 2 - 66, 72, '#7dff9a', 18);
  }
}
