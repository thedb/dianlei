import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import {
  FIXED_DT,
  LOGICAL_H,
  TIEBAO_CAR_H,
  TIEBAO_CAR_MAX_BANK,
  TIEBAO_CAR_PITCH,
  TIEBAO_CHASE_FLAME,
  TIEBAO_CORE_HP,
  TIEBAO_CORE_SCORE,
  TIEBAO_ENTER_DURATION,
  TIEBAO_FAN_FIRST,
  TIEBAO_FAN_INTERVAL,
  TIEBAO_HULL_H,
  TIEBAO_MISSILE_GAP,
  TIEBAO_MOVE,
  TIEBAO_MOVE_EXTRA,
  TIEBAO_OVERLOAD_HP,
  TIEBAO_OVERLOAD_MOVE,
  TIEBAO_OVERLOAD_PERIOD,
  TIEBAO_HULL_W,
  TIEBAO_SHED_ADVANCE,
  TIEBAO_SHED_DELAY,
  TIEBAO_SHED_SLIDE,
  TIEBAO_SWITCH_CROSS_SPAN,
  TIEBAO_SWITCH_LEAD,
  TIEBAO_SWITCH_SPAN,
  TIEBAO_OVERLOAD_TRANSITION,
  TIEBAO_PARK_Y,
  TIEBAO_RAIL_X,
  TIEBAO_RAM_BOTTOM,
  TIEBAO_RAM_DIVE,
  TIEBAO_RAM_RETURN,
  TIEBAO_RAM_START,
  TIEBAO_RATE_SCALE,
  TIEBAO_ROOF_HP,
  TIEBAO_ROOF_SCORE,
  TIEBAO_SWITCH_PERIOD,
  TIEBAO_SWITCH_RUSH,
} from '@/game/config';
import { prepareBossConfig } from '@/game/difficulty';
import { TIEBAO } from '@/game/levels/bosses/tiebao';
import {
  applyBossBomb,
  bossLook,
  bossPart,
  createBoss,
  enabledBossPhases,
  resolveBossBullet,
  updateBoss,
  type BossRuntime,
  type BossWorld,
} from '@/game/systems/boss';
import {
  TIEBAO_MODE_IDS,
  TIEBAO_MODE_NAMES,
  TIEBAO_OVERLOAD_MODE_IDS,
  pickOtherRail,
  tiebaoBankAngle,
  tiebaoCarPoses,
  tiebaoChaseBoost,
  tiebaoClosureX,
  tiebaoCommittedCars,
  tiebaoHullSegments,
  tiebaoLiveHull,
  tiebaoMoveTime,
  tiebaoPiecePoses,
  tiebaoPieces,
  tiebaoRailMode,
  tiebaoSwitchBand,
  tiebaoSwitchSpan,
  tiebaoSwitchX,
  tiebaoTurnoutMarks,
  tiebaoView,
  tiebaoVisual,
} from '@/game/systems/tiebao';
import { tiebaoHullHeight, tiebaoRestCenter, tiebaoTailY } from '@/game/systems/tiebaoShed';

function world(seed = 1): BossWorld {
  return { playerX: 180, playerY: 520, rng: createRng(seed) };
}

function park(boss: BossRuntime, around: BossWorld = world()): void {
  updateBoss(boss, TIEBAO_ENTER_DURATION, around);
}

function step(boss: BossRuntime, around: BossWorld, seconds: number): void {
  const frames = Math.ceil(seconds / FIXED_DT);
  for (let i = 0; i < frames; i++) updateBoss(boss, FIXED_DT, around);
}

function shot(boss: BossRuntime, x: number, y: number, damage = 10000) {
  return resolveBossBullet(boss, { x, y, w: 4, h: 8 }, damage);
}

describe('铁堡 config', () => {
  it('parses the rail script, the six rail modes, and no laser', () => {
    expect(TIEBAO.id).toBe('tiebao');
    expect(TIEBAO.script).toBe('tiebao');
    expect(TIEBAO.art).toBe('tiebao');
    expect(TIEBAO.title).toBe('铁堡');
    expect(TIEBAO.subtitle).toBe('弹药转运');
    expect(TIEBAO.vulnerableEnter).toBe(true);
    expect(TIEBAO.hullTransfers).toBe(true);
    expect(TIEBAO_FAN_INTERVAL).toBe(1.4);
    expect(TIEBAO_FAN_FIRST).toBe(0.4);
    expect(TIEBAO_RATE_SCALE).toBeCloseTo(2 / 3);
    expect(TIEBAO_MISSILE_GAP).toBeCloseTo(0.12 * TIEBAO_RATE_SCALE);
    expect(TIEBAO_RAIL_X).toEqual([72, 180, 288]);
    expect(TIEBAO.anchorX).toBe(180);
    expect([...TIEBAO_MODE_IDS]).toEqual(['fan', 'missiles', 'rain', 'broadside', 'wall', 'ram']);
    expect([...TIEBAO_MODE_NAMES]).toEqual([
      '高射扇',
      '导弹齐射',
      '落弹雨',
      '侧舷扫射',
      '封轨弹墙',
      '冲轨撞击',
    ]);
    expect((TIEBAO_MODE_IDS as readonly string[]).includes('rockets')).toBe(false);
    expect((TIEBAO_MODE_IDS as readonly string[]).includes('crates')).toBe(false);
    expect(tiebaoRailMode(0, 1)).toBe('broadside');
    expect(tiebaoRailMode(0, 2)).toBe('wall');
    expect(tiebaoRailMode(0, 3)).toBe('broadside');
    expect(tiebaoRailMode(0, 4)).toBe('wall');
    expect(tiebaoRailMode(1, 0)).toBe('fan');
    expect(tiebaoRailMode(1, 1)).toBe('fan');
    expect(tiebaoRailMode(1, 2)).toBe('missiles');
    expect(tiebaoRailMode(2, 1)).toBe('rain');
    expect(tiebaoRailMode(2, 2)).toBe('ram');
    expect(tiebaoRailMode(2, 4)).toBe('ram');
    expect([...TIEBAO_OVERLOAD_MODE_IDS]).toEqual(['rain', 'wall', 'missiles']);
    for (const phase of TIEBAO.phases) {
      expect(phase.attacks.some((attack) => attack.kind === 'laser')).toBe(false);
    }
    expect(enabledBossPhases(TIEBAO).map((phase) => phase.id)).toEqual(['main', 'core']);
    expect(enabledBossPhases(TIEBAO, ['hard']).map((phase) => phase.id)).toEqual([
      'main',
      'core',
      'overload',
    ]);
  });

  it('scales part HP and the overload segment, and drops phase 3 off Easy', () => {
    const easy = createBoss(prepareBossConfig(TIEBAO, 'easy'));
    expect(easy.phases.map((phase) => phase.id)).toEqual(['main', 'core']);
    expect(easy.extraArmed).toBe(false);
    expect(easy.fightMax).toBe(TIEBAO_ROOF_HP * 2 + TIEBAO_CORE_HP);

    const hardDef = prepareBossConfig(TIEBAO, 'hard');
    const hard = createBoss(hardDef, { gates: ['hard'] });
    expect(hard.phases.map((phase) => phase.id)).toEqual(['main', 'core', 'overload']);
    expect(hard.extraArmed).toBe(true);
    expect(hard.parts.map((part) => part.maxHp)).toEqual([
      TIEBAO_ROOF_HP * 1.3,
      TIEBAO_ROOF_HP * 1.3,
      TIEBAO_CORE_HP * 1.3,
    ]);
    expect(hard.extraMax).toBeCloseTo(TIEBAO_OVERLOAD_HP * 1.3);
    expect(hard.fightMax).toBeCloseTo(
      (TIEBAO_ROOF_HP * 2 + TIEBAO_CORE_HP + TIEBAO_OVERLOAD_HP) * 1.3
    );
    expect(hardDef.phases.find((phase) => phase.id === 'overload')?.segmentHp).toBeCloseTo(
      TIEBAO_OVERLOAD_HP * 1.3
    );
  });
});

