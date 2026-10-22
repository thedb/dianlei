import { describe, expect, it, vi } from 'vitest';
import { makeInput } from '@/test/fakes';
import { createMemoryStorage, createSettingsStore, SETTINGS_STORAGE_KEY } from '@/game/settings';
import { computeControlLayout } from '@/game/controls';
import { DEBUG_HOT_SIZE, DEBUG_HOT_TAPS, LOGICAL_W } from '@/game/config';
import { HIGH_SCORE_KEY } from '@/game/highScore';
import { getStage } from '@/game/levels/registry';
import { buildPreviewTrack, type MapPreviewTarget } from '@/game/maps';
import { PLAY_MODE_RULES } from '@/game/battle/playMode';
import { DEBUG_MAP_BUTTON } from '@/game/ui/debugPanel';
import { MAP_PREVIEW_ROWS, mapPreviewButton } from '@/game/ui/mapPreviewSelect';
import type { ControlsView } from '@/engine/input';
import type { SceneContext } from './types';
import { createBattleScene } from './battle';
import { createTitleScene } from './title';
import type { TitleAttract } from './titleAttract';

vi.mock('@/game/art', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/game/art')>();
  return { ...actual, createGameAssets: () => ({}) };
});

vi.mock('@/game/systems/audio', () => {
  const sfx = {
    init: () => undefined,
    unlock: () => undefined,
    play: () => undefined,
    setMuted: () => undefined,
    isMuted: () => false,
  };
  return { getAudioSystem: () => sfx, createAudioSystem: () => sfx };
});

const DT = 1 / 60;

function context(previewMap?: MapPreviewTarget, playMode = true): SceneContext {
  const settings = createSettingsStore(createMemoryStorage());
  const layout = computeControlLayout(settings.get(), { top: 0, bottom: 0 });
  const view: ControlsView = {
    layout,
    settings: settings.get(),
    joystick: { active: false, baseX: 0, baseY: 0, knobX: 0, knobY: 0, alpha: 1 },
    buttonAPressed: false,
    buttonBPressed: false,
  };
  return {
    showDebug: false,
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
    settings,
    storage: createMemoryStorage(),
    run: { report: null },
    battleEntry: 'stage',
    ...(playMode ? { playMode: 'mapPreview' as const } : {}),
    ...(previewMap ? { previewMap } : {}),
    input: { setControlsEnabled: vi.fn(), getControlsView: () => view },
  };
}

function point(rect: { x: number; y: number; w: number; h: number }) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

describe('map preview play mode', () => {
  it('scrolls but never spawns, and leaves at the end of the track', () => {
    expect(PLAY_MODE_RULES.mapPreview).toMatchObject({
      scroll: true,
      spawns: false,
      track: 'preview',
      leaveAtTrackEnd: true,
      publishesRun: false,
      pauseExit: 'immediate',
      hud: 'preview',
    });
  });

  it('flies the whole 第一关全程 run with no enemies, buildings, or boss, then returns to the title', () => {
    const ctx = context('stage:1');
    const scene = createBattleScene(ctx);
    scene.enter();
    const end = buildPreviewTrack('stage:1').endAt!;
    expect(end).toBe(getStage('1').warningAt);
    let next: string | null = null;
    let frames = 0;
    while (!next && frames < (end + 5) / DT) {
      next = scene.update(DT, makeInput({ buttonA: true }));
      const info = scene.getDebugInfo!();
      expect(info.enemyCount).toBe(0);
      expect(info.buildingCount).toBe(0);
      expect(info.enemyBulletCount).toBe(0);
      expect(info.waveSpawned).toBe(0);
      frames++;
    }
    expect(next).toBe('title');
    expect(scene.getDebugInfo!().gameTime).toBeGreaterThanOrEqual(end);
    expect(scene.getDebugInfo!().gameTime).toBeLessThan(end + 0.1);
    expect(ctx.run.report).toBeNull();
    expect(ctx.storage.getStorage(HIGH_SCORE_KEY)).toBeNull();
  });

  it('ends a single-map preview when the map runs out, and the starfield after its seconds', () => {
    for (const target of ['map:landB', 'map:spaceA'] as const) {
      const scene = createBattleScene(context(target));
      scene.enter();
      const end = buildPreviewTrack(target).endAt!;
      let next: string | null = null;
      while (!next) next = scene.update(DT, makeInput());
      expect(next, target).toBe('title');
      expect(scene.getDebugInfo!().gameTime).toBeCloseTo(end, 1);
    }
  });

  it('leaves at once from the pause menu', () => {
    const scene = createBattleScene(context('map:landA'));
    scene.enter();
    for (let i = 0; i < 30; i++) scene.update(DT, makeInput());
    scene.update(DT, makeInput({ pausePressed: true }));
    expect(scene.getDebugInfo!().paused).toBe(true);
    scene.update(DT, makeInput({ menuUp: true }));
    expect(scene.update(DT, makeInput({ menuConfirm: true }))).toBe('title');
  });
});

