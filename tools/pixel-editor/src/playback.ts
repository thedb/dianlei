import type { EntityFile, EntityPlacement } from '@/game/art/entityFile';
import {
  bankDepth,
  bankKeys,
  chainKeys,
  pairKeys,
  poseAt,
  timelineDuration,
  type PoseEase,
  type PoseKey,
  type PoseTimeline,
} from '@/game/art/entityTween';

export interface PlayedFrame {
  parts: EntityPlacement[];
  mirror: boolean;
}

export interface PlaybackHost {
  entity(): EntityFile | null;
  /** Show a played pose on the assembly canvas, or null to go back to editing. */
  show(frame: PlayedFrame | null): void;
  /** Leave part editing before playback takes the canvas. */
  release(): void;
}

type PlayMode = 'pair' | 'chain' | 'bank';

const SCRUB_STEPS = 1000;
/** Defaults per mode, in seconds: stage moves are slow and eased, bank steps are game-fast. */
const MODE_DEFAULTS: Record<PlayMode, { move: number; hold: number; ease: PoseEase }> = {
  pair: { move: 0.8, hold: 0.4, ease: 'smooth' },
  chain: { move: 0.8, hold: 0.4, ease: 'smooth' },
  bank: { move: 0.05, hold: 0, ease: 'linear' },
};
const MOVE_MIN = 0.02;
const TIME_MAX = 10;

let host: PlaybackHost | null = null;
let timeline: PoseTimeline | null = null;
let time = 0;
let playing = false;
let active = false;
let frameRequest: number | null = null;
let lastStamp: number | null = null;

export function mountPlayback(next: PlaybackHost): void {
  host = next;
  const mode = must(HTMLSelectElement, 'play-mode');
  mode.addEventListener('change', () => {
    const defaults = MODE_DEFAULTS[readMode()];
    must(HTMLInputElement, 'play-move').value = String(defaults.move);
    must(HTMLInputElement, 'play-hold').value = String(defaults.hold);
    must(HTMLSelectElement, 'play-ease').value = defaults.ease;
    syncModeFields();
    rebuild(true);
  });
  for (const id of ['play-from', 'play-to', 'play-ease', 'play-speed']) {
    must(HTMLElement, id).addEventListener('change', () => {
      rebuild(id === 'play-from' || id === 'play-to');
    });
  }
  for (const id of ['play-move', 'play-hold', 'play-loop', 'play-snap']) {
    must(HTMLInputElement, id).addEventListener('change', () => {
      rebuild(false);
    });
  }
  must(HTMLButtonElement, 'play-toggle').addEventListener('click', () => {
    if (playing) pause();
    else play();
  });
  must(HTMLButtonElement, 'play-stop').addEventListener('click', () => {
    stopPlayback();
  });
  must(HTMLButtonElement, 'play-hide').addEventListener('click', () => {
    closePlaybackPanel();
  });
  const scrub = must(HTMLInputElement, 'play-scrub');
  scrub.addEventListener('input', () => {
    if (!ensureTimeline()) return;
    pause();
    time = (Number(scrub.value) / SCRUB_STEPS) * duration();
    showFrame();
  });
  syncModeFields();
}

/** Open the panel (or close it when already open and idle). Opening plays right away. */
export function togglePlaybackPanel(): void {
  const panel = must(HTMLElement, 'play-panel');
  if (!panel.hidden) {
    closePlaybackPanel();
    return;
  }
  panel.hidden = false;
  refreshPlaybackStages();
  const entity = host?.entity();
  if (entity && bankDepth(entity) > 0 && entity.stages.length === bankDepth(entity) + 1) {
    must(HTMLSelectElement, 'play-mode').value = 'bank';
    must(HTMLSelectElement, 'play-mode').dispatchEvent(new Event('change'));
  }
  syncOpenButton();
  if (!active) play();
}

export function closePlaybackPanel(): void {
  stopPlayback();
  must(HTMLElement, 'play-panel').hidden = true;
  syncOpenButton();
}

export function playbackActive(): boolean {
  return active;
}

/** Back to editing: the canvas shows the selected stage again. */
export function stopPlayback(): void {
  const wasActive = active;
  pause();
  active = false;
  time = 0;
  timeline = null;
  must(HTMLInputElement, 'play-scrub').value = '0';
  setReadout('停止。装配画布回到当前阶段，可以继续编辑。');
  syncOpenButton();
  if (wasActive) host?.show(null);
}

/** Refill the stage pickers after stages change. Keeps the picks that still exist. */
export function refreshPlaybackStages(): void {
  const entity = host?.entity();
  const ids = entity?.stages.map((stage) => ({ id: stage.id, name: stage.name })) ?? [];
  const from = must(HTMLSelectElement, 'play-from');
  const to = must(HTMLSelectElement, 'play-to');
  const keepFrom = from.value;
  const keepTo = to.value;
  for (const select of [from, to]) {
    select.replaceChildren(
      ...ids.map(({ id, name }) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name ? `${id} ${name}` : id;
        return option;
      })
    );
  }
  if (ids.some((item) => item.id === keepFrom)) from.value = keepFrom;
  if (ids.some((item) => item.id === keepTo)) to.value = keepTo;
  else if (ids.length > 1) to.value = ids[ids.length - 1]?.id ?? '';
  if (from.value === to.value && ids.length > 1) {
    to.value = ids.find((item) => item.id !== from.value)?.id ?? to.value;
  }
}

