import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import {
  FIXED_DT,
  FURNACE_CORE_HP,
  FURNACE_CORE_RADIUS,
  FURNACE_CORE_SCORE,
  FURNACE_ENTER_AT,
  FURNACE_ENTER_DURATION,
  FURNACE_IRIS_MAIN,
  FURNACE_IRIS_OVERLOAD,
  FURNACE_OVERLOAD_HP,
  FURNACE_PETAL_STEP,
  FURNACE_PHASE_INVULN,
  FURNACE_POD_MARK_FLASH,
  FURNACE_POD_MARK_HZ,
  FURNACE_POD_HP,
  FURNACE_POD_ORBIT,
  FURNACE_POD_SCORE,
  STAGE3_WARNING_AT,
} from '@/game/config';
import { prepareBossConfig } from '@/game/difficulty';
import { FURNACE } from '@/game/levels/bosses/furnace';
import {
  applyBossBomb,
  bossActiveLaser,
  bossHpBarLayout,
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
  FURNACE_CORE_ID,
  FURNACE_POD_IDS,
  furnaceActivePod,
  furnaceCoreExposed,
  furnaceIris,
  furnaceLastWreckAge,
  furnacePetalBase,
  furnaceOffset,
  furnacePetals,
  furnacePodAngle,
  furnacePodLook,
  furnacePodWreckAge,
  furnaceReadout,
} from './furnace';

function world(): BossWorld {
  return { playerX: 180, playerY: 560, rng: createRng(3) };
}

interface Log {
  events: BossEvents[];
}

function step(boss: BossRuntime, around: BossWorld, seconds: number, log?: Log): void {
  const frames = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < frames; i++) {
    const ev = updateBoss(boss, FIXED_DT, around);
    log?.events.push(ev);
  }
}

function shot(boss: BossRuntime, x: number, y: number, damage = 1) {
  return resolveBossBullet(boss, { x, y, w: 4, h: 12 }, damage);
}

function easy(): BossRuntime {
  return createBoss(prepareBossConfig(FURNACE, 'easy'));
}

function hard(): BossRuntime {
  return createBoss(prepareBossConfig(FURNACE, 'hard'), { gates: ['hard'] });
}

function park(boss: BossRuntime, around: BossWorld): void {
  step(boss, around, FURNACE_ENTER_DURATION + 0.1);
  expect(boss.stage).toBe('fight');
}

function killPods(boss: BossRuntime): void {
  for (const id of FURNACE_POD_IDS) {
    const pod = bossPart(boss, id)!;
    if (!pod.alive) continue;
    shot(boss, pod.worldX, pod.worldY, 100000);
  }
}

/** Pods dead and the 1.2s invulnerable beat over: the core phase is fighting. */
function toCore(boss: BossRuntime, around: BossWorld, log?: Log): void {
  park(boss, around);
  killPods(boss);
  expect(boss.stage).toBe('transition');
  step(boss, around, FURNACE_PHASE_INVULN + 0.05, log);
  expect(boss.stage).toBe('fight');
  expect(furnaceIris(boss)).toBe('closed');
}

function core(boss: BossRuntime) {
  return bossPart(boss, FURNACE_CORE_ID)!;
}

describe('炉心 config', () => {
  it('is the furnace script with pods, a core, and no laser', () => {
    expect(FURNACE.script).toBe('furnace');
    expect(FURNACE.art).toBe('furnace');
    expect(FURNACE.title).toBe('炉心');
    expect(FURNACE.enterAt).toBe(FURNACE_ENTER_AT);
    expect(FURNACE_ENTER_AT).toBe(123);
    expect(STAGE3_WARNING_AT).toBe(118);
    expect(FURNACE.hullTransfers).toBeUndefined();
    expect(FURNACE.parts.map((p) => p.id)).toEqual([...FURNACE_POD_IDS, FURNACE_CORE_ID]);
    for (const phase of FURNACE.phases) {
      expect(phase.attacks).toEqual([]);
    }
    expect(FURNACE.phases.map((p) => [p.id, p.gate ?? null, p.bar])).toEqual([
      ['pods', null, 'main'],
      ['core', null, 'main'],
      ['overload', 'hard', 'extra'],
    ]);
  });

  it('scales HP without rounding: Easy 560, Medium 644, Hard 728 + 234', () => {
    const total = (d: 'easy' | 'medium' | 'hard') =>
      prepareBossConfig(FURNACE, d).parts.reduce((sum, p) => sum + p.hp, 0);
    expect(total('easy')).toBe(4 * FURNACE_POD_HP + FURNACE_CORE_HP);
    expect(total('easy')).toBe(560);
    expect(total('medium')).toBeCloseTo(644, 6);
    expect(total('hard')).toBeCloseTo(728, 6);
    expect(hard().extraMax).toBeCloseTo(FURNACE_OVERLOAD_HP * 1.3, 6);
    expect(easy().extraMax).toBe(0);
  });
});

