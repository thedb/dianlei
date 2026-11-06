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
  ENTITY_SKEW_MAX,
  ENTITY_STRETCH_MAX,
  ENTITY_STRETCH_MIN,
  bankParts,
  clonePlacement,
  cloneStage,
  copyPartToStage,
  createEmptyEntity,
  defaultBank,
  hitRole,
  isEntityId,
  parseEntityFile,
  partLinear,
  partScaleX,
  partScaleY,
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
  type EntityBank,
  type EntityFile,
  type EntityPlacement,
  type EntityStage,
} from '@/game/art/entityFile';
import { parsePaletteGrid, serializePaletteGrid, type PaletteGridFile } from '@/game/art/gridFile';
import {
  dragAngle,
  dragSkew,
  dragStretch,
  handleAt,
  partHandles,
  type PartHandle,
} from '@/game/art/entityHandles';
import { gridColorStats } from '@/game/art/gridStats';
import { blitPlacedSprite, renderSprite } from '@/game/art/spriteRenderer';
import { BANK_STAGE_IDS, clearBankData, hasBankData } from './bankData';
import {
  BANK_STRIP_CELLS,
  bankFrameTitle,
  bankStripLabel,
  bankStripLevel,
  bankStripMirrored,
  bankStripSelected,
} from './bankStrip';
import { colorWarnings, renderColorStats } from './colorStats';
import {
  closePlaybackPanel,
  mountPlayback,
  playbackActive,
  refreshPlaybackStages,
  stopPlayback,
  togglePlaybackPanel,
  type PlayedFrame,
} from './playback';

