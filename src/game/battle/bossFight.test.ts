import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBankFrameIndex } from '@/game/art';
import { VICTORY_EXIT_WAIT } from '@/game/config';
import { getStage } from '@/game/levels/registry';
import { battleContext, seeded } from '@/test/battleHarness';
import { createBattle, type Battle } from './context';
import { armBoss, spawnBoss, stepBoss } from './bossFight';

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

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Boss already in `clear`, ship still in a non-neutral bank frame.
 * Stage clear and 挑战 Boss both enter the flight through `stepBoss`.
 */
function bankedClear(stageId: '1' | '2', frame: number, bank: number): Battle {
  const b = createBattle(battleContext('stage', 'easy', seeded(3)));
  b.stage = getStage(stageId);
  b.bossCfg = b.stage.boss;
  armBoss(b);
  b.boss = spawnBoss(b);
  b.boss.stage = 'clear';
  b.boss.phase = 'clear';
  b.state.isDead = false;
  b.state.isFlying = false;
  b.player.x = 48;
  b.player.y = 420;
  b.player.prevX = 48;
  b.player.prevY = 420;
  b.player.bank = bank;
  b.player.targetBank = bank;
  b.player.lastBankFrame = frame;
  b.player.velocityY = 0.75;
  return b;
}

describe('victory exit pose', () => {
  it.each([
    ['1', 0, -1],
    ['1', 10, 1],
    ['2', 8, 0.6],
  ] as const)(
    'stage %s snaps bank frame %i upright before the return and keeps it while moving',
    (stageId, frame, bank) => {
      const b = bankedClear(stageId, frame, bank);
      const neutral = getBankFrameIndex(0);
      expect(frame).not.toBe(neutral);

      expect(stepBoss(b, DT)).toBeNull();
      expect(b.victory.phase).toBe('wait');
      expect(b.player.x).toBe(48);
      expect(b.player.y).toBe(420);
      expect(b.player.bank).toBe(0);
      expect(b.player.targetBank).toBe(0);
      expect(b.player.lastBankFrame).toBe(neutral);
      expect(b.player.velocityY).toBe(0);

      stepBoss(b, VICTORY_EXIT_WAIT);
      expect(b.victory.phase).toBe('return');
      const yInReturn = b.player.y;
      expect(yInReturn).not.toBe(420);
      expect(b.player.lastBankFrame).toBe(neutral);

      b.player.bank = bank;
      b.player.targetBank = bank;
      b.player.lastBankFrame = frame;
      stepBoss(b, DT);
      expect(b.victory.phase).toBe('return');
      expect(b.player.y).not.toBe(yInReturn);
      expect(b.player.bank).toBe(0);
      expect(b.player.targetBank).toBe(0);
      expect(b.player.lastBankFrame).toBe(neutral);
      expect(b.player.velocityY).toBe(0);
    }
  );
});
