/**
 * Generic boss runner. Everything boss-specific (parts, phase order, guns,
 * transitions, HP segments, difficulty gates, look) is data in a `BossDef`
 * (`levels/bosses/`). Pure state: rendering and bullet pools live in the
 * battle scene.
 *
 * Lifecycle: enter → (transition →) fight, per enabled phase → death → clear
 * → done. `boss.phase` names the current step: `enter`, a phase id, a
 * transition id, `death`, `clear`, or `done`.
 */

import type { Rng } from '@/engine/rng';
import {
  BOMB_BOSS_RATIO,
  BOSS_HP_BAR_FILL_START,
  BOSS_TURRET_FALL_GRAVITY,
  BOSS_TURRET_FALL_SPEED,
  HIT_FLASH_TIME,
  HITBOX_RADIUS,
  LOGICAL_H,
  SHAKE_BIG_INTENSITY,
  SHAKE_SMALL_DURATION,
  SHAKE_SMALL_INTENSITY,
} from '@/game/config';
import type { EnemyBulletType } from '@/game/entities/enemyBullet';
import type {
  BossAttack,
  BossCycleAttack,
  BossDef,
  BossGunAttack,
  BossLaserAttack,
  BossPhaseDef,
  Fire,
  LaserConfig,
} from '@/game/levels/types';
import { checkBulletEnemyCollision } from '@/game/systems/collision';
import {
  createGunClock,
  createLaserSweep,
  fireBurst,
  fireFirstDelay,
  fireInterval,
  fireRotStep,
  interruptLaserSweep,
  laserSweepHits,
  pullShots,
  resetGunClock,
  resetLaserSweep,
  stepLaserSweep,
  type GunClock,
  type LaserSweepState,
} from '@/game/systems/danmaku';
import {
  stepTiebao,
  tiebaoHullSegments,
  tiebaoLiveHull,
  tiebaoMarkBomb,
  tiebaoOnDeath,
  tiebaoOnFight,
  tiebaoPlaceEnter,
  tiebaoResolveBomb,
  tiebaoTryShot,
} from '@/game/systems/tiebao';

export type BossStage = 'enter' | 'transition' | 'fight' | 'death' | 'clear' | 'done';

export interface BossPartRuntime {
  id: string;
  hp: number;
  maxHp: number;
  score: number;
  offsetX: number;
  offsetY: number;
  radius: number;
  sprite: string | null;
  onDestroy: 'fall' | null;
  alive: boolean;
  falling: boolean;
  fallVy: number;
  worldX: number;
  worldY: number;
  /** Multiplier on this part's gun intervals (0.8 after the other turret dies). */
  intervalMul: number;
}

export interface BossCycleState {
  step: number;
  time: number;
  gun: GunClock;
  /** Rotation shared by every step, kept across step changes. */
  rot: number;
}

export interface BossRuntime {
  def: BossDef;
  /** Phases this run fights, in order (gated phases already filtered). */
  phases: readonly BossPhaseDef[];
  phaseIndex: number;
  stage: BossStage;
  /** `enter`, a phase id, a transition id, `death`, `clear`, or `done`. */
  phase: string;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  phaseTime: number;
  driftTime: number;
  parts: BossPartRuntime[];
  invulnerable: boolean;
  enraged: boolean;
  /** Gun clocks keyed by attack id. */
  guns: Record<string, GunClock>;
  cycle: BossCycleState;
  /** Current cycle step label, or null when the phase has no cycle. */
  pattern: string | null;
  laser: LaserSweepState;
  deathSpawned: number;
  hitFlash: number;
  resultSent: boolean;
  /** True when this run fights at least one `bar: 'extra'` phase. */
  extraArmed: boolean;
  /** HP banked in extra phases. */
  extraMax: number;
  /** Parts plus every armed segment. Bomb damage is 8% of this. */
  fightMax: number;
}

export interface BossExplosion {
  x: number;
  y: number;
  delay: number;
  /** Crate pop is small. Part pop is medium. The death sequence is large. */
  size: 'small' | 'medium' | 'large';
}

export interface BossShot {
  fire: Fire;
  x: number;
  y: number;
  rotation: number;
}

/** A bolt with an explicit velocity. Fan shots stay on `shots`. */
export interface BossBolt {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: EnemyBulletType;
  homing: number;
  hitRadius?: number;
}

/** Player position and the stage RNG. Omitted callers keep the sine drift. */
export interface BossWorld {
  playerX: number;
  playerY: number;
  rng: Rng;
}

export interface BossShake {
  intensity: number;
  duration: number;
}

