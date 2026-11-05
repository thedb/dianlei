/**
 * Stage assembly on the main screen. The part canvas is a separate dialog.
 * Sprites go through `blitPlacedSprite`. Hit boxes and the selection outline are strokes after that.
 * Selecting a part opens the inspector; Esc, its close button, or a miss on the canvas leaves it.
 */

import { LOGICAL_W } from '@/game/config';
import { EXTERIOR_VOID } from '@/engine/exterior';
import { COLOR, PALETTE } from '@/game/palette';
import {
  ENTITY_ANGLE_MAX,
  ENTITY_FILE_EXTENSION,
  ENTITY_FRAME_MAX,
  ENTITY_FRAME_MIN,
  ENTITY_HIT_MAX,
  ENTITY_HIT_MIN,
  ENTITY_LAYER_MAX,
  ENTITY_LAYER_MIN,
  ENTITY_MAX_ANCHORS,
  ENTITY_MAX_STAGES,
  ENTITY_POS_MAX,
  ENTITY_POS_MIN,
  ENTITY_SCALE_MAX,
  ENTITY_SCALE_MIN,
  clonePlacement,
  cloneStage,
  copyPartToStage,
  createEmptyEntity,
  hitRole,
  isEntityId,
  parseEntityFile,
  placedAnchor,
  placedHitLocal,
  placedSprite,
  placementContains,
  placementCorners,
  previewFrameRect,
  serializeEntityFile,
  stageBounds,
  stageDrawOrder,
  suggestedPreviewFrame,
  type EntityAnchor,
  type EntityAnchorKind,
  type EntityFile,
  type EntityPlacement,
  type EntityStage,
} from '@/game/art/entityFile';
import { parsePaletteGrid, serializePaletteGrid, type PaletteGridFile } from '@/game/art/gridFile';
import { gridColorStats } from '@/game/art/gridStats';
import { blitPlacedSprite, renderSprite } from '@/game/art/spriteRenderer';
import { colorWarnings, renderColorStats } from './colorStats';

export interface AssemblyHost {
  currentGrid(): PaletteGridFile | null;
  download(filename: string, text: string): void;
  assetUrl(name: string): string;
}

let host: AssemblyHost | null = null;
let entity: EntityFile | null = null;
let stageId = '';
let partId = '';
let hitsOn = true;
/** Quiet box before any assembly is loaded. Not the logical screen. */
const FRAME_PLACEHOLDER = 32;
let frameW = FRAME_PLACEHOLDER;
let frameH = FRAME_PLACEHOLDER;
let frameDirty = false;
let viewMap: { scale: number; minX: number; minY: number; bleed: number } | null = null;

const FRAME_BLEED = 2;
/** Anchor flicker period. Only repaints while a visible anchor exists. */
const FLICKER_MS = 120;
const PLAY_MS = 600;
const BANK_STAGE_IDS = ['t0', 't1', 't2', 't3', 't4', 't5'] as const;
const NUDGE_STEP = 1;
const NUDGE_SHIFT_STEP = 8;

let anchorsOn = true;
let refSize: { width: number; height: number } | null = null;
let flickerPhase = false;
let playTimer: number | null = null;

