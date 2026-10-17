/**
 * Chunked mode's exact-chunk checks for the Journal (utils/journalStatus.ts).
 *
 * In Chunked, content counts only when the chunk it is in is owned, never
 * because some other chunk of its named area is. The chunk content says where
 * each quest starts and has its steps and where each diary task is done (the
 * Chunk Picker's task refs, such as "EA5"), and RuneProof's reviewed item
 * lists say which items a quest needs. This module turns those into the
 * Journal's blockers. It loads with the chunk content (ChunkContentService.init)
 * rather than with the app, so the entry chunk stays within its budget.
 *
 * Content data: ChunkContentService (credit: source-chunk/chunk-picker-v2).
 */
import type { ChunkContentService, RawEntry } from '../services/ChunkContentService';
import { CHUNK_CONTENT_DATA_VERSION } from '../services/ChunkContentService';
import { QUEST_DATA, type QuestData } from '../data/questData';
import { ALL_DIARY_TASKS, type DiaryLocationRequirement } from '../data/diaryTasks';
import { reviewedQuestRequirements } from '../data/questItemRequirements';
import type { UnlockState } from '../types';
import type { AreaRoutes } from './areaRoutes';
import { CHUNKED_START_KEY } from './chunkAdjacency';
import { chunkUnlocked } from './chunkLocations';
import { chunkAreaLabelAt } from './chunkPlaceLabel';
import { cachedChunkedQuestReach } from './chunkedQuestReach';
import { OCEAN_CHUNK_KEYS } from './oceanAccess';
import { PANDEMONIUM_ROUTE } from './pandemoniumRoute';
import { namedAreaChunks } from './reachability';
import {
  evaluateDiaryTierEligibility, installChunkedChecks,
  type ChunkedFrontier, type DiaryRequirement, type EligibilityBlocker,
} from './journalStatus';
import { DIARY_DATA } from '../data/diaryData';
import { chunkedTrainingTiers } from './chunkedSkillPool';
import { materializeQuestRouteSnapshot, materializeRuneProofAccount } from './questRoutes/goalPlannerRuneProof';
import { questItemsObtainableNow, type QuestRouteAnalysisSnapshot } from './questRoutes/analyzeQuest';

type Coord = { cx: number; cy: number };
interface QuestChunk extends Coord { key: string; id: string }

const keyOf = ({ cx, cy }: Coord) => `${cx},${cy}`;
const coordOf = (id: string | number): Coord => ({ cx: Math.floor(Number(id) / 256), cy: Number(id) % 256 });

/** Quests the entry gates know, by id and by name. */
const KNOWN_QUESTS = new Set([...Object.keys(QUEST_DATA), ...Object.values(QUEST_DATA).map(quest => quest.name)]);

// Owned chunks as a set, once per chunks list (state is replaced, never edited in place).
const ownedSets = new WeakMap<readonly string[], { length: number; keys: Set<string> }>();
const ownedKeys = (unlocks: UnlockState): Set<string> => {
  const chunks = unlocks.chunks ?? [];
  const hit = ownedSets.get(chunks);
  if (hit && hit.length === chunks.length) return hit.keys;
  const keys = new Set([CHUNKED_START_KEY, ...chunks]);
  ownedSets.set(chunks, { length: chunks.length, keys });
  return keys;
};

/**
 * Whether the run has this chunk: owned (the sea as chunkUnlocked says), or on
 * Pandemonium's route, which is open whenever Port Sarim is until the quest is
 * done (utils/pandemoniumRoute.ts).
 */
export const chunkedChunkOpen = ({ cx, cy }: Coord, unlocks: UnlockState): boolean => {
  const key = `${cx},${cy}`;
  const owned = ownedKeys(unlocks);
  if (owned.has(key)) return true;
  if (PANDEMONIUM_ROUTE.has(key) && !unlocks.quests.includes('Pandemonium') && owned.has('47,50')) return true;
  return OCEAN_CHUNK_KEYS.has(key) && chunkUnlocked(cx, cy, unlocks, 'chunked');
};

