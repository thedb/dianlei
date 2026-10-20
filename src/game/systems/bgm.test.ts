import { describe, expect, it } from 'vitest';
import { BGM_STEPS, bgmBusGain, bgmNote } from './bgm';
import { createAudioSystem } from './audio';

describe('bgm', () => {
  it('loops a 16-step lead and bass', () => {
    expect(BGM_STEPS).toBe(16);
    const first = bgmNote(0);
    expect(bgmNote(16)).toEqual(first);
    expect(bgmNote(-1).lead).toBeGreaterThan(50);
    for (let i = 0; i < BGM_STEPS; i++) {
      const note = bgmNote(i);
      expect(note.lead).toBeGreaterThan(note.bass);
    }
  });

  it('is silent unless enabled, unmuted, and above zero volume', () => {
    expect(bgmBusGain(false, false, 0.6)).toBe(0);
    expect(bgmBusGain(true, true, 0.6)).toBe(0);
    expect(bgmBusGain(false, true, 0)).toBe(0);
    expect(bgmBusGain(false, true, 0.6)).toBeCloseTo(0.6);
    expect(bgmBusGain(false, true, 2)).toBe(1);
  });

  it('ticks without an audio device', () => {
    const audio = createAudioSystem();
    audio.bindBackend(() => null);
    audio.setBgmEnabled(true);
    audio.setBgmVolume(0.5);
    expect(() => audio.tick()).not.toThrow();
    audio.setMuted(true);
    expect(() => audio.tick()).not.toThrow();
  });
});