export interface BossEvents {
  score: number;
  explosions: BossExplosion[];
  shots: BossShot[];
  bolts: BossBolt[];
  /** A ground blast reached the player. */
  hurtPlayer: boolean;
  /** Phase change: on-screen enemy bullets become score. */
  convertBullets: boolean;
  /** Boss death: clear enemy bullets with no score. */
  clearBullets: boolean;
  shake: BossShake | null;
  /** STAGE CLEAR hold finished; show the result screen. */
  enterResult: boolean;
  consumedBullet: boolean;
}

export interface BulletBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BossSpawnOptions {
  /** Gates this run opens (`DifficultyProfile.bossGates`). Ungated phases always run. */
  gates?: readonly string[];
}

export function emptyBossEvents(): BossEvents {
  return {
    score: 0,
    explosions: [],
    shots: [],
    bolts: [],
    hurtPlayer: false,
    convertBullets: false,
    clearBullets: false,
    shake: null,
    enterResult: false,
    consumedBullet: false,
  };
}

/** Phases a run with these gates fights. */
export function enabledBossPhases(
  def: BossDef,
  gates: readonly string[] = []
): readonly BossPhaseDef[] {
  return def.phases.filter((phase) => phase.gate === undefined || gates.includes(phase.gate));
}

/** Phase definition by id. Throws on a typo so data errors surface in tests. */
export function bossPhaseDef(def: BossDef, id: string): BossPhaseDef {
  const phase = def.phases.find((item) => item.id === id);
  if (!phase) throw new Error(`boss ${def.id} has no phase ${id}`);
  return phase;
}

/** Attack definition by phase and attack id. */
export function bossAttackDef(def: BossDef, phaseId: string, attackId: string): BossAttack {
  const attack = bossPhaseDef(def, phaseId).attacks.find((item) => item.id === attackId);
  if (!attack) throw new Error(`boss ${def.id} phase ${phaseId} has no attack ${attackId}`);
  return attack;
}

export function bossTotalHp(def: BossDef): number {
  return def.parts.reduce((sum, part) => sum + part.hp, 0);
}

/** HP banked in extra-bar phases this run fights. */
export function bossExtraHp(def: BossDef, gates: readonly string[] = []): number {
  return enabledBossPhases(def, gates).reduce(
    (sum, phase) => sum + (phase.bar === 'extra' ? (phase.segmentHp ?? 0) : 0),
    0
  );
}

/** Width of the extra slot on the HP bar, for the warning fill. 0 without one. */
export function bossExtraSpan(def: BossDef, gates: readonly string[] = []): number {
  const extra = bossExtraHp(def, gates);
  return extra / Math.max(1, bossTotalHp(def) + extra);
}

/** 8% of total boss HP, rounded to the wave table's 67. */
export function bossBombDamage(totalHp: number, ratio: number = BOMB_BOSS_RATIO): number {
  return Math.round(totalHp * ratio);
}

/**
 * Split bomb damage across living parts.
 * The earlier parts receive the remainder, so 67 across two turrets is 34 and 33.
 */
export function splitBombDamage(total: number, recipients: number): number[] {
  if (recipients <= 0 || total <= 0) return [];
  const base = Math.floor(total / recipients);
  let rem = total - base * recipients;
  const out: number[] = [];
  for (let i = 0; i < recipients; i++) {
    const extra = rem > 0 ? 1 : 0;
    if (rem > 0) rem--;
    out.push(base + extra);
  }
  return out;
}

export function bossHpRemaining(boss: BossRuntime): number {
  return boss.parts.reduce((sum, part) => sum + Math.max(0, part.hp), 0);
}

export interface BossHpBarLayout {
  /** 0–1 fill of the main slot (every `bar: 'main'` phase). */
  mainFill: number;
  /** Width of the extra slot as a fraction of the bar. 0 when no extra phase is armed. */
  extraSpan: number;
  /** 0–1 fill inside the extra slot. Stays full until that segment is live. */
  extraFill: number;
}

function extraLive(boss: BossRuntime): boolean {
  if (boss.stage === 'death' || boss.stage === 'clear' || boss.stage === 'done') return true;
  if (boss.stage !== 'transition' && boss.stage !== 'fight') return false;
  return boss.phases[boss.phaseIndex]?.bar === 'extra';
}

/**
 * Two slots when an extra phase is armed. Main phases share the left slot. The
 * right slot is the extra HP and does not shrink while main phases take
 * damage. Without an extra phase the bar is one slot (`extraSpan` 0).
 */
