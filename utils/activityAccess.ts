import { UnlockState } from '../types';
import { usesActivityKeyReserves } from '../config/gameModes';
import { ACTIVITY_ACCESS_AREAS, ACTIVITY_AREA_QUESTS, CHUNKED_ACTIVITY_RULES, NO_HARD_LOCATION_GATE } from '../data/activityAccess';
import { ACTIVITY_CHUNKS, GATED_ENTRANCE_CHUNKS, SLAYER_MASTER_CHUNKS } from '../data/activityChunks';
import { BANK_BY_ID } from '../data/banks';
import { CHUNK_ENTRY_QUESTS } from '../data/chunkSkillNodes';
import { isAreaReachable } from './reachability';
import { chunkLabel, chunkSubArea, isChunkUnlocked, parseChunkKey } from './chunkAdjacency';
import { chunkUnlocked } from './chunkLocations';
import { canNavigateOcean } from './oceanAccess';
import { compileRawRequirements, evaluateRouteGates } from './questRoutes/accountRequirements';

export interface ActivityAccessResult {
  eligible: boolean;
  requiredAreas: readonly string[];
  explanation: string;
}

const hasOwn = (table: object, key: string): boolean => Object.prototype.hasOwnProperty.call(table, key);

/** A chunk as players read it: "Lumbridge (49, 49)". */
export const chunkPlaceLabel = (key: string): string => {
  const named = chunkSubArea(key);
  if (!named) return chunkLabel(key);
  const { cx, cy } = parseChunkKey(key);
  return `${named} (${cx}, ${cy})`;
};

/** The chunks an activity, guild or Brutus is entered from in Chunked mode (empty when it has none). */
export const activityEntranceChunks = (activity: string): readonly string[] =>
  hasOwn(ACTIVITY_CHUNKS, activity) ? ACTIVITY_CHUNKS[activity] : [];

/** Chunked: is one of these chunks owned. */
export const ownsAnyChunk = (chunks: readonly string[], unlocks: Pick<UnlockState, 'chunks'>): boolean =>
  chunks.some(key => isChunkUnlocked(key, unlocks.chunks ?? []));

// Chunk "cx,cy" -> the quests its entry needs ("cx:cy,cy-cy;..." in CHUNK_ENTRY_QUESTS).
const ENTRY_QUESTS = new Map<string, string[]>();
for (const [quest, columns] of Object.entries(CHUNK_ENTRY_QUESTS)) {
  for (const column of columns.split(';')) {
    const [cx, runs] = column.split(':');
    for (const run of runs.split(',')) {
      const [from, to = from] = run.split('-').map(Number);
      for (let cy = from; cy <= to; cy++) ENTRY_QUESTS.set(`${cx},${cy}`, [...(ENTRY_QUESTS.get(`${cx},${cy}`) ?? []), quest]);
    }
  }
}

/**
 * The quests a chunk's entry needs (the chunk content's questSections, such as
 * Priest in Peril for Morytania past the Salve). Empty for most chunks.
 */
export const chunkEntryQuests = (key: string): readonly string[] => ENTRY_QUESTS.get(key) ?? [];

/** Chunked: the ways into a place that carry their own requirement (the 51 Agility pipe to Vannaka). */
export const gatedEntrances = (name?: string) => (name && hasOwn(GATED_ENTRANCE_CHUNKS, name) ? GATED_ENTRANCE_CHUNKS[name] : []);

/** "Varrock (50, 54) with Agility level 51", one per gated way in. */
export const gatedEntranceLabels = (name?: string) => gatedEntrances(name).map(way => `${chunkPlaceLabel(way.chunk)} with ${way.label}`);

/**
 * Chunked: whether the run can get into one of these chunks: it owns it and has
 * done every quest its entry needs. `name` adds that place's gated ways in,
 * which count only when their requirements are met; one the save cannot answer
 * (a quest only started) stays shut. `missing` lists what holds back the owned
 * ones when none is open.
 */
export const enterableChunk = (
  chunks: readonly string[],
  unlocks: Pick<UnlockState, 'chunks' | 'quests'>,
  name?: string,
): { open: boolean; missing: string[] } => {
  const done = new Set(unlocks.quests ?? []);
  const missing = new Set<string>();
  for (const way of [...chunks.map(chunk => ({ chunk, needs: [] as readonly string[], label: '' })), ...gatedEntrances(name)]) {
    if (!isChunkUnlocked(way.chunk, unlocks.chunks ?? [])) continue;
    const needed = chunkEntryQuests(way.chunk).filter(quest => !done.has(quest));
    if (way.needs.length && evaluateRouteGates(compileRawRequirements(way.needs.map(raw => ({ raw, origin: 'CHUNK_ENTRY' as const }))), unlocks as UnlockState).blockers.length) needed.push(way.label);
    if (needed.length === 0) return { open: true, missing: [] };
    needed.forEach(item => missing.add(item));
  }
  return { open: false, missing: [...missing] };
};

/**
 * The chunk a physical bank's unlock stands for ("cx,cy"), or undefined for a
 * virtual entry such as the Forestry leprechaun, which no chunk holds.
 */
