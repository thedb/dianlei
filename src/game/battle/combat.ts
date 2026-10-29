/**
 * Combat rules for the battle: kills and drops, the bomb, homing targets, and
 * the per-frame collision pass. Player shots find enemies through the spatial
 * grid; candidates come back in pool order, so hit order matches a full scan.
 */

import {
  BOMB_BULLET_SCORE,
  BOMB_COOLDOWN,
  BOMB_FLASH_TIME,
  BOMB_INVINCIBLE_TIME,
  BOMB_WAVE_TIME,
  HOMING_HIT_SIZE,
} from '@/game/config';
import { explosionKindForSize } from '@/game/art';
import { ENEMY_DEFS, ENEMY_MAX_HIT_RADIUS } from '@/game/entities/enemyDefs';
import { damageEnemy, isGroundEnemy, type Enemy } from '@/game/entities/enemy';
import { spawnItem } from '@/game/entities/item';
import {
  buildingOnScreen,
  bulletHitsBuilding,
  damageBuilding,
  type Building,
} from '@/game/entities/building';
import { buildingClass, enemyClass } from '@/game/entities/objectClass';
import {
  chooseBuildingDrop,
  chooseKillDrop,
  previewDefaultBuildingDrop,
  type DropRule,
} from '@/game/systems/dropRules';
import {
  checkBulletEnemyCollision,
  checkItemPickup,
  checkPlayerBulletSwept,
  checkPlayerEnemyCollision,
} from '@/game/systems/collision';
import {
  bombArrives,
  bombHitBuilding,
  bombHitEnemy,
  bombHitWreckFloat,
  boxOnScreen,
  markBombTarget,
} from '@/game/systems/bomb';
import {
  bulletHitsWreckFloat,
  damageWreckFloat,
  type WreckFloat,
} from '@/game/entities/wreckFloat';
import {
  applyBossBomb,
  bossHitsPlayer,
  bossLaserHits,
  bossMissileTargets,
  markBossBombProps,
  resolveBossBombProps,
  resolveBossBullet,
} from '@/game/systems/boss';
import { bulletHitsWeaponTarget, WEAPON_TEST_TARGET } from '@/game/scenes/weaponTest';
import { clearEnemyBullets, runProfile, type Battle } from './context';
import { spawnExplosion, spawnHitSpark } from './fx';
import { collectItem, isPlayerControllable, isPlayerVulnerable, killPlayer } from './player';
import { applyBossEvents } from './bossFight';

/** Broad-phase pad: any enemy whose circle can touch the shot has its center inside. */
const GRID_PAD = ENEMY_MAX_HIT_RADIUS + 1;

function buildingDropRules(b: Battle): readonly DropRule[] | undefined {
  return runProfile(b).buildingDrops ?? b.stage.buildingDrops;
}

/**
 * Debug preview of the default table (P/B, or B at POWER_MAX).
 * Does not roll and does not reveal a placement lock.
 */
export function nextBuildingDrop(b: Battle): string {
  return previewDefaultBuildingDrop(b.state.main.level);
}

/** Score, explosion, drop and release for an enemy whose HP just reached 0. */
export function killEnemy(b: Battle, enemy: Enemy): void {
  b.state.score += enemy.score;
  const def = ENEMY_DEFS[enemy.type];
  const kind = explosionKindForSize(enemyClass(enemy.type).size);
  spawnExplosion(b.fx, enemy.x, enemy.y, kind);
  for (const [dx, dy, delay] of def.deathBursts ?? []) {
    spawnExplosion(b.fx, enemy.x + dx, enemy.y + dy, kind, delay);
  }
  if (def.countsInKillRate !== false) b.waves?.recordKill();
  b.sfx('enemyExplode');
  const drop = def.killDrop ? chooseKillDrop(def.killDrop, b.state.mate, b.rng) : enemy.drop;
  if (drop) spawnItem(b.items.acquire(), drop, enemy.x, enemy.y, b.rng);
  b.enemies.release(enemy);
}

export function destroyBuilding(b: Battle, building: Building): void {
  b.state.score += building.score;
  const kind = explosionKindForSize(buildingClass(building.type).size);
  spawnExplosion(b.fx, building.x, building.y, kind);
  spawnExplosion(b.fx, building.x - building.width / 4, building.y + 4, kind, 0.06);
  spawnExplosion(b.fx, building.x + building.width / 4, building.y - 4, kind, 0.12);
  b.sfx('enemyExplode');
  // Live loadout and the locks rolled at enter. A copy from scene start is stale.
  const rules = buildingDropRules(b);
  const drop = chooseBuildingDrop({
    id: building.placement.id,
    mainLevel: b.state.main.level,
    sub: b.state.sub,
    rng: b.rng,
    fixed: b.fixedDrops,
    ...(rules ? { rules } : {}),
  });
  spawnItem(b.items.acquire(), drop, building.x, building.y, b.rng);
}

