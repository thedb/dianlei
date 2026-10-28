/**
 * 黑曜 blade-cross fight and the saucer clock. Numbers are the draft in
 * config.ts. The draw pass is smoked from the stage-4 battle test.
 */

import { describe, expect, it } from 'vitest';
import {
  AIMED_MIN_DIST,
  DIFFICULTY_HP_HARD,
  DIFFICULTY_HP_MEDIUM,
  FIXED_DT,
  OBSIDIAN_BEAM,
  OBSIDIAN_BLADE_H,
  OBSIDIAN_BLADE_W,
  OBSIDIAN_BREAK_AT,
  OBSIDIAN_BREAK_EXPLOSIONS,
  OBSIDIAN_CENTER_X,
  OBSIDIAN_CHARGE,
  OBSIDIAN_CYCLE,
  OBSIDIAN_DEPLOY_TIME,
  OBSIDIAN_ENTER_DURATION,
  OBSIDIAN_ENTER_Y,
  OBSIDIAN_FAN_SPEED,
  OBSIDIAN_FOLD_CYCLE,
  OBSIDIAN_FRAME_HP,
  OBSIDIAN_FRAME_SCORE,
  OBSIDIAN_HALF_CYCLE,
  OBSIDIAN_HULL_H,
  OBSIDIAN_MAIN_HP,
  OBSIDIAN_MISSILE_B_COUNT,
  OBSIDIAN_MISSILE_COUNT,
  OBSIDIAN_MISSILE_HOMING,
  OBSIDIAN_NOSE_COUNT,
  OBSIDIAN_OVERLOAD_CRUISE_FLAME,
  OBSIDIAN_OVERLOAD_FAN_COUNT,
  OBSIDIAN_OVERLOAD_HP,
  OBSIDIAN_OVERLOAD_SPAN,
  OBSIDIAN_OVERLOAD_STRAFE_AT,
  OBSIDIAN_OVERLOAD_STRAFE_DIVE,
  OBSIDIAN_PARK_Y,
  OBSIDIAN_PHASE_INVULN,
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
  OBSIDIAN_STRAFE_DIVE,
  OBSIDIAN_STRAFE_DIVE_Y,
  OBSIDIAN_STRAFE_Y_MAX,
  OBSIDIAN_WRECK_X,
  OBSIDIAN_WRECK_Y,
} from '@/game/config';
import { COLOR } from '@/game/palette';
import { FIRE_PRESETS } from '@/game/systems/danmaku';
import { prepareBossConfig } from '@/game/difficulty';
import { OBSIDIAN } from '@/game/levels/bosses/obsidian';
import {
  OBSIDIAN_BLADE_PIVOT_X,
  buildObsidianBlade,
  buildObsidianHinge,
  buildObsidianHull,
} from '@/game/art/obsidianLooks';
import { buildSaucerDisc } from '@/game/art/saucerSprite';
import {
  applyBossBomb,
  bossHpBarLayout,
  bossHitsPlayer,
  bossMissileTargets,
  bossPart,
  createBoss,
  resolveBossBullet,
  updateBoss,
  type BossEvents,
  type BossRuntime,
  type BossWorld,
} from './boss';
import { OBSIDIAN_BLADES, obsidianBladeAngle, obsidianJettison, obsidianMotion } from './obsidian';
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

function go(boss: BossRuntime, dt: number, around: BossWorld = world()): BossEvents {
  return updateBoss(boss, dt, around);
}

function park(boss: BossRuntime, around: BossWorld = world()): void {
  const ev = go(boss, OBSIDIAN_ENTER_DURATION, around);
  expect(boss.stage).toBe('fight');
  expect(boss.phase).toBe('folded');
  expect(boss.y).toBe(OBSIDIAN_PARK_Y);
  expect(boss.x).toBe(OBSIDIAN_CENTER_X);
  expect(ev.bolts).toEqual([]);
  expect(ev.clearBullets).toBe(false);
}

function shot(boss: BossRuntime, x: number, y: number, damage = 1) {
  return resolveBossBullet(boss, { x, y, w: 4, h: 12 }, damage);
}

function clearTargets(boss: BossRuntime): BossEvents {
  const phase = boss.phases[boss.phaseIndex]!;
  const ids = [
    ...phase.targets.filter((id) => id !== 'frame'),
    ...phase.targets.filter((id) => id === 'frame'),
  ];
  let ev = shot(boss, boss.x + 400, boss.y, 1);
  for (const id of ids) {
    const item = bossPart(boss, id);
    if (!item?.alive) continue;
    ev = shot(boss, item.worldX, item.worldY, item.hp + 1);
  }
  return ev;
}