export function bossHpBarLayout(boss: BossRuntime): BossHpBarLayout {
  const extraMax = boss.extraArmed ? boss.extraMax : 0;
  const total = Math.max(1, boss.fightMax);
  const extraSpan = extraMax > 0 ? extraMax / total : 0;
  const mainMax = Math.max(1, total - extraMax);
  let mainHp = 0;
  let extraHp = 0;
  if (extraMax <= 0) {
    mainHp = bossHpRemaining(boss);
  } else if (extraLive(boss)) {
    if (boss.stage === 'transition' || boss.stage === 'fight') {
      extraHp = targetHp(boss);
    }
  } else {
    mainHp = bossHpRemaining(boss);
    extraHp = extraMax;
  }
  return {
    mainFill: clamp01(mainHp / mainMax),
    extraSpan,
    extraFill: extraMax > 0 ? clamp01(extraHp / extraMax) : 0,
  };
}

/**
 * Warning-bar fill, left to right across the same slots as `bossHpBarLayout`.
 * `extraSpan` 0 keeps the whole bar one segment.
 */
export function bossIntroBarLayout(fill: number, extraSpan: number): BossHpBarLayout {
  const span = clamp01(extraSpan);
  const u = clamp01(fill);
  if (span <= 0) return { mainFill: u, extraSpan: 0, extraFill: 0 };
  const mainSpan = 1 - span;
  if (u <= mainSpan) {
    return { mainFill: mainSpan > 0 ? u / mainSpan : 0, extraSpan: span, extraFill: 0 };
  }
  return { mainFill: 1, extraSpan: span, extraFill: (u - mainSpan) / span };
}

/** Overall remaining fraction. The drawn bar splits this into two slots when armed. */
export function bossBarRatio(boss: BossRuntime): number {
  const layout = bossHpBarLayout(boss);
  return (1 - layout.extraSpan) * layout.mainFill + layout.extraSpan * layout.extraFill;
}

export function bossPart(boss: BossRuntime, id: string): BossPartRuntime | undefined {
  return boss.parts.find((part) => part.id === id);
}

/**
 * Axis-aligned hull. 铁堡 shots and the player use `tiebaoHullSegments` instead:
 * one rigid box per car, which tiles this rect while parked and follows the
 * turnout while the cars are banked. One rect at `boss.x` would miss the nose
 * or the tail.
 */
export function bossHullRect(boss: BossRuntime): { x: number; y: number; w: number; h: number } {
  if (boss.def.script === 'tiebao') {
    const hull = tiebaoLiveHull(boss);
    return { x: boss.x - hull.w / 2, y: boss.y - hull.h / 2, w: hull.w, h: hull.h };
  }
  const { w, h } = boss.def.hull;
  return { x: boss.x - w / 2, y: boss.y - h / 2, w, h };
}

/** Current phase while entering, fighting, or in its transition. Null afterwards. */
export function bossCurrentPhase(boss: BossRuntime): BossPhaseDef | null {
  if (boss.stage === 'death' || boss.stage === 'clear' || boss.stage === 'done') return null;
  return boss.phases[boss.phaseIndex] ?? null;
}

export interface BossLook {
  hull: 'closed' | 'open';
  glow: { part: BossPartRuntime; color: 'magenta' | 'yellow' | 'orange'; opening: number } | null;
  smoke: boolean;
}

/**
 * What to draw: hull state and the core glow. Null once the wreck is gone.
 * Death keeps the last phase's hull. The glow fades in over 0.5s of a transition.
 */
export function bossLook(boss: BossRuntime): BossLook | null {
  if (boss.stage === 'clear' || boss.stage === 'done') return null;
  const phase = boss.phases[boss.phaseIndex];
  if (!phase) return null;
  let glow: BossLook['glow'] = null;
  const glowing = boss.stage === 'transition' || boss.stage === 'fight';
  if (glowing && phase.look.glow) {
    const part = bossPart(boss, phase.look.glow.part);
    if (part?.alive) {
      const opening = boss.stage === 'transition' ? Math.min(1, boss.phaseTime / 0.5) : 1;
      glow = { part, color: phase.look.glow.color, opening };
    }
  }
  const smoke = phase.look.smoke === true && boss.stage !== 'enter';
  return { hull: phase.look.hull, glow, smoke };
}

export interface BossActiveLaser {
  state: LaserSweepState;
  spec: LaserConfig;
  originX: number;
  originY: number;
}

/** The current phase's laser while it telegraphs or sweeps. */
export function bossActiveLaser(boss: BossRuntime): BossActiveLaser | null {
  if (boss.stage !== 'fight' || boss.laser.mode === 'idle') return null;
  const attack = phaseLaser(boss);
  if (!attack) return null;
  const origin = attackOrigin(boss, attack.from);
  if (!origin) return null;
  return { state: boss.laser, spec: attack.laser, originX: origin.x, originY: origin.y };
}

/**
 * Cinematic fill during the warning (null before 2:33 and once the fight starts).
 * 0–1 from left to right.
 */
