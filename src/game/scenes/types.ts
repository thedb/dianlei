/**
 * Scene system types
 */

import type { Renderer, GameDebugInfo } from '@/engine/renderer';
import type { InputState, InputHandler } from '@/engine/input';
import type { SettingsStore, SettingsStorage } from '@/game/settings';
import type { Difficulty } from '@/game/difficulty';
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
  /**
   * Chosen for this run, including retry. Omitted means Easy.
   * Formal start writes 简单 / 中等 / 困难. Challenge Boss writes 普通 (easy)
   * or 困难 (hard) and never medium. Not persisted.
   * The attract demo does not read it.
   */
  difficulty?: Difficulty;
  /**
   * Stage boss id from the challenge picker (`'1'` today). Formal starts and
   * weapon test leave it unset. Battle still jumps to stage 1, the only table.
   * Not persisted.
   */
  challengeStage?: string;
  /**
   * `attract` is the silent title demo. It runs the same battle scene, but
   * does not play SFX, publish a run, draw the HUD, or respawn after death.
   * `weaponTest` is the damage range: same player, loadout, and fire path,
   * no scroll and no spawns. Omitted on a real run (treated as `play`).
   */
  playMode?: 'play' | 'attract' | 'weaponTest';
}