describe('铁堡 rails', () => {
  it('always leaves the current rail, both ways', () => {
    expect(pickOtherRail(0, 0)).toBe(1);
    expect(pickOtherRail(0, 0.5)).toBe(2);
    expect(pickOtherRail(1, 0)).toBe(0);
    expect(pickOtherRail(1, 0.5)).toBe(2);
    expect(pickOtherRail(2, 0)).toBe(0);
    expect(pickOtherRail(2, 0.5)).toBe(1);
    for (const current of [0, 1, 2]) {
      const left = pickOtherRail(current, 0);
      const right = pickOtherRail(current, 0.99);
      expect(left).not.toBe(current);
      expect(right).not.toBe(current);
      expect(left).not.toBe(right);
    }
  });

  it('parks on the center rail in 高射扇 and can be hit on the way in', () => {
    const boss = createBoss(TIEBAO);
    expect(boss.invulnerable).toBe(false);
    expect(boss.stage).toBe('enter');
    updateBoss(boss, 1, world());
    const before = (bossPart(boss, 'roofCar')?.hp ?? 0) + (bossPart(boss, 'roofLoco')?.hp ?? 0);
    const hit = shot(boss, boss.x, boss.y, 10);
    expect(hit.consumedBullet).toBe(true);
    const after = (bossPart(boss, 'roofCar')?.hp ?? 0) + (bossPart(boss, 'roofLoco')?.hp ?? 0);
    expect(after).toBeLessThan(before);
    expect(boss.stage).toBe('enter');

    park(boss);
    const view = tiebaoView(boss);
    expect(boss.phase).toBe('main');
    expect(boss.y).toBe(TIEBAO_PARK_Y);
    expect(view).toMatchObject({
      rail: 1,
      x: 180,
      phase: 'output',
      modeId: 'fan',
      modeName: '高射扇',
      list: 'main',
    });
  });

  it('rotates each rail A then B, and blocks damage and sheds while switching', () => {
    const boss = createBoss(TIEBAO);
    const around = world(4);
    park(boss, around);
    expect(tiebaoView(boss)).toMatchObject({ rail: 1, modeId: 'fan', modeName: '高射扇' });

    let guard = 0;
    while (tiebaoView(boss)?.phase !== 'move' && guard < 2000) {
      updateBoss(boss, FIXED_DT, around);
      guard++;
    }
    expect(tiebaoView(boss)?.phase).toBe('move');
    const quiet = updateBoss(boss, FIXED_DT, around);
    expect(tiebaoView(boss)?.phase).toBe('move');
    expect(quiet.shots).toHaveLength(0);
    expect(boss.invulnerable).toBe(true);
    expect(tiebaoVisual(boss)?.highlight).toBe(-1);
    expect(tiebaoVisual(boss)?.switch).not.toBeNull();
    const moving = tiebaoView(boss)!;
    const hp = boss.parts.reduce((sum, part) => sum + part.hp, 0);
    const hit = shot(boss, boss.x, boss.y, 5);
    expect(hit.consumedBullet).toBe(true);
    expect(applyBossBomb(boss).score).toBe(0);
    expect(boss.parts.reduce((sum, part) => sum + part.hp, 0)).toBe(hp);
    expect(boss.stage).toBe('fight');
    setMainHp(boss, 756);
    expect(tiebaoCommittedCars(boss)).toBe(9);

    const arrivals: string[][] = [[], [], []];
    let previousRail = moving.rail;
    let moveMode = moving.modeId;
    let checkedPark = false;
    let timed = false;
    let prevX = boss.x;
    let steps = 2;
    for (
      ;
      steps < 30000 &&
      (arrivals[0]!.length < 2 || arrivals[1]!.length < 1 || arrivals[2]!.length < 2);
      steps++
    ) {
      const ev = updateBoss(boss, FIXED_DT, around);
      expect(Math.abs(boss.x - prevX)).toBeLessThan(24);
      prevX = boss.x;
      const view = tiebaoView(boss)!;
      const modeId: string = view.modeId;
      expect(TIEBAO_MODE_IDS).toContain(view.modeId);
      expect(modeId === 'rockets' || modeId === 'crates').toBe(false);
      if (view.phase === 'move') {
        expect(boss.invulnerable).toBe(true);
        expect(view.modeId).toBe(moveMode);
        expect(view.rail).toBe(previousRail);
        expect(ev.shots).toHaveLength(0);
        if (!checkedPark) {
          expect(tiebaoCommittedCars(boss)).toBe(9);
          expect(tiebaoChaseBoost(boss)).toBe(0);
        }
      }
      if (view.phase === 'output' && view.rail !== previousRail) {
        if (timed) {
          expect(steps).toBeGreaterThan(5 * 60);
          expect(steps).toBeLessThan(10 * 60);
        }
        timed = true;
        const seen = arrivals[view.rail]!.length;
        const visit = view.rail === 1 ? seen + 2 : seen + 1;
        expect(view.modeId).toBe(tiebaoRailMode(view.rail, visit));
        arrivals[view.rail]!.push(view.modeId);
        previousRail = view.rail;
        moveMode = view.modeId;
        steps = 0;
        if (!checkedPark) {
          checkedPark = true;
          expect(boss.invulnerable).toBe(false);
          expect(tiebaoCommittedCars(boss)).toBe(8);
          expect(tiebaoChaseBoost(boss)).toBe(TIEBAO_CHASE_FLAME);
          const parkedHp = boss.parts.reduce((sum, part) => sum + part.hp, 0);
          const loco = bossPart(boss, 'roofLoco')!;
          shot(boss, loco.worldX, loco.worldY, 5);
          expect(boss.parts.reduce((sum, part) => sum + part.hp, 0)).toBe(parkedHp - 5);
        }
      }
    }
    expect(arrivals[0]!.slice(0, 2)).toEqual(['broadside', 'wall']);
    expect(arrivals[1]![0]).toBe('missiles');
    expect(arrivals[2]!.slice(0, 2)).toEqual(['rain', 'ram']);
    expect(checkedPark).toBe(true);
    expect(boss.phase).toBe('main');
  });

  it('runs a visible 1.9s or 3.8s turnout and only then takes damage', () => {
    expect(TIEBAO_SWITCH_RUSH).toBe(0.22);
    const boss = createBoss(TIEBAO);
    const around = world(1);
    park(boss, around);
    const depart = tiebaoView(boss);
    expect(depart).toMatchObject({ rail: 1, phase: 'output', modeId: 'fan' });

    let guard = 0;
    while (tiebaoView(boss)?.phase !== 'move' && guard < 2000) {
      expect(boss.invulnerable).toBe(false);
      updateBoss(boss, FIXED_DT, around);
      guard++;
    }
    expect(guard * FIXED_DT).toBeGreaterThan(4.5);
    expect(guard * FIXED_DT).toBeLessThan(5.1);
    const opening = tiebaoVisual(boss)?.switch;
    const view = tiebaoView(boss);
    expect(opening).not.toBeNull();
    expect(view?.phase).toBe('move');
    expect(view?.rail).toBe(1);
    expect(view?.target).not.toBe(view?.rail);
    expect(boss.invulnerable).toBe(true);
    const fromX = opening?.fromX ?? 0;
    const toX = opening?.toX ?? 0;
    const adjacent = Math.abs(toX - fromX) < 150;
    expect(adjacent).toBe(true);
    const onScreen = tiebaoCarPoses(boss).filter((pose) => pose.y > 0 && pose.y < LOGICAL_H);
    expect(onScreen.length).toBeGreaterThan(0);
    expect(onScreen.every((pose) => pose.angle === 0 && Math.abs(pose.x - fromX) < 1)).toBe(true);
    setMainHp(boss, 756);
    expect(tiebaoCommittedCars(boss)).toBe(9);

    const hp = boss.parts.reduce((sum, part) => sum + part.hp, 0);
    let frames = 0;
    let tailMoving = 0;
    let turnoutOnScreen = 0;
    let bent = false;
    while (tiebaoView(boss)?.phase === 'move' && frames < 2000) {
      expect(boss.invulnerable).toBe(true);
      expect(tiebaoView(boss)?.rail).toBe(1);
      expect(tiebaoView(boss)?.target).not.toBe(1);
      expect(tiebaoVisual(boss)?.switch).not.toBeNull();
      const marks = tiebaoVisual(boss)?.turnouts ?? [];
      if (marks.some((mark) => mark.y1 > 8 && mark.y0 < LOGICAL_H - 8)) turnoutOnScreen++;
      const poses = tiebaoCarPoses(boss).filter((pose) => pose.y > 0 && pose.y < LOGICAL_H);
      if (poses.some((pose) => Math.abs(pose.x - fromX) > 18)) tailMoving++;
      if (poses.some((pose) => Math.abs(pose.angle) > 0.02)) bent = true;
      const tail = poses[poses.length - 1];
      if (tail) {
        const before = boss.parts.reduce((sum, part) => sum + part.hp, 0);
        expect(shot(boss, tail.x, tail.y, 6).consumedBullet).toBe(true);
        expect(boss.parts.reduce((sum, part) => sum + part.hp, 0)).toBe(before);
      }
      updateBoss(boss, FIXED_DT, around);
      frames++;
    }

    const parked = tiebaoView(boss);
    expect(parked?.phase).toBe('output');
    expect(boss.invulnerable).toBe(false);
    expect(parked?.rail).not.toBe(1);
    expect(boss.x).toBeCloseTo(toX, 4);
    expect(parked?.modeId).toBe(tiebaoRailMode(parked?.rail ?? 0, 1));
    expect(Math.abs(frames * FIXED_DT - tiebaoMoveTime(fromX, toX))).toBeLessThan(0.08);
    expect(tiebaoMoveTime(fromX, toX)).toBeCloseTo(TIEBAO_MOVE + TIEBAO_MOVE_EXTRA, 5);
    expect(tailMoving / frames).toBeGreaterThan(0.45);
    expect(turnoutOnScreen / frames).toBeGreaterThan(0.6);
    expect(bent).toBe(true);
    expect(tiebaoCommittedCars(boss)).toBe(8);
    expect(tiebaoChaseBoost(boss)).toBe(TIEBAO_CHASE_FLAME);
    const parkedHp = boss.parts.reduce((sum, part) => sum + part.hp, 0);
    expect(parkedHp).toBe(hp);
    const tail = tiebaoCarPoses(boss).filter((pose) => pose.y > 0 && pose.y < LOGICAL_H);
    const hit = tail[tail.length - 1];
    expect(hit).toBeDefined();
    if (hit) shot(boss, hit.x, hit.y, 6);
    expect(boss.parts.reduce((sum, part) => sum + part.hp, 0)).toBe(parkedHp - 6);

    let crossFrames = 0;
    let crossSpan = 0;
    let crossMoving = 0;
    for (let hop = 0; hop < 12 && crossSpan < 200; hop++) {
      let wait = 0;
      while (tiebaoView(boss)?.phase !== 'move' && wait < 2000) {
        updateBoss(boss, FIXED_DT, around);
        wait++;
      }
      const sw = tiebaoVisual(boss)?.switch;
      expect(sw).not.toBeNull();
      const span = Math.abs((sw?.toX ?? 0) - (sw?.fromX ?? 0));
      const started = sw?.fromX ?? 0;
      let n = 0;
      let moving = 0;
      while (tiebaoView(boss)?.phase === 'move' && n < 2000) {
        expect(boss.invulnerable).toBe(true);
        const poses = tiebaoCarPoses(boss).filter((pose) => pose.y > 0 && pose.y < LOGICAL_H);
        if (poses.some((pose) => Math.abs(pose.x - started) > 18)) moving++;
        updateBoss(boss, FIXED_DT, around);
        n++;
      }
      expect(tiebaoView(boss)?.phase).toBe('output');
      expect(boss.invulnerable).toBe(false);
      expect(Math.abs(n * FIXED_DT - tiebaoMoveTime(sw?.fromX ?? 0, sw?.toX ?? 0))).toBeLessThan(
        0.08
      );
      if (span > 200) {
        crossFrames = n;
        crossSpan = span;
        crossMoving = moving;
      }
    }
    expect(crossSpan).toBe(TIEBAO_RAIL_X[2] - TIEBAO_RAIL_X[0]);
    expect(crossFrames * FIXED_DT).toBeCloseTo(2 * (TIEBAO_MOVE + TIEBAO_MOVE_EXTRA), 1);
    expect(crossMoving / crossFrames).toBeGreaterThan(0.45);
  });

  it('waits out a shed presentation before the next turnout', () => {
    const boss = createBoss(TIEBAO);
    const around = world(1);
    park(boss, around);
    step(boss, around, TIEBAO_SWITCH_PERIOD - TIEBAO_MOVE - 0.3);
    expect(tiebaoView(boss)?.phase).toBe('output');
    setMainHp(boss, 756);
    let sawHold = false;
    let guard = 0;
    for (; guard < 400; guard++) {
      updateBoss(boss, FIXED_DT, around);
      const view = tiebaoView(boss)!;
      if (view.phase === 'move') break;
      if (tiebaoChaseBoost(boss) > 0) sawHold = true;
      expect(view.phase).toBe('output');
      expect(boss.invulnerable).toBe(false);
      expect(tiebaoCommittedCars(boss)).toBe(8);
    }
    expect(sawHold).toBe(true);
    expect(tiebaoView(boss)?.phase).toBe('move');
    expect(tiebaoChaseBoost(boss)).toBe(0);
    expect(boss.y).toBeCloseTo(tiebaoRestCenter(8), 2);
    expect(boss.invulnerable).toBe(true);

    const departed = tiebaoView(boss)?.rail;
    let crossing = 0;
    while (tiebaoView(boss)?.phase === 'move' && crossing < 800) {
      expect(boss.invulnerable).toBe(true);
      expect(tiebaoVisual(boss)?.switch).not.toBeNull();
      updateBoss(boss, FIXED_DT, around);
      crossing++;
    }
    expect(tiebaoView(boss)?.phase).toBe('output');
    expect(boss.invulnerable).toBe(false);
    expect(tiebaoView(boss)?.rail).not.toBe(departed);
    expect(crossing * FIXED_DT).toBeGreaterThan(1.4);
    expect(crossing * FIXED_DT).toBeLessThan(4.1);

    let again = 0;
    while (tiebaoView(boss)?.phase !== 'move' && again < 800) {
      expect(tiebaoView(boss)?.phase).toBe('output');
      expect(boss.invulnerable).toBe(false);
      updateBoss(boss, FIXED_DT, around);
      again++;
    }
    expect(tiebaoView(boss)?.phase).toBe('move');
    expect(again * FIXED_DT).toBeGreaterThan(4);
    expect(again * FIXED_DT).toBeLessThan(TIEBAO_SWITCH_PERIOD - TIEBAO_MOVE + 0.25);
  });

  it('transfers a nose hit to the locomotive gun and a tail hit to the rear gun', () => {
    const boss = createBoss(TIEBAO);
    park(boss);
    const loco = bossPart(boss, 'roofLoco')!;
    const car = bossPart(boss, 'roofCar')!;
    const nose = shot(boss, loco.worldX, loco.worldY + 20, 9);
    expect(nose.consumedBullet).toBe(true);
    expect(loco.hp).toBe(TIEBAO_ROOF_HP - 9);
    expect(car.hp).toBe(TIEBAO_ROOF_HP);
    expect(bossPart(boss, 'core')!.hp).toBe(TIEBAO_CORE_HP);

    const tail = shot(boss, car.worldX, car.worldY + 22, 9);
    expect(tail.consumedBullet).toBe(true);
    expect(car.hp).toBe(TIEBAO_ROOF_HP - 9);
    expect(loco.hp).toBe(TIEBAO_ROOF_HP - 9);
    expect(bossPart(boss, 'core')!.hp).toBe(TIEBAO_CORE_HP);
  });

  it('pre-lays one turnout and banks rigid cars without shearing', () => {
    expect(TIEBAO_SWITCH_PERIOD).toBe(6);
    expect(TIEBAO_OVERLOAD_PERIOD).toBe(6);
    expect(TIEBAO_MOVE).toBe(1.2);
    expect(TIEBAO_MOVE_EXTRA).toBe(0.7);
    expect(TIEBAO_MOVE).toBe(TIEBAO_OVERLOAD_MOVE);
    expect(tiebaoMoveTime(180, 72)).toBeCloseTo(TIEBAO_MOVE + TIEBAO_MOVE_EXTRA, 6);
    expect(tiebaoMoveTime(72, 288)).toBeCloseTo(2 * tiebaoMoveTime(72, 180), 6);
    expect(tiebaoMoveTime(288, 72)).toBeCloseTo(2 * (TIEBAO_MOVE + TIEBAO_MOVE_EXTRA), 6);
    expect(TIEBAO_SWITCH_SPAN).toBe(240);
    expect(TIEBAO_SWITCH_CROSS_SPAN).toBe(480);
    expect(TIEBAO_SWITCH_LEAD).toBe(64);
    expect(TIEBAO_CAR_MAX_BANK).toBe(25);
    expect(tiebaoSwitchSpan(72, 180)).toBe(TIEBAO_SWITCH_SPAN);
    expect(tiebaoSwitchSpan(72, 288)).toBe(TIEBAO_SWITCH_CROSS_SPAN);

    const height = TIEBAO_HULL_H;
    const tail = 328;
    const nose = tail - height;
    const lead = TIEBAO_SWITCH_LEAD;
    expect(tiebaoSwitchX(nose, 72, 180, 0, tail, height)).toBe(72);
    expect(tiebaoSwitchX(tail, 72, 180, 0, tail, height)).toBe(72);
    expect(tiebaoSwitchX(nose, 72, 180, 1, tail, height)).toBe(180);
    expect(tiebaoSwitchX(tail, 72, 180, 1, tail, height)).toBe(180);
    const laid = tiebaoSwitchBand(0, tail, height, 72, 180);
    expect(laid.y1).toBeCloseTo(nose - lead, 6);
    const ahead = (laid.y0 + laid.y1) / 2;
    expect(Math.abs(tiebaoSwitchX(ahead, 72, 180, 0, tail, height) - 72)).toBeGreaterThan(20);

    const travel = height + TIEBAO_SWITCH_SPAN + lead;
    const uNose = (lead + TIEBAO_SWITCH_SPAN) / travel;
    const uTail = (height + lead) / travel;
    expect(uTail).toBeGreaterThan(uNose);
    const midMove = (uNose + uTail) / 2;
    expect(tiebaoSwitchX(nose, 72, 180, midMove, tail, height)).toBe(180);
    expect(tiebaoSwitchX(tail, 72, 180, midMove, tail, height)).toBe(72);
    expect(TIEBAO_SWITCH_CROSS_SPAN).toBeGreaterThan(height);

    const band = tiebaoSwitchBand(0.5, tail, height, 72, 288);
    let prev = 72;
    for (let i = 0; i <= 20; i++) {
      const y = band.y1 - (i / 20) * band.span;
      const x = tiebaoSwitchX(y, 72, 288, 0.5, tail, height);
      expect(x).toBeGreaterThanOrEqual(prev - 1e-6);
      prev = x;
    }
    expect(prev).toBeCloseTo(288, 4);
    const midY = (band.y0 + band.y1) / 2;
    expect(tiebaoSwitchX(midY, 72, 288, 0.5, tail, height)).toBeCloseTo(180, 4);
    const marks = tiebaoTurnoutMarks(0.5, tail, height, 72, 288);
    expect(marks.filter((mark) => mark.kind === 'frog')).toHaveLength(2);
    expect(marks.filter((mark) => mark.kind === 'points')).toHaveLength(2);
    expect(marks.some((mark) => mark.kind === 'frog' && mark.joinX === 180)).toBe(true);

    let last = tiebaoSwitchX(tail, 180, 288, 0, tail, height);
    for (let frame = 1; frame <= 72; frame++) {
      const x = tiebaoSwitchX(tail, 180, 288, frame / 72, tail, height);
      expect(Math.abs(x - last)).toBeLessThan(24);
      last = x;
    }
    expect(last).toBeCloseTo(288, 4);

    const cap = (TIEBAO_CAR_MAX_BANK * Math.PI) / 180;
    expect(tiebaoBankAngle(72, 72, 80)).toBe(0);
    expect(tiebaoBankAngle(72 + 108, 72, 80)).toBeCloseTo(cap, 5);
    expect(tiebaoBankAngle(72 - 108, 72, 80)).toBeCloseTo(-cap, 5);
    expect(tiebaoBankAngle(82, 72, 80)).toBeCloseTo(Math.atan2(10, 80), 5);

    expect(tiebaoPieces(9)).toHaveLength(10);
    expect(tiebaoPieces(2)).toHaveLength(3);
    expect(tiebaoPieces(0)).toHaveLength(1);
    expect(tiebaoPieces(9).reduce((sum, piece) => sum + piece.h, 0)).toBe(tiebaoHullHeight(9));
    expect(tiebaoPieces(2).reduce((sum, piece) => sum + piece.h, 0)).toBe(height);

    const parked = tiebaoPiecePoses(2, nose, () => 180);
    expect(parked.every((pose) => pose.angle === 0 && pose.x === 180)).toBe(true);
    const hinged = tiebaoPiecePoses(2, nose, (y) =>
      tiebaoSwitchX(y, 72, 180, midMove, tail, height)
    );
    expect(hinged).toHaveLength(3);
    expect(hinged.every((pose) => Math.abs(pose.angle) <= cap + 1e-9)).toBe(true);
    expect(hinged.some((pose) => pose.angle !== 0)).toBe(true);
    expect(Math.abs(hinged[0]!.x - 180)).toBeLessThan(Math.abs(hinged[2]!.x - 180));

    const curve = tiebaoSwitchBand(0.4, tail, height, 72, 180);
    const curveY = (curve.y0 + curve.y1) / 2;
    expect(tiebaoClosureX(curve.y1, 72, 180, curve.y0, curve.y1)).toBe(72);
    expect(tiebaoClosureX(curve.y0, 72, 180, curve.y0, curve.y1)).toBe(180);
    expect(tiebaoClosureX(curveY, 72, 180, curve.y0, curve.y1)).toBeCloseTo(
      tiebaoSwitchX(curveY, 72, 180, 0.4, tail, height),
      6
    );
  });

  it('spends the longer move on the closure and still finishes on the new rail', () => {
    const boss = createBoss(TIEBAO);
    const around = world(1);
    park(boss, around);
    let guard = 0;
    while (tiebaoView(boss)?.phase !== 'move' && guard < 2000) {
      updateBoss(boss, FIXED_DT, around);
      guard++;
    }
    const sw = tiebaoVisual(boss)?.switch;
    expect(sw).not.toBeNull();
    const expected = sw ? Math.round(tiebaoMoveTime(sw.fromX, sw.toX) / FIXED_DT) : 0;
    let frames = 0;
    while (tiebaoView(boss)?.phase === 'move' && frames < 2000) {
      updateBoss(boss, FIXED_DT, around);
      frames++;
    }
    expect(tiebaoView(boss)?.phase).toBe('output');
    expect(Math.abs(frames - expected)).toBeLessThanOrEqual(2);
    expect(TIEBAO_RAIL_X).toContain(boss.x);
  });

  it('leaves the closure on the map after the move and scrolls it off the bottom', () => {
    const boss = createBoss(TIEBAO);
    const around = world(1);
    park(boss, around);
    let guard = 0;
    while (tiebaoView(boss)?.phase !== 'move' && guard < 2000) {
      updateBoss(boss, FIXED_DT, around);
      guard++;
    }
    const live = tiebaoVisual(boss);
    const sw = live?.switch;
    expect(sw).not.toBeNull();
    expect(live?.turnouts).toHaveLength(1);
    if (sw && live) {
      const band = tiebaoSwitchBand(sw.u, sw.tailY, sw.height, sw.fromX, sw.toX);
      expect(live.turnouts[0]?.y1).toBeCloseTo(band.y1, 4);
      expect(live.turnouts[0]?.y0).toBeCloseTo(band.y0, 4);
      expect(live.turnouts[0]?.fromX).toBe(sw.fromX);
      expect(live.turnouts[0]?.toX).toBe(sw.toX);
    }

    while (tiebaoView(boss)?.phase === 'move' && guard < 4000) {
      updateBoss(boss, FIXED_DT, around);
      guard++;
    }
    expect(tiebaoView(boss)?.phase).toBe('output');
    const parked = tiebaoVisual(boss);
    expect(parked?.switch).toBeNull();
    expect(parked?.turnouts).toHaveLength(1);
    const done = parked?.turnouts[0];
    expect(done).toBeDefined();
    if (done) {
      const end = tiebaoSwitchBand(
        1,
        tiebaoTailY(tiebaoCommittedCars(boss)),
        tiebaoLiveHull(boss).h,
        done.fromX,
        done.toX
      );
      expect(done.y1).toBeCloseTo(end.y1, 3);
      expect(done.y0).toBeCloseTo(end.y0, 3);
      const held = { ...around, scroll: 40 };
      updateBoss(boss, FIXED_DT, held);
      const shifted = tiebaoVisual(boss)?.turnouts[0];
      expect(shifted?.y1).toBeCloseTo(done.y1 + 40, 3);
      expect(shifted?.y0).toBeCloseTo(done.y0 + 40, 3);
      expect(tiebaoVisual(boss)?.turnouts).toHaveLength(1);

      let next = 0;
      while (tiebaoView(boss)?.phase !== 'move' && next < 400) {
        updateBoss(boss, FIXED_DT, held);
        next++;
      }
      expect(tiebaoView(boss)?.phase).toBe('move');
      expect(tiebaoVisual(boss)?.turnouts).toHaveLength(2);
      expect(tiebaoVisual(boss)?.turnouts[0]?.y1).toBeCloseTo(done.y1 + 40, 3);

      updateBoss(boss, FIXED_DT, { ...around, scroll: 40 + LOGICAL_H + 800 });
      const left = tiebaoVisual(boss)?.turnouts ?? [];
      expect(left).toHaveLength(1);
      expect(tiebaoView(boss)?.phase).toBe('move');
    }
  });

  it('does not die during a move, then keeps the laid closure after a parked kill', () => {
    const boss = createBoss(TIEBAO);
    const around = world(2);
    park(boss, around);
    const loco = bossPart(boss, 'roofLoco')!;
    const car = bossPart(boss, 'roofCar')!;
    shot(boss, loco.worldX, loco.worldY);
    shot(boss, car.worldX, car.worldY);
    expect(boss.phase).toBe('core');
    let guard = 0;
    while (tiebaoView(boss)?.phase !== 'move' && guard < 2000) {
      updateBoss(boss, FIXED_DT, around);
      guard++;
    }
    expect(tiebaoView(boss)?.phase).toBe('move');
    const before = tiebaoVisual(boss)?.turnouts[0];
    const mode = tiebaoView(boss)?.modeId;
    const rail = tiebaoView(boss)?.rail;
    expect(before).toBeDefined();
    expect(boss.invulnerable).toBe(true);
    const core = bossPart(boss, 'core')!;
    const hp = core.hp;
    shot(boss, core.worldX, core.worldY);
    expect(boss.stage).toBe('fight');
    expect(core.hp).toBe(hp);
    expect(tiebaoView(boss)?.modeId).toBe(mode);
    expect(tiebaoView(boss)?.rail).toBe(rail);
    expect(tiebaoVisual(boss)?.switch).not.toBeNull();
    expect(tiebaoVisual(boss)?.turnouts).toHaveLength(1);

    guard = 0;
    while (tiebaoView(boss)?.phase !== 'output' && guard < 2000) {
      updateBoss(boss, FIXED_DT, around);
      guard++;
    }
    expect(tiebaoView(boss)?.phase).toBe('output');
    expect(boss.invulnerable).toBe(false);
    expect(tiebaoView(boss)?.modeId).not.toBe(mode);
    const parked = tiebaoVisual(boss);
    const laid = parked?.turnouts[0];
    expect(parked?.switch).toBeNull();
    expect(laid?.fromX).toBe(before?.fromX);
    expect(laid?.toX).toBe(before?.toX);
    shot(boss, bossPart(boss, 'core')!.worldX, bossPart(boss, 'core')!.worldY);
    expect(boss.stage).toBe('death');
    const after = tiebaoVisual(boss);
    expect(after?.switch).toBeNull();
    expect(after?.turnouts[0]?.fromX).toBe(laid?.fromX);
    expect(after?.turnouts[0]?.toX).toBe(laid?.toX);
    expect(after?.turnouts[0]?.y1).toBeCloseTo(laid?.y1 ?? 0, 3);
    updateBoss(boss, FIXED_DT, { ...around, scroll: 40 });
    expect(tiebaoVisual(boss)?.turnouts[0]?.y1).toBeCloseTo((laid?.y1 ?? 0) + 40, 3);
    expect(tiebaoVisual(boss)?.turnouts).toHaveLength(1);
  });

  it('hinges an on-screen consist on the shared curve and does not take damage there', () => {
    const boss = createBoss(TIEBAO);
    const around = world(1);
    park(boss, around);
    const parked = tiebaoHullSegments(boss);
    expect(parked).toHaveLength(1 + tiebaoCommittedCars(boss));
    let edge = boss.y - tiebaoLiveHull(boss).h / 2;
    for (const seg of parked) {
      expect(seg.x).toBeCloseTo(boss.x - TIEBAO_HULL_W / 2, 6);
      expect(seg.w).toBeCloseTo(TIEBAO_HULL_W, 6);
      expect(seg.y).toBeCloseTo(edge, 6);
      edge += seg.h;
    }
    expect(edge).toBeCloseTo(boss.y + tiebaoLiveHull(boss).h / 2, 6);

    setMainHp(boss, (TIEBAO_ROOF_HP * 2 + TIEBAO_CORE_HP) * 0.3);
    step(boss, around, TIEBAO_SHED_DELAY + TIEBAO_SHED_SLIDE * 7 + FIXED_DT);
    expect(tiebaoCommittedCars(boss)).toBe(2);
    expect(boss.y).toBeCloseTo(tiebaoRestCenter(2), 2);

    let guard = 0;
    while (tiebaoView(boss)?.phase !== 'move' && guard < 2000) {
      updateBoss(boss, FIXED_DT, around);
      guard++;
    }
    expect(tiebaoView(boss)?.phase).toBe('move');
    const opening = tiebaoVisual(boss)?.switch;
    expect(opening).not.toBeNull();
    if (opening) {
      const noseY = opening.tailY - opening.height;
      const band = tiebaoSwitchBand(
        opening.u,
        opening.tailY,
        opening.height,
        opening.fromX,
        opening.toX
      );
      expect(band.y1).toBeLessThan(noseY);
      const straight = tiebaoCarPoses(boss);
      expect(straight).toHaveLength(1 + tiebaoCommittedCars(boss));
      expect(straight.every((pose) => pose.angle === 0 && pose.x === opening.fromX)).toBe(true);
    }

    const cap = (TIEBAO_CAR_MAX_BANK * Math.PI) / 180;
    let hinged = false;
    for (let i = 0; i < 90 && !hinged; i++) {
      updateBoss(boss, FIXED_DT, around);
      const sw = tiebaoVisual(boss)?.switch;
      if (!sw) continue;
      const poses = tiebaoCarPoses(boss);
      expect(poses.reduce((sum, pose) => sum + pose.h, 0)).toBe(sw.height);
      expect(poses.every((pose) => Math.abs(pose.angle) <= cap + 1e-9)).toBe(true);
      if (!poses.some((pose) => pose.angle !== 0)) continue;
      hinged = true;
      const noseX = tiebaoSwitchX(
        sw.tailY - sw.height,
        sw.fromX,
        sw.toX,
        sw.u,
        sw.tailY,
        sw.height
      );
      const tailX = tiebaoSwitchX(sw.tailY, sw.fromX, sw.toX, sw.u, sw.tailY, sw.height);
      expect(Math.abs(noseX - sw.toX)).toBeLessThan(Math.abs(tailX - sw.toX));
      for (const id of ['core', 'roofLoco', 'roofCar'] as const) {
        const part = bossPart(boss, id)!;
        expect(part.worldX).toBeCloseTo(
          tiebaoSwitchX(part.worldY, sw.fromX, sw.toX, sw.u, sw.tailY, sw.height),
          4
        );
      }
      const hp = boss.parts.reduce((sum, part) => sum + part.hp, 0);
      expect(boss.invulnerable).toBe(true);
      for (const pose of poses) {
        expect(shot(boss, pose.x, pose.y, 4).consumedBullet).toBe(true);
      }
      expect(boss.parts.reduce((sum, part) => sum + part.hp, 0)).toBe(hp);
      expect(shot(boss, 0, poses[0]!.y, 4).consumedBullet).toBe(false);
      const quiet = updateBoss(boss, FIXED_DT, around);
      expect(tiebaoView(boss)?.phase).toBe('move');
      expect(quiet.shots).toHaveLength(0);
    }
    expect(hinged).toBe(true);
  });

  it('does not ram while more than four cars are still attached', () => {
    const boss = createBoss(TIEBAO);
    const around = world(2);
    park(boss, around);
    let guard = 0;
    while (tiebaoView(boss)?.modeId !== 'ram' && guard < 24000) {
      updateBoss(boss, FIXED_DT, around);
      guard++;
    }
    expect(tiebaoView(boss)?.modeId).toBe('ram');
    expect(tiebaoView(boss)?.rail).toBe(2);
    expect(tiebaoCommittedCars(boss)).toBe(9);
    for (let i = 0; i < 90; i++) {
      updateBoss(boss, FIXED_DT, around);
      expect(boss.y).toBe(TIEBAO_PARK_Y);
      expect(TIEBAO_RAIL_X).toContain(boss.x);
    }
  });

  it('dashes to the bottom edge once the consist is loco+4, then retreats', () => {
    expect(TIEBAO_RAM_BOTTOM).toBe(LOGICAL_H);
    expect(TIEBAO_RAM_DIVE).toBeLessThan(0.2);
    expect(TIEBAO_RAM_RETURN).toBeGreaterThan(TIEBAO_RAM_DIVE * 8);
    const boss = createBoss(TIEBAO);
    const around = world(2);
    park(boss, around);
    setMainHp(boss, (TIEBAO_ROOF_HP * 2 + TIEBAO_CORE_HP) * 0.5);
    let guard = 0;
    while (tiebaoView(boss)?.modeId !== 'ram' && guard < 24000) {
      updateBoss(boss, FIXED_DT, around);
      guard++;
    }
    expect(tiebaoView(boss)?.modeId).toBe('ram');
    expect(tiebaoView(boss)?.rail).toBe(2);
    expect(tiebaoCommittedCars(boss)).toBe(4);
    const home = tiebaoRestCenter(4);
    const diveY = TIEBAO_RAM_BOTTOM - tiebaoHullHeight(4) / 2;
    let toBottom = -1;
    let back = -1;
    for (let i = 0; i < 400 && back < 0; i++) {
      updateBoss(boss, FIXED_DT, around);
      if (toBottom < 0 && boss.y >= diveY - 1) toBottom = i;
      if (toBottom >= 0 && Math.abs(boss.y - home) < 1) back = i;
    }
    const lead = Math.ceil(TIEBAO_RAM_START / FIXED_DT);
    expect(toBottom).toBeGreaterThan(lead - 2);
    expect(toBottom).toBeLessThan(lead + Math.ceil(TIEBAO_RAM_DIVE / FIXED_DT) + 3);
    expect(back - toBottom).toBeGreaterThan(Math.floor(TIEBAO_RAM_RETURN / FIXED_DT) - 2);
    const hold =
      Math.floor((TIEBAO_SWITCH_PERIOD - TIEBAO_MOVE - TIEBAO_RAM_START) / FIXED_DT) - back;
    for (let i = 0; i < hold; i++) {
      updateBoss(boss, FIXED_DT, around);
      expect(boss.y).toBeLessThan(home + 4);
    }
    expect(boss.invulnerable).toBe(false);
  });

  it('explodes one rear car when main HP crosses 90%', () => {
    const boss = createBoss(TIEBAO);
    const around = world(3);
    park(boss, around);
    expect(tiebaoCommittedCars(boss)).toBe(9);
    expect(tiebaoLiveHull(boss).h).toBe(tiebaoHullHeight(9));
    expect(boss.y).toBe(tiebaoRestCenter(9));
    setMainHp(boss, 756);
    const ev = updateBoss(boss, FIXED_DT, around);
    const holdY = tiebaoRestCenter(9) - tiebaoHullHeight(9) / 2 + tiebaoHullHeight(8) / 2;
    expect(tiebaoCommittedCars(boss)).toBe(8);
    expect(tiebaoLiveHull(boss).h).toBe(760);
    expect(boss.y).toBeCloseTo(holdY, 2);
    expect(tiebaoChaseBoost(boss)).toBe(TIEBAO_CHASE_FLAME);
    expect(boss.phase).toBe('main');
    expect(TIEBAO_RAIL_X).toContain(boss.x);
    expect(ev.explosions).toHaveLength(3);
    expect(ev.explosions.filter((burst) => burst.size === 'medium')).toHaveLength(1);
    const drop = tiebaoRestCenter(8) - holdY;
    expect(drop).toBeGreaterThan(TIEBAO_CAR_H);
    expect(drop).toBeCloseTo(TIEBAO_CAR_PITCH + TIEBAO_SHED_ADVANCE, 6);

    step(boss, around, TIEBAO_SHED_DELAY - FIXED_DT * 2);
    expect(tiebaoCommittedCars(boss)).toBe(8);
    expect(boss.y).toBeCloseTo(holdY, 2);
    expect(tiebaoChaseBoost(boss)).toBe(TIEBAO_CHASE_FLAME);

    let guard = 0;
    while (tiebaoChaseBoost(boss) > 0 && guard < 30) {
      updateBoss(boss, FIXED_DT, around);
      guard++;
    }
    expect(tiebaoChaseBoost(boss)).toBe(0);
    expect(tiebaoCommittedCars(boss)).toBe(8);
    expect(boss.y).toBeCloseTo(holdY, 2);

    step(boss, around, TIEBAO_SHED_SLIDE * 0.5);
    expect(boss.y).toBeGreaterThan(holdY + 1);
    expect(boss.y).toBeLessThan(tiebaoRestCenter(8) - 1);

    step(boss, around, TIEBAO_SHED_SLIDE);
    expect(boss.y).toBeCloseTo(tiebaoRestCenter(8), 2);
    expect(tiebaoCommittedCars(boss)).toBe(8);
    expect(tiebaoChaseBoost(boss)).toBe(0);
  });

  it('sheds every crossed threshold in one step and holds loco+2 below 30%', () => {
    const boss = createBoss(TIEBAO);
    const around = world(3);
    park(boss, around);
    setMainHp(boss, 252);
    const ev = updateBoss(boss, FIXED_DT, around);
    const holdY = tiebaoRestCenter(9) - tiebaoHullHeight(9) / 2 + TIEBAO_HULL_H / 2;
    expect(tiebaoCommittedCars(boss)).toBe(2);
    expect(tiebaoLiveHull(boss).h).toBe(TIEBAO_HULL_H);
    expect(boss.y).toBeCloseTo(holdY, 2);
    expect(tiebaoChaseBoost(boss)).toBe(TIEBAO_CHASE_FLAME);
    expect(boss.phase).toBe('main');
    expect(ev.explosions).toHaveLength(21);
    expect(ev.explosions.filter((burst) => burst.size === 'medium')).toHaveLength(7);
    step(boss, around, TIEBAO_SHED_DELAY - FIXED_DT * 2);
    expect(tiebaoCommittedCars(boss)).toBe(2);
    expect(boss.y).toBeCloseTo(holdY, 2);
    expect(tiebaoChaseBoost(boss)).toBe(TIEBAO_CHASE_FLAME);
    let guard = 0;
    while (tiebaoChaseBoost(boss) > 0 && guard < 30) {
      updateBoss(boss, FIXED_DT, around);
      guard++;
    }
    expect(tiebaoChaseBoost(boss)).toBe(0);
    expect(boss.y).toBeCloseTo(holdY, 2);
    step(boss, around, TIEBAO_SHED_SLIDE * 7);
    expect(boss.y).toBeCloseTo(tiebaoRestCenter(2), 2);
    expect(tiebaoCommittedCars(boss)).toBe(2);
    expect(tiebaoChaseBoost(boss)).toBe(0);

    setMainHp(boss, 84);
    const later = updateBoss(boss, FIXED_DT, around);
    expect(tiebaoCommittedCars(boss)).toBe(2);
    expect(tiebaoLiveHull(boss).h).toBe(TIEBAO_HULL_H);
    expect(later.explosions.filter((burst) => burst.size === 'medium')).toHaveLength(0);
  });
});

