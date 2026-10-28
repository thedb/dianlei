/**
 * 黑曜 fight and saucer clocks. No pixels: the draw pass is smoked from the
 * stage-4 battle test. Numbers are the locked draft in config.ts.
 */

import { describe, expect, it } from 'vitest';
import {
  AIMED_MIN_DIST,
  DIFFICULTY_HP_HARD,
  DIFFICULTY_HP_MEDIUM,
  FIXED_DT,
  HITBOX_RADIUS,
  OBSIDIAN_BEAM,
  OBSIDIAN_BREAK_AT,
  OBSIDIAN_BREAK_EXPLOSIONS,
  OBSIDIAN_CENTER_X,
  OBSIDIAN_CHARGE,
  OBSIDIAN_CYCLE,
  OBSIDIAN_ENTER_DURATION,
  OBSIDIAN_ENTER_Y,
  OBSIDIAN_FAN_COUNT,
  OBSIDIAN_FAN_SETTLE,
  OBSIDIAN_FAN_SPEED,
  OBSIDIAN_FRAME_HP,
  OBSIDIAN_FRAME_SCORE,
  OBSIDIAN_HULL_H,
  OBSIDIAN_MISSILE_COUNT,
  OBSIDIAN_MISSILE_FIRST,
  OBSIDIAN_MISSILE_GAP,
  OBSIDIAN_MISSILE_HOMING,
  OBSIDIAN_MISSILE_SPEED,
  OBSIDIAN_OVERLOAD_CYCLE,
  OBSIDIAN_OVERLOAD_FAN_COUNT,
  OBSIDIAN_OVERLOAD_HP,
  OBSIDIAN_OVERLOAD_MISSILE_COUNT,
  OBSIDIAN_OVERLOAD_POLY_TIME,
  OBSIDIAN_OVERLOAD_SLICE,
  OBSIDIAN_OVERLOAD_STRAFE_BOTTOM,
  OBSIDIAN_OVERLOAD_STRAFE_LANE_GAP,
  OBSIDIAN_OVERLOAD_STRAFE_LANES,
  OBSIDIAN_OVERLOAD_STRAFE_ROUNDS,
  OBSIDIAN_PARK_Y,
  OBSIDIAN_PERCH_X,
  OBSIDIAN_PHASE_INVULN,
  OBSIDIAN_POLY_TIME,
  OBSIDIAN_RADIUS,
  OBSIDIAN_SAUCER_DIAMETER,
  OBSIDIAN_SAUCER_EXIT,
  OBSIDIAN_SAUCER_EXIT_Y,
  OBSIDIAN_SAUCER_FROM_Y,
  OBSIDIAN_SAUCER_HOLD,
  OBSIDIAN_SAUCER_SLIDE,
  OBSIDIAN_SAUCER_TOTAL,
  OBSIDIAN_SAUCER_TRAVEL,
  OBSIDIAN_SAUCER_X,
  OBSIDIAN_SAUCER_Y,
  OBSIDIAN_SLICE,
  OBSIDIAN_STRAFE_BOTTOM,
  OBSIDIAN_STRAFE_DIVE,
  OBSIDIAN_STRAFE_DIVE_Y,
  OBSIDIAN_STRAFE_LANE_GAP,
  OBSIDIAN_STRAFE_LANES,
  OBSIDIAN_STRAFE_ROUNDS,
  OBSIDIAN_STRAFE_SPEED,
  OBSIDIAN_STRAFE_TELL,
  OBSIDIAN_STRAFE_Y_MAX,
  OBSIDIAN_WING_X,
  OBSIDIAN_WING_Y,
  OBSIDIAN_WRECK_X,
  OBSIDIAN_WRECK_Y,
} from '@/game/config';
import { prepareBossConfig } from '@/game/difficulty';
import { OBSIDIAN } from '@/game/levels/bosses/obsidian';
import { buildObsidianHull } from '@/game/art/obsidianLooks';
import { buildSaucerDisc } from '@/game/art/saucerSprite';
import { COLOR } from '@/game/palette';
import { FIRE_PRESETS } from '@/game/systems/danmaku';
import {
  applyBossBomb,
  bossHitsPlayer,
  bossHpBarLayout,
  bossPart,
  createBoss,
  resolveBossBullet,
  updateBoss,
  type BossEvents,
  type BossRuntime,
  type BossWorld,
} from './boss';
import { obsidianSaucerCenterY, obsidianSaucerView } from './obsidianSaucer';
import { createVictoryExit, stepVictoryExit } from './victoryExit';