function reach(boss: BossRuntime, id: string): void {
  for (let i = 0; i < 8 && !(boss.stage === 'fight' && boss.phase === id); i++) {
    if (boss.stage === 'transition') {
      const duration = boss.phases[boss.phaseIndex]?.transition?.duration ?? OBSIDIAN_DEPLOY_TIME;
      go(boss, Math.max(0, duration - boss.phaseTime));
    } else clearTargets(boss);
  }
  expect(boss.stage).toBe('fight');
  expect(boss.phase).toBe(id);
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
  it('splits about 1200 across locks, blades, and the fuselage', () => {
    expect(OBSIDIAN_MAIN_HP).toBe(1200);
    expect(OBSIDIAN.parts.reduce((sum, part) => sum + part.hp, 0)).toBe(OBSIDIAN_MAIN_HP);
    expect(OBSIDIAN_FRAME_HP).toBe(300);
    expect(OBSIDIAN_OVERLOAD_HP).toBe(360);
    expect(OBSIDIAN_RADIUS).toBe(32);
    expect(OBSIDIAN.parts[0]?.id).toBe('frame');
    expect(OBSIDIAN.parts[0]?.radius).toBe(32);
    expect(OBSIDIAN.phases.map((phase) => phase.id)).toEqual([
      'folded',
      'half',
      'open',
      'overload',
    ]);
    expect(OBSIDIAN.phases[0]?.targets).toEqual(['hinge0', 'hinge1', 'hinge2', 'hinge3']);
    expect(OBSIDIAN.phases[1]?.targets).toEqual(['outerL', 'outerR']);
    expect(OBSIDIAN.phases[2]?.targets).toEqual(['innerL', 'innerR', 'frame']);
    expect(OBSIDIAN_DEPLOY_TIME).toBeGreaterThanOrEqual(1);
    expect(OBSIDIAN_DEPLOY_TIME).toBeLessThanOrEqual(1.2);
    expect(OBSIDIAN_PHASE_INVULN).toBe(1.2);
    expect(OBSIDIAN_FRAME_SCORE).toBe(40000);
    expect(OBSIDIAN.phases.every((phase) => phase.attacks.length === 0)).toBe(true);
    expect(OBSIDIAN_CYCLE).toBeCloseTo(4.8, 8);
    expect(OBSIDIAN_SLICE * 3).toBeCloseTo(4.8, 8);
    expect(OBSIDIAN_STRAFE_DIVE_Y).toBe(280);
    expect(OBSIDIAN_STRAFE_DIVE_Y).toBeLessThanOrEqual(OBSIDIAN_STRAFE_Y_MAX);
    expect(OBSIDIAN_SAUCER_TOTAL).toBe(6.8);
    expect(
      OBSIDIAN_SAUCER_SLIDE +
        OBSIDIAN_SAUCER_TRAVEL +
        OBSIDIAN_SAUCER_HOLD +
        OBSIDIAN_CHARGE +
        OBSIDIAN_BEAM
    ).toBeCloseTo(OBSIDIAN_BREAK_AT, 8);
    expect(OBSIDIAN_BREAK_AT + OBSIDIAN_SAUCER_EXIT).toBeCloseTo(OBSIDIAN_SAUCER_TOTAL, 8);
    expect(OBSIDIAN_SAUCER_Y - OBSIDIAN_SAUCER_DIAMETER / 2).toBe(-4);
    const hullTop = OBSIDIAN_WRECK_Y - OBSIDIAN_HULL_H / 2;
    const discBottom = OBSIDIAN_SAUCER_Y + OBSIDIAN_SAUCER_DIAMETER / 2;
    expect(hullTop - discBottom).toBe(48);
    expect('saucer' in FIRE_PRESETS).toBe(false);
    expect('beam' in FIRE_PRESETS).toBe(false);
    expect(OBSIDIAN_ENTER_Y).toBe(-70);
    expect(AIMED_MIN_DIST).toBe(48);
  });

  it('keeps player cyan off the fuselage and the disc, and paints crystal blades', () => {
    for (const cell of colorsOf(buildSaucerDisc())) {
      expect(PLAYER_CYAN).not.toContain(cell);
    }
    const warm = buildObsidianHull('warm');
    const warn = buildObsidianHull('warn');
    const wreck = buildObsidianHull('wreck');
    const inner = buildObsidianBlade('inner');
    const outer = buildObsidianBlade('outer');
    const hinge = buildObsidianHinge('live');
    const hingeDead = buildObsidianHinge('dead');
    for (const grid of [warm, warn, wreck, hinge, hingeDead]) {
      for (const cell of colorsOf(grid)) expect(PLAYER_CYAN).not.toContain(cell);
    }
    expect(colorsOf(warm)).toContain(COLOR.EXPLOSION_ORANGE);
    expect(colorsOf(warm)).toContain(COLOR.ENEMY_RED);
    expect(colorsOf(warm)).not.toContain(COLOR.EXPLOSION_YELLOW);
    expect(colorsOf(warn)).toContain(COLOR.EXPLOSION_YELLOW);
    expect(colorsOf(wreck)).not.toContain(COLOR.EXPLOSION_YELLOW);
    expect(colorsOf(inner)).toContain(COLOR.PLAYER_CYAN);
    expect(colorsOf(inner)).toContain(COLOR.PLAYER_DARK_CYAN);
    expect(colorsOf(inner)).toContain(COLOR.EXPLOSION_ORANGE);
    expect(colorsOf(outer)).toContain(COLOR.PLAYER_CYAN);
    expect(colorsOf(hinge)).toContain(COLOR.EXPLOSION_ORANGE);
    expect(colorsOf(hingeDead)).not.toContain(COLOR.EXPLOSION_ORANGE);
    expect(inner.flat().join(',')).not.toBe(outer.flat().join(','));
    const span = (grid: number[][], y: number) => {
      const xs = grid[y]!.flatMap((cell, x) => (cell >= 0 ? [x] : []));
      return xs.length ? xs[xs.length - 1]! - xs[0]! : 0;
    };
    expect(span(outer, 40)).toBeGreaterThan(span(inner, 40));
    let outboard = 0;
    let inboard = 0;
    for (let y = 0; y < inner.length; y++) {
      for (let x = 0; x < (inner[y]?.length ?? 0); x++) {
        if (inner[y]![x]! < 0) continue;
        if (x < OBSIDIAN_BLADE_PIVOT_X) outboard++;
        else if (x > OBSIDIAN_BLADE_PIVOT_X) inboard++;
      }
    }
    expect(outboard).toBeGreaterThan(inboard);
    expect(inner.length).toBe(OBSIDIAN_BLADE_H);
    expect(inner[0]?.length).toBe(OBSIDIAN_BLADE_W);
    expect(inner.length).toBeGreaterThan(OBSIDIAN_BLADE_W * 3);

    let minX = 80;
    let maxX = 0;
    let nose = 0;
    for (let y = 0; y < warm.length; y++) {
      for (let x = 0; x < (warm[y]?.length ?? 0); x++) {
        if (warm[y]![x]! < 0) continue;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        if (y >= 90) nose++;
      }
    }
    expect(minX).toBeGreaterThanOrEqual(6);
    expect(maxX).toBeLessThanOrEqual(74);
    expect(maxX - minX).toBeGreaterThanOrEqual(16);
    expect(nose).toBeGreaterThan(0);
    expect(warm[40]?.[0]).toBeLessThan(0);
    expect(warm[40]?.[79]).toBeLessThan(0);
    const engines = warm[11] ?? [];
    const clusters = engines
      .join(',')
      .split('-1')
      .filter((run) => run.includes(','));
    expect(clusters.length).toBeGreaterThanOrEqual(2);
  });
});

