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
  bankParts,
  cloneStage,
  defaultBank,
  partScaleX,
  copyPartToStage,
  hitRole,
  placedAnchor,
  placedHit,
  placedHitLocal,
  stageBounds,
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
    expect(open?.parts[1]?.hit).toEqual({ x: 0, y: 0, w: 4, h: 8, role: 'block' });
    expect(open?.parts[2]?.hit).toEqual({ x: 0, y: 0, w: 4, h: 8 });
    expect(folded?.parts[0]?.anchors).toEqual([
      { id: 'jet', kind: 'exhaust', x: 0, y: 5 },
      { id: 'gun', kind: 'muzzle', x: 0, y: -5 },
    ]);
    expect(folded?.parts[1]?.anchors).toBeUndefined();
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

  it('keeps a block role, drops an explicit damage role, and rejects others', () => {
    const entity = sampleAssemblyEntity();
    const wing = entity.grids.wing;
    const body = entity.stages[0]?.parts[0];
    const right = entity.stages[0]?.parts.find((part) => part.id === 'wingR');
    if (!wing || !body || !right) throw new Error('fixture missing parts');

    body.hit = { shape: 'circle', x: 4, y: 5, r: 30, role: 'block' };
    const text = serializeEntityFile(entity);
    expect(text).toContain('"role": "block"');
    const back = parseEntityFile(text).stages[0]?.parts[0]?.hit;
    expect(back).toEqual({ shape: 'circle', x: 4, y: 5, r: 30, role: 'block' });
    if (!back) throw new Error('hit lost');
    expect(hitRole(back)).toBe('block');
    expect(placedHit(wing, { ...right, hit: { x: 0, y: 0, w: 1, h: 2, role: 'block' } })).toEqual({
      x: 3,
      y: 0,
      w: 1,
      h: 2,
      role: 'block',
    });

    const explicit = text.split('"role": "block"').join('"role": "damage"');
    const damage = parseEntityFile(explicit).stages[0]?.parts[0]?.hit;
    expect(damage).toEqual({ shape: 'circle', x: 4, y: 5, r: 30 });
    if (!damage) throw new Error('hit lost');
    expect(hitRole(damage)).toBe('damage');
    expect(serializeEntityFile(parseEntityFile(explicit))).not.toContain('"role"');

    const bad = text.split('"role": "block"').join('"role": "armor"');
    expect(() => parseEntityFile(bad)).toThrow(/hit\.role/);
  });

  it('places anchors through flip, scale, and rotation, and checks their ids', () => {
    const entity = sampleAssemblyEntity();
    const body = entity.stages[0]?.parts[0];
    const jet = body?.anchors?.[0];
    if (!body || !jet) throw new Error('fixture missing jet');

    expect(placedAnchor(body, jet)).toEqual({ x: 0, y: 5 });
    const side = { id: 'side', kind: 'muzzle' as const, x: 3, y: -2 };
    expect(placedAnchor({ ...body, flipX: true }, side)).toEqual({ x: -3, y: -2 });
    expect(placedAnchor({ ...body, x: 10, y: 20, scale: 2 }, side)).toEqual({ x: 16, y: 16 });
    const turned = placedAnchor({ ...body, angle: Math.PI / 2 }, side);
    expect(turned.x).toBeCloseTo(2, 6);
    expect(turned.y).toBeCloseTo(3, 6);

    body.anchors = [jet, { ...jet }];
    expect(() => serializeEntityFile(entity)).toThrow(/duplicate anchor id/);
    body.anchors = [{ ...jet, kind: 'flame' as 'exhaust' }];
    expect(() => serializeEntityFile(entity)).toThrow(/anchor\.kind/);
    body.anchors = [];
    expect(serializeEntityFile(entity)).not.toContain('"anchors": []');
  });

  it('clones a stage and copies one part across stages by id', () => {
    const entity = sampleAssemblyEntity();
    const folded = entity.stages[0];
    const open = entity.stages[2];
    if (!folded || !open) throw new Error('fixture missing stages');

    const copy = cloneStage(open, 'open-2');
    expect(copy.parts.map((part) => part.id)).toEqual(['body', 'wingL', 'wingR']);
    const copyLeft = copy.parts[1];
    if (!copyLeft) throw new Error('copy missing wingL');
    copyLeft.angle = 0;
    expect(open.parts[1]?.angle).toBe(-Math.PI / 2);
    expect(() => cloneStage(open, 'bad id')).toThrow(/invalid/);

    const openLeft = open.parts[1];
    if (!openLeft) throw new Error('fixture missing wingL');
    expect(copyPartToStage(folded, openLeft)).toBe('replaced');
    expect(folded.parts[1]?.angle).toBe(-Math.PI / 2);
    expect(folded.parts[1]?.hit).toEqual({ x: 0, y: 0, w: 4, h: 8, role: 'block' });
    expect(copyPartToStage(folded, { ...openLeft, id: 'blade' })).toBe('added');
    expect(folded.parts.map((part) => part.id)).toEqual(['body', 'wingL', 'wingR', 'blade']);
    entity.stages.push(copy);
    expect(() => serializeEntityFile(entity)).not.toThrow();

    const bodyOnly = { id: 'solo', parts: folded.parts.slice(0, 1) };
    expect(stageBounds(entity, bodyOnly)).toEqual({ left: -4, top: -5, right: 4, bottom: 5 });
    expect(stageBounds(entity, { id: 'none', parts: [] })).toBeNull();
  });

  it('stretches a part per axis and round-trips the stretch', () => {
    const entity = sampleAssemblyEntity();
    const body = entity.stages[0]?.parts[0];
    const grid = entity.grids.body;
    if (!body || !grid) throw new Error('fixture missing body');
    body.stretchX = 0.5;
    body.stretchY = 2;
    expect(partScaleX(body)).toBe(0.5);
    expect(placementCorners(grid, body)[2]).toEqual([2, 10]);
    expect(placedAnchor(body, { id: 'a', kind: 'exhaust', x: 4, y: 3 })).toEqual({ x: 2, y: 6 });
    const back = parseEntityFile(serializeEntityFile(entity)).stages[0]?.parts[0];
    expect(back?.stretchX).toBe(0.5);
    expect(back?.stretchY).toBe(2);
    body.stretchX = 1;
    expect(serializeEntityFile(entity)).not.toContain('"stretchX"');
    body.stretchX = 5;
    expect(() => serializeEntityFile(entity)).toThrow(/stretchX/);
  });

  it('rebuilds a bank pose from its source stage', () => {
    const entity = sampleAssemblyEntity();
    const source = entity.stages[0];
    if (!source) throw new Error('fixture missing folded');
    const xs = source.parts.map((part) => part.x);

    const narrow = bankParts(entity, source, { ...defaultBank(source.id, 0), stretchX: 0.5 });
    expect(narrow.map((part) => part.x)).toEqual(xs.map((x) => Math.round(x * 0.5)));
    expect(narrow.every((part) => part.stretchX === 0.5 && part.stretchY === undefined)).toBe(true);

    const turned = bankParts(entity, source, { ...defaultBank(source.id, 0), angle: Math.PI / 2 });
    source.parts.forEach((part, index) => {
      expect(turned[index]?.x).toBe(Math.round(-part.y) || 0);
      expect(turned[index]?.y).toBe(Math.round(part.x));
      expect(turned[index]?.angle).toBeCloseTo(part.angle + Math.PI / 2);
    });

    const tapered = bankParts(entity, source, { ...defaultBank(source.id, 0), taper: 0.4 });
    const right = source.parts.findIndex((part) => part.x > 0);
    const left = source.parts.findIndex((part) => part.x < 0);
    expect(tapered[right]?.stretchX ?? 1).toBeLessThan(1);
    expect(tapered[left]?.stretchX ?? 1).toBeGreaterThan(1);
    expect(source.parts.map((part) => part.x)).toEqual(xs);

    expect(defaultBank('t0', 5)).toEqual({
      from: 't0',
      angle: 0,
      stretchX: 0.7,
      stretchY: 1,
      taper: 0.2,
    });
  });

  it('checks bank.from on load', () => {
    const entity = sampleAssemblyEntity();
    const half = entity.stages[1];
    if (!half) throw new Error('fixture missing half');
    half.bank = defaultBank('folded', 2);
    const back = parseEntityFile(serializeEntityFile(entity));
    expect(back.stages[1]?.bank).toEqual(defaultBank('folded', 2));
    half.bank = defaultBank('half', 2);
    expect(() => serializeEntityFile(entity)).toThrow(/bank.from/);
    half.bank = defaultBank('missing', 2);
    expect(() => serializeEntityFile(entity)).toThrow(/bank.from/);
    half.bank = defaultBank('folded', 2);
    const open = entity.stages[2];
    if (!open) throw new Error('fixture missing open');
    open.bank = defaultBank('half', 1);
    expect(() => serializeEntityFile(entity)).toThrow(/bank.from/);
    open.bank = { ...defaultBank('folded', 1), taper: 0.9 };
    expect(() => serializeEntityFile(entity)).toThrow(/taper/);
  });
});
