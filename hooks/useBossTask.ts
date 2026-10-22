import { useMemo, useState } from 'react';
import { DropSource } from '../types';
import { useGame } from '../context/GameContext';
import { usesActivityKeyReserves } from '../config/gameModes';
import { vanillaBossKeyStage, type KeyRollContext } from '../config/vanillaKeyEconomy';
import { bossTier } from '../data/bossKeyTiers';
import { achievementBoostFor } from '../utils/achievementBoosts';
import { bossTaskChoices } from '../utils/farmGates';

export interface BossTaskModel {
  /** Why the card can't roll (Slayer locked, no Like a Boss, no master, no boss), or null. */
  block: string | null;
  /** The bosses the task can have been, with each one's next-Key chance. */
  bosses: { name: string; rate: number }[];
  pick: string;
  setPick: (name: string) => void;
  /** The picked boss's next-Key chance, or null before a pick. */
  rate: number | null;
  roll: (e: { clientX: number; clientY: number }) => void;
}

type HandleRoll = (source: string, chance: number, e: { clientX: number; clientY: number }, context?: KeyRollContext) => void;

/**
 * The Boss Task card in Vanilla and Chunked (utils/farmGates.ts): the player
 * says which boss the task was, and the roll draws from that boss's Key stash
 * at its next-Key odds, as a kill does. Null in modes without Key stashes,
 * where the card keeps its old flat rate.
 */
export const useBossTask = (handleRoll: HandleRoll): BossTaskModel | null => {
  const { unlocks, gameModeId, bossStandardKeysAwarded, achievementsClaimed } = useGame();
  const [picked, setPick] = useState('');
  const reserves = usesActivityKeyReserves(gameModeId);
  const gate = useMemo(
    () => (reserves ? bossTaskChoices(unlocks, gameModeId, bossStandardKeysAwarded) : null),
    [reserves, unlocks, gameModeId, bossStandardKeysAwarded],
  );
  if (!gate) return null;
  // Shown with the Slayer boost the roll adds; the roll passes the stash's base rate.
  const boost = achievementBoostFor(DropSource.SLAYER_BOSS, achievementsClaimed);
  const stageOf = (name: string) => vanillaBossKeyStage(name, bossStandardKeysAwarded?.[name] ?? 0);
  const rateOf = (name: string) => Math.min(100, (stageOf(name).currentRate ?? 0) + boost);
  const pick = gate.bosses.includes(picked) ? picked : '';
  return {
    block: gate.block,
    bosses: gate.bosses.map(name => ({ name, rate: rateOf(name) })),
    pick,
    setPick,
    rate: pick ? rateOf(pick) : null,
    roll: (e) => {
      if (!pick) return;
      handleRoll(DropSource.SLAYER_BOSS, stageOf(pick).currentRate ?? 0, e, { kind: 'boss', bossName: pick, bossClass: bossTier(pick) });
      // Each boss task is its own: the next one asks again.
      setPick('');
    },
  };
};
