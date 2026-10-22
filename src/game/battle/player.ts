/**
 * The player ship: steering and bank animation, both weapon slots, pickups,
 * death and respawn, and extends.
 */

import type { InputState } from '@/engine/input';
import {
  BANK_DEADZONE,
  BANK_HYSTERESIS,
  BANK_IN_TIME,
  BANK_OUT_TIME,
  BOMBS_MAX,
  BOMBS_ON_RESPAWN,
  BOMBS_START,
  B_OVERFLOW_SCORE,
  EXTEND_EVERY,
  EXTEND_OVERFLOW_SCORE,
  EXTEND_REPEAT,
  LIVES_MAX,
  LIVES_START,
  LOGICAL_H,
  LOGICAL_W,
  PLAYER_MARGIN,
  PLAYER_SPAWN_Y,
  PLAYER_SPEED,
  RESPAWN_DELAY,
  RESPAWN_FLYIN_TIME,
  RESPAWN_INVINCIBLE_TIME,
  SHAKE_BIG_DURATION,
  SHAKE_BIG_INTENSITY,
} from '@/game/config';
import { getBankFrameIndex, PLAYER_DEATH_EXPLOSION } from '@/game/art';
import { ITEM_DEFS, type ItemType } from '@/game/entities/item';
import { isPlayerVulnerable as isVulnerable } from '@/game/systems/collision';
import {
  WEAPONS,
  applyDeathPenalty,
  applyWeaponPickup,
  resetLoadout,
  stepFireClock,
  weaponForItem,
  weaponLevel,
  type EquippedWeapon,
} from '@/game/systems/playerWeapons';
import { victoryExitBlocksInput } from '@/game/systems/victoryExit';
import {
  emitWithDamage,
  weaponTestVolleyDamage,
  weaponTestVolleyRate,
} from '@/game/scenes/weaponTest';
import { clearEnemyBullets, type Battle } from './context';
import { spawnExplosion, triggerShake } from './fx';

/** Player death burst: [dx, dy, delay] — staggered blasts around the wreck */
const DEATH_BURSTS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [-7, -5, 0.08],
  [6, 4, 0.14],
  [-4, 7, 0.22],
  [5, -8, 0.3],
];

/** Fresh run: full stock, Lv1 loadout, and the ship flying in from below. */
export function resetPlayer(b: Battle): void {
  const { player, state } = b;
  player.x = LOGICAL_W / 2;
  player.y = PLAYER_SPAWN_Y;
  player.prevX = player.x;
  player.prevY = player.y;
  player.bank = 0;
  player.targetBank = 0;
  player.lastBankFrame = 5;
  player.velocityY = 0;

  state.lives = LIVES_START;
  state.bombs = BOMBS_START;
  state.score = 0;
  resetLoadout(state);
  state.bombCooldown = 0;
  state.bombInvincible = 0;
  state.bombFlashTimer = 0;
  state.respawnTimer = 0;
  state.respawnInvincible = 0;
  state.isDead = false;
  state.isFlying = true;
  state.gameOver = false;
  state.deaths = 0;
  state.nextExtendScore = EXTEND_EVERY;
  player.y = LOGICAL_H + 40;
  player.prevY = player.y;
}

/** Seconds between volleys. The weapon-test range substitutes its live rate. */
export function volleyInterval(b: Battle, w: EquippedWeapon): number {
  const rate =
    weaponTestVolleyRate(b.rules().range, b.tune, w.id) ?? weaponLevel(w.id, w.level).rate;
  return 1 / rate;
}

/** One volley of the weapon in a slot. The title demo goes through here too. */
function fireVolley(b: Battle, weapon: EquippedWeapon): void {
  const level = weaponLevel(weapon.id, weapon.level);
  const damage = weaponTestVolleyDamage(b.rules().range, b.tune, weapon.id);
  const emit = damage === null ? b.emitter : emitWithDamage(b.emitter, damage);
  level.fire(b.player.x, b.player.y, emit);
  if (WEAPONS[weapon.id].slot === 'main') b.sfx('shoot');
}

export function isPlayerControllable(b: Battle): boolean {
  return !b.state.isDead && !b.state.isFlying && !victoryExitBlocksInput(b.victory.phase);
}

export function isPlayerVulnerable(b: Battle): boolean {
  return isVulnerable(b.state) && !victoryExitBlocksInput(b.victory.phase);
}

export function stepPlayerTimers(b: Battle, dt: number): void {
  const { state } = b;
  if (state.bombCooldown > 0) state.bombCooldown = Math.max(0, state.bombCooldown - dt);
  if (state.bombInvincible > 0) state.bombInvincible = Math.max(0, state.bombInvincible - dt);
  if (state.bombFlashTimer > 0) state.bombFlashTimer = Math.max(0, state.bombFlashTimer - dt);
  if (state.respawnInvincible > 0) {
    state.respawnInvincible = Math.max(0, state.respawnInvincible - dt);
  }
}

/** A from the held button, B as a one-frame edge. */
export function readButtons(b: Battle, input: InputState): void {
  const c = b.controls;
  c.fireHeld = input.buttonA;
  const bombInput = input.buttonB;
  c.bombPressed = bombInput && !c.lastBombInput;
  c.lastBombInput = bombInput;
}

