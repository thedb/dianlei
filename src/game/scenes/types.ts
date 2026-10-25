/**
 * Scene system types
 */

import type { Renderer, GameDebugInfo } from '@/engine/renderer';
import type { InputState, InputHandler } from '@/engine/input';
import type { SettingsStore, SettingsStorage } from '@/game/settings';
import type { Difficulty } from '@/game/difficulty';
import type { RunReport } from '@/game/systems/score';
import type { Rng } from '@/engine/rng';
import type { PlayMode } from '@/game/battle/playMode';
import type { EquippedWeapon } from '@/game/systems/playerWeapons';

export type SceneId = 'boot' | 'title' | 'battle' | 'result' | 'gameover';

/** Score and loadout kept when a cleared stage continues into the next one. */
export interface CarriedRun {
  score: number;
  lives: number;
  bombs: number;
  deaths: number;
  main: EquippedWeapon;
  sub: EquippedWeapon | null;
  mate: number;
  nextExtendScore: number;
}

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
   * weapon test leave it unset. Battle loads that stage from the registry
   * only when `battleEntry` is `'boss'`. Not persisted.
   */
  challengeStage?: string;
  /**
   * Stage id for a normal run (`battleEntry: 'stage'`). Omitted means stage 1.
   * The debug stage list and the clear handoff write it. 挑战 Boss does not.
   * Not persisted. Retry keeps it.
   */
  runStage?: string;
  /**
   * Set when a normal clear has another stage. The result scene shows the
   * black card, then writes `runStage` and enters battle. Absent on a final
   * clear and on 挑战 Boss.
   */
  campaignNext?: string;
  /**
   * Loadout and score carried into the next stage. Battle enter applies it
   * once, after the fresh-ship reset, then deletes it.
   */
  carriedRun?: CarriedRun;
  /**
   * 地图预览 target from the debug panel (`maps/preview.ts`): `map:<id>`.
   * The list is one row per map. Only `playMode: 'mapPreview'` reads it.
   * Not persisted.
   */
  previewMap?: string;
  /**
   * `attract` is the silent title demo. It runs the same battle scene, but
   * does not play SFX, publish a run, draw the HUD, or respawn after death.
   * `weaponTest` is the damage range: same player, loadout, and fire path,
   * no scroll and no spawns. `mapPreview` scrolls a map with only the ship.
   * Omitted on a real run (treated as `play`).
   * What each mode turns on or off is the `PLAY_MODE_RULES` table.
   */
  playMode?: PlayMode;
  /**
   * Gameplay random source (spawn jitter, item drift, explosion offsets).
   * Omitted falls back to a clock-seeded generator per battle scene. Replay
   * tests inject a seeded one.
   */
  rng?: Rng;
}