export function bossIntroBarFill(
  gameTime: number,
  warningAt: number,
  enterAt: number
): number | null {
  const start = warningAt + BOSS_HP_BAR_FILL_START;
  if (gameTime < start || gameTime >= enterAt) return null;
  const span = enterAt - start;
  if (span <= 0) return 1;
  return clamp01((gameTime - start) / span);
}

export function createBoss(def: BossDef, options: BossSpawnOptions = {}): BossRuntime {
  const phases = enabledBossPhases(def, options.gates);
  const extraMax = phases.reduce(
    (sum, phase) => sum + (phase.bar === 'extra' ? (phase.segmentHp ?? 0) : 0),
    0
  );
  const guns: Record<string, GunClock> = {};
  for (const phase of def.phases) {
    for (const attack of phase.attacks) {
      if (attack.kind === 'gun') guns[attack.id] = createGunClock();
    }
  }
  const firstLaser = phases.flatMap((phase) => phase.attacks).find(isLaser);
  const boss: BossRuntime = {
    def,
    phases,
    phaseIndex: 0,
    stage: 'enter',
    phase: 'enter',
    x: def.anchorX,
    y: def.enterY,
    prevX: def.anchorX,
    prevY: def.enterY,
    phaseTime: 0,
    driftTime: 0,
    parts: def.parts.map((part) => ({
      id: part.id,
      hp: part.hp,
      maxHp: part.hp,
      score: part.score,
      offsetX: part.offset.x,
      offsetY: part.offset.y,
      radius: part.radius,
      sprite: part.sprite ?? null,
      onDestroy: part.onDestroy ?? null,
      alive: true,
      falling: false,
      fallVy: 0,
      worldX: def.anchorX + part.offset.x,
      worldY: def.enterY + part.offset.y,
      intervalMul: 1,
    })),
    invulnerable: def.vulnerableEnter !== true,
    enraged: false,
    guns,
    cycle: { step: 0, time: 0, gun: createGunClock(), rot: 0 },
    pattern: null,
    laser: createLaserSweep(firstLaser?.laser.sweep ?? 0),
    deathSpawned: 0,
    hitFlash: 0,
    resultSent: false,
    extraArmed: extraMax > 0,
    extraMax,
    fightMax: 0,
  };
  boss.fightMax = boss.parts.reduce((sum, part) => sum + part.maxHp, 0) + extraMax;
  syncParts(boss);
  return boss;
}

export function updateBoss(boss: BossRuntime, dt: number, world?: BossWorld): BossEvents {
  const ev = emptyBossEvents();
  if (boss.stage === 'done') return ev;
  const def = boss.def;
  const scripted = def.script === 'tiebao';

  boss.prevX = boss.x;
  boss.prevY = boss.y;
  let attackDt = 0;
  let scriptDt = 0;

  if (boss.stage === 'enter') {
    boss.phaseTime += dt;
    const duration = Math.max(0.0001, def.enterDuration);
    const u = Math.min(1, boss.phaseTime / duration);
    boss.x = def.anchorX;
    if (scripted) tiebaoPlaceEnter(boss, u);
    else boss.y = def.enterY + (def.parkY - def.enterY) * u;
    if (boss.phaseTime >= duration) {
      const leftover = boss.phaseTime - duration;
      if (scripted) tiebaoPlaceEnter(boss, 1);
      else boss.y = def.parkY;
      startFight(boss);
      boss.phaseTime = leftover;
      boss.driftTime = leftover;
      attackDt = leftover;
      scriptDt = leftover;
    }
  } else if (boss.stage === 'fight') {
    boss.phaseTime += dt;
    boss.driftTime += dt;
    if (scripted) scriptDt = dt;
    else drift(boss);
    attackDt = dt;
  } else if (boss.stage === 'transition') {
    boss.phaseTime += dt;
    boss.driftTime += dt;
    const duration = Math.max(0.0001, boss.phases[boss.phaseIndex]?.transition?.duration ?? 0);
    if (boss.phaseTime >= duration) {
      const leftover = boss.phaseTime - duration;
      const held = Math.max(0, dt - leftover);
      if (scripted && held > 0) stepTiebao(boss, held, world, ev);
      startFight(boss);
      boss.phaseTime = leftover;
      attackDt = leftover;
      scriptDt = leftover;
    } else if (scripted) {
      scriptDt = dt;
    } else {
      drift(boss);
    }
  } else if (boss.stage === 'death') {
    boss.phaseTime += dt;
    spawnDueDeathExplosions(boss, ev);
    if (boss.phaseTime >= def.death.duration) {
      setStage(boss, 'clear');
      boss.phaseTime = 0;
    }
  } else if (boss.stage === 'clear') {
    // The victory fly-off owns the wait. `releaseBossResult` opens the result.
    boss.phaseTime += dt;
  }

  fallDebris(boss, dt);
  syncParts(boss);
  if (boss.hitFlash > 0) boss.hitFlash = Math.max(0, boss.hitFlash - dt);

  if (scriptDt > 0 && scripted) {
    stepTiebao(boss, scriptDt, world, ev);
    syncParts(boss);
  }
  if (attackDt > 0 && boss.stage === 'fight') tickAttacks(boss, attackDt, ev);
  return ev;
}

