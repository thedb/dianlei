/**
 * Five factory interiors for 铁堡厂轨. Yoan picks one.
 * The live map uses `FACTORY_LOOK` in config (temporary default A).
 * Names: A 铁皮高窗, B 警示桁架, C 夜班灯带, D 弹药库, E 冷却管廊.
 * Rail steel stays on the pixel that lands at screen X 72 / 180 / 288.
 */

import { COLOR } from '@/game/palette';
import { createGrid, fillRect, plot } from './pixelDraw';
import type { SpriteData } from './types';

export const FACTORY_LOOK_IDS = ['A', 'B', 'C', 'D', 'E'] as const;
export type FactoryLookId = (typeof FACTORY_LOOK_IDS)[number];

export const FACTORY_LOOK_NAMES: Readonly<Record<FactoryLookId, string>> = {
  A: '铁皮高窗',
  B: '警示桁架',
  C: '夜班灯带',
  D: '弹药库',
  E: '冷却管廊',
};

/** How the hall is dressed. Seam rows use `clerestory` only, so the loop joins. */
export interface FactoryLayout {
  clerestory: readonly number[];
  beamEvery: number;
  bays: readonly number[];
  bayEvery: number;
}

export const FACTORY_LAYOUT: Readonly<Record<FactoryLookId, FactoryLayout>> = {
  A: { clerestory: [2, 20], beamEvery: 8, bays: [], bayEvery: 1 },
  B: { clerestory: [], beamEvery: 5, bays: [3, 19], bayEvery: 2 },
  C: { clerestory: [2, 20], beamEvery: 6, bays: [6, 16], bayEvery: 3 },
  D: { clerestory: [], beamEvery: 4, bays: [3, 6, 16, 19], bayEvery: 2 },
  E: { clerestory: [2, 20], beamEvery: 7, bays: [7, 15], bayEvery: 4 },
};

export interface FactoryTiles {
  floor: SpriteData;
  wall: SpriteData;
  window: SpriteData;
  railW: SpriteData;
  railC: SpriteData;
  railE: SpriteData;
}

function railTile(
  stripe: number,
  bed: number,
  tie: number,
  steel: number,
  shine: number
): SpriteData {
  const g = createGrid(16, 16, bed);
  for (let y = 0; y < 16; y++) {
    if (y % 4 === 0) fillRect(g, 0, y, 16, 2, tie);
    plot(g, stripe - 2, y, steel);
    plot(g, stripe - 1, y, COLOR.BLACK);
    plot(g, stripe, y, shine);
    plot(g, stripe + 1, y, steel);
  }
  return g;
}

function plates(base: number, line: number, stud: number): SpriteData {
  const g = createGrid(16, 16, base);
  for (let i = 0; i < 16; i++) {
    plot(g, i, 15, line);
    plot(g, 15, i, line);
  }
  for (const [x, y] of [
    [3, 3],
    [11, 3],
    [3, 11],
    [11, 11],
  ] as const) {
    plot(g, x, y, stud);
  }
  return g;
}

function lookA(): FactoryTiles {
  const floor = plates(COLOR.MEDIUM_GRAY, COLOR.DARK_GRAY, COLOR.LIGHT_GRAY);
  const wall = createGrid(16, 16, COLOR.DARK_GRAY);
  for (let y = 0; y < 16; y++) {
    plot(wall, 0, y, COLOR.BLACK);
    plot(wall, 15, y, COLOR.GRAY);
    if (y % 4 === 1) {
      plot(wall, 4, y, COLOR.GRAY);
      plot(wall, 11, y, COLOR.GRAY);
    }
  }
  fillRect(wall, 0, 15, 16, 1, COLOR.BLACK);
  const windowTile = createGrid(16, 16, COLOR.SHADOW);
  fillRect(windowTile, 1, 0, 14, 16, COLOR.WATER_DEEP);
  fillRect(windowTile, 2, 1, 5, 6, COLOR.WATER_MEDIUM);
  fillRect(windowTile, 9, 1, 5, 6, COLOR.WATER_SHALLOW);
  fillRect(windowTile, 2, 9, 5, 6, COLOR.WATER_OCEAN);
  fillRect(windowTile, 9, 9, 5, 6, COLOR.WATER_MEDIUM);
  fillRect(windowTile, 7, 0, 2, 16, COLOR.BLACK);
  fillRect(windowTile, 0, 7, 16, 2, COLOR.BLACK);
  plot(windowTile, 3, 2, COLOR.PALE_GRAY);
  return {
    floor,
    wall,
    window: windowTile,
    railW: railTile(12, COLOR.DARK_GRAY, COLOR.TERRAIN_CONCRETE, COLOR.GRAY, COLOR.PALE_GRAY),
    railC: railTile(8, COLOR.DARK_GRAY, COLOR.TERRAIN_CONCRETE, COLOR.GRAY, COLOR.PALE_GRAY),
    railE: railTile(4, COLOR.DARK_GRAY, COLOR.TERRAIN_CONCRETE, COLOR.GRAY, COLOR.PALE_GRAY),
  };
}

