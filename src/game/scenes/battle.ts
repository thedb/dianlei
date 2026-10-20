/**
 * Battle scene - main gameplay (P0: movement test with scrolling background)
 */

import type { Scene, SceneContext } from './types';
import type { Renderer } from '@/engine/renderer';
import type { InputState } from '@/engine/input';
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
} from '@/game/config';
import { PALETTE, COLOR } from '@/game/palette';

interface Player {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
}

export function createBattleScene(ctx: SceneContext): Scene {
  const player: Player = {
    x: LOGICAL_W / 2,
    y: PLAYER_SPAWN_Y,
    prevX: LOGICAL_W / 2,
    prevY: PLAYER_SPAWN_Y,
  };

  let bgOffset = 0;
  let gameTime = 0;

  return {
    id: 'battle',

    enter(): void {
      player.x = LOGICAL_W / 2;
      player.y = PLAYER_SPAWN_Y;
      player.prevX = player.x;
      player.prevY = player.y;
      bgOffset = 0;
      gameTime = 0;
    },

    exit(): void {},

    update(dt: number, input: InputState) {
      gameTime += dt;

      // Store previous position for interpolation
      player.prevX = player.x;
      player.prevY = player.y;

      // Move player based on input
      const speed = PLAYER_SPEED * input.joystickMagnitude;
      player.x += input.joystickX * speed * dt;
      player.y += input.joystickY * speed * dt;

      // Clamp to screen bounds
      player.x = Math.max(PLAYER_MARGIN, Math.min(LOGICAL_W - PLAYER_MARGIN, player.x));
      player.y = Math.max(
        PLAYER_MARGIN + ctx.safeArea.top,
        Math.min(LOGICAL_H - PLAYER_MARGIN - ctx.safeArea.bottom, player.y)
      );

      // Scroll background
      bgOffset = (bgOffset + BG_SCROLL_SPEED * dt) % 32;

      // Log input in debug mode
      if (ctx.showDebug && (input.buttonA || input.buttonB)) {
        // eslint-disable-next-line no-console
        console.log(
          `Input: A=${input.buttonA} B=${input.buttonB} joy=(${input.joystickX.toFixed(2)}, ${input.joystickY.toFixed(2)})`
        );
      }

      return null;
    },

    render(renderer: Renderer, alpha: number): void {
      // Interpolate player position for smooth rendering
      const renderX = player.prevX + (player.x - player.prevX) * alpha;
      const renderY = player.prevY + (player.y - player.prevY) * alpha;

      // Clear with dark background
      renderer.clear('#0a0a1a');

      // Draw scrolling grid background (placeholder for tile system)
      const gridSize = 32;
      const gridColor = '#1a1a2e';
      const bgY = bgOffset;

      for (let y = -gridSize + bgY; y < LOGICAL_H + gridSize; y += gridSize) {
        for (let x = 0; x < LOGICAL_W; x += gridSize) {
          renderer.strokeRect(x, y, gridSize, gridSize, gridColor, 1);
        }
      }

      // Draw safe area indicators (debug)
      if (ctx.showDebug) {
        renderer.fillRect(0, 0, LOGICAL_W, ctx.safeArea.top, 'rgba(255, 0, 0, 0.2)');
        renderer.fillRect(
          0,
          LOGICAL_H - ctx.safeArea.bottom,
          LOGICAL_W,
          ctx.safeArea.bottom,
          'rgba(255, 0, 0, 0.2)'
        );
      }

      // Draw player as a placeholder rectangle (28x32 sprite size)
      const playerW = 28;
      const playerH = 32;
      const playerColor = PALETTE[COLOR.PLAYER_CYAN];

      renderer.fillRect(
        renderX - playerW / 2,
        renderY - playerH / 2,
        playerW,
        playerH,
        playerColor
      );

      // Draw cockpit
      renderer.fillRect(renderX - 4, renderY - playerH / 2 + 4, 8, 12, PALETTE[COLOR.PLAYER_BLUE]);

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

      // Draw HUD placeholder
      const hudY = ctx.safeArea.top + 4;
      renderer.fillText('SCORE: 0', 8, hudY, '#fff', 10);
      renderer.fillText(`TIME: ${gameTime.toFixed(1)}`, LOGICAL_W - 70, hudY, '#fff', 10);

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
          'BUTTONS',
          LOGICAL_W / 2 + 10,
          LOGICAL_H / 2 + 10,
          'rgba(255, 255, 0, 0.5)',
          10
        );
      }
    },
  };
}