const PLAYER_CYAN = [
  COLOR.PLAYER_CYAN,
  COLOR.PLAYER_MED_CYAN,
  COLOR.PLAYER_DARK_CYAN,
  COLOR.PLAYER_BLUE,
];

function world(rng: () => number = () => 0, playerX = 40): BossWorld {
  return { playerX, playerY: 560, rng };
}

function make(difficulty: 'easy' | 'medium' | 'hard' = 'easy'): BossRuntime {
  const gates = difficulty === 'hard' ? ['hard'] : [];
  return createBoss(prepareBossConfig(OBSIDIAN, difficulty), { gates });
}

function frame(boss: BossRuntime) {
  return bossPart(boss, 'frame')!;
}

function go(boss: BossRuntime, dt: number, around: BossWorld = world()): BossEvents {
  return updateBoss(boss, dt, around);
}

function park(boss: BossRuntime, around: BossWorld = world()): void {
  const ev = go(boss, OBSIDIAN_ENTER_DURATION, around);
  expect(boss.stage).toBe('fight');
  expect(boss.y).toBe(OBSIDIAN_PARK_Y);
  expect(boss.x).toBe(OBSIDIAN_CENTER_X);
  expect(ev.bolts).toEqual([]);
  expect(ev.clearBullets).toBe(false);
}

function shot(boss: BossRuntime, x: number, y: number, damage = 1) {
  return resolveBossBullet(boss, { x, y, w: 4, h: 12 }, damage);
}

function kill(boss: BossRuntime): BossEvents {
  return shot(boss, boss.x, boss.y, 1_000_000);
}

function colorsOf(grid: number[][]): number[] {
  const found = new Set<number>();
  for (const row of grid) {
    for (const cell of row) {
      if (cell >= 0) found.add(cell);
    }
  }
  return [...found];
}