/** Death animation is over and the fly-off has left the screen. Opens the result once. */
export function releaseBossResult(boss: BossRuntime): BossEvents {
  const ev = emptyBossEvents();
  if (boss.stage !== 'clear' || boss.resultSent) return ev;
  boss.resultSent = true;
  setStage(boss, 'done');
  ev.enterResult = true;
  return ev;
}

export function applyBossBomb(boss: BossRuntime): BossEvents {
  const ev = emptyBossEvents();
  if (boss.stage === 'fight' && phaseLaser(boss)) interruptLaserSweep(boss.laser);

  if (!canTakeDamage(boss)) return ev;

  const amount = bossBombDamage(boss.fightMax);
  const living = damageableParts(boss);
  const shares = splitBombDamage(amount, living.length);
  living.forEach((part, index) => {
    hurtPart(boss, part, shares[index] ?? 0, ev);
  });
  return ev;
}

/** Weak points a homing missile may lock onto: only parts that can take damage now. */
export function bossMissileTargets(boss: BossRuntime): BossPartRuntime[] {
  if (!canTakeDamage(boss)) return [];
  return damageableParts(boss);
}

/** Player bullet against the live targets or the invulnerable hull. */
export function resolveBossBullet(
  boss: BossRuntime,
  bullet: BulletBox,
  damage: number
): BossEvents {
  const ev = emptyBossEvents();
  if (!bossBlocksShots(boss)) return ev;
  if (boss.def.script === 'tiebao' && tiebaoTryShot(boss, bullet, damage, ev)) return ev;

  const hittable = damageableParts(boss);

  const connect = (part: BossPartRuntime): BossEvents => {
    ev.consumedBullet = true;
    if (!boss.invulnerable) hurtPart(boss, part, damage, ev);
    return ev;
  };

  const direct = nearestPart(hittable, bullet, (part) =>
    checkBulletEnemyCollision(
      bullet.x,
      bullet.y,
      bullet.w,
      bullet.h,
      part.worldX,
      part.worldY,
      part.radius
    )
  );
  if (direct) return connect(direct);

  const left = bullet.x - bullet.w / 2;
  const top = bullet.y - bullet.h / 2;
  if (!hullOverlapsBullet(boss, left, top, bullet.w, bullet.h)) return ev;

  if (boss.def.hullTransfers) {
    const any = nearestPart(hittable, bullet, () => true);
    if (any) return connect(any);
    ev.consumedBullet = true;
    return ev;
  }

  // The nose (part center down to the hull's player-facing edge) is the
  // weak-point face. A shot into that face damages the nearest living part
  // immediately, including off-center and 15° streams. Armor above the
  // part centers still stops a bullet without hurting anything.
  const hull = bossHullRect(boss);
  const faceBottom = hull.y + hull.h;
  const facing = nearestPart(hittable, bullet, (part) => {
    const bulletTop = bullet.y - bullet.h / 2;
    const bulletBottom = bullet.y + bullet.h / 2;
    return bulletBottom > part.worldY && bulletTop < faceBottom;
  });
  if (facing) return connect(facing);

  ev.consumedBullet = true;
  return ev;
}

function hullOverlapsBullet(
  boss: BossRuntime,
  left: number,
  top: number,
  w: number,
  h: number
): boolean {
  if (boss.def.script === 'tiebao') {
    return tiebaoHullSegments(boss).some((seg) =>
      rectsOverlap(left, top, w, h, seg.x, seg.y, seg.w, seg.h)
    );
  }
  const hull = bossHullRect(boss);
  return rectsOverlap(left, top, w, h, hull.x, hull.y, hull.w, hull.h);
}

export function bossHitsPlayer(boss: BossRuntime, px: number, py: number): boolean {
  if (!bossBlocksShots(boss)) return false;
  if (boss.def.script === 'tiebao') {
    for (const seg of tiebaoHullSegments(boss)) {
      if (circleRect(px, py, HITBOX_RADIUS, seg.x, seg.y, seg.w, seg.h)) return true;
    }
  } else {
    const hull = bossHullRect(boss);
    if (circleRect(px, py, HITBOX_RADIUS, hull.x, hull.y, hull.w, hull.h)) return true;
  }
  for (const part of boss.parts) {
    if (!part.alive || part.falling) continue;
    const dx = px - part.worldX;
    const dy = py - part.worldY;
    const reach = HITBOX_RADIUS + part.radius;
    if (dx * dx + dy * dy < reach * reach) return true;
  }
  return false;
}