function hitEnemy(b: Battle, enemy: Enemy, damage: number, x: number, y: number): void {
  spawnHitSpark(b.fx, x, y);
  if (damageEnemy(enemy, damage)) killEnemy(b, enemy);
  else b.sfx('enemyHit');
}

function hitBuilding(b: Battle, building: Building, damage: number, x: number, y: number): void {
  spawnHitSpark(b.fx, x, y);
  if (damageBuilding(building, damage)) destroyBuilding(b, building);
  else b.sfx('enemyHit');
}

/**
 * 挑战 Boss (`battleEntry: 'boss'` from the debug panel) keeps its stock so
 * B can be pressed for the whole fight. A stage run, including 关卡选择,
 * still spends one.
 */
function bombSpendsStock(b: Battle): boolean {
  return !(b.rules().bossEntry && b.scene.battleEntry === 'boss');
}

/** Score and a small blast. No drop and no kill-rate tick: this is not a ship. */
export function destroyWreckFloat(b: Battle, floater: WreckFloat): void {
  b.state.score += floater.score;
  spawnExplosion(b.fx, floater.x, floater.y, explosionKindForSize('small'));
  b.sfx('enemyExplode');
  b.wreckFloats.release(floater);
}

function hitWreckFloat(b: Battle, floater: WreckFloat, damage: number, x: number, y: number): void {
  spawnHitSpark(b.fx, x, y);
  if (damageWreckFloat(floater, damage)) destroyWreckFloat(b, floater);
  else b.sfx('enemyHit');
}

/** Bomb: clear bullets now, then hit what was on screen as the ring reaches it. */
export function activateBomb(b: Battle): void {
  const { state, player } = b;
  if (state.bombs <= 0 || state.bombCooldown > 0) return;

  if (bombSpendsStock(b)) state.bombs--;
  state.bombCooldown = BOMB_COOLDOWN;
  state.bombInvincible = BOMB_INVINCIBLE_TIME;
  state.bombFlashTimer = BOMB_FLASH_TIME;
  state.score += clearEnemyBullets(b) * BOMB_BULLET_SCORE;

  b.bombWave.active = true;
  b.bombWave.x = player.x;
  b.bombWave.y = player.y;
  b.bombWave.t = 0;

  b.enemies.forEach((enemy) => markBombTarget(enemy, player.x, player.y));
  b.buildings.forEach((building) => {
    if (!building.wrecked) markBombTarget(building, player.x, player.y);
  });
  b.wreckFloats.forEach((floater) => markBombTarget(floater, player.x, player.y));

  if (b.boss) {
    markBossBombProps(b.boss, player.x, player.y);
    applyBossEvents(b, applyBossBomb(b.boss));
  }
  b.sfx('bomb');
}

/** Resolve bomb hits whose ring arrival time has come. */
export function updateBombHits(b: Battle, dt: number): void {
  const wave = b.bombWave;
  if (wave.active) {
    wave.t += dt;
    if (wave.t >= BOMB_WAVE_TIME) wave.active = false;
  }
  b.enemies.forEach((enemy) => {
    if (bombArrives(enemy, dt) && bombHitEnemy(enemy)) killEnemy(b, enemy);
  });
  b.buildings.forEach((building) => {
    if (bombArrives(building, dt) && bombHitBuilding(building)) destroyBuilding(b, building);
  });
  b.wreckFloats.forEach((floater) => {
    if (bombArrives(floater, dt) && bombHitWreckFloat(floater)) destroyWreckFloat(b, floater);
  });
  if (b.boss) applyBossEvents(b, resolveBossBombProps(b.boss, dt));
}

/** On-screen live things a homing missile may chase. */
export function collectHomingTargets(b: Battle): void {
  const targets = b.homingTargets;
  targets.length = 0;
  if (b.rules().range) {
    targets.push({
      x: WEAPON_TEST_TARGET.x + WEAPON_TEST_TARGET.w / 2,
      y: WEAPON_TEST_TARGET.y + WEAPON_TEST_TARGET.h / 2,
    });
    return;
  }
  b.enemies.forEach((enemy) => {
    if (boxOnScreen(enemy)) targets.push(enemy);
  });
  b.buildings.forEach((building) => {
    if (!building.wrecked && buildingOnScreen(building)) targets.push(building);
  });
  b.wreckFloats.forEach((floater) => {
    if (boxOnScreen(floater)) targets.push(floater);
  });
  if (b.boss) {
    for (const part of bossMissileTargets(b.boss)) {
      targets.push({ x: part.worldX, y: part.worldY });
    }
  }
}