export function mountAssembly(next: AssemblyHost): void {
  host = next;
  const exampleButton = must(HTMLButtonElement, 'asm-example');
  const moveButton = must(HTMLButtonElement, 'asm-move');
  const gridFile = must(HTMLInputElement, 'asm-grid-file');
  const entityFile = must(HTMLInputElement, 'asm-entity-file');
  const hits = must(HTMLInputElement, 'asm-hits');
  const nameInput = must(HTMLInputElement, 'asm-name');
  const stageSelect = must(HTMLSelectElement, 'asm-stage');
  const stageIdInput = must(HTMLInputElement, 'asm-stage-id');
  const addStageButton = must(HTMLButtonElement, 'asm-add-stage');
  const exportButton = must(HTMLButtonElement, 'asm-export');
  const deleteButton = must(HTMLButtonElement, 'asm-delete');
  const flipInput = must(HTMLInputElement, 'asm-flip');
  const roleInput = must(HTMLSelectElement, 'asm-hit-role');

  exampleButton.addEventListener('click', () => {
    if (exampleButton.disabled) return;
    loadExample().catch((error: unknown) => fail(error));
  });
  must(HTMLButtonElement, 'asm-clear').addEventListener('click', () => {
    clearAssembly();
  });
  moveButton.addEventListener('click', () => {
    const grid = next.currentGrid();
    if (!grid) {
      const message = '先在零件预览里载入一张零件';
      setStatus(message);
      notePart(message);
      return;
    }
    try {
      addGrid(grid);
      closePartDialog();
    } catch (error) {
      fail(error);
      notePart(error instanceof Error ? error.message : '移入失败');
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
        setStatus(frameStatus(`已载入 ${entity?.name ?? '装配'}`));
        paintAssembly();
      })
      .catch((error: unknown) => fail(error));
  });
  hits.addEventListener('change', () => {
    hitsOn = hits.checked;
    paintAssembly();
  });
  const anchorsToggle = must(HTMLInputElement, 'asm-anchors');
  anchorsToggle.addEventListener('change', () => {
    anchorsOn = anchorsToggle.checked;
    paintAssembly();
  });
  const refSelect = must(HTMLSelectElement, 'asm-ref');
  refSelect.addEventListener('change', () => {
    refSize = parseRef(refSelect.value);
    paintAssembly();
    setStatus(refSize ? `对照 ${refSize.width}×${refSize.height}` : '不对照尺寸');
  });
  must(HTMLInputElement, 'asm-stage-name').addEventListener('change', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement) renameStageLabel(input.value.trim());
  });
  must(HTMLButtonElement, 'asm-dup-stage').addEventListener('click', () => {
    duplicateStage();
  });
  must(HTMLButtonElement, 'asm-del-stage').addEventListener('click', () => {
    deleteStage();
  });
  must(HTMLButtonElement, 'asm-bank').addEventListener('click', () => {
    addBankStages();
  });
  must(HTMLButtonElement, 'asm-play').addEventListener('click', () => {
    togglePlay();
  });
  must(HTMLButtonElement, 'asm-dup-part').addEventListener('click', () => {
    duplicatePart();
  });
  must(HTMLButtonElement, 'asm-copy-part').addEventListener('click', () => {
    copyPartAcross();
  });
  must(HTMLButtonElement, 'asm-add-exhaust').addEventListener('click', () => {
    addAnchor('exhaust');
  });
  must(HTMLButtonElement, 'asm-add-muzzle').addEventListener('click', () => {
    addAnchor('muzzle');
  });
  window.setInterval(() => {
    if (document.hidden || !stageHasVisibleAnchor()) return;
    flickerPhase = !flickerPhase;
    paintAssembly();
  }, FLICKER_MS);
  const frameWidth = must(HTMLInputElement, 'asm-frame-w');
  const frameHeight = must(HTMLInputElement, 'asm-frame-h');
  frameWidth.addEventListener('input', () => {
    commitFrame(frameWidth, frameHeight);
  });
  frameHeight.addEventListener('input', () => {
    commitFrame(frameWidth, frameHeight);
  });
  must(HTMLButtonElement, 'asm-frame-fit').addEventListener('click', () => {
    fitFrame();
  });
  nameInput.addEventListener('change', () => {
    renameEntity(nameInput.value);
  });
  stageSelect.addEventListener('change', () => {
    stopPlay();
    stageId = stageSelect.value;
    partId = '';
    const stage = currentStage();
    renderParts();
    fillFields();
    setStatus(stage && stage.parts.length === 0 ? '这个阶段没有部件' : '已切换阶段');
    paintAssembly();
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
  bindNumber(
    'asm-x',
    (part, value) => {
      part.x = value;
    },
    'x',
    ENTITY_POS_MIN,
    ENTITY_POS_MAX
  );
  bindNumber(
    'asm-y',
    (part, value) => {
      part.y = value;
    },
    'y',
    ENTITY_POS_MIN,
    ENTITY_POS_MAX
  );
  bindNumber(
    'asm-px',
    (part, value, grid) => {
      if (value < 0 || value >= grid.width) throw new Error('轴心要落在部件像素内');
      part.pivot = { x: value, y: part.pivot.y };
    },
    '轴心 x',
    0,
    1024
  );
  bindNumber(
    'asm-py',
    (part, value, grid) => {
      if (value < 0 || value >= grid.height) throw new Error('轴心要落在部件像素内');
      part.pivot = { x: part.pivot.x, y: value };
    },
    '轴心 y',
    0,
    1024
  );
  bindNumber(
    'asm-layer',
    (part, value) => {
      part.layer = value;
    },
    '层',
    ENTITY_LAYER_MIN,
    ENTITY_LAYER_MAX
  );
  const scaleInput = must(HTMLInputElement, 'asm-scale');
  scaleInput.addEventListener('input', () => {
    editPart((part) => {
      part.scale = readScale(scaleInput);
    }, false);
  });
  must(HTMLButtonElement, 'asm-layer-up').addEventListener('click', () => {
    moveLayer(1);
  });
  must(HTMLButtonElement, 'asm-layer-down').addEventListener('click', () => {
    moveLayer(-1);
  });
  must(HTMLCanvasElement, 'asm-view').addEventListener('click', (event) => {
    selectAt(event);
  });
  must(HTMLButtonElement, 'asm-inspector-close').addEventListener('click', () => {
    clearSelection();
  });
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('dialog')) return;
    if (event.key === 'Escape') {
      clearSelection();
      return;
    }
    const step = event.shiftKey ? NUDGE_SHIFT_STEP : NUDGE_STEP;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = delta[event.key];
    if (!move || !partId) return;
    if (target instanceof Element && target.closest('input, select, textarea')) return;
    if (document.querySelector('dialog[open]')) return;
    event.preventDefault();
    editPart((part) => {
      part.x += move[0];
      part.y += move[1];
    }, true);
  });
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
  roleInput.addEventListener('change', () => {
    editPart((part, grid) => {
      if (roleInput.value === 'none') {
        delete part.hit;
        return;
      }
      const hit = part.hit ?? { x: 0, y: 0, w: grid.width, h: grid.height };
      if (roleInput.value === 'block') hit.role = 'block';
      else delete hit.role;
      part.hit = hit;
    }, true);
  });
  const hitShape = must(HTMLSelectElement, 'asm-hit-shape');
  hitShape.addEventListener('change', () => {
    editPart((part) => {
      const hit = part.hit;
      if (!hit) return;
      if (hitShape.value === 'circle' && hit.shape !== 'circle') {
        const radius = Math.max(1, Math.round(Math.max(hit.w, hit.h) / 2));
        part.hit = {
          shape: 'circle',
          x: hit.x + Math.round(hit.w / 2),
          y: hit.y + Math.round(hit.h / 2),
          r: radius,
        };
      } else if (hitShape.value === 'rect' && hit.shape === 'circle') {
        part.hit = {
          x: hit.x - hit.r,
          y: hit.y - hit.r,
          w: hit.r * 2,
          h: hit.r * 2,
        };
      }
      if (hit.role === 'block' && part.hit) part.hit.role = 'block';
    }, true);
  });
  bindHit('asm-hx', 'x', '受击 x');
  bindHit('asm-hy', 'y', '受击 y');
  bindHit('asm-hw', 'w', '受击宽');
  bindHit('asm-hh', 'h', '受击高');
  bindHit('asm-hcx', 'x', '圆心 x');
  bindHit('asm-hcy', 'y', '圆心 y');
  bindHit('asm-hr', 'r', '半径');
  hitsOn = hits.checked;
  syncFrameInputs();
  setStatus('尚未装配。点「零件预览」做好一张再移入装配，或点「载入装配示例」。');
  syncSampleLocks();
  paintAssembly();
}

