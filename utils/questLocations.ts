/**
 * Chunk-derived quest locations — refine a quest's region requirement using the
 * actual chunks the quest touches, instead of only its hand-authored (and
 * continent-coarse) `regions` list.
 *
 * The chunk-content dataset records, per chunk, which quests **start** there
 * ('first') or have a **step** there ('step'). Joining that to our sub-area
 * unlock model lets us:
 *   • show the precise sub-areas a quest needs (Ardougne, not all of Kandarin),
 *     each green/red by its real unlock state, and
 *   • loosen the region gate: if every chunk a quest visits sits in an unlocked
 *     sub-area, the quest isn't region-locked even when its authored continent
 *     isn't fully unlocked.
 *
 * The loosening is deliberately conservative — it only ever *grants* region
 * access when chunk evidence fully supports it, so it can't mark a quest
 * available that the player can't actually reach.
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
): QuestLocationInfo {
  if (locations.length === 0) {
    return { hasData: false, places: [], startPlaces: [], lockedPlaces: [], allUnlocked: false };
  }
  const seen = new Map<string, QuestPlace>();
  for (const loc of locations) {
    const place = placeOf(loc.cx, loc.cy);
    const role: 'first' | 'step' = loc.role ?? 'step';
    const unlocked = chunkUnlocked(loc.cx, loc.cy, unlocks);
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
export function questLocations(questName: string, unlocks: UnlockState): QuestLocationInfo {
  const hit = chunkContentService.entityLocations(questName, ['quest']);
  return summariseQuestPlaces(hit?.locations ?? [], unlocks);
}

/**
 * Is the quest's region requirement met, refined by chunk evidence?
 *   • 'authored' — all gated continents in `regions` are unlocked (old behaviour)
 *   • 'chunks'   — continents aren't all unlocked, but every chunk the quest
 *                  visits is in an unlocked sub-area, so it's reachable anyway
 *   • 'locked'   — neither; some place the quest needs is still locked
 */
export function refineQuestRegion(
  authoredMet: boolean,
  info: QuestLocationInfo,
): { met: boolean; via: 'authored' | 'chunks' | 'locked' } {
  if (authoredMet) return { met: true, via: 'authored' };
  if (info.hasData && info.allUnlocked) return { met: true, via: 'chunks' };
  return { met: false, via: 'locked' };
}