describe('炉心 pods', () => {
  function podHp(boss: BossRuntime): number[] {
    return FURNACE_POD_IDS.map((id) => bossPart(boss, id)!.hp);
  }

  it('lets only the active pod take damage; waiting pods and the chassis eat shots for 0', () => {
    const around = world();
    const boss = easy();
    park(boss, around);
    const [p0, p1, p2, p3] = FURNACE_POD_IDS.map((id) => bossPart(boss, id)!);
    expect(furnaceActivePod(boss)).toBe(p0);

    const full = podHp(boss);
    for (const pod of [p1!, p2!, p3!]) {
      expect(shot(boss, pod.worldX, pod.worldY, 9).consumedBullet).toBe(true);
    }
    expect(podHp(boss)).toEqual(full);

    // Chassis away from every pod: blocked, nothing moved onto a pod or the core.
    const ev = shot(boss, boss.x + 40, boss.y + 20, 9);
    expect(ev.consumedBullet).toBe(true);
    expect(podHp(boss)).toEqual(full);
    expect(core(boss).hp).toBe(FURNACE_CORE_HP);

    expect(shot(boss, p0!.worldX, p0!.worldY, 5).consumedBullet).toBe(true);
    expect(podHp(boss)).toEqual([full[0]! - 5, full[1], full[2], full[3]]);
  });

  it('aims homing and bombs at the active pod only', () => {
    const around = world();
    const boss = easy();
    park(boss, around);
    expect(bossMissileTargets(boss).map((p) => p.id)).toEqual(['pod0']);
    const full = podHp(boss);
    applyBossBomb(boss);
    const after = podHp(boss);
    expect(after[0]).toBeLessThan(full[0]!);
    expect(after.slice(1)).toEqual(full.slice(1));
    expect(core(boss).hp).toBe(FURNACE_CORE_HP);
  });

  it('hands the turn on in order pod0 → pod3, one damageable pod at a time', () => {
    const around = world();
    const boss = easy();
    park(boss, around);
    FURNACE_POD_IDS.forEach((id, i) => {
      const pod = bossPart(boss, id)!;
      expect(furnaceActivePod(boss)).toBe(pod);
      expect(bossMissileTargets(boss)).toEqual([pod]);
      FURNACE_POD_IDS.forEach((other, j) => {
        const look = furnacePodLook(boss, bossPart(boss, other)!);
        expect(look).toBe(j < i ? 'wrecked' : j === i ? 'active' : 'intact');
      });
      expect(shot(boss, pod.worldX, pod.worldY, 100000).score).toBe(FURNACE_POD_SCORE);
      step(boss, around, FIXED_DT);
    });
    expect(furnaceActivePod(boss)).toBeNull();
    expect(boss.stage).toBe('transition');
  });

  it('pays each pod and fires only fans, flak, and missiles while orbiting', () => {
    const around = world();
    const boss = easy();
    park(boss, around);
    const log: Log = { events: [] };
    step(boss, around, 6, log);
    const types = new Set(log.events.flatMap((ev) => ev.bolts.map((b) => b.type)));
    expect([...types].sort()).toEqual(['missile', 'small']);
    expect(bossActiveLaser(boss)).toBeNull();

    const pod = bossPart(boss, 'pod0')!;
    const ev = shot(boss, pod.worldX, pod.worldY, 100000);
    expect(ev.score).toBe(FURNACE_POD_SCORE);
    expect(pod.alive).toBe(false);
  });

  it('looks active while it is the target, then a wreck that keeps orbiting', () => {
    const around = world();
    const boss = easy();
    park(boss, around);
    const pod = bossPart(boss, 'pod0')!;
    const next = bossPart(boss, 'pod1')!;
    expect(FURNACE_POD_MARK_HZ).toBeGreaterThan(0);
    expect(FURNACE_POD_MARK_FLASH).toBeGreaterThan(0);
    expect(furnacePodLook(boss, pod)).toBe('active');
    expect(furnacePodLook(boss, next)).toBe('intact');
    shot(boss, pod.worldX, pod.worldY, pod.maxHp - 1);
    expect(furnacePodLook(boss, pod)).toBe('active');
    expect(furnacePodWreckAge(boss, 0)).toBeNull();
    expect(furnaceLastWreckAge(boss)).toBeNull();

    shot(boss, pod.worldX, pod.worldY, 100000);
    expect(furnacePodLook(boss, pod)).toBe('wrecked');
    expect(furnacePodLook(boss, next)).toBe('active');
    step(boss, around, FIXED_DT);
    expect(furnacePodWreckAge(boss, 0)).toBeCloseTo(0, 6);
    expect(furnaceLastWreckAge(boss)).toBeCloseTo(0, 6);
    step(boss, around, 0.5);
    expect(furnacePodWreckAge(boss, 0)).toBeCloseTo(0.5, 6);
    expect(furnacePodWreckAge(boss, 1)).toBeNull();

    const hp = pod.hp;
    const from = { x: pod.worldX, y: pod.worldY };
    step(boss, around, 1);
    const o = furnaceOffset(furnacePodAngle(boss, 0), FURNACE_POD_ORBIT);
    expect(pod.worldX).toBeCloseTo(boss.x + o.x, 6);
    expect(pod.worldY).toBeCloseTo(boss.y + o.y, 6);
    expect(Math.hypot(pod.worldX - from.x, pod.worldY - from.y)).toBeGreaterThan(10);
    shot(boss, pod.worldX, pod.worldY, 9);
    expect(pod.hp).toBe(hp);
    expect(pod.alive).toBe(false);
  });

  it('holds 1.2s invulnerable after the last pod, then opens the core phase closed', () => {
    const around = world();
    const boss = easy();
    park(boss, around);
    killPods(boss);
    expect(boss.stage).toBe('transition');
    expect(boss.invulnerable).toBe(true);
    const c = core(boss);
    const ev = shot(boss, c.worldX, c.worldY, 50);
    expect(ev.consumedBullet).toBe(true);
    expect(c.hp).toBe(FURNACE_CORE_HP);
    expect(bossMissileTargets(boss)).toEqual([]);
    expect(applyBossBomb(boss).score).toBe(0);
    expect(c.hp).toBe(FURNACE_CORE_HP);
    step(boss, around, FURNACE_PHASE_INVULN - 0.1);
    expect(boss.stage).toBe('transition');
    step(boss, around, 0.15);
    expect(boss.stage).toBe('fight');
    expect(furnaceIris(boss)).toBe('closed');
  });
});

