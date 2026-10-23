/**
 * Battle scene — a stage through its boss, plus the title demo, the weapon
 * range, and 地图预览 (`playMode`). This file only orders the frame; the rules live in
 * `src/game/battle/` and per-mode differences in `battle/playMode.ts`.
 */

import type { Scene, SceneContext } from './types';
import type { Renderer, GameDebugInfo } from '@/engine/renderer';
import type { InputState } from '@/engine/input';
import { createGameAssets } from '@/game/art';
import { getStage } from '@/game/levels/registry';
import type { ItemType } from '@/game/entities/item';
import { resolvePlacementDrops } from '@/game/systems/dropRules';
import { RiskCrateScheduler, selectRiskCrateSlots } from '@/game/entities/riskCrate';
import { WaveScheduler } from '@/game/systems/waveScheduler';
import { maxOut } from '@/game/systems/playerWeapons';
import { resetVictoryExit, victoryExitBlocksInput } from '@/game/systems/victoryExit';
import { BuildingScheduler, placeBuildings } from '@/game/entities/building';
import { Scroller, backgroundFade } from '@/game/systems/background';
import { buildStageTrack, trackFinished } from '@/game/maps/track';
import { buildPreviewTrack } from '@/game/maps/preview';
import { resetWeaponTestTune, type WeaponTestStats } from './weaponTest';
import {
  createBattle,
  initAudio,
  leaveToTitle,
  publishRun,
  releaseAllPools,
  runProfile,
  unlockAudio,
} from '@/game/battle/context';
import { clearFx, resetShake, stepShake, updateFx } from '@/game/battle/fx';
import {
  checkExtend,
  collectItem,
  readButtons,
  resetPlayer,
  spawnNewShip,
  steerPlayer,
  stepFlyIn,
  stepPlayerTimers,
  volleyInterval,
} from '@/game/battle/player';
import {
  activateBomb,
  nextBuildingDrop,
  resolveCollisions,
  updateBombHits,
} from '@/game/battle/combat';
import { armBoss, stepBoss } from '@/game/battle/bossFight';
import {
  jumpTo,
  stageWindow,
  stepRiskCrates,
  stepEnemies,
  stepMissiles,
  stepPlayerBullets,
  stepScroll,
  stepShotsAndItems,
  stepSpawns,
} from '@/game/battle/world';
import { liveRangeStats, rangeTaps, rangeTestDeath } from '@/game/battle/range';
import { pauseOnHide, requestPause, stepPauseMenu } from '@/game/battle/pause';
import { drawField } from '@/game/battle/render';
import { drawOverlay } from '@/game/battle/hud';

export interface BattleView {
  player: { x: number; y: number };
  enemies: { x: number; y: number }[];
  bullets: { x: number; y: number; vx: number; vy: number }[];
}

export interface BattleScene extends Scene {
  /** Live positions. The title demo reads this to steer; a real run does not. */
  getBattleView(): BattleView;
  /** Apply a pickup as if the ship had touched it. Used by tests. */
  grantItem(type: ItemType): void;
  /** Null outside weapon test. */
  getWeaponTestStats(): WeaponTestStats | null;
  /**
   * Weapon test only. Applies the same death as a hit. The next update
   * returns to the title and does not publish a run.
   */
  applyTestDeath(): boolean;
}

