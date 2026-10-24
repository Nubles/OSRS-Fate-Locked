import { useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { DROP_RATES } from '../config/rules';
import { keyChance } from '../utils/keyChance';

/**
 * The Key chance a quest, diary, Combat Achievement or Collection Log roll is
 * made against, the run's boosts included (utils/keyChance.ts), or undefined
 * for a source with no rate. For the Journal and Collection Log screens.
 */
export const useSourceKeyChance = (): ((source: string | undefined) => number | undefined) => {
  const game = useGame();
  return useCallback((source: string | undefined) => {
    const rate = source === undefined ? undefined : DROP_RATES[source];
    return rate === undefined ? undefined : keyChance(game, source!, rate) ?? 0;
  }, [game]);
};
