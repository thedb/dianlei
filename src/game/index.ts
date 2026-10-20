/**
 * Main game class - coordinates all systems
 */

import type { H5Platform } from '@/platform/h5';
import { createGameLoop, type GameLoop } from '@/engine/loop';
import { createInputHandler, type InputHandler } from '@/engine/input';
import { createRenderer, type Renderer } from '@/engine/renderer';
import { createAudioSystem, type AudioSystem } from '@/engine/audio';
import { createSceneManager, type SceneContext } from './scenes';

export interface Game {
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  toggleDebug(): void;
}

export function createGame(platform: H5Platform): Game {
  const safeArea = platform.getSafeArea();
  const screen = platform.getScreenSize();
  const dpr = platform.getDevicePixelRatio();

  // Get container
  const container = document.getElementById('game') ?? document.body;

  // Create renderer (creates its own canvas)
  const renderer: Renderer = createRenderer({
    screenWidth: screen.width,
    screenHeight: screen.height,
    dpr,
    container,
  });

  // Register canvas with platform for touch coordinate conversion
  const scaleInfo = renderer.getScaleInfo();
  platform.setCanvas(renderer.getCanvas(), scaleInfo.scale);

  // Create input handler
  const inputHandler: InputHandler = createInputHandler(platform, safeArea.bottom);
  inputHandler.setScaleFactor(scaleInfo.scale, scaleInfo.offsetX, scaleInfo.offsetY);

  // Create audio system
  const audioSystem: AudioSystem = createAudioSystem(platform);

  // Scene context
  const sceneContext: SceneContext = {
    showDebug: true, // P0 always shows debug
    safeArea,
  };

  // Create scene manager and start with boot scene
  const sceneManager = createSceneManager(sceneContext);

  // Create game loop
  const loop: GameLoop = createGameLoop(platform, {
    update(dt: number): void {
      inputHandler.update();
      const input = inputHandler.getState();

      const scene = sceneManager.getCurrentScene();
      if (scene) {
        const nextScene = scene.update(dt, input);
        if (nextScene) {
          sceneManager.transition(nextScene);
        }
      }
    },

    render(alpha: number): void {
      const scene = sceneManager.getCurrentScene();
      if (scene) {
        scene.render(renderer, alpha);
      }

      // Draw debug overlay
      if (sceneContext.showDebug) {
        const gameDebugInfo = sceneManager.getCurrentScene()?.getDebugInfo?.();
        renderer.drawDebugOverlay(loop.getDebugInfo(), inputHandler.getDebugInfo(), gameDebugInfo);
      }
    },
  });

  // Handle visibility changes
  platform.onVisibilityChange((visible) => {
    if (!visible) {
      loop.pause();
    }
  });

  // Export audio system for future use
  void audioSystem;

  return {
    start(): void {
      sceneManager.start('boot');
      loop.start();
    },

    stop(): void {
      loop.stop();
    },

    pause(): void {
      loop.pause();
    },

    resume(): void {
      loop.resume();
    },

    toggleDebug(): void {
      sceneContext.showDebug = !sceneContext.showDebug;
    },
  };
}
