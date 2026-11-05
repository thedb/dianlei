/**
 * Stage assembly on top of the current palette grid.
 * The preview itself is painted by main.ts with `blitPlacedSprite`.
 */

import {
  ENTITY_ANGLE_MAX,
  ENTITY_FILE_EXTENSION,
  ENTITY_HIT_MAX,
  ENTITY_HIT_MIN,
  ENTITY_LAYER_MAX,
  ENTITY_LAYER_MIN,
  ENTITY_POS_MAX,
  ENTITY_POS_MIN,
  createEmptyEntity,
  isEntityId,
  parseEntityFile,
  serializeEntityFile,
  stageDrawOrder,
  type EntityFile,
  type EntityPlacement,
  type EntityStage,
} from '@/game/art/entityFile';
import { parsePaletteGrid, serializePaletteGrid, type PaletteGridFile } from '@/game/art/gridFile';

export interface AssemblyPreview {
  stage: EntityStage;
  grids: EntityFile['grids'];
  hits: boolean;
}

export interface AssemblyHost {
  currentGrid(): PaletteGridFile | null;
  repaint(): void;
  download(filename: string, text: string): void;
  assetUrl(name: string): string;
}

let host: AssemblyHost | null = null;
let entity: EntityFile | null = null;
let stageId = '';
let partId = '';
let previewOn = false;
let hitsOn = true;

export function mountAssembly(next: AssemblyHost): void {
  host = next;
  const exampleButton = must(HTMLButtonElement, 'asm-example');
  const addButton = must(HTMLButtonElement, 'asm-add');
  const gridFile = must(HTMLInputElement, 'asm-grid-file');
  const entityFile = must(HTMLInputElement, 'asm-entity-file');
  const preview = must(HTMLInputElement, 'asm-preview');
  const hits = must(HTMLInputElement, 'asm-hits');
  const nameInput = must(HTMLInputElement, 'asm-name');
  const stageSelect = must(HTMLSelectElement, 'asm-stage');
  const stageIdInput = must(HTMLInputElement, 'asm-stage-id');
  const addStageButton = must(HTMLButtonElement, 'asm-add-stage');
  const exportButton = must(HTMLButtonElement, 'asm-export');
  const deleteButton = must(HTMLButtonElement, 'asm-delete');
  const flipInput = must(HTMLInputElement, 'asm-flip');
  const hitInput = must(HTMLInputElement, 'asm-hit');

  exampleButton.addEventListener('click', () => {
    loadExample().catch((error: unknown) => fail(error));
  });
  addButton.addEventListener('click', () => {
    const grid = next.currentGrid();
    if (!grid) {
      setStatus('先像素化一张图');
      return;
    }
    try {
      addGrid(grid);
    } catch (error) {
      fail(error);
    }
  });
  gridFile.addEventListener('change', () => {
    const file = gridFile.files?.[0];
    gridFile.value = '';
    if (!file) return;
    file
      .text()
      .then((text) => {
        addGrid(parsePaletteGrid(text));
      })
      .catch((error: unknown) => fail(error));
  });
  entityFile.addEventListener('change', () => {
    const file = entityFile.files?.[0];
    entityFile.value = '';
    if (!file) return;
    file
      .text()
      .then((text) => {
        adopt(parseEntityFile(text));
        showPreview();
        setStatus(`已载入 ${entity?.name ?? '装配'}`);
        repaint();
      })
      .catch((error: unknown) => fail(error));
  });
  preview.addEventListener('change', () => {
    previewOn = preview.checked;
    repaint();
  });
  hits.addEventListener('change', () => {
    hitsOn = hits.checked;
    repaint();
  });
  nameInput.addEventListener('change', () => {
    renameEntity(nameInput.value);
  });
  stageSelect.addEventListener('change', () => {
    stageId = stageSelect.value;
    const stage = currentStage();
    partId = stage?.parts[0]?.id ?? '';
    renderParts();
    fillFields();
    setStatus(stage && stage.parts.length === 0 ? '这个阶段没有部件' : '已切换阶段');
    repaint();
  });
  stageIdInput.addEventListener('change', () => {
    renameStage(stageIdInput.value.trim());
  });
  addStageButton.addEventListener('click', () => {
    addStage();
  });
  exportButton.addEventListener('click', () => {
    exportEntity();
  });
  deleteButton.addEventListener('click', () => {
    deletePart();
  });
  bindNumber('asm-x', (part, value) => {
    part.x = value;
  }, 'x', ENTITY_POS_MIN, ENTITY_POS_MAX);
  bindNumber('asm-y', (part, value) => {
    part.y = value;
  }, 'y', ENTITY_POS_MIN, ENTITY_POS_MAX);
  bindNumber('asm-px', (part, value, grid) => {
    if (value < 0 || value >= grid.width) throw new Error('轴心要落在部件像素内');
    part.pivot = { x: value, y: part.pivot.y };
  }, '轴心 x', 0, 1024);
  bindNumber('asm-py', (part, value, grid) => {
    if (value < 0 || value >= grid.height) throw new Error('轴心要落在部件像素内');
    part.pivot = { x: part.pivot.x, y: value };
  }, '轴心 y', 0, 1024);
  bindNumber('asm-layer', (part, value) => {
    part.layer = value;
  }, '层', ENTITY_LAYER_MIN, ENTITY_LAYER_MAX);
  const angleInput = must(HTMLInputElement, 'asm-angle');
  angleInput.addEventListener('input', () => {
    editPart((part) => {
      part.angle = readRadians(angleInput);
    }, false);
  });
  flipInput.addEventListener('change', () => {
    editPart((part) => {
      part.flipX = flipInput.checked;
    }, true);
  });
  hitInput.addEventListener('change', () => {
    editPart((part, grid) => {
      if (!hitInput.checked) {
        delete part.hit;
        return;
      }
      part.hit = part.hit ?? { x: 0, y: 0, w: grid.width, h: grid.height };
    }, true);
  });
  bindHit('asm-hx', 'x', '受击 x');
  bindHit('asm-hy', 'y', '受击 y');
  bindHit('asm-hw', 'w', '受击宽');
  bindHit('asm-hh', 'h', '受击高');
  hitsOn = hits.checked;
  setStatus('尚未装配。点「载入装配示例」，或把当前这张网格加进来。');
}

