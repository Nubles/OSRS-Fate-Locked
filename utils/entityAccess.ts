import { canonicalBossId } from './contentIdentity';
import { MERCHANT_SERVICES } from '../data/merchantServices';
import { chunkContentService, type ChunkContent, type EntityKind } from '../services/ChunkContentService';
import type { UnlockState } from '../types';
import { chunkUnlocked } from './chunkLocations';
import { classifyShop } from './shopClassification';
import { compileRawRequirements, evaluateRouteGates } from './questRoutes/accountRequirements';
import type { RawRouteRequirement } from './questRoutes/model';
import bankRegistry from '../data/sources/bank-locations.json';
import { getActivityReq } from '../data/activityRequirements';
import { REGIONS_LIST } from '../data/items';
import { canonicalAreaName } from '../data/areaMapPolicy';
import { evaluateActivityReadiness } from './activityReadiness';
import { isAreaReachable } from './reachability';

export type EntityAccessStatus = 'ALLOWED' | 'NOT_READY' | 'LOCKED' | 'UNKNOWN';
export interface EntityAccessResult { status: EntityAccessStatus; reasons: string[]; }
export interface EntityAccessSource {
  taskRequirements(name: string, kind: EntityKind, cx: number, cy: number): string[];
  chunkEntryRequirements(cx: number, cy: number): string[];
  entityRequirementOptions?(name: string, kind: EntityKind, cx: number, cy: number, sourceId?: string): RawRouteRequirement[][];
  entityAccessOptions?(name: string, kind: EntityKind, cx: number, cy: number, sourceId?: string): Array<{ requirements: RawRouteRequirement[]; area?: string }>;
}

// The source exports the Blast Furnace separately, but it is inside the
// independently rolled Keldagrim area (see the reviewed bank registry).
const INTERIOR_AREA_OWNERS: Record<string, string> = { 'Blast Furnace': 'Keldagrim' };

/** All simultaneous gates must pass; a known blocker outranks uncertainty. */
function combineAccess(...results: EntityAccessResult[]): EntityAccessResult {
  const status = (['LOCKED', 'NOT_READY', 'UNKNOWN', 'ALLOWED'] as const)
    .find(candidate => results.some(result => result.status === candidate)) ?? 'UNKNOWN';
  return { status, reasons: [...new Set(results.flatMap(result => result.reasons))] };
}

/** Alternative locations are independent: one usable source is sufficient. */
function bestAccess(results: EntityAccessResult[]): EntityAccessResult {
  if (results.some(result => result.status === 'ALLOWED')) return { status: 'ALLOWED', reasons: [] };
  const status = (['UNKNOWN', 'NOT_READY', 'LOCKED'] as const)
    .find(candidate => results.some(result => result.status === candidate)) ?? 'UNKNOWN';
  return { status, reasons: [...new Set(results.flatMap(result => result.reasons))] };
}

interface BankAccessOption { quests?: string[]; diaries?: string[]; manual?: string[]; }
const registryBanks = bankRegistry.locations as Array<{
  id: string; name: string; accessOptions?: BankAccessOption[];
}>;

function registryBankRequirements(coord: { cx: number; cy: number }, unlocks: UnlockState, source: EntityAccessSource): EntityAccessResult {
  const bank = registryBanks.find(entry => entry.id === String(coord.cx * 256 + coord.cy));
  const entry = evaluateEntityRequirements(bank?.name ?? 'Unreviewed bank', 'object', coord, unlocks, source);
  const options: EntityAccessResult[] = (bank?.accessOptions ?? []).map(option => {
    const missing = [
      ...(option.quests ?? []).filter(quest => !unlocks.quests.includes(quest)).map(quest => `Complete ${quest}`),
      ...(option.diaries ?? []).filter(diary => !unlocks.diaries.includes(diary)).map(diary => `Complete ${diary} Diary`),
    ];
    return missing.length ? { status: 'NOT_READY', reasons: missing }
      : option.manual?.length ? { status: 'UNKNOWN', reasons: option.manual }
        : { status: 'ALLOWED', reasons: [] };
  });
  const access: EntityAccessResult = options.some(option => option.status === 'ALLOWED')
    ? { status: 'ALLOWED', reasons: [] }
    : { status: !options.length || options.some(option => option.status === 'UNKNOWN') ? 'UNKNOWN' : 'NOT_READY',
      reasons: options.length ? [...new Set(options.flatMap(option => option.reasons))]
        : [`${bank?.name ?? 'Bank facility'} access requirements need review`] };
  return { status: entry.status === 'NOT_READY' || access.status === 'NOT_READY' ? 'NOT_READY'
    : entry.status === 'UNKNOWN' || access.status === 'UNKNOWN' ? 'UNKNOWN' : 'ALLOWED',
    reasons: [...new Set([...entry.reasons, ...access.reasons])] };
}

/** A surface bank or any independently accessible interior facility suffices.
 * Pass mode to enforce interior Fate ownership; omission checks OSRS requirements only.
 * Bank-table ownership and surface ownership remain the caller's responsibility.
 */