function loadExample(): Promise<void> {
  const current = host;
  if (!current) return Promise.resolve();
  return fetch(current.assetUrl('sample.entity.json')).then(async (response) => {
    if (!response.ok) throw new Error('装配示例读取失败');
    adopt(parseEntityFile(await response.text()));
    setStatus(frameStatus('已载入 folded / half / open 示例'));
    paintAssembly();
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
    const id = uniqueId(
      gridId,
      stage.parts.map((part) => part.id)
    );
    const part: EntityPlacement = {
      id,
      grid: gridId,
      x: 0,
      y: 0,
      pivot: { x: Math.floor(stored.width / 2), y: Math.floor(stored.height / 2) },
      angle: 0,
      flipX: false,
      scale: 1,
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
  showEditor();
  if (!frameDirty && entity) {
    const fit = contentFrame(entity);
    frameW = fit.width;
    frameH = fit.height;
    syncFrameInputs();
  }
  const warnings = colorWarnings(gridColorStats(grid.cells));
  const note = warnings.length > 0 ? `。注意：${warnings.join(' ')}` : '';
  setStatus(frameStatus(`已移入装配 ${partId}`) + note);
  paintAssembly();
}

function adopt(next: EntityFile): void {
  stopPlay();
  entity = next;
  stageId = next.stages[0]?.id ?? '';
  partId = '';
  if (next.previewFrame) {
    frameW = next.previewFrame.width;
    frameH = next.previewFrame.height;
    frameDirty = true;
  } else {
    const fit = contentFrame(next);
    frameW = fit.width;
    frameH = fit.height;
    frameDirty = false;
  }
  syncFrameInputs();
  showEditor();
  syncSampleLocks();
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
  paintAssembly();
}

function addStage(): void {
  if (!entity) return;
  if (entity.stages.length >= 16) {
    setStatus('阶段数量已满');
    return;
  }
  const id = uniqueId(
    'stage',
    entity.stages.map((stage) => stage.id)
  );
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
  syncSampleLocks();
  setStatus('已新建阶段');
  paintAssembly();
}

function deletePart(): void {
  const stage = currentStage();
  if (!stage) return;
  stage.parts = stage.parts.filter((part) => part.id !== partId);
  partId = '';
  renderParts();
  fillFields();
  syncSampleLocks();
  setStatus(stage.parts.length === 0 ? '这个阶段没有部件' : '已删除部件');
  paintAssembly();
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

function bindHit(id: string, key: 'x' | 'y' | 'w' | 'h' | 'r', label: string): void {
  const input = must(HTMLInputElement, id);
  const min = key === 'w' || key === 'h' || key === 'r' ? 1 : ENTITY_HIT_MIN;
  const max = ENTITY_HIT_MAX;
  input.addEventListener('input', () => {
    editPart((part) => {
      const hit = part.hit;
      if (!hit) return;
      const value = readInt(input, label, min, max);
      if (hit.shape === 'circle') {
        if (key === 'x' || key === 'y' || key === 'r') hit[key] = value;
        return;
      }
      if (key === 'x' || key === 'y' || key === 'w' || key === 'h') hit[key] = value;
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
  paintAssembly();
}

function ensure(name: string): EntityFile {
  if (!entity) {
    entity = createEmptyEntity(name);
    stageId = entity.stages[0]?.id ?? '';
    partId = '';
    rememberFrame();
  }
  return entity;
}

function assemblyHasParts(): boolean {
  return entity?.stages.some((stage) => stage.parts.length > 0) ?? false;
}

function syncSampleLocks(): void {
  const busy = assemblyHasParts();
  const example = must(HTMLButtonElement, 'asm-example');
  const fixture = must(HTMLButtonElement, 'fixture');
  example.disabled = busy;
  fixture.disabled = busy;
  must(HTMLButtonElement, 'asm-clear').disabled = entity === null;
  example.title = busy
    ? '装配里已有零件。先点「清空装配」再载入装配示例。'
    : '打开样例装配：机身加一对翼，三个阶段 folded / half / open。用来冒烟，不是现役 Boss。';
  fixture.title = busy
    ? '装配里已有零件。先点「清空装配」再载入示例。'
    : '打开仓库自带的 8×8 样例图，练手用，不是游戏正式资产。';
}

function clearAssembly(): void {
  stopPlay();
  entity = null;
  stageId = '';
  partId = '';
  frameW = FRAME_PLACEHOLDER;
  frameH = FRAME_PLACEHOLDER;
  frameDirty = false;
  syncFrameInputs();
  hideEditor();
  must(HTMLDivElement, 'asm-parts').replaceChildren();
  fillFields();
  syncSampleLocks();
  paintAssembly();
  setStatus('已清空装配。可以再载入示例。');
}

function showEditor(): void {
  const editor = must(HTMLDivElement, 'asm-editor');
  editor.hidden = entity === null;
  if (!entity) return;
  fillName();
  renderStages();
  renderParts();
  fillFields();
  syncSampleLocks();
}

function hideEditor(): void {
  must(HTMLDivElement, 'asm-editor').hidden = true;
  syncSampleLocks();
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
    const role = part.hit ? (hitRole(part.hit) === 'block' ? ' · 阻挡' : ' · 可打') : '';
    const marks = part.anchors?.length ? ` · 锚点 ${part.anchors.length}` : '';
    button.textContent = `L${part.layer} ${part.id} · ${part.grid}${role}${marks}`;
    button.setAttribute('aria-pressed', part.id === partId ? 'true' : 'false');
    button.addEventListener('click', () => {
      partId = part.id;
      renderParts();
      fillFields();
      paintAssembly();
      setStatus(`已选中 ${part.id}`);
    });
    box.append(button);
  }
}

function setInspectorOpen(open: boolean): void {
  const inspector = must(HTMLElement, 'asm-inspector');
  inspector.classList.toggle('is-open', open);
  inspector.toggleAttribute('inert', !open);
  inspector.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function fillFields(): void {
  const located = locate();
  setInspectorOpen(located !== null);
  if (!located) return;
  const { part, grid } = located;
  must(HTMLHeadingElement, 'asm-inspector-title').textContent = `选中 ${part.id}`;
  must(HTMLInputElement, 'asm-x').value = String(part.x);
  must(HTMLInputElement, 'asm-y').value = String(part.y);
  must(HTMLInputElement, 'asm-px').value = String(part.pivot.x);
  must(HTMLInputElement, 'asm-py').value = String(part.pivot.y);
  must(HTMLInputElement, 'asm-angle').value = formatDeg(part.angle);
  must(HTMLInputElement, 'asm-flip').checked = part.flipX;
  must(HTMLInputElement, 'asm-scale').value = String(part.scale);
  must(HTMLInputElement, 'asm-layer').value = String(part.layer);
  must(HTMLParagraphElement, 'asm-grid-size').textContent =
    `网格 ${part.grid}：${grid.width}×${grid.height}，源 ${grid.source.params.sourceWidth}×${grid.source.params.sourceHeight}`;
  renderColorStats(
    must(HTMLDivElement, 'asm-grid-colors'),
    must(HTMLParagraphElement, 'asm-grid-warn'),
    grid.cells
  );
  fillCopyTargets();
  renderAnchors(part);
  const hit = part.hit;
  const circle = hit?.shape === 'circle';
  must(HTMLSelectElement, 'asm-hit-role').value = hit ? hitRole(hit) : 'none';
  must(HTMLSelectElement, 'asm-hit-shape').value = circle ? 'circle' : 'rect';
  must(HTMLDivElement, 'asm-hit-box').hidden = hit === undefined;
  must(HTMLDivElement, 'asm-hit-rect').hidden = hit === undefined || circle;
  must(HTMLDivElement, 'asm-hit-circle').hidden = !circle;
  if (hit?.shape === 'circle') {
    must(HTMLInputElement, 'asm-hcx').value = String(hit.x);
    must(HTMLInputElement, 'asm-hcy').value = String(hit.y);
    must(HTMLInputElement, 'asm-hr').value = String(hit.r);
  } else {
    must(HTMLInputElement, 'asm-hx').value = String(hit?.x ?? 0);
    must(HTMLInputElement, 'asm-hy').value = String(hit?.y ?? 0);
    must(HTMLInputElement, 'asm-hw').value = String(hit?.w ?? grid.width);
    must(HTMLInputElement, 'asm-hh').value = String(hit?.h ?? grid.height);
  }
}

function fillName(): void {
  if (!entity) return;
  must(HTMLInputElement, 'asm-name').value = entity.name;
}

function fillStageId(): void {
  const stage = currentStage();
  must(HTMLInputElement, 'asm-stage-id').value = stage?.id ?? '';
  must(HTMLInputElement, 'asm-stage-name').value = stage?.name ?? '';
  must(HTMLButtonElement, 'asm-del-stage').disabled = (entity?.stages.length ?? 0) <= 1;
}

function renameStageLabel(name: string): void {
  if (!entity) return;
  const stage = currentStage();
  if (!stage) return;
  const backup = serializeEntityFile(entity);
  if (name.length === 0) delete stage.name;
  else stage.name = name;
  try {
    serializeEntityFile(entity);
  } catch (error) {
    entity = parseEntityFile(backup);
    fillStageId();
    fail(error);
    return;
  }
  renderStages();
  setStatus(name.length === 0 ? '已清掉阶段说明' : `阶段说明：${name}`);
}

function selectStage(id: string): void {
  stageId = id;
  if (!currentStage()?.parts.some((part) => part.id === partId)) partId = '';
  renderStages();
  renderParts();
  fillFields();
  paintAssembly();
}

function duplicateStage(): void {
  if (!entity) return;
  const stage = currentStage();
  if (!stage) return;
  if (entity.stages.length >= ENTITY_MAX_STAGES) {
    setStatus('阶段数量已满');
    return;
  }
  const id = uniqueId(
    `${stage.id}`.slice(0, 24),
    entity.stages.map((item) => item.id)
  );
  const index = entity.stages.indexOf(stage);
  entity.stages.splice(index + 1, 0, cloneStage(stage, id));
  selectStage(id);
  setStatus(`已复制成 ${id}。零件 id 不变，改完角度和位移再导出`);
}

function deleteStage(): void {
  if (!entity) return;
  const stage = currentStage();
  if (!stage) return;
  if (entity.stages.length <= 1) {
    setStatus('至少要留一个阶段');
    return;
  }
  if (
    stage.parts.length > 0 &&
    !window.confirm(`删掉阶段 ${stage.id} 和它的 ${stage.parts.length} 个零件？`)
  ) {
    return;
  }
  stopPlay();
  const index = entity.stages.indexOf(stage);
  entity.stages.splice(index, 1);
  const next = entity.stages[Math.max(0, index - 1)];
  partId = '';
  selectStage(next?.id ?? '');
  syncSampleLocks();
  setStatus(`已删除阶段 ${stage.id}`);
}

function addBankStages(): void {
  if (!entity) return;
  const stage = currentStage();
  if (!stage) return;
  const used = entity.stages.map((item) => item.id);
  const missing = BANK_STAGE_IDS.filter((id) => !used.includes(id));
  if (missing.length === 0) {
    setStatus('t0–t5 都已经有了');
    return;
  }
  if (entity.stages.length + missing.length > ENTITY_MAX_STAGES) {
    setStatus(`阶段最多 ${ENTITY_MAX_STAGES} 个，放不下 ${missing.length} 个侧倾阶段`);
    return;
  }
  for (const id of missing) {
    const copy = cloneStage(stage, id);
    copy.name = id === 't0' ? '平飞' : `右倾 ${id.slice(1)}`;
    entity.stages.push(copy);
  }
  serializeEntityFile(entity);
  selectStage(missing[0] ?? stage.id);
  setStatus(
    `已从 ${stage.id} 复制出 ${missing.join('、')}。t0 平飞，t1–t5 逐级右倾，左倾由游戏镜像`
  );
}

function togglePlay(): void {
  if (playTimer !== null) {
    stopPlay();
    setStatus('已停止播放');
    return;
  }
  if (!entity || entity.stages.length < 2) {
    setStatus('至少两个阶段才能播放');
    return;
  }
  partId = '';
  fillFields();
  must(HTMLButtonElement, 'asm-play').setAttribute('aria-pressed', 'true');
  must(HTMLButtonElement, 'asm-play').textContent = '停止播放';
  playTimer = window.setInterval(() => {
    if (!entity) return;
    const index = entity.stages.findIndex((stage) => stage.id === stageId);
    const next = entity.stages[(index + 1) % entity.stages.length];
    if (next) selectStage(next.id);
    setStatus(`播放中：${next?.id ?? ''}${next?.name ? ` ${next.name}` : ''}`);
  }, PLAY_MS);
  setStatus('播放中');
}

function stopPlay(): void {
  if (playTimer === null) return;
  window.clearInterval(playTimer);
  playTimer = null;
  const button = must(HTMLButtonElement, 'asm-play');
  button.setAttribute('aria-pressed', 'false');
  button.textContent = '播放阶段';
}

function duplicatePart(): void {
  if (!entity) return;
  const located = locate();
  if (!located) return;
  const { part, stage } = located;
  const copy = clonePlacement(part);
  copy.id = uniqueId(
    part.id.slice(0, 24),
    stage.parts.map((item) => item.id)
  );
  copy.x = Math.min(ENTITY_POS_MAX, part.x + 2);
  copy.y = Math.min(ENTITY_POS_MAX, part.y + 2);
  copy.layer = nextLayer(stage.parts);
  stage.parts.push(copy);
  try {
    serializeEntityFile(entity);
  } catch (error) {
    stage.parts.pop();
    fail(error);
    return;
  }
  partId = copy.id;
  renderParts();
  fillFields();
  paintAssembly();
  setStatus(`已复制成 ${copy.id}，偏 2 像素，画在最前`);
}

function fillCopyTargets(): void {
  const select = must(HTMLSelectElement, 'asm-copy-target');
  const previous = select.value;
  select.replaceChildren();
  for (const stage of entity?.stages ?? []) {
    if (stage.id === stageId) continue;
    const option = document.createElement('option');
    option.value = stage.id;
    const has = stage.parts.some((part) => part.id === partId);
    option.textContent = `${stage.id}${has ? '（替换同 id）' : '（新增）'}`;
    select.append(option);
  }
  if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  select.disabled = select.options.length === 0;
  must(HTMLButtonElement, 'asm-copy-part').disabled = select.options.length === 0;
}

function copyPartAcross(): void {
  if (!entity) return;
  const located = locate();
  const targetId = must(HTMLSelectElement, 'asm-copy-target').value;
  const target = entity.stages.find((stage) => stage.id === targetId);
  if (!located || !target) return;
  const backup = serializeEntityFile(entity);
  try {
    const result = copyPartToStage(target, located.part);
    serializeEntityFile(entity);
    fillCopyTargets();
    setStatus(
      `已把 ${located.part.id} 复制到 ${target.id}（${result === 'replaced' ? '替换同 id' : '新增'}）。切到 ${target.id} 再改角度`
    );
  } catch (error) {
    entity = parseEntityFile(backup);
    fail(error);
  }
}

function renderAnchors(part: EntityPlacement): void {
  const box = must(HTMLDivElement, 'asm-anchor-list');
  box.replaceChildren();
  const anchors = part.anchors ?? [];
  if (anchors.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = '还没有锚点。';
    box.append(empty);
  }
  anchors.forEach((anchor, index) => {
    const row = document.createElement('div');
    row.className = 'anchor-row';
    const kind = document.createElement('select');
    for (const [value, label] of [
      ['exhaust', '尾焰'],
      ['muzzle', '枪口'],
    ] as const) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      kind.append(option);
    }
    kind.value = anchor.kind;
    kind.title = '锚点用途';
    kind.addEventListener('change', () => {
      editAnchor(
        index,
        (item) => {
          item.kind = kind.value === 'muzzle' ? 'muzzle' : 'exhaust';
        },
        true
      );
    });
    const id = document.createElement('input');
    id.type = 'text';
    id.maxLength = 32;
    id.value = anchor.id;
    id.title = '锚点 id：字母、数字、_ 或 -';
    id.addEventListener('change', () => {
      editAnchor(
        index,
        (item) => {
          item.id = id.value.trim();
        },
        true
      );
    });
    const x = anchorNumber(anchor.x, 'x（相对轴心）', (value) => {
      editAnchor(
        index,
        (item) => {
          item.x = value;
        },
        false
      );
    });
    const y = anchorNumber(anchor.y, 'y（相对轴心）', (value) => {
      editAnchor(
        index,
        (item) => {
          item.y = value;
        },
        false
      );
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '删';
    remove.title = '删掉这个锚点';
    remove.addEventListener('click', () => {
      editPart((item) => {
        const next = (item.anchors ?? []).filter((_, at) => at !== index);
        if (next.length > 0) item.anchors = next;
        else delete item.anchors;
      }, true);
    });
    row.append(kind, id, x, y, remove);
    box.append(row);
  });
  must(HTMLButtonElement, 'asm-add-exhaust').disabled = anchors.length >= ENTITY_MAX_ANCHORS;
  must(HTMLButtonElement, 'asm-add-muzzle').disabled = anchors.length >= ENTITY_MAX_ANCHORS;
}

function anchorNumber(
  value: number,
  label: string,
  apply: (value: number) => void
): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.step = '1';
  input.value = String(value);
  input.title = label;
  input.addEventListener('input', () => {
    try {
      apply(readInt(input, label, ENTITY_HIT_MIN, ENTITY_HIT_MAX));
    } catch (error) {
      fail(error);
    }
  });
  return input;
}

function editAnchor(index: number, apply: (anchor: EntityAnchor) => void, fill: boolean): void {
  editPart((part) => {
    const anchor = part.anchors?.[index];
    if (!anchor) return;
    apply(anchor);
  }, fill);
}

function addAnchor(kind: EntityAnchorKind): void {
  editPart((part, grid) => {
    const anchors = part.anchors ?? [];
    const x = Math.floor(grid.width / 2) - part.pivot.x;
    const y = kind === 'exhaust' ? grid.height - part.pivot.y : -part.pivot.y;
    const id = uniqueId(
      kind === 'exhaust' ? 'jet' : 'gun',
      anchors.map((anchor) => anchor.id)
    );
    part.anchors = [...anchors, { id, kind, x, y }];
  }, true);
}

function stageHasVisibleAnchor(): boolean {
  const stage = currentStage();
  if (!stage) return false;
  return stage.parts.some(
    (part) => (anchorsOn || part.id === partId) && (part.anchors?.length ?? 0) > 0
  );
}

function parseRef(value: string): { width: number; height: number } | null {
  const match = /^(\d+)x(\d+)$/.exec(value);
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

function updateSizeReadout(): void {
  const out = must(HTMLParagraphElement, 'asm-size');
  const stage = currentStage();
  const box = entity && stage ? stageBounds(entity, stage) : null;
  const screen = '局内逻辑画面 360×640。';
  if (!box) {
    out.textContent = `当前阶段还没有零件。${screen}`;
    return;
  }
  const width = Math.round(box.right - box.left);
  const height = Math.round(box.bottom - box.top);
  let text = `当前阶段 ${stage?.id ?? ''} 零件包围 ${width}×${height} 像素（不含受击框）。${screen}`;
  if (refSize) {
    const wx = (width / refSize.width).toFixed(2);
    const hy = (height / refSize.height).toFixed(2);
    text += ` 对照 ${refSize.width}×${refSize.height}：宽 ×${wx}，高 ×${hy}。`;
  }
  out.textContent = text;
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

function readScale(input: HTMLInputElement): number {
  const value = Number(input.value);
  if (!Number.isFinite(value) || value <= ENTITY_SCALE_MIN || value > ENTITY_SCALE_MAX) {
    throw new Error(`缩放需大于 ${ENTITY_SCALE_MIN}，且不超过 ${ENTITY_SCALE_MAX}`);
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

function moveLayer(dir: 1 | -1): void {
  const stage = currentStage();
  if (!stage) return;
  const order = stageDrawOrder(stage.parts);
  const pos = order.findIndex((index) => stage.parts[index]?.id === partId);
  const nextPos = pos + dir;
  if (pos < 0 || nextPos < 0 || nextPos >= order.length) return;
  const swapped = order.slice();
  const current = swapped[pos];
  const other = swapped[nextPos];
  if (current === undefined || other === undefined) return;
  swapped[pos] = other;
  swapped[nextPos] = current;
  swapped.forEach((partIndex, layer) => {
    const part = stage.parts[partIndex];
    if (part) part.layer = layer;
  });
  renderParts();
  fillFields();
  paintAssembly();
  setStatus(dir > 0 ? '已上移，画到更前面' : '已下移，画到更后面');
}

function selectAt(event: MouseEvent): void {
  if (!viewMap || !entity) return;
  const canvas = must(HTMLCanvasElement, 'asm-view');
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const sx = ((event.clientX - rect.left) * canvas.width) / rect.width;
  const sy = ((event.clientY - rect.top) * canvas.height) / rect.height;
  const x = (sx - viewMap.bleed) / viewMap.scale + viewMap.minX;
  const y = (sy - viewMap.bleed) / viewMap.scale + viewMap.minY;
  const stage = currentStage();
  if (!stage) return;
  const order = stageDrawOrder(stage.parts);
  for (let i = order.length - 1; i >= 0; i--) {
    const index = order[i];
    const part = index === undefined ? undefined : stage.parts[index];
    if (!part) continue;
    const grid = entity.grids[part.grid];
    if (!grid || !placementContains(grid, part, x, y)) continue;
    partId = part.id;
    renderParts();
    fillFields();
    paintAssembly();
    setStatus(`已选中 ${part.id}`);
    return;
  }
  clearSelection();
}

function clearSelection(): void {
  if (!partId) return;
  partId = '';
  renderParts();
  fillFields();
  paintAssembly();
  setStatus('已退出调参');
}

function closePartDialog(): void {
  const dialog = document.getElementById('part-dialog');
  if (dialog instanceof HTMLDialogElement && dialog.open) dialog.close();
}

function notePart(message: string): void {
  const status = document.getElementById('status');
  if (status) status.textContent = message;
}

function paintAssembly(): void {
  const canvas = must(HTMLCanvasElement, 'asm-view');
  const stage = currentStage();
  const order = stage ? stageDrawOrder(stage.parts) : [];
  const bounds = previewFrameRect({ width: frameW, height: frameH });
  let minX = bounds.left;
  let minY = bounds.top;
  let maxX = bounds.right;
  let maxY = bounds.bottom;
  const ref = refSize ? previewFrameRect(refSize) : null;
  if (ref) {
    minX = Math.min(minX, ref.left);
    minY = Math.min(minY, ref.top);
    maxX = Math.max(maxX, ref.right);
    maxY = Math.max(maxY, ref.bottom);
  }
  updateSizeReadout();
  if (entity && stage) {
    for (const index of order) {
      const part = stage.parts[index];
      const gridFile = part ? entity.grids[part.grid] : undefined;
      if (!part || !gridFile) continue;
      for (const [px, py] of placementCorners(gridFile, part)) {
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
    }
  }
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = Math.max(1, Math.floor(LOGICAL_W / Math.max(spanX, spanY)));
  canvas.width = Math.max(1, Math.ceil(spanX * scale)) + FRAME_BLEED * 2;
  canvas.height = Math.max(1, Math.ceil(spanY * scale)) + FRAME_BLEED * 2;
  canvas.style.imageRendering = 'pixelated';
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = EXTERIOR_VOID;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  viewMap = { scale, minX, minY, bleed: FRAME_BLEED };
  ctx.setTransform(scale, 0, 0, scale, -minX * scale + FRAME_BLEED, -minY * scale + FRAME_BLEED);
  ctx.imageSmoothingEnabled = false;
  if (entity && stage) {
    for (const index of order) {
      const part = stage.parts[index];
      const gridFile = part ? entity.grids[part.grid] : undefined;
      if (!part || !gridFile) continue;
      const placed = placedSprite(gridFile, part);
      const frame = renderSprite(placed.data);
      frame.anchorX = placed.anchorX;
      frame.anchorY = placed.anchorY;
      blitPlacedSprite(ctx, frame, part.x, part.y, part.angle, part.scale);
      if (!hitsOn || part.id === partId) continue;
      const hit = placedHitLocal(gridFile, part);
      if (!hit) continue;
      strokeHit(ctx, part, hit, scale, 1);
    }
  }
  strokePreviewFrame(ctx, scale);
  if (ref) strokeReference(ctx, ref, scale);
  if (!entity || !stage) return;
  const selected = stage.parts.find((part) => part.id === partId);
  const selectedGrid = selected ? entity.grids[selected.grid] : undefined;
  if (selected && selectedGrid) {
    strokeSelection(ctx, placementCorners(selectedGrid, selected), scale);
    const selectedHit = placedHitLocal(selectedGrid, selected);
    if (selectedHit) strokeHit(ctx, selected, selectedHit, scale, 3);
  }
  for (const part of stage.parts) {
    if (!anchorsOn && part.id !== partId) continue;
    for (const anchor of part.anchors ?? []) drawAnchor(ctx, part, anchor, scale);
  }
}

function strokeSelection(
  ctx: CanvasRenderingContext2D,
  corners: ReadonlyArray<readonly [number, number]>,
  scale: number
): void {
  const mark = PALETTE[COLOR.PLAYER_GOLD_LIGHT];
  if (!mark || corners.length === 0) return;
  ctx.beginPath();
  corners.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.strokeStyle = mark;
  ctx.lineWidth = 1 / scale;
  ctx.stroke();
}

function strokeHit(
  ctx: CanvasRenderingContext2D,
  part: EntityPlacement,
  hit: NonNullable<ReturnType<typeof placedHitLocal>>,
  viewScale: number,
  pixels: number
): void {
  const block = hitRole(hit) === 'block';
  const color = PALETTE[block ? COLOR.LIGHT_GRAY : COLOR.PLAYER_CYAN];
  if (!color) throw new Error('missing hit color');
  const unit = 1 / (viewScale * part.scale);
  ctx.save();
  ctx.translate(part.x, part.y);
  ctx.rotate(part.angle);
  if (part.scale !== 1) ctx.scale(part.scale, part.scale);
  ctx.strokeStyle = color;
  ctx.lineWidth = pixels * unit;
  if (block) ctx.setLineDash([5 * unit, 4 * unit]);
  if (hit.shape === 'circle') {
    ctx.beginPath();
    ctx.arc(hit.x, hit.y, hit.r, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeRect(hit.x, hit.y, hit.w, hit.h);
  }
  ctx.restore();
}

function strokeReference(
  ctx: CanvasRenderingContext2D,
  rect: { left: number; top: number; right: number; bottom: number },
  scale: number
): void {
  const color = PALETTE[COLOR.BULLET_PINK];
  if (!color) throw new Error('missing reference color');
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1 / scale;
  ctx.setLineDash([4 / scale, 3 / scale]);
  const half = 0.5 / scale;
  ctx.strokeRect(
    rect.left - half,
    rect.top - half,
    rect.right - rect.left + 2 * half,
    rect.bottom - rect.top + 2 * half
  );
  ctx.restore();
}

function drawAnchor(
  ctx: CanvasRenderingContext2D,
  part: EntityPlacement,
  anchor: EntityAnchor,
  scale: number
): void {
  const point = placedAnchor(part, anchor);
  const unit = 1 / scale;
  ctx.save();
  if (anchor.kind === 'exhaust') {
    const color = PALETTE[flickerPhase ? COLOR.EXPLOSION_YELLOW : COLOR.EXPLOSION_ORANGE];
    if (!color) throw new Error('missing exhaust color');
    const size = (flickerPhase ? 6 : 4) * unit;
    ctx.fillStyle = color;
    ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size);
  } else {
    const color = PALETTE[flickerPhase ? COLOR.WHITE : COLOR.PLAYER_PALE_CYAN];
    if (!color) throw new Error('missing muzzle color');
    const arm = 4 * unit;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * unit;
    ctx.beginPath();
    ctx.moveTo(point.x - arm, point.y);
    ctx.lineTo(point.x + arm, point.y);
    ctx.moveTo(point.x, point.y - arm);
    ctx.lineTo(point.x, point.y + arm);
    ctx.stroke();
  }
  ctx.restore();
}

function strokePreviewFrame(ctx: CanvasRenderingContext2D, scale: number): void {
  const rect = previewFrameRect({ width: frameW, height: frameH });
  const color = PALETTE[COLOR.WHITE];
  if (!color) throw new Error('missing frame color');
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 / scale;
  ctx.strokeRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
  ctx.restore();
}

function commitFrame(widthInput: HTMLInputElement, heightInput: HTMLInputElement): void {
  try {
    const width = readInt(widthInput, '边界宽', ENTITY_FRAME_MIN, ENTITY_FRAME_MAX);
    const height = readInt(heightInput, '边界高', ENTITY_FRAME_MIN, ENTITY_FRAME_MAX);
    frameW = width;
    frameH = height;
    frameDirty = true;
    rememberFrame();
    if (entity) serializeEntityFile(entity);
    paintAssembly();
    setStatus(`边界 ${width}×${height}`);
  } catch (error) {
    syncFrameInputs();
    fail(error);
  }
}

function fitFrame(): void {
  if (!entity || !entity.stages.some((stage) => stage.parts.length > 0)) {
    setStatus('还没有零件，边界先不动');
    return;
  }
  const next = suggestedPreviewFrame(entity);
  frameW = next.width;
  frameH = next.height;
  frameDirty = true;
  rememberFrame();
  syncFrameInputs();
  paintAssembly();
  setStatus(`边界 ${frameW}×${frameH}`);
}

function contentFrame(next: EntityFile): { width: number; height: number } {
  if (!next.stages.some((stage) => stage.parts.length > 0)) {
    return { width: FRAME_PLACEHOLDER, height: FRAME_PLACEHOLDER };
  }
  return suggestedPreviewFrame(next);
}

function frameStatus(prefix: string): string {
  if (entity?.previewFrame) return `${prefix}，边界用文件里的 ${frameW}×${frameH}`;
  return `${prefix}，边界按零件包住 ${frameW}×${frameH}`;
}

function rememberFrame(): void {
  if (!entity || !frameDirty) return;
  entity.previewFrame = { width: frameW, height: frameH };
}

function syncFrameInputs(): void {
  must(HTMLInputElement, 'asm-frame-w').value = String(frameW);
  must(HTMLInputElement, 'asm-frame-h').value = String(frameH);
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
