/**
 * World step for the battle: map scroll, the wave table, buildings, enemies,
 * homing missiles, and every bullet and item pool. Each step releases inline;
 * no step acquires from the pool it is walking.
 */

import {
  BUILDING_HP,
  LOGICAL_W,
  PLAYER_BULLET_SPEED,
  PLAYER_SPAWN_Y,
  WARNING_BANNER_DELAY,
} from '@/game/config';
import { scaleHp } from '@/game/difficulty';
import { terrainBlocksTank } from '@/game/maps/track';
import { ENEMY_STATS, spawnEnemy, updateEnemy } from '@/game/entities/enemy';
import { updateEnemyBullet } from '@/game/entities/enemyBullet';
import { updateItem } from '@/game/entities/item';
import { pickHomingTarget, updateHomingMissile } from '@/game/entities/homingMissile';
import {
  buildingBlocksTank,
  spawnBuilding,
  updateBuilding,
  validateBuildingFootprint,
} from '@/game/entities/building';
import { updateEnemyWeapons } from '@/game/systems/weapons';
import { resetVictoryExit } from '@/game/systems/victoryExit';
import { backgroundFade, warningBulletAlpha } from '@/game/systems/background';
import { releaseAllPools, runDifficulty, runProfile, type Battle } from './context';
import { clearFx, resetShake } from './fx';
import { collectHomingTargets } from './combat';
import { spawnBoss } from './bossFight';

/** Stage clock landmarks for this frame. All false in a mode with no spawns. */
export interface StageWindow {
  /** Waves stop spawning and ground guns stop firing. */
  pastWarning: boolean;
  /** Between the warning and the boss: enemy bullets fade out and do not hit. */
  warningWindow: boolean;
}

export function stageWindow(b: Battle): StageWindow {
  const pastWarning = b.rules().spawns && b.gameTime >= b.stage.warningAt;
  return { pastWarning, warningWindow: pastWarning && b.gameTime < b.stage.boss.enterAt };
}

/** Map scroll, and the warning cue when the mode spawns the stage. */
export function stepScroll(b: Battle, dt: number): void {
  const { stage } = b;
  b.scrollFrame = b.scroller.update(dt, b.gameTime);
  if (
    b.rules().spawns &&
    !b.warningPlayed &&
    b.gameTime >= stage.warningAt + WARNING_BANNER_DELAY &&
    b.gameTime < stage.boss.enterAt
  ) {
    b.warningPlayed = true;
    b.sfx('warning');
  }
}

export function stepPlayerBullets(b: Battle, dt: number): void {
  b.bullets.forEach((bullet) => {
    bullet.prevX = bullet.x;
    bullet.prevY = bullet.y;
    if (bullet.vx !== undefined && bullet.vy !== undefined) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
    } else {
      bullet.y -= PLAYER_BULLET_SPEED * dt;
    }
    if (bullet.y < -20 || bullet.x < -20 || bullet.x > LOGICAL_W + 20) b.bullets.release(bullet);
  });
}

/** Wave spawns (until the warning), the boss at `enterAt`, then buildings. */
export function stepSpawns(b: Battle, dt: number, pastWarning: boolean): void {
  const { stage } = b;
  const difficulty = runDifficulty(b);
  if (b.waves) {
    b.waves.setPowerLevel(b.state.main.level);
    const spawns = b.waves.update(dt);
    if (!pastWarning) {
      for (const spawn of spawns) {
        spawnEnemy(
          b.enemies.acquire(),
          spawn.type,
          spawn.x,
          spawn.y,
          spawn.move,
          spawn.canFire ? spawn.fire : { kind: 'none' },
          spawn.drop,
          scaleHp(spawn.hp ?? ENEMY_STATS[spawn.type].hp, difficulty),
          spawn.score
        );
      }
    }
  }

  if (!b.boss && b.gameTime >= stage.boss.enterAt) b.boss = spawnBoss(b);

  // Buildings ride the tile map. Footprints are checked against the real grid on spawn.
  for (const placement of b.buildingScheduler.update(b.scrollFrame.scroll, b.gameTime)) {
    const layer = b.track.layers[placement.layer];
    if (!layer || !validateBuildingFootprint(layer.grid, placement)) continue;
    spawnBuilding(
      b.buildings.acquire(),
      placement,
      b.scrollFrame.scroll,
      scaleHp(BUILDING_HP, difficulty)
    );
  }
  const { player } = b;
  b.buildings.forEach((building) => {
    const gone = updateBuilding(
      building,
      dt,
      b.scrollFrame.scroll,
      player.x,
      player.y,
      b.spawner,
      !pastWarning
    );
    if (gone || (b.scrollFrame.fade.layers[building.layer] ?? 0) <= 0.01) {
      b.buildings.release(building);
    }
  });
}