describe('黑曜 constants', () => {
  it('locks the lap, the dive, and the 6.80s saucer arithmetic', () => {
    expect(OBSIDIAN_PERCH_X).toEqual([96, 180, 264]);
    expect(OBSIDIAN_SLICE * 3).toBeCloseTo(4.8, 8);
    expect(OBSIDIAN_CYCLE).toBeCloseTo(4.8, 8);
    expect(OBSIDIAN_OVERLOAD_SLICE * 3).toBeCloseTo(3.6, 8);
    expect(OBSIDIAN_OVERLOAD_CYCLE).toBeCloseTo(3.6, 8);
    expect(OBSIDIAN_POLY_TIME).toBeGreaterThanOrEqual(0.45);
    expect(OBSIDIAN_POLY_TIME).toBe(0.45);
    expect(OBSIDIAN_OVERLOAD_POLY_TIME).toBe(0.32);
    expect(OBSIDIAN_FAN_SETTLE).toBe(0.15);
    expect(OBSIDIAN_FAN_SETTLE).toBeGreaterThanOrEqual(0.12);
    expect(OBSIDIAN_STRAFE_DIVE_Y).toBe(280);
    expect(OBSIDIAN_STRAFE_DIVE_Y).toBeLessThanOrEqual(OBSIDIAN_STRAFE_Y_MAX);
    expect(OBSIDIAN_STRAFE_Y_MAX).toBe(320);
    expect(OBSIDIAN_RADIUS).toBe(32);
    expect(OBSIDIAN_FRAME_HP).toBe(800);
    expect(OBSIDIAN_OVERLOAD_HP).toBe(240);
    expect(OBSIDIAN_FRAME_SCORE).toBe(40000);
    expect(OBSIDIAN_SAUCER_TOTAL).toBe(6.8);
    expect(OBSIDIAN_SAUCER_Y - OBSIDIAN_SAUCER_DIAMETER / 2).toBe(-4);
    expect(OBSIDIAN_SAUCER_Y + OBSIDIAN_SAUCER_DIAMETER / 2).toBe(204);
    const hullTop = OBSIDIAN_WRECK_Y - OBSIDIAN_HULL_H / 2;
    const discBottom = OBSIDIAN_SAUCER_Y + OBSIDIAN_SAUCER_DIAMETER / 2;
    expect(hullTop - discBottom).toBe(48);
    expect(Math.abs(OBSIDIAN_WRECK_Y - OBSIDIAN_SAUCER_Y)).toBe(200);
    expect(
      OBSIDIAN_SAUCER_SLIDE +
        OBSIDIAN_SAUCER_TRAVEL +
        OBSIDIAN_SAUCER_HOLD +
        OBSIDIAN_CHARGE +
        OBSIDIAN_BEAM
    ).toBeCloseTo(OBSIDIAN_BREAK_AT, 8);
    expect(OBSIDIAN_BREAK_AT + OBSIDIAN_SAUCER_EXIT).toBeCloseTo(OBSIDIAN_SAUCER_TOTAL, 8);
    expect(OBSIDIAN.phases.every((phase) => phase.attacks.length === 0)).toBe(true);
    expect('saucer' in FIRE_PRESETS).toBe(false);
    expect('beam' in FIRE_PRESETS).toBe(false);
  });

  it('keeps player cyan off the disc and the wreck', () => {
    for (const cell of colorsOf(buildSaucerDisc())) {
      expect(PLAYER_CYAN).not.toContain(cell);
      expect(cell).toBeGreaterThanOrEqual(3);
      expect(cell).toBeLessThanOrEqual(9);
      expect(cell).not.toBe(8);
    }
    for (const kind of ['warm', 'wreck'] as const) {
      for (const cell of colorsOf(buildObsidianHull(kind))) {
        expect(PLAYER_CYAN).not.toContain(cell);
      }
    }
  });
});

