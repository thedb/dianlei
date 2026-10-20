/**
 * Audio system - 8-bit style WebAudio synthesized SFX and one looping BGM.
 * The context comes from the platform adapter (H5 AudioContext / WeChat WebAudio).
 */

import { BGM_STEP_SEC, BGM_STEPS, bgmBusGain, bgmNote } from './bgm';

export type SfxType =
  | 'shoot'
  | 'enemyHit'
  | 'enemyExplode'
  | 'playerExplode'
  | 'bomb'
  | 'itemPickup'
  | 'powerUp'
  | 'extend'
  | 'warning';

export interface AudioSystem {
  init(): void;
  unlock(): void;
  play(sfx: SfxType): void;
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

  function ensureContext(): AudioContext | null {
    if (!audioCtx) {
      if (backend) audioCtx = backend();
      else if (typeof AudioContext !== 'undefined') audioCtx = new AudioContext();
    }
    return audioCtx;
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
    },

    unlock(): void {
      const ctx = ensureContext();
      if (ctx && ctx.state === 'suspended') {
        void ctx.resume();
      }
    },

    play(sfx: SfxType): void {
      if (!initialized || muted) return;

      switch (sfx) {
        case 'shoot':
          // Quick laser sound
          playFrequencyRamp(800, 400, 0.05, 'square', 0.08);
          break;

        case 'enemyHit':
          // Short impact
          playTone(200, 0.05, 'square', 0.1);
          break;

        case 'enemyExplode':
          // Explosion with noise
          playNoise(0.15, 0.12);
          playFrequencyRamp(200, 50, 0.15, 'sawtooth', 0.1);
          break;

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
      if (muted) nextNoteTime = 0;
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
