/**
 * Chunk-derived quest locations for map links and display evidence only.
 *
 * The chunk-content dataset records where a quest starts or has a step. Those
 * records can make the Journal more precise, but they are incomplete evidence
 * and never override the reviewed requirements enforced by
 * `evaluateQuestEligibility`.
 *
 * Content data: ChunkContentService (credit: source-chunk/chunk-picker-v2).
 */
import { chunkContentService, EntityLocation } from '../services/ChunkContentService';
import { placeOf, chunkUnlocked, ChunkPlace } from './chunkLocations';
import { UnlockState } from '../types';

export interface QuestPlace extends ChunkPlace {
  unlocked: boolean;
  /** Does the quest start in this place, or just pass through it? */
  role: 'first' | 'step';
}

export interface QuestLocationInfo {
  /** False when the dataset has no chunk record for this quest. */
  hasData: boolean;
  /** Deduped places: start places first, then locked-before-unlocked. */
  places: QuestPlace[];
  /** Subset where the quest starts. */
  startPlaces: QuestPlace[];
  /** Places still locked for this run. */
  lockedPlaces: QuestPlace[];
  /** True when the quest has data and every place it touches is unlocked. */
  allUnlocked: boolean;
}

/**
 * Pure core: fold raw chunk locations into deduped, lock-tagged places.
 * Exported for unit testing without the (async, fetch-backed) service.
 */
export function summariseQuestPlaces(
  locations: EntityLocation[],
  unlocks: UnlockState,
  gameModeId?: string,
): QuestLocationInfo {
  if (locations.length === 0) {
    return { hasData: false, places: [], startPlaces: [], lockedPlaces: [], allUnlocked: false };
  }
  const seen = new Map<string, QuestPlace>();
  for (const loc of locations) {
    const place = placeOf(loc.cx, loc.cy);
    const role: 'first' | 'step' = loc.role ?? 'step';
    const unlocked = chunkUnlocked(loc.cx, loc.cy, unlocks, gameModeId);
    const existing = seen.get(place.label);
    if (!existing) {
      seen.set(place.label, { ...place, unlocked, role });
    } else if (role === 'first') {
      existing.role = 'first'; // a start beats a mere step for the same place
    }
  }
  const places = [...seen.values()].sort((a, b) =>
    Number(b.role === 'first') - Number(a.role === 'first') ||
    Number(a.unlocked) - Number(b.unlocked) || // locked first, so blockers lead
    a.label.localeCompare(b.label));
  const startPlaces = places.filter(p => p.role === 'first');
  const lockedPlaces = places.filter(p => !p.unlocked);
  return { hasData: true, places, startPlaces, lockedPlaces, allUnlocked: lockedPlaces.length === 0 };
}

/** Look the quest up in the (already-initialised) chunk index, then summarise. */
export function questLocations(questName: string, unlocks: UnlockState, gameModeId?: string): QuestLocationInfo {
  const hit = chunkContentService.entityLocations(questName, ['quest']);
  return summariseQuestPlaces(hit?.locations ?? [], unlocks, gameModeId);
}

/**
 * Compatibility helper for legacy display callers. Canonical authored access is
 * the only source of `met`; chunk evidence may be shown separately through the
 * supplied `QuestLocationInfo`, but can never promote a blocked quest.
 */
export function refineQuestRegion(
  authoredMet: boolean,
  _info: QuestLocationInfo,
): { met: boolean; via: 'authored' | 'chunks' | 'locked' } {
  return authoredMet
    ? { met: true, via: 'authored' }
    : { met: false, via: 'locked' };
}
