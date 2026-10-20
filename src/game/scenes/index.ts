/**
 * Scene management
 */

import type { Scene, SceneId, SceneContext } from './types';
import { createBootScene } from './boot';
import { createTitleScene } from './title';
import { createBattleScene } from './battle';

export type { Scene, SceneId, SceneContext };

export function createSceneManager(ctx: SceneContext) {
  const scenes: Map<SceneId, Scene> = new Map();
  let currentScene: Scene | null = null;

  // Register all scenes
  scenes.set('boot', createBootScene(ctx));
  scenes.set('title', createTitleScene(ctx));
  scenes.set('battle', createBattleScene(ctx));

  return {
    start(sceneId: SceneId): void {
      const scene = scenes.get(sceneId);
      if (scene) {
        currentScene?.exit();
        currentScene = scene;
        currentScene.enter();
      }
    },

    getCurrentScene(): Scene | null {
      return currentScene;
    },

    transition(nextSceneId: SceneId): void {
      this.start(nextSceneId);
    },
  };
}
