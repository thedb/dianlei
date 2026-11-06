import type { PaletteGridFile } from '@/game/art/gridFile';
import type { PixelizePreset } from '@/game/art/pixelizePreset';
import type { RgbaImage } from '@/game/art/pixelize';

/** What the preset, compare, and batch panels need from the part dialog. */
export interface PixelHost {
  image(): RgbaImage | null;
  sourceName(): string;
  grid(): PaletteGridFile | null;
  /** Current part-dialog knobs. Throws when a field is not a valid number. */
  readDraft(): {
    targetWidth: number;
    targetHeight: number;
    sample: PixelizePreset['sample'];
    quantize: PixelizePreset['quantize'];
    alphaCutoff: number;
    ditherStrength: number;
    lockRatio: boolean;
  };
  /** Put a preset into the part-dialog fields. Does not pixelize by itself. */
  write(preset: PixelizePreset, size: { width: number; height: number }): void;
  redraw(): void;
  decode(bytes: Uint8Array): Promise<RgbaImage>;
  downloadText(filename: string, text: string): void;
  downloadBytes(filename: string, bytes: Uint8Array, type: string): void;
}