export function createBattleScene(sceneCtx: SceneContext): BattleScene {
  const b = createBattle(sceneCtx);
  const { player, state } = b;

  return {
    id: 'battle',

    enter(): void {
      b.pause.close();
      sceneCtx.input.setControlsEnabled(true);

      // Sprites are immutable. Reuse the bake when the title demo restarts.
      if (!b.assets) b.assets = createGameAssets();

      const stage = getStage(sceneCtx.battleEntry === 'boss' ? sceneCtx.challengeStage : undefined);
      b.stage = stage;
      // First stage-RNG draw of the run: which exclusive building drops M.
      b.fixedDrops = resolvePlacementDrops(stage.buildings, b.rng);
      b.riskCrates = new RiskCrateScheduler(
        selectRiskCrateSlots(stage.riskCrates, runProfile(b).riskCrateCount)
      );
      const stageTrack = buildStageTrack(stage);
      b.track = b.rules().track === 'preview' ? buildPreviewTrack(sceneCtx.previewMap) : stageTrack;
      b.buildingScheduler = new BuildingScheduler(
        placeBuildings(stage.buildings, stageTrack),
        stage.warningAt
      );
      b.scroller = new Scroller(b.track);

      resetPlayer(b);
      releaseAllPools(b);
      b.buildingScheduler.reset();
      clearFx(b.fx);
      b.bombWave.active = false;

      // Full wave table, including ground units and the conditional relief ship
      b.waves = new WaveScheduler({ mvpOnly: false, stage });

      // Weapon-test tune returns to the permanent constants.
      resetWeaponTestTune(b.tune);
      b.guns.main = volleyInterval(b, state.main);
      b.guns.sub = 0;
      b.gameTime = 0;
      b.scroller.reset();
      b.scrollFrame = {
        scroll: 0,
        tileDelta: 0,
        fade: backgroundFade(0, b.track),
        starScroll: [0, 0, 0],
      };
      b.controls.fireHeld = false;
      b.controls.bombPressed = false;
      b.controls.lastBombInput = false;
      b.boss = null;
      armBoss(b);
      resetVictoryExit(b.victory);
      b.warningPlayed = false;
      b.finishedAt = null;
      resetShake(b.fx);
      b.meter.reset();

      // 挑战 Boss: Lv3, the normal bomb and life loadout, clock at the boss.
      // seek() drops every wave that already passed, so those ships never
      // enter and do not count toward the kill-rate denominator.
      if (b.rules().bossEntry && sceneCtx.battleEntry === 'boss') {
        maxOut(state.main);
        jumpTo(b, stage.boss.enterAt);
      }

      initAudio(b);
    },

    onHide(): void {
      pauseOnHide(b);
    },

    exit(): void {
      b.pause.close();
      resetWeaponTestTune(b.tune);
      b.meter.reset();
      releaseAllPools(b);
      clearFx(b.fx);
    },

    update(dt: number, input: InputState) {
      const rules = b.rules();
      unlockAudio(b, input);

      // Paused: only the menu runs; gameplay state is frozen.
      const menu = stepPauseMenu(b, input);
      if (menu === 'exit') return leaveToTitle(b);
      if (menu === 'paused') return null;

      // The range has no run to lose: a death leaves without a report.
      if (rules.onDeath === 'title' && state.isDead) return leaveToTitle(b);
      if (rules.leaveAtTrackEnd && trackFinished(b.track, b.gameTime)) return leaveToTitle(b);
      if (requestPause(b, input)) return null;
      if (rules.range) rangeTaps(b, input);

      b.gameTime += dt;
      stepShake(b.fx, dt);
      stepPlayerTimers(b, dt);
      readButtons(b, input);

      // Every step, so swept collision and interpolation never reach back too far
      player.prevX = player.x;
      player.prevY = player.y;

      if (state.isDead) {
        // The title demo keeps the wreck; the title fades and restarts it.
        if (rules.onDeath === 'respawn') {
          state.respawnTimer -= dt;
          if (state.respawnTimer <= 0) {
            if (state.lives <= 0) {
              state.gameOver = true;
              publishRun(b, 'gameover');
              return 'gameover';
            }
            spawnNewShip(b);
          }
        }
      } else if (victoryExitBlocksInput(b.victory.phase)) {
        player.bank = 0;
        player.targetBank = 0;
        player.velocityY = 0;
      } else if (state.isFlying) {
        stepFlyIn(b, dt);
      } else {
        steerPlayer(b, dt, input);
        if (b.controls.bombPressed) activateBomb(b);
      }

      const { pastWarning, warningWindow } = stageWindow(b);
      stepPlayerBullets(b, dt);
      if (rules.scroll) stepScroll(b, dt);
      if (rules.spawns) {
        stepSpawns(b, dt, pastWarning);
        stepRiskCrates(b, dt);
      }
      stepEnemies(b, dt, pastWarning);
      updateBombHits(b, dt);
      stepMissiles(b, dt);
      const result = stepBoss(b, dt);
      if (result) return result;
      stepShotsAndItems(b, dt, warningWindow);
      updateFx(b.fx, dt);
      resolveCollisions(b, warningWindow);
      checkExtend(b);
      return null;
    },

    render(renderer: Renderer, alpha: number): void {
      if (!b.assets) return;
      drawField(renderer, b, b.assets, alpha);
      drawOverlay(renderer, b, b.assets);
    },

    grantItem(type: ItemType): void {
      collectItem(b, type);
    },

    getBattleView(): BattleView {
      const enemies: { x: number; y: number }[] = [];
      b.enemies.forEach((enemy) => {
        enemies.push({ x: enemy.x, y: enemy.y });
      });
      const bullets: { x: number; y: number; vx: number; vy: number }[] = [];
      b.enemyBullets.forEach((bullet) => {
        bullets.push({ x: bullet.x, y: bullet.y, vx: bullet.vx, vy: bullet.vy });
      });
      return { player: { x: player.x, y: player.y }, enemies, bullets };
    },

    getWeaponTestStats(): WeaponTestStats | null {
      return liveRangeStats(b);
    },

    applyTestDeath(): boolean {
      return rangeTestDeath(b);
    },

    getDebugInfo(): GameDebugInfo {
      const info: GameDebugInfo = {
        bombs: state.bombs,
        bombCooldown: state.bombCooldown,
        bulletCount: b.bullets.getActiveCount(),
        fireHeld: b.controls.fireHeld,
        bombPressed: b.controls.bombPressed,
        enemyCount: b.enemies.getActiveCount(),
        enemyBulletCount: b.enemyBullets.getActiveCount(),
        score: state.score,
        power: state.main.level,
        mainWeapon: state.main.id,
        subWeapon: state.sub?.id ?? null,
        subLevel: state.sub?.level ?? 0,
        mateLevel: state.mate,
        missileCount: b.missiles.getActiveCount(),
        lives: state.lives,
        paused: b.pause.isOpen(),
        gameTime: b.gameTime,
        playerDead: state.isDead,
        activeExplosions: b.fx.explosions.getActiveCount(),
        waveSpawned: b.waves?.getDebugInfo().spawned ?? 0,
        buildingCount: b.buildings.getActiveCount(),
        buildingDrop: nextBuildingDrop(b),
        crateCount: b.crates.getActiveCount(),
      };
      if (b.boss) {
        info.bossPhase = b.boss.phase;
        info.bossPhase3 = b.boss.extraArmed;
        info.bossMaxHp = b.boss.fightMax;
      }
      return info;
    },
  };
}
