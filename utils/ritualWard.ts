/**
 * Saradomin's Ward's test for one entry. Kept apart from utils/ritualEffects so
 * the activity requirements it reads load only when a Ward is spent, not with
 * the app's first screen.
 */
import { TableType, type UnlockState } from '../types';
import { evaluateActivityReadiness } from './activityReadiness';
import { bankChunkKey, randomKeyActivityAccess } from './activityAccess';
import { chunkUnlocked } from './chunkLocations';
import { bankGateAccess } from './entityAccess';
import { parseChunkKey } from './chunkAdjacency';
import { getUtilityActivityReq } from './utilityReadiness';

/**
 * Whether an entry could be used right now if a Key landed on it: its place
 * can be reached, and an activity's quest and skill gates are met. Tables with
 * no single place (skills, gear, shops, mobility, land) always count as usable.
 * It asks what the rest of the app asks: the Activities tab's requirement
 * (a guild's own area included), the map's chunk check (the sea needs sailing)
 * and the bank's own guild or quest gate.
 */
export const wardUsable = (table: TableType, item: string, unlocks: UnlockState, modeId: string): boolean => {
  switch (table) {
    case TableType.BOSSES:
    case TableType.MINIGAMES:
    case TableType.GUILDS:
      // Chunked: a place a Key may land on whose entrance chunk is owned (and its entry quest done).
      if (modeId === 'chunked' && !randomKeyActivityAccess(item, unlocks, modeId).eligible) return false;
      return evaluateActivityReadiness(true, getUtilityActivityReq(item, table, modeId), unlocks, modeId).status !== 'NOT_READY';
    case TableType.BANKS: {
      const key = bankChunkKey(item);
      if (key === undefined) return true;
      const { cx, cy } = parseChunkKey(key);
      if (!chunkUnlocked(cx, cy, unlocks, modeId)) return false;
      return bankGateAccess(item, unlocks, modeId).status !== 'NOT_READY';
    }
    default:
      return true;
  }
};
