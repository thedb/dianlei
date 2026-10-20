/**
 * Original looping 8-bit march. Frequencies only — no samples in the repo.
 * One step is a lead square plus a triangle bass, scheduled by the audio system.
 */

export const BGM_STEP_SEC = 0.21;

const LEAD: readonly number[] = [
  392, 523.25, 659.25, 523.25, 440, 523.25, 659.25, 783.99, 698.46, 659.25, 587.33, 523.25, 587.33,
  659.25, 587.33, 523.25,
];

const BASS: readonly number[] = [
  130.81, 130.81, 98, 98, 110, 110, 82.41, 82.41, 87.31, 87.31, 130.81, 130.81, 98, 98, 130.81,
  146.83,
];

export const BGM_STEPS = LEAD.length;

export function bgmNote(step: number): { lead: number; bass: number } {
  const i = ((step % BGM_STEPS) + BGM_STEPS) % BGM_STEPS;
  return { lead: LEAD[i] ?? 440, bass: BASS[i] ?? 110 };
}

/** Linear music-bus level in 0–1. Mute or the BGM switch forces silence. */
export function bgmBusGain(muted: boolean, enabled: boolean, volume: number): number {
  if (muted || !enabled || !(volume > 0)) return 0;
  return Math.min(1, volume);
}