interface Shot {
  active: boolean;
  x: number;
  y: number;
  damage: number;
}

/**
 * One player projectile against the range target, the boss, then enemies and
 * buildings. Returns after the range or a boss hit. A bullet that overlaps
 * several enemies in one frame damages each of them.
 */
function resolveShot(
  b: Battle,
  shot: Shot,
  w: number,
  h: number,
  release: () => void,
  stopAtFirstEnemy: boolean
): void {
  if (b.rules().range) {
    if (bulletHitsWeaponTarget(shot.x, shot.y, w, h)) {
      b.meter.record(b.gameTime, shot.damage);
      spawnHitSpark(b.fx, shot.x, shot.y);
      release();
    }
    return;
  }
  if (b.boss) {
    const hit = resolveBossBullet(b.boss, { x: shot.x, y: shot.y, w, h }, shot.damage);
    if (hit.consumedBullet) {
      spawnHitSpark(b.fx, shot.x, shot.y);
      release();
      applyBossEvents(b, hit);
      return;
    }
  }
  b.enemyGrid.forEachInRect(
    shot.x - w / 2 - GRID_PAD,
    shot.y - h / 2 - GRID_PAD,
    w + GRID_PAD * 2,
    h + GRID_PAD * 2,
    (enemy) => {
      if (!enemy.active || (stopAtFirstEnemy && !shot.active)) return;
      if (!checkBulletEnemyCollision(shot.x, shot.y, w, h, enemy.x, enemy.y, enemy.hitRadius)) {
        return;
      }
      const damage = shot.damage;
      const hx = shot.x;
      const hy = shot.y;
      release();
      hitEnemy(b, enemy, damage, hx, hy);
    }
  );
  if (!shot.active) return;
  b.buildings.forEach((building) => {
    if (!shot.active) return;
    if (!bulletHitsBuilding(building, shot.x, shot.y, w, h)) return;
    const damage = shot.damage;
    const hx = shot.x;
    const hy = shot.y;
    release();
    hitBuilding(b, building, damage, hx, hy);
  });
  if (!shot.active) return;
  b.wreckFloats.forEach((floater) => {
    if (!shot.active) return;
    if (!bulletHitsWreckFloat(floater, shot.x, shot.y, w, h)) return;
    const damage = shot.damage;
    const hx = shot.x;
    const hy = shot.y;
    release();
    hitWreckFloat(b, floater, damage, hx, hy);
  });
}

/** Every hit test for the frame. `warningWindow` bullets are fading and harmless. */
export function resolveCollisions(b: Battle, warningWindow: boolean): void {
  const grid = b.enemyGrid;
  grid.clear();
  b.enemies.forEach((enemy) => grid.insert(enemy, enemy.x, enemy.y));

  b.bullets.forEach((bullet) => {
    resolveShot(b, bullet, bullet.width, bullet.height, () => b.bullets.release(bullet), false);
  });
  b.missiles.forEach((m) => {
    resolveShot(b, m, HOMING_HIT_SIZE, HOMING_HIT_SIZE, () => b.missiles.release(m), true);
  });

  // Wingmen (M) have no hitbox. Only the player center is tested below.
  const { player, boss } = b;
  if (isPlayerVulnerable(b) && !warningWindow) {
    b.enemyBullets.forEach((bullet) => {
      if (
        checkPlayerBulletSwept(
          player.prevX,
          player.prevY,
          player.x,
          player.y,
          bullet.prevX,
          bullet.prevY,
          bullet.x,
          bullet.y,
          bullet.hitRadius
        )
      ) {
        killPlayer(b);
      }
    });
  }

  // The hull and laser kill on contact; ground units never body-kill.
  if (isPlayerVulnerable(b) && boss && bossHitsPlayer(boss, player.x, player.y)) killPlayer(b);
  if (isPlayerVulnerable(b) && boss && bossLaserHits(boss, player.x, player.y)) killPlayer(b);
  if (isPlayerVulnerable(b)) {
    b.enemies.forEach((enemy) => {
      if (isGroundEnemy(enemy.type)) return;
      if (checkPlayerEnemyCollision(player.x, player.y, enemy.x, enemy.y, enemy.hitRadius)) {
        killPlayer(b);
      }
    });
  }

  b.items.forEach((item) => {
    if (isPlayerControllable(b) && checkItemPickup(player.x, player.y, item.x, item.y)) {
      collectItem(b, item.type);
      b.items.release(item);
    }
  });
}
