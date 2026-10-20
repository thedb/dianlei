/**
 * Audio system stub for P0
 * Will be implemented properly in later milestones
 */

import type { PlatformAdapter } from '@/platform/types';

export interface AudioSystem {
  playSound(id: string): void;
  playMusic(id: string): void;
  stopMusic(): void;
  setMusicVolume(volume: number): void;
  setSoundVolume(volume: number): void;
}

export function createAudioSystem(_platform: PlatformAdapter): AudioSystem {
  return {
    playSound(_id: string): void {
      // Stub - not implemented in P0
    },

    playMusic(_id: string): void {
      // Stub - not implemented in P0
    },

    stopMusic(): void {
      // Stub - not implemented in P0
    },

    setMusicVolume(_volume: number): void {
      // Stub - not implemented in P0
    },

    setSoundVolume(_volume: number): void {
      // Stub - not implemented in P0
    },
  };
}
