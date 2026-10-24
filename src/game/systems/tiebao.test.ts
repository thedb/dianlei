import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import {
  FIXED_DT,
  LOGICAL_H,
  TIEBAO_CORE_HP,
  TIEBAO_CORE_SCORE,
  TIEBAO_ENTER_DURATION,
  TIEBAO_ENCOUNTER_TAIL_Y,
  TIEBAO_FAN_FIRST,
  TIEBAO_FAN_INTERVAL,
  TIEBAO_HULL_H,
  TIEBAO_MISSILE_GAP,
  TIEBAO_MOVE,
  TIEBAO_OVERLOAD_HP,
  TIEBAO_OVERLOAD_MOVE,
  TIEBAO_OVERLOAD_PERIOD,
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
} from '@/game/config';
import { prepareBossConfig } from '@/game/difficulty';
import { TIEBAO } from '@/game/levels/bosses/tiebao';
import {
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
  tiebaoCommittedCars,
  tiebaoLiveHull,
  tiebaoSwitchX,
  tiebaoView,
  tiebaoVisual,
} from '@/game/systems/tiebao';
import { tiebaoHullHeight, tiebaoRestCenter } from '@/game/systems/tiebaoShed';

function world(seed = 1): BossWorld {
  return { playerX: 180, playerY: 520, rng: createRng(seed) };
}

function park(boss: BossRuntime, around: BossWorld = world()): void {
  updateBoss(boss, TIEBAO_ENTER_DURATION, around);
}

function shot(boss: BossRuntime, x: number, y: number, damage = 10000) {
  return resolveBossBullet(boss, { x, y, w: 4, h: 8 }, damage);
}

