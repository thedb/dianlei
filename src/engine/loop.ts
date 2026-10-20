/**
 * Fixed-timestep game loop with interpolated rendering
 * Ensures consistent gameplay at 60Hz update rate regardless of display refresh
 */

import type { PlatformAdapter } from '@/platform/types';
import { FIXED_DT } from '@/game/config';

export interface GameLoop {
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  isPaused(): boolean;
  getDebugInfo(): LoopDebugInfo;
}

export interface LoopDebugInfo {
  fps: number;
  updateTime: number;
  renderTime: number;
  frameTime: number;
}

export interface LoopCallbacks {
  update: (dt: number) => void;
  render: (alpha: number) => void;
}

const FIXED_DT_MS = FIXED_DT * 1000;
const MAX_FRAME_TIME = 250; // Prevent spiral of death

export function createGameLoop(platform: PlatformAdapter, callbacks: LoopCallbacks): GameLoop {
  let running = false;
  let paused = false;
  let rafId = 0;

  let lastTime = 0;
  let accumulator = 0;

  // Debug metrics
  let frameCount = 0;
  let fpsTime = 0;
  let currentFps = 0;
  let updateTimeMs = 0;
  let renderTimeMs = 0;
  let frameTimeMs = 0;

  function tick(timestamp: number): void {
    if (!running) return;

    rafId = platform.requestAnimationFrame(tick);

    const frameStart = platform.now();

    if (lastTime === 0) {
      lastTime = timestamp;
    }

    let dt = timestamp - lastTime;
    lastTime = timestamp;

    // Prevent large time jumps (e.g., when tab was backgrounded)
    if (dt > MAX_FRAME_TIME) {
      dt = MAX_FRAME_TIME;
    }

    frameTimeMs = dt;

    // FPS calculation
    frameCount++;
    fpsTime += dt;
    if (fpsTime >= 1000) {
      currentFps = Math.round((frameCount * 1000) / fpsTime);
      frameCount = 0;
      fpsTime = 0;
    }

    if (paused) {
      // Still render when paused, but don't update game state
      const renderStart = platform.now();
      callbacks.render(1);
      renderTimeMs = platform.now() - renderStart;
      return;
    }

    // Fixed timestep updates
    accumulator += dt;

    const updateStart = platform.now();
    while (accumulator >= FIXED_DT_MS) {
      callbacks.update(FIXED_DT);
      accumulator -= FIXED_DT_MS;
    }
    updateTimeMs = platform.now() - updateStart;

    // Render with interpolation factor
    const alpha = accumulator / FIXED_DT_MS;
    const renderStart = platform.now();
    callbacks.render(alpha);
    renderTimeMs = platform.now() - renderStart;

    frameTimeMs = platform.now() - frameStart;
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      paused = false;
      lastTime = 0;
      accumulator = 0;
      rafId = platform.requestAnimationFrame(tick);
    },

    stop(): void {
      running = false;
      if (rafId) {
        platform.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    },

    pause(): void {
      paused = true;
    },

    resume(): void {
      paused = false;
    },

    isPaused(): boolean {
      return paused;
    },

    getDebugInfo(): LoopDebugInfo {
      return {
        fps: currentFps,
        updateTime: updateTimeMs,
        renderTime: renderTimeMs,
        frameTime: frameTimeMs,
      };
    },
  };
}
