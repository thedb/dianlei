/**
 * Scene system types
 */

import type { Renderer, GameDebugInfo } from '@/engine/renderer';
import type { InputState, InputHandler } from '@/engine/input';
import type { SettingsStore, SettingsStorage } from '@/game/settings';
import type { RunReport } from '@/game/systems/score';

export type SceneId = 'boot' | 'title' | 'battle' | 'result' | 'gameover';

/** Full stage, or a boss-practice entry that skips the mid-stage waves. */
export type BattleEntry = 'stage' | 'boss';

export interface Scene {
  id: SceneId;
  enter(): void;
  exit(): void;
  update(dt: number, input: InputState): SceneId | null;
  render(renderer: Renderer, alpha: number): void;
  /** Optional method to expose game state for debug overlay */
  getDebugInfo?(): GameDebugInfo;
  /** App went to background (tab hidden / WeChat onHide) */
  onHide?(): void;
}

export interface SceneContext {
  showDebug: boolean;
  safeArea: { top: number; bottom: number; left: number; right: number };
  input: Pick<InputHandler, 'setControlsEnabled' | 'getControlsView'>;
  settings: SettingsStore;
  storage: SettingsStorage;
  /** Last finished run, read by the result and game-over scenes. */
  run: { report: RunReport | null };
  /**
   * Written by boot and the title menu before entering battle.
   * Retry keeps whatever the last start chose.
   */
  battleEntry: BattleEntry;
}
