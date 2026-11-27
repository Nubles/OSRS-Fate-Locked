import { useCallback, useMemo } from 'react';
import type { UnlockState } from '../types';
import { chunkContentService } from '../services/ChunkContentService';
import { runReach } from '../utils/chunkEntry';
import type { EntityAccessResult } from '../utils/entityAccess';
import type { CategoryShop } from '../utils/merchantShops';
import { shopLocationAccess } from '../utils/shopAccess';
import { useAreaRoutes } from './useAreaRoutes';

/**
 * The shop directory's access check for each of a shop's placements, with the
 * same route from the run's start the RuneLite export uses (runReach), once
 * the chunk content has loaded.
 */
export function useShopAccess(ready: boolean, unlocks: UnlockState, gameModeId: string | undefined) {
  const areaRoutes = useAreaRoutes(unlocks, gameModeId);
  const reach = useMemo(
    () => (ready && chunkContentService.ready ? runReach(chunkContentService, unlocks, gameModeId ?? 'vanilla') : undefined),
    [ready, unlocks, gameModeId],
  );
  return useCallback(
    (shop: CategoryShop): EntityAccessResult[] => shop.locations.map(location =>
      shopLocationAccess(shop, location, unlocks, gameModeId, reach, areaRoutes)),
    [unlocks, gameModeId, reach, areaRoutes],
  );
}