export interface AssemblyHost {
  currentGrid(): PaletteGridFile | null;
  download(filename: string, text: string): void;
  assetUrl(name: string): string;
  /** Called whenever the assembly gains its first part or loses its last one. */
  assemblyBusy(busy: boolean): void;
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
const NUDGE_STEP = 1;
const NUDGE_SHIFT_STEP = 8;

let anchorsOn = true;
let refSize: { width: number; height: number } | null = null;
let flickerPhase = false;
/** Pose drawn instead of the current stage while the playback panel plays or is paused. */
let playPose: PlayedFrame | null = null;
const BANK_PAD = 3;
const BANK_MAX_H = 84;
const BANK_LABEL_H = 14;
let bankOpen = false;
let bankFrameId = 't1';
/** Picked strip cell, 0–10. Cells 0–4 mirror t5…t1, 5 is t0, 6–10 are t1–t5. */
let bankCell = 6;
/** Which canvas last took a pointer: arrows follow it when focus is on the page body. */
let keyOwner: 'canvas' | 'bank' | null = null;
/** Handle size and hit radius in CSS pixels, and the rotate stem length. */
const HANDLE_PX = 6;
const HANDLE_HIT_PX = 8;
const ROTATE_STEM_PX = 18;
const ANGLE_STEP_DEG = 1;
const ANGLE_SHIFT_STEP_DEG = 15;
/** View margin around the frame, in entity pixels: at least this, or a quarter of the longer side. */
const VIEW_MARGIN_MIN = 8;
const VIEW_MARGIN_SHARE = 0.25;
let viewOverflow = false;
interface PartDrag {
  mode: 'move' | 'stretch' | 'skew' | 'rotate';
  handle: PartHandle | null;
  start: EntityPlacement;
  fromX: number;
  fromY: number;
  moved: boolean;
}
let drag: PartDrag | null = null;
let swallowClick = false;
const HANDLE_CURSORS: Record<string, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  rotate: 'grab',
};
/** Last source and result written into each bank stage, to spot hand edits. */
const bankApplied = new WeakMap<EntityStage, { input: string; output: string }>();

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
  must(HTMLButtonElement, 'asm-bank-clear').addEventListener('click', () => {
    clearBankStages();
  });
  mountPlayback({
    entity: () => entity,
    show: (frame) => {
      playPose = frame;
      paintMain();
    },
    release: () => {
      partId = '';
      fillFields();
      renderParts();
    },
  });
  must(HTMLButtonElement, 'asm-play').addEventListener('click', () => {
    if (!entity) {
      setStatus('先载入装配再播放');
      return;
    }
    togglePlaybackPanel();
  });
  must(HTMLButtonElement, 'bank-hide').addEventListener('click', () => {
    bankOpen = false;
    paintBank();
  });
  const bankView = must(HTMLCanvasElement, 'bank-view');
  bankView.addEventListener('pointerdown', () => {
    keyOwner = 'bank';
    bankView.focus({ preventScroll: true });
  });
  bankView.addEventListener('click', (event) => {
    pickBankFrame(event);
  });
  bindBankRange('bank-angle', (bank, value) => {
    bank.angle = (value * Math.PI) / 180;
  });
  bindBankRange('bank-sx', (bank, value) => {
    bank.stretchX = value;
  });
  bindBankRange('bank-sy', (bank, value) => {
    bank.stretchY = value;
  });
  bindBankRange('bank-taper', (bank, value) => {
    bank.taper = value;
  });
  must(HTMLButtonElement, 'bank-reset').addEventListener('click', () => {
    resetBank();
  });
  must(HTMLButtonElement, 'bank-mode').addEventListener('click', () => {
    toggleBankMode();
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
  for (const [id, key] of [
    ['asm-kx', 'skewX'],
    ['asm-ky', 'skewY'],
  ] as const) {
    const input = must(HTMLInputElement, id);
    input.addEventListener('input', () => {
      editPart((part) => {
        const value = readSkew(input);
        if (value === 0) delete part[key];
        else part[key] = value;
      }, false);
    });
  }
  must(HTMLSelectElement, 'asm-handle-mode').addEventListener('change', () => {
    paintAssembly();
    setStatus(
      skewMode() ? '边点改成斜切：拖上下边点左右斜，拖左右边点上下斜。角点仍是拉伸' : '边点改回拉伸'
    );
  });
  for (const [id, key] of [
    ['asm-sx', 'stretchX'],
    ['asm-sy', 'stretchY'],
  ] as const) {
    const input = must(HTMLInputElement, id);
    input.addEventListener('input', () => {
      editPart((part) => {
        const value = readStretch(input);
        if (value === 1) delete part[key];
        else part[key] = value;
      }, false);
    });
  }
  must(HTMLButtonElement, 'asm-layer-up').addEventListener('click', () => {
    moveLayer(1);
  });
  must(HTMLButtonElement, 'asm-layer-down').addEventListener('click', () => {
    moveLayer(-1);
  });
  const view = must(HTMLCanvasElement, 'asm-view');
  view.addEventListener('pointerdown', (event) => {
    keyOwner = 'canvas';
    view.focus({ preventScroll: true });
    if (playbackActive()) {
      stopPlay();
      swallowClick = true;
      setStatus('已停止播放，回到编辑');
      return;
    }
    startDrag(event);
  });
  view.addEventListener('pointermove', (event) => {
    moveDrag(event);
  });
  view.addEventListener('pointerup', (event) => {
    endDrag(event);
  });
  view.addEventListener('pointercancel', (event) => {
    endDrag(event);
  });
  view.addEventListener('click', (event) => {
    if (swallowClick) {
      swallowClick = false;
      return;
    }
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
    if (!move) return;
    if (target instanceof Element && target.closest('input, select, textarea')) return;
    if (document.querySelector('dialog[open]')) return;
    const owner = arrowOwner(target);
    if (owner === 'bank') {
      if (move[0] === 0) return;
      event.preventDefault();
      stepBankCell(move[0] < 0 ? -1 : 1);
      return;
    }
    if (owner !== 'canvas' || !partId) return;
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
  bankOpen = next.stages.some((stage) => stage.bank !== undefined);
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
  const previous = stage.id;
  stage.id = next;
  for (const item of entity.stages) {
    if (item.bank?.from === previous) item.bank.from = next;
  }
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
  syncBanks();
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
  example.disabled = busy;
  must(HTMLButtonElement, 'asm-clear').disabled = entity === null;
  example.title = busy
    ? '装配里已有零件。先点「清空装配」再载入装配示例。'
    : '打开样例装配：机身加一对翼，三个阶段 folded / half / open。用来冒烟，不是现役 Boss。';
  host?.assemblyBusy(busy);
}

function clearAssembly(): void {
  closePlaybackPanel();
  entity = null;
  bankOpen = false;
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
  syncBankActions();
  if (!entity) return;
  for (const stage of entity.stages) {
    const option = document.createElement('option');
    option.value = stage.id;
    option.textContent = stage.name ? `${stage.id} ${stage.name}` : stage.id;
    select.append(option);
  }
  select.value = stageId;
  fillStageId();
  refreshPlaybackStages();
}

function syncBankActions(): void {
  const button = must(HTMLButtonElement, 'asm-bank-clear');
  button.disabled = !hasBankData(entity);
  button.title = button.disabled
    ? '当前没有可清除的侧倾帧。'
    : '删除 t1–t5 侧倾帧及 bank 参数；保留 t0、其他阶段、网格和装配零件。';
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
  must(HTMLInputElement, 'asm-sx').value = String(part.stretchX ?? 1);
  must(HTMLInputElement, 'asm-sy').value = String(part.stretchY ?? 1);
  must(HTMLInputElement, 'asm-kx').value = formatDeg(part.skewX ?? 0);
  must(HTMLInputElement, 'asm-ky').value = formatDeg(part.skewY ?? 0);
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
  const freed: string[] = [];
  for (const item of entity.stages) {
    if (item.bank?.from !== stage.id) continue;
    delete item.bank;
    freed.push(item.id);
  }
  const next = entity.stages[Math.max(0, index - 1)];
  partId = '';
  selectStage(next?.id ?? '');
  syncSampleLocks();
  setStatus(
    freed.length > 0
      ? `已删除阶段 ${stage.id}。${freed.join('、')} 改成手调，零件留着`
      : `已删除阶段 ${stage.id}`
  );
}

function addBankStages(): void {
  if (!entity) return;
  const current = currentStage();
  if (!current) return;
  stopPlay();
  const missing = BANK_STAGE_IDS.filter((id) => !entity?.stages.some((item) => item.id === id));
  if (entity.stages.length + missing.length > ENTITY_MAX_STAGES) {
    setStatus(`阶段最多 ${ENTITY_MAX_STAGES} 个，放不下 ${missing.length} 个侧倾阶段`);
    return;
  }
  const backup = serializeEntityFile(entity);
  const added: string[] = [];
  let source = entity.stages.find((item) => item.id === 't0');
  if (!source) {
    const origin = current.bank
      ? (entity.stages.find((item) => item.id === current.bank?.from) ?? current)
      : current;
    source = cloneStage(origin, 't0');
    delete source.bank;
    source.name = '平飞';
    entity.stages.push(source);
    added.push('t0');
  }
  if (source.bank) {
    setStatus('t0 自己带着侧倾参数，不能当原稿。先在侧倾对比里把 t0 改成手调');
    return;
  }
  for (let level = 1; level < BANK_STAGE_IDS.length; level++) {
    const id = `t${level}`;
    if (entity.stages.some((item) => item.id === id)) continue;
    const bank = defaultBank(source.id, level);
    entity.stages.push({ id, name: `右倾 ${level}`, parts: bankParts(entity, source, bank), bank });
    added.push(id);
  }
  try {
    serializeEntityFile(entity);
  } catch (error) {
    entity = parseEntityFile(backup);
    fail(error);
    return;
  }
  bankOpen = true;
  bankFrameId = 't1';
  bankCell = 6;
  selectStage(entity.stages.some((item) => item.id === 't1') ? 't1' : source.id);
  setStatus(
    added.length > 0
      ? `已生成 ${added.join('、')}，并打开下方「侧倾对比」。左五格是代码镜像，右五格是 t1–t5，点一格调角度和拉伸`
      : '侧倾帧都已经有了，已打开下方「侧倾对比」'
  );
}

function clearBankStages(): void {
  if (!entity || !hasBankData(entity)) return;
  const bankIds = entity.stages
    .filter((stage) => stage.id !== 't0' && (stage.bank || bankLevel(stage.id) > 0))
    .map((stage) => stage.id);
  const named = bankIds.length > 0 ? bankIds.join('、') : 'bank 参数';
  if (
    !window.confirm(
      `清除侧倾数据 ${named}？\n\n会保留 t0、其他阶段、网格和装配零件。清除后可修改 t0，再用「侧倾 t0–t5」重新生成。此操作不能撤销。`
    )
  ) {
    return;
  }

  const backup = serializeEntityFile(entity);
  closePlaybackPanel();
  const result = clearBankData(entity);
  try {
    serializeEntityFile(entity);
  } catch (error) {
    entity = parseEntityFile(backup);
    showEditor();
    fail(error);
    return;
  }

  bankOpen = false;
  bankFrameId = 't1';
  bankCell = 6;
  partId = '';
  const next = entity.stages.find((stage) => stage.id === 't0') ?? entity.stages[0];
  stageId = next?.id ?? '';
  showEditor();
  paintBank();
  paintAssembly();
  const removed = result.removedStageIds.length > 0 ? result.removedStageIds.join('、') : 'bank 参数';
  setStatus(
    `已清除侧倾数据 ${removed}。t0、其他阶段和装配零件已保留；修改 t0 后可重新生成侧倾`
  );
}

/**
 * Rebuild every bank stage whose source or parameters changed.
 * A bank stage whose parts no longer match the last rebuild was edited by hand:
 * it drops `bank` and keeps those parts. Returns the ids that dropped it.
 */
function syncBanks(): string[] {
  if (!entity) return [];
  const freed: string[] = [];
  for (const stage of entity.stages) {
    const bank = stage.bank;
    if (!bank) continue;
    const source = entity.stages.find((item) => item.id === bank.from);
    const last = bankApplied.get(stage);
    if (!source || source.bank || (last && last.output !== JSON.stringify(stage.parts))) {
      delete stage.bank;
      bankApplied.delete(stage);
      freed.push(stage.id);
      continue;
    }
    const input = JSON.stringify([source.parts, bank]);
    if (last?.input === input) continue;
    stage.parts = bankParts(entity, source, bank);
    bankApplied.set(stage, { input, output: JSON.stringify(stage.parts) });
  }
  return freed;
}

function bankStage(): EntityStage | null {
  return entity?.stages.find((stage) => stage.id === bankFrameId) ?? null;
}

function bankLevel(id: string): number {
  const index = (BANK_STAGE_IDS as readonly string[]).indexOf(id);
  return index;
}

function bindBankRange(id: string, apply: (bank: EntityBank, value: number) => void): void {
  const input = must(HTMLInputElement, id);
  input.addEventListener('input', () => {
    const stage = bankStage();
    if (!entity || !stage?.bank) return;
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;
    const backup = { ...stage.bank };
    apply(stage.bank, value);
    try {
      serializeEntityFile(entity);
    } catch (error) {
      stage.bank = backup;
      fail(error);
      return;
    }
    paintAssembly();
    setStatus(`${stage.id}：${describeBank(stage.bank)}，已写回 ${stage.id} 的零件`);
  });
}

function describeBank(bank: EntityBank): string {
  return `角度 ${formatDeg(bank.angle)}°，横向 ×${bank.stretchX}，纵向 ×${bank.stretchY}，透视 ${bank.taper}`;
}

function resetBank(): void {
  const stage = bankStage();
  if (!stage?.bank) return;
  stage.bank = defaultBank(stage.bank.from, Math.max(1, bankLevel(stage.id)));
  paintAssembly();
  setStatus(`${stage.id} 已恢复默认：${describeBank(stage.bank)}`);
}

function toggleBankMode(): void {
  if (!entity) return;
  const stage = bankStage();
  if (!stage || stage.id === 't0') return;
  if (stage.bank) {
    delete stage.bank;
    bankApplied.delete(stage);
    paintAssembly();
    setStatus(`${stage.id} 改成手调，零件留着，不再跟 t0 重算`);
    return;
  }
  const source = entity.stages.find((item) => item.id === 't0');
  if (!source || source.bank) {
    setStatus('没有可用的 t0 原稿');
    return;
  }
  if (
    stage.parts.length > 0 &&
    !window.confirm(`用参数从 t0 重新生成 ${stage.id}，会盖掉这一帧的手调。继续？`)
  ) {
    return;
  }
  stage.bank = defaultBank(source.id, Math.max(1, bankLevel(stage.id)));
  paintAssembly();
  renderParts();
  setStatus(`${stage.id} 改成跟 t0 重算：${describeBank(stage.bank)}`);
}

function pickBankFrame(event: MouseEvent): void {
  const canvas = must(HTMLCanvasElement, 'bank-view');
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0) return;
  const cell = Math.floor(((event.clientX - rect.left) / rect.width) * BANK_STRIP_CELLS);
  if (cell < 0 || cell >= BANK_STRIP_CELLS) return;
  selectBankCell(cell);
}

function stepBankCell(dir: -1 | 1): void {
  if (!bankOpen || !entity) return;
  const next = Math.max(0, Math.min(BANK_STRIP_CELLS - 1, bankCell + dir));
  if (next === bankCell) {
    setStatus(next === 0 ? '已经是最左一格（左 5 镜像）' : '已经是最右一格（t5）');
    return;
  }
  selectBankCell(next);
}

function selectBankCell(cell: number): void {
  const level = Math.abs(cell - 5);
  const id = `t${level}`;
  stopPlay();
  bankCell = cell;
  bankFrameId = id;
  if (entity?.stages.some((stage) => stage.id === id)) {
    selectStage(id);
    setStatus(
      cell < 5 ? `左 ${level} 是 ${id} 的镜像，已选中 ${id}` : `已选中 ${id}，装配画布也切到 ${id}`
    );
  } else {
    paintBank();
    setStatus(`还没有 ${id}，点「侧倾 t0–t5」补上`);
  }
}

function paintBank(): void {
  const panel = must(HTMLElement, 'bank-panel');
  if (!bankOpen || !entity) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  if ((BANK_STAGE_IDS as readonly string[]).includes(stageId)) bankFrameId = stageId;
  const pickedLevel = bankLevel(bankFrameId);
  if (pickedLevel >= 0 && Math.abs(bankCell - 5) !== pickedLevel) bankCell = 5 + pickedLevel;
  const stages = BANK_STAGE_IDS.map(
    (id) => entity?.stages.find((stage) => stage.id === id) ?? null
  );
  let half = 4;
  let top = -4;
  let bottom = 4;
  for (const stage of stages) {
    const box = stage ? stageBounds(entity, stage) : null;
    if (!box) continue;
    half = Math.max(half, Math.abs(box.left), Math.abs(box.right));
    top = Math.min(top, box.top);
    bottom = Math.max(bottom, box.bottom);
  }
  const cellW = Math.ceil(half * 2) + BANK_PAD * 2;
  const cellH = Math.ceil(bottom - top) + BANK_PAD * 2;
  const canvas = must(HTMLCanvasElement, 'bank-view');
  const avail = Math.max(220, (canvas.parentElement?.clientWidth ?? 0) - 4);
  const scale = Math.max(
    1,
    Math.min(Math.floor(avail / (BANK_STRIP_CELLS * cellW)), Math.floor(BANK_MAX_H / cellH))
  );
  const cellPx = cellW * scale;
  canvas.width = BANK_STRIP_CELLS * cellPx;
  canvas.height = cellH * scale + BANK_LABEL_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = EXTERIOR_VOID;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const mark = PALETTE[COLOR.PLAYER_GOLD_LIGHT] ?? '#fdb927';
  for (let cell = 0; cell < BANK_STRIP_CELLS; cell++) {
    const level = bankStripLevel(cell);
    const mirrored = bankStripMirrored(cell);
    const stage = stages[level] ?? null;
    const x0 = cell * cellPx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = mirrored ? '#0c1420' : '#102236';
    ctx.fillRect(x0 + 1, 0, cellPx - 2, cellH * scale);
    if (bankStripSelected(cell, bankCell)) {
      ctx.strokeStyle = mark;
      ctx.lineWidth = 2;
      ctx.strokeRect(x0 + 2, 1, cellPx - 4, cellH * scale - 2);
    }
    ctx.fillStyle = mirrored ? '#6e7f90' : '#cfe3ee';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const name = bankStripLabel(cell);
    ctx.fillText(stage ? name : `${name} 无`, x0 + cellPx / 2, cellH * scale + 2);
    if (!stage) continue;
    // Negative scaleX is the horizontal mirror of this level. The nose stays up.
    ctx.setTransform(
      mirrored ? -scale : scale,
      0,
      0,
      scale,
      x0 + cellPx / 2,
      (BANK_PAD - top) * scale
    );
    ctx.imageSmoothingEnabled = false;
    for (const index of stageDrawOrder(stage.parts)) {
      const part = stage.parts[index];
      const grid = part ? entity.grids[part.grid] : undefined;
      if (!part || !grid) continue;
      drawPart(ctx, grid, part);
    }
    if (!anchorsOn) continue;
    for (const part of stage.parts) {
      for (const anchor of part.anchors ?? []) {
        if (anchor.kind !== 'exhaust') continue;
        const point = placedAnchor(part, anchor);
        ctx.fillStyle = PALETTE[COLOR.EXPLOSION_YELLOW] ?? '#ffff00';
        ctx.fillRect(point.x - 0.5, point.y - 0.5, 1, 1);
      }
    }
  }
  fillBankControls();
}

function fillBankControls(): void {
  const stage = bankStage();
  const bank = stage?.bank;
  const ranges = ['bank-angle', 'bank-sx', 'bank-sy', 'bank-taper'].map((id) =>
    must(HTMLInputElement, id)
  );
  for (const input of ranges) input.disabled = !bank;
  must(HTMLButtonElement, 'bank-reset').disabled = !bank;
  const mode = must(HTMLButtonElement, 'bank-mode');
  mode.disabled = !stage || stage.id === 't0';
  mode.textContent = bank ? '改成手调' : '按参数重算';
  mode.title = bank
    ? '保留现在的零件，以后不跟 t0 重算，可以在装配里一件件改。'
    : '用默认参数从 t0 重新生成这一帧，会盖掉手调。';
  const stageLabel = stage
    ? `${stage.id}${stage.name ? ` ${stage.name}` : ''}`
    : `${bankFrameId}（无）`;
  must(HTMLElement, 'bank-frame').textContent = bankFrameTitle(bankCell, stageLabel);
  const [angle, sx, sy, taper] = ranges;
  if (bank && angle && sx && sy && taper) {
    angle.value = formatDeg(bank.angle);
    sx.value = String(bank.stretchX);
    sy.value = String(bank.stretchY);
    taper.value = String(bank.taper);
  }
  must(HTMLOutputElement, 'bank-angle-out').textContent = bank ? `${formatDeg(bank.angle)}°` : '—';
  must(HTMLOutputElement, 'bank-sx-out').textContent = bank ? `×${bank.stretchX}` : '—';
  must(HTMLOutputElement, 'bank-sy-out').textContent = bank ? `×${bank.stretchY}` : '—';
  must(HTMLOutputElement, 'bank-taper-out').textContent = bank ? String(bank.taper) : '—';
  const note = must(HTMLParagraphElement, 'bank-note');
  if (!stage) {
    note.textContent = `还没有 ${bankFrameId}。点「侧倾 t0–t5」补上缺的帧。`;
  } else if (stage.id === 't0') {
    note.textContent = 't0 是平飞原稿，在上面的装配画布里改。t1–t5 里跟参数走的帧会跟着重算。';
  } else if (bank) {
    note.textContent = `${stage.id} 由 ${bank.from} 加这四个参数算出，拖动就写回 ${stage.id} 的零件。直接在装配里改 ${stage.id} 的零件，这一帧会变成手调。`;
  } else {
    note.textContent = `${stage.id} 是手调帧，不跟 t0 重算。点「按参数重算」用参数从 t0 重新生成（会盖掉手调）。`;
  }
}

function stopPlay(): void {
  if (playbackActive()) stopPlayback();
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
  if (viewOverflow) text += ' 有零件超出视图，边界不会自己变；要看全就改边界宽高或点「框住零件」。';
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

function readStretch(input: HTMLInputElement): number {
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < ENTITY_STRETCH_MIN || value > ENTITY_STRETCH_MAX) {
    throw new Error(`拉伸要在 ${ENTITY_STRETCH_MIN} 到 ${ENTITY_STRETCH_MAX} 之间`);
  }
  return Math.round(value * 1000) / 1000;
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
  const freed = syncBanks();
  if (freed.length > 0) {
    renderParts();
    setStatus(`${freed.join('、')} 手调过，改成手调帧，不再跟 t0 重算`);
  }
  paintMain();
  paintBank();
}

function applyPartTransform(ctx: CanvasRenderingContext2D, part: EntityPlacement): void {
  const [a, b, c, d] = partLinear(part);
  ctx.translate(part.x, part.y);
  ctx.transform(a, b, c, d, 0, 0);
}

function drawPart(
  ctx: CanvasRenderingContext2D,
  grid: PaletteGridFile,
  part: EntityPlacement
): void {
  const placed = placedSprite(grid, part);
  const frame = renderSprite(placed.data);
  frame.anchorX = placed.anchorX;
  frame.anchorY = placed.anchorY;
  const sx = partScaleX(part);
  const sy = partScaleY(part);
  if (sx === sy && !part.skewX && !part.skewY) {
    blitPlacedSprite(ctx, frame, part.x, part.y, part.angle, sx);
    return;
  }
  ctx.save();
  applyPartTransform(ctx, part);
  blitPlacedSprite(ctx, frame, 0, 0, 0, 1);
  ctx.restore();
}

function paintMain(): void {
  const canvas = must(HTMLCanvasElement, 'asm-view');
  const stage = currentStage();
  const played = playPose && entity ? playPose : null;
  const order = stage ? stageDrawOrder(stage.parts) : [];
  const bounds = previewFrameRect({ width: frameW, height: frameH });
  const ref = refSize ? previewFrameRect(refSize) : null;
  const margin = Math.max(
    VIEW_MARGIN_MIN,
    Math.round(
      VIEW_MARGIN_SHARE * Math.max(frameW, frameH, refSize?.width ?? 0, refSize?.height ?? 0)
    )
  );
  const minX = Math.min(bounds.left, ref?.left ?? bounds.left) - margin;
  const minY = Math.min(bounds.top, ref?.top ?? bounds.top) - margin;
  const maxX = Math.max(bounds.right, ref?.right ?? bounds.right) + margin;
  const maxY = Math.max(bounds.bottom, ref?.bottom ?? bounds.bottom) + margin;
  const content = entity && stage ? stageBounds(entity, stage) : null;
  viewOverflow =
    content !== null &&
    (content.left < minX || content.top < minY || content.right > maxX || content.bottom > maxY);
  updateSizeReadout();
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
  if (played && entity) {
    paintPlayed(ctx, entity, played, scale);
    strokePreviewFrame(ctx, scale);
    if (ref) strokeReference(ctx, ref, scale);
    return;
  }
  if (entity && stage) {
    for (const index of order) {
      const part = stage.parts[index];
      const gridFile = part ? entity.grids[part.grid] : undefined;
      if (!part || !gridFile) continue;
      drawPart(ctx, gridFile, part);
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
    drawHandles(ctx, selectedGrid, selected, scale);
  }
  for (const part of stage.parts) {
    if (!anchorsOn && part.id !== partId) continue;
    for (const anchor of part.anchors ?? []) drawAnchor(ctx, part, anchor, scale);
  }
}

/** Played pose through the same part blit as editing. Mirrored poses flip about x = 0. */
function paintPlayed(
  ctx: CanvasRenderingContext2D,
  file: EntityFile,
  played: PlayedFrame,
  scale: number
): void {
  ctx.save();
  if (played.mirror) ctx.transform(-1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  for (const part of played.parts) {
    const grid = file.grids[part.grid];
    if (grid) drawPart(ctx, grid, part);
  }
  if (anchorsOn) {
    for (const part of played.parts) {
      for (const anchor of part.anchors ?? []) drawAnchor(ctx, part, anchor, scale);
    }
  }
  ctx.restore();
}

/** Canvas pixels per CSS pixel of the assembly view (it may be shown smaller than its backing size). */
function viewDensity(): number {
  const canvas = must(HTMLCanvasElement, 'asm-view');
  const width = canvas.getBoundingClientRect().width;
  return width > 0 ? canvas.width / width : 1;
}

function selectedHandles(grid: PaletteGridFile, part: EntityPlacement): PartHandle[] {
  const scale = viewMap?.scale ?? 1;
  return partHandles(grid, part, (ROTATE_STEM_PX * viewDensity()) / scale);
}

function drawHandles(
  ctx: CanvasRenderingContext2D,
  grid: PaletteGridFile,
  part: EntityPlacement,
  scale: number
): void {
  const handles = selectedHandles(grid, part);
  const fill = PALETTE[COLOR.WHITE] ?? '#ffffff';
  const edge = PALETTE[COLOR.PLAYER_GOLD_LIGHT] ?? '#fdb927';
  const unit = viewDensity() / scale;
  const size = HANDLE_PX * unit;
  const top = handles.find((handle) => handle.kind === 'n');
  const rotate = handles.find((handle) => handle.kind === 'rotate');
  ctx.save();
  ctx.lineWidth = unit;
  ctx.strokeStyle = edge;
  if (top && rotate) {
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(rotate.x, rotate.y);
    ctx.stroke();
  }
  for (const handle of handles) {
    ctx.fillStyle = fill;
    if (handle.kind === 'rotate') {
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, size / 2 + unit, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      continue;
    }
    if (skewMode() && (handle.ax === 0) !== (handle.ay === 0)) {
      const r = size * 0.75;
      ctx.beginPath();
      ctx.moveTo(handle.x, handle.y - r);
      ctx.lineTo(handle.x + r, handle.y);
      ctx.lineTo(handle.x, handle.y + r);
      ctx.lineTo(handle.x - r, handle.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      continue;
    }
    ctx.fillRect(handle.x - size / 2, handle.y - size / 2, size, size);
    ctx.strokeRect(handle.x - size / 2, handle.y - size / 2, size, size);
  }
  ctx.restore();
}

function eventPoint(event: MouseEvent): { x: number; y: number } | null {
  if (!viewMap) return null;
  const canvas = must(HTMLCanvasElement, 'asm-view');
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const sx = ((event.clientX - rect.left) * canvas.width) / rect.width;
  const sy = ((event.clientY - rect.top) * canvas.height) / rect.height;
  return {
    x: (sx - viewMap.bleed) / viewMap.scale + viewMap.minX,
    y: (sy - viewMap.bleed) / viewMap.scale + viewMap.minY,
  };
}

function handleUnder(
  point: { x: number; y: number },
  grid: PaletteGridFile,
  part: EntityPlacement
): PartHandle | null {
  const scale = viewMap?.scale ?? 1;
  return handleAt(
    selectedHandles(grid, part),
    point.x,
    point.y,
    (HANDLE_HIT_PX * viewDensity()) / scale
  );
}

function startDrag(event: PointerEvent): void {
  if (event.button !== 0 || !entity) return;
  const located = locate();
  const point = eventPoint(event);
  if (!located || !point) return;
  const { part, grid } = located;
  const handle = handleUnder(point, grid, part);
  const inside = placementContains(grid, part, point.x, point.y);
  if (!handle && !inside) return;
  drag = {
    mode: handle
      ? handle.kind === 'rotate'
        ? 'rotate'
        : skewMode() && (handle.ax === 0) !== (handle.ay === 0)
          ? 'skew'
          : 'stretch'
      : 'move',
    handle,
    start: clonePlacement(part),
    fromX: point.x,
    fromY: point.y,
    moved: false,
  };
  swallowClick = true;
  must(HTMLCanvasElement, 'asm-view').setPointerCapture(event.pointerId);
  event.preventDefault();
}

function moveDrag(event: PointerEvent): void {
  const canvas = must(HTMLCanvasElement, 'asm-view');
  const point = eventPoint(event);
  if (!point) return;
  if (!drag) {
    const located = locate();
    if (!located) {
      canvas.style.cursor = '';
      return;
    }
    const handle = handleUnder(point, located.grid, located.part);
    canvas.style.cursor = handle
      ? (HANDLE_CURSORS[handle.kind] ?? '')
      : placementContains(located.grid, located.part, point.x, point.y)
        ? 'move'
        : '';
    return;
  }
  const active = drag;
  editPart((part, grid) => {
    const start = active.start;
    if (active.mode === 'move') {
      part.x = start.x + Math.round(point.x - active.fromX);
      part.y = start.y + Math.round(point.y - active.fromY);
      return;
    }
    if (active.mode === 'rotate') {
      part.angle = dragAngle(
        start,
        active.fromX,
        active.fromY,
        point.x,
        point.y,
        event.shiftKey ? ANGLE_SHIFT_STEP_DEG : ANGLE_STEP_DEG
      );
      return;
    }
    if (!active.handle) return;
    if (active.mode === 'skew') {
      const skew = dragSkew(
        start,
        active.handle,
        point.x,
        point.y,
        event.shiftKey ? ANGLE_SHIFT_STEP_DEG : ANGLE_STEP_DEG
      );
      for (const key of ['skewX', 'skewY'] as const) {
        if (skew[key] === 0) delete part[key];
        else part[key] = skew[key];
      }
      return;
    }
    const next = dragStretch(grid, start, active.handle, point.x, point.y, event.shiftKey);
    for (const key of ['stretchX', 'stretchY'] as const) {
      if (next[key] === 1) delete part[key];
      else part[key] = next[key];
    }
  }, true);
  active.moved = true;
}

function endDrag(event: PointerEvent): void {
  const active = drag;
  if (!active) return;
  drag = null;
  const canvas = must(HTMLCanvasElement, 'asm-view');
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  if (!active.moved) {
    if (active.mode === 'move') swallowClick = false;
    return;
  }
  const part = locate()?.part;
  if (!part) return;
  const text =
    active.mode === 'move'
      ? `位置 (${part.x}, ${part.y})`
      : active.mode === 'rotate'
        ? `角度 ${formatDeg(part.angle)}°`
        : active.mode === 'skew'
          ? `斜切 X ${formatDeg(part.skewX ?? 0)}°，斜切 Y ${formatDeg(part.skewY ?? 0)}°`
          : `横向拉伸 ×${part.stretchX ?? 1}，纵向拉伸 ×${part.stretchY ?? 1}`;
  const stage = currentStage();
  const freed =
    stage &&
    !stage.bank &&
    (BANK_STAGE_IDS as readonly string[]).includes(stage.id) &&
    stage.id !== 't0';
  setStatus(`${part.id}：${text}${freed ? `。${stage.id} 是手调帧` : ''}`);
}

function skewMode(): boolean {
  return must(HTMLSelectElement, 'asm-handle-mode').value === 'skew';
}

function readSkew(input: HTMLInputElement): number {
  const degrees = Number(input.value);
  const limit = (ENTITY_SKEW_MAX * 180) / Math.PI;
  if (!Number.isFinite(degrees) || Math.abs(degrees) > limit + 1e-9) {
    throw new Error(`斜切要在 -${Math.round(limit)}° 到 ${Math.round(limit)}° 之间`);
  }
  return Math.max(-ENTITY_SKEW_MAX, Math.min(ENTITY_SKEW_MAX, (degrees * Math.PI) / 180)) + 0;
}

function arrowOwner(target: EventTarget | null): 'canvas' | 'bank' | null {
  if (target instanceof Element) {
    if (target.closest('#bank-panel')) return 'bank';
    if (target.id === 'asm-view' || target.closest('#asm-parts')) return 'canvas';
    if (target !== document.body && target !== document.documentElement) return null;
  }
  return keyOwner;
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
  const sx = partScaleX(part);
  const sy = partScaleY(part);
  const unit = 1 / (viewScale * Math.min(sx, sy));
  ctx.save();
  applyPartTransform(ctx, part);
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