export function assemblyPreview(): AssemblyPreview | null {
  if (!previewOn || !entity) return null;
  const stage = entity.stages.find((item) => item.id === stageId) ?? entity.stages[0];
  if (!stage) return null;
  return { stage, grids: entity.grids, hits: hitsOn };
}

function loadExample(): Promise<void> {
  const current = host;
  if (!current) return Promise.resolve();
  return fetch(current.assetUrl('sample.entity.json')).then(async (response) => {
    if (!response.ok) throw new Error('装配示例读取失败');
    adopt(parseEntityFile(await response.text()));
    showPreview();
    setStatus('已载入 folded / half / open 示例');
    repaint();
  });
}

function addGrid(grid: PaletteGridFile): void {
  const backup = entity ? serializeEntityFile(entity) : null;
  try {
    const stored = parsePaletteGrid(serializePaletteGrid(grid));
    const current = ensure(entityNameFrom(stored.source.name));
    let gridId = matchingGridId(current.grids, stored);
    if (!gridId) {
      gridId = uniqueId(idFrom(stored.source.name), Object.keys(current.grids));
      current.grids[gridId] = stored;
    }
    const stage = current.stages.find((item) => item.id === stageId) ?? current.stages[0];
    if (!stage) throw new Error('没有阶段');
    const id = uniqueId(gridId, stage.parts.map((part) => part.id));
    const part: EntityPlacement = {
      id,
      grid: gridId,
      x: 0,
      y: 0,
      pivot: { x: Math.floor(stored.width / 2), y: Math.floor(stored.height / 2) },
      angle: 0,
      flipX: false,
      layer: nextLayer(stage.parts),
    };
    stage.parts.push(part);
    stageId = stage.id;
    partId = part.id;
    serializeEntityFile(current);
  } catch (error) {
    entity = backup ? parseEntityFile(backup) : null;
    if (!entity) hideEditor();
    else showEditor();
    throw error;
  }
  showPreview();
  showEditor();
  setStatus(`已加入 ${partId}`);
  repaint();
}

function adopt(next: EntityFile): void {
  entity = next;
  stageId = next.stages[0]?.id ?? '';
  partId = next.stages[0]?.parts[0]?.id ?? '';
  showEditor();
}

function renameEntity(name: string): void {
  if (!entity) return;
  const backup = serializeEntityFile(entity);
  entity.name = name;
  try {
    serializeEntityFile(entity);
  } catch (error) {
    entity = parseEntityFile(backup);
    fillName();
    fail(error);
    return;
  }
  setStatus('已更新名称');
}

