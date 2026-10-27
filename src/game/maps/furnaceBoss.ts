/**
 * 炉心浮台: Stage 3's boss arena, look C 淹水船坞废港 (`FURNACE_MAP_LOOK`).
 * One approach chunk, then a dockyard floor that loops. Row 0 of the approach
 * is 河流A's last row, cell for cell, so the stitch has no seam. Above it the
 * river banks burn out into mud, the channel floods a harbor basin (a
 * half-sunk barge, broken pilings, a crane boom down in the water), the basin
 * silts into a mud lane between two quays, and the yard starts. The approach
 * top row and both loop edges are the same seam row.
 *
 * The loop is dry: a mud lane down the middle (where the river ran), rusted
 * pads, quay walls, two dry-dock pits (one with a stranded barge), two crane
 * skeletons, pilings, and scrap. Puddles are painted on the mud, not water
 * tiles. No cloud sheet.
 *
 * Layouts are written top row first, as they read on screen.
 */

import { FURNACE_BOSS_CHUNKS, FURNACE_BOSS_SEED, MAP_CHUNK_ROWS } from '@/game/config';
import { TileId } from '@/game/art/tiles';
import {
  paintChunk,
  planChunks,
  type ChunkDef,
  type ChunkMapSpec,
  type ChunkPainter,
} from './chunks';
import { RIVER_A_LIBRARY, RIVER_A_SPEC } from './riverA';

const LAST = MAP_CHUNK_ROWS - 1;

export const FURNACE_LEGEND: Readonly<Record<string, TileId>> = {
  '.': TileId.harborMud,
  '#': TileId.harborSlab,
  '|': TileId.harborQuay,
  P: TileId.harborPit,
  H: TileId.bargeHull,
  '/': TileId.craneBoomNE,
  '\\': TileId.craneBoomNW,
  X: TileId.craneFoot,
  i: TileId.harborPiles,
  '%': TileId.harborScrap,
  b: TileId.harborBurn,
  '~': TileId.lake,
  F: TileId.forest,
  m: TileId.meadow,
  r: TileId.reeds,
};

/** The seam row: the approach's top row and both edges of the loop. */
export const FURNACE_SEAM = '..|######.....######|..';

/** Looping dockyard, rows 39 → 0. First and last are the seam. */
export const FURNACE_LOOP: readonly string[] = [
  FURNACE_SEAM,
  '..|##b###..%..######|.%',
  '..|######.....###b##|..',
  '..|######.....######|..',
  '..|######..i..######|..',
  '..|PPPPP#.....######|..',
  '.%|PPPPP#.....##b###|..',
  '..|PPPPP#..%..######|..',
  '..|PPPPP#.....######|..',
  '..|PPPPP#i....\\#####|..',
  '..|PPPPP#.....#\\####|..',
  '..|PPPPP#.....##\\###|..',
  '..|PPPPP#..%..###\\##|..',
  '..|PPPPP#.....####X#|..',
  '.%|PPPPP#.....######|..',
  '..|PPPPP#.....##b###|..',
  '..|PPPPP#..i..######|.%',
  '..|PPPPP#.....######|..',
  '..|######.....######|..',
  '..|##b###.....######|..',
  '..|######..%..######|..',
  '..|######.....######|..',
  '..|######.....#PPPPP|..',
  '..|######.....#PPPPP|..',
  '..|###b##..i..#PPPPP|..',
  '..|######.....#PHHHP|..',
  '..|######.....#PHHHP|..',
  '..|#####/.....#PHHHP|..',
  '..|####/#.....#PHHHP|..',
  '..|###/##..%..#PHHHP|..',
  '..|##/###.....#PHHHP|..',
  '..|#X####.....#PHHHP|..',
  '..|######.....#PHHHP|..',
  '.%|######..i..#PPPPP|..',
  '..|######.....#PPPPP|..',
  '..|######.....#PPPPP|..',
  '..|##b###.....######|..',
  '..|######..%..######|%.',
  '..|######.....######|..',
  FURNACE_SEAM,
];