describe('铁堡 config', () => {
  it('parses the rail script, the fixed mode order, and no laser', () => {
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
    expect([...TIEBAO_MODE_IDS]).toEqual([
      'fan',
      'missiles',
      'rain',
      'broadside',
      'wall',
      'ram',
      'rockets',
      'crates',
    ]);
    expect([...TIEBAO_MODE_NAMES]).toEqual([
      '高射扇',
      '导弹齐射',
      '落弹雨',
      '侧舷扫射',
      '封轨弹墙',
      '冲轨撞击',
      '三轨火箭',
      '弹链抛射',
    ]);
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

  it('walks the eight modes in order and stays hittable while switching', () => {
    const boss = createBoss(TIEBAO);
    const around = world(4);
    park(boss, around);
    const seen: string[] = [];
    let previousRail = 1;
    let checkedMove = false;
    for (let n = 0; n < 8; n++) {
      const started = tiebaoView(boss)!.modeId;
      let steps = 0;
      for (; steps < 800; steps++) {
        updateBoss(boss, FIXED_DT, around);
        const view = tiebaoView(boss)!;
        expect(view.phase === 'output' || view.phase === 'move').toBe(true);
        expect(TIEBAO_RAIL_X).toContain(boss.x);
        if (!checkedMove && view.phase === 'move') {
          for (let extra = 0; extra < 12; extra++) updateBoss(boss, FIXED_DT, around);
          steps += 12;
          checkedMove = true;
          expect(boss.invulnerable).toBe(false);
          expect(boss.stage).toBe('fight');
          const slid = tiebaoView(boss)!;
          expect(slid.phase).toBe('move');
          expect(boss.x).toBe(TIEBAO_RAIL_X[slid.rail]);
          const visual = tiebaoVisual(boss);
          expect(visual?.highlight).toBe(-1);
          expect(visual?.switch).not.toBeNull();
          expect(visual?.switch?.fromX).toBe(boss.x);
          expect(visual?.switch?.toX).not.toBe(boss.x);
          const loco = bossPart(boss, 'roofLoco')!;
          const hp = loco.hp;
          const hit = shot(boss, loco.worldX, loco.worldY, 5);
          expect(hit.consumedBullet).toBe(true);
          expect(loco.hp).toBeLessThan(hp);
        }
        if (view.phase === 'output' && view.modeId !== started && steps > 30) {
          seen.push(view.modeId);
          expect(view.rail).not.toBe(previousRail);
          previousRail = view.rail;
          expect(steps).toBeGreaterThan(5 * 60);
          expect(steps).toBeLessThan(7 * 60);
          break;
        }
      }
      expect(steps).toBeLessThan(800);
    }
    expect(seen).toEqual([
      'missiles',
      'rain',
      'broadside',
      'wall',
      'ram',
      'rockets',
      'crates',
      'fan',
    ]);
    expect(checkedMove).toBe(true);
    expect(boss.phase).toBe('main');
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

  it('rides a turnout onto the other rail and does not light a target', () => {
    expect(TIEBAO_SWITCH_PERIOD).toBe(6);
    expect(TIEBAO_OVERLOAD_PERIOD).toBe(6);
    expect(TIEBAO_MOVE).toBe(TIEBAO_OVERLOAD_MOVE);
    const tail = TIEBAO_ENCOUNTER_TAIL_Y;
    expect(tiebaoSwitchX(tail, 72, 288, 0, tail)).toBe(72);
    expect(tiebaoSwitchX(tail, 72, 288, 1, tail)).toBe(288);
    const mid = tiebaoSwitchX(tail, 72, 288, 0.5, tail);
    expect(mid).toBeGreaterThan(72);
    expect(mid).toBeLessThan(288);
    const ahead = tiebaoSwitchX(tail - 200, 72, 288, 0.5, tail);
    const behind = tiebaoSwitchX(tail + 200, 72, 288, 0.5, tail);
    expect(ahead).toBe(288);
    expect(behind).toBe(72);
  });

  it('does not ram while more than four cars are still attached', () => {
    const boss = createBoss(TIEBAO);
    const around = world(2);
    park(boss, around);
    let guard = 0;
    while (tiebaoView(boss)?.modeId !== 'ram' && guard < 4000) {
      updateBoss(boss, FIXED_DT, around);
      guard++;
    }
    expect(tiebaoView(boss)?.modeId).toBe('ram');
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
    while (tiebaoView(boss)?.modeId !== 'ram' && guard < 4000) {
      updateBoss(boss, FIXED_DT, around);
      guard++;
    }
    expect(tiebaoView(boss)?.modeId).toBe('ram');
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
    expect(tiebaoCommittedCars(boss)).toBe(8);
    expect(tiebaoLiveHull(boss).h).toBe(760);
    expect(boss.y).toBe(tiebaoRestCenter(8));
    expect(boss.phase).toBe('main');
    expect(TIEBAO_RAIL_X).toContain(boss.x);
    expect(ev.explosions).toHaveLength(3);
    expect(ev.explosions.filter((burst) => burst.size === 'medium')).toHaveLength(1);
  });

  it('sheds every crossed threshold in one step and holds loco+2 below 30%', () => {
    const boss = createBoss(TIEBAO);
    const around = world(3);
    park(boss, around);
    setMainHp(boss, 252);
    const ev = updateBoss(boss, FIXED_DT, around);
    expect(tiebaoCommittedCars(boss)).toBe(2);
    expect(tiebaoLiveHull(boss).h).toBe(TIEBAO_HULL_H);
    expect(boss.y).toBe(tiebaoRestCenter(2));
    expect(boss.phase).toBe('main');
    expect(ev.explosions).toHaveLength(21);
    expect(ev.explosions.filter((burst) => burst.size === 'medium')).toHaveLength(7);

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

    const started = tiebaoView(boss)!.modeId;
    let steps = 0;
    for (; steps < 500; steps++) {
      updateBoss(boss, FIXED_DT, around);
      const view = tiebaoView(boss)!;
      if (view.phase === 'output' && view.modeId !== started && steps > 30) {
        expect(view.modeId).toBe('wall');
        expect(view.list).toBe('overload');
        expect(steps).toBeGreaterThan(4 * 60);
        expect(steps).toBeLessThan(8 * 60);
        break;
      }
    }
    expect(steps).toBeLessThan(500);

    const dying = coreShot(boss);
    expect(dying.score).toBe(TIEBAO_CORE_SCORE);
    expect(boss.stage).toBe('death');
  });
});
