/** Cells in the bank strip: left 5 (mirrored t5…t1), t0, right t1…t5. */
export const BANK_STRIP_CELLS = 11;

export function bankStripLevel(cell: number): number {
  return Math.abs(cell - 5);
}

/** Left of t0. The center cell is the level pose, not a mirror. */
export function bankStripMirrored(cell: number): boolean {
  return cell < 5;
}

export function bankStripStageId(cell: number): string {
  return `t${bankStripLevel(cell)}`;
}

/**
 * One focus ring. The other cell of the same stage (mirror or right-bank source)
 * stays unmarked, so two frames never look selected together.
 */
export function bankStripSelected(cell: number, focusedCell: number): boolean {
  return cell === focusedCell;
}

export function bankStripLabel(cell: number): string {
  const level = bankStripLevel(cell);
  if (level === 0) return 't0 平飞';
  if (bankStripMirrored(cell)) return `左${level} 镜像`;
  return `t${level}`;
}

/** Inspector title. A mirror cell names itself and the stage the sliders edit. */
export function bankFrameTitle(cell: number, stageLabel: string): string {
  const level = bankStripLevel(cell);
  if (bankStripMirrored(cell) && level > 0) return `左${level} 镜像 · ${stageLabel}`;
  return stageLabel;
}
