import { describe, expect, it } from 'vitest';
import { unzipStore, zipStore } from './gridZip';
import { serializePaletteGrid } from './gridFile';
import {
  BUILTIN_PRESETS,
  createUserPreset,
  gridCellDiff,
  gridFileName,
  parseUserPresets,
  pixelizeAll,
  pixelizeWithPreset,
  presetParams,
  resolvedTarget,
  serializeUserPresets,
  type PresetDraft,
} from './pixelizePreset';
import type { RgbaImage } from './pixelize';

function image(width: number, height: number, alpha = 255): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = (i * 30) % 256;
    data[i * 4 + 1] = 80;
    data[i * 4 + 2] = 160;
    data[i * 4 + 3] = alpha;
  }
  return { width, height, data };
}

function draft(overrides: Partial<PresetDraft> = {}): PresetDraft {
  return {
    name: '翼',
    targetWidth: 32,
    targetHeight: 16,
    sample: 'nearest',
    quantize: 'dither',
    alphaCutoff: 4,
    ditherStrength: 0.5,
    lockRatio: true,
    note: '自己的',
    ...overrides,
  };
}

describe('pixelize presets', () => {
  it('ships the dianlei sizes', () => {
    const byId = new Map(BUILTIN_PRESETS.map((item) => [item.id, item]));
    expect(byId.get('builtin:eagle')).toMatchObject({
      targetWidth: 28,
      targetHeight: 32,
      lockRatio: false,
    });
    expect(byId.get('builtin:mandy')).toMatchObject({ targetWidth: 48, targetHeight: 32 });
    expect(byId.get('builtin:jason')).toMatchObject({ targetWidth: 26, targetHeight: 30 });
    expect(byId.get('builtin:small')).toMatchObject({
      targetWidth: 24,
      targetHeight: 24,
      sample: 'nearest',
    });
    expect(byId.get('builtin:icon')).toMatchObject({
      targetWidth: 16,
      targetHeight: 16,
      alphaCutoff: 16,
    });
    expect(byId.get('builtin:tile')).toMatchObject({
      targetWidth: 16,
      targetHeight: 16,
      alphaCutoff: 0,
    });
    expect(byId.get('builtin:boss')).toMatchObject({
      targetWidth: 64,
      sample: 'box',
      quantize: 'dither',
      lockRatio: true,
      ditherStrength: 0.75,
    });
  });

  it('keeps a fixed size, and locks ratio only when asked', () => {
    const eagle = BUILTIN_PRESETS.find((item) => item.id === 'builtin:eagle');
    const boss = BUILTIN_PRESETS.find((item) => item.id === 'builtin:boss');
    if (!eagle || !boss) throw new Error('missing builtin');
    const wide = image(100, 10);
    expect(resolvedTarget(eagle, wide)).toEqual({ width: 28, height: 32 });
    expect(resolvedTarget(boss, image(4, 2))).toEqual({ width: 64, height: 32 });
    const long = createUserPreset(draft({ targetWidth: 400, lockRatio: true }), []);
    expect(resolvedTarget(long, { width: 1, height: 10 })).toEqual({ width: 51, height: 512 });
  });

  it('pixelizes the same image and preset to the same bytes, including a batch row', () => {
    const boss = BUILTIN_PRESETS.find((item) => item.id === 'builtin:boss');
    if (!boss) throw new Error('missing boss');
    const source = image(8, 4);
    const once = serializePaletteGrid(pixelizeWithPreset(source, 'wing.png', boss));
    const twice = serializePaletteGrid(pixelizeWithPreset(source, 'wing.png', boss));
    expect(twice).toBe(once);
    expect(presetParams(boss, source).targetHeight).toBe(32);
    const rows = pixelizeAll(
      [
        { name: 'wing.png', image: source },
        { name: 'bad.png', image: { width: 0, height: 0, data: new Uint8ClampedArray() } },
      ],
      boss
    );
    expect(rows[0]?.ok).toBe(true);
    if (rows[0]?.ok) expect(serializePaletteGrid(rows[0].grid)).toBe(once);
    expect(rows[1]).toMatchObject({ ok: false });
  });

  it('round-trips user presets and skips a bad row', () => {
    const saved = createUserPreset(draft(), []);
    expect(saved.id.startsWith('user:')).toBe(true);
    expect(createUserPreset(draft(), [saved.id]).id).not.toBe(saved.id);
    const parsed = parseUserPresets(serializeUserPresets([saved, saved]));
    expect(parsed.presets).toEqual([saved]);
    expect(parsed.skipped).toBe(1);
    const mixed = parseUserPresets(
      serializeUserPresets([saved]).replace('\n  ]\n}\n', ',\n    { "id": "nope" }\n  ]\n}\n')
    );
    expect(mixed.presets).toEqual([saved]);
    expect(mixed.skipped).toBe(1);
    expect(() => createUserPreset(draft({ name: '   ' }), [])).toThrow('预设名不能为空');
    expect(() => parseUserPresets('{')).toThrow();
  });

  it('names grid files without a path and suffixes repeats', () => {
    const used = new Set<string>();
    const first = gridFileName('dir/wing.PNG', used);
    used.add(first);
    expect(first).toBe('dirwing.grid.json');
    expect(gridFileName('dir/wing.png', used)).toBe('dirwing-2.grid.json');
  });

  it('counts differing cells only when the sizes match', () => {
    const eagle = BUILTIN_PRESETS.find((item) => item.id === 'builtin:eagle');
    const icon = BUILTIN_PRESETS.find((item) => item.id === 'builtin:icon');
    if (!eagle || !icon) throw new Error('missing builtin');
    const source = image(6, 6, 10);
    const a = pixelizeWithPreset(source, 'a.png', eagle);
    const b = pixelizeWithPreset(source, 'a.png', icon);
    expect(gridCellDiff(a, b)).toBeNull();
    expect(gridCellDiff(a, pixelizeWithPreset(source, 'a.png', eagle))).toBe(0);
    const other = pixelizeWithPreset(image(6, 6, 0), 'b.png', eagle);
    const diff = gridCellDiff(a, other);
    expect(diff).not.toBeNull();
    expect(diff).toBeGreaterThan(0);
  });
});

describe('grid zip', () => {
  it('stores files and reads them back, including a non-ascii name', () => {
    const text = new TextEncoder().encode('{"cells":[1]}\n');
    const zip = zipStore([
      { name: '翼.grid.json', bytes: text },
      { name: 'body.grid.json', bytes: new Uint8Array([1, 2, 3]) },
    ]);
    const files = unzipStore(zip);
    expect(files.map((file) => file.name)).toEqual(['翼.grid.json', 'body.grid.json']);
    expect(new TextDecoder().decode(files[0]?.bytes)).toBe('{"cells":[1]}\n');
    expect([...(files[1]?.bytes ?? [])]).toEqual([1, 2, 3]);
    expect(() => zipStore([{ name: 'a/b.json', bytes: text }])).toThrow();
  });
});
