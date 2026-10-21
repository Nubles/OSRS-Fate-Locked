import { useEffect, useMemo, useState } from 'react';
import type { UnlockState } from '../types';
import type { AreaRoutes } from '../utils/areaRoutes';
import { importWithRetry } from '../utils/lazyRetry';

type Routing = {
  service: typeof import('../services/ChunkContentService').chunkContentService;
  compute: typeof import('../utils/areaRoutes').computeAreaRoutes;
};

// Loaded with the map's transport data, not with the app: the journal summary
// on the first screen asks for routes, and the content service, the router
// and its travel links would otherwise sit in the entry chunk.
let routing: Promise<Routing> | null = null;
const loadRouting = () => (routing ??= Promise.all([
  importWithRetry(() => import('../services/ChunkContentService')),
  importWithRetry(() => import('../utils/areaRoutes')),
]).then(([content, routes]) => ({ service: content.chunkContentService, compute: routes.computeAreaRoutes }))
  .catch(error => { routing = null; throw error; }));

/**
 * Owned areas no route reaches yet, from the map's own reachability. Null
 * until the map's transport data has loaded, and then owning an area is
 * enough, as it was before. `enabled: false` (the first-visit onboarding)
 * waits before loading any of it.
 */
export function useAreaRoutes(unlocks: UnlockState, gameModeId?: string, enabled = true): AreaRoutes | null {
  const [loaded, setLoaded] = useState<Routing | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled || loaded) return;
    let active = true;
    loadRouting()
      .then(next => { if (active) setLoaded(next); })
      // Not loaded, so routes stay unknown: owning an area is enough, as before.
      .catch(() => {});
    return () => { active = false; };
  }, [enabled, loaded]);
  // All content consumers observe successful retries, including retries in another panel.
  useEffect(() => {
    if (!loaded) return;
    const { service } = loaded;
    let active = true;
    const update = () => { if (active) setReady(service.ready); };
    const unsubscribe = service.subscribe(update);
    if (service.ready) update();
    else void service.init().then(update);
    return () => { active = false; unsubscribe(); };
  }, [loaded]);
  return useMemo(() => (
    ready && loaded
      ? loaded.compute(loaded.service.connectGraph(), unlocks, gameModeId)
      : null
  ), [ready, loaded, unlocks, gameModeId]);
}