export function createChunkedChecks(service: ChunkContentService) {
  let questChunkCache = new Map<string, (QuestChunk[] & { keys?: ReadonlySet<string> }) | null>();
  let diaryIndex: Map<string, DiaryLocationRequirement> | null = null;
  let itemContent = new Map<string, { snapshot: QuestRouteAnalysisSnapshot; chunks: string[] }>();
  let itemVerdicts = new Map<string, Map<string, string[]>>();
  let allContentChunks: Set<string> | null = null;
  // A fresh dataset starts every cache afresh.
  service.subscribe(() => {
    questChunkCache = new Map(); diaryIndex = null; itemContent = new Map(); itemVerdicts = new Map(); allContentChunks = null;
  });

  /** The chunks a quest starts and has steps in; an interior's is its entrance. */
  const questChunks = (questId: string): (QuestChunk[] & { keys?: ReadonlySet<string> }) | null => {
    if (!service.ready) return null;
    let chunks = questChunkCache.get(questId);
    if (chunks === undefined) {
      const hit = service.entityLocations(questId, ['quest']);
      const seen = new Map<string, QuestChunk>();
      for (const { cx, cy } of hit?.locations ?? []) {
        const key = `${cx},${cy}`;
        if (!seen.has(key)) seen.set(key, { cx, cy, key, id: String(cx * 256 + cy) });
      }
      chunks = seen.size ? Object.assign([...seen.values()], { keys: new Set(seen.keys()) }) : null;
      questChunkCache.set(questId, chunks);
    }
    return chunks;
  };

  const quest = (q: QuestData, unlocks: UnlockState, areaRoutes?: AreaRoutes | null) => {
    const chunks = questChunks(q.id);
    if (!chunks) return null;
    const blockers: EligibilityBlocker[] = [];
    const evidence: string[] = [];
    const gates = new Set<string>();
    const sections = service.questSections();
    // Only asked for by callers that want routes, as the Diary Journal does.
    const reach = areaRoutes ? cachedChunkedQuestReach(service.connectGraph(), sections, unlocks) : null;
    for (const chunk of chunks) {
      const label = chunkAreaLabelAt(chunk.cx, chunk.cy);
      if (!chunkedChunkOpen(chunk, unlocks)) {
        blockers.push({ kind: 'region', label, chunk: { cx: chunk.cx, cy: chunk.cy }, location: { areas: [], chunks: [{ cx: chunk.cx, cy: chunk.cy }] } });
        continue;
      }
      // A chunk only another quest lets you into, such as Morytania past Priest in Peril.
      const needed = (sections[chunk.id] ?? []).filter(other => (
        other !== q.id && other !== q.name && KNOWN_QUESTS.has(other) && !unlocks.quests.includes(other)
      ));
      needed.forEach(other => gates.add(other));
      if (needed.length === 0 && reach && !reach.reaches(q.id, chunk.id)) {
        blockers.push({ kind: 'alternative', label: `No route to ${label}`, travel: label, blockerKinds: [], routes: [] });
      } else {
        evidence.push(label);
      }
    }
    for (const needed of gates) blockers.push({ kind: 'quest', label: needed });
    return { blockers, evidence, chunks: chunks.keys! };
  };

  /** A quest's item routes, and every chunk they could use, once per dataset. */
  const itemRoutes = (questId: string) => {
    let content = itemContent.get(questId);
    if (!content) {
      const snapshot = materializeQuestRouteSnapshot(
        questId, materializeRuneProofAccount({ ...EMPTY_ACCOUNT }, 'chunked'), service, CHUNK_CONTENT_DATA_VERSION,
      );
      const chunks = new Set<string>();
      for (const record of snapshot.itemSourceRecords) chunks.add(`${record.cx},${record.cy}`);
      for (const hit of snapshot.entityLocations) for (const location of hit.locations) chunks.add(keyOf(location));
      for (const station of snapshot.stationRequirements) chunks.add(station.chunk);
      content = { snapshot, chunks: [...chunks].sort() };
      itemContent.set(questId, content);
    }
    return content;
  };

  const questItems = (q: QuestData, unlocks: UnlockState): EligibilityBlocker[] => {
    if (!service.ready || !reviewedQuestRequirements(q.id)) return [];
    const { snapshot, chunks } = itemRoutes(q.id);
    const owned = ownedKeys(unlocks);
    // The verdict only depends on the owned chunks the item routes could use,
    // so a chunk elsewhere (an advisor's simulated roll) reuses it.
    const key = JSON.stringify([
      chunks.filter(chunk => owned.has(chunk)),
      unlocks.skills, unlocks.levels, unlocks.equipment, unlocks.quests, unlocks.merchants,
      unlocks.guilds, unlocks.mobility, unlocks.minigames, unlocks.slayerUnlocks,
    ]);
    let verdicts = itemVerdicts.get(q.id);
    if (!verdicts) itemVerdicts.set(q.id, verdicts = new Map());
    let missing = verdicts.get(key);
    if (!missing) {
      const result = questItemsObtainableNow(q.id, { ...snapshot, ...materializeRuneProofAccount(unlocks, 'chunked') });
      missing = result.status === 'CANNOT_COMPLETE_YET' ? result.missing : [];
      if (verdicts.size > 256) verdicts.clear();
      verdicts.set(key, missing);
    }
    return missing.map(item => ({ kind: 'region', label: `${item} (no source in your chunks yet)`, item }));
  };

  const diaryPlace = (taskId: string): DiaryLocationRequirement | null => {
    if (!service.ready) return null;
    diaryIndex ??= buildDiaryIndex(service.rawDocument()?.chunks ?? {}, service.rawDocument()?.interiors ?? {});
    return diaryIndex.get(taskId) ?? null;
  };

  /** A task (or one of its ways) done in its own chunks rather than anywhere in its areas. */
  const diaryTask = <R extends DiaryRequirement>(taskId: string, requirement: R): R | null => {
    const place = diaryPlace(taskId);
    if (!place || !(requirement.regions?.length || requirement.anyOfRegions?.length)) return null;
    const areas = [...(requirement.regions ?? []), ...(requirement.anyOfRegions ?? [])].join(' or ');
    const { cx, cy } = place.chunkOptions[0];
    const label = place.chunkOptions.length === 1 ? `${areas} (${cx}, ${cy})` : `${areas}: one of ${place.chunkOptions.length} chunks`;
    return {
      ...requirement, regions: undefined, anyOfRegions: undefined,
      locations: [...(requirement.locations ?? []), { ...place, label }],
    };
  };

  const contentChunks = (): ReadonlySet<string> => {
    if (!allContentChunks) {
      const keys = new Set<string>();
      for (const q of Object.values(QUEST_DATA)) {
        for (const chunk of questChunks(q.id) ?? []) keys.add(chunk.key);
        if (reviewedQuestRequirements(q.id)) for (const key of itemRoutes(q.id).chunks) keys.add(key);
      }
      for (const task of ALL_DIARY_TASKS) for (const chunk of diaryPlace(task.id)?.chunkOptions ?? []) keys.add(keyOf(chunk));
      allContentChunks = keys;
    }
    return allContentChunks;
  };

  const frontier = (unlocks: UnlockState): ChunkedFrontier | null => {
    if (!service.ready) return null;
    const chunks = unlocks.chunks ?? [];
    const skills: Record<string, number> = unlocks.skills ?? {};
    // As Skills Keys roll: a skill is trainable once a method sits within one tier of its own.
    const trainable = (tiers: ReadonlyMap<string, number>, skill: string) => (tiers.get(skill) ?? 99) <= (skills[skill] ?? 0) + 1;
    const now = chunkedTrainingTiers(chunks);
    const trainableNow = new Set([...now.keys()].filter(skill => trainable(now, skill)));
    let diaryIds: string[] | undefined;
    return {
      contentChunks: contentChunks(),
      get diaryIds() {
        return diaryIds ??= Object.values(DIARY_DATA).filter(diary => {
          if (unlocks.diaries?.includes(diary.id)) return false;
          const result = evaluateDiaryTierEligibility(diary, unlocks, 'chunked');
          return result.manualChecks.length === 0
            && result.blockers.every(blocker => blocker.kind === 'region' || blocker.kind === 'alternative' || blocker.kind === 'quest');
        }).map(diary => diary.id);
      },
      newSkills: key => {
        const tiers = chunkedTrainingTiers([...chunks, key]);
        return [...tiers.keys()].filter(skill => !trainableNow.has(skill) && trainable(tiers, skill)).sort();
      },
    };
  };

  return { quest, questItems, diaryTask, diaryPlace, questChunks, contentChunks, frontier };
}