describe('炉心 iris', () => {
  it('blocks the core while closed and lets bullets and homing in while opening / open', () => {
    const around = world();
    const boss = easy();
    toCore(boss, around);
    const c = core(boss);

    expect(furnaceCoreExposed(boss)).toBe(false);
    expect(shot(boss, c.worldX, c.worldY, 5).consumedBullet).toBe(true);
    expect(c.hp).toBe(FURNACE_CORE_HP);
    expect(shot(boss, boss.x + 60, boss.y + 40, 5).consumedBullet).toBe(true);
    expect(c.hp).toBe(FURNACE_CORE_HP);
    expect(bossMissileTargets(boss)).toEqual([]);

    step(boss, around, FURNACE_IRIS_MAIN.closed + 0.05);
    expect(furnaceIris(boss)).toBe('opening');
    expect(furnaceCoreExposed(boss)).toBe(true);
    expect(bossMissileTargets(boss).map((p) => p.id)).toEqual([FURNACE_CORE_ID]);
    expect(shot(boss, c.worldX, c.worldY, 5).consumedBullet).toBe(true);
    expect(c.hp).toBe(FURNACE_CORE_HP - 5);

    step(boss, around, FURNACE_IRIS_MAIN.opening);
    expect(furnaceIris(boss)).toBe('open');
    expect(shot(boss, c.worldX, c.worldY, 5).consumedBullet).toBe(true);
    expect(c.hp).toBe(FURNACE_CORE_HP - 10);

    for (const petal of furnacePetals(boss)) {
      expect(shot(boss, petal.x, petal.y, 5).consumedBullet).toBe(true);
    }
    expect(c.hp).toBe(FURNACE_CORE_HP - 10);

    // The throat under the core is open: a shot there flies on toward the core.
    const throat = shot(boss, c.worldX, c.worldY + FURNACE_CORE_RADIUS + 30, 5);
    expect(throat.consumedBullet).toBe(false);
    // Chassis away from the throat still blocks.
    expect(shot(boss, boss.x + 80, boss.y + 40, 5).consumedBullet).toBe(true);
    expect(c.hp).toBe(FURNACE_CORE_HP - 10);

    step(boss, around, FURNACE_IRIS_MAIN.open + 0.05);
    expect(furnaceIris(boss)).toBe('closing');
    expect(furnaceCoreExposed(boss)).toBe(false);
    expect(shot(boss, c.worldX, c.worldY, 5).consumedBullet).toBe(true);
    expect(c.hp).toBe(FURNACE_CORE_HP - 10);
  });

  it('turns the petals 45° on every return to closed', () => {
    const around = world();
    const boss = easy();
    toCore(boss, around);
    const cycle =
      FURNACE_IRIS_MAIN.closed +
      FURNACE_IRIS_MAIN.opening +
      FURNACE_IRIS_MAIN.open +
      FURNACE_IRIS_MAIN.closing;
    const base0 = furnacePetalBase(boss);
    step(boss, around, cycle + 1);
    expect(furnaceReadout(boss)?.turns).toBe(1);
    expect(furnacePetalBase(boss)).toBeCloseTo(base0 + FURNACE_PETAL_STEP, 6);
    step(boss, around, cycle);
    expect(furnaceReadout(boss)?.turns).toBe(2);
    expect(furnacePetalBase(boss)).toBeCloseTo(base0 + 2 * FURNACE_PETAL_STEP, 6);
  });

  it('lets a bomb reach the core even with the petals shut', () => {
    const around = world();
    const boss = easy();
    toCore(boss, around);
    expect(furnaceIris(boss)).toBe('closed');
    const before = core(boss).hp;
    applyBossBomb(boss);
    expect(core(boss).hp).toBeLessThan(before);
  });

  it('fires flak and missiles while shut, the flame fan while open, never a laser', () => {
    const around = world();
    const boss = easy();
    const log: Log = { events: [] };
    toCore(boss, around, log);
    log.events.length = 0;
    step(boss, around, FURNACE_IRIS_MAIN.closed - 0.05, log);
    const shut = new Set(log.events.flatMap((ev) => ev.bolts.map((b) => b.type)));
    expect([...shut].sort()).toEqual(['missile', 'small']);
    log.events.length = 0;
    step(boss, around, FURNACE_IRIS_MAIN.opening + FURNACE_IRIS_MAIN.open, log);
    const open = log.events.flatMap((ev) => ev.bolts);
    expect(open.length).toBeGreaterThan(0);
    expect(new Set(open.map((b) => b.type))).toEqual(new Set(['large']));
    expect(bossActiveLaser(boss)).toBeNull();
  });
});