/** Sweeping beam only. The telegraph line does not hurt. */
export function bossLaserHits(boss: BossRuntime, px: number, py: number): boolean {
  const active = bossActiveLaser(boss);
  if (!active) return false;
  const length = LOGICAL_H + boss.def.hull.h;
  return laserSweepHits(
    active.state,
    active.spec,
    active.originX,
    active.originY,
    length,
    px,
    py,
    HITBOX_RADIUS
  );
}

function isLaser(attack: BossAttack): attack is BossLaserAttack {
  return attack.kind === 'laser';
}

function phaseLaser(boss: BossRuntime): BossLaserAttack | undefined {
  return boss.phases[boss.phaseIndex]?.attacks.find(isLaser);
}

function setStage(boss: BossRuntime, stage: BossStage): void {
  boss.stage = stage;
  const phase = boss.phases[boss.phaseIndex];
  if (stage === 'fight') boss.phase = phase?.id ?? 'fight';
  else if (stage === 'transition') boss.phase = phase?.transition?.id ?? phase?.id ?? 'transition';
  else boss.phase = stage;
}

/** Fresh guns, cycle, and laser cooldown for the phase that starts fighting now. */
function startFight(boss: BossRuntime): void {
  setStage(boss, 'fight');
  boss.invulnerable = false;
  boss.enraged = false;
  const phase = boss.phases[boss.phaseIndex];
  if (!phase) return;
  for (const attack of phase.attacks) {
    if (attack.kind === 'gun') {
      const gun = boss.guns[attack.id];
      if (gun) resetGunClock(gun);
    } else if (attack.kind === 'cycle') {
      boss.cycle.step = 0;
      boss.cycle.time = 0;
      boss.cycle.rot = 0;
      resetGunClock(boss.cycle.gun);
      boss.pattern = attack.steps[0]?.label ?? null;
    }
  }
  resetLaserSweep(boss.laser);
  if (boss.def.script === 'tiebao') tiebaoOnFight(boss);
}

function drift(boss: BossRuntime): void {
  const { amp, period } = boss.def.drift;
  const omega = (Math.PI * 2 * boss.driftTime) / Math.max(0.0001, period);
  boss.x = boss.def.anchorX + amp * Math.sin(omega);
  boss.y = boss.def.parkY;
}

function attackOrigin(boss: BossRuntime, from: string): { x: number; y: number } | null {
  if (from === 'hull') return { x: boss.x, y: boss.y };
  const part = bossPart(boss, from);
  if (!part?.alive) return null;
  return { x: part.worldX, y: part.worldY };
}

function tickAttacks(boss: BossRuntime, dt: number, ev: BossEvents): void {
  const phase = boss.phases[boss.phaseIndex];
  if (!phase) return;
  for (const attack of phase.attacks) {
    if (attack.kind === 'laser') {
      const every = boss.enraged ? attack.enraged.every : attack.laser.every;
      const sweep = boss.enraged ? attack.enraged.sweep : attack.laser.sweep;
      stepLaserSweep(boss.laser, dt, attack.laser, every, sweep);
    } else if (attack.kind === 'cycle') {
      tickCycle(boss, attack, dt, ev);
    } else if (tickGun(boss, attack, dt, ev) > 0 && attack.yieldOnFire) {
      return;
    }
  }
}

/** Returns how many volleys fired. */
function tickGun(boss: BossRuntime, attack: BossGunAttack, dt: number, ev: BossEvents): number {
  if (attack.pauseWhileLaserSweeps && boss.laser.mode === 'sweep') return 0;
  if (attack.onlyWhileLaserIdle && boss.laser.mode !== 'idle') return 0;
  const origin = attackOrigin(boss, attack.from);
  const gun = boss.guns[attack.id];
  if (!origin || !gun) return 0;
  const mul = attack.from === 'hull' ? 1 : (bossPart(boss, attack.from)?.intervalMul ?? 1);
  const fire = attack.fire;
  const base =
    boss.enraged && attack.enrageInterval !== undefined
      ? attack.enrageInterval
      : fireInterval(fire);
  const interval = base * mul;
  const first = fireFirstDelay(fire, base) * mul;
  const count = pullShots(gun, dt, interval, first, fireBurst(fire));
  const step = fireRotStep(fire);
  for (let i = 0; i < count; i++) {
    ev.shots.push({ fire, x: origin.x, y: origin.y, rotation: gun.rot + i * step });
  }
  gun.rot += count * step;
  return count;
}

