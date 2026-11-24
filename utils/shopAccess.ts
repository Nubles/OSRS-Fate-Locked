import type { UnlockState } from '../types';
import { AREA_ENTRY_ROUTES } from '../data/areaAccess';
import { canonicalAreaName } from '../data/areaMapPolicy';
import { chunkContentService } from '../services/ChunkContentService';
import type { AreaRoutes } from './areaRoutes';
import { placeOf } from './chunkLocations';
import { evaluateEntityAccess, type EntityAccessResult, type EntityAccessSource } from './entityAccess';
import { evaluateDiaryTaskEligibility } from './journalStatus';
import type { CategoryShop } from './merchantShops';

const NO_ROUTE: EntityAccessResult = { status: 'NOT_READY', reasons: ['No reachable route to this location'] };

/**
 * One shop placement as the shop directory shows it, in both layouts. It is
 * the RuneLite export's answer (category, land, a route from the run's start
 * in `reach`, the shop's own gates), and outside Chunked also an island's
 * reviewed way on (data/areaAccess.ts: Miscellania needs The Fremennik
 * Trials), which the route graph can't judge, as the boss and minigame cards
 * ask it. Without `reach` or `areaRoutes` (still loading) that part is left out.
 */
export function shopLocationAccess(
  shop: Pick<CategoryShop, 'name' | 'kind'>,
  location: { cx: number; cy: number },
  unlocks: UnlockState,
  gameModeId: string | undefined,
  reach?: ReadonlySet<string>,
  areaRoutes?: AreaRoutes | null,
  source: EntityAccessSource = chunkContentService,
): EntityAccessResult {
  const access = evaluateEntityAccess(shop.name, shop.kind ?? 'shop', location, unlocks, gameModeId, source, reach);
  if (access.status === 'LOCKED' || access.status === 'NOT_READY' || gameModeId === 'chunked' || !areaRoutes) return access;
  const place = placeOf(location.cx, location.cy);
  const area = place.subArea ?? place.region;
  if (!area || !AREA_ENTRY_ROUTES[canonicalAreaName(area)]?.length) return access;
  return evaluateDiaryTaskEligibility({ id: 'shop-area', anyOfRegions: [area] }, unlocks, gameModeId, areaRoutes).confirmable
    ? access : NO_ROUTE;
}
