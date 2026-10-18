import { UnlockState } from '../types';
import { usesActivityKeyReserves } from '../config/gameModes';
import { ACTIVITY_ACCESS_AREAS, CHUNKED_ACTIVITY_RULES, NO_HARD_LOCATION_GATE } from '../data/activityAccess';
import { ACTIVITY_CHUNKS, SLAYER_MASTER_CHUNKS } from '../data/activityChunks';
import { BANK_BY_ID } from '../data/banks';
import { CHUNK_ENTRY_QUESTS } from '../data/chunkSkillNodes';
import { isAreaReachable } from './reachability';
import { chunkLabel, chunkSubArea, isChunkUnlocked, parseChunkKey } from './chunkAdjacency';
import { chunkUnlocked } from './chunkLocations';
import { canNavigateOcean } from './oceanAccess';

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

/**
 * Chunked: whether the run can get into one of these chunks: it owns it and has
 * done every quest its entry needs. `missing` lists the entry quests that hold
 * back the owned ones when none is open.
 */
export const enterableChunk = (
  chunks: readonly string[],
  unlocks: Pick<UnlockState, 'chunks' | 'quests'>,
): { open: boolean; missing: string[] } => {
  const owned = chunks.filter(key => isChunkUnlocked(key, unlocks.chunks ?? []));
  const done = new Set(unlocks.quests ?? []);
  const missing = new Set<string>();
  for (const key of owned) {
    const needed = chunkEntryQuests(key).filter(quest => !done.has(quest));
    if (needed.length === 0) return { open: true, missing: [] };
    needed.forEach(quest => missing.add(quest));
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
 * Priest in Peril). A place no chunk holds, such as the Mimic, can be fought
 * once unlocked; whether a random Key may land on it is randomKeyActivityAccess.
 */
export const getChunkedActivityAccess = (activity: string, unlocks: UnlockState): ActivityAccessResult => {
  const rule = chunkedRule(activity);
  if (rule?.kind === 'anywhere' || rule?.kind === 'not-random') return access(true, []);
  if (rule?.kind === 'sailing') return access(canNavigateOcean(unlocks), ['Sailing and Pandemonium']);
  const chunks = activityEntranceChunks(activity);
  if (chunks.length === 0) return MISSING;
  const entry = enterableChunk(chunks, unlocks);
  if (entry.open) return access(true, []);
  const places = chunks.map(chunkPlaceLabel).join(' or ');
  if (entry.missing.length === 0) return access(false, chunks.map(chunkPlaceLabel));
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
 * entry needs is done (Mazchna in Canifis after Priest in Peril); every other
 * mode offers all.
 */
export const farmPlaceReachable = (
  chunks: readonly string[] | undefined,
  unlocks: UnlockState,
  modeId: string | undefined,
): boolean => modeId !== 'chunked' || enterableChunk(chunks ?? [], unlocks).open;

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
  return access(requiredAreas.some((area) => isAreaReachable(area, unlocks, modeId)), requiredAreas);
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