/** Approach rows 39 → 1. Row 0 is 河流A's last row. */
/** Approach rows 39 → 1. Row 0 is 河流A's last row. */
export const FURNACE_APPROACH: readonly string[] = [
  FURNACE_SEAM,
  '..|######.....######|..',
  '..|##b###..i..######|..',
  '..|######.....###b##|..',
  '.%|######.....######|..',
  '..|######..%..######|..',
  '..|PPPPP#.....######|..',
  '..|PPPPP#.....##b###|..',
  '..|PPPPP#..i..######|..',
  '..|PPPPP#.....######|..',
  '..|######.....######|..',
  '..|######..~..######|..',
  '..|######.~~~.######|.%',
  '.%|#####..~~~..#####|..',
  '..|####..~~~~~..####|..',
  '..|###..~~~~~~~..###|..',
  '..|##..~~~~~~~~~..##|..',
  '..|#..~~~~HHH~~~~~..#|.',
  '.%|..~~~~~HHH~~~~~~..|%',
  '..|.~~~~~~HHH~~~~~~~.|.',
  '..|~~~i~~~HHH~~~i~~~|..',
  '..~~~~~~~~HHH~~~~~~~~..',
  '.b~~~~~~~~HHH~~~~\\~~~~.',
  '..~~~i~~~~~~~~~~~~\\~~..',
  '.b~~~~~~~~~~~~~~~~~\\~..',
  '...~~~~i~~~~~~~~~~~~X%.',
  '.b..~~~~~~~~~~~~~~~..%.',
  '.....~~~~~~~~~~~~~...b.',
  '..%...~~~~~~~~~~~..%...',
  '.b.b....~~~~~~~.....b..',
  '.....b...~~~~~...b.....',
  'FF.b.....~~~~~....%..bF',
  'FFF..%...~~~~~..b....FF',
  'FFFFb...~~~~~~~.....FFF',
  'FFFFFb..~~~~~~~..b.FFFF',
  'FFFFFF..m~~~~~m...FFFFF',
  'FFFFFFbmr~~~~~rm.bFFFFF',
  'FFFFFFFmm~~~~~mmFFFFFFF',
  'FFFFFFFmr~~~~~rmFFFFFFF',
];

let riverTop: readonly TileId[] | null = null;

/** 河流A's last row. Built from its own plan so this module does not need the registry. */
export function riverATopRow(): readonly TileId[] {
  if (!riverTop) {
    const plan = planChunks(RIVER_A_SPEC);
    const last = paintChunk(RIVER_A_LIBRARY, plan[plan.length - 1]!);
    riverTop = [...last[LAST]!];
  }
  return riverTop;
}

/** Paint a layout written top row first; `bottom` is the map row of its last line. */
function paintLayout(p: ChunkPainter, layout: readonly string[], bottom: number): void {
  layout.forEach((line, i) => {
    const row = bottom + layout.length - 1 - i;
    for (let c = 0; c < p.cols; c++) {
      const id = FURNACE_LEGEND[line[c]!];
      if (id === undefined) throw new Error(`furnaceBoss: bad cell '${line[c]}' at ${c},${row}`);
      p.set(c, row, id);
    }
  });
}

/** Burnt-out river valley, flooded harbor basin, silted lane, then the yard. */
export function paintFurnaceApproach(p: ChunkPainter, edge: readonly TileId[]): void {
  paintLayout(p, FURNACE_APPROACH, 1);
  for (let c = 0; c < p.cols; c++) p.set(c, 0, edge[c]!);
}

/** Looping dockyard. Row 0 and the last row are the seam row. */
export function paintFurnaceFloor(p: ChunkPainter): void {
  paintLayout(p, FURNACE_LOOP, 0);
}

const approach: ChunkDef = {
  id: 'approach',
  bottom: 'none',
  top: 'none',
  variants: 1,
  paint(p) {
    paintFurnaceApproach(p, riverATopRow());
  },
};

const dockyard: ChunkDef = {
  id: 'dockyard',
  bottom: 'none',
  top: 'none',
  variants: 1,
  paint(p) {
    paintFurnaceFloor(p);
  },
};

export const FURNACE_BOSS_LIBRARY: readonly ChunkDef[] = [approach, dockyard];

export const FURNACE_BOSS_SPEC: ChunkMapSpec = {
  library: FURNACE_BOSS_LIBRARY,
  seed: FURNACE_BOSS_SEED,
  maxRepeats: 1,
  slots: Array.from({ length: FURNACE_BOSS_CHUNKS }, (_, i) =>
    i === 0
      ? { fixed: 'approach' as const, variant: 0 }
      : { fixed: 'dockyard' as const, variant: 0 }
  ),
};

/** First row of the looping dockyard (the approach is the chunk below it). */
export const FURNACE_BOSS_LOOP_ROW = MAP_CHUNK_ROWS;
