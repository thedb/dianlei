import { readFileSync } from 'fs';
import { resolve } from 'path';
import { deflateSync, inflateSync } from 'zlib';
import { describe, expect, it } from 'vitest';
import { PALETTE, paletteRgb } from '@/game/palette';
import { buildObsidianHinge } from './obsidianLooks';
import { createPlayerFrameData } from './playerSprite';
import {
  parsePaletteGrid,
  serializePaletteGrid,
  spriteToGrid,
  gridToSpriteData,
  type GridPixelizeParams,
} from './gridFile';
import { nearestPaletteIndex, pixelize, type RgbaImage } from './pixelize';
import { decodePngRgba, encodePngRgba, pngChunk, pngCrc32, type PngFilter } from './pngRgba';
import { writePalettePixels } from './spriteRenderer';

const fixtureDir = resolve(process.cwd(), 'tools/pixel-editor/fixtures');

function rgba(
  width: number,
  height: number,
  fill: (x: number, y: number, put: Put) => void
): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  const put: Put = (x, y, r, g, b, a) => {
    const i = (y * width + x) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) fill(x, y, put);
  }
  return { width, height, data };
}

type Put = (x: number, y: number, r: number, g: number, b: number, a: number) => void;

function paintIndex(put: Put, x: number, y: number, index: number, alpha = 255): void {
  const [r, g, b] = paletteRgb(index);
  put(x, y, r, g, b, alpha);
}

/** 8×8 fixture: transparent corner, black rim, white center, cyan field. */
function sampleImage(): RgbaImage {
  return rgba(8, 8, (x, y, put) => {
    if (x === 0 && y === 0) put(x, y, 0, 0, 0, 0);
    else if (x === 0 || y === 0 || x === 7 || y === 7) paintIndex(put, x, y, 0);
    else if (x >= 3 && x <= 4 && y >= 3 && y <= 4) paintIndex(put, x, y, 7);
    else paintIndex(put, x, y, 10);
  });
}

const SAMPLE_PARAMS: GridPixelizeParams = {
  sourceWidth: 8,
  sourceHeight: 8,
  targetWidth: 8,
  targetHeight: 8,
  sample: 'nearest',
  quantize: 'nearest',
  alphaCutoff: 0,
  ditherStrength: 1,
};

function expectSampleCells(cells: readonly number[]): void {
  expect(cells).toHaveLength(64);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      let want = 10;
      if (x === 0 && y === 0) want = -1;
      else if (x === 0 || y === 0 || x === 7 || y === 7) want = 0;
      else if (x >= 3 && x <= 4 && y >= 3 && y <= 4) want = 7;
      expect(cells[y * 8 + x]).toBe(want);
    }
  }
}

function inflate(data: Uint8Array): Uint8Array {
  return inflateSync(data);
}

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]!) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** Zlib wrapper around one stored deflate block. Independent of deflateSync. */
function zlibStore(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(2 + 5 + data.length + 4);
  out[0] = 0x78;
  out[1] = 0x01;
  out[2] = 0x01;
  out[3] = data.length & 0xff;
  out[4] = (data.length >>> 8) & 0xff;
  const nlen = ~data.length & 0xffff;
  out[5] = nlen & 0xff;
  out[6] = (nlen >>> 8) & 0xff;
  out.set(data, 7);
  new DataView(out.buffer).setUint32(7 + data.length, adler32(data));
  return out;
}

function ihdr(width: number, height: number, colorType: number): Uint8Array {
  const bytes = new Uint8Array(13);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  bytes[8] = 8;
  bytes[9] = colorType;
  return bytes;
}

function assemble(chunks: Uint8Array[]): Uint8Array {
  const parts = [Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), ...chunks];
  let n = 0;
  for (const part of parts) n += part.length;
  const out = new Uint8Array(n);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

describe('palette blit bytes', () => {
  it('reads the same RGB as the locked hex', () => {
    for (let i = 0; i < PALETTE.length; i++) {
      const hex = PALETTE[i]!;
      expect(paletteRgb(i)).toEqual([
        Number.parseInt(hex.slice(1, 3), 16),
        Number.parseInt(hex.slice(3, 5), 16),
        Number.parseInt(hex.slice(5, 7), 16),
      ]);
    }
  });

  it('writes opaque palette pixels and leaves -1 transparent', () => {
    const pixels = new Uint8ClampedArray(2 * 4);
    writePalettePixels([[10, -1]], pixels);
    const [r, g, b] = paletteRgb(10);
    expect(Array.from(pixels)).toEqual([r, g, b, 255, 0, 0, 0, 0]);
  });
});

