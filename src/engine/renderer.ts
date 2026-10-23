/**
 * Canvas 2D renderer with scaling and debug overlay
 */

import { LOGICAL_W, LOGICAL_H } from '@/game/config';
import type { LoopDebugInfo } from './loop';
import type { InputDebugInfo } from './input';

export interface Renderer {
  clear(color: string): void;
  fillRect(x: number, y: number, w: number, h: number, color: string): void;
  strokeRect(x: number, y: number, w: number, h: number, color: string, lineWidth?: number): void;
  fillCircle(x: number, y: number, radius: number, color: string): void;
  strokeCircle(x: number, y: number, radius: number, color: string, lineWidth?: number): void;
  fillText(text: string, x: number, y: number, color: string, fontSize?: number): void;
  drawImage(image: CanvasImageSource, x: number, y: number, w?: number, h?: number): void;
  drawDebugOverlay(
    loopInfo: LoopDebugInfo,
    inputInfo: InputDebugInfo,
    gameInfo?: GameDebugInfo
  ): void;
  getScaleInfo(): { scale: number; offsetX: number; offsetY: number };
  getCanvas(): HTMLCanvasElement;
  resize(): void;
  getContext(): CanvasRenderingContext2D;
}

export interface GameDebugInfo {
  bombs: number;
  bombCooldown: number;
  bulletCount: number;
  fireHeld: boolean;
  bombPressed: boolean;
  enemyCount?: number;
  enemyBulletCount?: number;
  score?: number;
  /** Main weapon level */
  power?: number;
  mainWeapon?: string;
  /** Sub weapon id, or null while the sub slot is empty */
  subWeapon?: string | null;
  /** Sub weapon level, 0 while empty */
  subLevel?: number;
  /** Wingman slot M. 0, 1, or 2. */
  mateLevel?: number;
  /** Player homing missiles in flight */
  missileCount?: number;
  lives?: number;
  paused?: boolean;
  /** Seconds of gameplay simulated (frozen while paused) */
  gameTime?: number;
  /** Orbital boss phase, when the fight has started */
  bossPhase?: string;
  /** Hard challenge / formal Hard armed the phase-3 segment. */
  bossPhase3?: boolean;
  /** Scaled boss HP pool for this run, including phase 3 when it is armed. */
  bossMaxHp?: number;
  /** Ship is in the death explosion and has not respawned. */
  playerDead?: boolean;
  /** Explosions still playing, including ones waiting on a delay. */
  activeExplosions?: number;
  /** Enemies the wave scheduler has actually spawned. */
  waveSpawned?: number;
  /** Buildings on the map, intact or wrecked. */
  buildingCount?: number;
  /**
   * Default building-drop preview: `B` at max main power, otherwise `P/B`.
   * Does not roll, and does not name a placement lock.
   */
  buildingDrop?: string;
  /** Risk crates still on screen. */
  crateCount?: number;
}

/**
 * Calculate scaling parameters to fit logical resolution in screen
 * @returns scale factor and canvas offset for letterboxing
 */
export function calculateScaling(
  screenWidth: number,
  screenHeight: number,
  logicalW: number = LOGICAL_W,
  logicalH: number = LOGICAL_H
): { scale: number; canvasWidth: number; canvasHeight: number; offsetX: number; offsetY: number } {
  const scaleX = screenWidth / logicalW;
  const scaleY = screenHeight / logicalH;
  let scale = Math.min(scaleX, scaleY);

  // For crisp pixels, prefer integer scaling when close
  const intScale = Math.floor(scale);
  if (intScale >= 1 && scale - intScale < 0.2) {
    scale = intScale;
  }

  const canvasWidth = Math.floor(logicalW * scale);
  const canvasHeight = Math.floor(logicalH * scale);
  const offsetX = Math.floor((screenWidth - canvasWidth) / 2);
  const offsetY = Math.floor((screenHeight - canvasHeight) / 2);

  return { scale, canvasWidth, canvasHeight, offsetX, offsetY };
}

export interface RendererOptions {
  screenWidth: number;
  screenHeight: number;
  dpr: number;
  container: HTMLElement;
}

