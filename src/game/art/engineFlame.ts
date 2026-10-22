/**
 * Engine flame / exhaust rendering
 * Design doc §3.5: Code-generated, not baked into sprites
 *
 * Player: cyan-white core with light blue outer, flickers
 * Enemy: orange-yellow, shorter, no particles
 */

import { PALETTE, COLOR } from '@/game/palette';

export interface FlameConfig {
  baseLength: number;
  baseWidth: number;
  flickerAmount: number;
  coreColor: string;
  outerColor: string;
  glowColor: string;
}

export const PLAYER_FLAME_CONFIG: FlameConfig = {
  baseLength: 8,
  baseWidth: 4,
  flickerAmount: 2,
  coreColor: '#ffffff',
  outerColor: PALETTE[COLOR.PLAYER_CYAN],
  glowColor: 'rgba(0, 229, 255, 0.3)',
};

export const ENEMY_FLAME_CONFIG: FlameConfig = {
  baseLength: 5,
  baseWidth: 3,
  flickerAmount: 1,
  coreColor: PALETTE[COLOR.EXPLOSION_YELLOW],
  outerColor: PALETTE[COLOR.EXPLOSION_ORANGE],
  glowColor: 'rgba(255, 136, 32, 0.2)',
};

/**
 * Draw engine flame at a nozzle position
 * @param ctx Canvas context (already transformed to logical coordinates)
 * @param x Nozzle X position
 * @param y Nozzle Y position
 * @param config Flame configuration
 * @param velocityY Player vertical velocity (-1 to 1, negative = moving up)
 * @param time Current game time for animation
 */
export function drawEngineFlame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  config: FlameConfig,
  velocityY: number = 0,
  time: number = 0
): void {
  // Flame length varies with vertical velocity
  // Moving up = longer flame, moving down = shorter
  const velocityMod = 1 - velocityY * 0.3;

  // Flicker based on time
  const flicker1 = Math.sin(time * 30) * config.flickerAmount;
  const flicker2 = Math.sin(time * 45 + 1.5) * config.flickerAmount * 0.7;

  const length = config.baseLength * velocityMod + flicker1;
  const width = config.baseWidth + flicker2 * 0.3;

  // Draw glow first
  const gradient = ctx.createLinearGradient(x, y, x, y + length * 1.5);
  gradient.addColorStop(0, config.glowColor);
  gradient.addColorStop(1, 'transparent');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(x, y + length * 0.5, width * 2, length * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Draw outer flame
  ctx.fillStyle = config.outerColor;
  ctx.beginPath();
  ctx.moveTo(x - width, y);
  ctx.lineTo(x, y + length);
  ctx.lineTo(x + width, y);
  ctx.closePath();
  ctx.fill();

  // Draw inner core
  ctx.fillStyle = config.coreColor;
  ctx.beginPath();
  ctx.moveTo(x - width * 0.5, y);
  ctx.lineTo(x, y + length * 0.7);
  ctx.lineTo(x + width * 0.5, y);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw engine flames for player at all nozzle positions
 */
export function drawPlayerFlames(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  nozzleOffsets: Array<{ x: number; y: number }>,
  velocityY: number,
  time: number,
  scale = 1
): void {
  const config =
    scale === 1
      ? PLAYER_FLAME_CONFIG
      : {
          ...PLAYER_FLAME_CONFIG,
          baseLength: PLAYER_FLAME_CONFIG.baseLength * scale,
          baseWidth: PLAYER_FLAME_CONFIG.baseWidth * scale,
          flickerAmount: PLAYER_FLAME_CONFIG.flickerAmount * scale,
        };
  for (const nozzle of nozzleOffsets) {
    drawEngineFlame(
      ctx,
      centerX + nozzle.x * scale,
      centerY + nozzle.y * scale,
      config,
      velocityY,
      time
    );
  }
}

/**
 * Draw engine flame for enemy (simpler, single nozzle)
 */
export function drawEnemyFlame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number
): void {
  // Enemy flames point upward (enemy is facing down toward player)
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, -1); // Flip vertically
  drawEngineFlame(ctx, 0, 0, ENEMY_FLAME_CONFIG, 0, time);
  ctx.restore();
}
