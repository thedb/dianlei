import { describe, expect, it } from 'vitest';
import {
  BOMB_BOSS_RATIO,
  BOSS_ANCHOR_X,
  BOSS_ENTER_Y,
  BOSS_HULL_H,
  BOSS_HULL_W,
  HIT_FLASH_TIME,
  LV3_SPREAD_DEG,
  PLAYER_BULLET_SPEED,
} from '@/game/config';
import { HARD_PHASE_GATE, bossUsesPhase3, prepareBossConfig } from '@/game/difficulty';
import { getStage } from '@/game/levels/registry';
import type { BossCycleAttack, BossDef, BossGunAttack, Fire } from '@/game/levels/types';
import {
  applyBossBomb,
  bossBarRatio,
  bossBombDamage,
  bossHitsPlayer,
  bossHpBarLayout,
  bossHpRemaining,
  bossIntroBarFill,
  bossIntroBarLayout,
  bossLaserHits,
  bossAttackDef,
  bossPart,
  bossPhaseDef,
  bossTotalHp,
  createBoss,
  releaseBossResult,
  resolveBossBullet,
  splitBombDamage,
  updateBoss,
  type BossRuntime,
} from './boss';

const stage1 = getStage('1');
const cfg = stage1.boss;
const DT = 1 / 60;
const TRANSITION = bossPhaseDef(cfg, 'phase2').transition!.duration;

/** Phase-2 cycle and phase-3 numbers, read from the boss table. */
function phase3Numbers(def: BossDef) {
  const p3 = bossPhaseDef(def, 'phase3');
  const cycle = bossAttackDef(def, 'phase2', 'pattern') as BossCycleAttack;
  const ring = bossAttackDef(def, 'phase3', 'ring') as BossGunAttack;
  return {
    hp: p3.segmentHp!,
    transition: p3.transition!.duration,
    patternHold: cycle.hold,
    spiral: cycle.steps[0]!.fire as Extract<Fire, { kind: 'spiral' }>,
    aimed: cycle.steps[1]!.fire as { kind: string; interval: number; speed: number },
    ring: ring.fire,
    ringEnrageInterval: ring.enrageInterval!,
    enrageAtHpRatio: p3.enrageAtHpRatio!,
  };
}
const P3 = phase3Numbers(cfg);

function park(): BossRuntime {
  const boss = createBoss(cfg);
  updateBoss(boss, cfg.enterDuration);
  return boss;
}

interface Approach {
  x: number;
  y: number;
  ev: ReturnType<typeof resolveBossBullet>;
}

/** Step a 4×12 shot until the boss takes it or the path runs out. */
function approach(
  boss: BossRuntime,
  x0: number,
  y0: number,
  vx: number,
  vy: number,
  damage: number
): Approach {
  let x = x0;
  let y = y0;
  let ev = resolveBossBullet(boss, { x, y, w: 4, h: 12 }, damage);
  for (let i = 0; i < 90 && !ev.consumedBullet; i++) {
    x += vx * DT;
    y += vy * DT;
    ev = resolveBossBullet(boss, { x, y, w: 4, h: 12 }, damage);
  }
  return { x, y, ev };
}

function toPhase3(): BossRuntime {
  const boss = createBoss(cfg, { gates: [HARD_PHASE_GATE] });
  updateBoss(boss, cfg.enterDuration);
  const left = bossPart(boss, 'turretL')!;
  const right = bossPart(boss, 'turretR')!;
  resolveBossBullet(boss, { x: left.worldX, y: left.worldY, w: 4, h: 12 }, left.hp);
  resolveBossBullet(boss, { x: right.worldX, y: right.worldY, w: 4, h: 12 }, right.hp);
  updateBoss(boss, TRANSITION);
  const core = bossPart(boss, 'core')!;
  resolveBossBullet(boss, { x: core.worldX, y: core.worldY, w: 4, h: 12 }, core.hp);
  updateBoss(boss, P3.transition);
  return boss;
}