describe('pixelize', () => {
  it('maps an exact palette color to that index, lowest index on a tie', () => {
    const [r, g, b] = paletteRgb(10);
    expect(nearestPaletteIndex(r, g, b)).toBe(10);
    expect(nearestPaletteIndex(0, 0, 0)).toBe(0);
  });

  it('keeps the 8×8 sample identical under nearest', () => {
    const grid = pixelize(sampleImage(), SAMPLE_PARAMS, 'sample.png');
    expectSampleCells(grid.cells);
    const again = serializePaletteGrid(pixelize(sampleImage(), SAMPLE_PARAMS, 'sample.png'));
    expect(serializePaletteGrid(grid)).toBe(again);
  });

  it('samples the center of each cell when shrinking 4×4 to 2×2', () => {
    const image = rgba(4, 4, (x, y, put) => {
      let index = 0;
      if (x === 1 && y === 1) index = 10;
      else if (x === 3 && y === 1) index = 7;
      else if (x === 1 && y === 3) index = 19;
      else if (x === 3 && y === 3) index = 44;
      paintIndex(put, x, y, index);
    });
    const grid = pixelize(
      image,
      {
        sourceWidth: 4,
        sourceHeight: 4,
        targetWidth: 2,
        targetHeight: 2,
        sample: 'nearest',
        quantize: 'nearest',
        alphaCutoff: 0,
        ditherStrength: 1,
      },
      'centers.png'
    );
    expect(grid.cells).toEqual([10, 7, 19, 44]);
  });

  it('box-averages black and white to the nearest palette gray', () => {
    const image = rgba(2, 1, (x, _y, put) => {
      const v = x === 0 ? 0 : 255;
      put(x, 0, v, v, v, 255);
    });
    const grid = pixelize(
      image,
      {
        sourceWidth: 2,
        sourceHeight: 1,
        targetWidth: 1,
        targetHeight: 1,
        sample: 'box',
        quantize: 'nearest',
        alphaCutoff: 0,
        ditherStrength: 0,
      },
      'avg.png'
    );
    // Premultiplied average of black and white is 128,128,128.
    // Concrete #787880 is closer than gray #6e6e80.
    expect(paletteRgb(34)).toEqual([0x78, 0x78, 0x80]);
    expect(grid.cells).toEqual([34]);
  });

  it('treats alpha at or below the cutoff as transparent', () => {
    const [r, g, b] = paletteRgb(10);
    const image = rgba(1, 1, (_x, _y, put) => put(0, 0, r, g, b, 5));
    const base = {
      sourceWidth: 1,
      sourceHeight: 1,
      targetWidth: 1,
      targetHeight: 1,
      sample: 'nearest' as const,
      quantize: 'nearest' as const,
      ditherStrength: 1,
    };
    expect(pixelize(image, { ...base, alphaCutoff: 5 }, 'a.png').cells).toEqual([-1]);
    expect(pixelize(image, { ...base, alphaCutoff: 4 }, 'a.png').cells).toEqual([10]);
  });

  it('ignores dither strength unless quantize is dither, and dither is stable', () => {
    const image = rgba(16, 1, (x, _y, put) => {
      const v = Math.round((x * 255) / 15);
      put(x, 0, v, v, v, 255);
    });
    const size = {
      sourceWidth: 16,
      sourceHeight: 1,
      targetWidth: 16,
      targetHeight: 1,
      sample: 'nearest' as const,
      alphaCutoff: 0,
    };
    const nearest = pixelize(
      image,
      { ...size, quantize: 'nearest', ditherStrength: 0 },
      'ramp.png'
    );
    const nearestOther = pixelize(
      image,
      { ...size, quantize: 'nearest', ditherStrength: 1 },
      'ramp.png'
    );
    const dither = pixelize(image, { ...size, quantize: 'dither', ditherStrength: 1 }, 'ramp.png');
    const ditherAgain = pixelize(
      image,
      { ...size, quantize: 'dither', ditherStrength: 1 },
      'ramp.png'
    );
    const flat = pixelize(image, { ...size, quantize: 'dither', ditherStrength: 0 }, 'ramp.png');
    expect(nearestOther.cells).toEqual(nearest.cells);
    expect(flat.cells).toEqual(nearest.cells);
    expect(dither.cells).toEqual(ditherAgain.cells);
    expect(dither.cells).not.toEqual(nearest.cells);
    expect(serializePaletteGrid(dither)).toBe(serializePaletteGrid(ditherAgain));
  });
});