function tickCycle(boss: BossRuntime, attack: BossCycleAttack, dt: number, ev: BossEvents): void {
  const origin = attackOrigin(boss, attack.from);
  const cycle = boss.cycle;
  const hold = Math.max(0.05, attack.hold);
  let left = dt;

  for (let guard = 0; guard < 4 && left > 1e-8; guard++) {
    const untilSwitch = hold - cycle.time;
    const slice = Math.min(left, Math.max(0, untilSwitch));
    if (slice > 0) {
      const fire = attack.steps[cycle.step]?.fire;
      if (fire && origin) fireCycleSlice(cycle, fire, slice, origin, ev);
      cycle.time += slice;
      left -= slice;
    }
    if (cycle.time + 1e-9 < hold) return;
    cycle.time = 0;
    cycle.step = (cycle.step + 1) % Math.max(1, attack.steps.length);
    boss.pattern = attack.steps[cycle.step]?.label ?? null;
    resetGunClock(cycle.gun);
    if (left <= 1e-8) return;
  }
}

function fireCycleSlice(
  cycle: BossCycleState,
  fire: Fire,
  dt: number,
  origin: { x: number; y: number },
  ev: BossEvents
): void {
  const interval = fireInterval(fire);
  const count = pullShots(cycle.gun, dt, interval, fireFirstDelay(fire, interval), fireBurst(fire));
  const step = fireRotStep(fire);
  for (let i = 0; i < count; i++) {
    ev.shots.push({ fire, x: origin.x, y: origin.y, rotation: cycle.rot });
    cycle.rot += step;
  }
}

function hurtPart(boss: BossRuntime, part: BossPartRuntime, amount: number, ev: BossEvents): void {
  if (!part.alive || amount <= 0 || boss.invulnerable) return;
  part.hp -= amount;
  boss.hitFlash = HIT_FLASH_TIME;
  if (part.hp > 0) {
    refreshEnrage(boss);
    return;
  }
  part.hp = 0;
  killPart(boss, part, ev);
}

/** A later phase this run fights brings the part back, so its score waits. */
function revivedLater(boss: BossRuntime, part: BossPartRuntime): boolean {
  for (let i = boss.phaseIndex + 1; i < boss.phases.length; i++) {
    if (boss.phases[i]!.targets.includes(part.id)) return true;
  }
  return false;
}

function killPart(boss: BossRuntime, part: BossPartRuntime, ev: BossEvents): void {
  if (!part.alive) return;
  part.alive = false;
  part.hp = 0;
  const phase = boss.phases[boss.phaseIndex];
  if (!phase) return;

  if (!revivedLater(boss, part)) ev.score += part.score;
  if (part.onDestroy === 'fall') {
    part.falling = true;
    part.fallVy = BOSS_TURRET_FALL_SPEED;
    ev.explosions.push({ x: part.worldX, y: part.worldY, delay: 0, size: 'medium' });
    ev.shake = { intensity: SHAKE_SMALL_INTENSITY, duration: SHAKE_SMALL_DURATION };
  }
  if (phase.survivorRateMul !== undefined) {
    const scale = phase.survivorRateMul <= 0 ? 1 : 1 / phase.survivorRateMul;
    for (const id of phase.targets) {
      const other = bossPart(boss, id);
      if (other && other !== part) other.intervalMul = scale;
    }
  }

  const cleared = phase.targets.every((id) => !bossPart(boss, id)?.alive);
  if (!cleared) return;
  if (boss.phaseIndex + 1 < boss.phases.length) beginTransition(boss, ev);
  else beginDeath(boss, ev);
}

/** Next phase: revive its targets on their segment HP, convert bullets, go invulnerable. */
function beginTransition(boss: BossRuntime, ev: BossEvents): void {
  boss.phaseIndex++;
  const next = boss.phases[boss.phaseIndex]!;
  for (const id of next.targets) {
    const part = bossPart(boss, id);
    if (!part || part.alive) continue;
    const hp = next.segmentHp ?? part.maxHp;
    part.alive = true;
    part.falling = false;
    part.hp = hp;
    part.maxHp = hp;
  }
  boss.phaseTime = 0;
  boss.invulnerable = true;
  boss.enraged = false;
  resetLaserSweep(boss.laser);
  ev.convertBullets = true;
  if (next.transition) setStage(boss, 'transition');
  else startFight(boss);
}