function toPhase2(): BossRuntime {
  const boss = park();
  const left = bossPart(boss, 'turretL')!;
  const right = bossPart(boss, 'turretR')!;
  resolveBossBullet(boss, { x: left.worldX, y: left.worldY, w: 4, h: 12 }, left.hp);
  const ev = resolveBossBullet(boss, { x: right.worldX, y: right.worldY, w: 4, h: 12 }, right.hp);
  expect(ev.convertBullets).toBe(true);
  updateBoss(boss, TRANSITION);
  return boss;
}

describe('boss numbers', () => {
  it('totals 840 HP and an 8% bomb of 67', () => {
    expect(bossTotalHp(cfg)).toBe(840);
    expect(bossBombDamage(840, BOMB_BOSS_RATIO)).toBe(67);
    expect(splitBombDamage(67, 2)).toEqual([34, 33]);
    expect(splitBombDamage(67, 1)).toEqual([67]);
    expect(cfg.parts.reduce((sum, part) => sum + part.score, 0)).toBe(40000);
  });

  it('fills the warning HP bar from 2:33 to 2:35', () => {
    expect(bossIntroBarFill(152.9, 150, 155)).toBeNull();
    expect(bossIntroBarFill(153, 150, 155)).toBe(0);
    expect(bossIntroBarFill(154, 150, 155)).toBeCloseTo(0.5);
    expect(bossIntroBarFill(155, 150, 155)).toBeNull();
  });
});

