/**
 * Title scene - main menu: 开始游戏 / Boss连战 / 设置
 * The live stage demo starts here, in enter, once this scene is current.
 * Boot and any earlier loading frame do not create it.
 * A hidden top-right hot zone opens the debug panel; the demo keeps running.
 * 「关卡选择」 pauses it for a stage list and the normal 菜鸟 / 简单 / 中等 / 困难 step.
 * 「挑战 Boss」 then pauses it for a stage list and a 普通 / 困难 step.
 * 「Boss连战」 uses that same formal difficulty step, then a boss-only chain.
 * 「地图预览」 pauses it for the map list.
 * Every battle entry opens 「选择机体」 first. Attract stays Eagle and does not.
 */

import type { Scene, SceneContext } from './types';
import type { Renderer } from '@/engine/renderer';
import type { InputState } from '@/engine/input';
import { LOGICAL_W, LOGICAL_H } from '@/game/config';
import { readHighScore } from '@/game/highScore';
import { createDebugHotZone } from '@/game/ui/debugHotZone';
import { createDebugPanel } from '@/game/ui/debugPanel';
import { createSettingsPanel } from '@/game/ui/settingsPanel';
import {
  drawButton,
  drawText,
  drawTitleScrim,
  hitRect,
  UI_COLORS,
  type Rect,
} from '@/game/ui/widgets';
import { START_BUTTON, drawStartButton, isStartTapped } from '@/game/ui/startButton';
import { drawGameSubtitle, drawGameTitle } from '@/game/ui/titleFont';
import {
  TITLE_MARK_CY,
  TITLE_MARK_MAX_W,
  TITLE_SUB_Y,
  drawTitleMark,
  ensureShellArt,
} from '@/game/ui/shellArt';
import { createDifficultySelect } from '@/game/ui/difficultySelect';
import {
  challengeRunDifficulty,
  createBossDifficultySelect,
  createBossStageSelect,
} from '@/game/ui/bossChallenge';
import { createStageSelect } from '@/game/ui/stageSelect';
import { createMapPreviewSelect } from '@/game/ui/mapPreviewSelect';
import { createShipSelect } from '@/game/ui/shipSelect';
import type { ShipId } from '@/game/entities/shipDefs';
import { sharedTitleAttract, type TitleAttract } from './titleAttract';

const ITEM_COUNT = 3;
const MENU_W = 180;
const MENU_H = 44;
/** Wider than the start button's touch slack (12) so the hits do not overlap. */
const MENU_GAP = 16;

export const BOSS_RUSH_BUTTON: Rect = {
  x: LOGICAL_W / 2 - MENU_W / 2,
  y: START_BUTTON.y + START_BUTTON.h + MENU_GAP,
  w: MENU_W,
  h: MENU_H,
};

export const SETTINGS_BUTTON: Rect = {
  x: LOGICAL_W / 2 - MENU_W / 2,
  y: BOSS_RUSH_BUTTON.y + BOSS_RUSH_BUTTON.h + MENU_GAP,
  w: MENU_W,
  h: MENU_H,
};

