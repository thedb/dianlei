/**
 * Weapon-test range (`playMode: 'weaponTest'`): panel taps that write the real
 * loadout, the session-only rate / damage tune, the stats panel, and the
 * solid field with its immortal target.
 */

import type { InputState } from '@/engine/input';
import { LOGICAL_H, LOGICAL_W } from '@/game/config';
import { PALETTE, COLOR } from '@/game/palette';
import { weaponForItem } from '@/game/systems/playerWeapons';
import { drawButton, drawPanel, drawText, UI_COLORS } from '@/game/ui/widgets';
import {
  clampWeaponTestBombs,
  formatWeaponTestNumber,
  resetWeaponTestTune,
  stepWeaponTestTune,
  weaponTestBombCountRect,
  weaponTestBombDecRect,
  weaponTestBombIncRect,
  weaponTestCommandAt,
  weaponTestMainRect,
  weaponTestResetRect,
  weaponTestRowLabelY,
  weaponTestSubRect,
  weaponTestTuneDecRect,
  weaponTestTuneIncRect,
  weaponTestTuneRow,
  weaponTestTuneValueRect,
  WEAPON_TEST_CTRL_PANEL,
  WEAPON_TEST_STATS_PANEL,
  WEAPON_TEST_TARGET,
  WEAPON_TEST_TUNE_FIELDS,
  WEAPON_TEST_TUNE_LABEL,
  type WeaponTestCommand,
  type WeaponTestStats,
} from '@/game/scenes/weaponTest';
import type { Battle } from './context';
import { isPlayerVulnerable, killPlayer, volleyInterval } from './player';

function applyWeaponCommand(b: Battle, command: WeaponTestCommand): void {
  const { state } = b;
  if (command.kind === 'reset') {
    b.meter.reset();
    resetWeaponTestTune(b.tune);
    b.guns.main = volleyInterval(b, state.main);
    if (state.sub) b.guns.sub = volleyInterval(b, state.sub);
    return;
  }
  if (
    command.kind === 'mainRate' ||
    command.kind === 'mainDamage' ||
    command.kind === 'homingRate' ||
    command.kind === 'homingDamage'
  ) {
    stepWeaponTestTune(b.tune, command.kind, command.delta);
    return;
  }
  if (command.kind === 'main') {
    const def = weaponForItem('P');
    if (!def) return;
    state.main.id = def.id;
    state.main.level = Math.max(1, Math.min(def.maxLevel, command.level));
    return;
  }
  if (command.kind === 'sub') {
    if (command.level <= 0) {
      state.sub = null;
      return;
    }
    const def = weaponForItem('T');
    if (!def) return;
    const arming = state.sub?.id !== def.id;
    state.sub = { id: def.id, level: Math.max(1, Math.min(def.maxLevel, command.level)) };
    if (arming) b.guns.sub = volleyInterval(b, state.sub);
    return;
  }
  state.bombs = clampWeaponTestBombs(state.bombs + command.delta);
}

export function rangeTaps(b: Battle, input: InputState): void {
  for (const tap of input.taps) {
    const command = weaponTestCommandAt(tap.x, tap.y);
    if (command) applyWeaponCommand(b, command);
  }
}

export function rangeStats(b: Battle): WeaponTestStats {
  const { state, tune, meter } = b;
  return {
    totalDamage: meter.total(),
    dps: meter.dps(b.gameTime),
    lastHit: meter.lastHit(),
    mainLevel: state.main.level,
    subLevel: state.sub?.level ?? 0,
    bombs: state.bombs,
    mainRate: tune.mainRate,
    mainDamage: tune.mainDamage,
    homingRate: tune.homingRate,
    homingDamage: tune.homingDamage,
  };
}

/** Stats while the range is live, else null. */
export function liveRangeStats(b: Battle): WeaponTestStats | null {
  return b.rules().range ? rangeStats(b) : null;
}

/** The range's scripted death: same as a hit. False outside the range or while immune. */
export function rangeTestDeath(b: Battle): boolean {
  if (!b.rules().range || !isPlayerVulnerable(b)) return false;
  killPlayer(b);
  return true;
}

/** Solid backdrop and the immortal target. */
export function drawRangeField(ctx: CanvasRenderingContext2D): void {
  const t = WEAPON_TEST_TARGET;
  ctx.fillStyle = PALETTE[COLOR.SHADOW];
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.fillStyle = PALETTE[COLOR.ENEMY_BRIGHT_RED];
  ctx.fillRect(t.x, t.y, t.w, t.h);
  ctx.strokeStyle = PALETTE[COLOR.WHITE];
  ctx.lineWidth = 1;
  ctx.strokeRect(t.x + 0.5, t.y + 0.5, t.w - 1, t.h - 1);
}

/** Stats panel (left) and loadout / tune controls (right). */
export function drawRangeHud(ctx: CanvasRenderingContext2D, b: Battle): void {
  const stats = rangeStats(b);
  drawPanel(ctx, WEAPON_TEST_STATS_PANEL);
  const textX = WEAPON_TEST_STATS_PANEL.x + 10;
  let textY = WEAPON_TEST_STATS_PANEL.y + 16;
  const line = (text: string): void => {
    drawText(ctx, text, textX, textY, 13, UI_COLORS.text);
    textY += 22;
  };
  line('武器测试');
  line(`总伤害 ${stats.totalDamage}`);
  line(`DPS ${stats.dps.toFixed(1)}`);
  line(`主武器 Lv${stats.mainLevel}`);
  line(stats.subLevel === 0 ? '副武器 无' : `副武器 Lv${stats.subLevel}`);
  line(`上次 ${stats.lastHit}`);

  drawPanel(ctx, WEAPON_TEST_CTRL_PANEL);
  (['P', 'T', 'B'] as const).forEach((label, row) => {
    drawText(ctx, label, WEAPON_TEST_CTRL_PANEL.x + 8, weaponTestRowLabelY(row), 13, UI_COLORS.dim);
  });
  ([1, 2, 3] as const).forEach((level) => {
    drawButton(ctx, weaponTestMainRect(level), String(level), stats.mainLevel === level);
  });
  drawButton(ctx, weaponTestSubRect(0), '关', stats.subLevel === 0);
  drawButton(ctx, weaponTestSubRect(1), '1', stats.subLevel === 1);
  drawButton(ctx, weaponTestSubRect(2), '2', stats.subLevel === 2);
  drawButton(ctx, weaponTestBombDecRect(), '-', false);
  const count = weaponTestBombCountRect();
  drawText(
    ctx,
    String(stats.bombs),
    count.x + count.w / 2,
    count.y + count.h / 2,
    14,
    UI_COLORS.text,
    'center'
  );
  drawButton(ctx, weaponTestBombIncRect(), '+', false);
  for (const field of WEAPON_TEST_TUNE_FIELDS) {
    drawText(
      ctx,
      WEAPON_TEST_TUNE_LABEL[field],
      WEAPON_TEST_CTRL_PANEL.x + 8,
      weaponTestRowLabelY(weaponTestTuneRow(field)),
      12,
      UI_COLORS.dim
    );
    drawButton(ctx, weaponTestTuneDecRect(field), '-', false);
    const value = weaponTestTuneValueRect(field);
    drawText(
      ctx,
      formatWeaponTestNumber(stats[field]),
      value.x + value.w / 2,
      value.y + value.h / 2,
      12,
      UI_COLORS.text,
      'center'
    );
    drawButton(ctx, weaponTestTuneIncRect(field), '+', false);
  }
  drawButton(ctx, weaponTestResetRect(), '重置', false);
}