export const bankChunkKey = (bank: string): string | undefined => {
  if (!BANK_BY_ID[bank] || !/^\d+$/.test(bank)) return undefined;
  const id = Number(bank);
  return `${Math.floor(id / 256)},${id % 256}`;
};

/**
 * Chunked: a bank counts only when its own chunk is owned, or, for a bank at
 * sea such as the Bank boat, once the run can sail (chunkUnlocked); a virtual
 * entry always does.
 */
export const chunkedBankOwned = (bank: string, unlocks: UnlockState): boolean => {
  const key = bankChunkKey(bank);
  if (key === undefined) return true;
  const { cx, cy } = parseChunkKey(key);
  return chunkUnlocked(cx, cy, unlocks, 'chunked');
};

const access = (eligible: boolean, requiredAreas: readonly string[]): ActivityAccessResult =>
  ({ eligible, requiredAreas, explanation: eligible ? '' : `Needs ${requiredAreas.join(' or ')}` });
const MISSING: ActivityAccessResult = { eligible: false, requiredAreas: [], explanation: 'Missing location declaration' };

const chunkedRule = (activity: string) =>
  (hasOwn(CHUNKED_ACTIVITY_RULES, activity) ? CHUNKED_ACTIVITY_RULES[activity] : undefined);

/**
 * Chunked: whether an activity can be done in the run's chunks. It counts only
 * when the exact chunk it is entered from is owned, never any chunk of its
 * named area, and the quest that chunk's entry needs is done (Barrows waits for
 * Priest in Peril). An activity no chunk holds back, such as the Mimic, can be fought
 * once unlocked; whether a random Key may land on it is randomKeyActivityAccess.
 */
export const getChunkedActivityAccess = (activity: string, unlocks: UnlockState): ActivityAccessResult => {
  const rule = chunkedRule(activity);
  if (rule?.kind === 'anywhere' || rule?.kind === 'not-random') return access(true, []);
  if (rule?.kind === 'sailing') return access(canNavigateOcean(unlocks), ['Sailing and Pandemonium']);
  const chunks = activityEntranceChunks(activity);
  const gated = gatedEntrances(activity);
  if (chunks.length === 0 && gated.length === 0) return MISSING;
  const entry = enterableChunk(chunks, unlocks, activity);
  if (entry.open) return access(true, []);
  const places = [...chunks, ...gated.map(way => way.chunk)].map(chunkPlaceLabel).join(' or ');
  if (entry.missing.length === 0) return access(false, [...chunks.map(chunkPlaceLabel), ...gatedEntranceLabels(activity)]);
  return {
    eligible: false,
    requiredAreas: [`${places}, after ${entry.missing.join(' and ')}`],
    explanation: `Needs ${entry.missing.join(' and ')}`,
  };
};

/** Chunked: the chunks a Slayer master stands in (empty when the data has none). */
export const slayerMasterChunks = (master: string): readonly string[] =>
  hasOwn(SLAYER_MASTER_CHUNKS, master) ? SLAYER_MASTER_CHUNKS[master] : [];

/**
 * Whether the Farm screen offers a place (a Slayer card, Brutus). In Chunked it
 * shows only when one of its own chunks is owned and the quest that chunk's
 * entry needs is done (Mazchna in Canifis after Priest in Peril), or a gated
 * way in under `name` is open; every other mode offers all.
 */
export const farmPlaceReachable = (
  chunks: readonly string[] | undefined,
  unlocks: UnlockState,
  modeId: string | undefined,
  name?: string,
): boolean => modeId !== 'chunked' || enterableChunk(chunks ?? [], unlocks, name).open;

/** Resolve the location-only eligibility of an activity for the current mode. */
export const getActivityAccess = (
  activity: string,
  unlocks: UnlockState,
  modeId: string,
): ActivityAccessResult => {
  if (modeId === 'chunked') return getChunkedActivityAccess(activity, unlocks);
  if (!usesActivityKeyReserves(modeId) || NO_HARD_LOCATION_GATE.has(activity)) return access(true, []);
  if (!hasOwn(ACTIVITY_ACCESS_AREAS, activity)) return MISSING;
  const requiredAreas = ACTIVITY_ACCESS_AREAS[activity];
  // An area some activities count only after a quest (Paterdomus for Temple Trekking).
  const gate = hasOwn(ACTIVITY_AREA_QUESTS, activity) ? ACTIVITY_AREA_QUESTS[activity] : undefined;
  const result = access(requiredAreas.some((area) => isAreaReachable(area, unlocks, modeId)
    && (gate?.quests[area] ?? []).every((quest) => (unlocks.quests ?? []).includes(quest))), requiredAreas);
  return result.eligible || !gate ? result : { ...result, explanation: gate.explanation };
};

/**
 * Whether a random Key may land on an activity. Chunked keeps random Keys off
 * places it can't follow (the Mimic, from a clue casket), though an Omni-Key
 * can pick them and they then count as done in the Journal; otherwise this is
 * getActivityAccess.
 */
export const randomKeyActivityAccess = (
  activity: string,
  unlocks: UnlockState,
  modeId: string,
): ActivityAccessResult => {
  const rule = modeId === 'chunked' ? chunkedRule(activity) : undefined;
  if (rule?.kind === 'not-random') return access(false, [rule.needs]);
  return getActivityAccess(activity, unlocks, modeId);
};
