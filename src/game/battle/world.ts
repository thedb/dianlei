/**
 * World step for the battle: map scroll, the wave table, buildings, enemies,
 * homing missiles, and every bullet and item pool. Each step releases inline;
 * no step acquires from the pool it is walking.
 */

import {
  ENEMY_BULLET_CAP,
  LOGICAL_W,
  PLAYER_BULLET_SPEED,
  PLAYER_SPAWN_Y,
  SCORE_WRECK_FLOAT,
  WARNING_BANNER_DELAY,
  WRECK_FLOAT_HP,
} from '@/game/config';
import { scaleHp } from '@/game/difficulty';
import { terrainBlocksTank } from '@/game/maps/track';
import { spawnEnemy, scaledEnemyVitals, updateEnemy } from '@/game/entities/enemy';
import {
  enemyBulletBurstDue,
  spawnEnemyBullet,
  updateEnemyBullet,
} from '@/game/entities/enemyBullet';
import { updateItem } from '@/game/entities/item';
import { pickHomingTarget, updateHomingMissile } from '@/game/entities/homingMissile';
import {
  buildingBlocksTank,
  buildingMaxHp,
  spawnBuilding,
  updateBuilding,
  validateBuildingFootprint,
} from '@/game/entities/building';
import { spawnWreckFloat, updateWreckFloat } from '@/game/entities/wreckFloat';
import {
  aaProfile,
  armFlakMark,
  launchTorpedoIfDue,
  updateFlakMark,
  updateTorpedoTrack,
} from '@/game/systems/seaStrike';
import { updateEnemyWeapons } from '@/game/systems/weapons';
import { resetVictoryExit } from '@/game/systems/victoryExit';
import { carrierHoldsClock, resetCarrierTakeoff } from './carrierTakeoff';
import { warningBulletAlpha } from '@/game/systems/background';
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
    stage.boss.fightWarning === undefined &&
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
  // Lamp time freezes `gameTime`. The wave clock must freeze with it, or the
  // first climb arrives about 3s before `STAGE4_FIRST_SPAWN`.
  if (b.waves && !carrierHoldsClock(b.takeoff.phase)) {
    b.waves.setPowerLevel(b.state.main.level);
    const spawns = b.waves.update(dt);
    if (!pastWarning) {
      for (const spawn of spawns) {
        const vitals = scaledEnemyVitals(spawn.type, difficulty, spawn.hp);
        spawnEnemy(
          b.enemies.acquire(),
          spawn.type,
          spawn.x,
          spawn.y,
          spawn.move,
          spawn.canFire ? spawn.fire : { kind: 'none' },
          spawn.drop,
          vitals.hp,
          spawn.score,
          vitals.shield
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
      scaleHp(buildingMaxHp(placement.type), difficulty)
    );
  }
  for (const anchor of b.wreckFloatScheduler.update(b.scrollFrame.scroll, b.gameTime)) {
    spawnWreckFloat(
      b.wreckFloats.acquire(),
      anchor,
      b.scrollFrame.scroll,
      scaleHp(WRECK_FLOAT_HP, difficulty),
      SCORE_WRECK_FLOAT
    );
  }
  const { player } = b;
  const flak = {
    profile: aaProfile(difficulty),
    orders: [] as Array<{ x: number; y: number; delay: number; count: number; speed: number }>,
  };
  b.buildings.forEach((building) => {
    const gone = updateBuilding(
      building,
      dt,
      b.scrollFrame.scroll,
      player.x,
      player.y,
      b.spawner,
      !pastWarning,
      flak
    );
    if (gone || (b.scrollFrame.fade.layers[building.layer] ?? 0) <= 0.01) {
      b.buildings.release(building);
    }
  });
  for (const order of flak.orders) {
    armFlakMark(b.flakMarks.acquire(), order.x, order.y, order.delay, order.count, order.speed);
  }
  b.wreckFloats.forEach((floater) => {
    const gone = updateWreckFloat(floater, dt, b.scrollFrame.scroll);
    if (gone || (b.scrollFrame.fade.layers[floater.layer] ?? 0) <= 0.01) {
      b.wreckFloats.release(floater);
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
    } else if (enemy.bombHitIn < 0 && enemy.fire.kind === 'torpedo') {
      if (!pastWarning) {
        launchTorpedoIfDue(enemy, gunDt, player.x, player.y, () => b.torpedoes.acquire());
      }
    } else if (enemy.bombHitIn < 0) {
      updateEnemyWeapons(enemy, gunDt, player.x, player.y, b.spawner, !pastWarning);
    }
  });
  b.torpedoes.forEach((track) => {
    if (updateTorpedoTrack(track, dt, b.scrollFrame.tileDelta)) b.torpedoes.release(track);
  });
  b.flakMarks.forEach((mark) => {
    if (updateFlakMark(mark, dt, b.spawner)) b.flakMarks.release(mark);
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
  const bursts: Array<{ x: number; y: number; speed: number }> = [];
  b.enemyBullets.forEach((bullet) => {
    const gone = updateEnemyBullet(bullet, dt, target);
    if (enemyBulletBurstDue(bullet)) {
      bursts.push({ x: bullet.x, y: bullet.y, speed: bullet.burstSpeed });
      b.enemyBullets.release(bullet);
    } else if (gone) {
      b.enemyBullets.release(bullet);
    }
  });
  // The split rounds already carry the run's speed scale, so they skip the spawner.
  for (const burst of bursts) {
    for (const dir of [-1, 1]) {
      if (b.enemyBullets.getActiveCount() >= ENEMY_BULLET_CAP) break;
      spawnEnemyBullet(b.enemyBullets.acquire(), burst.x, burst.y, dir * burst.speed, 0, 'small');
    }
  }
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
  b.wreckFloatScheduler.reset();
  clearFx(b.fx);
  b.boss = time >= stage.boss.enterAt ? spawnBoss(b) : null;
  resetVictoryExit(b.victory);
  resetCarrierTakeoff(b.takeoff);
  b.warningPlayed = time >= stage.warningAt + WARNING_BANNER_DELAY;
  b.scrollFrame = b.scroller.seek(time);
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
