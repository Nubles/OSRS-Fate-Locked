import { useEffect, useMemo, useState } from 'react';
import { chunkContentService } from '../services/ChunkContentService';
import type { UnlockState } from '../types';
import type { AreaRoutes } from '../utils/areaRoutes';
import { useChunkContent } from './useChunkContent';

type ComputeAreaRoutes = typeof import('../utils/areaRoutes').computeAreaRoutes;

// Loaded with the map's transport data, not with the app: the journal summary
// on the first screen asks for routes, and the router and its travel links
// would otherwise sit in the entry chunk.
let routing: Promise<ComputeAreaRoutes> | null = null;
const loadRouting = () => (routing ??= import('../utils/areaRoutes')
  .then(module => module.computeAreaRoutes)
  .catch(error => { routing = null; throw error; }));

/**
 * Owned areas no route reaches yet, from the map's own reachability. Null
 * until the map's transport data has loaded, and then owning an area is
 * enough, as it was before.
 */
export function useAreaRoutes(unlocks: UnlockState, gameModeId?: string): AreaRoutes | null {
  const { ready } = useChunkContent();
  const [compute, setCompute] = useState<ComputeAreaRoutes | null>(null);
  useEffect(() => {
    if (!ready || compute) return;
    let active = true;
    loadRouting()
      .then(loaded => { if (active) setCompute(() => loaded); })
      // Not loaded, so routes stay unknown: owning an area is enough, as before.
      .catch(() => {});
    return () => { active = false; };
  }, [ready, compute]);
  return useMemo(() => (
    ready && compute
      ? compute(chunkContentService.connectGraph(), unlocks, gameModeId)
      : null
  ), [ready, compute, unlocks, gameModeId]);
}