export function createTitleScene(ctx: SceneContext, injected?: TitleAttract): Scene {
  let selected = 0;
  let inSettings = false;
  let inDebug = false;
  let inDifficulty = false;
  /** Which formal start the difficulty overlay will launch. */
  let startKind: 'stage' | 'bossRush' = 'stage';
  /** Debug stage list, then the normal difficulty step. Null on the panel. */
  let stagePick: 'stage' | 'difficulty' | null = null;
  let stageRunId = '1';
  /** Challenge Boss: stage list, then 普通 / 困难. Null while the debug panel is up. */
  let bossPick: 'stage' | 'difficulty' | null = null;
  let bossStageId = '1';
  /** 地图预览 list is up (over the debug panel). */
  let inMapPreview = false;
  /** Where 返回 from ship select lands. Null while the screen is closed. */
  let shipFrom: 'menu' | 'debug' | null = null;
  type ShipNext = 'stage' | 'bossRush' | 'weapon' | 'map' | 'stageList' | 'bossList';
  let shipNext: ShipNext | null = null;
  let blinkTimer = 0;
  // Shared demo is created in enter. An injected demo stays stopped until then.
  let attract: TitleAttract | null = injected ?? null;
  const settingsPanel = createSettingsPanel(ctx.settings);
  const debugPanel = createDebugPanel();
  const difficultySelect = createDifficultySelect();
  const stageSelect = createStageSelect();
  const bossStageSelect = createBossStageSelect();
  const bossDifficultySelect = createBossDifficultySelect();
  const mapPreviewSelect = createMapPreviewSelect();
  const shipSelect = createShipSelect();
  const hotZone = createDebugHotZone();
  ensureShellArt();

  function demo(): TitleAttract {
    if (!attract) attract = sharedTitleAttract();
    return attract;
  }

  function openDifficulty(kind: 'stage' | 'bossRush'): null {
    startKind = kind;
    inDifficulty = true;
    difficultySelect.open();
    return null;
  }

  function clearChain(): void {
    delete ctx.bossRush;
    delete ctx.campaignNext;
    delete ctx.carriedRun;
  }

  function openShip(from: 'menu' | 'debug', next: ShipNext): null {
    shipFrom = from;
    shipNext = next;
    shipSelect.open(ctx.shipId);
    return null;
  }

  function closeShip(): void {
    shipFrom = null;
    shipNext = null;
    delete ctx.shipId;
  }

  function acceptShip(id: ShipId): 'battle' | null {
    ctx.shipId = id;
    const next = shipNext;
    shipFrom = null;
    shipNext = null;
    if (next === 'stage') return openDifficulty('stage');
    if (next === 'bossRush') return openDifficulty('bossRush');
    if (next === 'weapon') {
      ctx.playMode = 'weaponTest';
      ctx.battleEntry = 'stage';
      delete ctx.challengeStage;
      delete ctx.runStage;
      clearChain();
      return 'battle';
    }
    if (next === 'map') {
      inMapPreview = true;
      mapPreviewSelect.open();
      return null;
    }
    if (next === 'stageList') {
      stagePick = 'stage';
      stageSelect.open();
      return null;
    }
    if (next === 'bossList') {
      bossPick = 'stage';
      bossStageSelect.open();
      return null;
    }
    return null;
  }

  function openSettings(): null {
    inSettings = true;
    settingsPanel.open();
    return null;
  }

  return {
    id: 'title',

    enter(): void {
      ensureShellArt();
      selected = 0;
      inSettings = false;
      inDebug = false;
      inDifficulty = false;
      stagePick = null;
      bossPick = null;
      inMapPreview = false;
      shipFrom = null;
      shipNext = null;
      delete ctx.runStage;
      delete ctx.shipId;
      clearChain();
      blinkTimer = 0;
      hotZone.reset();
      ctx.input.setControlsEnabled(false);
      demo().start();
    },

    exit(): void {
      attract?.stop();
      ctx.input.setControlsEnabled(true);
    },

    update(dt: number, input: InputState) {
      blinkTimer = (blinkTimer + dt) % 1;
      const live = demo();
      // Ship select, formal difficulty, stage select, both challenge-Boss
      // steps, and the map list pause the demo. The debug panel itself keeps
      // it running, and the demo ship stays Eagle.
      if (!inDifficulty && stagePick === null && bossPick === null && !inMapPreview && !shipFrom) {
        if (!live.isRunning()) live.start();
        live.update(dt);
      }

      if (inSettings) {
        if (settingsPanel.update(input) === 'close') inSettings = false;
        return null;
      }

      if (shipFrom) {
        shipSelect.tick(dt);
        const choice = shipSelect.update(input);
        if (choice === 'back') {
          closeShip();
          return null;
        }
        if (choice) return acceptShip(choice);
        return null;
      }

      if (inDebug) {
        if (inMapPreview) {
          const choice = mapPreviewSelect.update(input);
          if (choice === 'back') {
            inMapPreview = false;
            return openShip('debug', 'map');
          }
          if (choice) {
            ctx.playMode = 'mapPreview';
            ctx.battleEntry = 'stage';
            ctx.previewMap = choice;
            delete ctx.challengeStage;
            delete ctx.runStage;
            clearChain();
            return 'battle';
          }
          return null;
        }
        if (bossPick === 'difficulty') {
          const choice = bossDifficultySelect.update(input);
          if (choice === 'back') {
            bossPick = 'stage';
            bossStageSelect.open();
            return null;
          }
          if (choice) {
            ctx.playMode = 'play';
            ctx.battleEntry = 'boss';
            ctx.difficulty = challengeRunDifficulty(choice);
            ctx.challengeStage = bossStageId;
            delete ctx.runStage;
            clearChain();
            return 'battle';
          }
          return null;
        }
        if (bossPick === 'stage') {
          const choice = bossStageSelect.update(input);
          if (choice === 'back') {
            bossPick = null;
            return openShip('debug', 'bossList');
          }
          if (choice) {
            bossStageId = choice;
            bossPick = 'difficulty';
            bossDifficultySelect.open();
          }
          return null;
        }

        if (stagePick === 'difficulty') {
          const choice = difficultySelect.update(input);
          if (choice === 'back') {
            stagePick = 'stage';
            stageSelect.open();
            return null;
          }
          if (choice) {
            ctx.playMode = 'play';
            ctx.battleEntry = 'stage';
            ctx.difficulty = choice;
            ctx.runStage = stageRunId;
            delete ctx.challengeStage;
            clearChain();
            return 'battle';
          }
          return null;
        }
        if (stagePick === 'stage') {
          const choice = stageSelect.update(input);
          if (choice === 'back') {
            stagePick = null;
            return openShip('debug', 'stageList');
          }
          if (choice) {
            stageRunId = choice;
            stagePick = 'difficulty';
            difficultySelect.open();
          }
          return null;
        }

        const action = debugPanel.update(input);
        if (action === 'close') inDebug = false;
        else if (action === 'toggleDebug') {
          ctx.settings.update({ debugMode: !ctx.settings.get().debugMode });
        } else if (action === 'stage') {
          return openShip('debug', 'stageList');
        } else if (action === 'boss') {
          return openShip('debug', 'bossList');
        } else if (action === 'mapPreview') {
          return openShip('debug', 'map');
        } else if (action === 'weaponTest') {
          return openShip('debug', 'weapon');
        }
        return null;
      }

      if (inDifficulty) {
        const choice = difficultySelect.update(input);
        if (choice === 'back') {
          inDifficulty = false;
          return openShip('menu', startKind === 'bossRush' ? 'bossRush' : 'stage');
        }
        if (choice) {
          ctx.difficulty = choice;
          ctx.playMode = 'play';
          delete ctx.runStage;
          clearChain();
          if (startKind === 'bossRush') {
            ctx.battleEntry = 'boss';
            ctx.bossRush = true;
            ctx.challengeStage = '1';
          } else {
            ctx.battleEntry = 'stage';
            delete ctx.challengeStage;
          }
          return 'battle';
        }
        return null;
      }

      hotZone.advance(dt);
      for (const tap of input.taps) {
        if (hotZone.tap(tap.x, tap.y)) {
          inDebug = true;
          debugPanel.open();
          return null;
        }
      }

      if (input.menuUp) selected = (selected + ITEM_COUNT - 1) % ITEM_COUNT;
      if (input.menuDown) selected = (selected + 1) % ITEM_COUNT;

      if (isStartTapped(input.taps)) return openShip('menu', 'stage');
      if (input.taps.some((t) => hitRect(BOSS_RUSH_BUTTON, t.x, t.y))) {
        return openShip('menu', 'bossRush');
      }
      if (input.taps.some((t) => hitRect(SETTINGS_BUTTON, t.x, t.y))) return openSettings();
      if (input.menuConfirm) {
        if (selected === 0) return openShip('menu', 'stage');
        if (selected === 1) return openShip('menu', 'bossRush');
        return openSettings();
      }
      return null;
    },

    render(renderer: Renderer, alpha: number): void {
      if (attract?.isRunning()) attract.render(renderer, alpha);
      else renderer.clear('#000');
      const c = renderer.getContext();
      drawTitleScrim(c);
      if (!drawTitleMark(c, LOGICAL_W / 2, TITLE_MARK_CY, TITLE_MARK_MAX_W)) {
        drawGameTitle(c, LOGICAL_W / 2, TITLE_MARK_CY);
      }
      drawGameSubtitle(c, LOGICAL_W / 2, TITLE_SUB_Y);
      const best = readHighScore(ctx.storage);
      drawText(
        c,
        `最高分 ${best.toString().padStart(8, '0')}`,
        LOGICAL_W / 2,
        292,
        14,
        UI_COLORS.dim,
        'center'
      );

      drawStartButton(c, blinkTimer, selected === 0);
      drawButton(c, BOSS_RUSH_BUTTON, 'Boss连战', selected === 1);
      drawButton(c, SETTINGS_BUTTON, '设置', selected === 2);

      drawText(
        c,
        '方向键/WASD 移动  Z/空格 射击  X 炸弹  Esc 暂停',
        LOGICAL_W / 2,
        LOGICAL_H - 60,
        11,
        '#666',
        'center'
      );
      drawText(c, 'P5', LOGICAL_W - 20, LOGICAL_H - 20, 10, '#444', 'right');

      if (inSettings) {
        settingsPanel.render(c, ctx.input.getControlsView(), '设置');
      } else if (shipFrom) {
        shipSelect.render(c);
      } else if (stagePick === 'stage') {
        stageSelect.render(c);
      } else if (stagePick === 'difficulty') {
        difficultySelect.render(c);
      } else if (bossPick === 'stage') {
        bossStageSelect.render(c);
      } else if (bossPick === 'difficulty') {
        bossDifficultySelect.render(c);
      } else if (inMapPreview) {
        mapPreviewSelect.render(c);
      } else if (inDebug) {
        debugPanel.render(c, ctx.settings.get().debugMode);
      } else if (inDifficulty) {
        difficultySelect.render(c);
      }
    },
  };
}
