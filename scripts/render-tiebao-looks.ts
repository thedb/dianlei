/**
 * Still previews of the five factory halls and the 铁堡 consist.
 * Usage: npm run art:tiebao
 * The fight uses look A. End-form stills crop the loco and the first two cars.
 * `tiebao-A-long.png` is the full nine-car consist the battle bakes.
 */

import { deflateSync } from 'zlib';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createRng } from '@/engine/rng';
import {
  TIEBAO_BUFFER,
  TIEBAO_HULL_H,
  TIEBAO_HULL_W,
  TIEBAO_ROOF_CAR_ROW,
  TIEBAO_ROOF_LOCO_ROW,
} from '@/game/config';
import { PALETTE } from '@/game/palette';
import { buildTiebaoAa } from '@/game/art/bossSprite';
import { TileId, getTilePixels } from '@/game/art/tiles';
import {
  FACTORY_LOOK_IDS,
  FACTORY_LOOK_NAMES,
  paintFactoryLook,
  type FactoryLookId,
} from '@/game/art/factoryLooks';
import { paintFactoryApproach, paintFactoryFloor } from '@/game/maps/factoryBoss';
import { ChunkPainter } from '@/game/maps/chunks';
import {
  TIEBAO_LOOK_IDS,
  TIEBAO_LOOK_NAMES,
  buildTiebaoHull,
  type TiebaoLookId,
} from '@/game/art/tiebaoLooks';
import type { SpriteData } from '@/game/art/types';
import type { TileGrid } from '@/game/maps/types';

const BG = [10, 16, 28];

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let i = 0; i < width * 3; i++) raw[y * (width * 3 + 1) + 1 + i] = rgb[y * width * 3 + i]!;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function rgbOf(index: number): number[] {
  const hex = PALETTE[index] ?? '#ff00ff';
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

function blitSprite(
  rgb: Uint8Array,
  width: number,
  sprite: SpriteData,
  ox: number,
  oy: number,
  zoom: number
): void {
  sprite.forEach((row, y) => {
    row.forEach((idx, x) => {
      if (idx < 0) return;
      const color = rgbOf(idx);
      for (let dy = 0; dy < zoom; dy++) {
        for (let dx = 0; dx < zoom; dx++) {
          const px = ox + x * zoom + dx;
          const py = oy + y * zoom + dy;
          if (px < 0 || py < 0 || px >= width) continue;
          rgb.set(color, (py * width + px) * 3);
        }
      }
    });
  });
}

const LETTERS: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '11110', '10001', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '11110', '10000', '10000', '10000', '11111'],
};

function badge(rgb: Uint8Array, width: number, letter: string): void {
  const rows = LETTERS[letter];
  if (!rows) return;
  for (let y = 4; y < 4 + rows.length * 3 + 6; y++) {
    for (let x = 4; x < 4 + 5 * 3 + 6; x++) rgb.set([0, 0, 0], (y * width + x) * 3);
  }
  rows.forEach((row, y) => {
    [...row].forEach((bit, x) => {
      if (bit !== '1') return;
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          const px = 7 + x * 3 + dx;
          const py = 7 + y * 3 + dy;
          rgb.set([255, 248, 160], (py * width + px) * 3);
        }
      }
    });
  });
}

function factoryTiles(look: FactoryLookId): SpriteData[] {
  const tiles = getTilePixels().slice();
  const custom = paintFactoryLook(look);
  tiles[TileId.factoryFloor] = custom.floor;
  tiles[TileId.factoryWall] = custom.wall;
  tiles[TileId.factoryWindow] = custom.window;
  tiles[TileId.factoryRailW] = custom.railW;
  tiles[TileId.factoryRailC] = custom.railC;
  tiles[TileId.factoryRailE] = custom.railE;
  return tiles;
}

function renderGrid(grid: TileGrid, tiles: SpriteData[], zoom: number, letter: string): Buffer {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const width = cols * 16 * zoom;
  const height = rows * 16 * zoom;
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) rgb.set(BG, i * 3);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sprite = tiles[grid[r]![c]!]!;
      blitSprite(rgb, width, sprite, c * 16 * zoom, (rows - 1 - r) * 16 * zoom, zoom);
    }
  }
  badge(rgb, width, letter);
  return encodePng(width, height, rgb);
}

/** Top of the full consist, with the tail beam stamped on, matching the live crop. */
function cropEndForm(full: SpriteData): SpriteData {
  const stamp = Math.min(TIEBAO_BUFFER, TIEBAO_HULL_H);
  const body = TIEBAO_HULL_H - stamp;
  const out: SpriteData = [];
  for (let y = 0; y < body; y++) out.push([...(full[y] ?? [])]);
  for (let i = 0; i < stamp; i++) out.push([...(full[full.length - stamp + i] ?? [])]);
  return out;
}

function paintGuns(rgb: Uint8Array, width: number, zoom: number, ox: number, oy: number): void {
  const gun = buildTiebaoAa(false);
  const cx = Math.floor(TIEBAO_HULL_W / 2);
  for (const row of [TIEBAO_ROOF_LOCO_ROW, TIEBAO_ROOF_CAR_ROW]) {
    blitSprite(rgb, width, gun, ox + (cx - 8) * zoom, oy + (row - 8) * zoom, zoom);
  }
}

function renderSheet(sprite: SpriteData, zoom: number, letter: string, guns: boolean): Buffer {
  const width = TIEBAO_HULL_W * zoom + 16;
  const height = sprite.length * zoom + 16;
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) rgb.set(BG, i * 3);
  blitSprite(rgb, width, sprite, 8, 8, zoom);
  if (guns) paintGuns(rgb, width, zoom, 8, 8);
  badge(rgb, width, letter);
  return encodePng(width, height, rgb);
}

function renderHull(look: TiebaoLookId, zoom: number): Buffer {
  return renderSheet(cropEndForm(buildTiebaoHull(look, false)), zoom, look, true);
}

function renderLong(look: TiebaoLookId, zoom: number): Buffer {
  return renderSheet(buildTiebaoHull(look, false), zoom, look, true);
}

function main(): void {
  const outDir = process.argv[2] ?? '/opt/cursor/artifacts/tiebao-looks';
  mkdirSync(outDir, { recursive: true });
  const painter = new ChunkPainter(createRng(1));
  for (const id of FACTORY_LOOK_IDS) {
    paintFactoryFloor(painter, id);
    const floor = painter.grid.map((row) => row.slice());
    const name = FACTORY_LOOK_NAMES[id];
    writeFileSync(
      join(outDir, `factory-${id}.png`),
      renderGrid(floor, factoryTiles(id), 2, id)
    );
    console.log(`factory ${id} ${name}`);
  }
  paintFactoryApproach(painter, 'A');
  writeFileSync(
    join(outDir, 'factory-A-approach.png'),
    renderGrid(
      painter.grid.map((row) => row.slice()),
      factoryTiles('A'),
      2,
      'A'
    )
  );
  for (const id of TIEBAO_LOOK_IDS) {
    writeFileSync(join(outDir, `tiebao-${id}.png`), renderHull(id, 4));
    console.log(`tiebao ${id} ${TIEBAO_LOOK_NAMES[id]}`);
  }
  writeFileSync(join(outDir, 'tiebao-A-long.png'), renderLong('A', 2));
  console.log('tiebao A long consist');
  console.log(`wrote looks to ${outDir}`);
}

main();