describe('黑曜 blade phases', () => {
  it('slides in folded, then only the hinge locks take damage', () => {
    const boss = make();
    expect(boss.stage).toBe('enter');
    expect(boss.y).toBe(OBSIDIAN_ENTER_Y);
    park(boss);
    expect(obsidianBladeAngle(boss, 0)).toBeCloseTo(OBSIDIAN_BLADES[0].fold, 5);
    expect(
      bossMissileTargets(boss)
        .map((item) => item.id)
        .sort()
    ).toEqual(['hinge0', 'hinge1', 'hinge2', 'hinge3']);

    const frame = bossPart(boss, 'frame')!;
    const lock = bossPart(boss, 'hinge0')!;
    const before = lock.hp;
    const armor = shot(boss, boss.x, boss.y + 24, 30);
    expect(armor.consumedBullet).toBe(true);
    expect(armor.clearBullets).toBe(false);
    expect(frame.hp).toBe(frame.maxHp);
    expect(lock.hp).toBe(before);
    expect(shot(boss, boss.x + 140, boss.y, 30).consumedBullet).toBe(false);

    const hit = shot(boss, lock.worldX, lock.worldY, 10);
    expect(hit.clearBullets).toBe(false);
    expect(lock.hp).toBe(before - 10);
    expect(frame.hp).toBe(frame.maxHp);
    expect(bossHitsPlayer(boss, boss.x, boss.y)).toBe(true);
    expect(bossHitsPlayer(boss, boss.x + 150, boss.y - 150)).toBe(false);

    const bomb = applyBossBomb(boss);
    expect(bomb.clearBullets).toBe(false);
    expect(lock.hp).toBeLessThan(before - 10);

    const lap = go(boss, OBSIDIAN_FOLD_CYCLE);
    expect(lap.bolts.filter((bolt) => bolt.type === 'small')).toEqual([]);
    expect(lap.bolts.filter((bolt) => bolt.type === 'large')).toHaveLength(OBSIDIAN_NOSE_COUNT * 3);
    expect(lap.bolts.filter((bolt) => bolt.type === 'missile')).toHaveLength(2);
    expect(lap.clearBullets).toBe(false);
  });

  it('opens the blades only after every lock is gone, without clearing shots', () => {
    const boss = make();
    park(boss);
    const last = clearTargets(boss);
    expect(last.clearBullets).toBe(false);
    expect(last.convertBullets).toBe(false);
    expect(boss.stage).toBe('transition');
    expect(boss.phase).toBe('half');
    expect(boss.invulnerable).toBe(true);
    expect(obsidianJettison(boss)).toEqual([]);
    expect(go(boss, 0.2).bolts).toEqual([]);

    const mid = OBSIDIAN_BLADES[0].fold + (OBSIDIAN_BLADES[0].half - OBSIDIAN_BLADES[0].fold) * 0.5;
    go(boss, OBSIDIAN_DEPLOY_TIME / 2 - 0.2);
    expect(obsidianBladeAngle(boss, 0)).toBeCloseTo(mid, 2);
    expect(boss.stage).toBe('transition');
    go(boss, OBSIDIAN_DEPLOY_TIME);
    expect(boss.stage).toBe('fight');
    expect(boss.phase).toBe('half');
    expect(boss.invulnerable).toBe(false);
    expect(obsidianBladeAngle(boss, 0)).toBeCloseTo(OBSIDIAN_BLADES[0].half, 5);
    expect(obsidianBladeAngle(boss, 2)).toBeCloseTo(OBSIDIAN_BLADES[2].half, 5);
  });

  it('strips a side when that outer blade dies, and half the fuselage forces the cross', () => {
    const both = make();
    park(both);
    reach(both, 'half');
    const full = go(both, OBSIDIAN_HALF_CYCLE).bolts.length;

    const one = make();
    park(one);
    reach(one, 'half');
    const outer = bossPart(one, 'outerL')!;
    const stripped = shot(one, outer.worldX, outer.worldY, outer.hp);
    expect(stripped.clearBullets).toBe(false);
    expect(outer.alive).toBe(false);
    expect(one.phase).toBe('half');
    expect(go(one, OBSIDIAN_HALF_CYCLE).bolts.length).toBeLessThan(full);

    const hard = make('hard');
    park(hard);
    reach(hard, 'half');
    expect(go(hard, OBSIDIAN_HALF_CYCLE).bolts.length).toBeGreaterThan(full);

    const body = make();
    park(body);
    reach(body, 'half');
    const frame = bossPart(body, 'frame')!;
    const torn = shot(body, frame.worldX, frame.worldY, frame.maxHp);
    expect(torn.clearBullets).toBe(false);
    expect(frame.alive).toBe(true);
    expect(frame.hp).toBeGreaterThan(0);
    expect(frame.hp).toBeLessThanOrEqual(frame.maxHp * 0.5);
    expect(bossPart(body, 'outerL')!.alive).toBe(false);
    expect(bossPart(body, 'outerR')!.alive).toBe(false);
    expect(body.stage).toBe('transition');
    expect(body.phase).toBe('open');
  });

  it('fires the strafe only on the open cross, and a dead inner quiets that edge', () => {
    const boss = make();
    park(boss);
    reach(boss, 'open');
    expect(obsidianBladeAngle(boss, 1)).toBeCloseTo(OBSIDIAN_BLADES[1].open, 5);
    expect(boss.x).toBe(OBSIDIAN_CENTER_X);
    const missiles = go(boss, OBSIDIAN_SLICE);
    expect(missiles.bolts.filter((bolt) => bolt.type === 'missile')).toHaveLength(
      OBSIDIAN_MISSILE_COUNT + OBSIDIAN_MISSILE_B_COUNT
    );
    expect(missiles.bolts.filter((bolt) => bolt.type === 'small')).toEqual([]);
    expect(
      missiles.bolts.some(
        (bolt) => bolt.type === 'missile' && bolt.homing === OBSIDIAN_MISSILE_HOMING
      )
    ).toBe(true);
    expect(missiles.bolts.find((bolt) => bolt.type === 'missile')!.vy).toBeGreaterThan(0);

    const quiet = make();
    park(quiet);
    reach(quiet, 'open');
    shot(quiet, bossPart(quiet, 'innerL')!.worldX, bossPart(quiet, 'innerL')!.worldY, 10_000);
    go(quiet, OBSIDIAN_SLICE);
    const fewer = go(quiet, OBSIDIAN_SLICE).bolts.length;
    const loud = make();
    park(loud);
    reach(loud, 'open');
    go(loud, OBSIDIAN_SLICE);
    expect(fewer).toBeLessThan(go(loud, OBSIDIAN_SLICE).bolts.length);

    const dive = go(boss, OBSIDIAN_SLICE + OBSIDIAN_STRAFE_DIVE);
    const small = dive.bolts.filter((bolt) => bolt.type === 'small');
    expect(small.length).toBeGreaterThan(0);
    expect(small.every((bolt) => bolt.vy === OBSIDIAN_FAN_SPEED || bolt.vy > 0)).toBe(true);
    expect(boss.y).toBe(OBSIDIAN_STRAFE_DIVE_Y);
    expect(boss.x).toBe(OBSIDIAN_CENTER_X);
    expect(boss.y).toBeLessThanOrEqual(OBSIDIAN_STRAFE_Y_MAX);
  });
});