describe('grid json', () => {
  it('round-trips Eagle center and an Obsidian hinge through the same blit bytes', () => {
    const eagle = createPlayerFrameData()[5]!;
    const hinge = buildObsidianHinge('live');
    for (const [name, sprite] of [
      ['eagle-center', eagle],
      ['obsidian-hinge-live', hinge],
    ] as const) {
      const grid = spriteToGrid(sprite, name);
      expect(gridToSpriteData(grid)).toEqual(sprite);
      const parsed = parsePaletteGrid(serializePaletteGrid(grid));
      expect(gridToSpriteData(parsed)).toEqual(sprite);
      const a = new Uint8ClampedArray(grid.width * grid.height * 4);
      const b = new Uint8ClampedArray(grid.width * grid.height * 4);
      writePalettePixels(sprite, a);
      writePalettePixels(gridToSpriteData(parsed), b);
      expect(a).toEqual(b);
      expect(a.some((byte) => byte !== 0)).toBe(true);
    }
  });

  it('rejects a bad palette, a path name, and a short cell list', () => {
    const grid = spriteToGrid(
      [
        [0, -1],
        [7, 10],
      ],
      'tiny'
    );
    const text = serializePaletteGrid(grid);
    expect(() => parsePaletteGrid(text.replace('"size": 52', '"size": 48'))).toThrow(
      /palette size/
    );
    expect(() => parsePaletteGrid('{}')).toThrow(/format/);
    expect(() => parsePaletteGrid('{')).toThrow(/not valid JSON/);
    expect(() => spriteToGrid([[0]], 'a/b.png')).toThrow(/file name/);
    const broken = JSON.parse(text) as { cells: number[] };
    broken.cells.pop();
    expect(() => parsePaletteGrid(JSON.stringify(broken))).toThrow(/cells length/);
  });
});

describe('png rgba', () => {
  it('locks the ISO CRC-32 vector', () => {
    expect(pngCrc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('round-trips RGBA through every scanline filter', async () => {
    const image = sampleImage();
    for (const filter of [0, 1, 2, 3, 4] as const satisfies readonly PngFilter[]) {
      const png = encodePngRgba(image, (raw) => deflateSync(raw), filter);
      expect(await decodePngRgba(png, inflate)).toEqual(image);
    }
  });

  it('decodes a hand-built Sub filter, Up filter, gray, and indexed PNG', async () => {
    const sub = assemble([
      pngChunk('IHDR', ihdr(2, 1, 6)),
      pngChunk('IDAT', zlibStore(Uint8Array.of(1, 10, 20, 30, 255, 5, 0, 0, 0))),
      pngChunk('IEND', new Uint8Array(0)),
    ]);
    expect(Array.from((await decodePngRgba(sub, inflate)).data)).toEqual([
      10, 20, 30, 255, 15, 20, 30, 255,
    ]);

    const up = assemble([
      pngChunk('IHDR', ihdr(1, 2, 6)),
      pngChunk('IDAT', zlibStore(Uint8Array.of(2, 1, 2, 3, 4, 2, 4, 4, 4, 4))),
      pngChunk('IEND', new Uint8Array(0)),
    ]);
    expect(Array.from((await decodePngRgba(up, inflate)).data)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    const gray = assemble([
      pngChunk('IHDR', ihdr(1, 1, 0)),
      pngChunk('IDAT', zlibStore(Uint8Array.of(0, 255))),
      pngChunk('IEND', new Uint8Array(0)),
    ]);
    expect(Array.from((await decodePngRgba(gray, inflate)).data)).toEqual([255, 255, 255, 255]);

    const indexed = assemble([
      pngChunk('IHDR', ihdr(1, 1, 3)),
      pngChunk('PLTE', Uint8Array.of(0, 0xe5, 0xff)),
      pngChunk('tRNS', Uint8Array.of(128)),
      pngChunk('IDAT', zlibStore(Uint8Array.of(0, 0))),
      pngChunk('IEND', new Uint8Array(0)),
    ]);
    expect(Array.from((await decodePngRgba(indexed, inflate)).data)).toEqual([0, 0xe5, 0xff, 128]);
  });

  it('rejects a file that is not a PNG', async () => {
    await expect(decodePngRgba(Uint8Array.of(1, 2, 3, 4), inflate)).rejects.toThrow(/not a PNG/);
  });
});

describe('pixel editor fixture', () => {
  it('decodes sample.png and matches the committed grid export', async () => {
    const png = new Uint8Array(readFileSync(resolve(fixtureDir, 'sample.png')));
    const decoded = await decodePngRgba(png, inflate);
    expect(decoded).toEqual(sampleImage());
    const grid = pixelize(decoded, SAMPLE_PARAMS, 'sample.png');
    expectSampleCells(grid.cells);
    const text = serializePaletteGrid(grid);
    expect(readFileSync(resolve(fixtureDir, 'sample.grid.json'), 'utf8')).toBe(text);
    expect(serializePaletteGrid(parsePaletteGrid(text))).toBe(text);
  });
});