function renameStage(next: string): void {
  if (!entity) return;
  const stage = currentStage();
  if (!stage) return;
  if (!isEntityId(next)) {
    fillStageId();
    setStatus('阶段 id 只能是字母、数字、_ 或 -');
    return;
  }
  if (next !== stage.id && entity.stages.some((item) => item.id === next)) {
    fillStageId();
    setStatus('阶段 id 重复');
    return;
  }
  const backup = serializeEntityFile(entity);
  stage.id = next;
  try {
    serializeEntityFile(entity);
  } catch (error) {
    entity = parseEntityFile(backup);
    fillStageId();
    fail(error);
    return;
  }
  stageId = next;
  renderStages();
  setStatus('已更新阶段');
  repaint();
}

function addStage(): void {
  if (!entity) return;
  if (entity.stages.length >= 16) {
    setStatus('阶段数量已满');
    return;
  }
  const id = uniqueId('stage', entity.stages.map((stage) => stage.id));
  entity.stages.push({ id, parts: [] });
  stageId = id;
  partId = '';
  try {
    serializeEntityFile(entity);
  } catch (error) {
    entity.stages.pop();
    fail(error);
    return;
  }
  showEditor();
  setStatus('已新建阶段');
  repaint();
}

function deletePart(): void {
  const stage = currentStage();
  if (!stage) return;
  stage.parts = stage.parts.filter((part) => part.id !== partId);
  partId = stage.parts[0]?.id ?? '';
  renderParts();
  fillFields();
  setStatus(stage.parts.length === 0 ? '这个阶段没有部件' : '已删除部件');
  repaint();
}

function exportEntity(): void {
  if (!entity) return;
  try {
    const text = serializeEntityFile(entity);
    host?.download(`${entity.name}${ENTITY_FILE_EXTENSION}`, text);
    setStatus('已开始下载装配文件');
  } catch (error) {
    fail(error);
  }
}

function bindNumber(
  id: string,
  apply: (part: EntityPlacement, value: number, grid: PaletteGridFile) => void,
  label: string,
  min: number,
  max: number
): void {
  const input = must(HTMLInputElement, id);
  input.addEventListener('input', () => {
    editPart((part, grid) => {
      apply(part, readInt(input, label, min, max), grid);
    }, false);
  });
}

function bindHit(id: string, key: 'x' | 'y' | 'w' | 'h', label: string): void {
  const input = must(HTMLInputElement, id);
  const min = key === 'w' || key === 'h' ? 1 : ENTITY_HIT_MIN;
  const max = ENTITY_HIT_MAX;
  input.addEventListener('input', () => {
    editPart((part) => {
      if (!part.hit) return;
      part.hit[key] = readInt(input, label, min, max);
    }, false);
  });
}

function editPart(
  apply: (part: EntityPlacement, grid: PaletteGridFile) => void,
  fill: boolean
): void {
  if (!entity) return;
  const backup = serializeEntityFile(entity);
  try {
    const located = locate();
    if (!located) return;
    apply(located.part, located.grid);
    serializeEntityFile(entity);
  } catch (error) {
    entity = parseEntityFile(backup);
    if (fill) fillFields();
    fail(error);
    return;
  }
  setStatus('已更新');
  renderParts();
  if (fill) fillFields();
  repaint();
}

function ensure(name: string): EntityFile {
  if (!entity) {
    entity = createEmptyEntity(name);
    stageId = entity.stages[0]?.id ?? '';
    partId = '';
  }
  return entity;
}

function showEditor(): void {
  const editor = must(HTMLDivElement, 'asm-editor');
  editor.hidden = entity === null;
  if (!entity) return;
  fillName();
  renderStages();
  renderParts();
  fillFields();
}

function hideEditor(): void {
  must(HTMLDivElement, 'asm-editor').hidden = true;
}

function showPreview(): void {
  previewOn = true;
  must(HTMLInputElement, 'asm-preview').checked = true;
}

function renderStages(): void {
  const select = must(HTMLSelectElement, 'asm-stage');
  select.replaceChildren();
  if (!entity) return;
  for (const stage of entity.stages) {
    const option = document.createElement('option');
    option.value = stage.id;
    option.textContent = stage.name ? `${stage.id} ${stage.name}` : stage.id;
    select.append(option);
  }
  select.value = stageId;
  fillStageId();
}

