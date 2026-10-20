/**
 * Battle scene - main gameplay (P0: movement test with shooting and bombs)
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
  BOMBS_START,
  BOMBS_MAX,
  BOMB_COOLDOWN,
  BOMB_INVINCIBLE_TIME,
} from '@/game/config';
import { PALETTE, COLOR } from '@/game/palette';
import { createBullet, updateBullet, spawnBullet, type Bullet } from '@/game/entities/bullet';

interface Player {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
}

interface BattleState {
  bombs: number;
  bombCooldown: number;
  bombInvincible: number;
  bombFlashTimer: number;
}

export function createBattleScene(ctx: SceneContext): Scene {
  const player: Player = {
    x: LOGICAL_W / 2,
    y: PLAYER_SPAWN_Y,
    prevX: LOGICAL_W / 2,
    prevY: PLAYER_SPAWN_Y,
  };

  const state: BattleState = {
    bombs: BOMBS_START,
    bombCooldown: 0,
    bombInvincible: 0,
    bombFlashTimer: 0,
  };

  // Bullet pool
  const bulletPool = new ObjectPool(createBullet, 50);

  // Fire timing
  const shotInterval = 1 / FIRE_RATE;
  let timeSinceLastShot = shotInterval; // Start ready to fire

  let bgOffset = 0;
  let gameTime = 0;

  // Track input state for debug display
  let fireHeld = false;
  let bombPressed = false;
  let lastBombInput = false;

  return {
    id: 'battle',

    enter(): void {
      player.x = LOGICAL_W / 2;
      player.y = PLAYER_SPAWN_Y;
      player.prevX = player.x;
      player.prevY = player.y;
      state.bombs = BOMBS_START;
      state.bombCooldown = 0;
      state.bombInvincible = 0;
      state.bombFlashTimer = 0;
      bulletPool.releaseAll();
      timeSinceLastShot = shotInterval;
      bgOffset = 0;
      gameTime = 0;
      fireHeld = false;
      bombPressed = false;
      lastBombInput = false;
    },

    exit(): void {
      bulletPool.releaseAll();
    },

    update(dt: number, input: InputState) {
      gameTime += dt;

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

      // Store previous position for interpolation
      player.prevX = player.x;
      player.prevY = player.y;

      // Move player based on input
      const speed = PLAYER_SPEED * input.joystickMagnitude;
      player.x += input.joystickX * speed * dt;
      player.y += input.joystickY * speed * dt;

      // Clamp to screen bounds (logical 360x640)
      player.x = Math.max(PLAYER_MARGIN, Math.min(LOGICAL_W - PLAYER_MARGIN, player.x));
      player.y = Math.max(PLAYER_MARGIN, Math.min(LOGICAL_H - PLAYER_MARGIN, player.y));

      // Scroll background
      bgOffset = (bgOffset + BG_SCROLL_SPEED * dt) % 32;

      // Track fire input (A button or Z/Space)
      fireHeld = input.buttonA;

      // Handle shooting
      timeSinceLastShot += dt;
      if (fireHeld) {
        while (timeSinceLastShot >= shotInterval) {
          // Spawn bullet at player position
          const bullet = bulletPool.acquire();
          spawnBullet(bullet, player.x, player.y - 16); // Spawn above player
          timeSinceLastShot -= shotInterval;
        }
      } else {
        // When not firing, keep timer ready for immediate shot on press
        if (timeSinceLastShot > shotInterval) {
          timeSinceLastShot = shotInterval;
        }
      }

      // Update bullets
      const bulletsToRelease: Bullet[] = [];
      bulletPool.forEach((bullet) => {
        const shouldCull = updateBullet(bullet, dt);
        if (shouldCull) {
          bulletsToRelease.push(bullet);
        }
      });
      for (const bullet of bulletsToRelease) {
        bulletPool.release(bullet);
      }

      // Handle bomb input (B button or X key) - trigger on press, not hold
      const bombInput = input.buttonB;
      bombPressed = bombInput && !lastBombInput; // Rising edge detection
      lastBombInput = bombInput;

      if (bombPressed && state.bombs > 0 && state.bombCooldown <= 0) {
        // Use bomb
        state.bombs--;
        state.bombCooldown = BOMB_COOLDOWN;
        state.bombInvincible = BOMB_INVINCIBLE_TIME;
        state.bombFlashTimer = 0.15; // Visual flash duration

        // Log bomb use
        // eslint-disable-next-line no-console
        console.log(`BOMB! Remaining: ${state.bombs}, Invincible for ${BOMB_INVINCIBLE_TIME}s`);
      }

      return null;
    },

    render(renderer: Renderer, alpha: number): void {
      // Interpolate player position for smooth rendering
      const renderX = player.prevX + (player.x - player.prevX) * alpha;
      const renderY = player.prevY + (player.y - player.prevY) * alpha;

      // Clear with dark background
      renderer.clear('#0a0a1a');

      // Bomb flash effect
      if (state.bombFlashTimer > 0) {
        const flashAlpha = state.bombFlashTimer / 0.15;
        renderer.fillRect(0, 0, LOGICAL_W, LOGICAL_H, `rgba(255, 255, 255, ${flashAlpha * 0.6})`);
      }

      // Draw scrolling grid background (placeholder for tile system)
      const gridSize = 32;
      const gridColor = '#1a1a2e';
      const bgY = bgOffset;

      for (let y = -gridSize + bgY; y < LOGICAL_H + gridSize; y += gridSize) {
        for (let x = 0; x < LOGICAL_W; x += gridSize) {
          renderer.strokeRect(x, y, gridSize, gridSize, gridColor, 1);
        }
      }

      // Draw bullets
      const bulletColor = PALETTE[COLOR.PLAYER_CYAN];
      bulletPool.forEach((bullet) => {
        const bx = bullet.prevX + (bullet.x - bullet.prevX) * alpha;
        const by = bullet.prevY + (bullet.y - bullet.prevY) * alpha;
        renderer.fillRect(
          bx - bullet.width / 2,
          by - bullet.height / 2,
          bullet.width,
          bullet.height,
          bulletColor
        );
      });

      // Draw player as a placeholder rectangle (28x32 sprite size)
      const playerW = 28;
      const playerH = 32;

      // Invincibility visual effect
      let playerAlpha = 1;
      if (state.bombInvincible > 0) {
        // Blinking effect during invincibility
        playerAlpha = Math.sin(gameTime * 20) > 0 ? 1 : 0.4;
      }

      const playerColor =
        playerAlpha < 1 ? `rgba(0, 229, 255, ${playerAlpha})` : PALETTE[COLOR.PLAYER_CYAN];

      renderer.fillRect(
        renderX - playerW / 2,
        renderY - playerH / 2,
        playerW,
        playerH,
        playerColor
      );

      // Draw cockpit
      const cockpitColor =
        playerAlpha < 1 ? `rgba(79, 195, 247, ${playerAlpha})` : PALETTE[COLOR.PLAYER_BLUE];
      renderer.fillRect(renderX - 4, renderY - playerH / 2 + 4, 8, 12, cockpitColor);

      // Draw shield glow during bomb invincibility
      if (state.bombInvincible > 0) {
        renderer.strokeCircle(renderX, renderY, 20, 'rgba(0, 229, 255, 0.5)', 2);
      }

      // Draw hitbox if enabled
      if (SHOW_HITBOX) {
        renderer.fillCircle(
          renderX,
          renderY,
          HITBOX_RADIUS,
          `rgba(255, 255, 255, ${HITBOX_ALPHA})`
        );
        renderer.strokeCircle(
          renderX,
          renderY,
          HITBOX_RADIUS + 1,
          `rgba(0, 229, 255, ${HITBOX_ALPHA})`,
          1
        );
      }

      // Draw HUD
      const hudY = 4;
      renderer.fillText('SCORE: 0', 8, hudY, '#fff', 10);
      renderer.fillText(`TIME: ${gameTime.toFixed(1)}`, LOGICAL_W - 70, hudY, '#fff', 10);

      // Bombs display
      const bombsText = `BOMBS: ${'●'.repeat(state.bombs)}${'○'.repeat(BOMBS_MAX - state.bombs)}`;
      renderer.fillText(bombsText, 8, hudY + 14, state.bombs > 0 ? '#ff0' : '#666', 10);

      // Draw control regions (debug)
      if (ctx.showDebug) {
        // Left half - joystick region
        renderer.strokeRect(
          0,
          LOGICAL_H / 2,
          LOGICAL_W / 2,
          LOGICAL_H / 2,
          'rgba(0, 255, 0, 0.3)',
          1
        );
        renderer.fillText('JOYSTICK', 10, LOGICAL_H / 2 + 10, 'rgba(0, 255, 0, 0.5)', 10);

        // Right side - button regions
        renderer.strokeRect(
          LOGICAL_W / 2,
          LOGICAL_H / 2,
          LOGICAL_W / 2,
          LOGICAL_H / 2,
          'rgba(255, 255, 0, 0.3)',
          1
        );
        renderer.fillText(
          'A=Fire B=Bomb',
          LOGICAL_W / 2 + 10,
          LOGICAL_H / 2 + 10,
          'rgba(255, 255, 0, 0.5)',
          10
        );
      }
    },

    // Expose game state for debug overlay
    getDebugInfo(): GameDebugInfo {
      return {
        bombs: state.bombs,
        bombCooldown: state.bombCooldown,
        bulletCount: bulletPool.getActiveCount(),
        fireHeld,
        bombPressed,
      };
    },
  };
}
