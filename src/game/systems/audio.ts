/**
 * Audio system. Short ogg one-shots in `assets/sfx/` play through WebAudio
 * `decodeAudioData` (H5 AudioContext / WeChat `wx.createWebAudioContext`).
 * A failed fetch or decode falls back to the synthesized one-shot.
 * BGM stays a synthesized loop. No other binary music.
 */

import { SFX_BOSS_GAIN, SFX_ELITE_GAIN, SFX_EXPLODE_GAIN, SFX_SHOOT_GAIN } from '@/game/config';
import type { ShipId } from '@/game/entities/shipDefs';
import { BGM_STEP_SEC, BGM_STEPS, bgmBusGain, bgmNote } from './bgm';
import {
  SFX_SAMPLE_IDS,
  SFX_SAMPLE_URL,
  explodeSampleForTier,
  sampleSlot,
  shootSample,
  voicesToStop,
  type ExplodeTier,
  type SampleSlot,
  type SfxSampleId,
} from './sfxMap';

export type SfxType =
  | 'shoot'
  | 'enemyHit'
  | 'enemyExplode'
  | 'bossExplode'
  | 'playerExplode'
  | 'bomb'
  | 'itemPickup'
  | 'powerUp'
  | 'extend'
  | 'warning';

export interface SfxPlayOptions {
  /** Main-gun ship. Omitted stays on Eagle's sample. Wingmen do not call this. */
  shipId?: ShipId;
  /** Kill tier. Omitted is the normal / turret pool. */
  tier?: ExplodeTier;
  /** Large boss-death blasts this frame. Each one restarts B2. */
  count?: number;
}

export interface AudioSystem {
  init(): void;
  unlock(): void;
  play(sfx: SfxType, options?: SfxPlayOptions): void;
  /** Resolves when every sample has loaded or failed. Failures keep the synth. */
  samplesSettled(): Promise<void>;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  /** Platform factory. Falls back to the global AudioContext when unset. */
  bindBackend(factory: () => AudioContext | null): void;
  setBgmEnabled(enabled: boolean): void;
  setBgmVolume(volume: number): void;
  /** Keep the chiptune scheduler filled. Safe to call every frame. */
  tick(): void;
}

/** Keeps two oscillators from clipping the music bus at volume 1. */
const BGM_LEVEL = 0.16;

interface WxRequestApi {
  request?: (opts: {
    url: string;
    responseType?: string;
    success?: (res: { data?: ArrayBuffer; statusCode?: number }) => void;
    fail?: (err: unknown) => void;
  }) => void;
}

interface LiveVoice {
  slot: SampleSlot;
  source: AudioBufferSourceNode;
  dropped: boolean;
}

const SAMPLE_GAIN: Readonly<Record<SampleSlot, number>> = {
  shoot: SFX_SHOOT_GAIN,
  explode: SFX_EXPLODE_GAIN,
  elite: SFX_ELITE_GAIN,
  boss: SFX_BOSS_GAIN,
};

/** Pool draws stay off `Math.random` so a replay spy never sees them. */
function createAudioUnit(): () => number {
  let seed = 0x51f0a11;
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadSampleBytes(url: string): Promise<ArrayBuffer> {
  const wxApi = (globalThis as { wx?: WxRequestApi }).wx;
  if (wxApi?.request) {
    return new Promise((resolve, reject) => {
      wxApi.request?.({
        url,
        responseType: 'arraybuffer',
        success: (res) => {
          if (res.data instanceof ArrayBuffer) resolve(res.data);
          else reject(new Error('sfx'));
        },
        fail: (err) => reject(err instanceof Error ? err : new Error('sfx')),
      });
    });
  }
  if (typeof fetch !== 'function') return Promise.reject(new Error('sfx'));
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(String(res.status));
    return res.arrayBuffer();
  });
}

function decodeSample(ctx: AudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const ok = (buffer: AudioBuffer): void => {
      if (settled) return;
      settled = true;
      resolve(buffer);
    };
    const bad = (): void => {
      if (settled) return;
      settled = true;
      reject(new Error('sfx-decode'));
    };
    try {
      const copy = bytes.slice(0);
      const pending = ctx.decodeAudioData(copy, ok, bad);
      if (typeof pending.then === 'function') void pending.then(ok, bad);
    } catch {
      bad();
    }
  });
}