describe('boss phases', () => {
  it('enters from y=-70 to parkY over 3s, invulnerable, then drifts', () => {
    const boss = createBoss(cfg);
    expect(boss.y).toBe(BOSS_ENTER_Y);
    expect(boss.invulnerable).toBe(true);
    updateBoss(boss, 1.5);
    expect(boss.phase).toBe('enter');
    expect(boss.y).toBeCloseTo(20);
    expect(applyBossBomb(boss).score).toBe(0);
    expect(bossHpRemaining(boss)).toBe(840);

    updateBoss(boss, 1.5);
    expect(boss.phase).toBe('phase1');
    expect(boss.y).toBeCloseTo(cfg.parkY);
    expect(boss.x).toBeCloseTo(BOSS_ANCHOR_X);
    expect(boss.invulnerable).toBe(false);

    updateBoss(boss, 1.5);
    expect(boss.x).toBeCloseTo(BOSS_ANCHOR_X + cfg.drift.amp);
  });

  it('hull shots do not damage, turret shots do', () => {
    const boss = park();
    const hull = resolveBossBullet(boss, { x: boss.x - 100, y: boss.y, w: 4, h: 12 }, 50);
    expect(hull.consumedBullet).toBe(true);
    expect(bossPart(boss, 'turretL')!.hp).toBe(140);
    expect(bossPart(boss, 'core')!.hp).toBe(560);

    const left = bossPart(boss, 'turretL')!;
    const hit = resolveBossBullet(boss, { x: left.worldX, y: left.worldY, w: 4, h: 12 }, 10);
    expect(hit.consumedBullet).toBe(true);
    expect(left.hp).toBe(130);
    expect(hit.score).toBe(0);
    expect(boss.hitFlash).toBe(HIT_FLASH_TIME);
  });

  it('counts a nose hit as the nearest living weak point before the bullet reaches the circle', () => {
    const boss = park();
    const left = bossPart(boss, 'turretL')!;
    const right = bossPart(boss, 'turretR')!;
    const lipY = boss.y + BOSS_HULL_H / 2 - 2;
    const circleBottom = left.worldY + left.radius;

    const offCenter = resolveBossBullet(boss, { x: left.worldX + 36, y: lipY, w: 4, h: 12 }, 10);
    expect(offCenter.consumedBullet).toBe(true);
    expect(lipY).toBeGreaterThan(circleBottom);
    expect(left.hp).toBe(130);
    expect(right.hp).toBe(140);
    expect(boss.hitFlash).toBe(HIT_FLASH_TIME);

    const nose = park();
    const noseLeft = bossPart(nose, 'turretL')!;
    const noseRight = bossPart(nose, 'turretR')!;
    const center = resolveBossBullet(nose, { x: nose.x, y: lipY, w: 4, h: 12 }, 10);
    expect(center.consumedBullet).toBe(true);
    expect(noseLeft.hp + noseRight.hp).toBe(270);
    expect(nose.hitFlash).toBe(HIT_FLASH_TIME);

    const solo = park();
    const dead = bossPart(solo, 'turretL')!;
    resolveBossBullet(solo, { x: dead.worldX, y: dead.worldY, w: 4, h: 12 }, dead.hp);
    const survivor = bossPart(solo, 'turretR')!;
    solo.hitFlash = 0;
    const redirected = resolveBossBullet(solo, { x: dead.worldX, y: lipY, w: 4, h: 12 }, 10);
    expect(redirected.consumedBullet).toBe(true);
    expect(survivor.hp).toBe(130);
    expect(solo.hitFlash).toBe(HIT_FLASH_TIME);

    const coreFight = toPhase2();
    const core = bossPart(coreFight, 'core')!;
    const wing = resolveBossBullet(
      coreFight,
      { x: coreFight.x - 100, y: coreFight.y + BOSS_HULL_H / 2 - 2, w: 4, h: 12 },
      10
    );
    expect(wing.consumedBullet).toBe(true);
    expect(core.hp).toBe(550);
    expect(coreFight.hitFlash).toBe(HIT_FLASH_TIME);
    expect(coreFight.y + BOSS_HULL_H / 2 - 2).toBeGreaterThan(core.worldY + core.radius);
  });

  it('lands straight, offset, and 15° shots on the nose, and lets a wide miss fly past', () => {
    const below = (boss: BossRuntime): number => boss.y + BOSS_HULL_H / 2 + 48;
    const rad = (LV3_SPREAD_DEG * Math.PI) / 180;

    const aimed = park();
    const left = bossPart(aimed, 'turretL')!;
    const straight = approach(aimed, left.worldX + 36, below(aimed), 0, -PLAYER_BULLET_SPEED, 1);
    expect(straight.ev.consumedBullet).toBe(true);
    expect(straight.y).toBeGreaterThan(left.worldY + left.radius);
    expect(left.hp).toBe(139);
    expect(aimed.hitFlash).toBe(HIT_FLASH_TIME);

    const spread = park();
    const spreadLeft = bossPart(spread, 'turretL')!;
    const spreadRight = bossPart(spread, 'turretR')!;
    const angled = approach(
      spread,
      spread.x,
      below(spread),
      -Math.sin(rad) * PLAYER_BULLET_SPEED,
      -Math.cos(rad) * PLAYER_BULLET_SPEED,
      1
    );
    expect(angled.ev.consumedBullet).toBe(true);
    expect(angled.y).toBeGreaterThan(spreadLeft.worldY + spreadLeft.radius);
    expect(spreadLeft.hp + spreadRight.hp).toBe(279);
    expect(spread.hitFlash).toBe(HIT_FLASH_TIME);

    const miss = park();
    const flown = approach(
      miss,
      miss.x - BOSS_HULL_W / 2 - 24,
      below(miss),
      0,
      -PLAYER_BULLET_SPEED,
      50
    );
    expect(flown.ev.consumedBullet).toBe(false);
    expect(flown.y).toBeLessThan(miss.y - BOSS_HULL_H);
    expect(bossPart(miss, 'turretL')!.hp).toBe(140);
    expect(bossPart(miss, 'turretR')!.hp).toBe(140);
    expect(miss.hitFlash).toBe(0);
  });

  it('splits a phase-1 bomb across living turrets and dumps it on the survivor', () => {
    const both = park();
    applyBossBomb(both);
    expect(bossPart(both, 'turretL')!.hp).toBe(140 - 34);
    expect(bossPart(both, 'turretR')!.hp).toBe(140 - 33);
    expect(bossPart(both, 'core')!.hp).toBe(560);

    const one = park();
    const left = bossPart(one, 'turretL')!;
    resolveBossBullet(one, { x: left.worldX, y: left.worldY, w: 4, h: 12 }, left.hp);
    applyBossBomb(one);
    expect(bossPart(one, 'turretR')!.hp).toBe(140 - 67);
    expect(one.phase).toBe('phase1');
  });

  it('speeds the surviving turret to 0.8× interval and opens the core after both die', () => {
    const boss = park();
    const left = bossPart(boss, 'turretL')!;
    const killed = resolveBossBullet(
      boss,
      { x: left.worldX, y: left.worldY, w: 4, h: 12 },
      left.hp
    );
    expect(killed.score).toBe(5000);
    expect(killed.explosions.length).toBeGreaterThan(0);
    expect(left.falling).toBe(true);
    expect(bossPart(boss, 'turretR')!.intervalMul).toBeCloseTo(0.8);

    const early = updateBoss(boss, 0.63);
    expect(early.shots.some((shot) => shot.fire.kind === 'aimed3burst')).toBe(false);
    const fired = updateBoss(boss, 0.02);
    expect(fired.shots.some((shot) => shot.fire.kind === 'aimed3burst')).toBe(true);

    const right = bossPart(boss, 'turretR')!;
    const transition = resolveBossBullet(
      boss,
      { x: right.worldX, y: right.worldY, w: 4, h: 12 },
      right.hp
    );
    expect(transition.convertBullets).toBe(true);
    expect(transition.score).toBe(5000);
    expect(boss.phase).toBe('transition');
    expect(boss.invulnerable).toBe(true);
    expect(applyBossBomb(boss).score).toBe(0);
    expect(bossPart(boss, 'core')!.hp).toBe(560);

    updateBoss(boss, TRANSITION);
    expect(boss.phase).toBe('phase2');
    expect(boss.invulnerable).toBe(false);
  });

  it('alternates phase-1 guns: right at 0.8s, left at 1.6s, hull at 5s', () => {
    const boss = park();
    const at08 = updateBoss(boss, 0.8);
    expect(at08.shots.map((shot) => shot.fire.kind)).toEqual(['aimed3burst']);
    const at16 = updateBoss(boss, 0.8);
    expect(at16.shots.some((shot) => shot.fire.kind === 'fan5')).toBe(true);
    const hull = updateBoss(boss, 3.4);
    expect(hull.shots.some((shot) => shot.fire.kind === 'fan7wide')).toBe(true);
  });

  it('puts the whole bomb into the phase-2 core and does not enrage the spiral', () => {
    const boss = toPhase2();
    applyBossBomb(boss);
    expect(bossPart(boss, 'core')!.hp).toBe(560 - 67);

    const fresh = toPhase2();
    const core = bossPart(fresh, 'core')!;
    resolveBossBullet(fresh, { x: core.worldX, y: core.worldY, w: 4, h: 12 }, 280);
    expect(core.hp).toBe(280);
    expect(fresh.enraged).toBe(false);
    const spiral = updateBoss(fresh, P3.spiral.interval);
    expect(spiral.shots.some((shot) => shot.fire.kind === 'spiral')).toBe(true);
    expect(spiral.shots.some((shot) => shot.fire.kind === 'ring16')).toBe(false);
    expect(fresh.laser.mode).toBe('idle');
  });

  it('enrages the phase-3 ring when that segment drops to half', () => {
    const boss = toPhase3();
    const core = bossPart(boss, 'core')!;
    const half = core.maxHp * P3.enrageAtHpRatio;
    resolveBossBullet(boss, { x: core.worldX, y: core.worldY, w: 4, h: 12 }, core.hp - half);
    expect(core.hp).toBeCloseTo(half);
    expect(boss.enraged).toBe(true);
    const ring = updateBoss(boss, P3.ringEnrageInterval);
    expect(ring.shots.some((shot) => shot.fire.kind === 'ring16')).toBe(true);
    expect(ring.shots.some((shot) => shot.fire.kind === 'spiral')).toBe(false);
  });

  it('interrupts the laser and restarts its cooldown', () => {
    const boss = toPhase3();
    let steps = 0;
    while (boss.laser.mode === 'idle' && steps < 600) {
      updateBoss(boss, DT);
      steps++;
    }
    expect(boss.laser.mode).toBe('telegraph');
    expect(steps * DT).toBeGreaterThan(6.9);
    expect(steps * DT).toBeLessThan(7.1);

    applyBossBomb(boss);
    expect(boss.laser.mode).toBe('idle');
    expect(boss.laser.cooldown).toBe(0);

    for (let i = 0; i < 400; i++) updateBoss(boss, DT);
    expect(boss.laser.mode).toBe('idle');
    updateBoss(boss, 0.4);
    expect(boss.laser.mode).toBe('telegraph');
  });

  it('holds the ring still while the laser is sweeping', () => {
    const boss = toPhase3();
    let steps = 0;
    while (boss.laser.mode !== 'sweep' && steps < 800) {
      updateBoss(boss, DT);
      steps++;
    }
    expect(boss.laser.mode).toBe('sweep');
    const rot = boss.guns.ring!.rot;
    const aimed = boss.guns.aimed!.shots;
    for (let i = 0; i < 30; i++) updateBoss(boss, DT);
    expect(boss.laser.mode).toBe('sweep');
    expect(boss.guns.ring!.rot).toBe(rot);
    expect(boss.guns.aimed!.shots).toBe(aimed);
  });

  it('kills the player on the hull and with the sweeping laser', () => {
    const boss = park();
    expect(bossHitsPlayer(boss, boss.x, boss.y + 40)).toBe(true);
    expect(bossHitsPlayer(boss, 20, 600)).toBe(false);

    const phase3 = toPhase3();
    let guard = 0;
    while (phase3.laser.mode !== 'sweep' && guard < 800) {
      updateBoss(phase3, DT);
      guard++;
    }
    expect(phase3.laser.mode).toBe('sweep');
    const core = bossPart(phase3, 'core')!;
    const ang = Math.PI / 2 + (phase3.laser.angleDeg * Math.PI) / 180;
    expect(
      bossLaserHits(phase3, core.worldX + Math.cos(ang) * 90, core.worldY + Math.sin(ang) * 90)
    ).toBe(true);
    expect(bossLaserHits(phase3, 8, 600)).toBe(false);
  });

  it('scores the core, clears bullets, then STAGE CLEAR and the result', () => {
    const boss = toPhase2();
    const core = bossPart(boss, 'core')!;
    const death = resolveBossBullet(boss, { x: core.worldX, y: core.worldY, w: 4, h: 12 }, core.hp);
    expect(death.score).toBe(30000);
    expect(death.clearBullets).toBe(true);
    expect(death.shake?.intensity).toBeGreaterThan(0);
    expect(boss.phase).toBe('death');

    let booms = death.explosions.length;
    const during = updateBoss(boss, cfg.death.duration);
    booms += during.explosions.length;
    expect(booms).toBe(cfg.death.explosions);
    expect(boss.phase).toBe('clear');

    const wait = updateBoss(boss, 2);
    expect(wait.enterResult).toBe(false);
    expect(boss.phase).toBe('clear');
    const released = releaseBossResult(boss);
    expect(released.enterResult).toBe(true);
    expect(boss.phase).toBe('done');
    expect(updateBoss(boss, 1).enterResult).toBe(false);
    expect(releaseBossResult(boss).enterResult).toBe(false);
  });
});

