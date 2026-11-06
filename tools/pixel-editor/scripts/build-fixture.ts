/**
 * Rewrite tools/pixel-editor/fixtures from the same 8×8 pattern the test locks.
 * Run from the repo root: npx vite-node tools/pixel-editor/scripts/build-fixture.ts
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';
import { paletteRgb } from '@/game/palette';
import { serializePaletteGrid } from '@/game/art/gridFile';
import { pixelize, type RgbaImage } from '@/game/art/pixelize';
import { encodePngRgba } from '@/game/art/pngRgba';

function sampleImage(): RgbaImage {
  const width = 8;
  const height = 8;
  const data = new Uint8ClampedArray(width * height * 4);
  const put = (x: number, y: number, index: number, alpha: number) => {
    const [r, g, b] = paletteRgb(index);
    const i = (y * width + x) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = alpha;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x === 0 && y === 0) put(x, y, 0, 0);
      else if (x === 0 || y === 0 || x === 7 || y === 7) put(x, y, 0, 255);
      else if (x >= 3 && x <= 4 && y >= 3 && y <= 4) put(x, y, 7, 255);
      else put(x, y, 10, 255);
    }
  }
  return { width, height, data };
}

const image = sampleImage();
const grid = pixelize(
  image,
  {
    sourceWidth: 8,
    sourceHeight: 8,
    targetWidth: 8,
    targetHeight: 8,
    sample: 'nearest',
    quantize: 'nearest',
    alphaCutoff: 0,
    ditherStrength: 1,
  },
  'sample.png'
);
const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures');
mkdirSync(dir, { recursive: true });
writeFileSync(
  resolve(dir, 'sample.png'),
  encodePngRgba(image, (raw) => deflateSync(raw))
);
writeFileSync(resolve(dir, 'sample.grid.json'), serializePaletteGrid(grid));
