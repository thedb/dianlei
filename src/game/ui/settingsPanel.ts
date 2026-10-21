/**
 * Settings page (design doc §8): controls + audio, applied immediately.
 * Opened from the title screen and from the pause menu.
 */

import type { InputState, ControlsView } from '@/engine/input';
import { LOGICAL_W, LOGICAL_H, CONTROL_SCALE_MIN, CONTROL_SCALE_MAX } from '@/game/config';
import {
  CONTROL_OPACITY_MIN,
  CONTROL_OPACITY_MAX,
  TITLE_BACKGROUND_LABEL,
  TITLE_BACKGROUNDS,
  type Settings,
  type SettingsStore,
  type TitleBackground,
} from '@/game/settings';
import { drawControls } from './controlsOverlay';
import {
  drawPanel,
  drawText,
  drawButton,
  drawScrim,
  hitRect,
  tappedIndex,
  UI_COLORS,
  type Rect,
} from './widgets';

interface ChoiceRow<K extends keyof Settings> {
  kind: 'choice';
  label: string;
  key: K;
  options: ReadonlyArray<{ value: Settings[K]; label: string }>;
}

interface SliderRow {
  kind: 'slider';
  label: string;
  key: 'controlOpacity' | 'controlScale' | 'bgmVolume';
  min: number;
  max: number;
  step: number;
}

interface ActionRow {
  kind: 'action';
  label: string;
  action: 'reset' | 'back';
}

type Row =
  | ChoiceRow<'joystickMode'>
  | ChoiceRow<'buttonLayout'>
  | ChoiceRow<'muted'>
  | ChoiceRow<'bgmEnabled'>
  | ChoiceRow<'debugMode'>
  | ChoiceRow<'titleBackground'>
  | SliderRow
  | ActionRow;

const ROWS: Row[] = [
  {
    kind: 'choice',
    label: '摇杆模式',
    key: 'joystickMode',
    options: [
      { value: 'fixed', label: '固定' },
      { value: 'floating', label: '动态' },
    ],
  },
  {
    kind: 'choice',
    label: '按键布局',
    key: 'buttonLayout',
    options: [
      { value: 'aLow', label: 'A低B高' },
      { value: 'aHigh', label: 'A高B低' },
    ],
  },
  {
    kind: 'slider',
    label: '控件透明度',
    key: 'controlOpacity',
    min: CONTROL_OPACITY_MIN,
    max: CONTROL_OPACITY_MAX,
    step: 0.1,
  },
  {
    kind: 'slider',
    label: '控件大小',
    key: 'controlScale',
    min: CONTROL_SCALE_MIN,
    max: CONTROL_SCALE_MAX,
    step: 0.05,
  },
  {
    kind: 'choice',
    label: '音效',
    key: 'muted',
    options: [
      { value: false, label: '开' },
      { value: true, label: '静音' },
    ],
  },
  {
    kind: 'choice',
    label: '背景音乐',
    key: 'bgmEnabled',
    options: [
      { value: false, label: '关' },
      { value: true, label: '开' },
    ],
  },
  {
    kind: 'slider',
    label: '音乐音量',
    key: 'bgmVolume',
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    kind: 'choice',
    label: '调试模式',
    key: 'debugMode',
    options: [
      { value: false, label: '关' },
      { value: true, label: '开' },
    ],
  },
  {
    kind: 'choice',
    label: '标题背景',
    key: 'titleBackground',
    options: TITLE_BACKGROUNDS.map((value: TitleBackground) => ({
      value,
      label: TITLE_BACKGROUND_LABEL[value],
    })),
  },
  { kind: 'action', label: '恢复默认', action: 'reset' },
  { kind: 'action', label: '返回', action: 'back' },
];

const PANEL: Rect = { x: 16, y: 12, w: LOGICAL_W - 32, h: 524 };
const ROW_TOP = PANEL.y + 40;
const ROW_H = 40;
const CONTROL_X = 150;
const CONTROL_W = PANEL.x + PANEL.w - 16 - CONTROL_X;
const SLIDER_W = CONTROL_W - 52;

function rowRect(i: number): Rect {
  return { x: PANEL.x + 8, y: ROW_TOP + i * ROW_H, w: PANEL.w - 16, h: ROW_H - 6 };
}

function optionRects(i: number, count: number): Rect[] {
  const r = rowRect(i);
  const w = CONTROL_W / count;
  return Array.from({ length: count }, (_, k) => ({
    x: CONTROL_X + k * w,
    y: r.y + 4,
    w: w - 4,
    h: r.h - 8,
  }));
}

function sliderTrack(i: number): Rect {
  const r = rowRect(i);
  return { x: CONTROL_X + 6, y: r.y + r.h / 2 - 10, w: SLIDER_W, h: 20 };
}

function snap(v: number, row: SliderRow): number {
  const steps = Math.round((v - row.min) / row.step);
  return Math.min(row.max, Math.max(row.min, +(row.min + steps * row.step).toFixed(3)));
}

export interface SettingsPanel {
  open(): void;
  update(input: InputState): 'close' | null;
  render(ctx: CanvasRenderingContext2D, controls: ControlsView, title: string): void;
}

