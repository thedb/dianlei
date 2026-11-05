/**
 * 8-bit PNG to straight RGBA, without a color profile.
 *
 * Inflate is injected so this file does not import Node or the DOM.
 * Pass `zlib.inflateSync` from tests, or `DecompressionStream('deflate')`
 * from the editor (PNG IDAT is zlib-wrapped).
 *
 * Supported: color types 0, 2, 3, 4, and 6, bit depth 8, no interlace.
 * Ancillary chunks are ignored, so gAMA / iCCP cannot change the samples.
 */

import type { RgbaImage } from './pixelize';

export type PngFilter = 0 | 1 | 2 | 3 | 4;

const SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** ISO CRC-32. Exported so tests can lock the PNG checksum. */
export function pngCrc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export function pngChunk(type: string, data: Uint8Array): Uint8Array {
  if (type.length !== 4) throw new Error('PNG chunk type must be 4 bytes');
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, pngCrc32(out.subarray(4, 8 + data.length)));
  return out;
}

export function encodePngRgba(
  image: RgbaImage,
  deflate: (raw: Uint8Array) => Uint8Array,
  filter: PngFilter = 0
): Uint8Array {
  if (image.data.length !== image.width * image.height * 4) {
    throw new Error('RGBA buffer length does not match');
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, image.width);
  view.setUint32(4, image.height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = image.width * 4;
  const raw = new Uint8Array(image.height * (stride + 1));
  let prev = new Uint8Array(stride);
  for (let y = 0; y < image.height; y++) {
    const row = image.data.subarray(y * stride, (y + 1) * stride);
    applyFilter(filter, row, prev, 4, raw, y * (stride + 1));
    prev = Uint8Array.from(row);
  }
  return concat([
    SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflate(raw)),
    pngChunk('IEND', new Uint8Array(0)),
  ]);
}

export async function decodePngRgba(
  png: Uint8Array,
  inflate: (zlib: Uint8Array) => Uint8Array | Promise<Uint8Array>
): Promise<RgbaImage> {
  if (png.length < SIGNATURE.length || !startsWith(png, SIGNATURE)) {
    throw new Error('not a PNG');
  }
  let offset = SIGNATURE.length;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let sawHeader = false;
  const idatParts: Uint8Array[] = [];
  let plte: Uint8Array | null = null;
  let trns: Uint8Array | null = null;
  while (offset + 12 <= png.length) {
    const view = new DataView(png.buffer, png.byteOffset + offset, 8);
    const length = view.getUint32(0);
    const type = String.fromCharCode(
      png[offset + 4]!,
      png[offset + 5]!,
      png[offset + 6]!,
      png[offset + 7]!
    );
    if (offset + 12 + length > png.length) throw new Error('PNG chunk is truncated');
    const data = png.subarray(offset + 8, offset + 8 + length);
    const crc = new DataView(png.buffer, png.byteOffset + offset + 8 + length, 4).getUint32(0);
    const signed = new Uint8Array(4 + length);
    signed.set(png.subarray(offset + 4, offset + 8), 0);
    signed.set(data, 4);
    if (pngCrc32(signed) !== crc) throw new Error(`PNG ${type} checksum does not match`);
    offset += 12 + length;
    if (type === 'IHDR') {
      if (data.length !== 13) throw new Error('PNG IHDR is the wrong size');
      const hdr = new DataView(data.buffer, data.byteOffset, data.byteLength);
      width = hdr.getUint32(0);
      height = hdr.getUint32(4);
      bitDepth = data[8]!;
      colorType = data[9]!;
      if (data[10] !== 0 || data[11] !== 0)
        throw new Error('PNG compression or filter method is not supported');
      if (data[12] !== 0) throw new Error('interlaced PNG is not supported');
      sawHeader = true;
    } else if (type === 'PLTE') {
      plte = Uint8Array.from(data);
    } else if (type === 'tRNS') {
      trns = Uint8Array.from(data);
    } else if (type === 'IDAT') {
      idatParts.push(Uint8Array.from(data));
    } else if (type === 'IEND') {
      break;
    }
  }
  if (!sawHeader) throw new Error('PNG is missing IHDR');
  if (idatParts.length === 0) throw new Error('PNG is missing IDAT');
  if (bitDepth !== 8) throw new Error('PNG bit depth must be 8');
  if (width < 1 || height < 1) throw new Error('PNG size is empty');
  const channels = channelsFor(colorType);
  if (colorType === 3) {
    if (!plte || plte.length < 3 || plte.length % 3 !== 0)
      throw new Error('indexed PNG is missing PLTE');
  }
  const inflated = await inflate(concat(idatParts));
  const bpp = channels;
  const pixels = unfilter(inflated, width, height, bpp);
  return {
    width,
    height,
    data: toRgba(pixels, width, height, colorType, plte, trns),
  };
}

