/**
 * Audio system - 8-bit style WebAudio synthesized SFX
 * Design doc §19: Program-generated 8-bit sounds
 */

export type SfxType =
  | 'shoot'
  | 'enemyHit'
  | 'enemyExplode'
  | 'playerExplode'
  | 'bomb'
  | 'itemPickup'
  | 'powerUp'
  | 'extend';

export interface AudioSystem {
  init(): void;
  unlock(): void;
  play(sfx: SfxType): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
}

/** Create WebAudio-based sound system */
export function createAudioSystem(): AudioSystem {
  let audioCtx: AudioContext | null = null;
  let muted = false;
  let initialized = false;

  function ensureContext(): AudioContext | null {
    if (!audioCtx && typeof AudioContext !== 'undefined') {
      audioCtx = new AudioContext();
    }
    return audioCtx;
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
      }
    },

    setMuted(m: boolean): void {
      muted = m;
    },

    isMuted(): boolean {
      return muted;
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
