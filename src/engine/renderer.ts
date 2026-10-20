/**
 * Canvas 2D renderer with scaling and debug overlay
 */

import type { PlatformAdapter } from '@/platform/types';
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
  drawDebugOverlay(loopInfo: LoopDebugInfo, inputInfo: InputDebugInfo): void;
  getScaleInfo(): { scale: number; offsetX: number; offsetY: number };
  resize(): void;
  getContext(): CanvasRenderingContext2D;
}

export function createRenderer(platform: PlatformAdapter): Renderer {
  const screen = platform.getScreenSize();

  // Calculate scale to fit logical resolution in screen while maintaining aspect ratio
  const scaleX = screen.width / LOGICAL_W;
  const scaleY = screen.height / LOGICAL_H;
  let scale = Math.min(scaleX, scaleY);

  // For crisp pixels, use integer scaling when close to an integer
  const intScale = Math.floor(scale);
  if (intScale >= 1 && scale - intScale < 0.2) {
    scale = intScale;
  }

  const canvasWidth = Math.floor(LOGICAL_W * scale);
  const canvasHeight = Math.floor(LOGICAL_H * scale);
  const offsetX = Math.floor((screen.width - canvasWidth) / 2);
  const offsetY = Math.floor((screen.height - canvasHeight) / 2);

  const ctx = platform.createCanvas(canvasWidth, canvasHeight);

  // Set canvas position for centering (letterboxing)
  const canvas = ctx.canvas;
  if (canvas.style) {
    canvas.style.position = 'absolute';
    canvas.style.left = `${offsetX}px`;
    canvas.style.top = `${offsetY}px`;
  }

  // Scale context to logical resolution
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

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

    drawDebugOverlay(loopInfo: LoopDebugInfo, inputInfo: InputDebugInfo): void {
      const x = 4;
      let y = 4;
      const lineHeight = 14;
      const fontSize = 10;
      const bgColor = 'rgba(0, 0, 0, 0.6)';
      const textColor = '#0f0';

      const lines = [
        `FPS: ${loopInfo.fps}`,
        `Update: ${loopInfo.updateTime.toFixed(1)}ms`,
        `Render: ${loopInfo.renderTime.toFixed(1)}ms`,
        `Frame: ${loopInfo.frameTime.toFixed(1)}ms`,
        `Touches: ${inputInfo.activeTouches}`,
        `Joy: ${inputInfo.joystickActive ? 'active' : 'idle'}`,
      ];

      // Background
      this.fillRect(x - 2, y - 2, 100, lines.length * lineHeight + 4, bgColor);

      // Text
      for (const line of lines) {
        this.fillText(line, x, y, textColor, fontSize);
        y += lineHeight;
      }
    },

    getScaleInfo(): { scale: number; offsetX: number; offsetY: number } {
      return { scale, offsetX, offsetY };
    },

    resize(): void {
      // In P0, we don't handle dynamic resize - would need to recreate canvas
    },

    getContext(): CanvasRenderingContext2D {
      return ctx;
    },
  };
}
