/**
 * World-space drawing for the battle: background (or the range field),
 * buildings, items, enemies, boss, bullets, the ship, FX, and the bomb ring.
 * Per-type looks come from `ENEMY_DEFS` and `BUILDING_BARRELS`.
 */

import type { Renderer } from '@/engine/renderer';
import {
  BOMB_WAVE_TIME,
  HITBOX_ALPHA,
  HITBOX_RADIUS,
  INVINCIBLE_ALPHA_MAX,
  INVINCIBLE_ALPHA_MIN,
  INVINCIBLE_BLINK_FAST,
  INVINCIBLE_BLINK_INTERVAL,
  SHIELD_RING_COLOR,
  SHIELD_RING_PAD,
  SHIELD_RING_WIDTH,
  SHOW_HITBOX,
} from '@/game/config';
import {
  BUILDING_BARRELS,
  BULLET_GLOW_COLORS,
  drawBackground,
  drawBombShockwave,
  drawBossLaser,
  drawBossWorld,
  drawTiebaoMine,
  drawBulletGlow,
  drawEnemyFlame,
  drawFittedPlayerFlames,
  drawGunBarrel,
  drawHomingExhaust,
  drawPlayerFlames,
  explosionDrawKey,
  flooredSpriteCenter,
  type BankFrame,
  type GameAssets,
} from '@/game/art';
import { matePixels, matePlacements } from '@/game/systems/mate';
import { ENEMY_DEFS } from '@/game/entities/enemyDefs';
import {
  enemyTravelHeading,
  headingSpriteRotation,
  isGroundEnemy,
  type Enemy,
} from '@/game/entities/enemy';
import { isItemFlashing } from '@/game/entities/item';
import { bombWaveRadius } from '@/game/systems/bomb';
import { drawFlakMark, drawRadarPaint, drawTorpedoTrack } from '@/game/systems/seaStrike';
import { warningBulletAlpha } from '@/game/systems/background';
import type { Battle } from './context';
import { shakeOffset } from './fx';
import { carrierExhaustBoost } from './carrierTakeoff';
import { isPlayerVulnerable } from './player';
import { drawRangeField } from './range';

function lerp(prev: number, cur: number, alpha: number): number {
  return prev + (cur - prev) * alpha;
}

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  renderer: Renderer,
  assets: GameAssets,
  enemy: Enemy,
  alpha: number,
  time: number
): void {
  const ex = lerp(enemy.prevX, enemy.x, alpha);
  const ey = lerp(enemy.prevY, enemy.y, alpha);
  const def = ENEMY_DEFS[enemy.type];
  const sheet = assets.enemies.byType[enemy.type];
  const frame = enemy.hitFlashTimer > 0 ? sheet.hitFlash : sheet.idle;

  // Nose-down art rotated onto the travel heading. Flames stay on the tail.
  // Stage 1 never takes this branch, so its draw order stays the one below.
  const travel = enemyTravelHeading(enemy);
  if (travel !== null) {
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(headingSpriteRotation(travel));
    for (const nozzle of sheet.nozzles) {
      drawEnemyFlame(ctx, nozzle.x, nozzle.y, time);
    }
    renderer.drawImage(frame.canvas, -frame.anchorX, -frame.anchorY);
    ctx.restore();
  } else {
    for (const nozzle of sheet.nozzles) {
      drawEnemyFlame(ctx, ex + nozzle.x, ey + nozzle.y, time);
    }

    if (def.spin !== undefined) {
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(enemy.moveTimer * def.spin);
      ctx.drawImage(frame.canvas, -frame.anchorX, -frame.anchorY);
      ctx.restore();
    } else {
      renderer.drawImage(frame.canvas, ex - frame.anchorX, ey - frame.anchorY);
    }
  }

  if (def.barrel) drawGunBarrel(ctx, ex, ey, enemy.aimAngle, def.barrel === 'twin');

  drawRadarPaint(ctx, enemy);

  if (enemy.shield > 0) {
    renderer.strokeCircle(
      ex,
      ey,
      enemy.hitRadius + SHIELD_RING_PAD,
      SHIELD_RING_COLOR,
      SHIELD_RING_WIDTH
    );
  }
}

/** Same bank frame as the player, scaled, stuck to the player center. No hitbox. */
/** Shared exhaust. Null while the carrier launch is still on cold engines. */
function exhaustBoost(b: Battle): number | null {
  const launch = carrierExhaustBoost(b.takeoff);
  if (launch === null) return null;
  return Math.max(b.victory.flame, b.chaseBoost, launch);
}

