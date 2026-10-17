/**
 * Saradomin's Ward's test for one entry. Kept apart from utils/ritualEffects so
 * the activity requirements it reads load only when a Ward is spent, not with
 * the app's first screen.
 */
import { getActivityReq } from '../data/activityRequirements';
import { TableType, type UnlockState } from '../types';
import { evaluateActivityReadiness } from './activityReadiness';
import { chunkSubArea } from './chunkAdjacency';
import { bankChunkKey, chunkedBankOwned, getActivityAccess } from './activityAccess';
import { isAreaReachable } from './reachability';

/**
 * Whether an entry could be used right now if a Key landed on it: its place
 * can be reached, and an activity's quest and skill gates are met. Tables with
 * no single place (skills, gear, shops, mobility, land) always count as usable.
 */
export const wardUsable = (table: TableType, item: string, unlocks: UnlockState, modeId: string): boolean => {
  switch (table) {
    case TableType.BOSSES:
    case TableType.MINIGAMES:
    case TableType.GUILDS:
      // Chunked: the entrance chunk itself must be owned.
      if (modeId === 'chunked' && !getActivityAccess(item, unlocks, modeId).eligible) return false;
      return evaluateActivityReadiness(true, getActivityReq(item), unlocks, modeId).status !== 'NOT_READY';
    case TableType.BANKS: {
      const key = bankChunkKey(item);
      if (key === undefined) return true;
      if (modeId === 'chunked') return chunkedBankOwned(item, unlocks);
      const area = chunkSubArea(key);
      return !area || isAreaReachable(area, unlocks, modeId);
    }
    default:
      return true;
  }
};
