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
export * from './buildingSprite';
export * from './weaponFx';
export * from './gunBarrel';
export * from './riskCrateSprite';

import type { PlayerSpriteSheet } from './playerSprite';
import type { EnemyAssets } from './enemySprite';
import type { BuildingAssets } from './buildingSprite';
import type { BulletAssets } from './bulletSprite';
import type { ItemAssets } from './itemSprite';
import type { ExplosionAssets } from './explosionSprite';
import type { BackgroundArt } from './mapDraw';
import type { BossAssets } from './bossSprite';
import type { RiskCrateAssets } from './riskCrateSprite';

import { createPlayerSpriteSheet } from './playerSprite';
import { createEnemyAssets } from './enemySprite';
import { createBuildingAssets } from './buildingSprite';
import { createBulletAssets } from './bulletSprite';
import { createItemAssets } from './itemSprite';
import { createExplosionAssets } from './explosionSprite';
import { createBackgroundArt } from './mapDraw';
import { createBossAssets } from './bossSprite';
import { createRiskCrateAssets } from './riskCrateSprite';

export { drawBackground } from './mapDraw';
export { drawBossWorld, drawBossHpBar, drawBossLaser } from './bossSprite';

/** All game sprite assets */
export interface GameAssets {
  player: PlayerSpriteSheet;
  enemies: EnemyAssets;
  buildings: BuildingAssets;
  bullets: BulletAssets;
  items: ItemAssets;
  explosions: ExplosionAssets;
  background: BackgroundArt;
  bosses: Record<string, BossAssets>;
  crates: RiskCrateAssets;
}

/** Initialize all game assets (call once at boot) */
export function createGameAssets(): GameAssets {
  return {
    player: createPlayerSpriteSheet(),
    enemies: createEnemyAssets(),
    buildings: createBuildingAssets(),
    bullets: createBulletAssets(),
    items: createItemAssets(),
    explosions: createExplosionAssets(),
    background: createBackgroundArt(),
    bosses: createBossAssets(),
    crates: createRiskCrateAssets(),
  };
}
