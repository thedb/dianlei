/**
 * Render player bank frames to nearest-neighbor zoomed PNGs for review.
 * Usage: npx vite-node scripts/render-player-preview.ts [outDir]
 */

import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { PALETTE } from '@/game/palette';
import type { SpriteData } from '@/game/art/types';
import { createPlayerFrameData } from '@/game/art/playerSprite';

const BG = [10, 10, 26];

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
    for (let i = 0; i < width * 3; i++) {
      raw[y * (width * 3 + 1) + 1 + i] = rgb[y * width * 3 + i]!;
    }
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

/** Lay frames out horizontally with padding, each pixel scaled by `zoom` */
function renderStrip(frames: SpriteData[], zoom: number, pad = 4): Buffer {
  const fw = Math.max(...frames.map((f) => Math.max(...f.map((r) => r.length))));
  const fh = Math.max(...frames.map((f) => f.length));
  const w = (frames.length * (fw + pad) + pad) * zoom;
  const h = (fh + pad * 2) * zoom;
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) rgb.set(BG, i * 3);

  frames.forEach((frame, fi) => {
    const ox = pad + fi * (fw + pad);
    frame.forEach((row, y) => {
      row.forEach((idx, x) => {
        if (idx < 0) return;
        const hex = PALETTE[idx] ?? '#ff00ff';
        const color = [1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16));
        for (let dy = 0; dy < zoom; dy++) {
          for (let dx = 0; dx < zoom; dx++) {
            const px = (ox + x) * zoom + dx;
            const py = (pad + y) * zoom + dy;
            rgb.set(color, (py * w + px) * 3);
          }
        }
      });
    });
  });
  return encodePng(w, h, rgb);
}

/** Match runtime: renderSprite reads `width` from row 0, so short rows render transparent */
function normalizeRows(data: SpriteData): SpriteData {
  const width = data[0]?.length ?? 0;
  return data.map((row) => Array.from({ length: width }, (_, i) => row[i] ?? -1));
}

async function renderBefore(outDir: string, modulePath: string): Promise<void> {
  const old = (await import(modulePath)) as Record<string, SpriteData>;
  const center = normalizeRows(old['PLAYER_CENTER']!);
  const deepRight = normalizeRows(old['PLAYER_BANK_R5']!);
  const deepLeft = deepRight.map((row) => [...row].reverse());
  writeFileSync(
    join(outDir, 'player-before-center-deep.png'),
    renderStrip([deepLeft, center, deepRight], 12)
  );
}

async function main(): Promise<void> {
  const outDir = process.argv[2] ?? '/opt/cursor/artifacts';
  mkdirSync(outDir, { recursive: true });
  const frames = createPlayerFrameData();
  writeFileSync(join(outDir, 'player-after-strip-11.png'), renderStrip(frames, 6));
  writeFileSync(
    join(outDir, 'player-after-center-deep.png'),
    renderStrip([frames[0]!, frames[5]!, frames[10]!], 12)
  );
  const before = process.env['BEFORE_MODULE'];
  if (before) await renderBefore(outDir, before);
  console.log(`wrote previews to ${outDir}`);
}

void main();