const EMPTY_ACCOUNT: UnlockState = {
  skills: {}, levels: {}, equipment: {}, regions: [], chunks: [], quests: [], guilds: [], merchants: [],
  minigames: [], mobility: [], slayerUnlocks: [], arcana: [], housing: [], bosses: [], storage: [],
  farming: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
} as unknown as UnlockState;

/** The Chunk Picker's diary names, by the first word of the app's diary tiers. */
const PICKER_DIARY: Readonly<Record<string, string>> = {
  Ardougne: 'Ardougne', Desert: 'Desert', Falador: 'Falador', Fremennik: 'Fremennik', Kandarin: 'Kandarin',
  Karamja: 'Karamja', Kourend: 'Kourend & Kebos', Lumbridge: 'Lumbridge & Draynor', Morytania: 'Morytania',
  Varrock: 'Varrock', Western: 'Western Provinces', Wilderness: 'Wilderness',
};
const PICKER_TIER: Readonly<Record<string, string>> = { Easy: 'EA', Medium: 'MD', Hard: 'HD', Elite: 'EL' };

/**
 * Each diary task's chunks. The Chunk Picker numbers a tier's tasks in the
 * wiki's order ("EA5" is the fifth Easy task), which is the order
 * data/diaryTasks.ts lists them in (its ids are not always in order). An
 * interior's tasks are at its entrances, the ones with no requirement first.
 * A task keeps its named areas when none of its chunks lie in or beside them:
 * a few refs are stale (the Emblem Trader's points at the deep Wilderness).
 */
