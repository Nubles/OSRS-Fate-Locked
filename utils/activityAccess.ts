import { UnlockState } from '../types';
import { usesActivityKeyReserves } from '../config/gameModes';
import { ACTIVITY_ACCESS_AREAS, CHUNKED_ACTIVITY_RULES, NO_HARD_LOCATION_GATE } from '../data/activityAccess';
import { ACTIVITY_CHUNKS, SLAYER_MASTER_CHUNKS } from '../data/activityChunks';
import { BANK_BY_ID } from '../data/banks';
import { isAreaReachable } from './reachability';
import { chunkLabel, chunkSubArea, isChunkUnlocked, parseChunkKey } from './chunkAdjacency';
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

/**
 * The chunk a physical bank's unlock stands for ("cx,cy"), or undefined for a
 * virtual entry such as the Forestry leprechaun, which no chunk holds.
 */
export const bankChunkKey = (bank: string): string | undefined => {
  if (!BANK_BY_ID[bank] || !/^\d+$/.test(bank)) return undefined;
  const id = Number(bank);
  return `${Math.floor(id / 256)},${id % 256}`;
};

/** Chunked: a bank counts only when its own chunk is owned; a virtual entry always does. */
export const chunkedBankOwned = (bank: string, unlocks: Pick<UnlockState, 'chunks'>): boolean => {
  const key = bankChunkKey(bank);
  return key === undefined || isChunkUnlocked(key, unlocks.chunks ?? []);
};

const access = (eligible: boolean, requiredAreas: readonly string[]): ActivityAccessResult =>
  ({ eligible, requiredAreas, explanation: eligible ? '' : `Needs ${requiredAreas.join(' or ')}` });
const MISSING: ActivityAccessResult = { eligible: false, requiredAreas: [], explanation: 'Missing location declaration' };

/**
 * Chunked: an activity counts only when the exact chunk it is entered from is
 * owned, never any chunk of its named area.
 */
export const getChunkedActivityAccess = (activity: string, unlocks: UnlockState): ActivityAccessResult => {
  const rule = hasOwn(CHUNKED_ACTIVITY_RULES, activity) ? CHUNKED_ACTIVITY_RULES[activity] : undefined;
  if (rule?.kind === 'anywhere') return access(true, []);
  if (rule?.kind === 'sailing') return access(canNavigateOcean(unlocks), ['Sailing and Pandemonium']);
  if (rule?.kind === 'not-random') return access(false, [rule.needs]);
  const chunks = activityEntranceChunks(activity);
  return chunks.length === 0 ? MISSING : access(ownsAnyChunk(chunks, unlocks), chunks.map(chunkPlaceLabel));
};

/** Chunked: the chunks a Slayer master stands in (empty when the data has none). */
export const slayerMasterChunks = (master: string): readonly string[] =>
  hasOwn(SLAYER_MASTER_CHUNKS, master) ? SLAYER_MASTER_CHUNKS[master] : [];

/**
 * Whether the Farm screen offers a place (a Slayer card, Brutus). In Chunked it
 * shows only when one of its own chunks is owned; every other mode offers all.
 */
export const farmPlaceReachable = (
  chunks: readonly string[] | undefined,
  unlocks: UnlockState,
  modeId: string | undefined,
): boolean => modeId !== 'chunked' || ownsAnyChunk(chunks ?? [], unlocks);

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
