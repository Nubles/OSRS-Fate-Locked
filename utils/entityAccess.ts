import { canonicalBossId } from './contentIdentity';
import { MERCHANT_SERVICES } from '../data/merchantServices';
import { chunkContentService, type ChunkContent, type EntityKind } from '../services/ChunkContentService';
import type { UnlockState } from '../types';
import { chunkUnlocked } from './chunkLocations';
import { classifyShop } from './shopClassification';
import { compileRawRequirements, evaluateRouteGates } from './questRoutes/accountRequirements';
import type { RawRouteRequirement } from './questRoutes/model';

export type EntityAccessStatus = 'ALLOWED' | 'NOT_READY' | 'LOCKED' | 'UNKNOWN';
export interface EntityAccessResult { status: EntityAccessStatus; reasons: string[]; }
export interface EntityAccessSource {
  taskRequirements(name: string, kind: EntityKind, cx: number, cy: number): string[];
  chunkEntryRequirements(cx: number, cy: number): string[];
  entityRequirementOptions?(name: string, kind: EntityKind, cx: number, cy: number, sourceId?: string): RawRouteRequirement[][];
}

/** A surface bank or any independently accessible interior facility suffices. */
export function evaluateBankRequirements(
  content: ChunkContent, coord: { cx: number; cy: number }, unlocks: UnlockState,
  source: EntityAccessSource = chunkContentService,
): EntityAccessResult {
  const facilities = content.objects.filter(([name]) => /^(bank booth|bank chest|bank deposit box|bank deposit chest|deposit pool)$/i.test(name))
    .map(([name]) => ({ name, kind: 'object' as EntityKind }));
  if (content.npcs.includes('Banker')) facilities.push({ name: 'Banker', kind: 'npc' });
  const results = facilities.map(({ name, kind }) => evaluateEntityRequirements(name, kind, coord, unlocks, source));
  // Reviewed NPC services may not have a generic bank object in the source.
  if (!results.length) return evaluateEntityRequirements('Bank facility', 'object', coord, unlocks, source);
  if (results.some(result => result.status === 'ALLOWED')) return { status: 'ALLOWED', reasons: [] };
  return { status: results.some(result => result.status === 'UNKNOWN') ? 'UNKNOWN' : 'NOT_READY',
    reasons: [...new Set(results.flatMap(result => result.reasons))] };
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
  return evaluateEntityRequirements(name, kind, coord, unlocks, source);
}

/** Source access gates, separate from ownership/category presentation in a mixed-area drawer. */
export function evaluateEntityRequirements(
  name: string, kind: EntityKind, coord: { cx: number; cy: number; sourceId?: string },
  unlocks: UnlockState, source: EntityAccessSource = chunkContentService,
): EntityAccessResult {
  const service = kind === 'npc' ? MERCHANT_SERVICES[name] : undefined;
  const options = source.entityRequirementOptions?.(name, kind, coord.cx, coord.cy, coord.sourceId) ?? [[
    ...source.taskRequirements(name, kind, coord.cx, coord.cy).map(raw => ({ raw, origin: 'ENTITY' as const })),
    ...source.chunkEntryRequirements(coord.cx, coord.cy).map(raw => ({ raw, origin: 'CHUNK_ENTRY' as const })),
  ]];
  const evaluations = options.map(requirements => evaluateRouteGates(compileRawRequirements([...requirements, ...(service?.requirements ?? []).map(raw => ({ raw, origin: 'ENTITY' as const }))]), unlocks));
  if (evaluations.some(result => !result.blockers.length)) return { status: 'ALLOWED', reasons: [] };
  const reasons = [...new Set(evaluations.flatMap(result => result.blockers.map(gate => gate.label)))];
  return { status: !evaluations.length || evaluations.some(result => result.hasDataGap) ? 'UNKNOWN' : 'NOT_READY', reasons };
}