describe('黑曜 enter and weapons', () => {
  it('is damageable on the way in and does not fire', () => {
    const boss = make();
    expect(boss.invulnerable).toBe(false);
    expect(boss.y).toBe(OBSIDIAN_ENTER_Y);
    const before = frame(boss).hp;
    expect(shot(boss, boss.x, boss.y, 5).consumedBullet).toBe(true);
    expect(frame(boss).hp).toBe(before - 5);
    expect(applyBossBomb(boss).score).toBe(0);
    expect(frame(boss).hp).toBeLessThan(before - 5);
    const ev = go(boss, 0.5);
    expect(boss.stage).toBe('enter');
    expect(ev.bolts).toEqual([]);
    expect(boss.y).toBeGreaterThan(OBSIDIAN_ENTER_Y);
    expect(boss.y).toBeLessThan(OBSIDIAN_PARK_Y);
  });

  it('fires five missiles from the wings, then holds y through the polyline', () => {
    const around = world();
    const boss = make();
    park(boss, around);
    const armed = go(boss, OBSIDIAN_MISSILE_FIRST + 4 * OBSIDIAN_MISSILE_GAP + 0.02, around);
    expect(armed.bolts).toHaveLength(OBSIDIAN_MISSILE_COUNT);
    expect(armed.bolts.every((bolt) => bolt.type === 'missile')).toBe(true);
    expect(armed.bolts.every((bolt) => bolt.homing === OBSIDIAN_MISSILE_HOMING)).toBe(true);
    const speed = Math.hypot(armed.bolts[0]!.vx, armed.bolts[0]!.vy);
    expect(speed).toBeCloseTo(OBSIDIAN_MISSILE_SPEED, 6);
    const xs = armed.bolts.map((bolt) => bolt.x);
    expect(xs[0]).toBe(OBSIDIAN_CENTER_X - OBSIDIAN_WING_X);
    expect(xs[1]).toBe(OBSIDIAN_CENTER_X + OBSIDIAN_WING_X);
    expect(armed.bolts.every((bolt) => bolt.y === OBSIDIAN_PARK_Y + OBSIDIAN_WING_Y)).toBe(true);

    go(boss, OBSIDIAN_SLICE - (OBSIDIAN_MISSILE_FIRST + 4 * OBSIDIAN_MISSILE_GAP + 0.02), around);
    expect(boss.y).toBe(OBSIDIAN_PARK_Y);
    const quiet = go(boss, OBSIDIAN_POLY_TIME - 0.05, around);
    expect(quiet.bolts).toEqual([]);
    expect(boss.y).toBe(OBSIDIAN_PARK_Y);
    expect(boss.x).toBeLessThan(OBSIDIAN_CENTER_X);
    expect(boss.x).toBeGreaterThan(OBSIDIAN_PERCH_X[0]);
    const hp = frame(boss).hp;
    expect(shot(boss, boss.x, boss.y, 7).consumedBullet).toBe(true);
    expect(frame(boss).hp).toBe(hp - 7);
    expect(boss.stage).toBe('fight');
  });

  it('fires one fan only after the polyline has landed', () => {
    const around = world();
    const boss = make();
    park(boss, around);
    go(boss, OBSIDIAN_SLICE + OBSIDIAN_POLY_TIME, around);
    expect(boss.x).toBe(OBSIDIAN_PERCH_X[0]);
    expect(boss.y).toBe(OBSIDIAN_PARK_Y);
    const fan = go(boss, OBSIDIAN_FAN_SETTLE, around);
    const large = fan.bolts.filter((bolt) => bolt.type === 'large');
    expect(large).toHaveLength(OBSIDIAN_FAN_COUNT);
    expect(fan.bolts).toHaveLength(OBSIDIAN_FAN_COUNT);
    for (const bolt of large) {
      expect(Math.hypot(bolt.vx, bolt.vy)).toBeCloseTo(OBSIDIAN_FAN_SPEED, 5);
    }
  });

  it('strafes on a fixed x and fires only on the bottom leg', () => {
    const calls = { n: 0 };
    const around = world(() => {
      calls.n += 1;
      return 0;
    }, 20);
    const boss = make();
    park(boss, around);
    go(boss, OBSIDIAN_SLICE * 2, around);
    expect(calls.n).toBe(1);
    expect(boss.x).toBe(OBSIDIAN_PERCH_X[0]);
    expect(boss.y).toBe(OBSIDIAN_PARK_Y);

    const tell = go(boss, OBSIDIAN_STRAFE_TELL, around);
    expect(tell.bolts.filter((bolt) => bolt.type === 'small')).toEqual([]);
    expect(boss.x).toBe(OBSIDIAN_PERCH_X[0]);
    expect(boss.y).toBe(OBSIDIAN_PARK_Y);

    const dive = go(boss, OBSIDIAN_STRAFE_DIVE - OBSIDIAN_STRAFE_TELL - FIXED_DT, around);
    expect(dive.bolts.filter((bolt) => bolt.type === 'small')).toEqual([]);
    expect(boss.y).toBeGreaterThan(OBSIDIAN_PARK_Y);
    expect(boss.y).toBeLessThan(OBSIDIAN_STRAFE_DIVE_Y);
    expect(boss.y).toBeLessThanOrEqual(OBSIDIAN_STRAFE_Y_MAX);
    expect(boss.x).toBe(OBSIDIAN_PERCH_X[0]);

    const bottom = go(boss, OBSIDIAN_STRAFE_BOTTOM - OBSIDIAN_STRAFE_DIVE + FIXED_DT, around);
    const small = bottom.bolts.filter((bolt) => bolt.type === 'small');
    expect(small).toHaveLength(OBSIDIAN_STRAFE_ROUNDS * OBSIDIAN_STRAFE_LANES);
    expect(boss.y).toBe(OBSIDIAN_STRAFE_DIVE_Y);
    expect(boss.x).toBe(OBSIDIAN_PERCH_X[0]);
    const lanes = [...new Set(small.map((bolt) => bolt.x))].sort((a, b) => a - b);
    expect(lanes).toEqual([
      OBSIDIAN_PERCH_X[0] - OBSIDIAN_STRAFE_LANE_GAP / 2,
      OBSIDIAN_PERCH_X[0] + OBSIDIAN_STRAFE_LANE_GAP / 2,
    ]);
    expect(small.every((bolt) => bolt.vx === 0 && bolt.vy === OBSIDIAN_STRAFE_SPEED)).toBe(true);

    const hp = frame(boss).hp;
    expect(shot(boss, boss.x, boss.y, 3).consumedBullet).toBe(true);
    expect(frame(boss).hp).toBe(hp - 3);

    const climb = go(boss, OBSIDIAN_SLICE - OBSIDIAN_STRAFE_BOTTOM, around);
    expect(climb.bolts.filter((bolt) => bolt.type === 'small')).toEqual([]);
    expect(boss.y).toBe(OBSIDIAN_PARK_Y);
    expect(boss.x).toBe(OBSIDIAN_PERCH_X[0]);
    expect(calls.n).toBe(1);
    expect(bossHitsPlayer(boss, boss.x, boss.y)).toBe(true);
    expect(bossHitsPlayer(boss, boss.x + 36, boss.y)).toBe(false);
  });
});