export function createRenderer(options: RendererOptions): Renderer {
  const { screenWidth, screenHeight, dpr, container } = options;

  const { scale, canvasWidth, canvasHeight, offsetX, offsetY } = calculateScaling(
    screenWidth,
    screenHeight
  );

  // Create canvas element
  const canvas = document.createElement('canvas');

  // Backing store size (physical pixels)
  canvas.width = canvasWidth * dpr;
  canvas.height = canvasHeight * dpr;

  // CSS size (logical CSS pixels)
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;
  canvas.style.imageRendering = 'pixelated';
  canvas.style.touchAction = 'none';

  // Position for letterboxing
  canvas.style.position = 'absolute';
  canvas.style.left = `${offsetX}px`;
  canvas.style.top = `${offsetY}px`;

  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context');

  // Combined transform: DPR * scale to map logical coords to backing store
  const combinedScale = scale * dpr;
  ctx.setTransform(combinedScale, 0, 0, combinedScale, 0, 0);
  ctx.imageSmoothingEnabled = false;

  return {
    clear(color: string): void {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    },

    fillRect(x: number, y: number, w: number, h: number, color: string): void {
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
    },

    strokeRect(x: number, y: number, w: number, h: number, color: string, lineWidth = 1): void {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.strokeRect(Math.floor(x) + 0.5, Math.floor(y) + 0.5, Math.floor(w), Math.floor(h));
    },

    fillCircle(x: number, y: number, radius: number, color: string): void {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(Math.floor(x), Math.floor(y), radius, 0, Math.PI * 2);
      ctx.fill();
    },

    strokeCircle(x: number, y: number, radius: number, color: string, lineWidth = 1): void {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.arc(Math.floor(x), Math.floor(y), radius, 0, Math.PI * 2);
      ctx.stroke();
    },

    fillText(text: string, x: number, y: number, color: string, fontSize = 12): void {
      ctx.fillStyle = color;
      ctx.font = `${fontSize}px monospace`;
      ctx.textBaseline = 'top';
      ctx.fillText(text, Math.floor(x), Math.floor(y));
    },

    drawImage(image: CanvasImageSource, x: number, y: number, w?: number, h?: number): void {
      if (w !== undefined && h !== undefined) {
        ctx.drawImage(image, Math.floor(x), Math.floor(y), w, h);
      } else {
        ctx.drawImage(image, Math.floor(x), Math.floor(y));
      }
    },

    drawDebugOverlay(
      loopInfo: LoopDebugInfo,
      inputInfo: InputDebugInfo,
      gameInfo?: GameDebugInfo
    ): void {
      // Position debug overlay at bottom-left to avoid HUD overlap
      const x = 4;
      const lineHeight = 11;
      const fontSize = 9;
      const bgColor = 'rgba(0, 0, 0, 0.75)';
      const textColor = '#0f0';
      const labelColor = '#888';
      const activeColor = '#ff0';

      const lines: { text: string; color: string }[] = [
        { text: `Render: ${loopInfo.renderFps} fps`, color: textColor },
        { text: `Update: ${loopInfo.updateRate}/s`, color: textColor },
        { text: `Frame: ${loopInfo.frameTime.toFixed(1)}ms`, color: textColor },
        { text: `Touches: ${inputInfo.activeTouches}`, color: textColor },
        {
          text: `Joy: ${inputInfo.joystickActive ? 'ACTIVE' : 'idle'}`,
          color: inputInfo.joystickActive ? activeColor : textColor,
        },
      ];

      if (gameInfo) {
        lines.push(
          {
            text: `Fire: ${gameInfo.fireHeld ? 'HELD' : 'off'}`,
            color: gameInfo.fireHeld ? activeColor : textColor,
          },
          {
            text: `Bomb: ${gameInfo.bombPressed ? 'PRESSED' : 'off'} (${gameInfo.bombs})`,
            color: gameInfo.bombPressed ? activeColor : textColor,
          },
          { text: `Bullets: ${gameInfo.bulletCount}`, color: textColor },
          {
            text: `BombCD: ${gameInfo.bombCooldown.toFixed(1)}s`,
            color: gameInfo.bombCooldown > 0 ? activeColor : textColor,
          }
        );
      }

      const boxHeight = (lines.length + 1) * lineHeight + 4;
      const boxY = LOGICAL_H - boxHeight - 4;

      // Background
      this.fillRect(x - 2, boxY - 2, 105, boxHeight, bgColor);

      // Title
      this.fillText('DEBUG', x, boxY, labelColor, fontSize);

      // Text lines
      let y = boxY + lineHeight;
      for (const line of lines) {
        this.fillText(line.text, x, y, line.color, fontSize);
        y += lineHeight;
      }
    },

    getScaleInfo(): { scale: number; offsetX: number; offsetY: number } {
      return { scale, offsetX, offsetY };
    },

    getCanvas(): HTMLCanvasElement {
      return canvas;
    },

    resize(): void {
      // TODO: In P1+, handle window resize by recalculating scale and recreating canvas
    },

    getContext(): CanvasRenderingContext2D {
      return ctx;
    },
  };
}
