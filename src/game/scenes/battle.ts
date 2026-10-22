/**
 * Battle scene — stage 1 through the orbital boss.
 * Warning clears the lane, the battleship fights, then STAGE CLEAR hands off
 * to the result scene. Boss practice is battleEntry 'boss'.
 * playMode 'weaponTest' reuses this scene with no scroll and no spawns.
 */

import type { Scene, SceneContext } from './types';
import type { Renderer, GameDebugInfo } from '@/engine/renderer';
import type { InputState } from '@/engine/input';
import { ObjectPool } from '@/engine/pool';
import {
  LOGICAL_W,
  LOGICAL_H,
  PLAYER_SPEED,
  PLAYER_MARGIN,
  PLAYER_SPAWN_Y,
  HITBOX_RADIUS,
  SHOW_HITBOX,
  HITBOX_ALPHA,
  PLAYER_BULLET_SPEED,
  BOMBS_START,
  BOMBS_MAX,
  BOMBS_ON_RESPAWN,
  BOMB_COOLDOWN,
  BOMB_INVINCIBLE_TIME,
  BOMB_BULLET_SCORE,
  BOMB_FLASH_TIME,
  BOMB_WAVE_TIME,
  HOMING_HIT_SIZE,
  LIVES_START,
  LIVES_MAX,
  RESPAWN_DELAY,
  RESPAWN_FLYIN_TIME,
  RESPAWN_INVINCIBLE_TIME,
  INVINCIBLE_BLINK_INTERVAL,
  INVINCIBLE_BLINK_FAST,
  INVINCIBLE_ALPHA_MIN,
  INVINCIBLE_ALPHA_MAX,
  EXTEND_EVERY,
  EXTEND_REPEAT,
  EXTEND_OVERFLOW_SCORE,
  B_OVERFLOW_SCORE,
  ENEMY_BULLET_CAP,
  BANK_IN_TIME,
  BANK_OUT_TIME,
  BANK_DEADZONE,
  BANK_HYSTERESIS,
  WARNING_BANNER_DELAY,
  SHAKE_BIG_INTENSITY,
  SHAKE_BIG_DURATION,
  BUILDING_HP,
} from '@/game/config';
import { bossUsesPhase3, prepareBossConfig, scaleHp, type Difficulty } from '@/game/difficulty';
import { getStageGrids } from '@/game/art/tiles';
import { PALETTE, COLOR } from '@/game/palette';
import { stage1 } from '@/game/levels/stage1';
import type { BossConfig } from '@/game/levels/types';

// Art assets
import {
  createGameAssets,
  type GameAssets,
  getBankFrameIndex,
  drawPlayerFlames,
  drawEnemyFlame,
  drawBulletGlow,
  drawBackground,
  terrainBlocksTank,
  drawBossWorld,
  drawBossHpBar,
  drawBossLaser,
  BULLET_GLOW_COLORS,
  SEA_GUN_PIVOT,
  drawBombShockwave,
  drawHomingExhaust,
  EXPLOSION_FRAME_TIME,
  EXPLOSION_POOL_SIZE,
  HIT_SPARK_FRAME_COUNT,
  HIT_SPARK_FRAME_TIME,
  HIT_SPARK_POOL_SIZE,
  PLAYER_DEATH_EXPLOSION,
  explosionDrawKey,
  explosionFrameCount,
  explosionKindForSize,
  type ExplosionKind,
} from '@/game/art';

// Entities
import { createBullet, type Bullet } from '@/game/entities/bullet';
import {
  ENEMY_STATS,
  createEnemy,
  spawnEnemy,
  updateEnemy,
  damageEnemy,
  isGroundEnemy,
  type Enemy,
} from '@/game/entities/enemy';
import {
  createEnemyBullet,
  updateEnemyBullet,
  spawnEnemyBullet,
  executeFirePattern,
  type EnemyBullet,
  type BulletSpawner,
} from '@/game/entities/enemyBullet';
import {
  ITEM_DEFS,
  createItem,
  spawnItem,
  updateItem,
  isItemFlashing,
  type Item,
  type ItemType,
} from '@/game/entities/item';
import {
  createHomingMissile,
  pickHomingTarget,
  spawnHomingMissile,
  updateHomingMissile,
  type HomingMissile,
  type HomingTarget,
} from '@/game/entities/homingMissile';
import {
  BuildingScheduler,
  buildingBlocksTank,
  buildingOnScreen,
  bulletHitsBuilding,
  chooseBuildingDrop,
  createBuilding,
  damageBuilding,
  spawnBuilding,
  updateBuilding,
  validateBuildingFootprint,
  type Building,
} from '@/game/entities/building';

// Systems
import {
  checkPlayerBulletSwept,
  isPlayerVulnerable as isVulnerable,
  checkPlayerEnemyCollision,
  checkBulletEnemyCollision,
  checkItemPickup,
} from '@/game/systems/collision';
import { WaveScheduler } from '@/game/systems/waveScheduler';
import { inCircle } from '@/game/controls';
import { createPauseMenu } from '@/game/ui/pauseMenu';
import { drawControls, drawPauseButton } from '@/game/ui/controlsOverlay';
import { drawButton, drawPanel, drawText, UI_COLORS } from '@/game/ui/widgets';
import { updateEnemyWeapons } from '@/game/systems/weapons';
import { getAudioSystem } from '@/game/systems/audio';
import {
  bombArrives,
  bombHitBuilding,
  bombHitEnemy,
  bombWaveRadius,
  boxOnScreen,
  markBombTarget,
} from '@/game/systems/bomb';
import {
  WEAPONS,
  applyDeathPenalty,
  applyWeaponPickup,
  maxOut,
  resetLoadout,
  stepFireClock,
  weaponForItem,
  weaponLevel,
  type EquippedWeapon,
  type Loadout,
  type WeaponEmitter,
} from '@/game/systems/playerWeapons';
import { buildingClass, enemyClass } from '@/game/entities/objectClass';
import {
  applyBossBomb,
  bossHitsPlayer,
  bossHpBarLayout,
  bossIntroBarFill,
  bossIntroBarLayout,
  bossLaserHits,
  bossMissileTargets,
  createBoss,
  releaseBossResult,
  resolveBossBullet,
  updateBoss,
  type BossEvents,
  type BossHpBarLayout,
  type BossRuntime,
} from '@/game/systems/boss';
import {
  createVictoryExit,
  resetVictoryExit,
  stepVictoryExit,
  victoryExitBlocksInput,
  type VictoryExit,
} from '@/game/systems/victoryExit';
import { introBanner, type RunReport } from '@/game/systems/score';
import {
  Scroller,
  warningBulletAlpha,
  backgroundFade,
  type ScrollFrame,
} from '@/game/systems/background';
import {
  bulletHitsWeaponTarget,
  clampWeaponTestBombs,
  createDamageMeter,
  createWeaponTestTune,
  emitWithDamage,
  formatWeaponTestNumber,
  resetWeaponTestTune,
  stepWeaponTestTune,
  weaponTestBombCountRect,
  weaponTestBombDecRect,
  weaponTestBombIncRect,
  weaponTestCommandAt,
  weaponTestMainRect,
  weaponTestResetRect,
  weaponTestRowLabelY,
  weaponTestSubRect,
  weaponTestTuneDecRect,
  weaponTestTuneIncRect,
  weaponTestTuneRow,
  weaponTestTuneValueRect,
  weaponTestVolleyDamage,
  weaponTestVolleyRate,
  WEAPON_TEST_CTRL_PANEL,
  WEAPON_TEST_STATS_PANEL,
  WEAPON_TEST_TARGET,
  WEAPON_TEST_TUNE_FIELDS,
  WEAPON_TEST_TUNE_LABEL,
  type WeaponTestCommand,
  type WeaponTestStats,
} from './weaponTest';

// Explosion FX. `kind` picks the baked small / medium / large frame set.
interface Explosion {
  active: boolean;
  x: number;
  y: number;
  frame: number;
  timer: number;
  frameTime: number;
  frameCount: number;
  delay: number;
  kind: ExplosionKind;
}

interface HitSpark {
  active: boolean;
  x: number;
  y: number;
  frame: number;
  timer: number;
}

/** Player death burst: [dx, dy, delay] — staggered blasts around the wreck */
const DEATH_BURSTS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [-7, -5, 0.08],
  [6, 4, 0.14],
  [-4, 7, 0.22],
  [5, -8, 0.3],
];

function createExplosion(): Explosion {
  return {
    active: false,
    x: 0,
    y: 0,
    frame: 0,
    timer: 0,
    frameTime: EXPLOSION_FRAME_TIME,
    frameCount: explosionFrameCount('small'),
    delay: 0,
    kind: 'small',
  };
}

