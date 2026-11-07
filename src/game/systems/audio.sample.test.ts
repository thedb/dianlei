import { readFileSync } from 'fs';
import { resolve } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudioSystem } from './audio';

interface FakeSource {
  buffer: AudioBuffer | null;
  onended: (() => void) | null;
  started: boolean;
  stopped: boolean;
  connect: () => void;
  start: () => void;
  stop: () => void;
}

function fakeContext(): AudioContext & { sources: FakeSource[]; oscStarts: number } {
  const sources: FakeSource[] = [];
  const ctx = {
    state: 'running' as AudioContextState,
    currentTime: 0,
    sampleRate: 44100,
    destination: {},
    sources,
    oscStarts: 0,
    resume: () => Promise.resolve(),
    createGain: () => ({
      gain: {
        value: 1,
        setValueAtTime: () => undefined,
        exponentialRampToValueAtTime: () => undefined,
      },
      connect: () => undefined,
    }),
    createOscillator: () => ({
      type: 'square',
      frequency: {
        setValueAtTime: () => undefined,
        exponentialRampToValueAtTime: () => undefined,
      },
      connect: () => undefined,
      start: () => {
        ctx.oscStarts += 1;
      },
      stop: () => undefined,
    }),
    createBuffer: () => ({
      getChannelData: () => new Float32Array(8),
    }),
    createBufferSource: () => {
      const source: FakeSource = {
        buffer: null,
        onended: null,
        started: false,
        stopped: false,
        connect: () => undefined,
        start: () => {
          source.started = true;
        },
        stop: () => {
          source.stopped = true;
          source.onended?.();
        },
      };
      sources.push(source);
      return source;
    },
    decodeAudioData: (bytes: ArrayBuffer, ok?: (buffer: AudioBuffer) => void) => {
      const buffer = { duration: bytes.byteLength / 44100 } as AudioBuffer;
      ok?.(buffer);
      return Promise.resolve(buffer);
    },
  };
  return ctx as unknown as AudioContext & { sources: FakeSource[]; oscStarts: number };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sample playback', () => {
  it('plays the ship sample, retriggers boss B2, and stays quiet while muted', async () => {
    vi.stubGlobal('fetch', (url: string) => {
      const bytes = readFileSync(resolve(String(url)));
      const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(copy),
      });
    });
    const ctx = fakeContext();
    const audio = createAudioSystem();
    audio.bindBackend(() => ctx);
    audio.init();
    await audio.samplesSettled();

    audio.play('shoot', { shipId: 'mandy' });
    audio.play('shoot', { shipId: 'jason' });
    expect(ctx.sources).toHaveLength(2);
    expect(ctx.sources[0]?.stopped).toBe(true);
    expect(ctx.sources[1]?.stopped).toBe(false);
    expect(ctx.sources[1]?.started).toBe(true);
    expect(ctx.oscStarts).toBe(0);

    const beforeBoss = ctx.sources.length;
    audio.play('bossExplode', { count: 4 });
    const boss = ctx.sources.slice(beforeBoss);
    expect(boss).toHaveLength(4);
    expect(boss.slice(0, 3).every((source) => source.stopped)).toBe(true);
    expect(boss[3]?.stopped).toBe(false);
    expect(ctx.oscStarts).toBe(0);

    audio.setMuted(true);
    expect(boss[3]?.stopped).toBe(true);
    const started = ctx.sources.length;
    audio.play('shoot', { shipId: 'eagle' });
    audio.play('enemyExplode', { tier: 'elite' });
    audio.play('bossExplode', { count: 3 });
    expect(ctx.sources).toHaveLength(started);
    expect(audio.isMuted()).toBe(true);

    audio.setMuted(false);
    audio.play('enemyExplode', { tier: 'elite' });
    expect(ctx.sources.length).toBe(started + 1);
  });

  it('falls back to the synth laser when the sample fails to load', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({
        ok: false,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      })
    );
    const ctx = fakeContext();
    const audio = createAudioSystem();
    audio.bindBackend(() => ctx);
    audio.init();
    await audio.samplesSettled();
    audio.play('shoot', { shipId: 'eagle' });
    expect(ctx.sources).toHaveLength(0);
    expect(ctx.oscStarts).toBe(1);
  });
});