export function killPlayer(b: Battle): void {
  if (!isPlayerVulnerable(b)) return;
  const { player, state } = b;

  state.isDead = true;
  state.lives--;
  state.deaths++;
  applyDeathPenalty(state);
  state.respawnTimer = RESPAWN_DELAY;

  state.isFlying = false;
  player.bank = 0;
  player.targetBank = 0;
  player.lastBankFrame = 5;
  player.velocityY = 0;

  // Breathing room for the next ship
  clearEnemyBullets(b);

  // The ship sprite stops drawing this frame; only the explosion remains
  for (const [dx, dy, delay] of DEATH_BURSTS) {
    spawnExplosion(b.fx, player.x + dx, player.y + dy, PLAYER_DEATH_EXPLOSION, delay);
  }
  triggerShake(b.fx, SHAKE_BIG_INTENSITY, SHAKE_BIG_DURATION);
  b.sfx('playerExplode');
}

/** Bring in a fresh ship from below the screen after the respawn delay */
export function spawnNewShip(b: Battle): void {
  const { player, state } = b;
  state.isDead = false;
  state.isFlying = true;
  state.bombs = BOMBS_ON_RESPAWN;
  state.respawnInvincible = RESPAWN_FLYIN_TIME + RESPAWN_INVINCIBLE_TIME;
  player.x = LOGICAL_W / 2;
  player.y = LOGICAL_H + 40;
  player.prevX = player.x;
  player.prevY = player.y;
}

/** Respawn fly-in: climb to the spawn line, then hand over control. */
export function stepFlyIn(b: Battle, dt: number): void {
  const { player, state } = b;
  player.y -= ((LOGICAL_H + 40 - PLAYER_SPAWN_Y) / RESPAWN_FLYIN_TIME) * dt;
  if (player.y <= PLAYER_SPAWN_Y) {
    player.y = PLAYER_SPAWN_Y;
    state.isFlying = false;
  }
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** Movement, banking, and both weapon slots while the ship is under control. */
export function steerPlayer(b: Battle, dt: number, input: InputState): void {
  const { player, state } = b;
  const speed = PLAYER_SPEED * input.joystickMagnitude;
  player.x += input.joystickX * speed * dt;
  player.y += input.joystickY * speed * dt;
  player.velocityY = input.joystickY * input.joystickMagnitude;

  player.x = Math.max(PLAYER_MARGIN, Math.min(LOGICAL_W - PLAYER_MARGIN, player.x));
  player.y = Math.max(PLAYER_MARGIN, Math.min(LOGICAL_H - PLAYER_MARGIN, player.y));

  player.targetBank = Math.abs(input.joystickX) < BANK_DEADZONE ? 0 : input.joystickX;
  const bankDiff = player.targetBank - player.bank;
  const isDeepening =
    Math.abs(player.targetBank) > Math.abs(player.bank) &&
    Math.sign(player.targetBank) === Math.sign(player.bank);
  const bankSpeed = isDeepening ? 1 / BANK_IN_TIME : 1 / BANK_OUT_TIME;
  const bankStep = bankSpeed * dt;

  if (Math.abs(bankDiff) < bankStep) {
    player.bank = player.targetBank;
  } else {
    player.bank += Math.sign(bankDiff) * bankStep;
  }

  // Bank frame with hysteresis
  const displayBank = easeOutQuad(Math.abs(player.bank)) * Math.sign(player.bank);
  let newBankFrame = getBankFrameIndex(displayBank);
  const frameDiff = Math.abs(newBankFrame - player.lastBankFrame);
  if (frameDiff > 0) {
    const threshold = 0.5 + BANK_HYSTERESIS * 5;
    const normalized = (displayBank + 1) / 2;
    const framePos = normalized * 10;
    if (Math.abs(framePos - newBankFrame) > threshold) {
      newBankFrame = player.lastBankFrame;
    }
  }
  player.lastBankFrame = newBankFrame;

  // Main and sub fire together while A is held, each on its own clock
  const held = b.controls.fireHeld;
  const main = state.main;
  b.guns.main = stepFireClock(b.guns.main, dt, volleyInterval(b, main), held, () =>
    fireVolley(b, main)
  );
  const sub = state.sub;
  if (sub) {
    b.guns.sub = stepFireClock(b.guns.sub, dt, volleyInterval(b, sub), held, () =>
      fireVolley(b, sub)
    );
  }
}

export function collectItem(b: Battle, type: ItemType): void {
  const { state } = b;
  if (ITEM_DEFS[type].effect === 'bomb') {
    if (state.bombs < BOMBS_MAX) state.bombs++;
    else state.score += B_OVERFLOW_SCORE;
    b.sfx('itemPickup');
    return;
  }
  const weapon = weaponForItem(type);
  if (!weapon) return;
  const result = applyWeaponPickup(state, weapon.id);
  if (result === 'overflow') {
    state.score += weapon.overflowScore;
    b.sfx('itemPickup');
  } else {
    b.sfx('powerUp');
  }
  if (weapon.slot === 'sub' && state.sub && (result === 'equip' || result === 'switch')) {
    b.guns.sub = volleyInterval(b, state.sub);
  }
}

export function checkExtend(b: Battle): void {
  const { state } = b;
  if (state.score < state.nextExtendScore) return;
  if (state.lives < LIVES_MAX) {
    state.lives++;
    b.sfx('extend');
  } else {
    state.score += EXTEND_OVERFLOW_SCORE;
  }
  state.nextExtendScore = EXTEND_REPEAT ? state.nextExtendScore + EXTEND_EVERY : Infinity;
}