function play(): void {
  if (!ensureTimeline()) return;
  if (!timeline?.loop && time >= duration()) time = 0;
  if (!active) host?.release();
  active = true;
  playing = true;
  lastStamp = null;
  syncToggle();
  syncOpenButton();
  showFrame();
  frameRequest = requestAnimationFrame(tick);
}

function pause(): void {
  playing = false;
  if (frameRequest !== null) cancelAnimationFrame(frameRequest);
  frameRequest = null;
  lastStamp = null;
  syncToggle();
}

function tick(stamp: number): void {
  if (!playing) return;
  if (lastStamp !== null) time += ((stamp - lastStamp) / 1000) * readSpeed();
  lastStamp = stamp;
  if (timeline && !timeline.loop && time >= duration()) {
    time = duration();
    showFrame();
    pause();
    return;
  }
  showFrame();
  frameRequest = requestAnimationFrame(tick);
}

function ensureTimeline(): boolean {
  if (timeline) return true;
  return rebuild(true);
}

/** Rebuild from the controls. `restart` rewinds; otherwise keep the same share of the run. */
function rebuild(restart: boolean): boolean {
  const entity = host?.entity();
  const share = timeline && duration() > 0 ? time / duration() : 0;
  if (!entity) {
    timeline = null;
    setReadout('还没有装配。');
    return false;
  }
  const loop = must(HTMLInputElement, 'play-loop').checked;
  let keys: PoseKey[];
  try {
    const mode = readMode();
    if (mode === 'bank') keys = bankKeys(entity);
    else if (mode === 'chain') keys = chainKeys(entity, loop);
    else {
      keys = pairKeys(
        entity,
        must(HTMLSelectElement, 'play-from').value,
        must(HTMLSelectElement, 'play-to').value,
        loop
      );
    }
  } catch (error) {
    timeline = null;
    if (active) stopPlayback();
    setReadout(error instanceof Error ? error.message : '无法播放');
    return false;
  }
  timeline = {
    keys,
    move: readSeconds('play-move', MOVE_MIN, MODE_DEFAULTS.pair.move),
    hold: readSeconds('play-hold', 0, 0),
    loop,
  };
  time = restart ? 0 : share * duration();
  if (active) showFrame();
  return true;
}

function showFrame(): void {
  const entity = host?.entity();
  if (!entity || !timeline) return;
  const pose = poseAt(
    entity,
    timeline,
    time,
    must(HTMLSelectElement, 'play-ease').value === 'linear' ? 'linear' : 'smooth',
    must(HTMLInputElement, 'play-snap').checked
  );
  if (!pose) return;
  host?.show({ parts: pose.parts, mirror: pose.mirror });
  const total = duration();
  must(HTMLInputElement, 'play-scrub').value = String(
    total > 0 ? Math.round((Math.min(time, total) / total) * SCRUB_STEPS) : 0
  );
  const from = timeline.keys[pose.sample.from];
  const to = timeline.keys[pose.sample.to];
  const shown = total > 0 ? (timeline.loop ? time % total : Math.min(time, total)) : 0;
  const clock = `${shown.toFixed(2)} / ${total.toFixed(2)} 秒`;
  const step = `第 ${pose.sample.from + 1} / ${timeline.keys.length} 个姿态`;
  if (!from || !to || pose.sample.holding || from === to) {
    setReadout(`停在 ${from?.label ?? ''} · ${step} · ${clock}`);
  } else {
    setReadout(
      `${from.label} → ${to.label} · ${Math.round(pose.sample.t * 100)}% · ${step} · ${clock}`
    );
  }
}

function duration(): number {
  return timeline ? timelineDuration(timeline) : 0;
}

function readMode(): PlayMode {
  const value = must(HTMLSelectElement, 'play-mode').value;
  return value === 'chain' || value === 'bank' ? value : 'pair';
}

function readSpeed(): number {
  const value = Number(must(HTMLSelectElement, 'play-speed').value);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function readSeconds(id: string, min: number, fallback: number): number {
  const input = must(HTMLInputElement, id);
  const value = Number(input.value);
  if (!Number.isFinite(value)) {
    input.value = String(fallback);
    return fallback;
  }
  const clamped = Math.min(TIME_MAX, Math.max(min, value));
  if (clamped !== value) input.value = String(clamped);
  return clamped;
}

function syncModeFields(): void {
  const pair = readMode() === 'pair';
  must(HTMLElement, 'play-from-label').hidden = !pair;
  must(HTMLElement, 'play-to-label').hidden = !pair;
  must(HTMLElement, 'play-loop-label').title =
    readMode() === 'bank'
      ? '侧倾循环总是回到 t0；关掉循环就只播一遍。'
      : '开着：A → B 后再回 A，一直循环。关掉：只播一遍，停在终点。';
}

function syncToggle(): void {
  const button = must(HTMLButtonElement, 'play-toggle');
  button.textContent = playing ? '暂停' : '播放';
  button.setAttribute('aria-pressed', playing ? 'true' : 'false');
}

function syncOpenButton(): void {
  const button = must(HTMLButtonElement, 'asm-play');
  const open = !must(HTMLElement, 'play-panel').hidden;
  button.setAttribute('aria-pressed', open ? 'true' : 'false');
  button.textContent = open ? '收起播放' : '播放预览';
}

function setReadout(text: string): void {
  must(HTMLOutputElement, 'play-frame').textContent = text;
}

function must<T extends HTMLElement>(ctor: new () => T, id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof ctor)) throw new Error(`missing #${id}`);
  return element;
}
