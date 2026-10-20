/**
 * Battle scene - P1 Playable MVP
 * Full gameplay with enemies, items, collision, scoring
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
  BG_SCROLL_SPEED,
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
} from '@/game/config';
import { PALETTE, COLOR } from '@/game/palette';

// Art assets
import {
  createGameAssets,
  type GameAssets,
  getBankFrameIndex,
  drawPlayerFlames,
  drawEnemyFlame,
  drawBulletGlow,
  BULLET_GLOW_COLORS,
} from '@/game/art';

// Entities
import { createBullet, type Bullet } from '@/game/entities/bullet';
import {
  createEnemy,
  spawnEnemy,
  updateEnemy,
  damageEnemy,
  shouldEnemyFire,
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
import { getAudioSystem } from '@/game/systems/audio';

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
  stageClear: boolean;
  nextExtendScore: number;
}

export function createBattleScene(sceneCtx: SceneContext): Scene {
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
    stageClear: false,
    nextExtendScore: EXTEND_EVERY,
  };

  // Object pools
  const bulletPool = new ObjectPool(createBullet, 100);
  const enemyPool = new ObjectPool(createEnemy, 50);
  const enemyBulletPool = new ObjectPool(createEnemyBullet, 200);
  const itemPool = new ObjectPool(createItem, 10);
  const explosionPool: Explosion[] = [];
  for (let i = 0; i < 20; i++) {
    explosionPool.push(createExplosion());
  }

  // Wave scheduler
  let waveScheduler: WaveScheduler | null = null;

  // Timers
  const shotInterval = 1 / FIRE_RATE;
  let timeSinceLastShot = shotInterval;
  let bgOffset = 0;
  let gameTime = 0;

  // Input tracking
  let fireHeld = false;
  let bombPressed = false;
  let lastBombInput = false;

  // Audio
  const audio = getAudioSystem();

  const pauseMenu = createPauseMenu(sceneCtx.settings);

  // Helper to spawn explosion
  function spawnExplosion(x: number, y: number, delay = 0): void {
    for (const exp of explosionPool) {
      if (!exp.active) {
        exp.active = true;
        exp.x = x;
        exp.y = y;
        exp.frame = 0;
        exp.timer = 0;
        exp.delay = delay;
        return;
      }
    }
  }

  // Bullet spawner for enemy fire patterns
  const bulletSpawner: BulletSpawner = {
    spawnBullet(x, y, vx, vy, type) {
      if (enemyBulletPool.getActiveCount() < ENEMY_BULLET_CAP) {
        const bullet = enemyBulletPool.acquire();
        spawnEnemyBullet(bullet, x, y, vx, vy, type);
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

    audio.play('shoot');
  }

  // Handle player death
  function killPlayer(): void {
    if (!isPlayerVulnerable()) return;

    state.isDead = true;
    state.lives--;
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
    audio.play('playerExplode');
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
        spawnExplosion(enemy.x, enemy.y);
        waveScheduler?.recordKill();
        if (enemy.drop) {
          const item = itemPool.acquire();
          spawnItem(item, enemy.drop, enemy.x, enemy.y);
        }
      }
    });

    audio.play('bomb');
  }

  // Handle item collection
  function collectItem(item: Item): void {
    if (item.type === 'P') {
      if (state.power < POWER_MAX) {
        state.power++;
        audio.play('powerUp');
      } else {
        state.score += P_OVERFLOW_SCORE;
        audio.play('itemPickup');
      }
    } else {
      if (state.bombs < BOMBS_MAX) {
        state.bombs++;
        audio.play('itemPickup');
      } else {
        state.score += B_OVERFLOW_SCORE;
        audio.play('itemPickup');
      }
    }
  }

  // Check for extra life
  function checkExtend(): void {
    if (state.score >= state.nextExtendScore) {
      if (state.lives < LIVES_MAX) {
        state.lives++;
        audio.play('extend');
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

      // Initialize assets
      assets = createGameAssets();

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
      state.isFlying = false;
      state.gameOver = false;
      state.stageClear = false;
      state.nextExtendScore = EXTEND_EVERY;

      // Reset pools
      bulletPool.releaseAll();
      enemyPool.releaseAll();
      enemyBulletPool.releaseAll();
      itemPool.releaseAll();
      explosionPool.forEach((e) => (e.active = false));

      // Initialize wave scheduler
      waveScheduler = new WaveScheduler({ mvpOnly: true });

      // Reset timers
      timeSinceLastShot = shotInterval;
      bgOffset = 0;
      gameTime = 0;
      fireHeld = false;
      bombPressed = false;
      lastBombInput = false;

      // Initialize audio
      audio.init();
    },

    onHide(): void {
      if (!pauseMenu.isOpen() && !state.gameOver && !state.stageClear) openPause();
    },

    exit(): void {
      pauseMenu.close();
      bulletPool.releaseAll();
      enemyPool.releaseAll();
      enemyBulletPool.releaseAll();
      itemPool.releaseAll();
    },

    update(dt: number, input: InputState) {
      // Unlock audio on first input
      if (input.buttonA || input.buttonB || input.joystickMagnitude > 0.1 || input.taps.length) {
        audio.unlock();
      }

      // Paused: only the menu runs; gameplay state is frozen
      if (pauseMenu.isOpen()) {
        const action = pauseMenu.update(input);
        if (action === 'resume') sceneCtx.input.setControlsEnabled(true);
        if (action === 'exit') return 'title';
        return null;
      }

      if (!state.gameOver && !state.stageClear) {
        const pauseTapped = input.taps.some((t) =>
          inCircle(t.x, t.y, sceneCtx.input.getControlsView().layout.pauseButton, 8)
        );
        if (input.pausePressed || pauseTapped) {
          openPause();
          return null;
        }
      }

      gameTime += dt;

      // Game over or stage clear - wait for input to return to title
      if (state.gameOver || state.stageClear) {
        if (input.buttonA || input.buttonB) {
          return 'title';
        }
        return null;
      }

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
        state.respawnTimer -= dt;
        if (state.respawnTimer <= 0) {
          if (state.lives <= 0) {
            state.gameOver = true;
            return null;
          }
          spawnNewShip();
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

      // Scroll background
      bgOffset = (bgOffset + BG_SCROLL_SPEED * dt) % 32;

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

        // Check for stage clear
        if (waveScheduler.isComplete() && enemyPool.getActiveCount() === 0) {
          state.stageClear = true;
        }
      }

      // Update enemies
      const enemiesToRelease: Enemy[] = [];
      enemyPool.forEach((enemy) => {
        const shouldCull = updateEnemy(enemy, dt, player.x, player.y);
        if (shouldCull) {
          enemiesToRelease.push(enemy);
        } else {
          // Check if enemy should fire
          const fireResult = shouldEnemyFire(enemy, dt, player.x, player.y);
          if (fireResult.shouldFire) {
            executeFirePattern(
              fireResult.fireData,
              enemy.x,
              enemy.y,
              player.x,
              player.y,
              bulletSpawner
            );
          }
        }
      });
      enemiesToRelease.forEach((e) => enemyPool.release(e));

      // Update enemy bullets
      const enemyBulletsToRelease: EnemyBullet[] = [];
      enemyBulletPool.forEach((bullet) => {
        const shouldCull = updateEnemyBullet(bullet, dt);
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

      // Player bullets vs enemies
      bulletPool.forEach((bullet) => {
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
              spawnExplosion(enemy.x, enemy.y);
              waveScheduler?.recordKill();
              audio.play('enemyExplode');

              // Drop item if carrying
              if (enemy.drop) {
                const item = itemPool.acquire();
                spawnItem(item, enemy.drop, enemy.x, enemy.y);
              }

              enemyPool.release(enemy);
            } else {
              audio.play('enemyHit');
            }
          }
        });
      });

      // Enemy bullets vs player
      if (isPlayerVulnerable()) {
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

      // Enemy body vs player
      if (isPlayerVulnerable()) {
        enemyPool.forEach((enemy) => {
          // Only air enemies can collide
          if (enemy.type !== 'tank' && enemy.type !== 'turret2' && enemy.type !== 'missile_car') {
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

      // Clear with dark background
      renderer.clear('#0a0a1a');

      // Bomb flash effect
      if (state.bombFlashTimer > 0) {
        const flashAlpha = state.bombFlashTimer / 0.15;
        renderer.fillRect(0, 0, LOGICAL_W, LOGICAL_H, `rgba(255, 255, 255, ${flashAlpha * 0.6})`);
      }

      // Draw scrolling grid background
      const gridSize = 32;
      const gridColor = '#1a1a2e';
      for (let y = -gridSize + bgOffset; y < LOGICAL_H + gridSize; y += gridSize) {
        for (let x = 0; x < LOGICAL_W; x += gridSize) {
          renderer.strokeRect(x, y, gridSize, gridSize, gridColor, 1);
        }
      }

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

      // Draw enemies with flames
      enemyPool.forEach((enemy) => {
        const ex = enemy.prevX + (enemy.x - enemy.prevX) * alpha;
        const ey = enemy.prevY + (enemy.y - enemy.prevY) * alpha;

        // Draw flame
        const ctx = renderer.getContext();
        drawEnemyFlame(ctx, ex, ey - enemy.height / 2, gameTime);

        // Draw enemy sprite
        const sheet =
          enemy.type === 'medium' ? assets!.enemies.mediumFighter : assets!.enemies.smallFighter;
        const frame = enemy.hitFlashTimer > 0 ? sheet.hitFlash : sheet.idle;
        renderer.drawImage(frame.canvas, ex - frame.anchorX, ey - frame.anchorY);
      });

      // Draw enemy bullets with glow
      const ctx = renderer.getContext();
      enemyBulletPool.forEach((bullet) => {
        const bx = bullet.prevX + (bullet.x - bullet.prevX) * alpha;
        const by = bullet.prevY + (bullet.y - bullet.prevY) * alpha;

        drawBulletGlow(ctx, bx, by, bullet.type === 'large' ? 12 : 8, BULLET_GLOW_COLORS.enemy);
        const frame =
          bullet.type === 'large'
            ? assets!.bullets.enemyBulletLarge
            : assets!.bullets.enemyBulletSmall;
        renderer.drawImage(frame.canvas, bx - frame.anchorX, by - frame.anchorY);
      });

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
          renderer.drawImage(frame.canvas, exp.x - frame.anchorX, exp.y - frame.anchorY);
        }
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

      // Bombs
      const bombsText = '●'.repeat(state.bombs) + '○'.repeat(BOMBS_MAX - state.bombs);
      renderer.fillText('B:', 8, hudY + 14, '#ff0', 10);
      renderer.fillText(bombsText, 26, hudY + 14, state.bombs > 0 ? '#ff0' : '#666', 10);

      // Power level
      renderer.fillText(
        `PWR: Lv${state.power}`,
        LOGICAL_W - 60,
        hudY + 14,
        PALETTE[COLOR.PLAYER_CYAN],
        10
      );

      // Wave info (debug)
      if (sceneCtx.showDebug && waveScheduler) {
        const waveInfo = waveScheduler.getDebugInfo();
        renderer.fillText(`Wave: ${waveInfo.waveId}`, 8, hudY + 28, '#888', 8);
        renderer.fillText(`Time: ${waveInfo.time.toFixed(1)}s`, 8, hudY + 38, '#888', 8);
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

      // Game Over overlay
      if (state.gameOver) {
        renderer.fillRect(0, 0, LOGICAL_W, LOGICAL_H, 'rgba(0, 0, 0, 0.7)');
        renderer.fillText('GAME OVER', LOGICAL_W / 2 - 50, LOGICAL_H / 2 - 20, '#f00', 16);
        renderer.fillText('Press A to retry', LOGICAL_W / 2 - 55, LOGICAL_H / 2 + 20, '#fff', 12);
      }

      // Stage Clear overlay
      if (state.stageClear) {
        renderer.fillRect(0, 0, LOGICAL_W, LOGICAL_H, 'rgba(0, 0, 0, 0.5)');
        renderer.fillText('STAGE CLEAR', LOGICAL_W / 2 - 60, LOGICAL_H / 2 - 30, '#0f0', 16);
        renderer.fillText('(MVP)', LOGICAL_W / 2 - 25, LOGICAL_H / 2, '#0f0', 12);
        renderer.fillText(
          `Score: ${state.score}`,
          LOGICAL_W / 2 - 45,
          LOGICAL_H / 2 + 30,
          '#fff',
          12
        );
        renderer.fillText(
          'Press A to continue',
          LOGICAL_W / 2 - 65,
          LOGICAL_H / 2 + 60,
          '#fff',
          10
        );
      }
    },

    getDebugInfo(): GameDebugInfo {
      return {
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
      };
    },
  };
}