describe('黑曜 saucer', () => {
  it('slides from the pose that emptied the last bar and does not clear the fight early', () => {
    const boss = make();
    park(boss);
    reach(boss, 'open');
    shot(boss, bossPart(boss, 'innerL')!.worldX, bossPart(boss, 'innerL')!.worldY, 10_000);
    shot(boss, bossPart(boss, 'innerR')!.worldX, bossPart(boss, 'innerR')!.worldY, 10_000);
    boss.y = OBSIDIAN_STRAFE_DIVE_Y;
    const fromY = boss.y;
    const frame = bossPart(boss, 'frame')!;
    const emptied = shot(boss, frame.worldX, frame.worldY, frame.hp);
    expect(emptied.score).toBe(OBSIDIAN_FRAME_SCORE);
    expect(emptied.explosions).toEqual([]);
    expect(emptied.clearBullets).toBe(false);
    expect(emptied.convertBullets).toBe(false);
    expect(boss.stage).toBe('saucer');
    expect(boss.phase).toBe('saucer');
    expect(boss.x).toBe(OBSIDIAN_WRECK_X);
    expect(boss.y).toBe(fromY);
    expect(bossHpBarLayout(boss).mainFill).toBe(0);

    const exit = createVictoryExit();
    expect(stepVictoryExit(exit, boss.phase, FIXED_DT, 180, 400, 180, 480)).toBe('none');
    expect(exit.phase).toBe('idle');

    go(boss, 0.4);
    go(boss, 0.4);
    expect(boss.y).toBeCloseTo(fromY + (OBSIDIAN_WRECK_Y - fromY) * 0.75, 5);

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

    go(boss, OBSIDIAN_CHARGE);
    view = obsidianSaucerView(boss);
    expect(view.beam).toBe(true);
    expect(view.broken).toBe(false);

    const broke = go(boss, OBSIDIAN_BEAM);
    expect(broke.cutscene).toBe(true);
    expect(broke.explosions).toHaveLength(1);
    expect(broke.clearBullets).toBe(false);
    view = obsidianSaucerView(boss);
    expect(view.broken).toBe(true);
    expect(view.showName).toBe(false);
    expect(view.beam).toBe(false);

    const leaving = go(boss, OBSIDIAN_SAUCER_EXIT);
    expect(leaving.explosions.length).toBe(OBSIDIAN_BREAK_EXPLOSIONS - 1);
    expect(leaving.clearBullets).toBe(false);
    expect(obsidianSaucerView(boss).saucerY).toBeCloseTo(OBSIDIAN_SAUCER_EXIT_Y, 6);
    expect(boss.stage).toBe('clear');
    expect(stepVictoryExit(exit, boss.phase, FIXED_DT, 180, 400, 180, 480)).toBe('cinematic');
    expect(exit.phase).toBe('wait');
  });

  it('gives Easy one bar, and Hard a different overload table after the cross', () => {
    const easy = make('easy');
    park(easy);
    expect(easy.phases.map((phase) => phase.id)).toEqual(['folded', 'half', 'open']);
    expect(easy.extraMax).toBe(0);

    const medium = make('medium');
    expect(bossPart(medium, 'frame')!.hp).toBeCloseTo(OBSIDIAN_FRAME_HP * DIFFICULTY_HP_MEDIUM, 6);
    expect(medium.phases.map((phase) => phase.id)).toEqual(['folded', 'half', 'open']);

    const hard = make('hard');
    park(hard);
    expect(hard.phases.map((phase) => phase.id)).toEqual(['folded', 'half', 'open', 'overload']);
    reach(hard, 'open');
    shot(hard, bossPart(hard, 'innerL')!.worldX, bossPart(hard, 'innerL')!.worldY, 10_000);
    shot(hard, bossPart(hard, 'innerR')!.worldX, bossPart(hard, 'innerR')!.worldY, 10_000);
    const frame = bossPart(hard, 'frame')!;
    const first = shot(hard, frame.worldX, frame.worldY, frame.hp);
    expect(first.score).toBe(0);
    expect(first.explosions).toEqual([]);
    expect(first.clearBullets).toBe(false);
    expect(hard.stage).toBe('transition');
    expect(hard.phase).toBe('overload');
    expect(hard.invulnerable).toBe(true);
    expect(frame.hp).toBeCloseTo(OBSIDIAN_OVERLOAD_HP * DIFFICULTY_HP_HARD, 6);
    expect(applyBossBomb(hard).explosions).toEqual([]);
    expect(frame.hp).toBeCloseTo(OBSIDIAN_OVERLOAD_HP * DIFFICULTY_HP_HARD, 6);
    expect(shot(hard, hard.x, hard.y, 50).consumedBullet).toBe(true);
    expect(frame.hp).toBeCloseTo(OBSIDIAN_OVERLOAD_HP * DIFFICULTY_HP_HARD, 6);
    const pods = obsidianJettison(hard);
    expect(pods).toHaveLength(2);
    expect(pods[0]!.x).toBeLessThan(hard.x);
    go(hard, 0.25);
    expect(obsidianJettison(hard)[0]!.y).toBeGreaterThan(pods[0]!.y);
    go(hard, OBSIDIAN_PHASE_INVULN);
    expect(hard.stage).toBe('fight');
    expect(hard.phase).toBe('overload');
    expect(hard.invulnerable).toBe(false);
    expect(obsidianJettison(hard)).toEqual([]);
    expect(obsidianMotion(hard).flameBoost).toBe(OBSIDIAN_OVERLOAD_CRUISE_FLAME);
    expect(bossHpBarLayout(hard).extraFill).toBeCloseTo(1, 6);
    expect(bossHpBarLayout(hard).mainFill).toBe(0);

    const sweep = go(hard, 0.2);
    expect(sweep.bolts.filter((bolt) => bolt.type === 'missile')).toEqual([]);
    expect(sweep.bolts.filter((bolt) => bolt.type === 'large').length).toBeGreaterThanOrEqual(
      OBSIDIAN_OVERLOAD_FAN_COUNT
    );
    const dived = go(hard, OBSIDIAN_OVERLOAD_STRAFE_AT + OBSIDIAN_OVERLOAD_STRAFE_DIVE - 0.2);
    expect(dived.bolts.some((bolt) => bolt.type === 'small')).toBe(true);
    expect(hard.y).toBe(OBSIDIAN_STRAFE_DIVE_Y);
    expect(hard.x).toBe(OBSIDIAN_CENTER_X);
    expect(shot(hard, frame.worldX, frame.worldY, frame.hp).score).toBe(OBSIDIAN_FRAME_SCORE);
    expect(hard.stage).toBe('saucer');
    expect(bossHpBarLayout(hard).extraFill).toBe(0);
    expect(OBSIDIAN_OVERLOAD_SPAN).toBeGreaterThan(OBSIDIAN_SLICE);
  });
});