function blocksTank(b: Battle, x: number, y: number): boolean {
  const frame = b.scrollFrame;
  if (terrainBlocksTank(b.track, frame.scroll, frame.fade.layers, x, y)) return true;
  let blocked = false;
  b.buildings.forEach((building) => {
    if (!blocked && buildingBlocksTank(building, x, y)) blocked = true;
  });
  return blocked;
}

/** Enemy movement, then each survivor's guns (on the difficulty's fire clock). */
export function stepEnemies(b: Battle, dt: number, pastWarning: boolean): void {
  const { player } = b;
  const terrain = { blocksTank: (x: number, y: number) => blocksTank(b, x, y) };
  const gunDt = dt * runProfile(b).fireRateScale;
  b.enemies.forEach((enemy) => {
    if (updateEnemy(enemy, dt, player.x, player.y, b.scrollFrame.tileDelta, terrain)) {
      b.enemies.release(enemy);
    } else if (enemy.bombHitIn < 0) {
      updateEnemyWeapons(enemy, gunDt, player.x, player.y, b.spawner, !pastWarning);
    }
  });
}

export function stepMissiles(b: Battle, dt: number): void {
  collectHomingTargets(b);
  b.missiles.forEach((m) => {
    if (updateHomingMissile(m, dt, pickHomingTarget(m.x, m.y, b.homingTargets))) {
      b.missiles.release(m);
    }
  });
}

/** Warning fade (no score), enemy bullet flight, and item drift. */
export function stepShotsAndItems(b: Battle, dt: number, warningWindow: boolean): void {
  if (warningWindow && warningBulletAlpha(b.gameTime, b.stage.warningAt) <= 0) {
    b.enemyBullets.releaseAll();
  }
  const target = { x: b.player.x, y: b.player.y };
  b.enemyBullets.forEach((bullet) => {
    if (updateEnemyBullet(bullet, dt, target)) b.enemyBullets.release(bullet);
  });
  b.items.forEach((item) => {
    if (updateItem(item, dt)) b.items.release(item);
  });
}

/**
 * Debug skip (wave table §8.3) used by boss practice. Seeks the wave table so
 * the ships that were jumped over never spawn or count.
 */
export function jumpTo(b: Battle, time: number): void {
  const { stage, state, player } = b;
  b.gameTime = time;
  b.waves?.reset();
  b.waves?.setPowerLevel(state.main.level);
  b.waves?.seek(time);
  releaseAllPools(b);
  b.bombWave.active = false;
  b.buildingScheduler.reset();
  clearFx(b.fx);
  b.boss = time >= stage.boss.enterAt ? spawnBoss(b) : null;
  resetVictoryExit(b.victory);
  b.warningPlayed = time >= stage.warningAt + WARNING_BANNER_DELAY;
  b.scrollFrame = {
    ...b.scrollFrame,
    tileDelta: 0,
    fade: backgroundFade(b.gameTime, b.track),
  };
  b.finishedAt = null;
  resetShake(b.fx);
  state.isDead = false;
  state.isFlying = false;
  state.gameOver = false;
  state.respawnTimer = 0;
  if (state.lives <= 0) state.lives = 1;
  player.y = PLAYER_SPAWN_Y;
  player.prevY = PLAYER_SPAWN_Y;
}
