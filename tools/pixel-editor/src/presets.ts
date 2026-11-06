/**
 * Preset controls in the part dialog. Built-ins come from `pixelizePreset`.
 * User presets live in localStorage on this browser only.
 */

import {
  BUILTIN_PRESETS,
  PRESET_USER_MAX,
  createUserPreset,
  resolvedTarget,
  type PixelizePreset,
} from '@/game/art/pixelizePreset';
import type { PixelHost } from './pixelHost';
import { loadUserPresets, saveUserPresets, userPresets } from './presetStore';

let host: PixelHost | null = null;
const listeners = new Set<() => void>();

export function onPresetsChanged(listener: () => void): void {
  listeners.add(listener);
}

export function listPresets(): readonly PixelizePreset[] {
  return [...BUILTIN_PRESETS, ...userPresets()];
}

export function mountPresets(next: PixelHost): void {
  host = next;
  loadUserPresets();
  must(HTMLSelectElement, 'preset').addEventListener('change', () => {
    showSelected();
  });
  must(HTMLButtonElement, 'preset-apply').addEventListener('click', () => {
    applySelected();
  });
  must(HTMLButtonElement, 'preset-save').addEventListener('click', () => {
    saveCurrent();
  });
  must(HTMLButtonElement, 'preset-delete').addEventListener('click', () => {
    deleteSelected();
  });
  fillPresetSelects();
}

/** Refill every `[data-presets]` select, then tell compare and batch. */
export function fillPresetSelects(): void {
  for (const select of document.querySelectorAll<HTMLSelectElement>('select[data-presets]')) {
    fillOne(select);
  }
  showSelected();
  for (const listener of listeners) listener();
}

function fillOne(select: HTMLSelectElement): void {
  const current = select.value;
  select.replaceChildren();
  if (select.dataset['blank'] === '1') select.append(option('', '选择预设'));
  if (select.dataset['form'] === '1') select.append(option('form', '零件预览里的当前参数'));
  select.append(group('内置', BUILTIN_PRESETS));
  const mine = userPresets();
  if (mine.length > 0) select.append(group('我的', mine));
  if ([...select.options].some((item) => item.value === current)) select.value = current;
}

function group(label: string, presets: readonly PixelizePreset[]): HTMLOptGroupElement {
  const box = document.createElement('optgroup');
  box.label = label;
  for (const preset of presets) box.append(option(preset.id, preset.name));
  return box;
}

function option(value: string, label: string): HTMLOptionElement {
  const item = document.createElement('option');
  item.value = value;
  item.textContent = label;
  return item;
}

function applySelected(): void {
  const preset = selected();
  if (!preset || !host) {
    note('先选一套预设。');
    return;
  }
  const image = host.image();
  host.write(preset, resolvedTarget(preset, image));
  host.redraw();
  note(preset.note || `已套用「${preset.name}」。`);
}

function saveCurrent(): void {
  if (!host) return;
  if (userPresets().length >= PRESET_USER_MAX) {
    note(`最多保存 ${PRESET_USER_MAX} 套。先删掉不用的。`);
    return;
  }
  try {
    const draft = host.readDraft();
    const preset = createUserPreset(
      { ...draft, name: must(HTMLInputElement, 'preset-name').value, note: '自己保存的参数' },
      userPresets().map((item) => item.id)
    );
    saveUserPresets([...userPresets(), preset]);
    fillPresetSelects();
    must(HTMLSelectElement, 'preset').value = preset.id;
    showSelected();
    note(`已保存「${preset.name}」。只存在这台浏览器。`);
  } catch (error) {
    note(error instanceof Error ? error.message : '保存失败');
  }
}

function deleteSelected(): void {
  const preset = selected();
  if (!preset || preset.builtin) return;
  saveUserPresets(userPresets().filter((item) => item.id !== preset.id));
  fillPresetSelects();
  note(`已删除「${preset.name}」。`);
}

function showSelected(): void {
  const preset = selected();
  must(HTMLButtonElement, 'preset-delete').disabled = preset === null || preset.builtin;
  must(HTMLSelectElement, 'preset').title =
    preset?.note ?? '选一套参数，再点套用。调色板固定为游戏的 52 色。';
  if (preset?.note) note(preset.note);
}

function selected(): PixelizePreset | null {
  const id = must(HTMLSelectElement, 'preset').value;
  return listPresets().find((item) => item.id === id) ?? null;
}

function note(text: string): void {
  must(HTMLParagraphElement, 'preset-note').textContent = text;
}

function must<T extends HTMLElement>(ctor: new () => T, id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof ctor)) throw new Error(`missing #${id}`);
  return element;
}
