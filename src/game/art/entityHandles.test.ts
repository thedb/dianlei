import { describe, expect, it } from 'vitest';
import { sampleAssemblyEntity, type EntityPlacement } from './entityFile';
import {
  dragAngle,
  dragStretch,
  fromPartLocal,
  handleAt,
  partHandles,
  snapStretch,
  toPartLocal,
} from './entityHandles';

function body(): { part: EntityPlacement; grid: NonNullable<ReturnType<typeof gridOf>> } {
  const entity = sampleAssemblyEntity();
  const part = entity.stages[0]?.parts[0];
  const grid = gridOf(entity);
  if (!part || !grid) throw new Error('fixture missing body');
  return { part, grid };
}

function gridOf(entity: ReturnType<typeof sampleAssemblyEntity>) {
  return entity.grids.body;
}

describe('entity handles', () => {
  it('places eight box handles and a rotate handle on the sprite box', () => {
    const { part, grid } = body();
    const handles = partHandles(grid, part, 3);
    expect(handles.map((handle) => handle.kind)).toEqual([
      'nw',
      'n',
      'ne',
      'e',
      'se',
      's',
      'sw',
      'w',
      'rotate',
    ]);
    expect(handles[0]).toMatchObject({ x: -4, y: -5 });
    expect(handles[4]).toMatchObject({ x: 4, y: 5 });
    expect(handles[8]).toMatchObject({ x: 0, y: -8 });
    expect(handleAt(handles, 4.6, 5.4, 1)?.kind).toBe('se');
    expect(handleAt(handles, 20, 20, 1)).toBeNull();

    const turned = { ...part, angle: Math.PI / 2 };
    const ne = partHandles(grid, turned, 3)[2];
    expect(ne?.x).toBeCloseTo(5);
    expect(ne?.y).toBeCloseTo(4);
    const back = toPartLocal(turned, ne?.x ?? 0, ne?.y ?? 0);
    expect(back.x).toBeCloseTo(4);
    expect(back.y).toBeCloseTo(-5);
    const there = fromPartLocal(turned, back.x, back.y);
    expect(there.x).toBeCloseTo(ne?.x ?? 0);
  });

  it('snaps stretch to whole drawn pixels inside the stretch range', () => {
    expect(snapStretch(1.3, 8, 1)).toBe(1.25);
    expect(snapStretch(0.01, 8, 1)).toBe(0.125);
    expect(snapStretch(-2, 8, 1)).toBe(0.125);
    expect(snapStretch(9, 8, 1)).toBe(4);
    expect(snapStretch(0.5, 10, 2)).toBe(0.5);
  });

  it('stretches the driven axes from the handle ratio', () => {
    const { part, grid } = body();
    const handles = partHandles(grid, part, 3);
    const east = handles.find((handle) => handle.kind === 'e');
    const corner = handles.find((handle) => handle.kind === 'se');
    if (!east || !corner) throw new Error('missing handles');

    expect(dragStretch(grid, part, east, 8, 40, false)).toEqual({ stretchX: 2, stretchY: 1 });
    expect(dragStretch(grid, part, corner, 2, 10, false)).toEqual({ stretchX: 0.5, stretchY: 2 });
    expect(dragStretch(grid, part, corner, 6, 5, true)).toEqual({ stretchX: 1.25, stretchY: 1.3 });
    expect(dragStretch(grid, part, east, -8, 0, false).stretchX).toBe(0.125);

    const hinge = { ...part, pivot: { x: 0, y: 0 } };
    const west = partHandles(grid, hinge, 3).find((handle) => handle.kind === 'w');
    if (!west) throw new Error('missing west');
    expect(dragStretch(grid, hinge, west, -10, 0, false).stretchX).toBe(1);
  });

  it('turns around the pivot in snapped degree steps', () => {
    const { part } = body();
    expect(dragAngle(part, 0, -10, 10, 0, 1)).toBeCloseTo(Math.PI / 2);
    expect(dragAngle(part, 0, -10, 10, -9, 1)).toBeCloseTo((48 * Math.PI) / 180);
    expect(dragAngle(part, 0, -10, 10, -9, 15)).toBeCloseTo((45 * Math.PI) / 180);
    expect(dragAngle({ ...part, angle: Math.PI }, 0, -10, 10, 0, 1)).toBeCloseTo(-Math.PI / 2);
  });
});