function renderParts(): void {
  const box = must(HTMLDivElement, 'asm-parts');
  box.replaceChildren();
  const stage = currentStage();
  if (!stage) return;
  for (const index of stageDrawOrder(stage.parts)) {
    const part = stage.parts[index];
    if (!part) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${part.id} · ${part.grid} · L${part.layer}`;
    button.setAttribute('aria-pressed', part.id === partId ? 'true' : 'false');
    button.addEventListener('click', () => {
      partId = part.id;
      renderParts();
      fillFields();
      repaint();
    });
    box.append(button);
  }
}

function fillFields(): void {
  const fields = must(HTMLDivElement, 'asm-fields');
  const located = locate();
  fields.hidden = located === null;
  if (!located) return;
  const { part, grid } = located;
  must(HTMLInputElement, 'asm-x').value = String(part.x);
  must(HTMLInputElement, 'asm-y').value = String(part.y);
  must(HTMLInputElement, 'asm-px').value = String(part.pivot.x);
  must(HTMLInputElement, 'asm-py').value = String(part.pivot.y);
  must(HTMLInputElement, 'asm-angle').value = formatDeg(part.angle);
  must(HTMLInputElement, 'asm-flip').checked = part.flipX;
  must(HTMLInputElement, 'asm-layer').value = String(part.layer);
  must(HTMLInputElement, 'asm-hit').checked = part.hit !== undefined;
  must(HTMLInputElement, 'asm-hx').value = String(part.hit?.x ?? 0);
  must(HTMLInputElement, 'asm-hy').value = String(part.hit?.y ?? 0);
  must(HTMLInputElement, 'asm-hw').value = String(part.hit?.w ?? grid.width);
  must(HTMLInputElement, 'asm-hh').value = String(part.hit?.h ?? grid.height);
  must(HTMLDivElement, 'asm-hit-box').hidden = part.hit === undefined;
}

function fillName(): void {
  if (!entity) return;
  must(HTMLInputElement, 'asm-name').value = entity.name;
}

function fillStageId(): void {
  must(HTMLInputElement, 'asm-stage-id').value = currentStage()?.id ?? '';
}

function currentStage(): EntityStage | null {
  if (!entity) return null;
  return entity.stages.find((stage) => stage.id === stageId) ?? null;
}

function locate(): { part: EntityPlacement; grid: PaletteGridFile; stage: EntityStage } | null {
  const stage = currentStage();
  if (!entity || !stage) return null;
  const part = stage.parts.find((item) => item.id === partId);
  if (!part) return null;
  const grid = entity.grids[part.grid];
  if (!grid) return null;
  return { part, grid, stage };
}

function matchingGridId(grids: EntityFile['grids'], grid: PaletteGridFile): string | null {
  const text = serializePaletteGrid(grid);
  for (const [id, existing] of Object.entries(grids)) {
    if (serializePaletteGrid(existing) === text) return id;
  }
  return null;
}

function entityNameFrom(source: string): string {
  const stem = source.replace(/\.png$/i, '').replace(/\.grid\.json$/i, '');
  const cleaned = stem.replace(/[/\\]/g, '');
  if (cleaned.length < 1) return 'entity';
  return cleaned.slice(0, 128);
}

function idFrom(name: string): string {
  const stem = name.replace(/\.grid\.json$/i, '').replace(/\.png$/i, '');
  const cleaned = stem.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24);
  return cleaned.length > 0 ? cleaned : 'grid';
}

function uniqueId(base: string, used: readonly string[]): string {
  if (!used.includes(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const id = `${base}-${n}`.slice(0, 32);
    if (!used.includes(id)) return id;
  }
  throw new Error('id 已用尽');
}

function nextLayer(parts: readonly EntityPlacement[]): number {
  let max = -1;
  for (const part of parts) max = Math.max(max, part.layer);
  return Math.min(ENTITY_LAYER_MAX, max + 1);
}

function readInt(input: HTMLInputElement, label: string, min: number, max: number): number {
  const value = Number(input.value);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label}需为 ${min}–${max} 的整数`);
  }
  return value;
}

function readRadians(input: HTMLInputElement): number {
  const deg = Number(input.value);
  if (!Number.isFinite(deg)) throw new Error('角度需为数字');
  const rad = (deg * Math.PI) / 180;
  if (Math.abs(rad) > ENTITY_ANGLE_MAX) throw new Error('角度超出范围');
  return rad;
}

function formatDeg(rad: number): string {
  const deg = (rad * 180) / Math.PI;
  return String(Math.round(deg * 1000) / 1000);
}

function repaint(): void {
  host?.repaint();
}

function setStatus(message: string): void {
  must(HTMLParagraphElement, 'asm-status').textContent = message;
}

function fail(error: unknown): void {
  setStatus(error instanceof Error ? error.message : '装配失败');
}

function must<T extends HTMLElement>(ctor: new () => T, id: string): T {
  const el = document.getElementById(id);
  if (!(el instanceof ctor)) throw new Error(`missing #${id}`);
  return el;
}