function stubAttract(): TitleAttract & { updates: () => number } {
  let running = false;
  let updates = 0;
  return {
    start: () => {
      running = true;
    },
    stop: () => {
      running = false;
    },
    isRunning: () => running,
    updates: () => updates,
    update: () => {
      updates += 1;
    },
    render: () => undefined,
    stats: () => ({
      time: 0,
      spawned: 0,
      bullets: 0,
      enemies: 0,
      enemyBullets: 0,
      playerDead: false,
      explosions: 0,
      lives: 3,
      bombs: 2,
      fade: 0,
      sceneId: 'battle',
    }),
    plan: () => ({ routeId: 0, seed: 1 }),
    pilotView: () => ({ player: { x: 0, y: 0 }, enemies: [], bullets: [] }),
  };
}

describe('地图预览 entry on the title', () => {
  const hot = { x: LOGICAL_W - DEBUG_HOT_SIZE / 2, y: DEBUG_HOT_SIZE / 2 };

  function openList(ctx: SceneContext, attract = stubAttract()) {
    const title = createTitleScene(ctx, attract);
    title.enter();
    for (let i = 0; i < DEBUG_HOT_TAPS; i++) title.update(DT, makeInput({ taps: [hot] }));
    expect(title.update(DT, makeInput({ taps: [point(DEBUG_MAP_BUTTON)] }))).toBeNull();
    return title;
  }

  it('lists 陆地A, 陆地B, 海面A, 宇宙A, 第一关全程, then 返回', () => {
    expect(MAP_PREVIEW_ROWS.map((r) => r.title)).toEqual([
      '陆地A',
      '陆地B',
      '海面A',
      '宇宙A',
      '第一关全程',
      '返回',
    ]);
  });

  it('pauses the attract demo while open and starts the chosen map', () => {
    const ctx = context(undefined, false);
    const attract = stubAttract();
    const title = openList(ctx, attract);
    const frozen = attract.updates();
    expect(title.update(DT, makeInput())).toBeNull();
    expect(attract.updates()).toBe(frozen);
    expect(title.update(DT, makeInput({ taps: [point(mapPreviewButton('map:seaA'))] }))).toBe(
      'battle'
    );
    expect(ctx.playMode).toBe('mapPreview');
    expect(ctx.previewMap).toBe('map:seaA');
    expect(ctx.battleEntry).toBe('stage');
    expect(ctx.storage.getStorage(SETTINGS_STORAGE_KEY)).toBeNull();
  });

  it('steps back to the debug panel, and Esc does the same', () => {
    const ctx = context(undefined, false);
    const title = openList(ctx);
    expect(title.update(DT, makeInput({ taps: [point(mapPreviewButton('back'))] }))).toBeNull();
    expect(title.update(DT, makeInput({ taps: [point(DEBUG_MAP_BUTTON)] }))).toBeNull();
    expect(title.update(DT, makeInput({ menuBack: true }))).toBeNull();
    expect(title.update(DT, makeInput({ taps: [point(DEBUG_MAP_BUTTON)] }))).toBeNull();
    expect(title.update(DT, makeInput({ taps: [point(mapPreviewButton('stage:1'))] }))).toBe(
      'battle'
    );
    expect(ctx.previewMap).toBe('stage:1');
    expect(ctx.playMode).toBe('mapPreview');
  });
});