function drawMates(
  renderer: Renderer,
  ctx: CanvasRenderingContext2D,
  b: Battle,
  frame: BankFrame,
  renderX: number,
  renderY: number,
  boost: number | null
): void {
  const places = matePlacements(b.state.mate);
  if (places.length === 0) return;
  const w = matePixels(frame.width);
  const h = matePixels(frame.height);
  const ax = matePixels(frame.anchorX);
  const ay = matePixels(frame.anchorY);
  for (const mate of places) {
    const x = renderX + mate.dx;
    const y = renderY + mate.dy;
    // drawImage floors the top-left. The flame has to use that same origin
    // or it drifts across the snapped ship while the player moves.
    const at = flooredSpriteCenter(x, y, ax, ay);
    if (boost !== null) {
      drawFittedPlayerFlames(
        ctx,
        at.x,
        at.y,
        frame,
        { width: w, height: h, anchorX: ax, anchorY: ay },
        b.player.velocityY,
        b.gameTime,
        boost
      );
    }
    renderer.drawImage(frame.canvas, x - ax, y - ay, w, h);
  }
}

function drawShip(renderer: Renderer, b: Battle, assets: GameAssets, alpha: number): void {
  const { player, state, gameTime } = b;
  const ctx = renderer.getContext();
  const renderX = lerp(player.prevX, player.x, alpha);
  const renderY = lerp(player.prevY, player.y, alpha);

  let playerAlpha = 1;
  if (state.respawnInvincible > 0) {
    const blinkInterval =
      state.respawnInvincible < 0.5 ? INVINCIBLE_BLINK_FAST : INVINCIBLE_BLINK_INTERVAL;
    const blinkPhase = Math.floor(gameTime / blinkInterval) % 2;
    playerAlpha = blinkPhase === 0 ? INVINCIBLE_ALPHA_MAX : INVINCIBLE_ALPHA_MIN;
  }

  const bankFrame = assets.player.bankFrames[player.lastBankFrame]!;
  const boost = exhaustBoost(b);
  ctx.globalAlpha = playerAlpha;
  drawMates(renderer, ctx, b, bankFrame, renderX, renderY, boost);
  if (boost !== null) {
    drawPlayerFlames(ctx, renderX, renderY, bankFrame.nozzles, player.velocityY, gameTime, boost);
  }
  renderer.drawImage(bankFrame.canvas, renderX - bankFrame.anchorX, renderY - bankFrame.anchorY);
  ctx.globalAlpha = 1;

  if (state.bombInvincible > 0) {
    renderer.strokeCircle(renderX, renderY, 20, 'rgba(0, 229, 255, 0.5)', 2);
  }

  // Hitbox: solid (not blinking) whenever the ship exists.
  // White = can be hit, cyan = shown but currently immune.
  if (SHOW_HITBOX) {
    const immune = !isPlayerVulnerable(b);
    const fill = immune ? 'rgba(0, 229, 255, 0.35)' : `rgba(255, 255, 255, ${HITBOX_ALPHA})`;
    const ring = immune ? 'rgba(0, 229, 255, 0.9)' : 'rgba(255, 255, 255, 0.9)';
    renderer.fillCircle(renderX, renderY, HITBOX_RADIUS, fill);
    renderer.strokeCircle(renderX, renderY, HITBOX_RADIUS + 1, ring, 1);
  }
}

