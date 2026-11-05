import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { COLOR } from '@/game/palette';
import {
  createEmptyEntity,
  defaultPreviewFrame,
  parseEntityFile,
  previewFrameOf,
  previewFrameRect,
  suggestedPreviewFrame,
  placedHit,
  placedHitLocal,
  placedSprite,
  placementContains,
  placementCorners,
  sampleAssemblyEntity,
  serializeEntityFile,
  stageDrawOrder,
  type EntityPlacement,
} from './entityFile';

const fixturePath = resolve(process.cwd(), 'tools/pixel-editor/fixtures/sample.entity.json');

describe('entity file', () => {
  it('round-trips the folded / half / open fixture', () => {
    const file = readFileSync(fixturePath, 'utf8');
    const parsed = parseEntityFile(file);
    expect(file).toBe(serializeEntityFile(parsed));
    expect(serializeEntityFile(sampleAssemblyEntity())).toBe(file);
    expect(parsed.name).toBe('sample-assembly');
    expect(Object.keys(parsed.grids)).toEqual(['body', 'wing']);
    expect(parsed.stages.map((stage) => stage.id)).toEqual(['folded', 'half', 'open']);

    const body = parsed.grids.body;
    const wing = parsed.grids.wing;
    expect(body?.width).toBe(8);
    expect(body?.height).toBe(10);
    expect(body?.cells[4]).toBe(COLOR.PLAYER_CYAN);
    expect(wing?.width).toBe(4);
    expect(wing?.height).toBe(8);
    expect(wing?.cells[3]).toBe(COLOR.PLAYER_CYAN);
    expect(wing?.cells[0]).toBe(COLOR.PLAYER_MED_CYAN);

    const folded = parsed.stages[0];
    const half = parsed.stages[1];
    const open = parsed.stages[2];
    expect(folded?.parts.map((part) => part.id)).toEqual(['body', 'wingL', 'wingR']);
    expect(folded?.parts[0]?.hit).toEqual({ x: 0, y: 0, w: 8, h: 10 });
    expect(folded?.parts[1]?.hit).toBeUndefined();
    expect(folded?.parts[1]?.flipX).toBe(false);
    expect(folded?.parts[2]?.flipX).toBe(true);
    expect(folded?.parts[0]?.scale).toBe(1);
    expect(folded?.parts[1]?.angle).toBe(0);
    expect(folded?.parts[2]?.angle).toBe(0);
    expect(half?.parts[2]?.angle).toBe(Math.PI / 2);
    expect(open?.parts[1]?.angle).toBe(-Math.PI / 2);
    expect(open?.parts[2]?.angle).toBe(Math.PI / 2);
    expect(open?.parts[1]?.hit).toEqual({ x: 0, y: 0, w: 4, h: 8 });
    expect(file).not.toContain('flipY');
  });

  it('mirrors a wing in pixel indices and flips a partial hit box', () => {
    const entity = sampleAssemblyEntity();
    const wing = entity.grids.wing;
    const folded = entity.stages[0];
    if (!wing || !folded) throw new Error('fixture missing wing');
    const left = folded.parts.find((part) => part.id === 'wingL');
    const right = folded.parts.find((part) => part.id === 'wingR');
    if (!left || !right) throw new Error('fixture missing wings');

    const unflipped = placedSprite(wing, left);
    expect(unflipped.anchorX).toBe(3);
    expect(unflipped.anchorY).toBe(1);
    expect(unflipped.data[0]?.[3]).toBe(COLOR.PLAYER_CYAN);

    const flipped = placedSprite(wing, right);
    expect(flipped.anchorX).toBe(0);
    expect(flipped.anchorY).toBe(1);
    expect(flipped.data[0]?.[0]).toBe(COLOR.PLAYER_CYAN);
    expect(flipped.data[0]?.[3]).toBe(COLOR.PLAYER_MED_CYAN);

    const partial: EntityPlacement = { ...right, hit: { x: 0, y: 0, w: 1, h: 2 } };
    expect(placedHit(wing, partial)).toEqual({ x: 3, y: 0, w: 1, h: 2 });
    expect(placedHit(wing, left)).toBeNull();
  });

  it('places angle 0 on the bitmap box and rotates the open wing around its pivot', () => {
    const entity = sampleAssemblyEntity();
    const bodyGrid = entity.grids.body;
    const wing = entity.grids.wing;
    const folded = entity.stages[0];
    const open = entity.stages.find((stage) => stage.id === 'open');
    const body = folded?.parts[0];
    const left = open?.parts.find((part) => part.id === 'wingL');
    if (!bodyGrid || !wing || !body || !left) throw new Error('fixture missing parts');

    expect(placementCorners(bodyGrid, body)).toEqual([
      [-4, -5],
      [4, -5],
      [4, 5],
      [-4, 5],
    ]);
    const right = folded?.parts.find((part) => part.id === 'wingR');
    if (!right) throw new Error('fixture missing wingR');
    expect(placementCorners(wing, right)).toEqual([
      [4, -1],
      [8, -1],
      [8, 7],
      [4, 7],
    ]);

    const [x, y] = placementCorners(wing, left)[0] ?? [Number.NaN, Number.NaN];
    expect(x).toBeCloseTo(-5, 6);
    expect(y).toBeCloseTo(3, 6);
    expect(placedHitLocal(bodyGrid, body)).toEqual({ x: -4, y: -5, w: 8, h: 10 });

    const doubled = { ...body, scale: 2 };
    expect(placementCorners(bodyGrid, doubled)).toEqual([
      [-8, -10],
      [8, -10],
      [8, 10],
      [-8, 10],
    ]);
    expect(placementContains(bodyGrid, body, 0, 0)).toBe(true);
    expect(placementContains(bodyGrid, body, 4, 0)).toBe(false);
    expect(placementContains(bodyGrid, doubled, 7, 9)).toBe(true);
    expect(placementContains(bodyGrid, doubled, 8, 0)).toBe(false);
  });

  it('draws lower layers first and keeps file order on a tie', () => {
    const parts = sampleAssemblyEntity().stages[0]?.parts;
    if (!parts) throw new Error('fixture missing parts');
    const shuffled = parts.map((part) => ({ ...part, pivot: { ...part.pivot } }));
    const body = shuffled[0];
    const left = shuffled[1];
    const right = shuffled[2];
    if (!body || !left || !right) throw new Error('fixture missing parts');
    body.layer = 5;
    left.layer = 1;
    right.layer = 1;
    expect(stageDrawOrder(shuffled)).toEqual([1, 2, 0]);
  });

  it('sorts grid keys and drops unknown fields', () => {
    const entity = sampleAssemblyEntity();
    const body = entity.grids.body;
    const wing = entity.grids.wing;
    if (!body || !wing) throw new Error('fixture missing grids');
    entity.grids = { wing, body };
    const text = serializeEntityFile(entity);
    expect(text.indexOf('"body"')).toBeLessThan(text.indexOf('"wing"'));

    const withExtra = text.replace('"flipX": false', '"flipX": false, "flipY": true');
    expect(serializeEntityFile(parseEntityFile(withExtra))).toBe(text);
    expect(text).not.toContain('flipY');
  });

  it('rejects a bad pivot, a missing grid, a duplicate id, and a non-finite angle', () => {
    const entity = sampleAssemblyEntity();
    const part = entity.stages[0]?.parts[0];
    if (!part) throw new Error('fixture missing body');

    part.pivot = { x: 99, y: 0 };
    expect(() => serializeEntityFile(entity)).toThrow(/pivot\.x/);

    part.pivot = { x: 4, y: 5 };
    part.grid = 'missing';
    expect(() => serializeEntityFile(entity)).toThrow(/missing grid/);

    part.grid = 'body';
    const stage = entity.stages[0];
    if (!stage) throw new Error('fixture missing stage');
    const duplicate: EntityPlacement = {
      id: part.id,
      grid: part.grid,
      x: part.x,
      y: part.y,
      pivot: { x: part.pivot.x, y: part.pivot.y },
      angle: part.angle,
      flipX: part.flipX,
      scale: part.scale,
      layer: part.layer,
    };
    if (part.hit?.shape === 'circle') {
      duplicate.hit = { shape: 'circle', x: part.hit.x, y: part.hit.y, r: part.hit.r };
    } else if (part.hit) {
      duplicate.hit = { x: part.hit.x, y: part.hit.y, w: part.hit.w, h: part.hit.h };
    }
    stage.parts.push(duplicate);
    expect(() => serializeEntityFile(entity)).toThrow(/duplicate part id/);

    stage.parts.pop();
    part.angle = Number.POSITIVE_INFINITY;
    expect(() => serializeEntityFile(entity)).toThrow(/angle/);

    const copy = sampleAssemblyEntity();
    const first = copy.stages[0];
    if (!first) throw new Error('fixture missing stage');
    copy.stages.push({ id: first.id, parts: [] });
    expect(() => serializeEntityFile(copy)).toThrow(/duplicate stage id/);
  });

  it('round-trips an empty entity and rejects a path name', () => {
    const empty = createEmptyEntity('entity');
    expect(empty.stages[0]?.parts).toEqual([]);
    expect(serializeEntityFile(parseEntityFile(serializeEntityFile(empty)))).toBe(
      serializeEntityFile(empty)
    );
    expect(() => createEmptyEntity('a/b')).toThrow(/path/);
  });

  it('defaults a missing scale to 1 and accepts a fraction in (0, 16]', () => {
    const text = serializeEntityFile(sampleAssemblyEntity());
    const stripped = text.split('\n          "scale": 1,').join('');
    expect(stripped).not.toContain('"scale"');
    const parsed = parseEntityFile(stripped);
    expect(parsed.stages[0]?.parts[0]?.scale).toBe(1);
    expect(serializeEntityFile(parsed)).toBe(text);

    const entity = sampleAssemblyEntity();
    const bodyGrid = entity.grids.body;
    const part = entity.stages[0]?.parts[0];
    if (!bodyGrid || !part) throw new Error('fixture missing body');
    part.scale = 0.5;
    const halved = serializeEntityFile(entity);
    expect(halved).toContain('"scale": 0.5');
    expect(parseEntityFile(halved).stages[0]?.parts[0]?.scale).toBe(0.5);
    expect(placementCorners(bodyGrid, part)).toEqual([
      [-2, -2.5],
      [2, -2.5],
      [2, 2.5],
      [-2, 2.5],
    ]);
    expect(placementContains(bodyGrid, part, 0, 0)).toBe(true);
    expect(placementContains(bodyGrid, part, 1.9, 2.4)).toBe(true);
    expect(placementContains(bodyGrid, part, 2, 0)).toBe(false);

    part.scale = 16;
    expect(parseEntityFile(serializeEntityFile(entity)).stages[0]?.parts[0]?.scale).toBe(16);
    part.scale = 0;
    expect(() => serializeEntityFile(entity)).toThrow(/scale/);
    part.scale = 16.1;
    expect(() => serializeEntityFile(entity)).toThrow(/scale/);
    part.scale = -0.5;
    expect(() => serializeEntityFile(entity)).toThrow(/scale/);
  });

  it('keeps an omitted preview frame off the file and round-trips one that is set', () => {
    const sample = sampleAssemblyEntity();
    expect(sample.previewFrame).toBeUndefined();
    expect(previewFrameOf(sample)).toEqual(defaultPreviewFrame());
    expect(previewFrameRect(defaultPreviewFrame())).toEqual({
      left: -180,
      top: -320,
      right: 180,
      bottom: 320,
    });
    expect(serializeEntityFile(sample)).not.toContain('previewFrame');

    const fitted = suggestedPreviewFrame(sample);
    const rect = previewFrameRect(fitted);
    for (const stage of sample.stages) {
      for (const part of stage.parts) {
        const grid = sample.grids[part.grid];
        if (!grid) throw new Error(`missing grid ${part.grid}`);
        for (const [x, y] of placementCorners(grid, part)) {
          expect(x).toBeGreaterThanOrEqual(rect.left);
          expect(x).toBeLessThanOrEqual(rect.right);
          expect(y).toBeGreaterThanOrEqual(rect.top);
          expect(y).toBeLessThanOrEqual(rect.bottom);
        }
      }
    }
    expect(fitted.width).toBeLessThan(defaultPreviewFrame().width);

    sample.previewFrame = { width: 48, height: 32 };
    const text = serializeEntityFile(sample);
    expect(text).toContain('"previewFrame"');
    expect(parseEntityFile(text).previewFrame).toEqual({ width: 48, height: 32 });
    const withNote = text.replace('"width": 48', '"width": 48, "note": "screen"');
    expect(serializeEntityFile(parseEntityFile(withNote))).toBe(text);

    sample.previewFrame = { width: 0, height: 32 };
    expect(() => serializeEntityFile(sample)).toThrow(/previewFrame\.width/);
    sample.previewFrame = { width: 48, height: 1.5 };
    expect(() => serializeEntityFile(sample)).toThrow(/previewFrame\.height/);
  });

  it('keeps an old rectangle and round-trips a circle larger than the sprite', () => {
    const entity = sampleAssemblyEntity();
    const bodyGrid = entity.grids.body;
    const wing = entity.grids.wing;
    const body = entity.stages[0]?.parts[0];
    const right = entity.stages[0]?.parts.find((part) => part.id === 'wingR');
    if (!bodyGrid || !wing || !body || !right) throw new Error('fixture missing body');

    body.hit = { x: -4, y: -2, w: 30, h: 4 };
    const wide = serializeEntityFile(entity);
    expect(wide).not.toContain('"shape"');
    expect(parseEntityFile(wide).stages[0]?.parts[0]?.hit).toEqual({ x: -4, y: -2, w: 30, h: 4 });

    body.hit = { shape: 'circle', x: 4, y: 5, r: 20 };
    const circled = serializeEntityFile(entity);
    expect(circled).toContain('"r": 20');
    expect(parseEntityFile(circled).stages[0]?.parts[0]?.hit).toEqual({
      shape: 'circle',
      x: 4,
      y: 5,
      r: 20,
    });
    expect(placedHitLocal(bodyGrid, body)).toEqual({ shape: 'circle', x: 0, y: 0, r: 20 });
    expect(placedHit(wing, { ...right, hit: { shape: 'circle', x: 1, y: 2, r: 20 } })).toEqual({
      shape: 'circle',
      x: 3,
      y: 2,
      r: 20,
    });

    body.hit = { shape: 'circle', x: 0, y: 0, r: 0 };
    expect(() => serializeEntityFile(entity)).toThrow(/hit\.r/);
  });
});
