/**
 * 黑曜 saucer show. Starts the frame HP hits zero and runs 6.80s. The generic
 * death explosion and `stepVictoryExit` stay idle until this clock finishes.
 *
 * Design: docs/电雷_第四关_黑曜Boss设计_v1.md §8. Screen coordinates. The deck
 * keeps scrolling underneath. Nothing here clears bullets. The saucer, the
 * charge point, and the beam have no hitbox.
 */

import {
  OBSIDIAN_BEAM_FLASH,
  OBSIDIAN_BREAK_AT,
  OBSIDIAN_BREAK_EXPLOSIONS,
  OBSIDIAN_BREAK_SPAN,
  OBSIDIAN_CHARGE,
  OBSIDIAN_SAUCER_EXIT,
  OBSIDIAN_SAUCER_EXIT_Y,
  OBSIDIAN_SAUCER_FROM_Y,
  OBSIDIAN_SAUCER_HOLD,
  OBSIDIAN_SAUCER_SLIDE,
  OBSIDIAN_SAUCER_TOTAL,
  OBSIDIAN_SAUCER_TRAVEL,
  OBSIDIAN_SAUCER_X,
  OBSIDIAN_SAUCER_Y,
  OBSIDIAN_WRECK_X,
  OBSIDIAN_WRECK_Y,
} from '@/game/config';
import type { BossEvents, BossRuntime } from '@/game/systems/boss';

interface SaucerState {
  t: number;
  fromX: number;
  fromY: number;
  booms: number;
  cue: boolean;
}

const shows = new WeakMap<BossRuntime, SaucerState>();

const BOOM_OFFSETS: readonly (readonly [number, number])[] = [
  [0, 0],
  [-22, 14],
  [20, -16],
  [0, 26],
  [-18, -22],
  [16, 8],
];

function easeOut(u: number): number {
  const t = Math.max(0, Math.min(1, u));
  return 1 - (1 - t) * (1 - t);
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u;
}

function follow(boss: BossRuntime): void {
  for (const part of boss.parts) {
    if (part.falling) continue;
    part.worldX = boss.x + part.offsetX;
    part.worldY = boss.y + part.offsetY;
  }
}

/** Hull center during the slide. Ease-out from the pose HP emptied at. */
export function obsidianWreckPose(
  t: number,
  fromX: number,
  fromY: number
): { x: number; y: number } {
  if (t >= OBSIDIAN_SAUCER_SLIDE) return { x: OBSIDIAN_WRECK_X, y: OBSIDIAN_WRECK_Y };
  const u = easeOut(t / OBSIDIAN_SAUCER_SLIDE);
  return {
    x: lerp(fromX, OBSIDIAN_WRECK_X, u),
    y: lerp(fromY, OBSIDIAN_WRECK_Y, u),
  };
}

/**
 * Saucer center y, or null before it enters. Descent and the hold are linear
 * in their own spans. The exit is linear from y=100 to y=-140.
 */
export function obsidianSaucerCenterY(t: number): number | null {
  const arrive = OBSIDIAN_SAUCER_SLIDE;
  const parked = arrive + OBSIDIAN_SAUCER_TRAVEL;
  const leave = OBSIDIAN_BREAK_AT;
  if (t < arrive) return null;
  if (t < parked) {
    const u = (t - arrive) / OBSIDIAN_SAUCER_TRAVEL;
    return lerp(OBSIDIAN_SAUCER_FROM_Y, OBSIDIAN_SAUCER_Y, u);
  }
  if (t < leave) return OBSIDIAN_SAUCER_Y;
  const u = Math.min(1, (t - leave) / OBSIDIAN_SAUCER_EXIT);
  return lerp(OBSIDIAN_SAUCER_Y, OBSIDIAN_SAUCER_EXIT_Y, u);
}

export interface ObsidianSaucerView {
  active: boolean;
  t: number;
  saucerX: number;
  saucerY: number | null;
  /** Disc heart brightens. The beam is not up yet. */
  charge: boolean;
  beam: boolean;
  /** Hull sprites stop. Explosions own the frame. */
  broken: boolean;
  smoke: boolean;
  showName: boolean;
}

export function obsidianSaucerView(boss: BossRuntime): ObsidianSaucerView {
  const state = shows.get(boss);
  if (!state) {
    return {
      active: false,
      t: 0,
      saucerX: OBSIDIAN_SAUCER_X,
      saucerY: null,
      charge: false,
      beam: false,
      broken: false,
      smoke: false,
      showName: true,
    };
  }
  const t = state.t;
  const parked = OBSIDIAN_SAUCER_SLIDE + OBSIDIAN_SAUCER_TRAVEL + OBSIDIAN_SAUCER_HOLD;
  const beamAt = parked + OBSIDIAN_CHARGE;
  return {
    active: true,
    t,
    saucerX: OBSIDIAN_SAUCER_X,
    saucerY: obsidianSaucerCenterY(t),
    charge: t >= parked && t < beamAt,
    beam: t >= beamAt && t < OBSIDIAN_BREAK_AT,
    broken: t >= OBSIDIAN_BREAK_AT,
    smoke: t < OBSIDIAN_BREAK_AT,
    showName: t < OBSIDIAN_BREAK_AT,
  };
}

/** True while the player may move but must not shoot, bomb, or die. */
export function obsidianCutsceneActive(
  boss: { stage: string; def: { script?: string } } | null
): boolean {
  return boss?.def.script === 'obsidian' && boss.stage === 'saucer';
}

export function obsidianShowName(boss: BossRuntime): boolean {
  return obsidianSaucerView(boss).showName;
}

/**
 * Replace the generic death. No explosion, no clear, no result. The score
 * was already paid by the part kill. Bullets in flight are left alone.
 */
export function obsidianBeginSaucer(boss: BossRuntime): void {
  shows.set(boss, { t: 0, fromX: boss.x, fromY: boss.y, booms: 0, cue: false });
  boss.stage = 'saucer';
  boss.phase = 'saucer';
  boss.phaseTime = 0;
  boss.invulnerable = true;
  boss.laser.mode = 'idle';
}

export function stepObsidianSaucer(boss: BossRuntime, dt: number, ev: BossEvents): void {
  const state = shows.get(boss);
  if (!state) return;
  state.t = Math.min(OBSIDIAN_SAUCER_TOTAL, state.t + Math.max(0, dt));
  const pose = obsidianWreckPose(state.t, state.fromX, state.fromY);
  boss.x = pose.x;
  boss.y = pose.y;

  const interval = OBSIDIAN_BREAK_SPAN / OBSIDIAN_BREAK_EXPLOSIONS;
  while (
    state.booms < OBSIDIAN_BREAK_EXPLOSIONS &&
    state.t + 1e-9 >= OBSIDIAN_BREAK_AT + state.booms * interval
  ) {
    const spot = BOOM_OFFSETS[state.booms % BOOM_OFFSETS.length] ?? [0, 0];
    ev.explosions.push({
      x: boss.x + spot[0],
      y: boss.y + spot[1],
      delay: 0,
      size: 'large',
    });
    state.booms++;
  }

  if (!state.cue && state.t >= OBSIDIAN_BREAK_AT) {
    state.cue = true;
    ev.cutscene = true;
    boss.hitFlash = OBSIDIAN_BEAM_FLASH;
  }

  if (state.t >= OBSIDIAN_SAUCER_TOTAL - 1e-9) {
    boss.stage = 'clear';
    boss.phase = 'clear';
    boss.phaseTime = 0;
    boss.invulnerable = true;
  }
  follow(boss);
}