/** Everything under the HUD, inside the shake transform. */
export function drawField(renderer: Renderer, b: Battle, assets: GameAssets, alpha: number): void {
  const { gameTime, scrollFrame, stage, boss } = b;
  renderer.clear('#070b14');

  const ctx = renderer.getContext();
  const shake = shakeOffset(b.fx, gameTime);
  ctx.save();
  if (shake.x !== 0 || shake.y !== 0) ctx.translate(shake.x, shake.y);
  if (b.rules().range) drawRangeField(ctx);
  else drawBackground(ctx, assets.background, b.track, scrollFrame, gameTime);

  // Buildings sit on the tiles: no interpolation, so they never slip off the grid
  b.buildings.forEach((building) => {
    const sheet = assets.buildings.byType[building.type];
    const frame = building.wrecked
      ? sheet.wreck
      : building.hitFlashTimer > 0
        ? sheet.hitFlash
        : sheet.idle;
    ctx.globalAlpha = scrollFrame.fade.layers[building.layer] ?? 0;
    renderer.drawImage(frame.canvas, building.x - frame.anchorX, building.y - frame.anchorY);
    const barrel = BUILDING_BARRELS[building.type];
    if (barrel && !building.wrecked) {
      drawGunBarrel(
        ctx,
        building.x + barrel.pivot.x,
        building.y + barrel.pivot.y,
        building.aimAngle,
        barrel.style === 'twin'
      );
    }
  });
  b.wreckFloats.forEach((floater) => {
    const sheet = assets.wreckFloat;
    const frame = floater.hitFlashTimer > 0 ? sheet.hitFlash : sheet.idle;
    ctx.globalAlpha = scrollFrame.fade.layers[floater.layer] ?? 0;
    renderer.drawImage(frame.canvas, floater.x - frame.anchorX, floater.y - frame.anchorY);
  });
  ctx.globalAlpha = 1;
  b.torpedoes.forEach((track) => drawTorpedoTrack(ctx, track));
  b.flakMarks.forEach((mark) => drawFlakMark(ctx, mark));

  b.items.forEach((item) => {
    const ix = lerp(item.prevX, item.x, alpha);
    const iy = lerp(item.prevY, item.y, alpha);
    const sprite = assets.items.byType[item.type];
    const frame = isItemFlashing(item) ? sprite.flash : sprite.idle;
    renderer.drawImage(frame.canvas, ix - frame.anchorX, iy - frame.anchorY);
  });

  // Ground units first so aircraft draw over the road
  b.enemies.forEach((enemy) => {
    if (isGroundEnemy(enemy.type)) drawEnemy(ctx, renderer, assets, enemy, alpha, gameTime);
  });
  b.enemies.forEach((enemy) => {
    if (!isGroundEnemy(enemy.type)) drawEnemy(ctx, renderer, assets, enemy, alpha, gameTime);
  });

  if (boss && assets.bosses) drawBossWorld(ctx, renderer, boss, assets.bosses, gameTime);

  const warningWindow = gameTime >= stage.warningAt && gameTime < stage.boss.enterAt;
  ctx.globalAlpha = warningWindow ? warningBulletAlpha(gameTime, stage.warningAt) : 1;
  b.enemyBullets.forEach((bullet) => {
    const bx = lerp(bullet.prevX, bullet.x, alpha);
    const by = lerp(bullet.prevY, bullet.y, alpha);
    if (bullet.type === 'missile') {
      const frame = assets.bullets.missile;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(Math.atan2(bullet.vy, bullet.vx) + Math.PI / 2);
      ctx.drawImage(frame.canvas, -frame.anchorX, -frame.anchorY);
      ctx.restore();
      return;
    }
    if (bullet.burstSpeed > 0) {
      drawBulletGlow(ctx, bx, by, 12, BULLET_GLOW_COLORS.enemy);
      drawTiebaoMine(ctx, bx, by, bullet.fuse);
      return;
    }
    const large = bullet.type === 'large';
    drawBulletGlow(ctx, bx, by, large ? 12 : 8, BULLET_GLOW_COLORS.enemy);
    const frame = large ? assets.bullets.enemyBulletLarge : assets.bullets.enemyBulletSmall;
    renderer.drawImage(frame.canvas, bx - frame.anchorX, by - frame.anchorY);
  });
  ctx.globalAlpha = 1;

  if (boss) drawBossLaser(ctx, boss, gameTime);

  b.bullets.forEach((bullet) => {
    const bx = lerp(bullet.prevX, bullet.x, alpha);
    const by = lerp(bullet.prevY, bullet.y, alpha);
    drawBulletGlow(ctx, bx, by, 8, BULLET_GLOW_COLORS.player);
    const frame = assets.bullets.playerBullet;
    renderer.drawImage(frame.canvas, bx - frame.anchorX, by - frame.anchorY);
  });

  b.missiles.forEach((m) => {
    const mx = lerp(m.prevX, m.x, alpha);
    const my = lerp(m.prevY, m.y, alpha);
    drawHomingExhaust(
      ctx,
      mx,
      my,
      m.angle,
      m.trailX,
      m.trailY,
      m.trailHead,
      m.trailCount,
      gameTime
    );
    const frame = assets.bullets.homingMissile;
    ctx.save();
    ctx.translate(Math.round(mx), Math.round(my));
    ctx.rotate(m.angle + Math.PI / 2);
    ctx.drawImage(frame.canvas, -frame.anchorX, -frame.anchorY);
    ctx.restore();
  });

  // Never while dead, so no wreck lingers at the death point
  if (!b.state.isDead) drawShip(renderer, b, assets, alpha);

  // Hit sparks, then the size-matched explosion frames (native pixels, no scale-up).
  const sparks = assets.explosions?.hitSpark;
  if (sparks) {
    b.fx.sparks.forEach((spark) => {
      if (spark.frame >= sparks.length) return;
      const frame = sparks[spark.frame]!;
      renderer.drawImage(frame.canvas, spark.x - frame.anchorX, spark.y - frame.anchorY);
    });
  }
  b.fx.explosions.forEach((exp) => {
    const frames = assets.explosions?.[explosionDrawKey(exp.kind)];
    if (exp.delay > 0 || !frames || exp.frame >= frames.length) return;
    const frame = frames[exp.frame]!;
    renderer.drawImage(frame.canvas, exp.x - frame.anchorX, exp.y - frame.anchorY);
  });

  const wave = b.bombWave;
  if (wave.active) {
    const u = wave.t / BOMB_WAVE_TIME;
    const fade = u < 0.7 ? 1 : Math.max(0, (1 - u) / 0.3);
    drawBombShockwave(ctx, wave.x, wave.y, bombWaveRadius(wave.x, wave.y, wave.t), fade);
  }

  ctx.restore();
}
