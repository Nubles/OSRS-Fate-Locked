import { useMemo } from 'react';
import { chunkContentService } from '../services/ChunkContentService';
import type { UnlockState } from '../types';
import { computeAreaRoutes, type AreaRoutes } from '../utils/areaRoutes';
import { useChunkContent } from './useChunkContent';

/**
 * Owned areas no route reaches yet, from the map's own reachability. Null
 * until the map's transport data has loaded, and then owning an area is
 * enough, as it was before.
 */
export function useAreaRoutes(unlocks: UnlockState, gameModeId?: string): AreaRoutes | null {
  const { ready } = useChunkContent();
  return useMemo(() => (
    ready
      ? computeAreaRoutes(chunkContentService.connectGraph(), unlocks, gameModeId)
      : null
  ), [ready, unlocks, gameModeId]);
}