function killCore(boss: BossRuntime) {
  const core = bossPart(boss, 'core')!;
  return resolveBossBullet(boss, { x: core.worldX, y: core.worldY, w: 4, h: 12 }, core.hp);
}

function reachPhase2(config: typeof cfg, phase3: boolean): BossRuntime {
  const boss = createBoss(config, { gates: phase3 ? [HARD_PHASE_GATE] : [] });
  updateBoss(boss, config.enterDuration);
  const left = bossPart(boss, 'turretL')!;
  const right = bossPart(boss, 'turretR')!;
  resolveBossBullet(boss, { x: left.worldX, y: left.worldY, w: 4, h: 12 }, left.hp);
  resolveBossBullet(boss, { x: right.worldX, y: right.worldY, w: 4, h: 12 }, right.hp);
  updateBoss(boss, TRANSITION);
  return boss;
}

describe('boss difficulty phases', () => {
  it('keeps Easy and Medium on the two-phase core kill', () => {
    expect(bossUsesPhase3('easy')).toBe(false);
    expect(bossUsesPhase3('medium')).toBe(false);
    expect(bossUsesPhase3('hard')).toBe(true);

    const easy = reachPhase2(cfg, false);
    expect(easy.extraArmed).toBe(false);
    expect(killCore(easy).score).toBe(30000);
    expect(easy.phase).toBe('death');

    const mediumCfg = prepareBossConfig(stage1.boss, 'medium');
    const medium = reachPhase2(mediumCfg, false);
    expect(bossPart(medium, 'turretL')!.maxHp).toBeCloseTo(140 * 1.15);
    expect(bossPart(medium, 'core')!.hp).toBeCloseTo(560 * 1.15);
    expect(medium.extraArmed).toBe(false);
    expect(killCore(medium).score).toBe(30000);
    expect(medium.phase).toBe('death');
    for (let i = 0; i < 8; i++) {
      const ev = updateBoss(medium, 0.5);
      expect(ev.shots.some((shot) => shot.fire.kind === 'spiral')).toBe(false);
      expect(ev.shots.some((shot) => shot.fire.kind === 'ring16')).toBe(false);
      expect(medium.phase === 'phase3' || medium.phase === 'transition3').toBe(false);
    }

    const living = reachPhase2(mediumCfg, false);
    let sawSpiral = false;
    for (let i = 0; i < 8; i++) {
      const ev = updateBoss(living, 0.5);
      if (ev.shots.some((shot) => shot.fire.kind === 'spiral')) sawSpiral = true;
      expect(ev.shots.some((shot) => shot.fire.kind === 'ring16')).toBe(false);
    }
    expect(sawSpiral).toBe(true);
    expect(living.phase).toBe('phase2');
    expect(living.laser.mode).toBe('idle');
  });

  it('plays the tuned spiral in phase 2 and the ring laser in phase 3', () => {
    const hardCfg = prepareBossConfig(stage1.boss, 'hard');
    const pattern = phase3Numbers(hardCfg);
    const boss = reachPhase2(hardCfg, true);
    expect(boss.phase).toBe('phase2');
    expect(boss.pattern).toBe('spiral');
    expect(boss.fightMax).toBeCloseTo((140 + 140 + 560 + 240) * 1.3);
    expect(bossPart(boss, 'core')!.hp).toBeCloseTo(560 * 1.3);
    expect(pattern.spiral.arms).toBe(4);
    expect(pattern.spiral.speed).toBe(180);
    expect(pattern.spiral.interval).toBeLessThan(0.18);
    expect(pattern.aimed.speed).toBe(228);
    expect(pattern.aimed.interval).toBeLessThan(1.15);

    const full = bossHpBarLayout(boss);
    expect(full.extraSpan).toBeCloseTo(240 / 1080);
    expect(full.extraFill).toBeCloseTo(1);
    expect(full.mainFill).toBeCloseTo(560 / 840);
    expect(bossBarRatio(boss)).toBeCloseTo((560 + 240) / 1080);

    const spiral = updateBoss(boss, pattern.spiral.interval);
    expect(spiral.shots.map((shot) => shot.fire.kind)).toContain('spiral');
    expect(spiral.shots.some((shot) => shot.fire.kind === 'aimed_fast3')).toBe(false);
    expect(spiral.shots.some((shot) => shot.fire.kind === 'ring16')).toBe(false);
    const rot0 = spiral.shots[0]?.rotation ?? 0;
    const spiralFire = spiral.shots.find((shot) => shot.fire.kind === 'spiral')?.fire;
    expect(spiralFire).toMatchObject({ arms: 4, speed: 180 });

    const again = updateBoss(boss, pattern.spiral.interval);
    const rot1 = again.shots.find((shot) => shot.fire.kind === 'spiral')?.rotation ?? rot0;
    expect(rot1).not.toBe(rot0);

    const remain = pattern.patternHold - pattern.spiral.interval * 2;
    updateBoss(boss, remain);
    expect(boss.pattern).toBe('aimed');

    const aimed = updateBoss(boss, pattern.aimed.interval);
    expect(aimed.shots.some((shot) => shot.fire.kind === 'aimed_fast3')).toBe(true);
    expect(aimed.shots.some((shot) => shot.fire.kind === 'spiral')).toBe(false);
    const aimedFire = aimed.shots.find((shot) => shot.fire.kind === 'aimed_fast3')?.fire;
    expect(aimedFire).toMatchObject({ speed: 228 });

    const core = bossPart(boss, 'core')!;
    resolveBossBullet(boss, { x: core.worldX, y: core.worldY, w: 4, h: 12 }, 50);
    const nicked = bossHpBarLayout(boss);
    expect(nicked.extraFill).toBeCloseTo(1);
    expect(nicked.mainFill).toBeLessThan(1);

    const broke = killCore(boss);
    expect(broke.score).toBe(0);
    expect(broke.convertBullets).toBe(true);
    expect(boss.phase).toBe('transition3');
    expect(boss.invulnerable).toBe(true);
    expect(bossPart(boss, 'core')!.hp).toBeCloseTo(240 * 1.3);
    expect(applyBossBomb(boss).score).toBe(0);
    const handed = bossHpBarLayout(boss);
    expect(handed.mainFill).toBe(0);
    expect(handed.extraFill).toBeCloseTo(1);
    expect(handed.extraSpan).toBeCloseTo(240 / 1080);

    updateBoss(boss, pattern.transition);
    expect(boss.phase).toBe('phase3');
    expect(boss.invulnerable).toBe(false);
    expect(boss.laser.mode).toBe('idle');

    const ringFire = phase3Numbers(hardCfg).ring;
    const ringInterval = ringFire.kind === 'ring16' ? ringFire.interval : 2;
    const ring = updateBoss(boss, ringInterval);
    expect(ring.shots.some((shot) => shot.fire.kind === 'ring16')).toBe(true);
    expect(ring.shots.some((shot) => shot.fire.kind === 'spiral')).toBe(false);

    const wounded = bossPart(boss, 'core')!;
    const before = bossHpBarLayout(boss).extraFill;
    resolveBossBullet(boss, { x: wounded.worldX, y: wounded.worldY, w: 4, h: 12 }, 40);
    expect(bossHpBarLayout(boss).extraFill).toBeLessThan(before);
    expect(bossHpBarLayout(boss).mainFill).toBe(0);

    const death = killCore(boss);
    expect(death.score).toBe(30000);
    expect(boss.phase).toBe('death');
    expect(bossHpBarLayout(boss).extraFill).toBe(0);
    expect(bossBarRatio(boss)).toBe(0);
  });
});

