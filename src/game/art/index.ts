/**
 * Art module - code-generated pixel sprites
 * All sprites are rendered to offscreen canvases at boot
 */

export * from './types';
export * from './spriteRenderer';
export * from './playerSprite';
export * from './shipSprites';
export * from './engineFlame';
export * from './enemySprite';
export * from './bulletSprite';
export * from './itemSprite';
export * from './explosionSprite';
export * from './buildingSprite';
export * from './wreckFloatSprite';
export * from './weaponFx';
export * from './gunBarrel';

import type { PlayerSpriteSheet } from './playerSprite';
import type { EnemyAssets } from './enemySprite';
import type { BuildingAssets } from './buildingSprite';
import type { BulletAssets } from './bulletSprite';
import type { ItemAssets } from './itemSprite';
import type { ExplosionAssets } from './explosionSprite';
import type { WreckFloatArt } from './wreckFloatSprite';
import type { BackgroundArt } from './mapDraw';
import type { BossAssets } from './bossSprite';

import { createPlayerSpriteSheet } from './playerSprite';
import { createLockedShipSheets } from './shipSprites';
import { createEnemyAssets } from './enemySprite';
import { createBuildingAssets } from './buildingSprite';
import { createBulletAssets } from './bulletSprite';
import { createItemAssets } from './itemSprite';
import { createExplosionAssets } from './explosionSprite';
import { createWreckFloatArt } from './wreckFloatSprite';
import { createBackgroundArt } from './mapDraw';
import { createBossAssets } from './bossSprite';

export { drawBackground } from './mapDraw';
export { drawBossWorld, drawBossHpBar, drawBossLaser, drawTiebaoMine } from './bossSprite';

/** All game sprite assets */
export interface GameAssets {
  /** Eagle sheet. Render replays and attract keep reading this field. */
  player: PlayerSpriteSheet;
  /**
   * Mandy and Jason, baked from the G2 lock. Omitted on stubs.
   * Eagle's own draw reads `player`, not this map.
   */
  ships?: { mandy: PlayerSpriteSheet; jason: PlayerSpriteSheet };
  enemies: EnemyAssets;
  buildings: BuildingAssets;
  bullets: BulletAssets;
  items: ItemAssets;
  explosions: ExplosionAssets;
  wreckFloat: WreckFloatArt;
  background: BackgroundArt;
  bosses: Record<string, BossAssets>;
}

/** Initialize all game assets (call once at boot) */
export function createGameAssets(): GameAssets {
  const player = createPlayerSpriteSheet();
  return {
    player,
    ships: createLockedShipSheets(),
    enemies: createEnemyAssets(),
    buildings: createBuildingAssets(),
    bullets: createBulletAssets(),
    items: createItemAssets(),
    explosions: createExplosionAssets(),
    wreckFloat: createWreckFloatArt(),
    background: createBackgroundArt(),
    bosses: createBossAssets(),
  };
}
