/**
 * Art module - code-generated pixel sprites
 * All sprites are rendered to offscreen canvases at boot
 */

export * from './types';
export * from './spriteRenderer';
export * from './playerSprite';
export * from './engineFlame';
export * from './enemySprite';
export * from './bulletSprite';
export * from './itemSprite';
export * from './explosionSprite';

import type { PlayerSpriteSheet } from './playerSprite';
import type { EnemyAssets } from './enemySprite';
import type { BulletAssets } from './bulletSprite';
import type { ItemAssets } from './itemSprite';
import type { ExplosionAssets } from './explosionSprite';

import { createPlayerSpriteSheet } from './playerSprite';
import { createEnemyAssets } from './enemySprite';
import { createBulletAssets } from './bulletSprite';
import { createItemAssets } from './itemSprite';
import { createExplosionAssets } from './explosionSprite';

/** All game sprite assets */
export interface GameAssets {
  player: PlayerSpriteSheet;
  enemies: EnemyAssets;
  bullets: BulletAssets;
  items: ItemAssets;
  explosions: ExplosionAssets;
}

/** Initialize all game assets (call once at boot) */
export function createGameAssets(): GameAssets {
  return {
    player: createPlayerSpriteSheet(),
    enemies: createEnemyAssets(),
    bullets: createBulletAssets(),
    items: createItemAssets(),
    explosions: createExplosionAssets(),
  };
}