function setMainHp(boss: BossRuntime, hp: number): void {
  const car = bossPart(boss, 'roofCar')!;
  const loco = bossPart(boss, 'roofLoco')!;
  const core = bossPart(boss, 'core')!;
  const each = Math.floor(hp / 3);
  car.hp = each;
  loco.hp = each;
  core.hp = hp - each * 2;
}

describe('铁堡 phases', () => {
  function openCore(boss: BossRuntime): number {
    park(boss);
    const loco = bossPart(boss, 'roofLoco')!;
    const car = bossPart(boss, 'roofCar')!;
    let score = 0;
    score += shot(boss, loco.worldX, loco.worldY).score;
    score += shot(boss, car.worldX, car.worldY).score;
    return score;
  }

  function coreShot(boss: BossRuntime, damage?: number) {
    const core = bossPart(boss, 'core')!;
    return shot(boss, core.worldX, core.worldY, damage);
  }

  it('pays the core on Easy and does not enter overload', () => {
    const boss = createBoss(TIEBAO);
    const roofs = openCore(boss);
    expect(roofs).toBe(TIEBAO_ROOF_SCORE * 2);
    expect(boss.phase).toBe('core');
    expect(boss.invulnerable).toBe(false);
    expect(bossLook(boss)?.glow?.color).toBe('orange');
    expect(tiebaoView(boss)?.modeId).toBe('fan');
    const core = coreShot(boss);
    expect(core.score).toBe(TIEBAO_CORE_SCORE);
    expect(boss.stage).toBe('death');
    expect(boss.phase).toBe('death');
    expect(boss.extraArmed).toBe(false);
    expect(tiebaoLiveHull(boss).h).toBe(TIEBAO_HULL_H);
    expect(tiebaoCommittedCars(boss)).toBe(2);
  });

  it('opens Hard overload on 落弹雨, then the compressed cycle', () => {
    const boss = createBoss(prepareBossConfig(TIEBAO, 'hard'), { gates: ['hard'] });
    openCore(boss);
    const core = coreShot(boss);
    expect(core.score).toBe(0);
    expect(boss.phase).toBe('overloadIn');
    expect(boss.invulnerable).toBe(true);
    expect(core.convertBullets).toBe(true);

    const around = world(9);
    for (let i = 0; i < Math.ceil(TIEBAO_OVERLOAD_TRANSITION / FIXED_DT) + 2; i++) {
      updateBoss(boss, FIXED_DT, around);
    }
    expect(boss.phase).toBe('overload');
    expect(boss.invulnerable).toBe(false);
    expect(bossLook(boss)?.glow?.color).toBe('yellow');
    expect(bossLook(boss)?.smoke).toBe(true);
    expect(tiebaoView(boss)).toMatchObject({ modeId: 'rain', list: 'overload', phase: 'output' });
    expect(tiebaoCommittedCars(boss)).toBe(2);
    expect(tiebaoLiveHull(boss).h).toBe(TIEBAO_HULL_H);
    const overloadHp = bossPart(boss, 'core')!.hp;
    coreShot(boss, 40);
    expect(bossPart(boss, 'core')!.hp).toBe(overloadHp - 40);
    expect(tiebaoCommittedCars(boss)).toBe(2);
    expect(boss.phase).toBe('overload');

    const cycle = ['rain', 'wall', 'missiles', 'rain'] as const;
    let index = 0;
    let steps = 0;
    let moveBlocked = false;
    for (let guard = 0; guard < 2200 && index < cycle.length - 1; guard++) {
      const before = tiebaoView(boss)!.modeId;
      const frame = updateBoss(boss, FIXED_DT, around);
      const view = tiebaoView(boss)!;
      const modeId: string = view.modeId;
      expect(modeId === 'rockets' || modeId === 'crates').toBe(false);
      expect(cycle).toContain(view.modeId);
      if (view.phase === 'move') {
        expect(boss.invulnerable).toBe(true);
        expect(view.modeId).toBe(before);
        expect(frame.shots).toHaveLength(0);
        if (!moveBlocked) {
          moveBlocked = true;
          const hp = bossPart(boss, 'core')!.hp;
          coreShot(boss, 40);
          expect(bossPart(boss, 'core')!.hp).toBe(hp);
        }
      }
      steps++;
      if (view.phase === 'output' && view.modeId !== before && steps > 4 * 60) {
        index++;
        expect(view.modeId).toBe(cycle[index]);
        expect(view.list).toBe('overload');
        expect(steps).toBeLessThan(10 * 60);
        steps = 0;
      }
    }
    expect(index).toBe(cycle.length - 1);
    expect(moveBlocked).toBe(true);
    expect(tiebaoView(boss)?.phase).toBe('output');

    const dying = coreShot(boss);
    expect(dying.score).toBe(TIEBAO_CORE_SCORE);
    expect(boss.stage).toBe('death');
  });
});