function lookB(): FactoryTiles {
  const floor = plates(COLOR.TERRAIN_ASPHALT, COLOR.BLACK, COLOR.EXPLOSION_YELLOW);
  const wall = createGrid(16, 16, COLOR.BLACK);
  for (let y = 0; y < 16; y++) {
    const stripe = Math.floor(y / 2) % 2 === 0 ? COLOR.EXPLOSION_YELLOW : COLOR.BLACK;
    fillRect(wall, 0, y, 16, 1, stripe);
  }
  for (let i = 2; i < 14; i += 3) plot(wall, i, i, COLOR.DARK_GRAY);
  const windowTile = createGrid(16, 16, COLOR.SHADOW);
  for (let i = 0; i < 16; i++) {
    plot(windowTile, i, i, COLOR.GRAY);
    plot(windowTile, 15 - i, i, COLOR.GRAY);
  }
  fillRect(windowTile, 6, 6, 4, 4, COLOR.EXPLOSION_ORANGE);
  return {
    floor,
    wall,
    window: windowTile,
    railW: railTile(12, COLOR.BLACK, COLOR.EXPLOSION_YELLOW, COLOR.PALE_GRAY, COLOR.WHITE),
    railC: railTile(8, COLOR.BLACK, COLOR.EXPLOSION_YELLOW, COLOR.PALE_GRAY, COLOR.WHITE),
    railE: railTile(4, COLOR.BLACK, COLOR.EXPLOSION_YELLOW, COLOR.PALE_GRAY, COLOR.WHITE),
  };
}

function lookC(): FactoryTiles {
  const floor = plates(COLOR.SHADOW, COLOR.BLACK, COLOR.DARK_GRAY);
  const wall = createGrid(16, 16, COLOR.BLACK);
  fillRect(wall, 0, 6, 16, 3, COLOR.DARK_GRAY);
  fillRect(wall, 2, 7, 12, 1, COLOR.EXPLOSION_YELLOW);
  plot(wall, 4, 2, COLOR.ENEMY_BRIGHT_RED);
  plot(wall, 12, 12, COLOR.ENEMY_BRIGHT_RED);
  const windowTile = createGrid(16, 16, COLOR.BLACK);
  fillRect(windowTile, 3, 4, 10, 3, COLOR.EXPLOSION_ORANGE_YELLOW);
  fillRect(windowTile, 4, 5, 8, 1, COLOR.EXPLOSION_YELLOW);
  fillRect(windowTile, 1, 11, 14, 2, COLOR.DARK_GRAY);
  return {
    floor,
    wall,
    window: windowTile,
    railW: railTile(12, COLOR.BLACK, COLOR.DARK_GRAY, COLOR.MEDIUM_GRAY, COLOR.EXPLOSION_YELLOW),
    railC: railTile(8, COLOR.BLACK, COLOR.DARK_GRAY, COLOR.MEDIUM_GRAY, COLOR.EXPLOSION_YELLOW),
    railE: railTile(4, COLOR.BLACK, COLOR.DARK_GRAY, COLOR.MEDIUM_GRAY, COLOR.EXPLOSION_YELLOW),
  };
}

