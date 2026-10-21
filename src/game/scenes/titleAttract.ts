/**
 * Approach B — coin-op attract mode behind the title chrome.
 * Drives the real stage-1 scheduler, sprites, and bullets with a scripted ship.
 * Local only: no bombs, no lives lost, no score storage, no SFX.
 */

import type { Renderer } from '@/engine/renderer';
import { ObjectPool } from '@/engine/pool';
import {
  ATTRACT_LOOP_SECONDS,
  BANK_DEADZONE,
  BANK_IN_TIME,
  BANK_OUT_TIME,
  ENEMY_BULLET_CAP,
  FIRE_RATE,
  LOGICAL_H,
  LOGICAL_W,
  LV2_GAP,
  LV3_SPREAD_DEG,
  PLAYER_BULLET_DAMAGE,
  PLAYER_BULLET_SPEED,
  PLAYER_MARGIN,
  PLAYER_SPAWN_Y,
  PLAYER_SPEED,
  POWER_MAX,
} from '@/game/config';
import { PALETTE, COLOR } from '@/game/palette';
import { stage1 } from '@/game/levels/stage1';
import {
  BULLET_GLOW_COLORS,
  drawBulletGlow,
  drawEnemyFlame,
  drawPlayerFlames,
  getBankFrameIndex,
  terrainBlocksTank,
} from '@/game/art';
import { drawBackground } from '@/game/art/tiles';
import type { GameAssets } from '@/game/art';
import { sharedGameAssets } from '@/game/art/sharedAssets';
import { createBullet, type Bullet } from '@/game/entities/bullet';
import {
  createEnemy,
  damageEnemy,
  isGroundEnemy,
  spawnEnemy,
  updateEnemy,
  type Enemy,
} from '@/game/entities/enemy';
import {
  createEnemyBullet,
  spawnEnemyBullet,
  updateEnemyBullet,
  type BulletSpawner,
  type EnemyBullet,
} from '@/game/entities/enemyBullet';
import { createItem, isItemFlashing, spawnItem, updateItem, type Item } from '@/game/entities/item';
import { checkBulletEnemyCollision, checkItemPickup } from '@/game/systems/collision';
import { backgroundFade, Scroller, type ScrollFrame } from '@/game/systems/background';
import { updateEnemyWeapons } from '@/game/systems/weapons';
import { WaveScheduler } from '@/game/systems/waveScheduler';
import type { Poolable } from '@/engine/pool';

interface Boom extends Poolable {
  x: number;
  y: number;
  frame: number;
  timer: number;
  delay: number;
  reset(): void;
}

function createBoom(): Boom {
  return {
    active: false,
    x: 0,
    y: 0,
    frame: 0,
    timer: 0,
    delay: 0,
    reset() {
      this.x = 0;
      this.y = 0;
      this.frame = 0;
      this.timer = 0;
      this.delay = 0;
    },
  };
}

export interface AttractStats {
  time: number;
  spawned: number;
  bullets: number;
  enemies: number;
  /** Always 0 — the demo never spends a bomb. */
  bombsUsed: number;
  /** Always 0 — the scripted ship is not killed. */
  livesLost: number;
}

const DEMO_POWER = 2;
const BOOM_FRAME_TIME = 0.06;
const BOOM_FRAMES = 4;

export interface TitleAttract {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  update(dt: number): void;
  render(renderer: Renderer, alpha: number): void;
  stats(): AttractStats;
}