export function createSettingsPanel(store: SettingsStore): SettingsPanel {
  let selected = 0;
  /** Pointer currently dragging a slider: [pointerId, row index] */
  let drag: [number, number] | null = null;

  function setSlider(row: SliderRow, value: number): void {
    store.update({ [row.key]: snap(value, row) } as Partial<Settings>);
  }

  function cycleChoice(row: Exclude<Row, SliderRow | ActionRow>, dir: number): void {
    const current = store.get()[row.key];
    const idx = row.options.findIndex((o) => o.value === current);
    const next = row.options[(idx + dir + row.options.length) % row.options.length]!;
    store.update({ [row.key]: next.value } as Partial<Settings>);
  }

  function activate(row: Row): 'close' | null {
    if (row.kind === 'action') {
      if (row.action === 'reset') store.reset();
      return row.action === 'back' ? 'close' : null;
    }
    if (row.kind === 'choice') cycleChoice(row, 1);
    return null;
  }

  function sliderFromX(i: number, x: number): void {
    const row = ROWS[i] as SliderRow;
    const track = sliderTrack(i);
    const t = Math.min(1, Math.max(0, (x - track.x) / track.w));
    setSlider(row, row.min + t * (row.max - row.min));
  }

  return {
    open(): void {
      selected = 0;
      drag = null;
    },

    update(input: InputState): 'close' | null {
      if (input.menuBack) return 'close';

      if (input.menuUp) selected = (selected + ROWS.length - 1) % ROWS.length;
      if (input.menuDown) selected = (selected + 1) % ROWS.length;

      const row = ROWS[selected]!;
      if (input.menuLeft || input.menuRight) {
        const dir = input.menuRight ? 1 : -1;
        if (row.kind === 'slider') setSlider(row, store.get()[row.key] + dir * row.step);
        else if (row.kind === 'choice') cycleChoice(row, dir);
      }
      if (input.menuConfirm) {
        const result = activate(row);
        if (result) return result;
      }

      for (const tap of input.taps) {
        for (let i = 0; i < ROWS.length; i++) {
          const r = ROWS[i]!;
          if (!hitRect(rowRect(i), tap.x, tap.y)) continue;
          selected = i;
          if (r.kind === 'choice') {
            const k = tappedIndex(optionRects(i, r.options.length), [tap]);
            if (k >= 0) store.update({ [r.key]: r.options[k]!.value } as Partial<Settings>);
          } else if (r.kind === 'slider') {
            const track = sliderTrack(i);
            if (tap.x >= track.x - 8 && tap.x <= track.x + track.w + 8) {
              sliderFromX(i, tap.x);
              const p = input.pointers.find((pt) => pt.startX === tap.x && pt.startY === tap.y);
              if (p) drag = [p.id, i];
            }
          } else if (activate(r) === 'close') {
            return 'close';
          }
        }
      }

      if (drag) {
        const [id, i] = drag;
        const p = input.pointers.find((pt) => pt.id === id);
        if (p) sliderFromX(i, p.x);
        else drag = null;
      }

      return null;
    },

    render(ctx: CanvasRenderingContext2D, controls: ControlsView, title: string): void {
      const s = store.get();
      drawScrim(ctx, LOGICAL_W, LOGICAL_H);

      // Live preview of the on-screen controls at their real positions
      const home = controls.layout.fixedJoystick;
      drawControls(
        ctx,
        {
          ...controls,
          buttonAPressed: false,
          buttonBPressed: false,
          joystick: {
            active: false,
            baseX: home.x,
            baseY: home.y,
            knobX: home.x,
            knobY: home.y,
            alpha: 1,
          },
        },
        { bDisabled: false }
      );

      drawPanel(ctx, PANEL);
      drawText(ctx, title, LOGICAL_W / 2, PANEL.y + 28, 20, UI_COLORS.accent, 'center');

      ROWS.forEach((row, i) => {
        const r = rowRect(i);
        const isSel = i === selected;
        if (row.kind === 'action') {
          drawButton(ctx, { x: r.x + 40, y: r.y, w: r.w - 80, h: r.h }, row.label, isSel);
          return;
        }
        if (isSel) {
          ctx.fillStyle = UI_COLORS.rowSelected;
          ctx.fillRect(r.x, r.y, r.w, r.h);
        }
        drawText(ctx, row.label, r.x + 10, r.y + r.h / 2, 15, UI_COLORS.text);

        if (row.kind === 'choice') {
          const rects = optionRects(i, row.options.length);
          row.options.forEach((opt, k) => {
            const active = s[row.key] === opt.value;
            const rr = rects[k]!;
            ctx.fillStyle = active ? UI_COLORS.accentDark : 'rgba(255,255,255,0.06)';
            ctx.fillRect(rr.x, rr.y, rr.w, rr.h);
            ctx.strokeStyle = active ? UI_COLORS.accent : 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1;
            ctx.strokeRect(rr.x + 0.5, rr.y + 0.5, rr.w - 1, rr.h - 1);
            drawText(
              ctx,
              opt.label,
              rr.x + rr.w / 2,
              rr.y + rr.h / 2,
              row.options.length > 2 ? 12 : 14,
              active ? UI_COLORS.text : UI_COLORS.dim,
              'center'
            );
          });
        } else {
          const track = sliderTrack(i);
          const t = (s[row.key] - row.min) / (row.max - row.min);
          const midY = track.y + track.h / 2;
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillRect(track.x, midY - 2, track.w, 4);
          ctx.fillStyle = UI_COLORS.accent;
          ctx.fillRect(track.x, midY - 2, track.w * t, 4);
          ctx.beginPath();
          ctx.arc(track.x + track.w * t, midY, 7, 0, Math.PI * 2);
          ctx.fill();
          drawText(
            ctx,
            `${Math.round(s[row.key] * 100)}%`,
            track.x + track.w + 10,
            midY,
            13,
            UI_COLORS.text
          );
        }
      });

      drawText(
        ctx,
        '↑↓ 选择  ←→ 调整  Esc 返回',
        LOGICAL_W / 2,
        PANEL.y + PANEL.h - 14,
        11,
        UI_COLORS.dim,
        'center'
      );
    },
  };
}