export function buildDiaryIndex(
  chunks: Record<string, RawEntry>,
  interiors: Record<string, { content: RawEntry; entrances: { chunkId: string; requirements: string[] }[] }>,
): Map<string, DiaryLocationRequirement> {
  const refChunks = new Map<string, Map<string, Coord>>();
  const add = (diaries: Record<string, string> | undefined, coords: Coord[]) => {
    for (const [diary, refs] of Object.entries(diaries ?? {})) {
      for (const ref of refs.split(',').map(value => value.trim()).filter(Boolean)) {
        const id = `${diary}|${ref}`;
        const known = refChunks.get(id) ?? new Map<string, Coord>();
        for (const coord of coords) known.set(keyOf(coord), coord);
        refChunks.set(id, known);
      }
    }
  };
  for (const [id, entry] of Object.entries(chunks)) add(entry.d, [coordOf(id)]);
  for (const interior of Object.values(interiors)) {
    const free = interior.entrances.filter(entrance => entrance.requirements.length === 0);
    add(interior.content.d, (free.length ? free : interior.entrances).map(entrance => coordOf(entrance.chunkId)));
  }

  const index = new Map<string, DiaryLocationRequirement>();
  const position = new Map<string, number>();
  for (const task of ALL_DIARY_TASKS) {
    const n = (position.get(task.tierId) ?? 0) + 1;
    position.set(task.tierId, n);
    const [diary, tier] = task.tierId.split(' ');
    const found = refChunks.get(`${PICKER_DIARY[diary]}|${PICKER_TIER[tier]}${n}`);
    if (!found?.size) continue;
    const areas = [
      ...(task.regions ?? []), ...(task.anyOfRegions ?? []),
      ...(task.oneOf ?? []).flatMap(option => option.regions ?? []),
    ];
    const near = areas.flatMap(area => namedAreaChunks(area));
    const chunkOptions = [...found.values()].sort((a, b) => a.cx - b.cx || a.cy - b.cy);
    const matches = near.length === 0 || chunkOptions.some(chunk => near.some(area => (
      Math.abs(area.cx - chunk.cx) <= 1 && Math.abs(area.cy - chunk.cy) <= 1
    )));
    if (matches) index.set(task.id, { label: task.description, chunkOptions });
  }
  return index;
}

/** Called once the chunk content module loads (ChunkContentService.init). */
export const install = (service: ChunkContentService): void => {
  installChunkedChecks(createChunkedChecks(service));
};
