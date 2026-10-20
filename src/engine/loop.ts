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
  /** Render frames per second (matches display refresh rate) */
  renderFps: number;
  /** Game updates per second (should be ~60) */
  updateRate: number;
  /** Time spent in update() this frame (ms) */
  updateTime: number;
  /** Time spent in render() this frame (ms) */
  renderTime: number;
  /** Total frame time (ms) */
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

  // Render FPS metrics (rAF calls per second)
  let renderFrameCount = 0;
  let renderFpsTime = 0;
  let currentRenderFps = 0;

  // Update rate metrics (fixed-step updates per second)
  let updateCount = 0;
  let updateRateTime = 0;
  let currentUpdateRate = 0;

  // Per-frame timing
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

    // Render FPS calculation
    renderFrameCount++;
    renderFpsTime += dt;
    if (renderFpsTime >= 1000) {
      currentRenderFps = Math.round((renderFrameCount * 1000) / renderFpsTime);
      renderFrameCount = 0;
      renderFpsTime = 0;
    }

    // Update rate calculation (tracked separately)
    updateRateTime += dt;
    if (updateRateTime >= 1000) {
      currentUpdateRate = updateCount;
      updateCount = 0;
      updateRateTime = 0;
    }

    if (paused) {
      // Still render when paused, but don't update game state
      const renderStart = platform.now();
      callbacks.render(1);
      renderTimeMs = platform.now() - renderStart;
      frameTimeMs = platform.now() - frameStart;
      return;
    }

    // Fixed timestep updates
    accumulator += dt;

    const updateStart = platform.now();
    while (accumulator >= FIXED_DT_MS) {
      callbacks.update(FIXED_DT);
      accumulator -= FIXED_DT_MS;
      updateCount++;
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
      updateCount = 0;
      updateRateTime = 0;
      currentUpdateRate = 60; // Initial estimate
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
        renderFps: currentRenderFps,
        updateRate: currentUpdateRate,
        updateTime: updateTimeMs,
        renderTime: renderTimeMs,
        frameTime: frameTimeMs,
      };
    },
  };
}
