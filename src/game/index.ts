/**
 * Main game class - coordinates all systems
 */

import type { H5Platform } from '@/platform/h5';
import { createGameLoop, type GameLoop } from '@/engine/loop';
import { createInputHandler, type InputHandler } from '@/engine/input';
import { createRenderer, type Renderer } from '@/engine/renderer';
import { clockSeed, createRng } from '@/engine/rng';
import { createSceneManager, type SceneContext } from './scenes';
import { createSettingsStore, type Settings } from './settings';
import { getAudioSystem } from './systems/audio';

export interface Game {
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  /** Current scene id (debug / e2e checks) */
  getSceneId(): string | null;
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

  // Settings persist through the platform storage hook
  const settings = createSettingsStore(platform);
  const sfx = getAudioSystem();
  sfx.bindBackend(() => platform.createAudioContext());
  const applyAudio = (s: Settings): void => {
    sfx.setMuted(s.muted);
    sfx.setBgmEnabled(s.bgmEnabled);
    sfx.setBgmVolume(s.bgmVolume);
  };
  applyAudio(settings.get());
  settings.subscribe(applyAudio);

  // The H5 platform already reports touches in logical pixels, so the input
  // handler must not re-apply the letterbox scale/offset
  const inputHandler: InputHandler = createInputHandler(platform, settings, safeArea);
  inputHandler.setScaleFactor(1, 0, 0);

  // Scene context. The FPS / debug overlay follows the persisted debug switch.
  const sceneContext: SceneContext = {
    showDebug: settings.get().debugMode,
    safeArea,
    input: inputHandler,
    settings,
    storage: platform,
    run: { report: null },
    rng: createRng(clockSeed()),
    battleEntry: 'stage',
  };
  settings.subscribe((s) => {
    sceneContext.showDebug = s.debugMode;
  });

  // Create scene manager and start with boot scene
  const sceneManager = createSceneManager(sceneContext);

  // Create game loop
  const loop: GameLoop = createGameLoop(platform, {
    update(dt: number): void {
      inputHandler.update();
      const input = inputHandler.getState();
      if (
        input.taps.length > 0 ||
        input.pointers.length > 0 ||
        input.menuConfirm ||
        input.keyFire ||
        input.keyBomb
      ) {
        sfx.unlock();
      }
      sfx.tick();

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

  // Backgrounding opens the pause menu (design doc §7); the loop keeps
  // running so the menu is live when the player returns
  platform.onVisibilityChange((visible) => {
    if (!visible) {
      sceneManager.getCurrentScene()?.onHide?.();
    }
  });

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

    getSceneId(): string | null {
      return sceneManager.getCurrentScene()?.id ?? null;
    },
  };
}