describe('boss HP bar segments', () => {
  it('draws easy as one segment and keeps hard phase-3 HP in its own slot', () => {
    const easy = createBoss(cfg);
    expect(bossHpBarLayout(easy)).toMatchObject({ extraSpan: 0, extraFill: 0 });
    expect(bossHpBarLayout(easy).mainFill).toBeCloseTo(1);

    const hardCfg = prepareBossConfig(stage1.boss, 'hard');
    const hard = createBoss(hardCfg, { gates: [HARD_PHASE_GATE] });
    const layout = bossHpBarLayout(hard);
    expect(layout.extraSpan).toBeCloseTo(240 / 1080);
    expect(layout.extraFill).toBeCloseTo(1);
    expect(layout.mainFill).toBeCloseTo(1);

    updateBoss(hard, hardCfg.enterDuration);
    const left = bossPart(hard, 'turretL')!;
    resolveBossBullet(hard, { x: left.worldX, y: left.worldY, w: 4, h: 12 }, left.hp);
    const after = bossHpBarLayout(hard);
    expect(after.extraFill).toBeCloseTo(1);
    expect(after.mainFill).toBeCloseTo(700 / 840);
    expect(bossBarRatio(hard)).toBeCloseTo((700 + 240) / 1080);

    const span = 240 / 1080;
    expect(bossIntroBarLayout(0, span)).toMatchObject({ mainFill: 0, extraFill: 0 });
    const mid = bossIntroBarLayout(0.5, span);
    expect(mid.extraFill).toBe(0);
    expect(mid.mainFill).toBeCloseTo(0.5 / (1 - span));
    const late = bossIntroBarLayout(1 - span / 2, span);
    expect(late.mainFill).toBeCloseTo(1);
    expect(late.extraFill).toBeCloseTo(0.5);
    expect(bossIntroBarLayout(1, 0)).toEqual({ mainFill: 1, extraSpan: 0, extraFill: 0 });
  });
});
