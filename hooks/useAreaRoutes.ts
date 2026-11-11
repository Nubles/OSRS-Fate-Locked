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
// Kept once loaded, so a panel opened later starts with its routes instead
// of drawing once without them.
let routingLoaded: Routing | null = null;
const loadRouting = () => (routing ??= Promise.all([
  importWithRetry(() => import('../services/ChunkContentService')),
  importWithRetry(() => import('../utils/areaRoutes')),
]).then(([content, routes]) => (routingLoaded = { service: content.chunkContentService, compute: routes.computeAreaRoutes }))
  .catch(error => { routing = null; throw error; }));

/**
 * The longest a screen holds a number that depends on the routes before it
 * shows the number without them. The routes normally arrive well inside a
 * second, and a failed load ends the wait at once. This is the safety net for
 * a load that hangs: a slow computer is better served by the holding line
 * than by a count that is about to change.
 */
export const AREA_ROUTES_WAIT_MS = 20_000;

export interface AreaRoutesState {
  /** Owned areas no route reaches yet. Null until the map's transport data has loaded. */
  routes: AreaRoutes | null;
  /**
   * The routes are on their way: asked for, not loaded, not failed, and not
   * yet past AREA_ROUTES_WAIT_MS. Until they arrive owning an area is
   * enough, so a "ready now" count is too high wherever a run owns a place
   * no route reaches. The first screen holds those counts while this is true.
   */
  pending: boolean;
}

/**
 * Owned areas no route reaches yet, from the map's own reachability, and
 * whether that answer is still loading. `enabled: false` (the first-visit
 * onboarding) waits before loading any of it.
 */
export function useAreaRoutesState(unlocks: UnlockState, gameModeId?: string, enabled = true): AreaRoutesState {
  const [loaded, setLoaded] = useState<Routing | null>(() => (enabled ? routingLoaded : null));
  const [ready, setReady] = useState(() => enabled && !!routingLoaded?.service.ready);
  // Failed, or past the wait: stop holding numbers and show them without routes.
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (!enabled || loaded) return;
    let active = true;
    loadRouting()
      .then(next => { if (active) setLoaded(next); })
      // Not loaded, so routes stay unknown: owning an area is enough, as before.
      .catch(() => { if (active) setGaveUp(true); });
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
    else void service.init().then(ok => { update(); if (active && !ok) setGaveUp(true); });
    return () => { active = false; unsubscribe(); };
  }, [loaded]);
  useEffect(() => {
    if (!enabled || ready || gaveUp) return;
    const timer = setTimeout(() => setGaveUp(true), AREA_ROUTES_WAIT_MS);
    return () => clearTimeout(timer);
  }, [enabled, ready, gaveUp]);
  const routes = useMemo(() => (
    ready && loaded
      ? loaded.compute(loaded.service.connectGraph(), unlocks, gameModeId)
      : null
  ), [ready, loaded, unlocks, gameModeId]);
  const pending = enabled && !routes && !gaveUp;
  return useMemo(() => ({ routes, pending }), [routes, pending]);
}

/**
 * Owned areas no route reaches yet, from the map's own reachability. Null
 * until the map's transport data has loaded, and then owning an area is
 * enough, as it was before. `enabled: false` (the first-visit onboarding)
 * waits before loading any of it.
 */
export function useAreaRoutes(unlocks: UnlockState, gameModeId?: string, enabled = true): AreaRoutes | null {
  return useAreaRoutesState(unlocks, gameModeId, enabled).routes;
}