function lookD(): FactoryTiles {
  const floor = plates(COLOR.GROUND_DARK_OLIVE, COLOR.SHADOW, COLOR.GROUND_MED_OLIVE);
  const wall = createGrid(16, 16, COLOR.GROUND_OLIVE);
  fillRect(wall, 1, 1, 6, 6, COLOR.GROUND_MED_OLIVE);
  fillRect(wall, 9, 1, 6, 6, COLOR.GROUND_DARK_OLIVE);
  fillRect(wall, 1, 9, 6, 6, COLOR.GROUND_TAN);
  fillRect(wall, 9, 9, 6, 6, COLOR.GROUND_MED_OLIVE);
  plot(wall, 3, 3, COLOR.EXPLOSION_ORANGE);
  plot(wall, 11, 11, COLOR.EXPLOSION_YELLOW);
  const windowTile = createGrid(16, 16, COLOR.GROUND_DARK_OLIVE);
  for (let i = 0; i < 3; i++) {
    fillRect(windowTile, 2, 1 + i * 5, 4, 3, COLOR.EXPLOSION_ORANGE);
    fillRect(windowTile, 9, 1 + i * 5, 4, 3, COLOR.GROUND_TAN);
  }
  return {
    floor,
    wall,
    window: windowTile,
    railW: railTile(12, COLOR.GROUND_DARK_OLIVE, COLOR.GROUND_TAN, COLOR.GRAY, COLOR.PALE_GRAY),
    railC: railTile(8, COLOR.GROUND_DARK_OLIVE, COLOR.GROUND_TAN, COLOR.GRAY, COLOR.PALE_GRAY),
    railE: railTile(4, COLOR.GROUND_DARK_OLIVE, COLOR.GROUND_TAN, COLOR.GRAY, COLOR.PALE_GRAY),
  };
}

function lookE(): FactoryTiles {
  const floor = plates(COLOR.WATER_DEEP, COLOR.WATER_OCEAN, COLOR.WATER_MEDIUM);
  const wall = createGrid(16, 16, COLOR.DARK_GRAY);
  fillRect(wall, 2, 0, 4, 16, COLOR.WATER_OCEAN);
  fillRect(wall, 10, 0, 4, 16, COLOR.MEDIUM_GRAY);
  for (let y = 2; y < 16; y += 5) {
    fillRect(wall, 1, y, 6, 2, COLOR.PLAYER_DARK_CYAN);
    fillRect(wall, 9, y, 6, 2, COLOR.PLAYER_MED_CYAN);
  }
  const windowTile = createGrid(16, 16, COLOR.SHADOW);
  fillRect(windowTile, 3, 3, 10, 10, COLOR.WATER_OCEAN);
  fillRect(windowTile, 5, 5, 6, 6, COLOR.WATER_SHALLOW);
  plot(windowTile, 6, 6, COLOR.WHITE);
  fillRect(windowTile, 0, 0, 16, 2, COLOR.DARK_GRAY);
  fillRect(windowTile, 0, 14, 16, 2, COLOR.DARK_GRAY);
  return {
    floor,
    wall,
    window: windowTile,
    railW: railTile(12, COLOR.WATER_DEEP, COLOR.WATER_OCEAN, COLOR.PALE_GRAY, COLOR.PLAYER_CYAN),
    railC: railTile(8, COLOR.WATER_DEEP, COLOR.WATER_OCEAN, COLOR.PALE_GRAY, COLOR.PLAYER_CYAN),
    railE: railTile(4, COLOR.WATER_DEEP, COLOR.WATER_OCEAN, COLOR.PALE_GRAY, COLOR.PLAYER_CYAN),
  };
}

const BUILDERS: Readonly<Record<FactoryLookId, () => FactoryTiles>> = {
  A: lookA,
  B: lookB,
  C: lookC,
  D: lookD,
  E: lookE,
};

export function paintFactoryLook(id: FactoryLookId): FactoryTiles {
  return BUILDERS[id]();
}
