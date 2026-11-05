/**
 * Palette-use swatches and warnings shared by the part dialog and the inspector.
 */

import { COLOR, PALETTE } from '@/game/palette';
import {
  aspectIsSkewed,
  aspectSkew,
  gridColorStats,
  type GridColorStats,
} from '@/game/art/gridStats';

const SWATCH_LIMIT = 6;

const NAMES = new Map<number, string>(Object.entries(COLOR).map(([name, index]) => [index, name]));

export function paletteName(index: number): string {
  return NAMES.get(index) ?? `#${index}`;
}

/** Fill `box` with the most used colors and show warnings in `warn`. Returns the warning text. */
export function renderColorStats(
  box: HTMLElement,
  warn: HTMLElement,
  cells: readonly number[]
): string[] {
  const stats = gridColorStats(cells);
  box.replaceChildren();
  for (const use of stats.uses.slice(0, SWATCH_LIMIT)) {
    const item = document.createElement('span');
    item.className = 'swatch';
    const chip = document.createElement('i');
    chip.style.backgroundColor = PALETTE[use.index] ?? 'transparent';
    item.append(chip, `${use.index} ${percent(use.share)}`);
    item.title = `${paletteName(use.index)}：${use.count} 格`;
    box.append(item);
  }
  const rest = stats.uses.length - SWATCH_LIMIT;
  const summary = document.createElement('span');
  summary.className = 'hint';
  summary.textContent =
    `${stats.distinct} 种颜色，暗色 ${percent(stats.darkShare)}` +
    (rest > 0 ? `，另有 ${rest} 种` : '');
  box.append(summary);
  const messages = colorWarnings(stats);
  warn.hidden = messages.length === 0;
  warn.textContent = messages.join(' ');
  return messages;
}

export function colorWarnings(stats: GridColorStats): string[] {
  const top = stats.uses[0];
  return stats.warnings.map((code) => {
    if (code === 'empty') return '整张透明，没有不透明格。';
    if (code === 'dark') {
      return `暗色占不透明格的 ${percent(stats.darkShare)}，几乎全黑。调亮参考图，或换「量化」再看。`;
    }
    return `${top ? paletteName(top.index) : '一种颜色'} 占 ${percent(top?.share ?? 1)}，细节可能丢了。`;
  });
}

/** One line for the part dialog: source and target ratio, plus a warning when they drift apart. */
export function aspectLine(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): { text: string; skewed: boolean } {
  const skew = aspectSkew(sourceWidth, sourceHeight, targetWidth, targetHeight);
  const skewed = aspectIsSkewed(skew);
  const base =
    `源 ${sourceWidth}×${sourceHeight}（宽高比 ${ratio(sourceWidth, sourceHeight)}）→ ` +
    `目标 ${targetWidth}×${targetHeight}（${ratio(targetWidth, targetHeight)}）`;
  if (!skewed) return { text: `${base}，比例一致。`, skewed };
  const how = skew > 1 ? '上下被压扁' : '左右被压窄';
  const drift = Math.round(Math.abs(Math.max(skew, 1 / skew) - 1) * 100);
  return {
    text: `${base}。比例偏了 ${drift}%，${how}。勾「锁定源比例」或点「按源比例」。`,
    skewed,
  };
}

function ratio(width: number, height: number): string {
  return (width / height).toFixed(2);
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}
