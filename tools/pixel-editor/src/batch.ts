/**
 * Batch pixelize (P2). Every file goes through `pixelizeWithPreset`, then the
 * successes are one STORE zip of `*.grid.json`.
 */

import { serializePaletteGrid } from '@/game/art/gridFile';
import { zipStore, type ZipEntry } from '@/game/art/gridZip';
import {
  createUserPreset,
  gridFileName,
  pixelizeWithPreset,
  type PixelizePreset,
} from '@/game/art/pixelizePreset';
import type { PixelHost } from './pixelHost';
import { listPresets } from './presets';

const FILE_CAP = 64;

let host: PixelHost | null = null;
let running = false;
let pending: File[] = [];
let packed: ZipEntry[] = [];

export function mountBatch(next: PixelHost): void {
  host = next;
  const dialog = must(HTMLDialogElement, 'batch-dialog');
  must(HTMLButtonElement, 'batch-open').addEventListener('click', () => {
    if (!dialog.open) dialog.showModal();
  });
  must(HTMLButtonElement, 'batch-close').addEventListener('click', () => {
    dialog.close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  must(HTMLInputElement, 'batch-files').addEventListener('change', () => {
    takeFiles(must(HTMLInputElement, 'batch-files'));
  });
  must(HTMLInputElement, 'batch-dir').addEventListener('change', () => {
    takeFiles(must(HTMLInputElement, 'batch-dir'));
  });
  must(HTMLButtonElement, 'batch-run').addEventListener('click', () => {
    run().catch((error: unknown) => {
      progress(error instanceof Error ? error.message : '批量失败');
      running = false;
    });
  });
  must(HTMLButtonElement, 'batch-zip').addEventListener('click', () => {
    if (!host || packed.length < 1) return;
    host.downloadBytes('grids.zip', zipStore(packed), 'application/zip');
  });
}

function takeFiles(input: HTMLInputElement): void {
  pending = [...(input.files ?? [])];
  input.value = '';
  packed = [];
  must(HTMLButtonElement, 'batch-zip').disabled = true;
  must(HTMLUListElement, 'batch-list').replaceChildren();
  progress(pending.length > 0 ? `已选 ${pending.length} 个文件。点「开始」。` : '还没有文件。');
}

async function run(): Promise<void> {
  if (!host || running) return;
  const preset = presetForRun();
  if (!preset) return;
  if (pending.length < 1) {
    progress('先选多张 PNG，或选一个文件夹。');
    return;
  }
  const files = pending.slice(0, FILE_CAP);
  running = true;
  packed = [];
  must(HTMLButtonElement, 'batch-run').disabled = true;
  must(HTMLButtonElement, 'batch-zip').disabled = true;
  const list = must(HTMLUListElement, 'batch-list');
  list.replaceChildren();
  const used = new Set<string>();
  let ok = 0;
  let failed = 0;
  let skipped = 0;
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    if (!file) continue;
    progress(`正在处理 ${index + 1}/${files.length} ${file.name}`);
    if (!file.name.toLowerCase().endsWith('.png')) {
      skipped++;
      addRow(list, 'bad', `${file.name}：跳过，不是 PNG`);
      continue;
    }
    try {
      const image = await host.decode(new Uint8Array(await file.arrayBuffer()));
      const grid = pixelizeWithPreset(image, file.name, preset);
      const filename = gridFileName(file.name, used);
      used.add(filename);
      packed.push({
        name: filename,
        bytes: new TextEncoder().encode(serializePaletteGrid(grid)),
      });
      ok++;
      addRow(list, 'ok', `${file.name} → ${filename}　${grid.width}×${grid.height}`);
    } catch (error) {
      failed++;
      addRow(list, 'bad', `${file.name}：${error instanceof Error ? error.message : '失败'}`);
    }
  }
  const extra = pending.length > FILE_CAP ? `只处理前 ${FILE_CAP} 个。` : '';
  progress(`${extra}完成 ${ok} 张，失败 ${failed}，跳过 ${skipped}。`);
  must(HTMLButtonElement, 'batch-zip').disabled = packed.length < 1;
  must(HTMLButtonElement, 'batch-run').disabled = false;
  running = false;
}

function presetForRun(): PixelizePreset | null {
  if (!host) return null;
  const id = must(HTMLSelectElement, 'batch-preset').value;
  if (id === 'form') {
    try {
      const draft = host.readDraft();
      return createUserPreset({ ...draft, name: '当前参数', note: '' }, []);
    } catch (error) {
      progress(error instanceof Error ? error.message : '当前参数无效');
      return null;
    }
  }
  const preset = listPresets().find((item) => item.id === id) ?? null;
  if (!preset) progress('先选一套预设，或选「当前参数」。');
  return preset;
}

function addRow(list: HTMLUListElement, kind: 'ok' | 'bad', text: string): void {
  const row = document.createElement('li');
  row.className = kind;
  row.textContent = text;
  list.append(row);
}

function progress(text: string): void {
  must(HTMLParagraphElement, 'batch-progress').textContent = text;
}

function must<T extends HTMLElement>(ctor: new () => T, id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof ctor)) throw new Error(`missing #${id}`);
  return element;
}
