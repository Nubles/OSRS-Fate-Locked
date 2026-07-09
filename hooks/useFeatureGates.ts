import { useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { visibleFeatures, type FeatureId } from '../utils/featureGates';

/**
 * The run's currently-revealed surfaces (progressive disclosure).
 * Cheap to call anywhere — memoized on the state the gates actually read.
 */
export function useFeatureGates(): Set<FeatureId> {
  const { history, unlocks, fatePoints, revealAllFeatures } = useGame();
  return useMemo(
    () => visibleFeatures({ history, unlocks, fatePoints, revealAllFeatures }),
    [history, unlocks, fatePoints, revealAllFeatures],
  );
}