function createHitSpark(): HitSpark {
  return { active: false, x: 0, y: 0, frame: 0, timer: 0 };
}

// Player state
interface PlayerState {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  bank: number;
  targetBank: number;
  lastBankFrame: number;
  velocityY: number;
}

// Game state. `main` / `sub` are the weapon slots (see playerWeapons.ts).
interface GameState extends Loadout {
  lives: number;
  bombs: number;
  score: number;
  bombCooldown: number;
  bombInvincible: number;
  bombFlashTimer: number;
  respawnTimer: number;
  respawnInvincible: number;
  isDead: boolean;
  isFlying: boolean;
  gameOver: boolean;
  deaths: number;
  nextExtendScore: number;
}

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

interface BombWave {
  active: boolean;
  x: number;
  y: number;
  t: number;
}

export function createBattleScene(sceneCtx: SceneContext): BattleScene {
  // Assets (initialized in enter)
  let assets: GameAssets | null = null;

  // Player
  const player: PlayerState = {
    x: LOGICAL_W / 2,
    y: PLAYER_SPAWN_Y,
    prevX: LOGICAL_W / 2,
    prevY: PLAYER_SPAWN_Y,
    bank: 0,
    targetBank: 0,
    lastBankFrame: 5,
    velocityY: 0,
  };

  // Game state
  const state: GameState = {
    lives: LIVES_START,
    bombs: BOMBS_START,
    score: 0,
    main: { id: 'vulcan', level: 1 },
    sub: null,
    bombCooldown: 0,
    bombInvincible: 0,
    bombFlashTimer: 0,
    respawnTimer: 0,
    respawnInvincible: 0,
    isDead: false,
    isFlying: false,
    gameOver: false,
    deaths: 0,
    nextExtendScore: EXTEND_EVERY,
  };

  // Object pools
  const bulletPool = new ObjectPool(createBullet, 100);
  const missilePool = new ObjectPool(createHomingMissile, 24);
  const homingTargets: HomingTarget[] = [];
  const bombWave: BombWave = { active: false, x: 0, y: 0, t: 0 };
  const enemyPool = new ObjectPool(createEnemy, 64);
  const enemyBulletPool = new ObjectPool(createEnemyBullet, 200);
  const itemPool = new ObjectPool(createItem, 10);
  const buildingPool = new ObjectPool(createBuilding, 16);
  const buildingScheduler = new BuildingScheduler(stage1.buildings, stage1.warningAt);
  const explosionPool: Explosion[] = [];
  for (let i = 0; i < EXPLOSION_POOL_SIZE; i++) {
    explosionPool.push(createExplosion());
  }
  const sparkPool: HitSpark[] = [];
  for (let i = 0; i < HIT_SPARK_POOL_SIZE; i++) {
    sparkPool.push(createHitSpark());
  }

  let boss: BossRuntime | null = null;
  let bossCfg: BossConfig = stage1.boss;
  const victory: VictoryExit = createVictoryExit();
  let warningPlayed = false;
  let finishedAt: number | null = null;
  let shakeLeft = 0;
  let shakeMag = 0;
  let shakeDur = 0;

  // Wave scheduler — full stage, not the MVP subset
  let waveScheduler: WaveScheduler | null = null;

  // Session-only rate and damage. Stage, boss practice, and attract ignore it.
  const weaponTune = createWeaponTestTune();

  // Fire clocks, one per weapon slot. Weapon test substitutes the live rate.
  const volleyInterval = (w: EquippedWeapon): number => {
    const rate =
      weaponTestVolleyRate(sceneCtx.playMode === 'weaponTest', weaponTune, w.id) ??
      weaponLevel(w.id, w.level).rate;
    return 1 / rate;
  };
  let mainClock = volleyInterval(state.main);
  let subClock = 0;
  let gameTime = 0;
  const scroller = new Scroller();
  let scrollFrame: ScrollFrame = {
    scroll: 0,
    tileDelta: 0,
    fade: backgroundFade(0, stage1.warningAt),
    starScroll: [0, 0, 0],
  };

  // Input tracking
  let fireHeld = false;
  let bombPressed = false;
  let lastBombInput = false;

  // Audio. The title demo reuses this scene but must stay silent.
  const audio = getAudioSystem();
  const demo = (): boolean => sceneCtx.playMode === 'attract';
  const weaponTest = (): boolean => sceneCtx.playMode === 'weaponTest';
  const damageMeter = createDamageMeter();

  function sfx(id: Parameters<typeof audio.play>[0]): void {
    if (demo()) return;
    audio.play(id);
  }

  function leaveToTitle(): 'title' {
    sceneCtx.playMode = 'play';
    return 'title';
  }

  function applyWeaponCommand(command: WeaponTestCommand): void {
    if (command.kind === 'reset') {
      damageMeter.reset();
      resetWeaponTestTune(weaponTune);
      mainClock = volleyInterval(state.main);
      if (state.sub) subClock = volleyInterval(state.sub);
      return;
    }
    if (
      command.kind === 'mainRate' ||
      command.kind === 'mainDamage' ||
      command.kind === 'homingRate' ||
      command.kind === 'homingDamage'
    ) {
      stepWeaponTestTune(weaponTune, command.kind, command.delta);
      return;
    }
    if (command.kind === 'main') {
      const def = weaponForItem('P');
      if (!def) return;
      state.main.id = def.id;
      state.main.level = Math.max(1, Math.min(def.maxLevel, command.level));
      return;
    }
    if (command.kind === 'sub') {
      if (command.level <= 0) {
        state.sub = null;
        return;
      }
      const def = weaponForItem('T');
      if (!def) return;
      const arming = state.sub?.id !== def.id;
      state.sub = { id: def.id, level: Math.max(1, Math.min(def.maxLevel, command.level)) };
      if (arming) subClock = volleyInterval(state.sub);
      return;
    }
    state.bombs = clampWeaponTestBombs(state.bombs + command.delta);
  }

  function weaponTestStats(): WeaponTestStats {
    return {
      totalDamage: damageMeter.total(),
      dps: damageMeter.dps(gameTime),
      lastHit: damageMeter.lastHit(),
      mainLevel: state.main.level,
      subLevel: state.sub?.level ?? 0,
      bombs: state.bombs,
      mainRate: weaponTune.mainRate,
      mainDamage: weaponTune.mainDamage,
      homingRate: weaponTune.homingRate,
      homingDamage: weaponTune.homingDamage,
    };
  }

  const pauseMenu = createPauseMenu(sceneCtx.settings, {
    exitMode: () => (weaponTest() ? 'immediate' : 'confirm'),
  });

  function clearFx(): void {
    for (const exp of explosionPool) exp.active = false;
    for (const spark of sparkPool) spark.active = false;
  }

  // Helper to spawn explosion. Native frame size; kind selects the raster.
  function spawnExplosion(x: number, y: number, kind: ExplosionKind, delay = 0): void {
    for (const exp of explosionPool) {
      if (!exp.active) {
        exp.active = true;
        exp.x = x;
        exp.y = y;
        exp.frame = 0;
        exp.timer = 0;
        exp.delay = delay;
        exp.kind = kind;
        exp.frameCount = explosionFrameCount(kind);
        return;
      }
    }
  }

  /** Impact puff for a player bullet or homing missile. Separate pool from deaths. */
  function spawnHitSpark(x: number, y: number): void {
    for (const spark of sparkPool) {
      if (!spark.active) {
        spark.active = true;
        spark.x = x;
        spark.y = y;
        spark.frame = 0;
        spark.timer = 0;
        return;
      }
    }
  }

  function triggerShake(intensity: number, duration: number): void {
    if (shakeLeft > 0 && intensity < shakeMag) return;
    if (shakeLeft > 0 && intensity === shakeMag && duration <= shakeLeft) return;
    shakeMag = intensity;
    shakeDur = duration;
    shakeLeft = duration;
  }

  function applyBossEvents(ev: BossEvents): void {
    if (ev.score) state.score += ev.score;
    if (ev.convertBullets) {
      let cleared = 0;
      enemyBulletPool.forEach(() => cleared++);
      state.score += cleared * stage1.boss.transition.bulletsToScore;
      enemyBulletPool.releaseAll();
    }
    for (const shot of ev.shots) {
      executeFirePattern(shot.fire, shot.x, shot.y, player.x, player.y, bulletSpawner, {
        rotation: shot.rotation,
      });
    }
    if (ev.clearBullets) enemyBulletPool.releaseAll();
    for (const boom of ev.explosions) {
      spawnExplosion(boom.x, boom.y, boom.size, boom.delay);
    }
    if (ev.shake) triggerShake(ev.shake.intensity, ev.shake.duration);
    if (ev.explosions.length > 0) sfx('enemyExplode');
  }

  function publishRun(outcome: RunReport['outcome']): void {
    if (demo()) return;
    const info = waveScheduler?.getDebugInfo();
    sceneCtx.run.report = {
      outcome,
      baseScore: state.score,
      kills: info?.killed ?? 0,
      spawned: info?.spawned ?? 0,
      deaths: state.deaths,
      time: outcome === 'clear' ? (finishedAt ?? gameTime) : gameTime,
    };
  }

  /** Debug skip (wave table §8.3). Does not spawn the ships that were jumped over. */
  function runDifficulty(): Difficulty {
    if (demo() || weaponTest()) return 'easy';
    return sceneCtx.difficulty ?? 'easy';
  }

  function armBossConfig(): void {
    bossCfg = prepareBossConfig(stage1.boss, runDifficulty());
  }

  function spawnBoss(): BossRuntime {
    return createBoss(bossCfg, { phase3: bossUsesPhase3(runDifficulty()) });
  }

  function jumpTo(time: number): void {
    gameTime = time;
    waveScheduler?.reset();
    waveScheduler?.setPowerLevel(state.main.level);
    waveScheduler?.seek(time);
    bulletPool.releaseAll();
    missilePool.releaseAll();
    bombWave.active = false;
    enemyPool.releaseAll();
    enemyBulletPool.releaseAll();
    itemPool.releaseAll();
    buildingPool.releaseAll();
    buildingScheduler.reset();
    clearFx();
    boss = time >= stage1.boss.enterAt ? spawnBoss() : null;
    resetVictoryExit(victory);
    warningPlayed = time >= stage1.warningAt + WARNING_BANNER_DELAY;
    scrollFrame = {
      ...scrollFrame,
      tileDelta: 0,
      fade: backgroundFade(gameTime, stage1.warningAt),
    };
    finishedAt = null;
    shakeLeft = 0;
    state.isDead = false;
    state.isFlying = false;
    state.gameOver = false;
    state.respawnTimer = 0;
    if (state.lives <= 0) state.lives = 1;
    player.y = PLAYER_SPAWN_Y;
    player.prevY = PLAYER_SPAWN_Y;
  }

  function drawGunBarrel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    twin: boolean
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (twin) {
      ctx.fillStyle = PALETTE[COLOR.BLACK];
      ctx.fillRect(2, -6, 16, 4);
      ctx.fillRect(2, 2, 16, 4);
      ctx.fillStyle = PALETTE[COLOR.DARK_GRAY];
      ctx.fillRect(3, -5, 13, 2);
      ctx.fillRect(3, 3, 13, 2);
      ctx.fillStyle = PALETTE[COLOR.MEDIUM_GRAY];
      ctx.fillRect(14, -6, 3, 4);
      ctx.fillRect(14, 2, 3, 4);
    } else {
      ctx.fillStyle = PALETTE[COLOR.BLACK];
      ctx.fillRect(2, -2, 14, 4);
      ctx.fillStyle = PALETTE[COLOR.GROUND_DARK_OLIVE];
      ctx.fillRect(3, -1, 11, 2);
      ctx.fillStyle = PALETTE[COLOR.GROUND_TAN];
      ctx.fillRect(13, -2, 3, 4);
    }
    ctx.restore();
  }

  function spawnKillExplosion(enemy: Enemy): void {
    const kind = explosionKindForSize(enemyClass(enemy.type).size);
    spawnExplosion(enemy.x, enemy.y, kind);
    if (enemy.type === 'bomber') {
      spawnExplosion(enemy.x - 16, enemy.y - 6, kind, 0.06);
      spawnExplosion(enemy.x + 14, enemy.y + 8, kind, 0.12);
    } else if (enemy.type === 'medium' || enemy.type === 'turret2') {
      spawnExplosion(enemy.x + 8, enemy.y - 4, kind, 0.05);
    }
  }

  /** Score, explosion, drop and release for an enemy whose HP just reached 0. */
  function killEnemy(enemy: Enemy): void {
    state.score += enemy.score;
    spawnKillExplosion(enemy);
    waveScheduler?.recordKill();
    sfx('enemyExplode');
    if (enemy.drop) spawnItem(itemPool.acquire(), enemy.drop, enemy.x, enemy.y);
    enemyPool.release(enemy);
  }

  function hitEnemy(enemy: Enemy, damage: number, x: number, y: number): void {
    spawnHitSpark(x, y);
    if (damageEnemy(enemy, damage)) killEnemy(enemy);
    else sfx('enemyHit');
  }

  function hitBuilding(b: Building, damage: number, x: number, y: number): void {
    spawnHitSpark(x, y);
    if (damageBuilding(b, damage)) destroyBuilding(b);
    else sfx('enemyHit');
  }

  function destroyBuilding(b: Building): void {
    state.score += b.score;
    const kind = explosionKindForSize(buildingClass(b.type).size);
    spawnExplosion(b.x, b.y, kind);
    spawnExplosion(b.x - b.width / 4, b.y + 4, kind, 0.06);
    spawnExplosion(b.x + b.width / 4, b.y - 4, kind, 0.12);
    sfx('enemyExplode');
    // Live slot. Read state.sub here, not a copy taken when the scene started.
    const drop = chooseBuildingDrop(state.sub);
    spawnItem(itemPool.acquire(), drop, b.x, b.y);
  }

  function anyBuildingBlocksTank(x: number, y: number): boolean {
    let blocked = false;
    buildingPool.forEach((b) => {
      if (!blocked && buildingBlocksTank(b, x, y)) blocked = true;
    });
    return blocked;
  }

  // Bullet spawner for enemy fire patterns
  const bulletSpawner: BulletSpawner = {
    spawnBullet(x, y, vx, vy, type, homing = 0) {
      if (enemyBulletPool.getActiveCount() < ENEMY_BULLET_CAP) {
        const bullet = enemyBulletPool.acquire();
        spawnEnemyBullet(bullet, x, y, vx, vy, type, homing);
      }
    },
    getBulletCount() {
      return enemyBulletPool.getActiveCount();
    },
  };

  const emitter: WeaponEmitter = {
    bullet(x, y, vx, vy, damage) {
      const bullet = bulletPool.acquire();
      bullet.x = x;
      bullet.y = y;
      bullet.prevX = x;
      bullet.prevY = y;
      bullet.vx = vx;
      bullet.vy = vy;
      bullet.damage = damage;
    },
    missile(x, y, angle, damage) {
      spawnHomingMissile(missilePool.acquire(), x, y, angle, damage);
    },
  };

  /** One volley of the weapon in a slot. The title demo goes through here too. */
  function fireVolley(weapon: EquippedWeapon): void {
    const level = weaponLevel(weapon.id, weapon.level);
    const damage = weaponTestVolleyDamage(weaponTest(), weaponTune, weapon.id);
    const emit = damage === null ? emitter : emitWithDamage(emitter, damage);
    level.fire(player.x, player.y, emit);
    if (WEAPONS[weapon.id].slot === 'main') sfx('shoot');
  }

  // Handle player death
  function killPlayer(): void {
    if (!isPlayerVulnerable()) return;

    state.isDead = true;
    state.lives--;
    state.deaths++;
    applyDeathPenalty(state);
    state.respawnTimer = RESPAWN_DELAY;

    state.isFlying = false;
    player.bank = 0;
    player.targetBank = 0;
    player.lastBankFrame = 5;
    player.velocityY = 0;

    // Clear enemy bullets (give player breathing room)
    enemyBulletPool.releaseAll();

    // The ship sprite stops drawing this frame; only the explosion remains
    for (const [dx, dy, delay] of DEATH_BURSTS) {
      spawnExplosion(player.x + dx, player.y + dy, PLAYER_DEATH_EXPLOSION, delay);
    }
    triggerShake(SHAKE_BIG_INTENSITY, SHAKE_BIG_DURATION);
    sfx('playerExplode');
  }

  // Bring in a fresh ship from below the screen after the respawn delay
  function spawnNewShip(): void {
    state.isDead = false;
    state.isFlying = true;
    state.bombs = BOMBS_ON_RESPAWN;
    state.respawnInvincible = RESPAWN_FLYIN_TIME + RESPAWN_INVINCIBLE_TIME;
    player.x = LOGICAL_W / 2;
    player.y = LOGICAL_H + 40;
    player.prevX = player.x;
    player.prevY = player.y;
  }

  function isPlayerControllable(): boolean {
    return !state.isDead && !state.isFlying && !victoryExitBlocksInput(victory.phase);
  }

  function isPlayerVulnerable(): boolean {
    return isVulnerable(state) && !victoryExitBlocksInput(victory.phase);
  }

  // Bomb: clear bullets now, then hit what was on screen as the ring reaches it
  function activateBomb(): void {
    if (state.bombs <= 0 || state.bombCooldown > 0) return;

    state.bombs--;
    state.bombCooldown = BOMB_COOLDOWN;
    state.bombInvincible = BOMB_INVINCIBLE_TIME;
    state.bombFlashTimer = BOMB_FLASH_TIME;

    let bulletsCleared = 0;
    enemyBulletPool.forEach(() => bulletsCleared++);
    state.score += bulletsCleared * BOMB_BULLET_SCORE;
    enemyBulletPool.releaseAll();

    bombWave.active = true;
    bombWave.x = player.x;
    bombWave.y = player.y;
    bombWave.t = 0;

    enemyPool.forEach((enemy) => markBombTarget(enemy, player.x, player.y));
    buildingPool.forEach((b) => {
      if (!b.wrecked) markBombTarget(b, player.x, player.y);
    });

    if (boss) applyBossEvents(applyBossBomb(boss, bossCfg));
    sfx('bomb');
  }

  /** Resolve bomb hits whose ring arrival time has come. */
  function updateBombHits(dt: number): void {
    if (bombWave.active) {
      bombWave.t += dt;
      if (bombWave.t >= BOMB_WAVE_TIME) bombWave.active = false;
    }
    enemyPool.forEach((enemy) => {
      if (bombArrives(enemy, dt) && bombHitEnemy(enemy)) killEnemy(enemy);
    });
    buildingPool.forEach((b) => {
      if (bombArrives(b, dt) && bombHitBuilding(b)) destroyBuilding(b);
    });
  }

  function collectItem(type: ItemType): void {
    if (ITEM_DEFS[type].effect === 'bomb') {
      if (state.bombs < BOMBS_MAX) {
        state.bombs++;
      } else {
        state.score += B_OVERFLOW_SCORE;
      }
      sfx('itemPickup');
      return;
    }
    const weapon = weaponForItem(type);
    if (!weapon) return;
    const result = applyWeaponPickup(state, weapon.id);
    if (result === 'overflow') {
      state.score += weapon.overflowScore;
      sfx('itemPickup');
    } else {
      sfx('powerUp');
    }
    if (weapon.slot === 'sub' && state.sub && (result === 'equip' || result === 'switch')) {
      subClock = volleyInterval(state.sub);
    }
  }

  /** On-screen live things a homing missile may chase. */
  function collectHomingTargets(): void {
    homingTargets.length = 0;
    if (weaponTest()) {
      homingTargets.push({
        x: WEAPON_TEST_TARGET.x + WEAPON_TEST_TARGET.w / 2,
        y: WEAPON_TEST_TARGET.y + WEAPON_TEST_TARGET.h / 2,
      });
      return;
    }
    enemyPool.forEach((enemy) => {
      if (boxOnScreen(enemy)) homingTargets.push(enemy);
    });
    buildingPool.forEach((b) => {
      if (!b.wrecked && buildingOnScreen(b)) homingTargets.push(b);
    });
    if (boss) {
      for (const part of bossMissileTargets(boss)) {
        homingTargets.push({ x: part.worldX, y: part.worldY });
      }
    }
  }

  // Check for extra life
  function checkExtend(): void {
    if (state.score >= state.nextExtendScore) {
      if (state.lives < LIVES_MAX) {
        state.lives++;
        sfx('extend');
      } else {
        state.score += EXTEND_OVERFLOW_SCORE;
      }

      if (EXTEND_REPEAT) {
        state.nextExtendScore += EXTEND_EVERY;
      } else {
        state.nextExtendScore = Infinity;
      }
    }
  }

  // easeOutQuad for bank animation
  function easeOutQuad(t: number): number {
    return 1 - (1 - t) * (1 - t);
  }

  // Movement, banking and shooting while the ship is under player control
  function updatePlayerControl(dt: number, input: InputState): void {
    // Move player
    const speed = PLAYER_SPEED * input.joystickMagnitude;
    player.x += input.joystickX * speed * dt;
    player.y += input.joystickY * speed * dt;
    player.velocityY = input.joystickY * input.joystickMagnitude;

    // Clamp to screen bounds
    player.x = Math.max(PLAYER_MARGIN, Math.min(LOGICAL_W - PLAYER_MARGIN, player.x));
    player.y = Math.max(PLAYER_MARGIN, Math.min(LOGICAL_H - PLAYER_MARGIN, player.y));

    // Update bank animation
    player.targetBank = Math.abs(input.joystickX) < BANK_DEADZONE ? 0 : input.joystickX;
    const bankDiff = player.targetBank - player.bank;
    const isDeepening =
      Math.abs(player.targetBank) > Math.abs(player.bank) &&
      Math.sign(player.targetBank) === Math.sign(player.bank);
    const bankSpeed = isDeepening ? 1 / BANK_IN_TIME : 1 / BANK_OUT_TIME;
    const bankStep = bankSpeed * dt;

    if (Math.abs(bankDiff) < bankStep) {
      player.bank = player.targetBank;
    } else {
      player.bank += Math.sign(bankDiff) * bankStep;
    }

    // Calculate bank frame with hysteresis
    const displayBank = easeOutQuad(Math.abs(player.bank)) * Math.sign(player.bank);
    let newBankFrame = getBankFrameIndex(displayBank);
    const frameDiff = Math.abs(newBankFrame - player.lastBankFrame);
    if (frameDiff > 0) {
      const threshold = 0.5 + BANK_HYSTERESIS * 5;
      const normalized = (displayBank + 1) / 2;
      const framePos = normalized * 10;
      if (Math.abs(framePos - newBankFrame) > threshold) {
        newBankFrame = player.lastBankFrame;
      }
    }
    player.lastBankFrame = newBankFrame;

    // Main and sub fire together while A is held, each on its own clock
    const main = state.main;
    mainClock = stepFireClock(mainClock, dt, volleyInterval(main), fireHeld, () =>
      fireVolley(main)
    );
    const sub = state.sub;
    if (sub) {
      subClock = stepFireClock(subClock, dt, volleyInterval(sub), fireHeld, () => fireVolley(sub));
    }

    if (bombPressed) {
      activateBomb();
    }
  }

  function openPause(): void {
    pauseMenu.open();
    sceneCtx.input.setControlsEnabled(false);
  }

  function drawWeaponTestHud(ctx: CanvasRenderingContext2D): void {
    const stats = weaponTestStats();
    drawPanel(ctx, WEAPON_TEST_STATS_PANEL);
    const textX = WEAPON_TEST_STATS_PANEL.x + 10;
    let textY = WEAPON_TEST_STATS_PANEL.y + 16;
    const line = (text: string): void => {
      drawText(ctx, text, textX, textY, 13, UI_COLORS.text);
      textY += 22;
    };
    line('武器测试');
    line(`总伤害 ${stats.totalDamage}`);
    line(`DPS ${stats.dps.toFixed(1)}`);
    line(`主武器 Lv${stats.mainLevel}`);
    line(stats.subLevel === 0 ? '副武器 无' : `副武器 Lv${stats.subLevel}`);
    line(`上次 ${stats.lastHit}`);

    drawPanel(ctx, WEAPON_TEST_CTRL_PANEL);
    (['P', 'T', 'B'] as const).forEach((label, row) => {
      drawText(
        ctx,
        label,
        WEAPON_TEST_CTRL_PANEL.x + 8,
        weaponTestRowLabelY(row),
        13,
        UI_COLORS.dim
      );
    });
    ([1, 2, 3] as const).forEach((level) => {
      drawButton(ctx, weaponTestMainRect(level), String(level), stats.mainLevel === level);
    });
    drawButton(ctx, weaponTestSubRect(0), '关', stats.subLevel === 0);
    drawButton(ctx, weaponTestSubRect(1), '1', stats.subLevel === 1);
    drawButton(ctx, weaponTestSubRect(2), '2', stats.subLevel === 2);
    drawButton(ctx, weaponTestBombDecRect(), '-', false);
    const count = weaponTestBombCountRect();
    drawText(
      ctx,
      String(stats.bombs),
      count.x + count.w / 2,
      count.y + count.h / 2,
      14,
      UI_COLORS.text,
      'center'
    );
    drawButton(ctx, weaponTestBombIncRect(), '+', false);
    for (const field of WEAPON_TEST_TUNE_FIELDS) {
      drawText(
        ctx,
        WEAPON_TEST_TUNE_LABEL[field],
        WEAPON_TEST_CTRL_PANEL.x + 8,
        weaponTestRowLabelY(weaponTestTuneRow(field)),
        12,
        UI_COLORS.dim
      );
      drawButton(ctx, weaponTestTuneDecRect(field), '-', false);
      const value = weaponTestTuneValueRect(field);
      drawText(
        ctx,
        formatWeaponTestNumber(stats[field]),
        value.x + value.w / 2,
        value.y + value.h / 2,
        12,
        UI_COLORS.text,
        'center'
      );
      drawButton(ctx, weaponTestTuneIncRect(field), '+', false);
    }
    drawButton(ctx, weaponTestResetRect(), '重置', false);
  }

  return {
    id: 'battle',

    enter(): void {
      pauseMenu.close();
      sceneCtx.input.setControlsEnabled(true);

      // Sprites are immutable. Reuse the bake when the title demo restarts.
      if (!assets) assets = createGameAssets();

      // Reset player
      player.x = LOGICAL_W / 2;
      player.y = PLAYER_SPAWN_Y;
      player.prevX = player.x;
      player.prevY = player.y;
      player.bank = 0;
      player.targetBank = 0;
      player.lastBankFrame = 5;
      player.velocityY = 0;

      // Reset game state
      state.lives = LIVES_START;
      state.bombs = BOMBS_START;
      state.score = 0;
      resetLoadout(state);
      state.bombCooldown = 0;
      state.bombInvincible = 0;
      state.bombFlashTimer = 0;
      state.respawnTimer = 0;
      state.respawnInvincible = 0;
      state.isDead = false;
      state.isFlying = true;
      state.gameOver = false;
      state.deaths = 0;
      state.nextExtendScore = EXTEND_EVERY;
      player.y = LOGICAL_H + 40;
      player.prevY = player.y;

      // Reset pools
      bulletPool.releaseAll();
      missilePool.releaseAll();
      enemyPool.releaseAll();
      enemyBulletPool.releaseAll();
      itemPool.releaseAll();
      buildingPool.releaseAll();
      buildingScheduler.reset();
      clearFx();
      bombWave.active = false;

      // Full wave table, including ground units and the conditional relief ship
      waveScheduler = new WaveScheduler({ mvpOnly: false });

      // Reset timers. Weapon-test tune returns to the permanent constants.
      resetWeaponTestTune(weaponTune);
      mainClock = volleyInterval(state.main);
      subClock = 0;
      gameTime = 0;
      scroller.reset();
      scrollFrame = {
        scroll: 0,
        tileDelta: 0,
        fade: backgroundFade(0, stage1.warningAt),
        starScroll: [0, 0, 0],
      };
      fireHeld = false;
      bombPressed = false;
      lastBombInput = false;
      boss = null;
      armBossConfig();
      resetVictoryExit(victory);
      warningPlayed = false;
      finishedAt = null;
      shakeLeft = 0;
      shakeMag = 0;
      shakeDur = 0;
      damageMeter.reset();

      // Boss practice: Lv3, the normal bomb and life loadout, clock at 2:35.
      // seek() drops every wave that already passed, so those ships never
      // enter and do not count toward the kill-rate denominator.
      // Difficulty is the challenge pick (普通 → easy, 困难 → hard), so phase 3
      // arms only on hard. The picker records `challengeStage`; only stage 1
      // exists, and this jump stays on that table.
      // Weapon test keeps the fresh loadout and does not jump.
      if (!weaponTest() && sceneCtx.battleEntry === 'boss') {
        maxOut(state.main);
        jumpTo(stage1.boss.enterAt);
      }

      if (!demo()) audio.init();
    },

    onHide(): void {
      if (demo()) return;
      const showcasing = boss?.phase === 'clear' || boss?.phase === 'done';
      if (!pauseMenu.isOpen() && !state.gameOver && !showcasing) openPause();
    },

    exit(): void {
      pauseMenu.close();
      resetWeaponTestTune(weaponTune);
      damageMeter.reset();
      bulletPool.releaseAll();
      missilePool.releaseAll();
      enemyPool.releaseAll();
      enemyBulletPool.releaseAll();
      itemPool.releaseAll();
      buildingPool.releaseAll();
      clearFx();
    },

    update(dt: number, input: InputState) {
      // Unlock audio on first input. The title demo never touches the audio graph.
      if (
        !demo() &&
        (input.buttonA || input.buttonB || input.joystickMagnitude > 0.1 || input.taps.length)
      ) {
        audio.unlock();
      }

      // Paused: only the menu runs; gameplay state is frozen.
      // The title demo has no pause menu.
      if (!demo() && pauseMenu.isOpen()) {
        const action = pauseMenu.update(input);
        if (action === 'resume') sceneCtx.input.setControlsEnabled(true);
        if (action === 'exit') return leaveToTitle();
        return null;
      }

      // Weapon test has no enemy fire. A death still leaves for the title
      // without a run report, result scene, or game over.
      if (weaponTest() && state.isDead) return leaveToTitle();

      const showcasing = boss?.phase === 'clear';
      if (!demo() && !state.gameOver && !showcasing) {
        const pauseTapped = input.taps.some((t) =>
          inCircle(t.x, t.y, sceneCtx.input.getControlsView().layout.pauseButton, 8)
        );
        if (input.pausePressed || pauseTapped) {
          openPause();
          return null;
        }
      }

      if (weaponTest()) {
        for (const tap of input.taps) {
          const command = weaponTestCommandAt(tap.x, tap.y);
          if (command) applyWeaponCommand(command);
        }
      }

      gameTime += dt;
      if (shakeLeft > 0) shakeLeft = Math.max(0, shakeLeft - dt);

      // Update cooldowns
      if (state.bombCooldown > 0) {
        state.bombCooldown = Math.max(0, state.bombCooldown - dt);
      }
      if (state.bombInvincible > 0) {
        state.bombInvincible = Math.max(0, state.bombInvincible - dt);
      }
      if (state.bombFlashTimer > 0) {
        state.bombFlashTimer = Math.max(0, state.bombFlashTimer - dt);
      }
      if (state.respawnInvincible > 0) {
        state.respawnInvincible = Math.max(0, state.respawnInvincible - dt);
      }

      fireHeld = input.buttonA;
      const bombInput = input.buttonB;
      bombPressed = bombInput && !lastBombInput;
      lastBombInput = bombInput;

      // Store previous position (every step, so swept collision and render
      // interpolation never reach back to a stale position)
      player.prevX = player.x;
      player.prevY = player.y;

      if (state.isDead) {
        // Same death as a real run (life already spent in killPlayer). The title
        // fades and restarts the demo instead of respawning or going to game over.
        if (!demo()) {
          state.respawnTimer -= dt;
          if (state.respawnTimer <= 0) {
            if (state.lives <= 0) {
              state.gameOver = true;
              publishRun('gameover');
              return 'gameover';
            }
            spawnNewShip();
          }
        }
      } else if (victoryExitBlocksInput(victory.phase)) {
        player.bank = 0;
        player.targetBank = 0;
        player.velocityY = victory.phase === 'flyoff' ? -1 : 0;
      } else if (state.isFlying) {
        player.y -= ((LOGICAL_H + 40 - PLAYER_SPAWN_Y) / RESPAWN_FLYIN_TIME) * dt;
        if (player.y <= PLAYER_SPAWN_Y) {
          player.y = PLAYER_SPAWN_Y;
          state.isFlying = false;
        }
      } else {
        updatePlayerControl(dt, input);
      }

      if (!weaponTest()) scrollFrame = scroller.update(dt, gameTime, stage1.warningAt);

      const pastWarning = !weaponTest() && gameTime >= stage1.warningAt;
      const warningWindow = pastWarning && gameTime < stage1.boss.enterAt;
      if (
        !weaponTest() &&
        !warningPlayed &&
        gameTime >= stage1.warningAt + WARNING_BANNER_DELAY &&
        gameTime < stage1.boss.enterAt
      ) {
        warningPlayed = true;
        sfx('warning');
      }

      // Update player bullets
      const bulletsToRelease: Bullet[] = [];
      bulletPool.forEach((bullet) => {
        // Use vx/vy if set, otherwise straight up
        if (bullet.vx !== undefined && bullet.vy !== undefined) {
          bullet.prevX = bullet.x;
          bullet.prevY = bullet.y;
          bullet.x += bullet.vx * dt;
          bullet.y += bullet.vy * dt;
        } else {
          bullet.prevX = bullet.x;
          bullet.prevY = bullet.y;
          bullet.y -= PLAYER_BULLET_SPEED * dt;
        }
        if (bullet.y < -20 || bullet.x < -20 || bullet.x > LOGICAL_W + 20) {
          bulletsToRelease.push(bullet);
        }
      });
      bulletsToRelease.forEach((b) => bulletPool.release(b));

      // Update wave scheduler. Weapon test keeps the clock and fires nothing.
      if (waveScheduler && !weaponTest()) {
        waveScheduler.setPowerLevel(state.main.level);
        const spawns = waveScheduler.update(dt);

        if (!pastWarning) {
          for (const spawn of spawns) {
            const enemy = enemyPool.acquire();
            const baseHp = spawn.hp ?? ENEMY_STATS[spawn.type].hp;
            spawnEnemy(
              enemy,
              spawn.type,
              spawn.x,
              spawn.y,
              spawn.move,
              spawn.canFire ? spawn.fire : { kind: 'none' },
              spawn.drop,
              scaleHp(baseHp, runDifficulty()),
              spawn.score
            );
          }
        }
      }

      if (!weaponTest() && !boss && gameTime >= stage1.boss.enterAt) {
        boss = spawnBoss();
      }

      // Buildings ride the tile map. Footprints are checked against the real grid on spawn.
      if (!weaponTest()) {
        for (const placement of buildingScheduler.update(scrollFrame.scroll, gameTime)) {
          if (!validateBuildingFootprint(getStageGrids(), placement)) continue;
          spawnBuilding(
            buildingPool.acquire(),
            placement,
            scrollFrame.scroll,
            scaleHp(BUILDING_HP, runDifficulty())
          );
        }
        const buildingsToRelease: Building[] = [];
        buildingPool.forEach((b) => {
          const gone = updateBuilding(
            b,
            dt,
            scrollFrame.scroll,
            player.x,
            player.y,
            bulletSpawner,
            !pastWarning
          );
          if (gone || scrollFrame.fade[b.section] <= 0.01) buildingsToRelease.push(b);
        });
        buildingsToRelease.forEach((b) => buildingPool.release(b));
      }

      // Update enemies
      const grids = assets?.background?.grids;
      const terrain = {
        blocksTank: (x: number, y: number) =>
          (grids ? terrainBlocksTank(grids, scrollFrame.scroll, scrollFrame.fade, x, y) : false) ||
          anyBuildingBlocksTank(x, y),
      };
      const enemiesToRelease: Enemy[] = [];
      enemyPool.forEach((enemy) => {
        const shouldCull = updateEnemy(
          enemy,
          dt,
          player.x,
          player.y,
          scrollFrame.tileDelta,
          terrain
        );
        if (shouldCull) {
          enemiesToRelease.push(enemy);
        } else if (enemy.bombHitIn < 0) {
          updateEnemyWeapons(enemy, dt, player.x, player.y, bulletSpawner, !pastWarning);
        }
      });
      enemiesToRelease.forEach((e) => enemyPool.release(e));

      updateBombHits(dt);

      collectHomingTargets();
      const missilesToRelease: HomingMissile[] = [];
      missilePool.forEach((m) => {
        if (updateHomingMissile(m, dt, pickHomingTarget(m.x, m.y, homingTargets))) {
          missilesToRelease.push(m);
        }
      });
      missilesToRelease.forEach((m) => missilePool.release(m));

      if (boss && boss.phase !== 'done') {
        const ev = updateBoss(boss, dt, bossCfg);
        applyBossEvents(ev);
        if (boss.phase === 'clear' && finishedAt === null) finishedAt = gameTime;
        if (!demo()) {
          const cue = stepVictoryExit(
            victory,
            boss.phase,
            dt,
            player.x,
            player.y,
            LOGICAL_W / 2,
            PLAYER_SPAWN_Y
          );
          if (victoryExitBlocksInput(victory.phase)) {
            player.x = victory.x;
            player.y = victory.y;
          }
          if (cue === 'victory') {
            const done = releaseBossResult(boss);
            applyBossEvents(done);
            if (done.enterResult) {
              publishRun('clear');
              return 'result';
            }
          }
        }
      }

      // Warning fades enemy bullets with no score. Boss shots after enterAt stay.
      const bulletAlpha = warningWindow ? warningBulletAlpha(gameTime, stage1.warningAt) : 1;
      if (warningWindow && bulletAlpha <= 0) {
        enemyBulletPool.releaseAll();
      }

      // Update enemy bullets
      const enemyBulletsToRelease: EnemyBullet[] = [];
      enemyBulletPool.forEach((bullet) => {
        const shouldCull = updateEnemyBullet(bullet, dt, { x: player.x, y: player.y });
        if (shouldCull) {
          enemyBulletsToRelease.push(bullet);
        }
      });
      enemyBulletsToRelease.forEach((b) => enemyBulletPool.release(b));

      // Update items
      const itemsToRelease: Item[] = [];
      itemPool.forEach((item) => {
        const shouldCull = updateItem(item, dt);
        if (shouldCull) {
          itemsToRelease.push(item);
        }
      });
      itemsToRelease.forEach((i) => itemPool.release(i));

      // Update explosions and hit sparks
      for (const exp of explosionPool) {
        if (exp.active && exp.delay > 0) {
          exp.delay -= dt;
        } else if (exp.active) {
          exp.timer += dt;
          if (exp.timer >= exp.frameTime) {
            exp.timer -= exp.frameTime;
            exp.frame++;
            if (exp.frame >= exp.frameCount) {
              exp.active = false;
            }
          }
        }
      }
      for (const spark of sparkPool) {
        if (!spark.active) continue;
        spark.timer += dt;
        if (spark.timer >= HIT_SPARK_FRAME_TIME) {
          spark.timer -= HIT_SPARK_FRAME_TIME;
          spark.frame++;
          if (spark.frame >= HIT_SPARK_FRAME_COUNT) spark.active = false;
        }
      }

      // ========================================
      // COLLISION DETECTION
      // ========================================

      // Player bullets vs the battleship, then the rest of the lane.
      // Weapon test only feeds the immortal target.
      bulletPool.forEach((bullet) => {
        if (weaponTest()) {
          if (bulletHitsWeaponTarget(bullet.x, bullet.y, bullet.width, bullet.height)) {
            damageMeter.record(gameTime, bullet.damage);
            spawnHitSpark(bullet.x, bullet.y);
            bulletPool.release(bullet);
          }
          return;
        }
        if (boss) {
          const hit = resolveBossBullet(
            boss,
            { x: bullet.x, y: bullet.y, w: bullet.width, h: bullet.height },
            bullet.damage,
            bossCfg
          );
          if (hit.consumedBullet) {
            spawnHitSpark(bullet.x, bullet.y);
            bulletPool.release(bullet);
            applyBossEvents(hit);
            return;
          }
        }

        enemyPool.forEach((enemy) => {
          if (
            checkBulletEnemyCollision(
              bullet.x,
              bullet.y,
              bullet.width,
              bullet.height,
              enemy.x,
              enemy.y,
              enemy.hitRadius
            )
          ) {
            const damage = bullet.damage;
            const hx = bullet.x;
            const hy = bullet.y;
            bulletPool.release(bullet);
            hitEnemy(enemy, damage, hx, hy);
          }
        });

        if (!bullet.active) return;
        buildingPool.forEach((b) => {
          if (!bullet.active) return;
          if (!bulletHitsBuilding(b, bullet.x, bullet.y, bullet.width, bullet.height)) return;
          const damage = bullet.damage;
          const hx = bullet.x;
          const hy = bullet.y;
          bulletPool.release(bullet);
          hitBuilding(b, damage, hx, hy);
        });
      });

      // Homing missiles: same targets as bullets, with a small square hitbox
      missilePool.forEach((m) => {
        const size = HOMING_HIT_SIZE;
        if (weaponTest()) {
          if (bulletHitsWeaponTarget(m.x, m.y, size, size)) {
            damageMeter.record(gameTime, m.damage);
            spawnHitSpark(m.x, m.y);
            missilePool.release(m);
          }
          return;
        }
        if (boss) {
          const hit = resolveBossBullet(
            boss,
            { x: m.x, y: m.y, w: size, h: size },
            m.damage,
            bossCfg
          );
          if (hit.consumedBullet) {
            spawnHitSpark(m.x, m.y);
            missilePool.release(m);
            applyBossEvents(hit);
            return;
          }
        }
        enemyPool.forEach((enemy) => {
          if (!m.active) return;
          if (!checkBulletEnemyCollision(m.x, m.y, size, size, enemy.x, enemy.y, enemy.hitRadius)) {
            return;
          }
          const damage = m.damage;
          const hx = m.x;
          const hy = m.y;
          missilePool.release(m);
          hitEnemy(enemy, damage, hx, hy);
        });
        buildingPool.forEach((b) => {
          if (!m.active) return;
          if (!bulletHitsBuilding(b, m.x, m.y, size, size)) return;
          const damage = m.damage;
          const hx = m.x;
          const hy = m.y;
          missilePool.release(m);
          hitBuilding(b, damage, hx, hy);
        });
      });

      // Enemy bullets vs player. Fading warning bullets do not hit.
      if (isPlayerVulnerable() && !warningWindow) {
        enemyBulletPool.forEach((bullet) => {
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
            killPlayer();
          }
        });
      }

      // Enemy body vs player. The hull kills on contact; its bullets do not hurt it.
      if (isPlayerVulnerable() && boss && bossHitsPlayer(boss, player.x, player.y)) {
        killPlayer();
      }
      if (isPlayerVulnerable() && boss && bossLaserHits(boss, bossCfg, player.x, player.y)) {
        killPlayer();
      }
      if (isPlayerVulnerable()) {
        enemyPool.forEach((enemy) => {
          if (!isGroundEnemy(enemy.type)) {
            if (checkPlayerEnemyCollision(player.x, player.y, enemy.x, enemy.y, enemy.hitRadius)) {
              killPlayer();
            }
          }
        });
      }

      // Items vs player
      itemPool.forEach((item) => {
        if (isPlayerControllable() && checkItemPickup(player.x, player.y, item.x, item.y)) {
          collectItem(item.type);
          itemPool.release(item);
        }
      });

      // Check for extend
      checkExtend();

      return null;
    },

    render(renderer: Renderer, alpha: number): void {
      if (!assets) return;

      // Interpolate player position
      const renderX = player.prevX + (player.x - player.prevX) * alpha;
      const renderY = player.prevY + (player.y - player.prevY) * alpha;

      // Space shows through once the tiles have faded
      renderer.clear('#070b14');

      const ctx = renderer.getContext();
      let shakeX = 0;
      let shakeY = 0;
      if (shakeLeft > 0 && shakeDur > 0) {
        const amp = shakeMag * (shakeLeft / shakeDur);
        shakeX = Math.round(Math.sin(gameTime * 70) * amp);
        shakeY = Math.round(Math.cos(gameTime * 53) * amp);
      }
      ctx.save();
      if (shakeX !== 0 || shakeY !== 0) ctx.translate(shakeX, shakeY);
      if (weaponTest()) {
        ctx.fillStyle = PALETTE[COLOR.SHADOW];
        ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
        ctx.fillStyle = PALETTE[COLOR.ENEMY_BRIGHT_RED];
        ctx.fillRect(
          WEAPON_TEST_TARGET.x,
          WEAPON_TEST_TARGET.y,
          WEAPON_TEST_TARGET.w,
          WEAPON_TEST_TARGET.h
        );
        ctx.strokeStyle = PALETTE[COLOR.WHITE];
        ctx.lineWidth = 1;
        ctx.strokeRect(
          WEAPON_TEST_TARGET.x + 0.5,
          WEAPON_TEST_TARGET.y + 0.5,
          WEAPON_TEST_TARGET.w - 1,
          WEAPON_TEST_TARGET.h - 1
        );
      } else {
        drawBackground(ctx, assets.background, scrollFrame, gameTime);
      }

      // Buildings sit on the tiles: no interpolation, so they never slip off the grid
      buildingPool.forEach((b) => {
        const sheet = assets!.buildings.byType[b.type];
        const frame = b.wrecked ? sheet.wreck : b.hitFlashTimer > 0 ? sheet.hitFlash : sheet.idle;
        ctx.globalAlpha = scrollFrame.fade[b.section];
        renderer.drawImage(frame.canvas, b.x - frame.anchorX, b.y - frame.anchorY);
        if (b.type === 'sea_gun' && !b.wrecked) {
          drawGunBarrel(ctx, b.x + SEA_GUN_PIVOT.x, b.y + SEA_GUN_PIVOT.y, b.aimAngle, true);
        }
      });
      ctx.globalAlpha = 1;

      // Draw items
      itemPool.forEach((item) => {
        const ix = item.prevX + (item.x - item.prevX) * alpha;
        const iy = item.prevY + (item.y - item.prevY) * alpha;
        const sprite = assets!.items.byType[item.type];
        const frame = isItemFlashing(item) ? sprite.flash : sprite.idle;
        renderer.drawImage(frame.canvas, ix - frame.anchorX, iy - frame.anchorY);
      });

      // Ground units first so aircraft draw over the road
      const drawEnemy = (enemy: Enemy) => {
        const ex = enemy.prevX + (enemy.x - enemy.prevX) * alpha;
        const ey = enemy.prevY + (enemy.y - enemy.prevY) * alpha;
        const sheet = assets!.enemies.byType[enemy.type];
        const frame = enemy.hitFlashTimer > 0 ? sheet.hitFlash : sheet.idle;

        for (const nozzle of sheet.nozzles) {
          drawEnemyFlame(ctx, ex + nozzle.x, ey + nozzle.y, gameTime);
        }

        if (enemy.type === 'drone') {
          ctx.save();
          ctx.translate(ex, ey);
          ctx.rotate(enemy.moveTimer * 2.4);
          ctx.drawImage(frame.canvas, -frame.anchorX, -frame.anchorY);
          ctx.restore();
        } else {
          renderer.drawImage(frame.canvas, ex - frame.anchorX, ey - frame.anchorY);
        }

        if (enemy.type === 'tank' || enemy.type === 'turret2') {
          drawGunBarrel(ctx, ex, ey, enemy.aimAngle, enemy.type === 'turret2');
        }
      };
      enemyPool.forEach((enemy) => {
        if (isGroundEnemy(enemy.type)) drawEnemy(enemy);
      });
      enemyPool.forEach((enemy) => {
        if (!isGroundEnemy(enemy.type)) drawEnemy(enemy);
      });

      if (boss && assets.boss) {
        drawBossWorld(ctx, renderer, boss, assets.boss, gameTime);
      }

      const warningWindow = gameTime >= stage1.warningAt && gameTime < stage1.boss.enterAt;
      const bulletFade = warningWindow ? warningBulletAlpha(gameTime, stage1.warningAt) : 1;
      ctx.globalAlpha = bulletFade;
      enemyBulletPool.forEach((bullet) => {
        const bx = bullet.prevX + (bullet.x - bullet.prevX) * alpha;
        const by = bullet.prevY + (bullet.y - bullet.prevY) * alpha;

        if (bullet.type === 'missile') {
          const frame = assets!.bullets.missile;
          const ang = Math.atan2(bullet.vy, bullet.vx) + Math.PI / 2;
          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(ang);
          ctx.drawImage(frame.canvas, -frame.anchorX, -frame.anchorY);
          ctx.restore();
          return;
        }

        drawBulletGlow(ctx, bx, by, bullet.type === 'large' ? 12 : 8, BULLET_GLOW_COLORS.enemy);
        const frame =
          bullet.type === 'large'
            ? assets!.bullets.enemyBulletLarge
            : assets!.bullets.enemyBulletSmall;
        renderer.drawImage(frame.canvas, bx - frame.anchorX, by - frame.anchorY);
      });
      ctx.globalAlpha = 1;

      if (boss) drawBossLaser(ctx, boss, bossCfg, gameTime);

      // Draw player bullets with glow
      bulletPool.forEach((bullet) => {
        const bx = bullet.prevX + (bullet.x - bullet.prevX) * alpha;
        const by = bullet.prevY + (bullet.y - bullet.prevY) * alpha;

        drawBulletGlow(ctx, bx, by, 8, BULLET_GLOW_COLORS.player);
        const frame = assets!.bullets.playerBullet;
        renderer.drawImage(frame.canvas, bx - frame.anchorX, by - frame.anchorY);
      });

      missilePool.forEach((m) => {
        const mx = m.prevX + (m.x - m.prevX) * alpha;
        const my = m.prevY + (m.y - m.prevY) * alpha;
        drawHomingExhaust(
          ctx,
          mx,
          my,
          m.angle,
          m.trailX,
          m.trailY,
          m.trailHead,
          m.trailCount,
          gameTime
        );
        const frame = assets!.bullets.homingMissile;
        ctx.save();
        ctx.translate(Math.round(mx), Math.round(my));
        ctx.rotate(m.angle + Math.PI / 2);
        ctx.drawImage(frame.canvas, -frame.anchorX, -frame.anchorY);
        ctx.restore();
      });

      // Draw player: never while dead, so no wreck lingers at the death point
      if (!state.isDead) {
        let playerAlpha = 1;
        if (state.respawnInvincible > 0) {
          const blinkInterval =
            state.respawnInvincible < 0.5 ? INVINCIBLE_BLINK_FAST : INVINCIBLE_BLINK_INTERVAL;
          const blinkPhase = Math.floor(gameTime / blinkInterval) % 2;
          playerAlpha = blinkPhase === 0 ? INVINCIBLE_ALPHA_MAX : INVINCIBLE_ALPHA_MIN;
        }

        const bankFrame = assets.player.bankFrames[player.lastBankFrame]!;
        ctx.globalAlpha = playerAlpha;
        drawPlayerFlames(ctx, renderX, renderY, bankFrame.nozzles, player.velocityY, gameTime);
        renderer.drawImage(
          bankFrame.canvas,
          renderX - bankFrame.anchorX,
          renderY - bankFrame.anchorY
        );
        ctx.globalAlpha = 1;

        // Shield during bomb invincibility
        if (state.bombInvincible > 0) {
          renderer.strokeCircle(renderX, renderY, 20, 'rgba(0, 229, 255, 0.5)', 2);
        }

        // Hitbox: drawn solid (not blinking) whenever the ship exists.
        // White = can be hit, cyan = shown but currently immune.
        if (SHOW_HITBOX) {
          const immune = !isPlayerVulnerable();
          const fill = immune ? 'rgba(0, 229, 255, 0.35)' : `rgba(255, 255, 255, ${HITBOX_ALPHA})`;
          const ring = immune ? 'rgba(0, 229, 255, 0.9)' : 'rgba(255, 255, 255, 0.9)';
          renderer.fillCircle(renderX, renderY, HITBOX_RADIUS, fill);
          renderer.strokeCircle(renderX, renderY, HITBOX_RADIUS + 1, ring, 1);
        }
      }

      // Hit sparks, then the size-matched explosion frames (native pixels, no scale-up).
      const sparks = assets.explosions?.hitSpark;
      if (sparks) {
        for (const spark of sparkPool) {
          if (!spark.active || spark.frame >= sparks.length) continue;
          const frame = sparks[spark.frame]!;
          renderer.drawImage(frame.canvas, spark.x - frame.anchorX, spark.y - frame.anchorY);
        }
      }
      for (const exp of explosionPool) {
        const frames = assets.explosions?.[explosionDrawKey(exp.kind)];
        if (!exp.active || exp.delay > 0 || !frames || exp.frame >= frames.length) continue;
        const frame = frames[exp.frame]!;
        renderer.drawImage(frame.canvas, exp.x - frame.anchorX, exp.y - frame.anchorY);
      }

      if (bombWave.active) {
        const u = bombWave.t / BOMB_WAVE_TIME;
        const fade = u < 0.7 ? 1 : Math.max(0, (1 - u) / 0.3);
        const radius = bombWaveRadius(bombWave.x, bombWave.y, bombWave.t);
        drawBombShockwave(ctx, bombWave.x, bombWave.y, radius, fade);
      }

      ctx.restore();

      if (demo()) return;

      if (state.bombFlashTimer > 0) {
        const flashAlpha = state.bombFlashTimer / BOMB_FLASH_TIME;
        renderer.fillRect(0, 0, LOGICAL_W, LOGICAL_H, `rgba(255, 255, 255, ${flashAlpha * 0.35})`);
      }

      if (weaponTest()) {
        drawWeaponTestHud(ctx);
      } else {
        // ========================================
        // HUD
        // ========================================
        const hudY = 4;

        // Score
        renderer.fillText(`SCORE: ${state.score.toString().padStart(8, '0')}`, 8, hudY, '#fff', 10);

        // Lives (plane icons)
        const livesText = 'x' + state.lives;
        renderer.fillText('♦', LOGICAL_W - 90, hudY, PALETTE[COLOR.PLAYER_CYAN], 10);
        renderer.fillText(livesText, LOGICAL_W - 80, hudY, '#fff', 10);

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
        renderer.fillText(
          `Lv${state.main.level}`,
          mainX + mainIcon.width + 2,
          iconY + 4,
          '#fff',
          10
        );
        const subX = mainX - 40;
        if (state.sub) {
          const subIcon = assets.items.byType[WEAPONS[state.sub.id].item].idle;
          renderer.drawImage(subIcon.canvas, subX, iconY);
          renderer.fillText(
            `Lv${state.sub.level}`,
            subX + subIcon.width + 2,
            iconY + 4,
            '#fff',
            10
          );
        } else {
          renderer.fillText('SUB -', subX, iconY + 4, '#666', 10);
        }

        const intro = boss ? null : introBanner(gameTime);
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

        const barIntro = bossIntroBarFill(gameTime, stage1.warningAt, stage1.boss.enterAt);
        const phase3Hp = bossUsesPhase3(runDifficulty()) ? (stage1.boss.phase3?.hp ?? 0) : 0;
        const partsHp = stage1.boss.parts.reduce((sum, part) => sum + part.hp, 0);
        let barLayout: BossHpBarLayout | null = null;
        if (barIntro !== null) {
          barLayout = bossIntroBarLayout(barIntro, phase3Hp / Math.max(1, partsHp + phase3Hp));
        } else if (boss && boss.phase !== 'clear' && boss.phase !== 'done') {
          barLayout = bossHpBarLayout(boss);
        }
        if (barLayout) drawBossHpBar(ctx, barLayout, 48, 32, 264, 8);

        if (
          !state.gameOver &&
          gameTime >= stage1.warningAt + WARNING_BANNER_DELAY &&
          gameTime < stage1.boss.enterAt
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

      // On-screen controls and pause button
      const controlsView = sceneCtx.input.getControlsView();
      if (!pauseMenu.isOpen()) {
        drawControls(ctx, controlsView, {
          bDisabled: state.bombs <= 0 || state.bombCooldown > 0,
        });
      }
      drawPauseButton(ctx, controlsView.layout.pauseButton, controlsView.settings.controlOpacity);

      // Pause menu overlay
      pauseMenu.render(ctx, controlsView, { stage: 1, score: state.score });

      if (boss?.phase === 'clear' && victory.phase === 'wait') {
        renderer.fillText('STAGE CLEAR', LOGICAL_W / 2 - 66, 72, '#7dff9a', 18);
      }
    },

    grantItem(type: ItemType): void {
      collectItem(type);
    },

    getBattleView(): BattleView {
      const enemies: { x: number; y: number }[] = [];
      enemyPool.forEach((enemy) => {
        enemies.push({ x: enemy.x, y: enemy.y });
      });
      const bullets: { x: number; y: number; vx: number; vy: number }[] = [];
      enemyBulletPool.forEach((bullet) => {
        bullets.push({ x: bullet.x, y: bullet.y, vx: bullet.vx, vy: bullet.vy });
      });
      return { player: { x: player.x, y: player.y }, enemies, bullets };
    },

    getWeaponTestStats(): WeaponTestStats | null {
      return weaponTest() ? weaponTestStats() : null;
    },

    applyTestDeath(): boolean {
      if (!weaponTest() || !isPlayerVulnerable()) return false;
      killPlayer();
      return true;
    },

    getDebugInfo(): GameDebugInfo {
      const info: GameDebugInfo = {
        bombs: state.bombs,
        bombCooldown: state.bombCooldown,
        bulletCount: bulletPool.getActiveCount(),
        fireHeld,
        bombPressed,
        enemyCount: enemyPool.getActiveCount(),
        enemyBulletCount: enemyBulletPool.getActiveCount(),
        score: state.score,
        power: state.main.level,
        mainWeapon: state.main.id,
        subWeapon: state.sub?.id ?? null,
        subLevel: state.sub?.level ?? 0,
        missileCount: missilePool.getActiveCount(),
        lives: state.lives,
        paused: pauseMenu.isOpen(),
        gameTime,
        playerDead: state.isDead,
        activeExplosions: explosionPool.reduce((n, exp) => n + (exp.active ? 1 : 0), 0),
        waveSpawned: waveScheduler?.getDebugInfo().spawned ?? 0,
        buildingCount: buildingPool.getActiveCount(),
        buildingDrop: chooseBuildingDrop(state.sub),
      };
      if (boss) {
        info.bossPhase = boss.phase;
        info.bossPhase3 = boss.phase3Armed;
        info.bossMaxHp = boss.fightMax;
      }
      return info;
    },
  };
}
