/**
 * Uncompressed zip of the editor's batch export (P2). One `*.grid.json` per entry.
 * Method is STORE, names are UTF-8. The fight does not read this.
 */

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;
const UTF8_FLAG = 0x0800;
/** 2026-01-01 00:00 in DOS time. */
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
const MAX_FILES = 256;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;

export interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

export function zipStore(files: readonly ZipEntry[]): Uint8Array {
  if (files.length < 1 || files.length > MAX_FILES)
    throw new Error('zip file count is out of range');
  const encoded = files.map((file) => ({ name: encodeName(file.name), bytes: file.bytes }));
  let total = 0;
  let locals = 0;
  let central = 0;
  for (const file of encoded) {
    if (file.bytes.length > MAX_FILE_BYTES) throw new Error('zip entry is too large');
    total += file.bytes.length;
    locals += 30 + file.name.length + file.bytes.length;
    central += 46 + file.name.length;
  }
  if (total > MAX_TOTAL_BYTES) throw new Error('zip is too large');
  const out = new Uint8Array(locals + central + 22);
  const view = new DataView(out.buffer);
  let at = 0;
  const offsets: number[] = [];
  const crcs: number[] = [];
  for (const file of encoded) {
    offsets.push(at);
    const crc = crc32(file.bytes);
    crcs.push(crc);
    view.setUint32(at, LOCAL, true);
    view.setUint16(at + 4, 20, true);
    view.setUint16(at + 6, UTF8_FLAG, true);
    view.setUint16(at + 8, 0, true);
    view.setUint16(at + 10, DOS_TIME, true);
    view.setUint16(at + 12, DOS_DATE, true);
    view.setUint32(at + 14, crc, true);
    view.setUint32(at + 18, file.bytes.length, true);
    view.setUint32(at + 22, file.bytes.length, true);
    view.setUint16(at + 26, file.name.length, true);
    view.setUint16(at + 28, 0, true);
    at += 30;
    out.set(file.name, at);
    at += file.name.length;
    out.set(file.bytes, at);
    at += file.bytes.length;
  }
  const centralAt = at;
  encoded.forEach((file, index) => {
    const crc = crcs[index] ?? 0;
    const offset = offsets[index] ?? 0;
    view.setUint32(at, CENTRAL, true);
    view.setUint16(at + 4, 20, true);
    view.setUint16(at + 6, 20, true);
    view.setUint16(at + 8, UTF8_FLAG, true);
    view.setUint16(at + 10, 0, true);
    view.setUint16(at + 12, DOS_TIME, true);
    view.setUint16(at + 14, DOS_DATE, true);
    view.setUint32(at + 16, crc, true);
    view.setUint32(at + 20, file.bytes.length, true);
    view.setUint32(at + 24, file.bytes.length, true);
    view.setUint16(at + 28, file.name.length, true);
    view.setUint16(at + 30, 0, true);
    view.setUint16(at + 32, 0, true);
    view.setUint16(at + 34, 0, true);
    view.setUint16(at + 36, 0, true);
    view.setUint32(at + 38, 0, true);
    view.setUint32(at + 42, offset, true);
    at += 46;
    out.set(file.name, at);
    at += file.name.length;
  });
  view.setUint32(at, END, true);
  view.setUint16(at + 4, 0, true);
  view.setUint16(at + 6, 0, true);
  view.setUint16(at + 8, encoded.length, true);
  view.setUint16(at + 10, encoded.length, true);
  view.setUint32(at + 12, at - centralAt, true);
  view.setUint32(at + 16, centralAt, true);
  view.setUint16(at + 20, 0, true);
  return out;
}

/** Reads a STORE zip written by {@link zipStore}. */
export function unzipStore(zip: Uint8Array): ZipEntry[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const files: ZipEntry[] = [];
  let at = 0;
  while (at + 4 <= zip.length) {
    const signature = view.getUint32(at, true);
    if (signature === CENTRAL || signature === END) break;
    if (signature !== LOCAL) throw new Error('zip local header is missing');
    const method = view.getUint16(at + 8, true);
    if (method !== 0) throw new Error('zip method is not STORE');
    const crc = view.getUint32(at + 14, true);
    const size = view.getUint32(at + 22, true);
    const nameLength = view.getUint16(at + 26, true);
    const extra = view.getUint16(at + 28, true);
    at += 30;
    const name = new TextDecoder().decode(zip.subarray(at, at + nameLength));
    at += nameLength + extra;
    const bytes = zip.slice(at, at + size);
    if (crc32(bytes) !== crc) throw new Error('zip crc does not match');
    at += size;
    files.push({ name, bytes });
  }
  if (files.length < 1) throw new Error('zip has no files');
  return files;
}

function encodeName(name: string): Uint8Array {
  if (name.length < 1 || name.length > 160) throw new Error('zip name is empty');
  if (
    name.includes('/') ||
    name.includes('\\') ||
    name.includes('\0') ||
    name === '.' ||
    name === '..'
  ) {
    throw new Error('zip name must be a single file');
  }
  return new TextEncoder().encode(name);
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] ?? 0;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
