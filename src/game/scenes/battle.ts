/**
 * Battle scene — stage 1 through the orbital boss.
 * Warning clears the lane, the battleship fights, then STAGE CLEAR hands off
 * to the result scene. F2 / F3 (debug on) jump to the warning or the boss.
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
  FIRE_RATE,
  PLAYER_BULLET_SPEED,
  PLAYER_BULLET_DAMAGE,
  BOMBS_START,
  BOMBS_MAX,
  BOMBS_ON_RESPAWN,
  BOMB_COOLDOWN,
  BOMB_INVINCIBLE_TIME,
  BOMB_DAMAGE,
  BOMB_BULLET_SCORE,
  LIVES_START,
  LIVES_MAX,
  POWER_MAX,
  LV2_GAP,
  LV3_SPREAD_DEG,
  DEATH_POWER_LOSS,
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
  P_OVERFLOW_SCORE,
  B_OVERFLOW_SCORE,
  ENEMY_BULLET_CAP,
  BANK_IN_TIME,
  BANK_OUT_TIME,
  BANK_DEADZONE,
  BANK_HYSTERESIS,
  WARNING_BANNER_DELAY,
  SHAKE_BIG_INTENSITY,
  SHAKE_BIG_DURATION,
} from '@/game/config';
import { getStageGrids } from '@/game/art/tiles';
import { PALETTE, COLOR } from '@/game/palette';
import { stage1 } from '@/game/levels/stage1';

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
} from '@/game/art';

// Entities
import { createBullet, type Bullet } from '@/game/entities/bullet';
import {
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
import { createItem, spawnItem, updateItem, isItemFlashing, type Item } from '@/game/entities/item';
import {
  BuildingScheduler,
  buildingBlocksTank,
  buildingOnScreen,
  bulletHitsBuilding,
  createBuilding,
  damageBuilding,
  rollBuildingDrop,
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
import { updateEnemyWeapons } from '@/game/systems/weapons';
import { getAudioSystem } from '@/game/systems/audio';
import {
  applyBossBomb,
  bossHitsPlayer,
  bossHpRemaining,
  bossIntroBarFill,
  bossLaserHits,
  bossTotalHp,
  createBoss,
  resolveBossBullet,
  updateBoss,
  type BossEvents,
  type BossRuntime,
} from '@/game/systems/boss';
import { introBanner, type RunReport } from '@/game/systems/score';
import {
  Scroller,
  warningBulletAlpha,
  backgroundFade,
  type ScrollFrame,
} from '@/game/systems/background';

// Explosion FX
interface Explosion {
  active: boolean;
  x: number;
  y: number;
  frame: number;
  timer: number;
  frameTime: number;
  frameCount: number;
  delay: number;
  scale: number;
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
    frameTime: 0.06,
    frameCount: 4,
    delay: 0,
    scale: 1,
  };
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

// Game state
interface GameState {
  lives: number;
  bombs: number;
  score: number;
  power: number;
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
    power: 1,
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
  const enemyPool = new ObjectPool(createEnemy, 64);
  const enemyBulletPool = new ObjectPool(createEnemyBullet, 200);
  const itemPool = new ObjectPool(createItem, 10);
  const buildingPool = new ObjectPool(createBuilding, 16);
  const buildingScheduler = new BuildingScheduler(stage1.buildings, stage1.warningAt);
  const explosionPool: Explosion[] = [];
  for (let i = 0; i < 32; i++) {
    explosionPool.push(createExplosion());
  }

  let boss: BossRuntime | null = null;
  let warningPlayed = false;
  let finishedAt: number | null = null;
  let shakeLeft = 0;
  let shakeMag = 0;
  let shakeDur = 0;

  // Wave scheduler — full stage, not the MVP subset
  let waveScheduler: WaveScheduler | null = null;

  // Timers
  const shotInterval = 1 / FIRE_RATE;
  let timeSinceLastShot = shotInterval;
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
  function sfx(id: Parameters<typeof audio.play>[0]): void {
    if (demo()) return;
    audio.play(id);
  }

  const pauseMenu = createPauseMenu(sceneCtx.settings);

  // Helper to spawn explosion
  function spawnExplosion(x: number, y: number, delay = 0, scale = 1): void {
    for (const exp of explosionPool) {
      if (!exp.active) {
        exp.active = true;
        exp.x = x;
        exp.y = y;
        exp.frame = 0;
        exp.timer = 0;
        exp.delay = delay;
        exp.scale = scale;
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
      spawnExplosion(boom.x, boom.y, boom.delay, boom.scale);
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
  function jumpTo(time: number): void {
    gameTime = time;
    waveScheduler?.reset();
    waveScheduler?.setPowerLevel(state.power);
    waveScheduler?.seek(time);
    bulletPool.releaseAll();
    enemyPool.releaseAll();
    enemyBulletPool.releaseAll();
    itemPool.releaseAll();
    buildingPool.releaseAll();
    buildingScheduler.reset();
    explosionPool.forEach((exp) => {
      exp.active = false;
    });
    boss = time >= stage1.boss.enterAt ? createBoss(stage1.boss) : null;
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
    spawnExplosion(enemy.x, enemy.y);
    if (enemy.type === 'bomber') {
      spawnExplosion(enemy.x - 16, enemy.y - 6, 0.06);
      spawnExplosion(enemy.x + 14, enemy.y + 8, 0.12);
    } else if (enemy.type === 'medium' || enemy.type === 'turret2') {
      spawnExplosion(enemy.x + 8, enemy.y - 4, 0.05);
    }
  }

  function destroyBuilding(b: Building): void {
    state.score += b.score;
    spawnExplosion(b.x, b.y);
    spawnExplosion(b.x - b.width / 4, b.y + 4, 0.06);
    spawnExplosion(b.x + b.width / 4, b.y - 4, 0.12);
    sfx('enemyExplode');
    const drop = rollBuildingDrop();
    if (drop) spawnItem(itemPool.acquire(), drop, b.x, b.y);
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

  // Fire player bullets based on power level
  function firePlayerBullets(): void {
    const power = state.power;
    const bulletY = player.y - 16;

    if (power === 1) {
      // Single center shot
      const bullet = bulletPool.acquire();
      bullet.x = player.x;
      bullet.y = bulletY;
      bullet.prevX = player.x;
      bullet.prevY = bulletY;
    } else if (power === 2) {
      // Twin shots
      const gap = LV2_GAP / 2;
      for (const offsetX of [-gap, gap]) {
        const bullet = bulletPool.acquire();
        bullet.x = player.x + offsetX;
        bullet.y = bulletY;
        bullet.prevX = player.x + offsetX;
        bullet.prevY = bulletY;
      }
    } else {
      // Triple spread
      const angleRad = (LV3_SPREAD_DEG * Math.PI) / 180;
      // Center
      const center = bulletPool.acquire();
      center.x = player.x;
      center.y = bulletY;
      center.prevX = player.x;
      center.prevY = bulletY;
      // Left spread
      const left = bulletPool.acquire();
      left.x = player.x - 4;
      left.y = bulletY;
      left.prevX = player.x - 4;
      left.prevY = bulletY;
      left.vx = -Math.sin(angleRad) * PLAYER_BULLET_SPEED;
      left.vy = -Math.cos(angleRad) * PLAYER_BULLET_SPEED;
      // Right spread
      const right = bulletPool.acquire();
      right.x = player.x + 4;
      right.y = bulletY;
      right.prevX = player.x + 4;
      right.prevY = bulletY;
      right.vx = Math.sin(angleRad) * PLAYER_BULLET_SPEED;
      right.vy = -Math.cos(angleRad) * PLAYER_BULLET_SPEED;
    }

    sfx('shoot');
  }

  // Handle player death
  function killPlayer(): void {
    if (!isPlayerVulnerable()) return;

    state.isDead = true;
    state.lives--;
    state.deaths++;
    state.power = Math.max(1, state.power - DEATH_POWER_LOSS);
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
      spawnExplosion(player.x + dx, player.y + dy, delay);
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
    return !state.isDead && !state.isFlying;
  }

  function isPlayerVulnerable(): boolean {
    return isVulnerable(state);
  }

  // Handle bomb activation
  function activateBomb(): void {
    if (state.bombs <= 0 || state.bombCooldown > 0) return;

    state.bombs--;
    state.bombCooldown = BOMB_COOLDOWN;
    state.bombInvincible = BOMB_INVINCIBLE_TIME;
    state.bombFlashTimer = 0.15;

    // Clear all enemy bullets for score
    let bulletsCleared = 0;
    enemyBulletPool.forEach(() => bulletsCleared++);
    state.score += bulletsCleared * BOMB_BULLET_SCORE;
    enemyBulletPool.releaseAll();

    // Damage all enemies
    enemyPool.forEach((enemy) => {
      const killed = damageEnemy(enemy, BOMB_DAMAGE);
      if (killed) {
        state.score += enemy.score;
        spawnKillExplosion(enemy);
        waveScheduler?.recordKill();
        if (enemy.drop) {
          const item = itemPool.acquire();
          spawnItem(item, enemy.drop, enemy.x, enemy.y);
        }
      }
    });

    buildingPool.forEach((b) => {
      if (buildingOnScreen(b) && damageBuilding(b, BOMB_DAMAGE)) destroyBuilding(b);
    });

    if (boss) applyBossEvents(applyBossBomb(boss, stage1.boss));
    triggerShake(SHAKE_BIG_INTENSITY, SHAKE_BIG_DURATION);
    sfx('bomb');
  }

  // Handle item collection
  function collectItem(item: Item): void {
    if (item.type === 'P') {
      if (state.power < POWER_MAX) {
        state.power++;
        sfx('powerUp');
      } else {
        state.score += P_OVERFLOW_SCORE;
        sfx('itemPickup');
      }
    } else {
      if (state.bombs < BOMBS_MAX) {
        state.bombs++;
        sfx('itemPickup');
      } else {
        state.score += B_OVERFLOW_SCORE;
        sfx('itemPickup');
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

    // Handle shooting
    timeSinceLastShot += dt;
    if (fireHeld) {
      while (timeSinceLastShot >= shotInterval) {
        firePlayerBullets();
        timeSinceLastShot -= shotInterval;
      }
    } else if (timeSinceLastShot > shotInterval) {
      timeSinceLastShot = shotInterval;
    }

    if (bombPressed) {
      activateBomb();
    }
  }

  function openPause(): void {
    pauseMenu.open();
    sceneCtx.input.setControlsEnabled(false);
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
      state.power = 1;
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
      enemyPool.releaseAll();
      enemyBulletPool.releaseAll();
      itemPool.releaseAll();
      buildingPool.releaseAll();
      buildingScheduler.reset();
      explosionPool.forEach((e) => (e.active = false));

      // Full wave table, including ground units and the conditional relief ship
      waveScheduler = new WaveScheduler({ mvpOnly: false });

      // Reset timers
      timeSinceLastShot = shotInterval;
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
      warningPlayed = false;
      finishedAt = null;
      shakeLeft = 0;
      shakeMag = 0;
      shakeDur = 0;

      // Boss practice: Lv3, the normal bomb and life loadout, clock at 2:35.
      // seek() drops every wave that already passed, so those ships never
      // enter and do not count toward the kill-rate denominator.
      if (sceneCtx.battleEntry === 'boss') {
        state.power = POWER_MAX;
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
      bulletPool.releaseAll();
      enemyPool.releaseAll();
      enemyBulletPool.releaseAll();
      itemPool.releaseAll();
      buildingPool.releaseAll();
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
        if (action === 'exit') return 'title';
        return null;
      }

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

      if (sceneCtx.showDebug && (input.debugWarning || input.debugBoss)) {
        jumpTo(input.debugBoss ? stage1.boss.enterAt : stage1.warningAt);
        return null;
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
      } else if (state.isFlying) {
        player.y -= ((LOGICAL_H + 40 - PLAYER_SPAWN_Y) / RESPAWN_FLYIN_TIME) * dt;
        if (player.y <= PLAYER_SPAWN_Y) {
          player.y = PLAYER_SPAWN_Y;
          state.isFlying = false;
        }
      } else {
        updatePlayerControl(dt, input);
      }

      scrollFrame = scroller.update(dt, gameTime, stage1.warningAt);

      const pastWarning = gameTime >= stage1.warningAt;
      const warningWindow = pastWarning && gameTime < stage1.boss.enterAt;
      if (
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

      // Update wave scheduler
      if (waveScheduler) {
        waveScheduler.setPowerLevel(state.power);
        const spawns = waveScheduler.update(dt);

        if (!pastWarning) {
          for (const spawn of spawns) {
            const enemy = enemyPool.acquire();
            spawnEnemy(
              enemy,
              spawn.type,
              spawn.x,
              spawn.y,
              spawn.move,
              spawn.canFire ? spawn.fire : { kind: 'none' },
              spawn.drop,
              spawn.hp,
              spawn.score
            );
          }
        }
      }

      if (!boss && gameTime >= stage1.boss.enterAt) {
        boss = createBoss(stage1.boss);
      }

      // Buildings ride the tile map. Footprints are checked against the real grid on spawn.
      for (const placement of buildingScheduler.update(scrollFrame.scroll, gameTime)) {
        if (!validateBuildingFootprint(getStageGrids(), placement)) continue;
        spawnBuilding(buildingPool.acquire(), placement, scrollFrame.scroll);
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
        } else {
          updateEnemyWeapons(enemy, dt, player.x, player.y, bulletSpawner, !pastWarning);
        }
      });
      enemiesToRelease.forEach((e) => enemyPool.release(e));

      if (boss && boss.phase !== 'done') {
        const ev = updateBoss(boss, dt, stage1.boss);
        applyBossEvents(ev);
        if (boss.phase === 'clear' && finishedAt === null) finishedAt = gameTime;
        if (ev.enterResult) {
          publishRun('clear');
          return 'result';
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

      // Update explosions
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

      // ========================================
      // COLLISION DETECTION
      // ========================================

      // Player bullets vs the battleship, then the rest of the lane
      bulletPool.forEach((bullet) => {
        if (boss) {
          const hit = resolveBossBullet(
            boss,
            { x: bullet.x, y: bullet.y, w: bullet.width, h: bullet.height },
            PLAYER_BULLET_DAMAGE,
            stage1.boss
          );
          if (hit.consumedBullet) {
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
            const killed = damageEnemy(enemy, PLAYER_BULLET_DAMAGE);
            bulletPool.release(bullet);

            if (killed) {
              state.score += enemy.score;
              spawnKillExplosion(enemy);
              waveScheduler?.recordKill();
              sfx('enemyExplode');

              // Drop item if carrying
              if (enemy.drop) {
                const item = itemPool.acquire();
                spawnItem(item, enemy.drop, enemy.x, enemy.y);
              }

              enemyPool.release(enemy);
            } else {
              sfx('enemyHit');
            }
          }
        });

        if (!bullet.active) return;
        buildingPool.forEach((b) => {
          if (!bullet.active) return;
          if (!bulletHitsBuilding(b, bullet.x, bullet.y, bullet.width, bullet.height)) return;
          bulletPool.release(bullet);
          if (damageBuilding(b, PLAYER_BULLET_DAMAGE)) destroyBuilding(b);
          else sfx('enemyHit');
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
      if (isPlayerVulnerable() && boss && bossLaserHits(boss, stage1.boss, player.x, player.y)) {
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
          collectItem(item);
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
      drawBackground(ctx, assets.background, scrollFrame, gameTime);

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
        const frame = isItemFlashing(item)
          ? item.type === 'P'
            ? assets!.items.powerUpFlash
            : assets!.items.bombFlash
          : item.type === 'P'
            ? assets!.items.powerUp
            : assets!.items.bomb;
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

      if (boss) drawBossLaser(ctx, boss, stage1.boss, gameTime);

      // Draw player bullets with glow
      bulletPool.forEach((bullet) => {
        const bx = bullet.prevX + (bullet.x - bullet.prevX) * alpha;
        const by = bullet.prevY + (bullet.y - bullet.prevY) * alpha;

        drawBulletGlow(ctx, bx, by, 8, BULLET_GLOW_COLORS.player);
        const frame = assets!.bullets.playerBullet;
        renderer.drawImage(frame.canvas, bx - frame.anchorX, by - frame.anchorY);
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

      // Draw explosions
      for (const exp of explosionPool) {
        if (exp.active && exp.delay <= 0 && exp.frame < assets.explosions.smallExplosion.length) {
          const frame = assets.explosions.smallExplosion[exp.frame]!;
          const scale = exp.scale;
          renderer.drawImage(
            frame.canvas,
            exp.x - frame.anchorX * scale,
            exp.y - frame.anchorY * scale,
            frame.width * scale,
            frame.height * scale
          );
        }
      }

      ctx.restore();

      if (demo()) return;

      if (state.bombFlashTimer > 0) {
        const flashAlpha = state.bombFlashTimer / 0.15;
        renderer.fillRect(0, 0, LOGICAL_W, LOGICAL_H, `rgba(255, 255, 255, ${flashAlpha * 0.35})`);
      }

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
      const bombIcon = assets.items.bomb;
      const bombStep = bombIcon.width + 1;
      for (let i = 0; i < BOMBS_MAX; i++) {
        ctx.globalAlpha = i < state.bombs ? 1 : 0.4;
        renderer.drawImage(bombIcon.canvas, 6 + i * bombStep, iconY);
      }
      ctx.globalAlpha = 1;

      // Power level uses the missile-energy icon (same sprite as the P pickup).
      const missileIcon = assets.items.powerUp;
      const missileX = LOGICAL_W - missileIcon.width - 32;
      renderer.drawImage(missileIcon.canvas, missileX, iconY);
      renderer.fillText(
        `Lv${state.power}`,
        missileX + missileIcon.width + 2,
        iconY + 4,
        '#fff',
        10
      );

      // Wave info (debug). F2 jumps to the warning, F3 to the boss.
      if (sceneCtx.showDebug && waveScheduler) {
        const waveInfo = waveScheduler.getDebugInfo();
        renderer.fillText(`Wave: ${waveInfo.waveId}`, 8, hudY + 46, '#888', 8);
        renderer.fillText(
          `Time: ${gameTime.toFixed(1)}s  ${boss ? boss.phase : ''}`,
          8,
          hudY + 56,
          '#888',
          8
        );
        renderer.fillText('F2 warning  F3 boss', 8, hudY + 66, '#666', 8);
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
      let barFill: number | null = barIntro;
      if (barFill === null && boss && boss.phase !== 'clear' && boss.phase !== 'done') {
        barFill = bossHpRemaining(boss) / Math.max(1, bossTotalHp(stage1.boss));
      }
      if (barFill !== null) drawBossHpBar(ctx, barFill, 48, 32, 264, 8);

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

      if (boss?.phase === 'clear') {
        renderer.fillRect(0, 0, LOGICAL_W, LOGICAL_H, 'rgba(0, 0, 0, 0.55)');
        renderer.fillText('STAGE CLEAR', LOGICAL_W / 2 - 66, LOGICAL_H / 2 - 16, '#7dff9a', 18);
      }
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
        power: state.power,
        lives: state.lives,
        paused: pauseMenu.isOpen(),
        gameTime,
        playerDead: state.isDead,
        activeExplosions: explosionPool.reduce((n, exp) => n + (exp.active ? 1 : 0), 0),
        waveSpawned: waveScheduler?.getDebugInfo().spawned ?? 0,
        buildingCount: buildingPool.getActiveCount(),
      };
      if (boss) info.bossPhase = boss.phase;
      return info;
    },
  };
}