export function createTitleAttract(): TitleAttract {
  const enemyPool = new ObjectPool(createEnemy, 32);
  const bulletPool = new ObjectPool(createBullet, 48);
  const enemyBulletPool = new ObjectPool(createEnemyBullet, 80);
  const itemPool = new ObjectPool(createItem, 8);
  const boomPool = new ObjectPool(createBoom, 16);
  const scheduler = new WaveScheduler({ mvpOnly: false });
  const scroller = new Scroller();

  let running = false;
  let assets: GameAssets | null = null;
  let gameTime = 0;
  let spawned = 0;
  let power = DEMO_POWER;
  let shotTimer = 0;
  let bank = 0;
  let lastBankFrame = 5;
  let velocityY = 0;
  const player = {
    x: LOGICAL_W / 2,
    y: PLAYER_SPAWN_Y,
    prevX: LOGICAL_W / 2,
    prevY: PLAYER_SPAWN_Y,
  };

  let scrollFrame: ScrollFrame = {
    scroll: 0,
    tileDelta: 0,
    fade: backgroundFade(0, stage1.warningAt),
    starScroll: [0, 0, 0],
  };

  const bulletSpawner: BulletSpawner = {
    spawnBullet(x, y, vx, vy, type, homing = 0) {
      if (enemyBulletPool.getActiveCount() >= ENEMY_BULLET_CAP) return;
      const bullet = enemyBulletPool.acquire();
      spawnEnemyBullet(bullet, x, y, vx, vy, type, homing);
    },
    getBulletCount: () => enemyBulletPool.getActiveCount(),
  };

  function resetWorld(): void {
    gameTime = 0;
    spawned = 0;
    power = DEMO_POWER;
    shotTimer = 0;
    bank = 0;
    lastBankFrame = 5;
    velocityY = 0;
    player.x = LOGICAL_W / 2;
    player.y = PLAYER_SPAWN_Y;
    player.prevX = player.x;
    player.prevY = player.y;
    enemyPool.releaseAll();
    bulletPool.releaseAll();
    enemyBulletPool.releaseAll();
    itemPool.releaseAll();
    boomPool.releaseAll();
    scheduler.reset();
    scheduler.setPowerLevel(power);
    scroller.reset();
    scrollFrame = {
      scroll: 0,
      tileDelta: 0,
      fade: backgroundFade(0, stage1.warningAt),
      starScroll: [0, 0, 0],
    };
  }

  function fire(): void {
    const bulletY = player.y - 16;
    const shoot = (x: number, vx?: number, vy?: number): void => {
      const bullet = bulletPool.acquire();
      bullet.x = x;
      bullet.y = bulletY;
      bullet.prevX = x;
      bullet.prevY = bulletY;
      if (vx !== undefined && vy !== undefined) {
        bullet.vx = vx;
        bullet.vy = vy;
      }
    };
    if (power <= 1) {
      shoot(player.x);
      return;
    }
    if (power === 2) {
      const gap = LV2_GAP / 2;
      shoot(player.x - gap);
      shoot(player.x + gap);
      return;
    }
    const angle = (LV3_SPREAD_DEG * Math.PI) / 180;
    shoot(player.x);
    shoot(
      player.x - 4,
      -Math.sin(angle) * PLAYER_BULLET_SPEED,
      -Math.cos(angle) * PLAYER_BULLET_SPEED
    );
    shoot(
      player.x + 4,
      Math.sin(angle) * PLAYER_BULLET_SPEED,
      -Math.cos(angle) * PLAYER_BULLET_SPEED
    );
  }

  function steer(): { jx: number; jy: number; mag: number } {
    let aimX = LOGICAL_W / 2 + Math.sin(gameTime * 0.9) * 110;
    const aimY = 518 + Math.sin(gameTime * 0.55) * 26;
    let best = 100;
    enemyPool.forEach((enemy) => {
      if (isGroundEnemy(enemy.type)) return;
      if (enemy.y < 28 || enemy.y > player.y - 36) return;
      const d = Math.abs(enemy.x - player.x);
      if (d < best) {
        best = d;
        aimX = enemy.x;
      }
    });
    const dx = aimX - player.x;
    const dy = aimY - player.y;
    const dist = Math.hypot(dx, dy) || 1;
    const mag = Math.min(1, dist / 56);
    return { jx: dx / dist, jy: dy / dist, mag };
  }

  function movePlayer(dt: number): void {
    const { jx, jy, mag } = steer();
    player.prevX = player.x;
    player.prevY = player.y;
    player.x += jx * PLAYER_SPEED * mag * dt;
    player.y += jy * PLAYER_SPEED * mag * dt;
    player.x = Math.max(PLAYER_MARGIN, Math.min(LOGICAL_W - PLAYER_MARGIN, player.x));
    player.y = Math.max(PLAYER_MARGIN, Math.min(LOGICAL_H - PLAYER_MARGIN, player.y));
    velocityY = jy * mag;

    const steerX = jx * mag;
    const target = Math.abs(steerX) < BANK_DEADZONE ? 0 : steerX;
    const deepening = Math.abs(target) > Math.abs(bank) && Math.sign(target) === Math.sign(bank);
    const bankSpeed = (deepening ? 1 / BANK_IN_TIME : 1 / BANK_OUT_TIME) * dt;
    if (Math.abs(target - bank) <= bankSpeed) bank = target;
    else bank += Math.sign(target - bank) * bankSpeed;
    lastBankFrame = getBankFrameIndex(bank);

    shotTimer += dt;
    const interval = 1 / FIRE_RATE;
    if (shotTimer >= interval) {
      shotTimer -= interval;
      fire();
    }
  }

  function spawnBoom(x: number, y: number, delay = 0): void {
    const boom = boomPool.acquire();
    boom.x = x;
    boom.y = y;
    boom.frame = 0;
    boom.timer = 0;
    boom.delay = delay;
  }

  return {
    start(): void {
      assets = sharedGameAssets();
      resetWorld();
      running = true;
    },

    stop(): void {
      running = false;
      enemyPool.releaseAll();
      bulletPool.releaseAll();
      enemyBulletPool.releaseAll();
      itemPool.releaseAll();
      boomPool.releaseAll();
    },

    isRunning: () => running,

    update(dt: number): void {
      if (!running) return;
      gameTime += dt;
      if (gameTime >= ATTRACT_LOOP_SECONDS) {
        resetWorld();
        return;
      }

      movePlayer(dt);
      scrollFrame = scroller.update(dt, gameTime, stage1.warningAt);
      scheduler.setPowerLevel(power);

      for (const spawn of scheduler.update(dt)) {
        spawned++;
        const enemy = enemyPool.acquire();
        spawnEnemy(
          enemy,
          spawn.type,
          spawn.x,
          spawn.y,
          spawn.move,
          spawn.canFire ? spawn.fire : { kind: 'none' },
          spawn.drop,
          spawn.hp,
          spawn.score
        );
      }

      const grids = assets?.background.grids;
      const terrain = grids
        ? {
            blocksTank: (x: number, y: number) =>
              terrainBlocksTank(grids, scrollFrame.scroll, scrollFrame.fade, x, y),
          }
        : undefined;

      const enemiesToRelease: Enemy[] = [];
      enemyPool.forEach((enemy) => {
        if (updateEnemy(enemy, dt, player.x, player.y, scrollFrame.tileDelta, terrain)) {
          enemiesToRelease.push(enemy);
        } else {
          updateEnemyWeapons(enemy, dt, player.x, player.y, bulletSpawner, true);
        }
      });
      enemiesToRelease.forEach((enemy) => enemyPool.release(enemy));

      const bulletsToRelease: Bullet[] = [];
      bulletPool.forEach((bullet) => {
        bullet.prevX = bullet.x;
        bullet.prevY = bullet.y;
        if (bullet.vx !== undefined && bullet.vy !== undefined) {
          bullet.x += bullet.vx * dt;
          bullet.y += bullet.vy * dt;
        } else {
          bullet.y -= PLAYER_BULLET_SPEED * dt;
        }
        if (bullet.y < -20 || bullet.x < -20 || bullet.x > LOGICAL_W + 20) {
          bulletsToRelease.push(bullet);
        }
      });
      bulletsToRelease.forEach((bullet) => bulletPool.release(bullet));

      const enemyBulletsToRelease: EnemyBullet[] = [];
      enemyBulletPool.forEach((bullet) => {
        if (updateEnemyBullet(bullet, dt, { x: player.x, y: player.y })) {
          enemyBulletsToRelease.push(bullet);
        }
      });
      enemyBulletsToRelease.forEach((bullet) => enemyBulletPool.release(bullet));

      const itemsToRelease: Item[] = [];
      itemPool.forEach((item) => {
        if (updateItem(item, dt)) itemsToRelease.push(item);
      });
      itemsToRelease.forEach((item) => itemPool.release(item));

      boomPool.forEach((boom) => {
        if (boom.delay > 0) {
          boom.delay -= dt;
          return;
        }
        boom.timer += dt;
        if (boom.timer >= BOOM_FRAME_TIME) {
          boom.timer -= BOOM_FRAME_TIME;
          boom.frame++;
          if (boom.frame >= BOOM_FRAMES) boomPool.release(boom);
        }
      });

      bulletPool.forEach((bullet) => {
        if (!bullet.active) return;
        enemyPool.forEach((enemy) => {
          if (!bullet.active || !enemy.active) return;
          if (
            !checkBulletEnemyCollision(
              bullet.x,
              bullet.y,
              bullet.width,
              bullet.height,
              enemy.x,
              enemy.y,
              enemy.hitRadius
            )
          ) {
            return;
          }
          const killed = damageEnemy(enemy, PLAYER_BULLET_DAMAGE);
          bulletPool.release(bullet);
          if (!killed) return;
          spawnBoom(enemy.x, enemy.y);
          if (enemy.drop) {
            const item = itemPool.acquire();
            spawnItem(item, enemy.drop, enemy.x, enemy.y);
          }
          enemyPool.release(enemy);
          scheduler.recordKill();
        });
      });

      itemPool.forEach((item) => {
        if (!checkItemPickup(player.x, player.y, item.x, item.y)) return;
        if (item.type === 'P' && power < POWER_MAX) power++;
        itemPool.release(item);
      });
    },

    render(renderer: Renderer, alpha: number): void {
      renderer.clear('#070b14');
      const ctx = renderer.getContext();
      const art = assets ?? sharedGameAssets();
      if (!art) return;
      assets = art;

      drawBackground(ctx, art.background, scrollFrame, gameTime);

      const drawOne = (enemy: Enemy): void => {
        const ex = enemy.prevX + (enemy.x - enemy.prevX) * alpha;
        const ey = enemy.prevY + (enemy.y - enemy.prevY) * alpha;
        const sheet = art.enemies.byType[enemy.type];
        const frame = enemy.hitFlashTimer > 0 ? sheet.hitFlash : sheet.idle;
        for (const nozzle of sheet.nozzles) {
          drawEnemyFlame(ctx, ex + nozzle.x, ey + nozzle.y, gameTime);
        }
        if (enemy.type === 'drone') {
          ctx.save();
          ctx.translate(ex, ey);
          ctx.rotate(enemy.moveTimer * 2.4);
          ctx.drawImage(frame.canvas, -frame.anchorX, -frame.anchorY);
          ctx.restore();
        } else {
          renderer.drawImage(frame.canvas, ex - frame.anchorX, ey - frame.anchorY);
        }
        if (enemy.type === 'tank' || enemy.type === 'turret2') {
          drawGunBarrel(ctx, ex, ey, enemy);
        }
      };
      enemyPool.forEach((enemy) => {
        if (isGroundEnemy(enemy.type)) drawOne(enemy);
      });
      enemyPool.forEach((enemy) => {
        if (!isGroundEnemy(enemy.type)) drawOne(enemy);
      });

      enemyBulletPool.forEach((bullet) => {
        const bx = bullet.prevX + (bullet.x - bullet.prevX) * alpha;
        const by = bullet.prevY + (bullet.y - bullet.prevY) * alpha;
        if (bullet.type === 'missile') {
          const frame = art.bullets.missile;
          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(Math.atan2(bullet.vy, bullet.vx) + Math.PI / 2);
          ctx.drawImage(frame.canvas, -frame.anchorX, -frame.anchorY);
          ctx.restore();
          return;
        }
        drawBulletGlow(ctx, bx, by, bullet.type === 'large' ? 12 : 8, BULLET_GLOW_COLORS.enemy);
        const frame =
          bullet.type === 'large' ? art.bullets.enemyBulletLarge : art.bullets.enemyBulletSmall;
        renderer.drawImage(frame.canvas, bx - frame.anchorX, by - frame.anchorY);
      });

      bulletPool.forEach((bullet) => {
        const bx = bullet.prevX + (bullet.x - bullet.prevX) * alpha;
        const by = bullet.prevY + (bullet.y - bullet.prevY) * alpha;
        drawBulletGlow(ctx, bx, by, 8, BULLET_GLOW_COLORS.player);
        const frame = art.bullets.playerBullet;
        renderer.drawImage(frame.canvas, bx - frame.anchorX, by - frame.anchorY);
      });

      itemPool.forEach((item) => {
        const ix = item.prevX + (item.x - item.prevX) * alpha;
        const iy = item.prevY + (item.y - item.prevY) * alpha;
        const frame = isItemFlashing(item)
          ? item.type === 'P'
            ? art.items.powerUpFlash
            : art.items.bombFlash
          : item.type === 'P'
            ? art.items.powerUp
            : art.items.bomb;
        renderer.drawImage(frame.canvas, ix - frame.anchorX, iy - frame.anchorY);
      });

      const renderX = player.prevX + (player.x - player.prevX) * alpha;
      const renderY = player.prevY + (player.y - player.prevY) * alpha;
      const bankFrame = art.player.bankFrames[lastBankFrame] ?? art.player.bankFrames[5]!;
      ctx.save();
      ctx.fillStyle = 'rgba(0, 229, 255, 0.22)';
      ctx.beginPath();
      ctx.arc(renderX, renderY, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawPlayerFlames(ctx, renderX, renderY, bankFrame.nozzles, velocityY, gameTime);
      renderer.drawImage(
        bankFrame.canvas,
        renderX - bankFrame.anchorX,
        renderY - bankFrame.anchorY
      );

      for (const boom of boomPool.filter(() => true)) {
        if (!boom.active || boom.delay > 0) continue;
        const frames = art.explosions.smallExplosion;
        const frame = frames[boom.frame];
        if (!frame) continue;
        renderer.drawImage(frame.canvas, boom.x - frame.anchorX, boom.y - frame.anchorY);
      }
      ctx.globalAlpha = 1;
    },

    stats(): AttractStats {
      return {
        time: gameTime,
        spawned,
        bullets: bulletPool.getActiveCount(),
        enemies: enemyPool.getActiveCount(),
        bombsUsed: 0,
        livesLost: 0,
      };
    },
  };
}

function drawGunBarrel(ctx: CanvasRenderingContext2D, x: number, y: number, enemy: Enemy): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(enemy.aimAngle);
  if (enemy.type === 'turret2') {
    ctx.fillStyle = PALETTE[COLOR.BLACK];
    ctx.fillRect(2, -6, 16, 4);
    ctx.fillRect(2, 2, 16, 4);
    ctx.fillStyle = PALETTE[COLOR.DARK_GRAY];
    ctx.fillRect(3, -5, 13, 2);
    ctx.fillRect(3, 3, 13, 2);
  } else {
    ctx.fillStyle = PALETTE[COLOR.BLACK];
    ctx.fillRect(2, -2, 14, 4);
    ctx.fillStyle = PALETTE[COLOR.GROUND_DARK_OLIVE];
    ctx.fillRect(3, -1, 11, 2);
    ctx.fillStyle = PALETTE[COLOR.GROUND_TAN];
    ctx.fillRect(13, -2, 3, 4);
  }
  ctx.restore();
}
