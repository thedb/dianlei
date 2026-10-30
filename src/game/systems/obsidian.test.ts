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
  OBSIDIAN_CROSS_H,
  OBSIDIAN_CROSS_W,
  OBSIDIAN_BREAK_AT,
  OBSIDIAN_BREAK_EXPLOSIONS,
  OBSIDIAN_CENTER_X,
  OBSIDIAN_CHARGE,
  OBSIDIAN_CRUISE_AMP_X,
  OBSIDIAN_CRUISE_AMP_Y,
  OBSIDIAN_CRUISE_PERIOD,
  OBSIDIAN_CRUISE_RAGE_SCALE,
  OBSIDIAN_CRUISE_REJOIN,
  OBSIDIAN_CYCLE,
  OBSIDIAN_DEPLOY_TIME,
  OBSIDIAN_ENTER_DURATION,
  OBSIDIAN_ENTER_Y,
  OBSIDIAN_FAN_SPEED,
  OBSIDIAN_FOLD_CYCLE,
  OBSIDIAN_FRAME_HP,
  OBSIDIAN_HALF_MISSILE_AT,
  OBSIDIAN_HALF_TWIN_AT,
  OBSIDIAN_HALF_TWIN_COUNT,
  OBSIDIAN_HALF_TWIN_GAP,
  OBSIDIAN_HINGE_HP,
  OBSIDIAN_HINGE_NOSE_HP,
  OBSIDIAN_HINGE_RADIUS,
  OBSIDIAN_FRAME_SCORE,
  OBSIDIAN_HALF_CYCLE,
  OBSIDIAN_HULL_H,
  OBSIDIAN_MAIN_HP,
  OBSIDIAN_MISSILE_B_COUNT,
  OBSIDIAN_MISSILE_COUNT,
  OBSIDIAN_MISSILE_HOMING,
  OBSIDIAN_NOSE_COUNT,
  OBSIDIAN_EDGE_COUNT,
  OBSIDIAN_SHARD_COUNT,
  OBSIDIAN_WING_X,
  OBSIDIAN_OVERLOAD_CRUISE_FLAME,
  OBSIDIAN_OVERLOAD_FAN_COUNT,
  OBSIDIAN_OVERLOAD_HP,
  OBSIDIAN_OVERLOAD_SPAN,
  OBSIDIAN_OVERLOAD_STRAFE_AT,
  OBSIDIAN_OVERLOAD_STRAFE_BOTTOM,
  OBSIDIAN_OVERLOAD_STRAFE_DIVE,
  OBSIDIAN_OVERLOAD_STRAFE_END,
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
  OBSIDIAN_STRAFE_BOTTOM,
  OBSIDIAN_STRAFE_DIVE,
  OBSIDIAN_STRAFE_DIVE_Y,
  OBSIDIAN_STRAFE_END,
  OBSIDIAN_STRAFE_ROUND_GAP,
  OBSIDIAN_STRAFE_ROUNDS,
  OBSIDIAN_STRAFE_TELL,
  OBSIDIAN_STRAFE_Y_MAX,
  OBSIDIAN_WRECK_X,
  OBSIDIAN_WRECK_Y,
} from '@/game/config';
import { COLOR } from '@/game/palette';
import { FIRE_PRESETS } from '@/game/systems/danmaku';
import { prepareBossConfig } from '@/game/difficulty';
import { OBSIDIAN } from '@/game/levels/bosses/obsidian';
import {
  OBSIDIAN_BLADE_PIVOT_Y,
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
import {
  OBSIDIAN_BLADES,
  obsidianBladeAngle,
  obsidianBladeLayers,
  obsidianCruisePoint,
  obsidianHingeMarked,
  obsidianJettison,
  obsidianMotion,
  obsidianVulnerableHinge,
} from './obsidian';
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
    expect(OBSIDIAN_OVERLOAD_HP).toBe(OBSIDIAN_MAIN_HP);
    expect(OBSIDIAN_RADIUS).toBe(32);
    expect(OBSIDIAN_HINGE_RADIUS).toBe(19);
    expect(OBSIDIAN_HINGE_RADIUS).toBeGreaterThanOrEqual(18);
    expect(OBSIDIAN_HINGE_RADIUS).toBeLessThanOrEqual(20);
    expect(OBSIDIAN_HINGE_NOSE_HP).toBe(OBSIDIAN_HINGE_HP * 2);
    expect(OBSIDIAN.parts.find((part) => part.id === 'hinge0')?.hp).toBe(OBSIDIAN_HINGE_NOSE_HP);
    expect(OBSIDIAN.parts.find((part) => part.id === 'hinge2')?.hp).toBe(OBSIDIAN_HINGE_NOSE_HP);
    expect(OBSIDIAN.parts.find((part) => part.id === 'hinge1')?.hp).toBe(0);
    expect(OBSIDIAN.parts.find((part) => part.id === 'hinge3')?.hp).toBe(0);
    expect(OBSIDIAN.parts.find((part) => part.id === 'hinge0')?.radius).toBe(OBSIDIAN_HINGE_RADIUS);
    expect(OBSIDIAN_CRUISE_RAGE_SCALE).toBe(2);
    expect(OBSIDIAN_STRAFE_TELL * 2).toBeCloseTo(0.3, 8);
    expect(OBSIDIAN_STRAFE_DIVE * 2).toBeCloseTo(0.75, 8);
    expect(OBSIDIAN_STRAFE_BOTTOM * 2).toBeCloseTo(1.05, 8);
    expect(OBSIDIAN_STRAFE_END * 2).toBeCloseTo(1.6, 8);
    expect(OBSIDIAN_OVERLOAD_STRAFE_END * 2).toBeCloseTo(1.2, 8);
    expect(OBSIDIAN_STRAFE_ROUND_GAP * 2).toBeCloseTo(0.1, 8);
    expect(OBSIDIAN_STRAFE_BOTTOM - OBSIDIAN_STRAFE_DIVE).toBeGreaterThan(
      (OBSIDIAN_STRAFE_ROUNDS - 1) * OBSIDIAN_STRAFE_ROUND_GAP - 1e-9
    );
    expect(OBSIDIAN_OVERLOAD_STRAFE_BOTTOM - OBSIDIAN_OVERLOAD_STRAFE_DIVE).toBeGreaterThan(
      2 * OBSIDIAN_STRAFE_ROUND_GAP - 1e-9
    );
    expect(OBSIDIAN.parts[0]?.id).toBe('frame');
    expect(OBSIDIAN.parts[0]?.radius).toBe(32);
    expect(OBSIDIAN.phases.map((phase) => phase.id)).toEqual([
      'folded',
      'half',
      'open',
      'overload',
    ]);
    expect(OBSIDIAN.phases[0]?.targets).toEqual(
      OBSIDIAN_BLADES.filter((blade) => obsidianVulnerableHinge(blade.hinge)).map(
        (blade) => blade.hinge
      )
    );
    expect(OBSIDIAN.phases[0]?.targets).toEqual(['hinge0', 'hinge2']);
    expect(OBSIDIAN_BLADES.filter((blade) => blade.y > 0).map((blade) => blade.hinge)).toEqual([
      'hinge0',
      'hinge2',
    ]);
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
    const swept = buildObsidianBlade('swept');
    const cross = buildObsidianBlade('cross');
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
    expect(colorsOf(swept)).toContain(COLOR.PLAYER_CYAN);
    expect(colorsOf(swept)).toContain(COLOR.PLAYER_DARK_CYAN);
    expect(colorsOf(swept)).toContain(COLOR.PLAYER_PALE_CYAN);
    expect(colorsOf(swept)).toContain(COLOR.EXPLOSION_ORANGE);
    expect(colorsOf(swept)).toContain(COLOR.MEDIUM_GRAY);
    expect(colorsOf(swept)).toContain(COLOR.ENEMY_RED);
    expect(colorsOf(cross)).toContain(COLOR.PLAYER_CYAN);
    expect(colorsOf(cross)).not.toContain(COLOR.ENEMY_RED);
    expect(colorsOf(hinge)).toContain(COLOR.EXPLOSION_ORANGE);
    expect(colorsOf(hingeDead)).not.toContain(COLOR.EXPLOSION_ORANGE);
    expect(swept.flat().join(',')).not.toBe(cross.flat().join(','));
    const span = (grid: number[][], y: number) => {
      const xs = grid[y]!.flatMap((cell, x) => (cell >= 0 ? [x] : []));
      return xs.length ? xs[xs.length - 1]! - xs[0]! : 0;
    };
    expect(span(swept, 28)).toBeGreaterThanOrEqual(10);
    expect(span(cross, 40)).toBeLessThan(span(swept, 28));
    const root = swept[OBSIDIAN_BLADE_PIVOT_Y + 6] ?? [];
    const tip = swept[swept.length - 3] ?? [];
    expect(root).toContain(COLOR.PLAYER_DARK_CYAN);
    expect(tip.some((cell) => cell === COLOR.PLAYER_PALE_CYAN || cell === COLOR.WHITE)).toBe(true);
    expect(swept.length).toBe(OBSIDIAN_BLADE_H);
    expect(swept[0]?.length).toBe(OBSIDIAN_BLADE_W);
    expect(cross.length).toBe(OBSIDIAN_CROSS_H);
    expect(cross[0]?.length).toBe(OBSIDIAN_CROSS_W);
    expect(cross.length).toBeGreaterThan(swept.length);

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
    const clusters = (row: number[] | undefined) => {
      let count = 0;
      let on = false;
      for (const cell of row ?? []) {
        const opaque = cell >= 0;
        if (opaque && !on) count += 1;
        on = opaque;
      }
      return count;
    };
    for (const y of [4, 6, 8]) expect(clusters(warm[y])).toBe(1);
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
    ).toEqual(['hinge0', 'hinge2']);
    expect(obsidianHingeMarked(boss, 'hinge0')).toBe(true);
    expect(obsidianHingeMarked(boss, 'hinge2')).toBe(true);
    expect(obsidianHingeMarked(boss, 'hinge1')).toBe(false);
    expect(obsidianHingeMarked(boss, 'hinge3')).toBe(false);

    const frame = bossPart(boss, 'frame')!;
    const lock = bossPart(boss, 'hinge0')!;
    const before = lock.hp;
    // Nose of the fuselage circle, clear of the radius-19 locks (bullet is 4×12).
    const armor = shot(boss, boss.x, boss.y + 32, 30);
    expect(armor.consumedBullet).toBe(true);
    expect(armor.clearBullets).toBe(false);
    expect(frame.hp).toBe(frame.maxHp);
    expect(lock.hp).toBe(before);
    expect(shot(boss, boss.x + 140, boss.y, 30).consumedBullet).toBe(false);

    const hit = shot(boss, lock.worldX, lock.worldY, 10);
    expect(hit.clearBullets).toBe(false);
    expect(lock.hp).toBe(before - 10);
    expect(frame.hp).toBe(frame.maxHp);
    expect(lock.radius).toBe(OBSIDIAN_HINGE_RADIUS);
    const widened = shot(boss, lock.worldX + (OBSIDIAN_HINGE_RADIUS - 2), lock.worldY, 4);
    expect(widened.consumedBullet).toBe(true);
    expect(lock.hp).toBe(before - 14);
    shot(boss, lock.worldX - (OBSIDIAN_HINGE_RADIUS + 6), lock.worldY, 30);
    expect(lock.hp).toBe(before - 14);
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

  it('opens the blades after both nose locks are gone, without clearing shots', () => {
    const boss = make();
    park(boss);
    const last = clearTargets(boss);
    expect(last.clearBullets).toBe(false);
    expect(last.convertBullets).toBe(false);
    expect(boss.stage).toBe('transition');
    expect(boss.phase).toBe('half');
    expect(bossPart(boss, 'hinge0')?.alive).toBe(false);
    expect(bossPart(boss, 'hinge2')?.alive).toBe(false);
    expect(bossPart(boss, 'hinge1')?.alive).toBe(true);
    expect(bossPart(boss, 'hinge3')?.alive).toBe(true);
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

  it('enters half when both nose locks break and leaves the tail locks unbroken', () => {
    const boss = make();
    park(boss);
    const noses = ['hinge0', 'hinge2'].map((id) => bossPart(boss, id)!);
    const tails = ['hinge1', 'hinge3'].map((id) => bossPart(boss, id)!);
    expect(noses.map((part) => part.maxHp)).toEqual([
      OBSIDIAN_HINGE_NOSE_HP,
      OBSIDIAN_HINGE_NOSE_HP,
    ]);
    expect(tails.every((part) => part.alive && part.hp === 0)).toBe(true);

    for (const tail of tails) {
      const before = noses.map((part) => part.hp);
      // Aft of the pivot: radius 19 overlaps the nose lock at the pivot itself.
      const aft = shot(boss, tail.worldX, tail.worldY - 10, 80);
      expect(aft.consumedBullet).toBe(true);
      expect(aft.clearBullets).toBe(false);
      expect(tail.alive).toBe(true);
      expect(tail.hp).toBe(0);
      expect(noses.map((part) => part.hp)).toEqual(before);
      expect(boss.stage).toBe('fight');
      expect(boss.phase).toBe('folded');
    }

    const first = noses[0]!;
    const one = shot(boss, first.worldX, first.worldY, first.hp + 5);
    expect(one.clearBullets).toBe(false);
    expect(first.alive).toBe(false);
    expect(boss.stage).toBe('fight');
    expect(boss.phase).toBe('folded');
    expect(obsidianHingeMarked(boss, first.id)).toBe(false);
    expect(obsidianHingeMarked(boss, 'hinge2')).toBe(true);
    expect(tails.every((part) => part.alive)).toBe(true);

    const second = noses[1]!;
    const both = shot(boss, second.worldX, second.worldY, second.hp + 5);
    expect(both.clearBullets).toBe(false);
    expect(second.alive).toBe(false);
    expect(tails.every((part) => part.alive && part.hp === 0)).toBe(true);
    expect(boss.stage).toBe('transition');
    expect(boss.phase).toBe('half');
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

  it('keeps swept wings on their own side and dives only on the open strafe', () => {
    const lateral = (angle: number) => Math.abs(Math.sin(angle));
    const outer = OBSIDIAN_BLADES[1];
    const inner = OBSIDIAN_BLADES[0];
    expect(lateral(outer.fold)).toBeGreaterThan(0.6);
    expect(lateral(outer.half)).toBeGreaterThan(lateral(outer.fold));
    expect(Math.cos(outer.open)).toBeLessThan(-0.5);
    expect(Math.cos(inner.open)).toBeGreaterThan(0.5);
    expect(Math.abs(outer.layers.fold[0] - outer.layers.fold[2])).toBeCloseTo(0.32, 5);

    const parked = make();
    park(parked);
    const spread =
      Math.max(...obsidianBladeLayers(parked, 1)) - Math.min(...obsidianBladeLayers(parked, 1));
    expect(spread).toBeGreaterThan(0.25);
    let movedX = false;
    let movedY = false;
    for (let i = 0; i < 180; i++) {
      go(parked, FIXED_DT);
      if (Math.abs(parked.x - OBSIDIAN_CENTER_X) > 8) movedX = true;
      if (Math.abs(parked.y - OBSIDIAN_PARK_Y) > 4) movedY = true;
      expect(parked.x).toBeGreaterThan(100);
      expect(parked.x).toBeLessThan(260);
      expect(parked.y).toBeGreaterThan(100);
      expect(parked.y).toBeLessThan(180);
    }
    expect(movedX).toBe(true);
    expect(movedY).toBe(true);
    expect(parked.phase).toBe('folded');
    expect(parked.x).toBeCloseTo(obsidianCruisePoint(180 * FIXED_DT, 'folded').x, 2);
    expect(parked.y).toBeCloseTo(obsidianCruisePoint(180 * FIXED_DT, 'folded').y, 2);

    const half = make();
    park(half);
    reach(half, 'half');
    const fan = go(half, OBSIDIAN_HALF_CYCLE);
    expect(fan.bolts.length).toBeGreaterThan(0);
    expect(fan.bolts.every((bolt) => bolt.vy > 0)).toBe(true);
    const missiles = fan.bolts.filter((bolt) => bolt.type === 'missile');
    expect(missiles).toHaveLength(OBSIDIAN_HALF_MISSILE_AT.length * 2);
    expect(missiles.every((bolt) => bolt.homing === OBSIDIAN_MISSILE_HOMING)).toBe(true);
    expect(Math.abs(missiles[0]!.x - missiles[1]!.x)).toBeCloseTo(OBSIDIAN_WING_X * 2, 4);
    expect(fan.bolts.filter((bolt) => bolt.type === 'large')).toHaveLength(
      4 * 2 * OBSIDIAN_EDGE_COUNT + OBSIDIAN_NOSE_COUNT + OBSIDIAN_HALF_TWIN_COUNT * 2
    );
    expect(fan.bolts.filter((bolt) => bolt.type === 'small')).toHaveLength(
      2 * 2 * OBSIDIAN_SHARD_COUNT
    );
    expect(fan.clearBullets).toBe(false);

    const twin = make();
    park(twin);
    reach(twin, 'half');
    go(twin, OBSIDIAN_HALF_TWIN_AT - 0.02);
    const twinShot = go(twin, 0.04);
    const twinLarge = twinShot.bolts.filter((bolt) => bolt.type === 'large');
    expect(twinLarge).toHaveLength(OBSIDIAN_HALF_TWIN_COUNT * 2);
    expect(twinShot.bolts.filter((bolt) => bolt.type === 'missile')).toEqual([]);
    const mouths = [...new Set(twinLarge.map((bolt) => bolt.x))].sort((a, b) => a - b);
    expect(mouths).toHaveLength(2);
    expect(mouths[1]! - mouths[0]!).toBeCloseTo(OBSIDIAN_HALF_TWIN_GAP * 2, 4);

    const boss = make();
    park(boss);
    reach(boss, 'open');
    go(boss, OBSIDIAN_SLICE * 2 + OBSIDIAN_STRAFE_TELL);
    expect(boss.y).toBe(OBSIDIAN_PARK_Y);
    expect(boss.x).toBe(OBSIDIAN_CENTER_X);
    expect(obsidianMotion(boss).flameBoost).toBeGreaterThan(0);
    let maxY = boss.y;
    let sawSmall = false;
    let smallOffBottom = false;
    let smallCount = 0;
    const clock0 = OBSIDIAN_SLICE * 2 + OBSIDIAN_STRAFE_TELL;
    let stepped = 0;
    while (stepped < 80) {
      const nextLocal = clock0 + (stepped + 1) * FIXED_DT - OBSIDIAN_SLICE * 2;
      if (nextLocal > OBSIDIAN_STRAFE_END + 1e-9) break;
      const ev = go(boss, FIXED_DT);
      stepped += 1;
      maxY = Math.max(maxY, boss.y);
      expect(boss.x).toBe(OBSIDIAN_CENTER_X);
      expect(boss.y).toBeLessThanOrEqual(OBSIDIAN_STRAFE_Y_MAX);
      const small = ev.bolts.filter((bolt) => bolt.type === 'small');
      if (small.length > 0) {
        sawSmall = true;
        smallCount += small.length;
        if (boss.y < OBSIDIAN_STRAFE_DIVE_Y - 1) smallOffBottom = true;
      }
    }
    const localNow = clock0 + stepped * FIXED_DT - OBSIDIAN_SLICE * 2;
    go(boss, Math.max(0, OBSIDIAN_STRAFE_END - localNow));
    expect(boss.x).toBe(OBSIDIAN_CENTER_X);
    expect(boss.y).toBe(OBSIDIAN_PARK_Y);
    expect(maxY).toBe(OBSIDIAN_STRAFE_DIVE_Y);
    expect(sawSmall).toBe(true);
    expect(smallCount).toBe(OBSIDIAN_STRAFE_ROUNDS * 4);
    expect(smallOffBottom).toBe(false);
    const rejoinAt = OBSIDIAN_SLICE * 2 + OBSIDIAN_STRAFE_END + OBSIDIAN_CRUISE_REJOIN;
    go(boss, OBSIDIAN_CRUISE_REJOIN);
    const back = obsidianCruisePoint(rejoinAt, 'open');
    expect(boss.x).toBeCloseTo(back.x, 3);
    expect(boss.y).toBeCloseTo(back.y, 3);
    expect(
      Math.abs(boss.x - OBSIDIAN_CENTER_X) + Math.abs(boss.y - OBSIDIAN_PARK_Y)
    ).toBeGreaterThan(1);
  });
});

describe('黑曜 cruise', () => {
  it('follows a slow figure-8 in folded and half, and twice that rate once open', () => {
    const dt = OBSIDIAN_CRUISE_PERIOD / 8;
    const folded = make();
    park(folded);
    go(folded, dt);
    expect(folded.x).toBeCloseTo(obsidianCruisePoint(dt, 'folded').x, 4);
    expect(folded.y).toBeCloseTo(obsidianCruisePoint(dt, 'folded').y, 4);
    expect(Math.abs(folded.y - OBSIDIAN_PARK_Y)).toBeCloseTo(OBSIDIAN_CRUISE_AMP_Y, 4);
    const slow = Math.abs(folded.x - OBSIDIAN_CENTER_X);

    const half = make();
    park(half);
    reach(half, 'half');
    go(half, dt);
    expect(half.phase).toBe('half');
    expect(half.x).toBeCloseTo(obsidianCruisePoint(dt, 'half').x, 4);
    expect(half.y).toBeCloseTo(obsidianCruisePoint(dt, 'half').y, 4);
    expect(Math.abs(half.x - OBSIDIAN_CENTER_X)).toBeGreaterThan(10);
    expect(half.y).toBeLessThan(200);

    const open = make();
    park(open);
    reach(open, 'open');
    go(open, dt);
    expect(open.x).toBeCloseTo(obsidianCruisePoint(dt, 'open').x, 4);
    expect(Math.abs(open.x - OBSIDIAN_CENTER_X)).toBeCloseTo(OBSIDIAN_CRUISE_AMP_X, 3);
    expect(Math.abs(open.x - OBSIDIAN_CENTER_X)).toBeGreaterThan(slow + 5);

    const moving = make();
    park(moving);
    go(moving, OBSIDIAN_CRUISE_PERIOD / 4);
    const off = Math.abs(moving.x - OBSIDIAN_CENTER_X);
    expect(off).toBeGreaterThan(20);
    clearTargets(moving);
    expect(moving.stage).toBe('transition');
    go(moving, OBSIDIAN_DEPLOY_TIME / 2);
    expect(Math.abs(moving.x - OBSIDIAN_CENTER_X)).toBeLessThan(off);
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
    expect(bossHpBarLayout(boss).bars[bossHpBarLayout(boss).active]!.fill).toBe(0);

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
    expect(bossHpBarLayout(hard).active).toBe(1);
    expect(bossHpBarLayout(hard).bars[1]!.fill).toBeCloseTo(1, 6);
    expect(bossHpBarLayout(hard).bars[1]!.style).toBe('extra');
    expect(bossHpBarLayout(hard).bars[0]!.fill).toBe(0);
    expect(bossHpBarLayout(hard).bars[1]!.maxHp).toBeCloseTo(
      bossHpBarLayout(hard).bars[0]!.maxHp,
      6
    );

    const sweep = go(hard, 0.2);
    expect(sweep.bolts.filter((bolt) => bolt.type === 'missile')).toEqual([]);
    expect(sweep.bolts.filter((bolt) => bolt.type === 'large').length).toBeGreaterThanOrEqual(
      OBSIDIAN_OVERLOAD_FAN_COUNT
    );
    // The 0.25s jettison step is already on the transition clock, so finishing
    // the 1.2s beat leaves the fight clock at 0.25. Sweep then adds 0.2.
    const fightClock = 0.45;
    const bottomMid = (OBSIDIAN_OVERLOAD_STRAFE_DIVE + OBSIDIAN_OVERLOAD_STRAFE_BOTTOM) / 2;
    const dived = go(hard, OBSIDIAN_OVERLOAD_STRAFE_AT + bottomMid - fightClock);
    expect(dived.bolts.some((bolt) => bolt.type === 'small')).toBe(true);
    expect(hard.y).toBe(OBSIDIAN_STRAFE_DIVE_Y);
    expect(hard.x).toBe(OBSIDIAN_CENTER_X);
    const rageDt = OBSIDIAN_CRUISE_PERIOD / 8;
    const fast = make('hard');
    park(fast);
    reach(fast, 'overload');
    go(fast, rageDt);
    expect(fast.x).toBeCloseTo(obsidianCruisePoint(rageDt, 'overload').x, 3);
    expect(Math.abs(fast.x - OBSIDIAN_CENTER_X)).toBeCloseTo(OBSIDIAN_CRUISE_AMP_X, 3);
    go(hard, OBSIDIAN_OVERLOAD_STRAFE_END + OBSIDIAN_CRUISE_REJOIN - bottomMid);
    const overBack = obsidianCruisePoint(
      OBSIDIAN_OVERLOAD_STRAFE_AT + OBSIDIAN_OVERLOAD_STRAFE_END + OBSIDIAN_CRUISE_REJOIN,
      'overload'
    );
    expect(hard.x).toBeCloseTo(overBack.x, 3);
    expect(hard.y).toBeCloseTo(overBack.y, 3);
    expect(hard.y).toBeLessThan(OBSIDIAN_STRAFE_DIVE_Y - 40);
    expect(shot(hard, frame.worldX, frame.worldY, frame.hp).score).toBe(OBSIDIAN_FRAME_SCORE);
    expect(hard.stage).toBe('saucer');
    expect(bossHpBarLayout(hard).bars[bossHpBarLayout(hard).active]!.fill).toBe(0);
    expect(OBSIDIAN_OVERLOAD_SPAN).toBeGreaterThan(OBSIDIAN_SLICE);
  });
});