/** Create WebAudio-based sound system */
export function createAudioSystem(): AudioSystem {
  let audioCtx: AudioContext | null = null;
  let backend: (() => AudioContext | null) | null = null;
  let muted = false;
  let initialized = false;
  let bgmEnabled = false;
  let bgmVolume = 0.6;
  let bgmGain: GainNode | null = null;
  let nextNoteTime = 0;
  let stepIndex = 0;
  const buffers = new Map<SfxSampleId, AudioBuffer>();
  const failed = new Set<SfxSampleId>();
  const loading = new Map<SfxSampleId, Promise<void>>();
  const live: LiveVoice[] = [];
  const audioUnit = createAudioUnit();

  function ensureContext(): AudioContext | null {
    if (!audioCtx) {
      if (backend) audioCtx = backend();
      else if (typeof AudioContext !== 'undefined') audioCtx = new AudioContext();
    }
    if (audioCtx) ensureLoads(audioCtx);
    return audioCtx;
  }

  function ensureLoads(ctx: AudioContext): void {
    for (const id of SFX_SAMPLE_IDS) {
      if (buffers.has(id) || failed.has(id) || loading.has(id)) continue;
      const task = loadSampleBytes(SFX_SAMPLE_URL[id])
        .then((bytes) => decodeSample(ctx, bytes))
        .then((buffer) => {
          buffers.set(id, buffer);
        })
        .catch(() => {
          failed.add(id);
        })
        .finally(() => {
          loading.delete(id);
        });
      loading.set(id, task);
    }
  }

  function dropVoice(voice: LiveVoice): void {
    if (voice.dropped) return;
    voice.dropped = true;
    try {
      voice.source.stop();
    } catch {
      // Already stopped.
    }
    const index = live.indexOf(voice);
    if (index >= 0) live.splice(index, 1);
  }

  function stopSlot(slot: SampleSlot, count: number): void {
    if (count <= 0) return;
    const victims: LiveVoice[] = [];
    for (const voice of live) {
      if (victims.length >= count) break;
      if (voice.slot === slot && !voice.dropped) victims.push(voice);
    }
    for (const voice of victims) dropVoice(voice);
  }

  function stopSamples(): void {
    for (const voice of [...live]) dropVoice(voice);
  }

  function playSample(id: SfxSampleId): boolean {
    const ctx = audioCtx;
    const buffer = buffers.get(id);
    if (!ctx || !buffer || muted) return false;
    const slot = sampleSlot(id);
    const playing = live.filter((voice) => voice.slot === slot && !voice.dropped).length;
    stopSlot(slot, voicesToStop(slot, playing));
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = SAMPLE_GAIN[slot];
    source.connect(gain);
    gain.connect(ctx.destination);
    const voice: LiveVoice = { slot, source, dropped: false };
    source.onended = () => {
      const index = live.indexOf(voice);
      if (index >= 0) live.splice(index, 1);
    };
    try {
      source.start();
    } catch {
      return false;
    }
    live.push(voice);
    return true;
  }

  function musicGain(): number {
    return bgmBusGain(muted, bgmEnabled, bgmVolume) * BGM_LEVEL;
  }

  function ensureBgmGain(ctx: AudioContext): GainNode {
    if (!bgmGain) {
      bgmGain = ctx.createGain();
      bgmGain.connect(ctx.destination);
    }
    bgmGain.gain.value = musicGain();
    return bgmGain;
  }

  function scheduleTone(
    ctx: AudioContext,
    bus: GainNode,
    when: number,
    frequency: number,
    type: OscillatorType,
    duration: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(1, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }

  function playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = 'square',
    volume: number = 0.15
  ): void {
    const ctx = ensureContext();
    if (!ctx || muted) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  function playNoise(duration: number, volume: number = 0.1): void {
    const ctx = ensureContext();
    if (!ctx || muted) return;

    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    source.connect(gain);
    gain.connect(ctx.destination);

    source.start(ctx.currentTime);
  }

  function playFrequencyRamp(
    startFreq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = 'square',
    volume: number = 0.15
  ): void {
    const ctx = ensureContext();
    if (!ctx || muted) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  return {
    init(): void {
      initialized = true;
      ensureContext();
    },

    unlock(): void {
      const ctx = ensureContext();
      if (ctx && ctx.state === 'suspended') {
        void ctx.resume();
      }
    },

    samplesSettled(): Promise<void> {
      ensureContext();
      return Promise.all([...loading.values()]).then(() => undefined);
    },

    play(sfx: SfxType, options?: SfxPlayOptions): void {
      if (!initialized || muted) return;
      ensureContext();

      switch (sfx) {
        case 'shoot':
          if (!playSample(shootSample(options?.shipId))) {
            playFrequencyRamp(800, 400, 0.05, 'square', 0.08);
          }
          break;

        case 'enemyHit':
          // Short impact
          playTone(200, 0.05, 'square', 0.1);
          break;

        case 'enemyExplode':
          if (!playSample(explodeSampleForTier(options?.tier ?? 'normal', audioUnit))) {
            playNoise(0.15, 0.12);
            playFrequencyRamp(200, 50, 0.15, 'sawtooth', 0.1);
          }
          break;

        case 'bossExplode': {
          const hits = Math.max(0, Math.floor(options?.count ?? 1));
          if (hits <= 0) break;
          if (buffers.has('explode_boss_b2')) {
            for (let i = 0; i < hits; i++) playSample('explode_boss_b2');
          } else {
            playNoise(0.15, 0.12);
            playFrequencyRamp(200, 50, 0.15, 'sawtooth', 0.1);
          }
          break;
        }

        case 'playerExplode':
          // Bigger explosion
          playNoise(0.3, 0.2);
          playFrequencyRamp(300, 30, 0.3, 'sawtooth', 0.15);
          break;

        case 'bomb':
          // Screen-clearing boom
          playNoise(0.5, 0.25);
          playFrequencyRamp(150, 20, 0.5, 'sawtooth', 0.2);
          break;

        case 'itemPickup':
          // Positive ding
          playTone(880, 0.08, 'square', 0.1);
          setTimeout(() => playTone(1100, 0.08, 'square', 0.1), 50);
          break;

        case 'powerUp':
          // Ascending arpeggio
          playTone(440, 0.1, 'square', 0.1);
          setTimeout(() => playTone(550, 0.1, 'square', 0.1), 60);
          setTimeout(() => playTone(660, 0.1, 'square', 0.1), 120);
          setTimeout(() => playTone(880, 0.15, 'square', 0.12), 180);
          break;

        case 'extend':
          // Extra life fanfare
          playTone(440, 0.12, 'square', 0.12);
          setTimeout(() => playTone(550, 0.12, 'square', 0.12), 100);
          setTimeout(() => playTone(660, 0.12, 'square', 0.12), 200);
          setTimeout(() => playTone(880, 0.2, 'square', 0.15), 300);
          setTimeout(() => playTone(1100, 0.25, 'square', 0.12), 450);
          break;

        case 'warning':
          playTone(660, 0.12, 'square', 0.12);
          setTimeout(() => playTone(440, 0.16, 'square', 0.12), 140);
          setTimeout(() => playTone(660, 0.12, 'square', 0.12), 320);
          setTimeout(() => playTone(440, 0.2, 'square', 0.12), 460);
          break;
      }
    },

    setMuted(m: boolean): void {
      muted = m;
      if (bgmGain) bgmGain.gain.value = musicGain();
      if (muted) {
        nextNoteTime = 0;
        stopSamples();
      }
    },

    isMuted(): boolean {
      return muted;
    },

    bindBackend(factory: () => AudioContext | null): void {
      backend = factory;
    },

    setBgmEnabled(enabled: boolean): void {
      bgmEnabled = enabled;
      if (bgmGain) bgmGain.gain.value = musicGain();
      if (!enabled) nextNoteTime = 0;
    },

    setBgmVolume(volume: number): void {
      bgmVolume = volume;
      if (bgmGain) bgmGain.gain.value = musicGain();
    },

    tick(): void {
      const ctx = ensureContext();
      if (!ctx) return;
      const level = musicGain();
      if (bgmGain) bgmGain.gain.value = level;
      if (level <= 0 || ctx.state === 'suspended') {
        if (level <= 0) nextNoteTime = 0;
        return;
      }
      const bus = ensureBgmGain(ctx);
      if (nextNoteTime < ctx.currentTime) nextNoteTime = ctx.currentTime + 0.05;
      const horizon = ctx.currentTime + 0.28;
      while (nextNoteTime < horizon) {
        const note = bgmNote(stepIndex);
        scheduleTone(ctx, bus, nextNoteTime, note.bass, 'triangle', BGM_STEP_SEC * 0.92);
        scheduleTone(ctx, bus, nextNoteTime, note.lead, 'square', BGM_STEP_SEC * 0.72);
        stepIndex = (stepIndex + 1) % BGM_STEPS;
        nextNoteTime += BGM_STEP_SEC;
      }
    },
  };
}

/** Global audio instance */
let globalAudio: AudioSystem | null = null;

/** Get or create global audio system */
export function getAudioSystem(): AudioSystem {
  if (!globalAudio) {
    globalAudio = createAudioSystem();
  }
  return globalAudio;
}