describe('黑曜 hit circle', () => {
  it('stops a bullet on the frame circle and lets the hull corners through', () => {
    const boss = make();
    park(boss);
    expect(shot(boss, boss.x + 36, boss.y).consumedBullet).toBe(false);
    expect(shot(boss, boss.x, boss.y + 40).consumedBullet).toBe(false);
    expect(frame(boss).hp).toBe(OBSIDIAN_FRAME_HP);
    expect(shot(boss, boss.x, boss.y, 4).consumedBullet).toBe(true);
    expect(frame(boss).hp).toBe(OBSIDIAN_FRAME_HP - 4);
    const reach = OBSIDIAN_RADIUS + HITBOX_RADIUS;
    expect(bossHitsPlayer(boss, boss.x + reach - 0.1, boss.y)).toBe(true);
    expect(bossHitsPlayer(boss, boss.x + 36, boss.y)).toBe(false);
    expect(AIMED_MIN_DIST).toBe(48);
  });
});

describe('黑曜 saucer', () => {
  it('slides from a mid-polyline pose and does not clear the fight early', () => {
    const around = world();
    const boss = make();
    park(boss, around);
    go(boss, OBSIDIAN_SLICE + 0.2, around);
    expect(boss.x).not.toBe(OBSIDIAN_WRECK_X);
    expect(boss.y).toBe(OBSIDIAN_PARK_Y);
    const fromX = boss.x;
    const emptied = kill(boss);
    expect(emptied.score).toBe(OBSIDIAN_FRAME_SCORE);
    expect(emptied.explosions).toEqual([]);
    expect(emptied.clearBullets).toBe(false);
    expect(emptied.convertBullets).toBe(false);
    expect(boss.stage).toBe('saucer');
    expect(boss.phase).toBe('saucer');
    expect(boss.x).toBe(fromX);
    expect(bossHpBarLayout(boss).mainFill).toBe(0);

    const exit = createVictoryExit();
    expect(stepVictoryExit(exit, boss.phase, FIXED_DT, 180, 400, 180, 480)).toBe('none');
    expect(exit.phase).toBe('idle');

    const half = go(boss, 0.4);
    const rest = go(boss, 0.4);
    expect(half.explosions).toEqual([]);
    expect(rest.explosions).toEqual([]);
    expect(boss.y).toBeCloseTo(OBSIDIAN_PARK_Y + (OBSIDIAN_WRECK_Y - OBSIDIAN_PARK_Y) * 0.75, 5);
    expect(boss.y).not.toBeCloseTo(OBSIDIAN_PARK_Y, 0);

    go(boss, OBSIDIAN_SAUCER_SLIDE - 0.8);
    expect(boss.x).toBe(OBSIDIAN_WRECK_X);
    expect(boss.y).toBe(OBSIDIAN_WRECK_Y);
    expect(obsidianSaucerCenterY(OBSIDIAN_SAUCER_SLIDE)).toBe(OBSIDIAN_SAUCER_FROM_Y);
    expect(obsidianSaucerView(boss).saucerY).toBe(OBSIDIAN_SAUCER_FROM_Y);
    expect(shot(boss, OBSIDIAN_SAUCER_X, OBSIDIAN_SAUCER_Y, 9).consumedBullet).toBe(false);
    expect(applyBossBomb(boss).explosions).toEqual([]);
    expect(bossHitsPlayer(boss, boss.x, boss.y)).toBe(false);

    go(boss, OBSIDIAN_SAUCER_TRAVEL + OBSIDIAN_SAUCER_HOLD);
    let view = obsidianSaucerView(boss);
    expect(view.saucerY).toBe(OBSIDIAN_SAUCER_Y);
    expect(view.charge).toBe(true);
    expect(view.beam).toBe(false);
    expect(view.showName).toBe(true);

    go(boss, OBSIDIAN_CHARGE);
    view = obsidianSaucerView(boss);
    expect(view.beam).toBe(true);
    expect(view.broken).toBe(false);
    expect(view.saucerY).toBe(OBSIDIAN_SAUCER_Y);

    const broke = go(boss, OBSIDIAN_BEAM);
    expect(broke.cutscene).toBe(true);
    expect(broke.explosions).toHaveLength(1);
    expect(broke.clearBullets).toBe(false);
    view = obsidianSaucerView(boss);
    expect(view.broken).toBe(true);
    expect(view.showName).toBe(false);
    expect(view.beam).toBe(false);
    expect(view.saucerY).toBe(OBSIDIAN_SAUCER_Y);
    expect(boss.phase).toBe('saucer');

    const leaving = go(boss, OBSIDIAN_SAUCER_EXIT);
    expect(leaving.explosions.length).toBe(OBSIDIAN_BREAK_EXPLOSIONS - 1);
    expect(leaving.clearBullets).toBe(false);
    expect(obsidianSaucerView(boss).saucerY).toBeCloseTo(OBSIDIAN_SAUCER_EXIT_Y, 6);
    expect(boss.stage).toBe('clear');
    expect(boss.phase).toBe('clear');
    expect(stepVictoryExit(exit, boss.phase, FIXED_DT, 180, 400, 180, 480)).toBe('cinematic');
    expect(exit.phase).toBe('wait');
  });

  it('gives Easy and Medium one bar, and waits for the Hard overload to empty', () => {
    const easy = make('easy');
    park(easy);
    expect(easy.phases.map((phase) => phase.id)).toEqual(['fight']);
    expect(easy.extraMax).toBe(0);
    expect(kill(easy).score).toBe(OBSIDIAN_FRAME_SCORE);
    expect(easy.stage).toBe('saucer');

    const medium = make('medium');
    expect(frame(medium).hp).toBeCloseTo(OBSIDIAN_FRAME_HP * DIFFICULTY_HP_MEDIUM, 6);
    expect(medium.phases).toHaveLength(1);
    park(medium);
    expect(kill(medium).score).toBe(OBSIDIAN_FRAME_SCORE);
    expect(medium.stage).toBe('saucer');

    const hard = make('hard');
    park(hard);
    expect(hard.phases.map((phase) => phase.id)).toEqual(['fight', 'overload']);
    const first = kill(hard);
    expect(first.score).toBe(0);
    expect(first.explosions).toEqual([]);
    expect(first.clearBullets).toBe(false);
    expect(hard.stage).toBe('transition');
    expect(hard.invulnerable).toBe(true);
    const during = frame(hard).hp;
    expect(during).toBeCloseTo(OBSIDIAN_OVERLOAD_HP * DIFFICULTY_HP_HARD, 6);
    expect(applyBossBomb(hard).explosions).toEqual([]);
    expect(frame(hard).hp).toBe(during);
    expect(shot(hard, hard.x, hard.y, 50).consumedBullet).toBe(true);
    expect(frame(hard).hp).toBe(during);

    go(hard, OBSIDIAN_PHASE_INVULN);
    expect(hard.stage).toBe('fight');
    expect(hard.phase).toBe('overload');
    expect(hard.invulnerable).toBe(false);
    expect(hard.y).toBe(OBSIDIAN_PARK_Y);
    expect(bossHpBarLayout(hard).extraFill).toBeCloseTo(1, 6);
    expect(bossHpBarLayout(hard).mainFill).toBe(0);

    const volley = go(hard, OBSIDIAN_OVERLOAD_SLICE);
    expect(volley.bolts.filter((bolt) => bolt.type === 'missile')).toHaveLength(
      OBSIDIAN_OVERLOAD_MISSILE_COUNT
    );
    const moved = go(hard, OBSIDIAN_OVERLOAD_POLY_TIME);
    expect(moved.bolts.filter((bolt) => bolt.type === 'large')).toEqual([]);
    expect(hard.y).toBe(OBSIDIAN_PARK_Y);
    const fan = go(hard, OBSIDIAN_FAN_SETTLE);
    expect(fan.bolts.filter((bolt) => bolt.type === 'large')).toHaveLength(
      OBSIDIAN_OVERLOAD_FAN_COUNT
    );

    const fresh = make('hard');
    park(fresh);
    kill(fresh);
    go(fresh, OBSIDIAN_PHASE_INVULN);
    go(fresh, OBSIDIAN_OVERLOAD_SLICE * 2);
    expect(fresh.y).toBe(OBSIDIAN_PARK_Y);
    const dropped = go(fresh, OBSIDIAN_OVERLOAD_STRAFE_BOTTOM);
    const small = dropped.bolts.filter((bolt) => bolt.type === 'small');
    const fitting = Math.min(
      OBSIDIAN_OVERLOAD_STRAFE_ROUNDS,
      Math.floor((OBSIDIAN_OVERLOAD_STRAFE_BOTTOM - 0.5) / 0.1) + 1
    );
    expect(fitting).toBe(3);
    expect(small).toHaveLength(fitting * OBSIDIAN_OVERLOAD_STRAFE_LANES);
    const laneX = [...new Set(small.map((bolt) => bolt.x))].sort((a, b) => a - b);
    expect(laneX).toEqual([
      fresh.x - OBSIDIAN_OVERLOAD_STRAFE_LANE_GAP,
      fresh.x,
      fresh.x + OBSIDIAN_OVERLOAD_STRAFE_LANE_GAP,
    ]);
    expect(fresh.y).toBe(OBSIDIAN_STRAFE_DIVE_Y);
    expect(fresh.y).toBeLessThanOrEqual(OBSIDIAN_STRAFE_Y_MAX);

    expect(kill(fresh).score).toBe(OBSIDIAN_FRAME_SCORE);
    expect(fresh.stage).toBe('saucer');
    expect(bossHpBarLayout(fresh).extraFill).toBe(0);
    expect(bossHpBarLayout(fresh).mainFill).toBe(0);
  });
});