function channelsFor(colorType: number): number {
  if (colorType === 0) return 1;
  if (colorType === 2) return 3;
  if (colorType === 3) return 1;
  if (colorType === 4) return 2;
  if (colorType === 6) return 4;
  throw new Error('PNG color type is not supported');
}

function unfilter(raw: Uint8Array, width: number, height: number, bpp: number): Uint8Array {
  const stride = width * bpp;
  if (raw.length !== height * (stride + 1))
    throw new Error('PNG inflated size does not match IHDR');
  const out = new Uint8Array(height * stride);
  const prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[src + i]!;
      const a = i >= bpp ? out[dst + i - bpp]! : 0;
      const b = prev[i]!;
      const c = i >= bpp ? prev[i - bpp]! : 0;
      let v = x;
      if (filter === 0) v = x;
      else if (filter === 1) v = (x + a) & 255;
      else if (filter === 2) v = (x + b) & 255;
      else if (filter === 3) v = (x + Math.floor((a + b) / 2)) & 255;
      else if (filter === 4) v = (x + paeth(a, b, c)) & 255;
      else throw new Error('PNG filter is not supported');
      out[dst + i] = v;
    }
    prev.set(out.subarray(dst, dst + stride));
  }
  return out;
}

function applyFilter(
  filter: PngFilter,
  raw: Uint8Array | Uint8ClampedArray,
  prev: Uint8Array,
  bpp: number,
  into: Uint8Array,
  offset: number
): void {
  into[offset] = filter;
  for (let i = 0; i < raw.length; i++) {
    const left = i >= bpp ? raw[i - bpp]! : 0;
    const up = prev[i]!;
    const upLeft = i >= bpp ? prev[i - bpp]! : 0;
    const v = raw[i]!;
    let out = v;
    if (filter === 1) out = v - left;
    else if (filter === 2) out = v - up;
    else if (filter === 3) out = v - Math.floor((left + up) / 2);
    else if (filter === 4) out = v - paeth(left, up, upLeft);
    into[offset + 1 + i] = out & 255;
  }
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function toRgba(
  pixels: Uint8Array,
  width: number,
  height: number,
  colorType: number,
  plte: Uint8Array | null,
  trns: Uint8Array | null
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  const count = width * height;
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    if (colorType === 6) {
      const s = i * 4;
      out[o] = pixels[s]!;
      out[o + 1] = pixels[s + 1]!;
      out[o + 2] = pixels[s + 2]!;
      out[o + 3] = pixels[s + 3]!;
    } else if (colorType === 2) {
      const s = i * 3;
      out[o] = pixels[s]!;
      out[o + 1] = pixels[s + 1]!;
      out[o + 2] = pixels[s + 2]!;
      out[o + 3] = 255;
    } else if (colorType === 0) {
      const v = pixels[i]!;
      out[o] = v;
      out[o + 1] = v;
      out[o + 2] = v;
      out[o + 3] = 255;
    } else if (colorType === 4) {
      const s = i * 2;
      const v = pixels[s]!;
      out[o] = v;
      out[o + 1] = v;
      out[o + 2] = v;
      out[o + 3] = pixels[s + 1]!;
    } else {
      const index = pixels[i]!;
      const palette = plte!;
      if (index * 3 + 2 >= palette.length) throw new Error('indexed PNG sample is outside PLTE');
      out[o] = palette[index * 3]!;
      out[o + 1] = palette[index * 3 + 1]!;
      out[o + 2] = palette[index * 3 + 2]!;
      out[o + 3] = trns && index < trns.length ? trns[index]! : 255;
    }
  }
  return out;
}

function startsWith(bytes: Uint8Array, prefix: Uint8Array): boolean {
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[i] !== prefix[i]) return false;
  }
  return true;
}

function concat(parts: Uint8Array[]): Uint8Array {
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