export function evaluateBankRequirements(
  content: ChunkContent, coord: { cx: number; cy: number }, unlocks: UnlockState,
  source: EntityAccessSource = chunkContentService, mode?: string,
): EntityAccessResult {
  const facilities: Array<{ name: string; kind: EntityKind; requirements?: string[] }> = content.objects
    .filter(([name]) => /^(bank booth|bank chest|bank deposit box|bank deposit chest|deposit pool)$/i.test(name))
    .map(([name]) => ({ name, kind: 'object' }));
  if (content.npcs.includes('Banker')) facilities.push({ name: 'Banker', kind: 'npc' });
  for (const facility of bankRegistry.reviewedFacilities) {
    if (facility.id !== String(coord.cx * 256 + coord.cy)) continue;
    const present = facility.kind === 'object'
      ? content.objects.some(([name]) => name === facility.name) : content.npcs.includes(facility.name);
    if (present) facilities.push({ ...facility, kind: facility.kind as EntityKind });
  }
  const results = facilities.map(({ name, kind, requirements }) => {
    const access = evaluateEntityRequirements(name, kind, coord, unlocks, source, mode);
    const extra = evaluateRouteGates(compileRawRequirements((requirements ?? []).map(raw => ({ raw, origin: 'ENTITY' as const }))), unlocks);
    return combineAccess(access, { status: !extra.blockers.length ? 'ALLOWED' : extra.hasDataGap ? 'UNKNOWN' : 'NOT_READY',
      reasons: extra.blockers.map(gate => gate.label) });
  });
  // Reviewed NPC services may not have a generic bank object in the source.
  if (!results.length) return registryBankRequirements(coord, unlocks, source);
  return bestAccess(results);
}

/** Category, ownership and source requirements use the same policy in UI and export. */
export function evaluateEntityAccess(
  name: string, kind: EntityKind, coord: { cx: number; cy: number; sourceId?: string }, unlocks: UnlockState,
  mode?: string, source: EntityAccessSource = chunkContentService, reachable?: ReadonlySet<string>,
): EntityAccessResult {
  if (!chunkUnlocked(coord.cx, coord.cy, unlocks, mode)) return { status: 'LOCKED', reasons: ['Location locked'] };
  const bossId = kind === 'monster' ? canonicalBossId(name) : undefined;
  if (bossId && !unlocks.bosses.includes(bossId)) return { status: 'LOCKED', reasons: [`Unlock ${bossId}`] };
  const service = kind === 'npc' ? MERCHANT_SERVICES[name] : undefined;
  if (kind === 'shop' || service) {
    const category = service?.category ?? classifyShop(name);
    if (!category) return { status: 'UNKNOWN', reasons: ['Shop category needs review'] };
    if (!unlocks.merchants.includes(category)) return { status: 'LOCKED', reasons: [`Unlock ${category}`] };
  }
  if (reachable && !reachable.has(String(coord.cx * 256 + coord.cy))) {
    return { status: 'NOT_READY', reasons: ['No reachable route to this location'] };
  }
  return evaluateEntityRequirements(name, kind, coord, unlocks, source, mode ?? 'vanilla');
}

/** Source access gates, separate from entrance/category presentation in a mixed-area drawer. */
export function evaluateEntityRequirements(
  name: string, kind: EntityKind, coord: { cx: number; cy: number; sourceId?: string },
  unlocks: UnlockState, source: EntityAccessSource = chunkContentService, mode?: string,
): EntityAccessResult {
  const requirements = evaluateSourceRequirements(name, kind, coord, unlocks, source, mode, mode !== undefined);
  const bossId = kind === 'monster' ? canonicalBossId(name) : undefined;
  if (!bossId) return requirements;
  const readiness = evaluateActivityReadiness(true, getActivityReq(bossId), unlocks, mode);
  const bossAccess: EntityAccessResult = readiness.status === 'READY'
    ? { status: 'ALLOWED', reasons: [] }
    : readiness.status === 'NEEDS_CONFIRMATION' ? { status: 'UNKNOWN', reasons: readiness.checks }
      : readiness.status === 'NOT_READY' ? { status: 'NOT_READY', reasons: readiness.blockers.map(blocker => blocker.label) }
        : { status: 'LOCKED', reasons: [`Unlock ${bossId}`] };
  return combineAccess(requirements, bossAccess);
}

function evaluateSourceRequirements(
  name: string, kind: EntityKind, coord: { cx: number; cy: number; sourceId?: string },
  unlocks: UnlockState, source: EntityAccessSource, mode?: string, enforceArea = false,
): EntityAccessResult {
  const service = kind === 'npc' ? MERCHANT_SERVICES[name] : undefined;
  const options = source.entityAccessOptions?.(name, kind, coord.cx, coord.cy, coord.sourceId)
    ?? (source.entityRequirementOptions?.(name, kind, coord.cx, coord.cy, coord.sourceId) ?? [[
    ...source.taskRequirements(name, kind, coord.cx, coord.cy).map(raw => ({ raw, origin: 'ENTITY' as const })),
    ...source.chunkEntryRequirements(coord.cx, coord.cy).map(raw => ({ raw, origin: 'CHUNK_ENTRY' as const })),
  ]]).map(requirements => ({ requirements, area: undefined }));
  return bestAccess(options.map(({ requirements, area }): EntityAccessResult => {
    const canonicalArea = area ? canonicalAreaName(INTERIOR_AREA_OWNERS[area] ?? area) : undefined;
    // Interior source names are evidence for independently rolled Fate areas,
    // not a reason to invent an unlock for every named cave or quest instance.
    if (enforceArea && canonicalArea && REGIONS_LIST.includes(canonicalArea)
      && !isAreaReachable(canonicalArea, unlocks, mode)) {
      return { status: 'LOCKED', reasons: [`Unlock ${canonicalArea}`] };
    }
    const result = evaluateRouteGates(compileRawRequirements([...requirements, ...(service?.requirements ?? []).map(raw => ({ raw, origin: 'ENTITY' as const }))]), unlocks);
    return { status: !result.blockers.length ? 'ALLOWED' : result.hasDataGap ? 'UNKNOWN' : 'NOT_READY',
      reasons: result.blockers.map(gate => gate.label) };
  }));
}
