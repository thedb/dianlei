/**
 * Scene system types
 */

import type { Renderer, GameDebugInfo } from '@/engine/renderer';
import type { InputState } from '@/engine/input';

export type SceneId = 'boot' | 'title' | 'battle' | 'result' | 'gameover';

export interface Scene {
  id: SceneId;
  enter(): void;
  exit(): void;
  update(dt: number, input: InputState): SceneId | null;
  render(renderer: Renderer, alpha: number): void;
  /** Optional method to expose game state for debug overlay */
  getDebugInfo?(): GameDebugInfo;
}

export interface SceneContext {
  showDebug: boolean;
  safeArea: { top: number; bottom: number; left: number; right: number };
}
