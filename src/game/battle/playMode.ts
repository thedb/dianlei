/**
 * Play-mode rules for the battle scene. The scene reads these flags instead of
 * branching on `SceneContext.playMode`, so a new mode is one row here.
 *
 * - `play`: a real run (stage or 挑战 Boss).
 * - `attract`: the silent title demo. Same battle, no SFX, HUD, pause, or run
 *   report, and the ship stays dead so the title can fade and restart.
 * - `weaponTest`: the damage range. Same player, loadout, and fire path, no
 *   world (scroll, waves, buildings, boss), one immortal target.
 * - `mapPreview`: 地图预览. The ship flies over one map (or a stage's whole
 *   pre-boss map run) with no waves, buildings, or boss, and the scene leaves
 *   for the title when the track ends.
 */

import type { Difficulty } from '@/game/difficulty';

export type PlayMode = 'play' | 'attract' | 'weaponTest' | 'mapPreview';

export interface PlayModeRules {
  /** No SFX and no audio init or unlock. */
  silent: boolean;
  /** Pause button, Esc, and app hide open the pause menu. */
  pausable: boolean;
  /** 返回标题 in the pause menu: confirm first, or leave at once. */
  pauseExit: 'confirm' | 'immediate';
  /** Writes the run report on clear and game over. */
  publishesRun: boolean;
  /** After the death explosion: respawn (or game over), hold the wreck, or leave to the title. */
  onDeath: 'respawn' | 'hold' | 'title';
  /** The map scrolls and the background track is drawn. */
  scroll: boolean;
  /** Waves, buildings, the warning, and the boss. */
  spawns: boolean;
  /** Background track: the stage's maps, or the 地图预览 target (`SceneContext.previewMap`). */
  track: 'stage' | 'preview';
  /** Leave for the title once the track's `endAt` passes. */
  leaveAtTrackEnd: boolean;
  /** The weapon-test range: fixed target, panel taps, tune overrides, damage meter. */
  range: boolean;
  /** HUD layer drawn over the field. */
  hud: 'stage' | 'range' | 'preview' | 'none';
  /** Forced run difficulty. Null reads `SceneContext.difficulty`. */
  difficulty: Difficulty | null;
  /** Scripted fly-off and the result screen after the boss dies. */
  victoryExit: boolean;
  /** Honors `battleEntry: 'boss'` (jump to the boss with Lv3). */
  bossEntry: boolean;
}

export const PLAY_MODE_RULES: Readonly<Record<PlayMode, PlayModeRules>> = {
  play: {
    silent: false,
    pausable: true,
    pauseExit: 'confirm',
    publishesRun: true,
    onDeath: 'respawn',
    scroll: true,
    spawns: true,
    track: 'stage',
    leaveAtTrackEnd: false,
    range: false,
    hud: 'stage',
    difficulty: null,
    victoryExit: true,
    bossEntry: true,
  },
  attract: {
    silent: true,
    pausable: false,
    pauseExit: 'confirm',
    publishesRun: false,
    onDeath: 'hold',
    scroll: true,
    spawns: true,
    track: 'stage',
    leaveAtTrackEnd: false,
    range: false,
    hud: 'none',
    difficulty: 'easy',
    victoryExit: false,
    bossEntry: true,
  },
  weaponTest: {
    silent: false,
    pausable: true,
    pauseExit: 'immediate',
    publishesRun: false,
    onDeath: 'title',
    scroll: false,
    spawns: false,
    track: 'stage',
    leaveAtTrackEnd: false,
    range: true,
    hud: 'range',
    difficulty: 'easy',
    victoryExit: true,
    bossEntry: false,
  },
  mapPreview: {
    silent: false,
    pausable: true,
    pauseExit: 'immediate',
    publishesRun: false,
    onDeath: 'title',
    scroll: true,
    spawns: false,
    track: 'preview',
    leaveAtTrackEnd: true,
    range: false,
    hud: 'preview',
    difficulty: 'easy',
    victoryExit: false,
    bossEntry: false,
  },
};

export function playModeRules(mode: PlayMode | undefined): PlayModeRules {
  return PLAY_MODE_RULES[mode ?? 'play'];
}