describe('炉心 endings', () => {
  function killCore(boss: BossRuntime, around: BossWorld): BossEvents[] {
    const out: BossEvents[] = [];
    for (let guard = 0; guard < 4000 && boss.stage === 'fight'; guard++) {
      if (furnaceCoreExposed(boss)) {
        const c = core(boss);
        out.push(shot(boss, c.worldX, c.worldY, 50));
      }
      out.push(updateBoss(boss, FIXED_DT, around));
    }
    return out;
  }

  it('Easy ends when the core dies, pays 30000, and never clears flying bullets', () => {
    const around = world();
    const boss = easy();
    const log: Log = { events: [] };
    park(boss, around);
    step(boss, around, 2, log);
    killPods(boss);
    step(boss, around, FURNACE_PHASE_INVULN + 0.05, log);
    const events = [...log.events, ...killCore(boss, around)];
    expect(boss.stage).toBe('death');
    expect(events.reduce((sum, ev) => sum + ev.score, 0)).toBe(FURNACE_CORE_SCORE);
    step(boss, around, 4, log);
    for (const ev of [...events, ...log.events]) {
      expect(ev.clearBullets).toBe(false);
      expect(ev.convertBullets).toBe(false);
    }
  });

  it('Hard revives the core for the yellow overload and pays 30000 only there', () => {
    const around = world();
    const boss = hard();
    toCore(boss, around);
    expect(bossHpBarLayout(boss).extraSpan).toBeGreaterThan(0);
    const first = killCore(boss, around);
    expect(first.reduce((sum, ev) => sum + ev.score, 0)).toBe(0);
    expect(boss.stage).toBe('transition');
    expect(boss.invulnerable).toBe(true);
    step(boss, around, FURNACE_PHASE_INVULN + 0.05);
    expect(boss.stage).toBe('fight');
    expect(furnaceReadout(boss)?.list).toBe('overload');
    expect(furnaceIris(boss)).toBe('closed');
    step(boss, around, FURNACE_IRIS_OVERLOAD.closed + 0.05);
    expect(furnaceIris(boss)).toBe('opening');
    const second = killCore(boss, around);
    expect(second.reduce((sum, ev) => sum + ev.score, 0)).toBe(FURNACE_CORE_SCORE);
    expect(boss.stage).toBe('death');
    for (const ev of [...first, ...second]) {
      expect(ev.clearBullets).toBe(false);
      expect(ev.convertBullets).toBe(false);
    }
  });
});