function beginDeath(boss: BossRuntime, ev: BossEvents): void {
  if (boss.stage === 'death' || boss.stage === 'clear' || boss.stage === 'done') return;
  setStage(boss, 'death');
  boss.phaseTime = 0;
  boss.invulnerable = true;
  boss.laser.mode = 'idle';
  boss.deathSpawned = 0;
  ev.clearBullets = true;
  ev.shake = { intensity: SHAKE_BIG_INTENSITY, duration: boss.def.death.duration };
  if (boss.def.script === 'tiebao') tiebaoOnDeath(boss, ev);
  emitDeathExplosion(boss, 0, ev);
  boss.deathSpawned = 1;
}

function spawnDueDeathExplosions(boss: BossRuntime, ev: BossEvents): void {
  const count = Math.max(1, boss.def.death.explosions);
  const interval = boss.def.death.duration / count;
  while (boss.deathSpawned < count && boss.phaseTime + 1e-9 >= boss.deathSpawned * interval) {
    emitDeathExplosion(boss, boss.deathSpawned, ev);
    boss.deathSpawned++;
  }
}

function emitDeathExplosion(boss: BossRuntime, index: number, ev: BossEvents): void {
  const offsets = boss.def.death.offsets;
  const spot = offsets[index % Math.max(1, offsets.length)] ?? [0, 0];
  ev.explosions.push({ x: boss.x + spot[0], y: boss.y + spot[1], delay: 0, size: 'large' });
}

function targetHp(boss: BossRuntime): number {
  const phase = boss.phases[boss.phaseIndex];
  if (!phase) return 0;
  return phase.targets.reduce((sum, id) => sum + Math.max(0, bossPart(boss, id)?.hp ?? 0), 0);
}

function refreshEnrage(boss: BossRuntime): void {
  if (boss.stage !== 'fight') return;
  const phase = boss.phases[boss.phaseIndex];
  if (phase?.enrageAtHpRatio === undefined) return;
  const lead = bossPart(boss, phase.targets[0] ?? '');
  if (!lead) return;
  if (lead.hp <= lead.maxHp * phase.enrageAtHpRatio) boss.enraged = true;
}

function canTakeDamage(boss: BossRuntime): boolean {
  if (boss.invulnerable) return false;
  if (boss.stage === 'fight') return true;
  return boss.stage === 'enter' && boss.def.vulnerableEnter === true;
}

/** Queue bomb-ring hits on script props (ammo crates). No-op for other bosses. */
export function markBossBombProps(boss: BossRuntime, ox: number, oy: number): void {
  if (boss.def.script === 'tiebao') tiebaoMarkBomb(boss, ox, oy);
}

/** Resolve bomb-ring hits on script props. No score and no ground blast. */
export function resolveBossBombProps(boss: BossRuntime, dt: number): BossEvents {
  const ev = emptyBossEvents();
  if (boss.def.script === 'tiebao') tiebaoResolveBomb(boss, dt, ev);
  return ev;
}

function bossBlocksShots(boss: BossRuntime): boolean {
  return boss.stage === 'enter' || boss.stage === 'transition' || boss.stage === 'fight';
}

/**
 * Entering and fighting: this phase's living targets. During a transition the
 * previous phase's targets stay the hittable set (the boss is invulnerable).
 */
function damageableParts(boss: BossRuntime): BossPartRuntime[] {
  if (!bossBlocksShots(boss)) return [];
  const index = boss.stage === 'transition' ? boss.phaseIndex - 1 : boss.phaseIndex;
  const phase = boss.phases[index];
  if (!phase) return [];
  return boss.parts.filter(
    (part) => phase.targets.includes(part.id) && part.alive && !part.falling
  );
}

function fallDebris(boss: BossRuntime, dt: number): void {
  for (const part of boss.parts) {
    if (!part.falling) continue;
    part.fallVy += BOSS_TURRET_FALL_GRAVITY * dt;
    part.worldY += part.fallVy * dt;
    if (part.worldY > LOGICAL_H + 48) part.falling = false;
  }
}

function syncParts(boss: BossRuntime): void {
  for (const part of boss.parts) {
    if (part.falling) continue;
    part.worldX = boss.x + part.offsetX;
    part.worldY = boss.y + part.offsetY;
  }
}

function nearestPart(
  parts: readonly BossPartRuntime[],
  bullet: BulletBox,
  hits: (part: BossPartRuntime) => boolean
): BossPartRuntime | undefined {
  let best: BossPartRuntime | undefined;
  let bestDist = Infinity;
  for (const part of parts) {
    if (!hits(part)) continue;
    const dx = part.worldX - bullet.x;
    const dy = part.worldY - bullet.y;
    const dist = dx * dx + dy * dy;
    if (!best || dist < bestDist || (dist === bestDist && part.worldX < best.worldX)) {
      best = part;
      bestDist = dist;
    }
  }
  return best;
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function circleRect(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}

function clamp01(v: number): number {
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return v;
}
